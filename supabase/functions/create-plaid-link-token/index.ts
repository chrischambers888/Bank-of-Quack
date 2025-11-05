// supabase/functions/create-plaid-link-token/index.ts
// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Configuration, PlaidApi, PlaidEnvironments, LinkTokenCreateRequest, CountryCode, Products } from 'https://esm.sh/plaid@25.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
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

    // Get user ID from auth header
    const authHeader = req.headers.get('Authorization')
    let userId = 'user_' + Date.now() // Default fallback
    
    if (authHeader) {
      // Extract user ID from JWT token
      try {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          {
            global: {
              headers: { Authorization: authHeader },
            },
          }
        )
        const { data: { user } } = await supabaseClient.auth.getUser()
        if (user) {
          userId = user.id
        }
      } catch (e) {
        console.warn('Could not get user from token:', e)
      }
    }

    // Create link token request
    const isSandbox = plaidEnv === 'sandbox'
    
    const request: LinkTokenCreateRequest = {
      user: {
        client_user_id: userId,
      },
      client_name: 'Bank of Quack',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
      // In sandbox, allow more flexible phone verification
      ...(isSandbox && {
        // Sandbox-specific settings that may help with phone verification
        webhook: undefined, // Not needed for sandbox
      }),
    }

    // Generate link token
    const response = await plaidClient.linkTokenCreate(request)
    const link_token = response.data.link_token

    return new Response(
      JSON.stringify({ link_token, plaid_env: plaidEnv }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      },
    )
  } catch (error: any) {
    console.error('Error creating link token:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to create link token' }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      },
    )
  }
})
