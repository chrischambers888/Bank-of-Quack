// src/hooks/usePendingTransactionsCount.ts
import { useState, useEffect } from "react";
import { supabase } from "@/supabaseClient";

export const usePendingTransactionsCount = () => {
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCount = async () => {
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
    };

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

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { count, loading };
};
