// src/pages/PendingTransactionsPage.tsx
import React, { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePendingTransactions } from "@/hooks/usePendingTransactions";
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
  const {
    pendingTransactions,
    loading,
    error,
    refetch,
    approvePendingTransaction,
    rejectPendingTransaction,
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
      setIsApprovalFormOpen(false);
      setSelectedTransaction(null);
    } catch (error: any) {
      throw error; // Let the form handle the error
    }
  };

  const handleReject = async (pendingId: string) => {
    if (!confirm("Are you sure you want to reject this transaction?")) {
      return;
    }

    try {
      setRejectingId(pendingId);
      await rejectPendingTransaction(pendingId);
    } catch (error: any) {
      alert("Error rejecting transaction: " + error.message);
    } finally {
      setRejectingId(null);
    }
  };

  const handleEdit = (transaction: PendingTransaction) => {
    setSelectedTransaction(transaction);
    setIsApprovalFormOpen(true);
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

      {pendingTransactions.length === 0 ? (
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
        <div className="space-y-3">
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
              onEdit={() => handleEdit(transaction)}
            />
          ))}
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
