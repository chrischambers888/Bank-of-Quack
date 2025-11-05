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

        console.log("Link token response - data:", data);
        console.log("Link token response - error:", fetchError);

        // Check if there's an error in the response data (Supabase sometimes puts errors in data)
        if (data?.error) {
          console.error("Error in response data:", data.error);
          console.error("Plaid error details:", data.plaid_error);
          console.error("Error code:", data.error_code);
          console.error("Error type:", data.error_type);

          let errorMessage = data.error;
          if (data.error_code) {
            errorMessage += ` (Error code: ${data.error_code})`;
          }
          if (data.error_type) {
            errorMessage += ` (Type: ${data.error_type})`;
          }
          if (data.plaid_error) {
            console.error(
              "Full Plaid error object:",
              JSON.stringify(data.plaid_error, null, 2)
            );
          }
          throw new Error(errorMessage);
        }

        if (fetchError) {
          console.error("Fetch error:", fetchError);
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
        console.error("Full error details:", JSON.stringify(err, null, 2));
        console.error("Error message:", err.message);
        console.error("Error stack:", err.stack);

        // Try to extract detailed error from response
        let errorMessage =
          err.message || "Failed to initialize Plaid connection";

        setError(errorMessage);
        onError?.(errorMessage);
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
        console.error("Error code:", err.error_code);
        console.error("Error type:", err.error_type);
        console.error("Display message:", err.display_message);
        console.error("Error message:", err.error_message);

        // Provide more helpful error messages
        let errorMessage =
          err.error_message ||
          err.display_message ||
          err.message ||
          "Connection cancelled";

        if (err.error_code) {
          errorMessage += ` (Code: ${err.error_code})`;
        }
        if (err.error_type) {
          errorMessage += ` (Type: ${err.error_type})`;
        }

        if (
          err.error_message?.toLowerCase().includes("phone") ||
          err.error_message?.toLowerCase().includes("too_short")
        ) {
          errorMessage =
            "Phone verification issue. In Sandbox mode, use test number: +15005550001 with verification code: 1234";
        }

        setError(errorMessage);
      }
    },
    onEvent: (eventName: string, metadata: any) => {
      console.log("Plaid Link event:", eventName);
      console.log("Event metadata:", JSON.stringify(metadata, null, 2));
      if (eventName === "ERROR") {
        console.error(
          "Plaid Link error event - Error code:",
          metadata?.error_code
        );
        console.error(
          "Plaid Link error event - Error type:",
          metadata?.error_type
        );
        console.error(
          "Plaid Link error event - Display message:",
          metadata?.display_message
        );
        console.error(
          "Plaid Link error event - Error message:",
          metadata?.error_message
        );

        if (metadata?.error_message) {
          let errorMessage = metadata.error_message;
          if (metadata.error_code) {
            errorMessage += ` (Code: ${metadata.error_code})`;
          }
          if (metadata.error_type) {
            errorMessage += ` (Type: ${metadata.error_type})`;
          }

          if (
            metadata.error_message?.toLowerCase().includes("phone") ||
            metadata.error_message?.toLowerCase().includes("too_short")
          ) {
            errorMessage =
              "Phone verification issue. In Sandbox mode, use test number: +15005550001 with verification code: 1234";
          }

          setError(errorMessage);
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
