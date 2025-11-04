// src/hooks/usePendingTransactionsCount.ts
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/supabaseClient";

export const usePendingTransactionsCount = () => {
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const fetchCount = useCallback(async () => {
    try {
      const { count, error } = await supabase
        .from("pending_transactions")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      if (error) throw error;
      setCount(count || 0);
    } catch (error) {
      console.error("Error fetching pending count:", error);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  // Expose a function to trigger refetch via event (for components that need it)
  const triggerRefetch = useCallback(() => {
    window.dispatchEvent(new Event("pendingTransactionsCount:refetch"));
  }, []);

  useEffect(() => {
    fetchCount();

    // Set up real-time subscription
    const subscription = supabase
      .channel("pending_transactions_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pending_transactions",
          filter: "status=eq.pending",
        },
        () => {
          fetchCount();
        }
      )
      .subscribe();

    // Listen for custom event to trigger refetch (for immediate updates)
    const handleRefetchEvent = () => {
      fetchCount();
    };
    window.addEventListener("pendingTransactionsCount:refetch", handleRefetchEvent);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("pendingTransactionsCount:refetch", handleRefetchEvent);
    };
  }, [fetchCount]);

  return { count, loading, refetch: fetchCount, triggerRefetch };
};
