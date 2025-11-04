// src/hooks/usePendingTransactions.ts
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/supabaseClient";
import { PendingTransaction, Transaction } from "@/types";

export const usePendingTransactions = () => {
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  const [processedTransactions, setProcessedTransactions] = useState<PendingTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPendingTransactions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch pending transactions
      const { data: pendingData, error: pendingError } = await supabase
        .from("pending_transactions")
        .select(`
          *,
          connected_accounts!inner (
            id,
            account_name,
            institution_name,
            account_last_four
          ),
          categories (
            id,
            name
          )
        `)
        .eq("status", "pending")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (pendingError) throw pendingError;

      // Fetch approved/rejected transactions
      const { data: processedData, error: processedError } = await supabase
        .from("pending_transactions")
        .select(`
          *,
          connected_accounts!inner (
            id,
            account_name,
            institution_name,
            account_last_four
          ),
          categories (
            id,
            name
          )
        `)
        .in("status", ["approved", "rejected"])
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (processedError) throw processedError;

      // Transform the data to include category_name
      const transformedPending = (pendingData || []).map((pt: any) => ({
        ...pt,
        category_name: pt.categories?.name || null,
      }));

      const transformedProcessed = (processedData || []).map((pt: any) => ({
        ...pt,
        category_name: pt.categories?.name || null,
      }));

      setPendingTransactions(transformedPending);
      setProcessedTransactions(transformedProcessed);
    } catch (err: any) {
      console.error("Error fetching pending transactions:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingTransactions();
  }, [fetchPendingTransactions]);

  const approvePendingTransaction = useCallback(
    async (
      pendingTransactionId: string,
      transactionData: Partial<Transaction>
    ) => {
      try {
        // 1. Fetch pending transaction
        const { data: pending, error: fetchError } = await supabase
          .from("pending_transactions")
          .select("*")
          .eq("id", pendingTransactionId)
          .single();

        if (fetchError) throw fetchError;

        // 2. Create transaction with user-provided data
        const { data: newTransaction, error: insertError } = await supabase
          .from("transactions")
          .insert([
            {
              date: transactionData.date || pending.date,
              description: transactionData.description || pending.description,
              amount: transactionData.amount || pending.amount,
              transaction_type:
                transactionData.transaction_type || pending.transaction_type,
              category_id: transactionData.category_id || pending.category_id,
              paid_by_user_name:
                transactionData.paid_by_user_name || pending.paid_by_user_name,
              split_type: transactionData.split_type || pending.split_type,
              paid_to_user_name:
                transactionData.paid_to_user_name || pending.paid_to_user_name,
              reimburses_transaction_id:
                transactionData.reimburses_transaction_id ||
                pending.reimburses_transaction_id,
            },
          ])
          .select()
          .single();

        if (insertError) throw insertError;

        // 3. Update pending transaction status
        const { error: updateError } = await supabase
          .from("pending_transactions")
          .update({
            status: "approved",
            approved_at: new Date().toISOString(),
            transaction_id: newTransaction.id,
          })
          .eq("id", pendingTransactionId);

        if (updateError) throw updateError;

        // 4. Fetch the complete transaction from transactions_view (includes category_name, etc.)
        const { data: completeTransaction, error: fetchCompleteError } = await supabase
          .from("transactions_view")
          .select("*")
          .eq("id", newTransaction.id)
          .single();

        if (fetchCompleteError) {
          console.error("Error fetching complete transaction:", fetchCompleteError);
          // Fallback to the basic transaction if view fetch fails
          return newTransaction;
        }

        // 5. Refresh pending transactions list
        await fetchPendingTransactions();

        return completeTransaction || newTransaction;
      } catch (err: any) {
        console.error("Error approving transaction:", err);
        throw err;
      }
    },
    [fetchPendingTransactions]
  );

  const rejectPendingTransaction = useCallback(
    async (pendingTransactionId: string) => {
      try {
        const { error } = await supabase
          .from("pending_transactions")
          .update({
            status: "rejected",
            rejected_at: new Date().toISOString(),
          })
          .eq("id", pendingTransactionId);

        if (error) throw error;

        await fetchPendingTransactions();
      } catch (err: any) {
        console.error("Error rejecting transaction:", err);
        throw err;
      }
    },
    [fetchPendingTransactions]
  );

  const restorePendingTransaction = useCallback(
    async (pendingTransactionId: string) => {
      try {
        // Restore the pending transaction status back to pending
        // Note: We do NOT delete the associated transaction if it was approved,
        // as it may have been edited during approval and we want to preserve that
        const { error } = await supabase
          .from("pending_transactions")
          .update({
            status: "pending",
            approved_at: null,
            rejected_at: null,
            transaction_id: null, // Clear the link but don't delete the actual transaction
          })
          .eq("id", pendingTransactionId);

        if (error) throw error;

        await fetchPendingTransactions();
      } catch (err: any) {
        console.error("Error restoring pending transaction:", err);
        throw err;
      }
    },
    [fetchPendingTransactions]
  );

  const deletePendingTransaction = useCallback(
    async (pendingTransactionId: string) => {
      try {
        const { error } = await supabase
          .from("pending_transactions")
          .delete()
          .eq("id", pendingTransactionId);

        if (error) throw error;

        await fetchPendingTransactions();
      } catch (err: any) {
        console.error("Error deleting pending transaction:", err);
        throw err;
      }
    },
    [fetchPendingTransactions]
  );

  const deleteAllProcessedTransactions = useCallback(
    async () => {
      try {
        // Delete all processed transactions (approved or rejected)
        const { error } = await supabase
          .from("pending_transactions")
          .delete()
          .in("status", ["approved", "rejected"]);

        if (error) throw error;

        await fetchPendingTransactions();
      } catch (err: any) {
        console.error("Error deleting all processed transactions:", err);
        throw err;
      }
    },
    [fetchPendingTransactions]
  );

  const editPendingTransaction = useCallback(
    async (
      pendingTransactionId: string,
      edits: Partial<PendingTransaction>
    ) => {
      try {
        const { error } = await supabase
          .from("pending_transactions")
          .update({
            ...edits,
            status: "edited", // Mark as edited
          })
          .eq("id", pendingTransactionId);

        if (error) throw error;

        await fetchPendingTransactions();
      } catch (err: any) {
        console.error("Error editing pending transaction:", err);
        throw err;
      }
    },
    [fetchPendingTransactions]
  );

  return {
    pendingTransactions,
    processedTransactions,
    loading,
    error,
    refetch: fetchPendingTransactions,
    approvePendingTransaction,
    rejectPendingTransaction,
    restorePendingTransaction,
    deletePendingTransaction,
    deleteAllProcessedTransactions,
    editPendingTransaction,
  };
};
