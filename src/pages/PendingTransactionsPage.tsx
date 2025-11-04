// src/pages/PendingTransactionsPage.tsx
import React, { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { usePendingTransactions } from "@/hooks/usePendingTransactions";
import { usePendingTransactionsCount } from "@/hooks/usePendingTransactionsCount";
import { PendingTransactionCard } from "@/components/pending/PendingTransactionCard";
import { PendingTransactionApprovalForm } from "@/components/pending/PendingTransactionApprovalForm";
import { PendingTransaction, Transaction } from "@/types";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface PendingTransactionsPageContext {
  userNames: string[];
  categories: any[];
  transactions: Transaction[];
  addTransaction: (t: Partial<Transaction>) => void;
}

export default function PendingTransactionsPage() {
  const navigate = useNavigate();
  const context = useOutletContext<PendingTransactionsPageContext>();
  const { triggerRefetch } = usePendingTransactionsCount();
  const {
    pendingTransactions,
    processedTransactions,
    loading,
    error,
    refetch,
    approvePendingTransaction,
    rejectPendingTransaction,
    restorePendingTransaction,
    deletePendingTransaction,
  } = usePendingTransactions();

  const [selectedTransaction, setSelectedTransaction] =
    useState<PendingTransaction | null>(null);
  const [isApprovalFormOpen, setIsApprovalFormOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const handleApprove = async (
    pendingId: string,
    transactionData: Partial<Transaction>
  ) => {
    try {
      const newTransaction = await approvePendingTransaction(
        pendingId,
        transactionData
      );
      // Refresh transactions list in parent
      if (context.addTransaction && newTransaction) {
        context.addTransaction(newTransaction);
      }
      // Trigger badge count update
      triggerRefetch();
      setIsApprovalFormOpen(false);
      setSelectedTransaction(null);
    } catch (error: any) {
      throw error; // Let the form handle the error
    }
  };

  const handleReject = async (pendingId: string) => {
    try {
      setRejectingId(pendingId);
      await rejectPendingTransaction(pendingId);
      // Trigger badge count update
      triggerRefetch();
    } catch (error: any) {
      alert("Error rejecting transaction: " + error.message);
    } finally {
      setRejectingId(null);
    }
  };

  const handleRestore = async (pendingId: string) => {
    try {
      await restorePendingTransaction(pendingId);
      // Trigger badge count update (restoring adds back to pending)
      triggerRefetch();
    } catch (error: any) {
      alert("Error restoring transaction: " + error.message);
    }
  };

  const handleDelete = async (pendingId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this transaction? It will appear again on the next sync if it still exists in your bank account."
      )
    ) {
      return;
    }

    try {
      await deletePendingTransaction(pendingId);
      // Note: Deleting a processed transaction doesn't change pending count,
      // but triggering refetch ensures consistency
      triggerRefetch();
    } catch (error: any) {
      alert("Error deleting transaction: " + error.message);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
            <p className="ml-4 text-white">Loading pending transactions...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="py-12">
            <p className="text-red-500">Error: {error}</p>
            <Button onClick={() => refetch()} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Pending Transactions</h1>
        <Button onClick={() => navigate("/settings")} variant="outline">
          Manage Accounts
        </Button>
      </div>

      {pendingTransactions.length === 0 &&
      processedTransactions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-white/80 text-lg mb-2">
              No pending transactions
            </p>
            <p className="text-white/60 text-sm mb-4">
              Connect a bank account in Settings to start importing transactions
            </p>
            <Button onClick={() => navigate("/settings")}>
              Go to Settings
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Pending Transactions */}
          {pendingTransactions.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xl font-semibold text-white">Pending</h2>
              {pendingTransactions.map((transaction: any) => (
                <PendingTransactionCard
                  key={transaction.id}
                  transaction={transaction}
                  userNames={context.userNames || []}
                  onApprove={() => {
                    setSelectedTransaction(transaction);
                    setIsApprovalFormOpen(true);
                  }}
                  onReject={() => handleReject(transaction.id)}
                />
              ))}
            </div>
          )}

          {/* Processed Transactions (Approved/Rejected) */}
          {processedTransactions.length > 0 && (
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="processed" className="border-white/20">
                <AccordionTrigger className="text-white hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <span className="text-xl font-semibold">
                      Processed ({processedTransactions.length})
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 mt-2">
                    {processedTransactions.map((transaction: any) => (
                      <PendingTransactionCard
                        key={transaction.id}
                        transaction={transaction}
                        userNames={context.userNames || []}
                        onRestore={() => handleRestore(transaction.id)}
                        onDelete={() => handleDelete(transaction.id)}
                      />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </div>
      )}

      <PendingTransactionApprovalForm
        isOpen={isApprovalFormOpen}
        onClose={() => {
          setIsApprovalFormOpen(false);
          setSelectedTransaction(null);
        }}
        pendingTransaction={selectedTransaction}
        categories={context.categories || []}
        userNames={context.userNames || []}
        transactions={context.transactions || []}
        onApprove={handleApprove}
      />
    </div>
  );
}
