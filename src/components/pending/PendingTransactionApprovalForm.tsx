// src/components/pending/PendingTransactionApprovalForm.tsx
import React, { useState, useEffect, FormEvent } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { PendingTransaction, Category, Transaction } from "@/types";

const TRANSACTION_TYPES = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "settlement", label: "Settlement" },
  { value: "reimbursement", label: "Reimbursement" },
];

interface PendingTransactionApprovalFormProps {
  isOpen: boolean;
  onClose: () => void;
  pendingTransaction: PendingTransaction | null;
  categories: Category[];
  userNames: string[];
  transactions: Transaction[];
  onApprove: (pendingId: string, transactionData: Partial<Transaction>) => Promise<void>;
}

export function PendingTransactionApprovalForm({
  isOpen,
  onClose,
  pendingTransaction,
  categories,
  userNames,
  transactions,
  onApprove,
}: PendingTransactionApprovalFormProps) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [description, setDescription] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [transactionType, setTransactionType] = useState<string>("expense");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [paidOrReceivedBy, setPaidOrReceivedBy] = useState<string>("");
  const [paidToUserName, setPaidToUserName] = useState<string>("");
  const [splitType, setSplitType] = useState<string>("");
  const [selectedReimbursesTransactionId, setSelectedReimbursesTransactionId] = useState<string>("none");
  const [loading, setLoading] = useState(false);

  const getExpenseSplitTypes = () => {
    if (!userNames || userNames.length < 2)
      return [{ value: "splitEqually", label: "Split Equally" }];
    return [
      { value: "splitEqually", label: "Split Equally" },
      { value: "user1_only", label: `For ${userNames[0]} Only` },
      { value: "user2_only", label: `For ${userNames[1]} Only` },
    ];
  };
  const EXPENSE_SPLIT_TYPES = getExpenseSplitTypes();

  useEffect(() => {
    if (pendingTransaction && isOpen) {
      setDate(new Date(pendingTransaction.date));
      setDescription(pendingTransaction.description || "");
      setAmount(pendingTransaction.amount?.toString() || "");
      setTransactionType(pendingTransaction.transaction_type || "expense");
      setSelectedCategoryId(pendingTransaction.category_id || "");
      setPaidOrReceivedBy(pendingTransaction.paid_by_user_name || "");
      setPaidToUserName(pendingTransaction.paid_to_user_name || "");
      setSplitType(pendingTransaction.split_type || "");
      setSelectedReimbursesTransactionId("none");
    }
  }, [pendingTransaction, isOpen]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pendingTransaction || !description || !amount) {
      alert("Please fill in all required fields.");
      return;
    }

    const transactionData: Partial<Transaction> = {
      date: date ? format(date, "yyyy-MM-dd") : pendingTransaction.date,
      description,
      amount: parseFloat(amount),
      transaction_type: transactionType,
    };

    if (transactionType === "expense") {
      if (!selectedCategoryId) {
        alert("Please select a category.");
        return;
      }
      if (!splitType) {
        alert("Please select a split type.");
        return;
      }
      transactionData.category_id = selectedCategoryId;
      transactionData.split_type = splitType;
      transactionData.paid_by_user_name = paidOrReceivedBy;
    } else if (transactionType === "settlement") {
      transactionData.paid_by_user_name = paidOrReceivedBy;
      transactionData.paid_to_user_name = paidToUserName;
    } else if (transactionType === "income" || transactionType === "reimbursement") {
      transactionData.paid_to_user_name = paidOrReceivedBy;
    }

    if (transactionType === "reimbursement" && selectedReimbursesTransactionId !== "none") {
      transactionData.reimburses_transaction_id = selectedReimbursesTransactionId;
    }

    try {
      setLoading(true);
      await onApprove(pendingTransaction.id, transactionData);
      onClose();
    } catch (error: any) {
      alert("Error approving transaction: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!pendingTransaction) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gradient-to-b from-[#004D40] to-[#26A69A] text-white border-white/20">
        <DialogHeader>
          <DialogTitle>Approve Transaction</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Date */}
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal bg-white/10 text-white border-white/20",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-white/10 text-white border-white/20"
              required
            />
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label>Amount</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-white/10 text-white border-white/20"
              required
            />
          </div>

          {/* Transaction Type */}
          <div className="space-y-2">
            <Label>Transaction Type</Label>
            <Select value={transactionType} onValueChange={setTransactionType}>
              <SelectTrigger className="bg-white/10 text-white border-white/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSACTION_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Conditional Fields based on Transaction Type */}
          {transactionType === "expense" && (
            <>
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                  <SelectTrigger className="bg-white/10 text-white border-white/20">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Paid By *</Label>
                <Select value={paidOrReceivedBy} onValueChange={setPaidOrReceivedBy}>
                  <SelectTrigger className="bg-white/10 text-white border-white/20">
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Shared">Shared</SelectItem>
                    {userNames.map((user) => (
                      <SelectItem key={user} value={user}>
                        {user}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Split Type *</Label>
                <Select value={splitType} onValueChange={setSplitType}>
                  <SelectTrigger className="bg-white/10 text-white border-white/20">
                    <SelectValue placeholder="Select split type" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_SPLIT_TYPES.map((split) => (
                      <SelectItem key={split.value} value={split.value}>
                        {split.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {transactionType === "settlement" && (
            <>
              <div className="space-y-2">
                <Label>Paid By *</Label>
                <Select value={paidOrReceivedBy} onValueChange={setPaidOrReceivedBy}>
                  <SelectTrigger className="bg-white/10 text-white border-white/20">
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {userNames.map((user) => (
                      <SelectItem key={user} value={user}>
                        {user}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Paid To *</Label>
                <Select value={paidToUserName} onValueChange={setPaidToUserName}>
                  <SelectTrigger className="bg-white/10 text-white border-white/20">
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {userNames.map((user) => (
                      <SelectItem key={user} value={user}>
                        {user}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {(transactionType === "income" || transactionType === "reimbursement") && (
            <div className="space-y-2">
              <Label>Received By *</Label>
              <Select value={paidOrReceivedBy} onValueChange={setPaidOrReceivedBy}>
                <SelectTrigger className="bg-white/10 text-white border-white/20">
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {userNames.map((user) => (
                    <SelectItem key={user} value={user}>
                      {user}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {transactionType === "reimbursement" && (
            <div className="space-y-2">
              <Label>Reimburses Transaction</Label>
              <Select
                value={selectedReimbursesTransactionId}
                onValueChange={setSelectedReimbursesTransactionId}
              >
                <SelectTrigger className="bg-white/10 text-white border-white/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {transactions
                    .filter((t) => t.transaction_type === "expense")
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.description} - ${t.amount.toFixed(2)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Approving..." : "Approve Transaction"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
