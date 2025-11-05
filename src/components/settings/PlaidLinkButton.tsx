// src/components/settings/PlaidLinkButton.tsx
import { usePlaidLink } from "react-plaid-link";
import { Button } from "@/components/ui/button";
import { supabase } from "@/supabaseClient";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

interface PlaidLinkButtonProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function PlaidLinkButton({ onSuccess, onError }: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSandbox, setIsSandbox] = useState<boolean | null>(null);

  useEffect(() => {
    // Get link token from Edge Function and check environment
    const fetchLinkToken = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase.functions.invoke(
          "create-plaid-link-token"
        );

        if (fetchError) {
          throw fetchError;
        }

        if (data?.link_token) {
          setLinkToken(data.link_token);
          // Set sandbox mode based on environment from API
          setIsSandbox(data.plaid_env === "sandbox");
        } else {
          throw new Error("No link token received");
        }
      } catch (err: any) {
        console.error("Error fetching link token:", err);
        setError(err.message || "Failed to initialize Plaid connection");
        onError?.(err.message || "Failed to initialize Plaid connection");
      } finally {
        setLoading(false);
      }
    };

    fetchLinkToken();
  }, [onError]);

  const onSuccessCallback = async (public_token: string, metadata: any) => {
    try {
      setLoading(true);
      setError(null);

      console.log("Plaid Link success - public_token:", public_token);
      console.log("Plaid Link metadata:", JSON.stringify(metadata, null, 2));

      // Validate metadata structure
      if (!metadata?.institution) {
        throw new Error("Missing institution data in Plaid response");
      }
      if (
        !metadata?.accounts ||
        !Array.isArray(metadata.accounts) ||
        metadata.accounts.length === 0
      ) {
        throw new Error("No accounts selected or accounts data is missing");
      }

      // Exchange public token for access token via Edge Function
      const requestBody = {
        public_token,
        institution_id: metadata.institution.institution_id,
        institution_name: metadata.institution.name,
        accounts: metadata.accounts,
      };

      console.log(
        "Sending to Edge Function:",
        JSON.stringify(requestBody, null, 2)
      );

      const { data, error: exchangeError } = await supabase.functions.invoke(
        "exchange-plaid-token",
        {
          body: requestBody,
        }
      );

      if (exchangeError) {
        throw exchangeError;
      }

      if (!data?.success) {
        throw new Error("Failed to connect account");
      }

      // Success - refresh link token for potential additional connections
      const { data: newLinkToken } = await supabase.functions.invoke(
        "create-plaid-link-token"
      );
      if (newLinkToken?.link_token) {
        setLinkToken(newLinkToken.link_token);
        // Update environment state from refreshed token response
        setIsSandbox(newLinkToken.plaid_env === "sandbox");
      }

      onSuccess?.();
    } catch (err: any) {
      console.error("Error connecting account:", err);
      const errorMessage = err.message || "Failed to connect account";
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const config = {
    token: linkToken,
    onSuccess: onSuccessCallback,
    onExit: (err: any, metadata: any) => {
      if (err) {
        console.error("Plaid Link exit error:", err);
        console.error("Error details:", JSON.stringify(err, null, 2));
        console.error("Metadata:", JSON.stringify(metadata, null, 2));

        // Provide more helpful error messages
        if (
          err.error_message?.toLowerCase().includes("phone") ||
          err.error_message?.toLowerCase().includes("too_short")
        ) {
          setError(
            "Phone verification issue. In Sandbox mode, use test number: +15005550001 with verification code: 1234"
          );
        } else {
          setError(err.error_message || err.message || "Connection cancelled");
        }
      }
    },
    onEvent: (eventName: string, metadata: any) => {
      console.log("Plaid Link event:", eventName, metadata);
      if (eventName === "ERROR" && metadata?.error_message) {
        console.error("Plaid Link error event:", metadata.error_message);
        if (
          metadata.error_message?.toLowerCase().includes("phone") ||
          metadata.error_message?.toLowerCase().includes("too_short")
        ) {
          setError(
            "Phone verification issue. In Sandbox mode, use test number: +15005550001 with verification code: 1234"
          );
        }
      }
    },
  };

  const { open, ready } = usePlaidLink(config);

  if (loading && !linkToken) {
    return (
      <Button disabled>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading...
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      {isSandbox && (
        <div className="text-xs text-white/60 space-y-1 bg-yellow-900/20 border border-yellow-700/50 rounded p-2">
          <p>
            ⚠️ <strong>Sandbox Mode:</strong> You're currently testing with fake
            accounts.
          </p>
          <p className="text-xs mt-1">
            To connect real accounts, switch to Production mode in your Supabase
            Edge Function secrets: Set{" "}
            <code className="bg-black/30 px-1 rounded">
              PLAID_ENV=production
            </code>{" "}
            and use Production API keys.
          </p>
        </div>
      )}
      {isSandbox && (
        <div className="text-xs text-white/60 space-y-1">
          <p>
            💡 <strong>Sandbox tips:</strong>
          </p>
          <ul className="list-disc list-inside ml-2 space-y-0.5">
            <li>Click "Continue as guest" to skip phone verification</li>
            <li>
              Selecting banks may show "First Platypus Bank" - this is normal in
              Sandbox
            </li>
            <li>
              Use test credentials:{" "}
              <code className="bg-black/30 px-1 rounded">user_good</code> /{" "}
              <code className="bg-black/30 px-1 rounded">pass_good</code>
            </li>
          </ul>
        </div>
      )}
      <Button onClick={() => open()} disabled={!ready || !linkToken || loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Connecting...
          </>
        ) : (
          "Connect Bank Account"
        )}
      </Button>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
