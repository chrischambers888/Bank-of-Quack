// src/components/TransactionForm.tsx
import React, { useState, useEffect, useMemo, useRef, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Transaction, Category } from "@/types";
import { formatMoney } from "@/lib/utils";

interface TransactionFormProps {
  userNames: string[];
  categories: Category[];
  transactions: Transaction[];
  editingTransaction: Transaction | null;
  addTransaction: (t: Partial<Transaction>) => void;
  updateTransaction: (t: Partial<Transaction>) => void;
  handleSetEditingTransaction: (t: Transaction | null) => void;
}

const TRANSACTION_TYPES = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "settlement", label: "Settlement" },
  { value: "reimbursement", label: "Reimbursement" },
];

function getLocalDateString(date: Date = new Date()) {
  return format(date, "yyyy-MM-dd");
}

const TransactionForm: React.FC<TransactionFormProps> = ({
  userNames,
  categories,
  transactions,
  editingTransaction,
  addTransaction,
  updateTransaction,
  handleSetEditingTransaction,
}) => {
  const navigate = useNavigate();

  const [id, setId] = useState<string | null>(null);
  const [transactionType, setTransactionType] = useState<string>(
    TRANSACTION_TYPES[0].value
  );
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [description, setDescription] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [paidOrReceivedBy, setPaidOrReceivedBy] = useState<string>("");
  const [paidToUserName, setPaidToUserName] = useState<string>("");
  const [splitType, setSplitType] = useState<string>("");
  const [selectedReimbursesTransactionId, setSelectedReimbursesTransactionId] =
    useState<string>("none");

  const isEditing = !!editingTransaction;
  const lastEditIdRef = useRef<string | null>(null);

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
    let timeoutId: NodeJS.Timeout | null = null;
    if (
      isEditing &&
      editingTransaction &&
      categories.length > 0 &&
      userNames.length > 0 &&
      editingTransaction.id !== lastEditIdRef.current
    ) {
      timeoutId = setTimeout(() => {
        lastEditIdRef.current = editingTransaction.id;
        const currentType = editingTransaction.transaction_type || "expense";
        setTransactionType(currentType);
        setId(editingTransaction.id);

        const localDate = new Date(editingTransaction.date);
        const userTimezoneOffset = localDate.getTimezoneOffset() * 60000;
        setDate(new Date(localDate.getTime() + userTimezoneOffset));

        setDescription(editingTransaction.description);
        setAmount(editingTransaction.amount.toString());
        setPaidOrReceivedBy(
          editingTransaction.paid_by_user_name === "Shared"
            ? "Shared"
            : userNames.includes(editingTransaction.paid_by_user_name!)
            ? editingTransaction.paid_by_user_name!
            : userNames[0]
        );
        setSelectedReimbursesTransactionId(
          editingTransaction.reimburses_transaction_id || "none"
        );
        if (currentType === "settlement") {
          setPaidToUserName(
            userNames.includes(editingTransaction.paid_to_user_name!)
              ? editingTransaction.paid_to_user_name!
              : userNames.find(
                  (u) => u !== editingTransaction.paid_by_user_name
                ) || ""
          );
          setSelectedCategoryId("");
          setSplitType("");
        } else if (currentType === "expense") {
          let categoryToEdit = null;
          if (editingTransaction.category_id) {
            categoryToEdit = categories.find(
              (c) => c.id === editingTransaction.category_id
            );
          }
          setSelectedCategoryId(
            categoryToEdit ? categoryToEdit.id : categories[0]?.id || ""
          );
          setSplitType(
            editingTransaction.split_type &&
              EXPENSE_SPLIT_TYPES.some(
                (s) => s.value === editingTransaction.split_type
              )
              ? editingTransaction.split_type
              : EXPENSE_SPLIT_TYPES[0]?.value || "splitEqually"
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
      }, 100);
    } else if (!isEditing && categories.length > 0 && userNames.length > 0) {
      // Reset form when not editing (creating new transaction)
      lastEditIdRef.current = null;
      setId(null);
      setTransactionType("expense");
      setDate(new Date());
      setDescription("");
      setAmount("");
      setPaidOrReceivedBy("");
      setSelectedReimbursesTransactionId("none");
      setSelectedCategoryId("");
      setSplitType("");
      setPaidToUserName("");
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isEditing, editingTransaction, categories, userNames]);

  useEffect(() => {
    setExpenseSplitTypes(getExpenseSplitTypes(userNames));
  }, [userNames]);

  const resetFormAndState = () => {
    setId(null);
    setTransactionType("expense");
    setDate(new Date());
    setDescription("");
    setAmount("");
    setSelectedCategoryId("");
    setPaidOrReceivedBy("");
    setPaidToUserName("");
    setSplitType("");
    setSelectedReimbursesTransactionId("none");
    handleSetEditingTransaction(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
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

    if (isEditing) {
      updateTransaction({ ...transactionDataPayload, id: id! });
      resetFormAndState();
      navigate("/");
    } else {
      addTransaction(transactionDataPayload);
      resetFormAndState();
      navigate("/");
    }
  };

  const handleCancelEdit = () => {
    resetFormAndState();
    navigate("/");
  };

  return (
    <Card className="max-w-2xl mx-auto bg-transparent border-none shadow-none text-white">
      <CardHeader>
        <CardTitle className="text-3xl font-bold text-center">
          {isEditing ? "Edit Transaction" : "New Transaction"}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-24">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Transaction Type */}
          <ToggleGroup
            type="single"
            value={transactionType}
            onValueChange={(value: string) => {
              if (value) setTransactionType(value);
            }}
            className="grid grid-cols-2 md:grid-cols-4 gap-2"
            disabled={isEditing}
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
              <SelectTrigger id="paid-by" className="bg-white/10">
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
                  <SelectTrigger id="category" className="bg-white/10">
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
                <Select value={splitType} onValueChange={setSplitType}>
                  <SelectTrigger id="split-type" className="bg-white/10">
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
              <Select value={paidToUserName} onValueChange={setPaidToUserName}>
                <SelectTrigger id="paid-to" className="bg-white/10">
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

          <div className="fixed bottom-0 left-0 right-0 w-full p-4 z-10">
            <div className="max-w-2xl mx-auto flex gap-4">
              {isEditing && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelEdit}
                  className="flex-1 h-12 text-lg"
                >
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                className="flex-1 bg-yellow-400 text-teal-900 hover:bg-yellow-500 h-12 text-lg"
              >
                {isEditing ? "Update Transaction" : "Add Transaction"}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default TransactionForm;
