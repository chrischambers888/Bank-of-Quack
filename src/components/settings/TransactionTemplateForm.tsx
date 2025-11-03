import React, { useState, useEffect, FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TransactionTemplate, Category } from "@/types";

interface TransactionTemplateFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (template: Partial<TransactionTemplate>) => Promise<void>;
  editingTemplate: TransactionTemplate | null;
  userNames: string[];
  categories: Category[];
}

const TRANSACTION_TYPES = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "settlement", label: "Settlement" },
  { value: "reimbursement", label: "Reimbursement" },
];

const TransactionTemplateForm: React.FC<TransactionTemplateFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingTemplate,
  userNames,
  categories,
}) => {
  const [templateName, setTemplateName] = useState<string>("");
  const [transactionType, setTransactionType] = useState<string>(
    TRANSACTION_TYPES[0].value
  );
  const [description, setDescription] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [paidOrReceivedBy, setPaidOrReceivedBy] = useState<string>("");
  const [paidToUserName, setPaidToUserName] = useState<string>("");
  const [splitType, setSplitType] = useState<string>("");

  const isEditing = !!editingTemplate;

  const getExpenseSplitTypes = (currentUsers: string[]) => {
    if (!currentUsers || currentUsers.length < 2)
      return [{ value: "splitEqually", label: "Split Equally" }];
    return [
      { value: "splitEqually", label: "Split Equally" },
      { value: "user1_only", label: `For ${currentUsers[0]} Only` },
      { value: "user2_only", label: `For ${currentUsers[1]} Only` },
    ];
  };

  const EXPENSE_SPLIT_TYPES = getExpenseSplitTypes(userNames);

  useEffect(() => {
    if (isEditing && editingTemplate) {
      setTemplateName(editingTemplate.template_name);
      setTransactionType(editingTemplate.transaction_type || "expense");
      setDescription(editingTemplate.description);
      setAmount(editingTemplate.amount.toString());
      setPaidOrReceivedBy(editingTemplate.paid_by_user_name || "");
      
      if (editingTemplate.transaction_type === "settlement") {
        setPaidToUserName(editingTemplate.paid_to_user_name || "");
        setSelectedCategoryId("");
        setSplitType("");
      } else if (editingTemplate.transaction_type === "expense") {
        setSelectedCategoryId(editingTemplate.category_id || "");
        setSplitType(editingTemplate.split_type || "splitEqually");
        setPaidToUserName("");
      } else {
        setSelectedCategoryId("");
        setSplitType("");
        setPaidToUserName("");
      }
    } else {
      resetForm();
    }
  }, [isEditing, editingTemplate]);

  const resetForm = () => {
    setTemplateName("");
    setTransactionType("expense");
    setDescription("");
    setAmount("");
    setPaidOrReceivedBy("");
    setPaidToUserName("");
    setSelectedCategoryId("");
    setSplitType("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (!templateName.trim()) {
      alert("Please enter a template name.");
      return;
    }
    
    if (!description || !amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
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

    let templateData: Partial<TransactionTemplate> = {
      template_name: templateName.trim(),
      transaction_type: transactionType,
      description,
      amount: parseFloat(amount),
      paid_by_user_name: null,
      category_id: null,
      split_type: null,
      paid_to_user_name: null,
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
      templateData = {
        ...templateData,
        category_id: selectedCategoryId,
        split_type: splitType,
        paid_by_user_name: paidOrReceivedBy,
      };
    } else if (transactionType === "settlement") {
      templateData = {
        ...templateData,
        paid_by_user_name: paidOrReceivedBy,
        paid_to_user_name: paidToUserName,
      };
    } else if (
      transactionType === "income" ||
      transactionType === "reimbursement"
    ) {
      templateData = {
        ...templateData,
        paid_to_user_name: paidOrReceivedBy,
      };
    }

    try {
      await onSubmit(templateData);
      resetForm();
      onClose();
    } catch (error) {
      // Error is handled in the onSubmit callback
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[#004D40] border-[#26A69A] text-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white">
            {isEditing ? "Edit Transaction Template" : "Create Transaction Template"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Template Name */}
          <div className="space-y-2">
            <Label htmlFor="template-name" className="text-white">Template Name</Label>
            <Input
              id="template-name"
              placeholder="e.g., Weekly Groceries"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              required
              className="bg-white/10 text-white placeholder:text-white/50"
            />
          </div>

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

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-white">Description</Label>
            <Textarea
              id="description"
              placeholder="e.g., Groceries from Walmart"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="bg-white/10 text-white placeholder:text-white/50"
            />
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-lg text-white">
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
              className="text-3xl font-bold text-white bg-transparent border-2 border-white/50 focus:border-yellow-400 transition-colors placeholder:text-white/50"
            />
          </div>

          {/* Paid by / Received by */}
          <div className="space-y-2">
            <Label htmlFor="paid-by" className="text-white">
              {transactionType === "income" ||
              transactionType === "reimbursement"
                ? "Received by"
                : "Paid by"}
            </Label>
            <Select
              value={paidOrReceivedBy}
              onValueChange={setPaidOrReceivedBy}
            >
              <SelectTrigger id="paid-by" className="bg-white/10 text-white">
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
                <Label htmlFor="category" className="text-white">Category</Label>
                <Select
                  value={selectedCategoryId}
                  onValueChange={setSelectedCategoryId}
                >
                  <SelectTrigger id="category" className="bg-white/10 text-white">
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
                <Label htmlFor="split-type" className="text-white">Split Type</Label>
                <Select value={splitType} onValueChange={setSplitType}>
                  <SelectTrigger id="split-type" className="bg-white/10 text-white">
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
              <Label htmlFor="paid-to" className="text-white">Paid to</Label>
              <Select value={paidToUserName} onValueChange={setPaidToUserName}>
                <SelectTrigger id="paid-to" className="bg-white/10 text-white">
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

          <div className="flex gap-4 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-yellow-400 text-teal-900 hover:bg-yellow-500"
            >
              {isEditing ? "Update Template" : "Create Template"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TransactionTemplateForm;

