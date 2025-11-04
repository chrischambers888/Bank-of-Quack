// src/components/pending/PendingTransactionCard.tsx
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PendingTransaction } from "@/types";
import { CheckCircle2, XCircle, RotateCcw, Trash2 } from "lucide-react";
import { formatMoney } from "@/lib/utils";

interface PendingTransactionCardProps {
  transaction: PendingTransaction & {
    connected_accounts?: {
      account_name?: string;
      institution_name?: string;
      account_last_four?: string;
    };
  };
  onApprove?: () => void;
  onReject?: () => void;
  onRestore?: () => void;
  onDelete?: () => void;
  userNames: string[];
}

export function PendingTransactionCard({
  transaction,
  onApprove,
  onReject,
  onRestore,
  onDelete,
  userNames,
}: PendingTransactionCardProps) {
  const accountInfo = transaction.connected_accounts;
  const isPending = transaction.status === "pending";

  return (
    <Card className="bg-white/5 border-white/20">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-white">
                  {transaction.description}
                </h3>
                <p className="text-sm text-white/60">
                  {new Date(transaction.date).toLocaleDateString()}
                </p>
                {accountInfo && (
                  <p className="text-xs text-white/50 mt-1">
                    {accountInfo.institution_name}
                    {accountInfo.account_last_four &&
                      ` •••• ${accountInfo.account_last_four}`}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="font-bold text-lg text-white">
                  {formatMoney(transaction.amount)}
                </p>
                <Badge
                  variant="outline"
                  className={`mt-1 ${
                    transaction.status === "approved"
                      ? "bg-green-600/20 border-green-600 text-green-300"
                      : transaction.status === "rejected"
                      ? "bg-red-600/20 border-red-600 text-red-300"
                      : ""
                  }`}
                >
                  {transaction.status}
                </Badge>
              </div>
            </div>

            {/* Show fields if they're filled */}
            {transaction.transaction_type && (
              <div className="flex flex-wrap gap-2 text-xs text-white/60">
                <span>Type: {transaction.transaction_type}</span>
                {transaction.category_name && (
                  <span>Category: {transaction.category_name}</span>
                )}
                {transaction.paid_by_user_name && (
                  <span>Paid by: {transaction.paid_by_user_name}</span>
                )}
                {transaction.split_type && (
                  <span>Split: {transaction.split_type}</span>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {isPending ? (
              <>
                <Button
                  size="sm"
                  onClick={onApprove}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Approve
                </Button>
                <Button size="sm" onClick={onReject} variant="destructive">
                  <XCircle className="h-4 w-4 mr-1" />
                  Reject
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  onClick={onRestore}
                  variant="outline"
                  className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border-blue-600"
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Restore
                </Button>
                <Button size="sm" onClick={onDelete} variant="destructive">
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
