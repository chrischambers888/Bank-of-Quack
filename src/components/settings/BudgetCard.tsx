import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BudgetSummary, CategoryBudget, Transaction } from "@/types";
import { Edit, Trash2, Receipt } from "lucide-react";
import { supabase } from "@/supabaseClient";

interface BudgetCardProps {
  budgetSummary: BudgetSummary;
  onEdit: (budget: CategoryBudget) => void;
  onDelete: (budgetId: string) => void;
  onToggleActive?: (budgetId: string, isActive: boolean) => void;
}

export function BudgetCard({
  budgetSummary,
  onEdit,
  onDelete,
  onToggleActive,
}: BudgetCardProps) {
  const [userNames, setUserNames] = useState({
    user1: "User 1",
    user2: "User 2",
  });
  const [showTransactions, setShowTransactions] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);

  useEffect(() => {
    // Load user names from app settings
    const loadUserNames = async () => {
      const { data: user1Data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "user1_name")
        .single();

      const { data: user2Data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "user2_name")
        .single();

      setUserNames({
        user1: user1Data?.value || "User 1",
        user2: user2Data?.value || "User 2",
      });
    };

    loadUserNames();
  }, []);

  const {
    category_name,
    category_image,
    budget_type,
    absolute_amount,
    user1_amount,
    user2_amount,
    current_period_budget,
    current_period_spent,
    current_period_user1_spent,
    current_period_user2_spent,
    current_period_remaining_percentage,
    current_period_remaining_amount,
  } = budgetSummary;

  const hasBudget =
    budget_type && (absolute_amount || (user1_amount && user2_amount));
  const totalBudget =
    budget_type === "absolute"
      ? absolute_amount
      : (user1_amount || 0) + (user2_amount || 0);
  const spentPercentage =
    totalBudget && current_period_spent
      ? Math.min((current_period_spent / totalBudget) * 100, 100)
      : 0;

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return "bg-red-500";
    if (percentage >= 75) return "bg-yellow-500";
    return "bg-green-500";
  };

  const formatCurrency = (amount: number | undefined) => {
    return amount !== undefined ? `$${amount.toFixed(2)}` : "$0.00";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const loadTransactions = async () => {
    setIsLoadingTransactions(true);
    try {
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;

      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("category_id", budgetSummary.category_id)
        .eq("transaction_type", "expense")
        .gte(
          "date",
          `${currentYear}-${currentMonth.toString().padStart(2, "0")}-01`
        )
        .lt(
          "date",
          `${currentYear}-${(currentMonth + 1).toString().padStart(2, "0")}-01`
        )
        .order("date", { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error("Error loading transactions:", error);
    } finally {
      setIsLoadingTransactions(false);
    }
  };

  const handleViewTransactions = () => {
    setShowTransactions(true);
    loadTransactions();
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {category_image && (
              <img
                src={category_image}
                alt={category_name}
                className="w-8 h-8 rounded-full object-cover"
              />
            )}
            <div>
              <CardTitle className="text-lg">{category_name}</CardTitle>
              <CardDescription>
                {budget_type === "absolute"
                  ? "Absolute Budget"
                  : "Split Budget"}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleViewTransactions}
              title="View transactions"
            >
              <Receipt className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                onEdit({
                  id: budgetSummary.budget_id!,
                  category_id: budgetSummary.category_id,
                  budget_type: budget_type!,
                  absolute_amount,
                  user1_amount,
                  user2_amount,
                })
              }
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(budgetSummary.budget_id!)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Budget Configuration */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Monthly Budget:</span>
            <span className="font-medium">{formatCurrency(totalBudget)}</span>
          </div>

          {budget_type === "split" && (
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>{userNames.user1}:</span>
                <span>{formatCurrency(user1_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span>{userNames.user2}:</span>
                <span>{formatCurrency(user2_amount)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Current Period Progress */}
        {hasBudget && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">This Month:</span>
              <span className="font-medium">
                {formatCurrency(current_period_spent)} /{" "}
                {formatCurrency(totalBudget)}
              </span>
            </div>

            <Progress value={spentPercentage} className="h-2" />

            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">
                {totalBudget && current_period_spent !== undefined
                  ? `${(100 - spentPercentage).toFixed(1)}% remaining`
                  : "No spending data"}
              </span>
              <span
                className={getProgressColor(spentPercentage).replace(
                  "bg-",
                  "text-"
                )}
              >
                {formatCurrency(
                  totalBudget ? totalBudget - (current_period_spent || 0) : 0
                )}
              </span>
            </div>

            {/* User Spending Breakdown */}
            {budget_type === "split" && (
              <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                <div className="flex justify-between">
                  <span>{userNames.user1} spent:</span>
                  <span>{formatCurrency(current_period_user1_spent)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{userNames.user2} spent:</span>
                  <span>{formatCurrency(current_period_user2_spent)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Transactions Dialog */}
      <Dialog open={showTransactions} onOpenChange={setShowTransactions}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden bg-gradient-to-b from-[#004D40] to-[#26A69A] text-gray-200 border-gray-600">
          <DialogHeader>
            <DialogTitle className="text-gray-200">
              {category_name} - This Month's Transactions
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-black/20 rounded-lg border border-gray-600">
              <div>
                <p className="text-sm text-gray-300">Total Spent</p>
                <p className="text-lg font-semibold text-gray-200">
                  {formatCurrency(current_period_spent)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-300">Budget</p>
                <p className="text-lg font-semibold text-gray-200">
                  {formatCurrency(totalBudget)}
                </p>
              </div>
            </div>

            {/* Transactions List */}
            <div className="max-h-[400px] overflow-y-auto">
              {isLoadingTransactions ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-400"></div>
                  <span className="ml-2 text-gray-200">
                    Loading transactions...
                  </span>
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-8 text-gray-300">
                  <Receipt className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No transactions this month</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {transactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-3 bg-black/20 border border-gray-600 rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-gray-200">
                          {transaction.description}
                        </p>
                        <p className="text-sm text-gray-300">
                          {formatDate(transaction.date)}
                          {transaction.split_type && (
                            <span className="ml-2 text-xs bg-black/30 px-2 py-1 rounded text-gray-200">
                              {transaction.split_type === "user1_only"
                                ? `${userNames.user1} only`
                                : transaction.split_type === "user2_only"
                                ? `${userNames.user2} only`
                                : transaction.split_type === "splitEqually"
                                ? "Split equally"
                                : transaction.split_type}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-red-400">
                          -{formatCurrency(transaction.amount)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
