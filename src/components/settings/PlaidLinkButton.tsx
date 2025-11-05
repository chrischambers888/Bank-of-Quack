// src/components/settings/PlaidLinkButton.tsx
import { usePlaidLink } from "react-plaid-link";
import { Button } from "@/components/ui/button";
import { supabase } from "@/supabaseClient";
import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { useLocation } from "react-router-dom";

interface PlaidLinkButtonProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

const LINK_TOKEN_STORAGE_KEY = "plaid_link_token";
const LINK_TOKEN_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes (Link tokens expire after ~30 minutes)

export function PlaidLinkButton({ onSuccess, onError }: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSandbox, setIsSandbox] = useState<boolean | null>(null);
  const [receivedRedirectUri, setReceivedRedirectUri] = useState<string | null>(
    null
  );
  const location = useLocation();
  const hasInitializedRef = useRef(false);
  const hasFetchedTokenRef = useRef(false);

  // Check if we're returning from an OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const oauthStateId = params.get("oauth_state_id");
    const error = params.get("error");

    // Check if there's an OAuth error from the bank
    if (error && !oauthStateId) {
      console.error("OAuth error from bank:", error);
      const errorDescription =
        params.get("error_description") || "OAuth authentication failed";
      setError(`Bank OAuth error: ${errorDescription}`);
      // Clear URL params
      window.history.replaceState({}, "", location.pathname);
      return;
    }

    if (oauthStateId && !receivedRedirectUri) {
      // We're returning from an OAuth redirect
      // IMPORTANT: receivedRedirectUri must be the EXACT URL that Plaid redirected to (full URL with query params)
      // This must match the redirect_uri used when creating the link token (base URL)
      // But receivedRedirectUri should be the full redirected URL
      const currentUrl = window.location.href;
      console.log("OAuth redirect detected!");
      console.log("  - receivedRedirectUri (full):", currentUrl);
      console.log("  - oauth_state_id:", oauthStateId);
      console.log("  - origin:", window.location.origin);
      console.log("  - pathname:", window.location.pathname);
      console.log("  - search:", window.location.search);
      setReceivedRedirectUri(currentUrl);

      // When returning from OAuth, we should use the same link token that was used initially
      // The link token is tied to the redirect_uri and OAuth state, so we must use the original token
      // Try to restore link token from localStorage
      try {
        const stored = localStorage.getItem(LINK_TOKEN_STORAGE_KEY);
        if (stored) {
          const { token, timestamp } = JSON.parse(stored);
          const age = Date.now() - timestamp;
          if (age < LINK_TOKEN_EXPIRY_MS) {
            console.log("Restored link token from localStorage for OAuth continuation");
            console.log("  - Token age:", Math.round(age / 1000), "seconds");
            setLinkToken(token);
            hasFetchedTokenRef.current = true; // Mark as fetched so we don't fetch again
            // Don't clear URL yet - we need it for receivedRedirectUri
            // It will be cleared after Link reinitializes
            return; // Don't fetch new token, use the stored one
          } else {
            console.log("Stored link token expired, will fetch new one");
            console.log("  - Token age:", Math.round(age / 1000), "seconds (expires at", LINK_TOKEN_EXPIRY_MS / 1000, "seconds)");
            localStorage.removeItem(LINK_TOKEN_STORAGE_KEY);
          }
        } else {
          console.log("No stored link token found, will fetch new one");
        }
      } catch (e) {
        console.error("Error reading stored link token:", e);
      }
    }
  }, [location.search, receivedRedirectUri]);

  // Fetch link token - only once on mount or when needed for OAuth redirect
  useEffect(() => {
    // Skip if we already fetched (unless we're handling OAuth redirect without a stored token)
    if (hasFetchedTokenRef.current && !receivedRedirectUri) {
      return;
    }

    // If we're handling OAuth redirect and already have a token from localStorage, skip
    if (receivedRedirectUri && linkToken) {
      return;
    }

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
          hasFetchedTokenRef.current = true;

          // Store link token in localStorage for OAuth redirect handling
          try {
            localStorage.setItem(
              LINK_TOKEN_STORAGE_KEY,
              JSON.stringify({
                token: data.link_token,
                timestamp: Date.now(),
              })
            );
          } catch (e) {
            console.warn("Failed to store link token in localStorage:", e);
          }
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
    // Only run when receivedRedirectUri changes (for OAuth) or on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receivedRedirectUri, onError]);

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

        // Store new link token in localStorage
        try {
          localStorage.setItem(
            LINK_TOKEN_STORAGE_KEY,
            JSON.stringify({
              token: newLinkToken.link_token,
              timestamp: Date.now(),
            })
          );
        } catch (e) {
          console.warn("Failed to store link token in localStorage:", e);
        }
      }

      // Clear OAuth redirect state and URL params
      setReceivedRedirectUri(null);
      hasInitializedRef.current = false;
      window.history.replaceState({}, "", location.pathname);

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
    // Include receivedRedirectUri when returning from OAuth redirect
    ...(receivedRedirectUri && { receivedRedirectUri }),
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

        // Handle OAuth-related errors
        if (
          err.error_code === "REQUIRES_OAUTH" ||
          err.exit_status === "requires_oauth" ||
          err.error_message?.toLowerCase().includes("oauth") ||
          err.error_message?.toLowerCase().includes("redirect") ||
          metadata?.exit_status === "requires_oauth"
        ) {
          errorMessage +=
            "\n\n⚠️ OAuth Required: This institution requires OAuth authentication.\n" +
            "Please verify:\n" +
            "1. Redirect URI is registered in Plaid Dashboard (Team Settings → Allowed redirect URIs)\n" +
            "2. Redirect URI matches exactly: " +
            (window.location.origin || "your production URL") +
            "\n" +
            "3. You're using production environment (PLAID_ENV=production)\n" +
            "4. The redirect URI in your code matches what's registered in Dashboard";
        }

        if (
          err.error_message?.toLowerCase().includes("phone") ||
          err.error_message?.toLowerCase().includes("too_short")
        ) {
          errorMessage =
            "Phone verification issue. In Sandbox mode, use test number: +15005550001 with verification code: 1234";
        }

        setError(errorMessage);

        // Clear receivedRedirectUri and URL params after exit
        setReceivedRedirectUri(null);
        hasInitializedRef.current = false;
        window.history.replaceState({}, "", location.pathname);
      } else {
        // Even if no error, clear URL params when exiting (user cancelled, etc.)
        window.history.replaceState({}, "", location.pathname);
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

          // Handle OAuth-related errors
          if (
            metadata.error_code === "REQUIRES_OAUTH" ||
            metadata.error_message?.toLowerCase().includes("oauth") ||
            metadata.error_message?.toLowerCase().includes("redirect")
          ) {
            errorMessage +=
              "\n\nNote: This institution requires OAuth. Make sure you have:\n" +
              "1. Registered the redirect URI in Plaid Dashboard (Team Settings → Allowed redirect URIs)\n" +
              "2. Set PLAID_ENV=production in your Supabase Edge Function secrets\n" +
              "3. The redirect URI matches exactly: " +
              (window.location.origin || "your production URL");
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

  // Auto-open Link when returning from OAuth redirect
  useEffect(() => {
    if (
      receivedRedirectUri &&
      linkToken &&
      ready &&
      !hasInitializedRef.current
    ) {
      console.log("Auto-opening Link after OAuth redirect");
      console.log("  - Config receivedRedirectUri:", receivedRedirectUri);
      console.log("  - Current window.location.href:", window.location.href);
      console.log("  - Link ready:", ready);
      console.log("  - Link token exists:", !!linkToken);
      
      hasInitializedRef.current = true;
      // DO NOT clear URL params yet - Link needs them (oauth_state_id) for OAuth state validation
      // They will be cleared in onSuccess or onExit callbacks after Link processes them
      // Use a longer timeout to ensure Link is fully ready and config is updated
      setTimeout(() => {
        console.log("Opening Link with receivedRedirectUri:", receivedRedirectUri);
        open();
      }, 300);
    }
  }, [receivedRedirectUri, linkToken, ready, open, location.pathname]);

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
