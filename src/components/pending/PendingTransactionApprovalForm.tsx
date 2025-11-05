// src/components/pending/PendingTransactionApprovalForm.tsx
import React, { useState, useEffect, FormEvent, useMemo } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/utils";
import { PendingTransaction, Category, Transaction } from "@/types";

const TRANSACTION_TYPES = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "settlement", label: "Settlement" },
  { value: "reimbursement", label: "Reimbursement" },
];

function getLocalDateString(date: Date = new Date()) {
  return format(date, "yyyy-MM-dd");
}

interface PendingTransactionApprovalFormProps {
  isOpen: boolean;
  onClose: () => void;
  pendingTransaction: PendingTransaction | null;
  categories: Category[];
  userNames: string[];
  transactions: Transaction[];
  onApprove: (
    pendingId: string,
    transactionData: Partial<Transaction>
  ) => Promise<void>;
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
  const [selectedReimbursesTransactionId, setSelectedReimbursesTransactionId] =
    useState<string>("none");
  const [loading, setLoading] = useState(false);

  const getExpenseSplitTypes = (currentUsers: string[]) => {
    if (!currentUsers || currentUsers.length < 2)
      return [{ value: "splitEqually", label: "Split Equally" }];
    return [
      { value: "splitEqually", label: "Split Equally" },
      { value: "user1_only", label: `For ${currentUsers[0]} Only` },
      { value: "user2_only", label: `For ${currentUsers[1]} Only` },
    ];
  };
  const [EXPENSE_SPLIT_TYPES, setExpenseSplitTypes] = useState<
    { value: string; label: string }[]
  >(getExpenseSplitTypes(userNames));

  const availableExpensesForReimbursement = useMemo(() => {
    if (!transactions) return [];
    return transactions
      .filter((t) => t.transaction_type === "expense")
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions]);

  useEffect(() => {
    if (pendingTransaction && isOpen && categories.length > 0 && userNames.length > 0) {
      const currentType = pendingTransaction.transaction_type || "expense";
      setTransactionType(currentType);

      // Parse date properly - handle both string and Date objects
      const transactionDate = pendingTransaction.date
        ? typeof pendingTransaction.date === "string"
          ? new Date(pendingTransaction.date)
          : pendingTransaction.date
        : new Date();
      const localDate = new Date(transactionDate);
      const userTimezoneOffset = localDate.getTimezoneOffset() * 60000;
      setDate(new Date(localDate.getTime() + userTimezoneOffset));

      setDescription(pendingTransaction.description || "");
      setAmount(pendingTransaction.amount?.toString() || "");
      setPaidOrReceivedBy(
        pendingTransaction.paid_by_user_name === "Shared"
          ? "Shared"
          : userNames.includes(pendingTransaction.paid_by_user_name!)
          ? pendingTransaction.paid_by_user_name!
          : ""
      );
      setSelectedReimbursesTransactionId(
        pendingTransaction.reimburses_transaction_id || "none"
      );
      
      if (currentType === "settlement") {
        setPaidToUserName(
          userNames.includes(pendingTransaction.paid_to_user_name!)
            ? pendingTransaction.paid_to_user_name!
            : ""
        );
        setSelectedCategoryId("");
        setSplitType("");
      } else if (currentType === "expense") {
        let categoryToEdit = null;
        if (pendingTransaction.category_id) {
          categoryToEdit = categories.find(
            (c) => c.id === pendingTransaction.category_id
          );
        }
        setSelectedCategoryId(
          categoryToEdit ? categoryToEdit.id : ""
        );
        setSplitType(
          pendingTransaction.split_type &&
            EXPENSE_SPLIT_TYPES.some(
              (s) => s.value === pendingTransaction.split_type
            )
            ? pendingTransaction.split_type
            : ""
        );
        setPaidToUserName("");
      } else if (
        currentType === "income" ||
        currentType === "reimbursement"
      ) {
        setSelectedCategoryId("");
        setSplitType("");
        setPaidToUserName("");
      }
    }
  }, [pendingTransaction, isOpen, categories, userNames, EXPENSE_SPLIT_TYPES]);

  useEffect(() => {
    setExpenseSplitTypes(getExpenseSplitTypes(userNames));
  }, [userNames]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      !description ||
      !amount ||
      isNaN(parseFloat(amount)) ||
      parseFloat(amount) <= 0
    ) {
      alert("Please fill in a valid description and amount.");
      return;
    }
    if (!paidOrReceivedBy) {
      alert(
        transactionType === "income" || transactionType === "reimbursement"
          ? "Please select who received."
          : "Please select who paid."
      );
      return;
    }

    if (!date) {
      alert("Please select a date.");
      return;
    }

    let transactionDataPayload: Partial<Transaction> = {
      transaction_type: transactionType,
      date: getLocalDateString(date),
      description,
      amount: parseFloat(amount),
      paid_by_user_name: null,
      category_id: null,
      split_type: null,
      paid_to_user_name: null,
      reimburses_transaction_id:
        selectedReimbursesTransactionId === "none"
          ? null
          : selectedReimbursesTransactionId,
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
      transactionDataPayload = {
        ...transactionDataPayload,
        category_id: selectedCategoryId,
        split_type: splitType,
        paid_by_user_name: paidOrReceivedBy,
      };
    } else if (transactionType === "settlement") {
      transactionDataPayload = {
        ...transactionDataPayload,
        paid_by_user_name: paidOrReceivedBy,
        paid_to_user_name: paidToUserName,
      };
    } else if (
      transactionType === "income" ||
      transactionType === "reimbursement"
    ) {
      transactionDataPayload = {
        ...transactionDataPayload,
        paid_to_user_name: paidOrReceivedBy,
      };
    }

    try {
      setLoading(true);
      await onApprove(pendingTransaction!.id, transactionDataPayload);
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
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 bg-gradient-to-b from-[#004D40] to-[#26A69A] text-white border-white/20">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-3xl font-bold text-center">
            Approve Transaction
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 space-y-8 pb-4">
          {/* Transaction Type */}
          <ToggleGroup
            type="single"
            value={transactionType}
            onValueChange={(value: string) => {
              if (value) {
                setTransactionType(value);
              }
            }}
            className="grid grid-cols-2 md:grid-cols-4 gap-2"
          >
            {TRANSACTION_TYPES.map((type) => (
              <ToggleGroupItem
                key={type.value}
                value={type.value}
                className="capitalize data-[state=on]:bg-yellow-400 data-[state=on]:text-teal-900"
              >
                {type.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal bg-white/10",
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
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="e.g., Groceries from Walmart"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                className="bg-white/10"
              />
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-2 text-center">
            <Label htmlFor="amount" className="text-lg">
              Amount
            </Label>
            <Input
              id="amount"
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              min="0"
              step="0.01"
              className="text-5xl font-bold text-center h-auto bg-transparent border-x-0 border-t-0 border-b-2 border-white/50 focus:ring-0 focus:border-yellow-400 transition-colors"
            />
          </div>

          {/* Paid by / Received by */}
          <div className="space-y-2">
            <Label htmlFor="paid-by">
              {transactionType === "income" ||
              transactionType === "reimbursement"
                ? "Received by"
                : "Paid by"}
            </Label>
            <Select
              value={paidOrReceivedBy}
              onValueChange={setPaidOrReceivedBy}
            >
              <SelectTrigger
                id="paid-by"
                className="bg-white/10"
              >
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent>
                {transactionType === "expense" && (
                  <SelectItem key="Shared" value="Shared">
                    Shared
                  </SelectItem>
                )}
                {userNames.map((user) => (
                  <SelectItem key={user} value={user}>
                    {user}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Conditional Fields */}
          {transactionType === "expense" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={selectedCategoryId}
                  onValueChange={setSelectedCategoryId}
                >
                  <SelectTrigger
                    id="category"
                    className="bg-white/10"
                  >
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <div className="flex items-center gap-2">
                          {cat.image_url && (
                            <img
                              src={cat.image_url}
                              alt={cat.name}
                              className="w-6 h-6 rounded-full object-cover"
                            />
                          )}
                          <span>{cat.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="split-type">Split Type</Label>
                <Select
                  value={splitType}
                  onValueChange={setSplitType}
                >
                  <SelectTrigger
                    id="split-type"
                    className="bg-white/10"
                  >
                    <SelectValue placeholder="Select split type" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_SPLIT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {transactionType === "settlement" && (
            <div className="space-y-2">
              <Label htmlFor="paid-to">Paid to</Label>
              <Select
                value={paidToUserName}
                onValueChange={setPaidToUserName}
              >
                <SelectTrigger
                  id="paid-to"
                  className="bg-white/10"
                >
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {userNames
                    .filter((user) => user !== paidOrReceivedBy)
                    .map((user) => (
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
              <Label htmlFor="reimburses">Reimburses Transaction</Label>
              <Select
                value={selectedReimbursesTransactionId}
                onValueChange={setSelectedReimbursesTransactionId}
              >
                <SelectTrigger id="reimburses" className="bg-white/10">
                  <SelectValue placeholder="Select transaction to reimburse" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {availableExpensesForReimbursement.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.date} - {t.description} ({formatMoney(t.amount)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          </div>
          <div className="w-full p-4 border-t border-white/10 bg-gradient-to-b from-transparent via-[#004D40] to-[#004D40] flex-shrink-0">
            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
                className="flex-1 h-12 text-lg"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 bg-yellow-400 text-teal-900 hover:bg-yellow-500 h-12 text-lg"
              >
                {loading ? "Approving..." : "Approve Transaction"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
