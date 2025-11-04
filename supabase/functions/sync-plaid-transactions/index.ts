// supabase/functions/sync-plaid-transactions/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Configuration, PlaidApi, PlaidEnvironments, TransactionsGetRequest } from 'https://esm.sh/plaid@25.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { account_id, days_back = 7 } = await req.json()
    
    if (!account_id) {
      throw new Error('Missing required field: account_id')
    }

    // Validate days_back (default 7, max 90)
    const days = Math.min(Math.max(parseInt(days_back) || 7, 1), 90)

    // Get authenticated user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      throw new Error('Unauthorized: ' + (authError?.message || 'No user found'))
    }

    // Get connected account (RLS ensures user can only access their own accounts)
    const { data: account, error: accountError } = await supabaseClient
      .from('connected_accounts')
      .select('*')
      .eq('id', account_id)
      .eq('user_id', user.id) // Additional check for security
      .single()

    if (accountError || !account) {
      throw new Error('Account not found or access denied')
    }

    if (!account.is_active) {
      throw new Error('Account is not active')
    }

    // Initialize Plaid client
    const plaidEnv = Deno.env.get('PLAID_ENV') || 'sandbox'
    const configuration = new Configuration({
      basePath: PlaidEnvironments[plaidEnv as keyof typeof PlaidEnvironments],
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': Deno.env.get('PLAID_CLIENT_ID')!,
          'PLAID-SECRET': Deno.env.get('PLAID_SECRET')!,
        },
      },
    })
    const plaidClient = new PlaidApi(configuration)

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Format dates as YYYY-MM-DD
    const formatDate = (date: Date) => date.toISOString().split('T')[0]

    // Fetch transactions from Plaid
    const request: TransactionsGetRequest = {
      access_token: account.plaid_access_token!,
      start_date: formatDate(startDate),
      end_date: formatDate(endDate),
      account_ids: [account.plaid_account_id!],
    }

    let allTransactions: any[] = []
    let hasMore = true
    let cursor: string | undefined = undefined

    // Handle pagination (Plaid returns up to 500 transactions per request)
    while (hasMore) {
      if (cursor) {
        request.cursor = cursor
      }

      const response = await plaidClient.transactionsGet(request)
      const transactions = response.data.transactions || []
      allTransactions = allTransactions.concat(transactions)

      // Check if there are more transactions
      hasMore = response.data.has_more || false
      cursor = response.data.next_cursor || undefined

      // Safety limit to prevent infinite loops
      if (allTransactions.length > 10000) {
        console.warn('Transaction limit reached, stopping pagination')
        break
      }
    }

    // Insert new transactions as pending
    let syncedCount = 0
    let skippedCount = 0
    const errors: string[] = []

    for (const txn of allTransactions) {
      // Skip pending transactions (only process posted transactions)
      if (txn.pending) {
        continue
      }

      // Check if transaction already exists
      const { data: existing } = await supabaseClient
        .from('pending_transactions')
        .select('id')
        .eq('plaid_transaction_id', txn.transaction_id)
        .single()

      if (existing) {
        skippedCount++
        continue // Skip duplicates
      }

      // Determine transaction type based on amount
      // Plaid uses negative amounts for debits (expenses) and positive for credits (income)
      const transactionType = txn.amount < 0 ? 'expense' : 'income'
      const amount = Math.abs(txn.amount)

      // Get description from transaction name or merchant name
      const description = txn.name || txn.merchant_name || 'Unknown Transaction'

      // Insert as pending transaction (only date, description, amount from Plaid)
      const { error: insertError } = await supabaseClient
        .from('pending_transactions')
        .insert({
          connected_account_id: account.id,
          plaid_transaction_id: txn.transaction_id,
          date: txn.date,
          description: description,
          amount: amount,
          transaction_type: transactionType, // Default type, user can change during approval
          status: 'pending',
          raw_data: txn, // Store original Plaid data for reference
          // All other fields (category_id, paid_by_user_name, split_type, etc.) are null
          // User must fill these during approval
        })

      if (insertError) {
        console.error('Error inserting pending transaction:', insertError)
        errors.push(`Failed to insert transaction ${txn.transaction_id}: ${insertError.message}`)
      } else {
        syncedCount++
      }
    }

    // Update last_synced_at
    await supabaseClient
      .from('connected_accounts')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', account.id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        synced: syncedCount,
        skipped: skippedCount,
        total_fetched: allTransactions.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error: any) {
    console.error('Error syncing transactions:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to sync transactions' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
