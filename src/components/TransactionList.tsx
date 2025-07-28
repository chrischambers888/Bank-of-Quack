// src/components/TransactionList.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "./transactions/DataTable";
import { getColumns } from "./transactions/columns";
import { formatMoney } from "@/lib/utils";
import { Transaction, Category } from "@/types";

interface TransactionListProps {
  transactions: Transaction[];
  allTransactions?: Transaction[];
  deleteTransaction: (id: string) => void;
  handleSetEditingTransaction?: (transaction: Transaction) => void;
  className?: string;
  showValues?: boolean;
  incomeImageUrl?: string | null;
  settlementImageUrl?: string | null;
  reimbursementImageUrl?: string | null;
  variant?: "default" | "dialog";
  userNames: string[];
  categories: Category[];
  hideIncome?: boolean;
}

const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  allTransactions = [],
  deleteTransaction,
  handleSetEditingTransaction,
  className = "",
  showValues = true,
  incomeImageUrl,
  settlementImageUrl,
  reimbursementImageUrl,
  variant = "default",
  userNames,
  categories,
  hideIncome = false,
}) => {
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [allExpanded, setAllExpanded] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(
    null
  );

  const getSplitTypeLabel = (splitTypeParam: string) => {
    if (!userNames || userNames.length < 2) {
      switch (splitTypeParam) {
        case "splitEqually":
          return "Split Equally";
        case "user1_only":
          return "For User 1 Only";
        case "user2_only":
          return "For User 2 Only";
        default:
          return splitTypeParam || "N/A";
      }
    }
    switch (splitTypeParam) {
      case "splitEqually":
        return `Split Equally`;
      case "user1_only":
        return `For ${userNames[0]} Only`;
      case "user2_only":
        return `For ${userNames[1]} Only`;
      default:
        return splitTypeParam || "N/A";
    }
  };

  const onEdit = (transaction: Transaction) => {
    if (handleSetEditingTransaction) {
      handleSetEditingTransaction(transaction);
      // The navigation will be handled by the handleSetEditingTransaction function
    } else {
      // If no handleSetEditingTransaction is provided, just navigate (for backward compatibility)
      if (variant !== "dialog") {
        navigate("/transactions");
      }
      // In dialog mode without handleSetEditingTransaction, do nothing (like ImportDialog)
    }
  };

  const handleDeleteRequest = (transactionId: string) => {
    setTransactionToDelete(transactionId);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (transactionToDelete) {
      deleteTransaction(transactionToDelete);
    }
    setIsDeleteDialogOpen(false);
    setTransactionToDelete(null);
  };

  const filteredTransactions = hideIncome
    ? transactions.filter((t) => t.transaction_type !== "income")
    : transactions;

  if (!filteredTransactions || filteredTransactions.length === 0) {
    return <p>No transactions found for the selected period.</p>;
  }

  const sortedTransactions = [...filteredTransactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const isDialog = variant === "dialog";

  return (
    <div className={className}>
      {/* Header with Expand/Collapse All button */}
      <div className="flex items-center justify-between mb-2">
        <h2
          className={`text-2xl font-bold ${
            isDialog ? "text-white" : "text-white"
          }`}
        >
          Transactions
        </h2>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            if (allExpanded) {
              setExpandedId(null);
              setAllExpanded(false);
            } else {
              setExpandedId("ALL");
              setAllExpanded(true);
            }
          }}
          className={`ml-2 ${isDialog ? "text-white hover:bg-white/10" : ""}`}
        >
          {allExpanded ? "Collapse All" : "Expand All"}
        </Button>
      </div>
      {/* Flat list for mobile and desktop */}
      <div className="space-y-2">
        {sortedTransactions.length === 0 ? (
          <p className={isDialog ? "text-gray-300" : ""}>
            No transactions found for the selected period.
          </p>
        ) : (
          sortedTransactions.map((t) => {
            const type = t.transaction_type || "expense";
            let reimbursedExpenseDescription = null;
            if (
              type === "reimbursement" &&
              t.reimburses_transaction_id &&
              allTransactions
            ) {
              const originalExpense = allTransactions.find(
                (exp: any) => exp.id === t.reimburses_transaction_id
              );
              if (originalExpense) {
                reimbursedExpenseDescription = originalExpense.description;
              }
            }
            const isPositive = type === "income" || type === "reimbursement";
            const dateLabel = t.date;
            const isExpanded = allExpanded || expandedId === t.id;
            return (
              <div key={t.id}>
                <div
                  className={`bg-background/80 rounded-xl transition-colors cursor-pointer border ${
                    isDialog
                      ? "border-gray-700 hover:bg-white/5"
                      : "border-border"
                  } ${
                    isExpanded ? "ring-2 ring-primary/30" : ""
                  } flex flex-col overflow-hidden animate-fade-in user-select-none focus:outline-none`}
                  onClick={() => {
                    window.getSelection()?.removeAllRanges();
                    if (allExpanded) return;
                    setExpandedId(isExpanded ? null : t.id);
                  }}
                >
                  {/* Top row: image, details, amount */}
                  <div className="flex items-center gap-4 px-2 py-3">
                    {/* Category image */}
                    <div className="flex-shrink-0">
                      {(() => {
                        let catImg = null;
                        if (t.category_id) {
                          const cat = categories.find(
                            (c: any) => c.id === t.category_id
                          );
                          if (cat && cat.image_url) {
                            catImg = (
                              <img
                                src={cat.image_url}
                                alt={cat.name}
                                className="w-10 h-10 rounded-xl object-cover bg-white border border-border"
                              />
                            );
                          }
                        }
                        if (!catImg) {
                          if (type === "income" && incomeImageUrl) {
                            return (
                              <img
                                src={incomeImageUrl}
                                alt="Income"
                                className="w-10 h-10 rounded-xl object-contain bg-white border border-border"
                              />
                            );
                          }
                          if (type === "settlement" && settlementImageUrl) {
                            return (
                              <img
                                src={settlementImageUrl}
                                alt="Settlement"
                                className="w-10 h-10 rounded-xl object-contain bg-white border border-border"
                              />
                            );
                          }
                          if (
                            type === "reimbursement" &&
                            reimbursementImageUrl
                          ) {
                            return (
                              <img
                                src={reimbursementImageUrl}
                                alt="Reimbursement"
                                className="w-10 h-10 rounded-xl object-contain bg-white border border-border"
                              />
                            );
                          }
                        }
                        return (
                          catImg || (
                            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground text-lg font-bold">
                              ?
                            </div>
                          )
                        );
                      })()}
                    </div>
                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-base font-semibold text-white ${
                          isExpanded ? "" : "truncate"
                        }`}
                      >
                        {t.description}
                      </div>
                      <div
                        className={`text-xs mt-0.5 ${
                          isDialog ? "text-gray-400" : "text-muted-foreground"
                        }`}
                      >
                        {dateLabel}
                      </div>
                    </div>
                    {/* Amount */}
                    <div className="flex flex-col items-end min-w-[70px]">
                      <span
                        className={`text-lg font-bold ${
                          isPositive ? "text-green-600" : "text-red-500"
                        }`}
                      >
                        {showValues
                          ? `${isPositive ? "+" : "-"}${formatMoney(t.amount)}`
                          : "•••••"}
                      </span>
                    </div>
                  </div>
                  {/* Expanded details and buttons inside the box */}
                  {isExpanded && (
                    <div
                      className={`px-4 pb-3 pt-2 border-t ${
                        isDialog ? "border-gray-700" : "border-border"
                      } bg-muted/20`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div
                        className={`grid grid-cols-2 gap-x-4 gap-y-2 text-sm ${
                          isDialog ? "text-white" : ""
                        }`}
                      >
                        <div>
                          <strong>Type:</strong> {type}
                        </div>
                        {type === "expense" && t.category_id && (
                          <div>
                            <strong>Category:</strong>{" "}
                            {categories.find((c) => c.id === t.category_id)
                              ?.name || "N/A"}
                          </div>
                        )}
                        {type === "settlement" && (
                          <div>
                            <strong>Paid To:</strong> {t.paid_to_user_name}
                          </div>
                        )}
                        {type === "expense" && (
                          <div>
                            <strong>Paid By:</strong> {t.paid_by_user_name}
                          </div>
                        )}
                        {type === "expense" && t.split_type && (
                          <div>
                            <strong>Split:</strong>{" "}
                            {getSplitTypeLabel(t.split_type)}
                          </div>
                        )}
                        {(type === "income" || type === "reimbursement") && (
                          <div>
                            <strong>Received By:</strong> {t.paid_to_user_name}
                          </div>
                        )}
                        {type === "reimbursement" &&
                          reimbursedExpenseDescription && (
                            <div className="col-span-2">
                              <strong>Reimburses:</strong>{" "}
                              {reimbursedExpenseDescription}
                            </div>
                          )}
                      </div>
                      <div className="flex justify-end gap-2 mt-4">
                        {handleSetEditingTransaction && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => onEdit(t)}
                            className="text-white"
                          >
                            Edit
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteRequest(t.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              transaction.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TransactionList;
