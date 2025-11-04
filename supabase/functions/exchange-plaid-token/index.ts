// supabase/functions/exchange-plaid-token/index.ts
// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Configuration, PlaidApi, PlaidEnvironments } from 'https://esm.sh/plaid@25.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    console.log('Received request body:', JSON.stringify(body, null, 2))
    
    const { public_token, institution_id, institution_name, accounts } = body
    
    // Validate required fields with detailed error messages
    if (!public_token) {
      throw new Error('Missing required field: public_token')
    }
    if (!institution_id) {
      throw new Error('Missing required field: institution_id. Received body: ' + JSON.stringify(body))
    }
    if (!institution_name) {
      throw new Error('Missing required field: institution_name. Received body: ' + JSON.stringify(body))
    }
    if (!accounts) {
      throw new Error('Missing required field: accounts. Received body: ' + JSON.stringify(body))
    }
    if (!Array.isArray(accounts)) {
      throw new Error('accounts must be an array. Received: ' + typeof accounts)
    }
    if (accounts.length === 0) {
      throw new Error('accounts array is empty. No accounts were selected.')
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

    // Exchange public token for access token
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token: public_token,
    })

    const access_token = exchangeResponse.data.access_token
    const item_id = exchangeResponse.data.item_id

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

    // Store connected account(s) in database
    const connectedAccounts = []
    for (const account of accounts) {
      // Determine account type from Plaid account type
      let accountType: 'checking' | 'savings' | 'credit_card' | 'investment' = 'checking'
      if (account.type === 'depository') {
        accountType = account.subtype === 'savings' ? 'savings' : 'checking'
      } else if (account.type === 'credit') {
        accountType = 'credit_card'
      } else if (account.type === 'investment') {
        accountType = 'investment'
      }

      const { data, error } = await supabaseClient
        .from('connected_accounts')
        .insert({
          user_id: user.id,
          account_type: accountType,
          provider: 'plaid',
          account_name: account.name || `${institution_name} ${account.mask || ''}`,
          account_last_four: account.mask || null,
          plaid_item_id: item_id,
          plaid_access_token: access_token, // In production, encrypt this
          plaid_account_id: account.id,
          institution_id: institution_id,
          institution_name: institution_name,
          is_active: true,
          sync_frequency: 'manual',
        })
        .select()
        .single()

      if (error) {
        console.error('Error inserting connected account:', error)
        throw error
      }
      connectedAccounts.push(data)

      // Immediately sync transactions for new account (30 days initial)
      try {
        const syncResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/sync-plaid-transactions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': req.headers.get('Authorization') || '',
          },
          body: JSON.stringify({
            account_id: data.id,
            days_back: 30, // Initial sync: 30 days
          }),
        })
        
        if (!syncResponse.ok) {
          console.warn('Initial sync failed for account:', data.id, await syncResponse.text())
        }
      } catch (syncError) {
        console.warn('Error triggering initial sync:', syncError)
        // Don't fail the entire request if sync fails
      }
    }

    return new Response(
      JSON.stringify({ success: true, accounts: connectedAccounts }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error: any) {
    console.error('Error exchanging token:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to exchange token' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
