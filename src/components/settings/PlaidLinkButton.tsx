// src/components/settings/PlaidLinkButton.tsx
import { usePlaidLink } from 'react-plaid-link'
import { Button } from '@/components/ui/button'
import { supabase } from '@/supabaseClient'
import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'

interface PlaidLinkButtonProps {
  onSuccess?: () => void
  onError?: (error: string) => void
}

export function PlaidLinkButton({ onSuccess, onError }: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Get link token from Edge Function
    const fetchLinkToken = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const { data, error: fetchError } = await supabase.functions.invoke('create-plaid-link-token')
        
        if (fetchError) {
          throw fetchError
        }
        
        if (data?.link_token) {
          setLinkToken(data.link_token)
        } else {
          throw new Error('No link token received')
        }
      } catch (err: any) {
        console.error('Error fetching link token:', err)
        setError(err.message || 'Failed to initialize Plaid connection')
        onError?.(err.message || 'Failed to initialize Plaid connection')
      } finally {
        setLoading(false)
      }
    }
    
    fetchLinkToken()
  }, [onError])

  const onSuccessCallback = async (public_token: string, metadata: any) => {
    try {
      setLoading(true)
      setError(null)

      // Exchange public token for access token via Edge Function
      const { data, error: exchangeError } = await supabase.functions.invoke('exchange-plaid-token', {
        body: {
          public_token,
          institution_id: metadata.institution.institution_id,
          institution_name: metadata.institution.name,
          accounts: metadata.accounts,
        },
      })

      if (exchangeError) {
        throw exchangeError
      }

      if (!data?.success) {
        throw new Error('Failed to connect account')
      }

      // Success - refresh link token for potential additional connections
      const { data: newLinkToken } = await supabase.functions.invoke('create-plaid-link-token')
      if (newLinkToken?.link_token) {
        setLinkToken(newLinkToken.link_token)
      }

      onSuccess?.()
    } catch (err: any) {
      console.error('Error connecting account:', err)
      const errorMessage = err.message || 'Failed to connect account'
      setError(errorMessage)
      onError?.(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const config = {
    token: linkToken,
    onSuccess: onSuccessCallback,
    onExit: (err: any, metadata: any) => {
      if (err) {
        console.error('Plaid Link exit error:', err)
        setError(err.message || 'Connection cancelled')
      }
    },
  }

  const { open, ready } = usePlaidLink(config)

  if (loading && !linkToken) {
    return (
      <Button disabled>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading...
      </Button>
    )
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={() => open()}
        disabled={!ready || !linkToken || loading}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Connecting...
          </>
        ) : (
          'Connect Bank Account'
        )}
      </Button>
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  )
}
