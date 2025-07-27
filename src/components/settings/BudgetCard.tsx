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
import { CustomProgress } from "@/components/ui/custom-progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BudgetSummary,
  CategoryBudget,
  Transaction,
  SelectedMonth,
} from "@/types";
import { Edit, Trash2, Receipt } from "lucide-react";
import { supabase } from "@/supabaseClient";
import { useBudgetSettings } from "@/hooks/useBudgetSettings";

interface BudgetCardProps {
  budgetSummary: BudgetSummary;
  onEdit: (budget: CategoryBudget) => void;
  onDelete: (budgetId: string) => void;
  onToggleActive?: (budgetId: string, isActive: boolean) => void;
  user1AvatarUrl?: string | null;
  user2AvatarUrl?: string | null;
  selectedMonth?: SelectedMonth;
}

export function BudgetCard({
  budgetSummary,
  onEdit,
  onDelete,
  onToggleActive,
  user1AvatarUrl,
  user2AvatarUrl,
  selectedMonth,
}: BudgetCardProps) {
  const [userNames, setUserNames] = useState({
    user1: "User 1",
    user2: "User 2",
  });
  const [showTransactions, setShowTransactions] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const { yellowThreshold, redThreshold } = useBudgetSettings();

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

  // Safety check to prevent rendering with null budgetSummary
  if (!budgetSummary) {
    return null;
  }

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
      ? absolute_amount || 0
      : (user1_amount || 0) + (user2_amount || 0);
  const spentPercentage =
    totalBudget && current_period_spent
      ? Math.min((current_period_spent / totalBudget) * 100, 100)
      : 0;

  const getProgressColor = (percentage: number) => {
    if (percentage >= redThreshold) return "bg-red-500";
    if (percentage >= yellowThreshold) return "bg-yellow-500";
    return "bg-green-500";
  };

  const formatCurrency = (amount: number | null | undefined) => {
    return amount != null ? `$${amount.toFixed(2)}` : "$0.00";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const loadTransactions = async () => {
    setIsLoadingTransactions(true);
    try {
      // Use selected month if provided, otherwise use current month
      const targetYear = selectedMonth?.year || new Date().getFullYear();
      const targetMonth = selectedMonth?.month || new Date().getMonth() + 1;

      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("category_id", budgetSummary.category_id)
        .eq("transaction_type", "expense")
        .gte(
          "date",
          `${targetYear}-${targetMonth.toString().padStart(2, "0")}-01`
        )
        .lt(
          "date",
          `${targetYear}-${(targetMonth + 1).toString().padStart(2, "0")}-01`
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

  // Get month name for display
  const getMonthName = () => {
    if (!selectedMonth) {
      return new Date().toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
    }
    const date = new Date(selectedMonth.year, selectedMonth.month - 1, 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
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
                  year: selectedMonth?.year || new Date().getFullYear(),
                  month: selectedMonth?.month || new Date().getMonth() + 1,
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
              onClick={() => onDelete(budgetSummary.category_id)}
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
        </div>

        {/* Current Period Progress */}
        {hasBudget && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{getMonthName()}:</span>
              <span className="font-medium">
                {formatCurrency(current_period_spent)} /{" "}
                {formatCurrency(totalBudget)}
              </span>
            </div>

            <CustomProgress
              value={spentPercentage}
              className="h-4"
              backgroundColor={
                spentPercentage >= redThreshold ? "rgb(239 68 68)" : undefined
              }
              indicatorColor={
                spentPercentage >= redThreshold
                  ? "rgb(239 68 68)"
                  : spentPercentage >= yellowThreshold
                  ? "rgb(234 179 8)"
                  : "rgb(34 197 94)"
              }
            />

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
            {(budget_type === "split" || budget_type === "absolute") && (
              <div className="text-xs text-muted-foreground space-y-1 pt-2">
                <div className="flex justify-between items-center">
                  <span>
                    {userNames.user1}:{" "}
                    {formatCurrency(current_period_user1_spent)}
                    {budget_type === "split" &&
                      ` / ${formatCurrency(user1_amount)}`}
                  </span>
                  <span>
                    {userNames.user2}:{" "}
                    {formatCurrency(current_period_user2_spent)}
                    {budget_type === "split" &&
                      ` / ${formatCurrency(user2_amount)}`}
                  </span>
                </div>
                <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
                  {/* User 1 Progress */}
                  <div
                    className="absolute left-0 h-full transition-all duration-300"
                    style={{
                      width: `${
                        ((current_period_user1_spent || 0) /
                          Math.max(
                            (current_period_user1_spent || 0) +
                              (current_period_user2_spent || 0),
                            1
                          )) *
                        100
                      }%`,
                      backgroundColor:
                        budget_type === "split" &&
                        (current_period_user1_spent || 0) >= (user1_amount || 0)
                          ? "rgb(239 68 68)"
                          : budget_type === "split" &&
                            (current_period_user1_spent || 0) >=
                              ((user1_amount || 0) * yellowThreshold) / 100
                          ? "rgb(234 179 8)"
                          : "rgb(34 197 94)",
                    }}
                  />
                  {/* User 2 Progress */}
                  <div
                    className="absolute right-0 h-full transition-all duration-300"
                    style={{
                      width: `${
                        ((current_period_user2_spent || 0) /
                          Math.max(
                            (current_period_user1_spent || 0) +
                              (current_period_user2_spent || 0),
                            1
                          )) *
                        100
                      }%`,
                      backgroundColor:
                        budget_type === "split" &&
                        (current_period_user2_spent || 0) >= (user2_amount || 0)
                          ? "rgb(239 68 68)"
                          : budget_type === "split" &&
                            (current_period_user2_spent || 0) >=
                              ((user2_amount || 0) * yellowThreshold) / 100
                          ? "rgb(234 179 8)"
                          : "rgb(34 197 94)",
                    }}
                  />
                  {/* User 1 Avatar */}
                  <div
                    className="absolute top-1/2 flex items-center justify-center"
                    style={{
                      left: `calc(${
                        ((current_period_user1_spent || 0) /
                          Math.max(
                            (current_period_user1_spent || 0) +
                              (current_period_user2_spent || 0),
                            1
                          )) *
                        100
                      }% / 2)`,
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    <div className="w-4 h-4 rounded-full flex items-center justify-center overflow-hidden border border-white/20">
                      {user1AvatarUrl ? (
                        <img
                          src={user1AvatarUrl}
                          alt={`${userNames.user1} avatar`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs text-white font-bold">
                          {userNames.user1.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* User 2 Avatar */}
                  <div
                    className="absolute top-1/2 flex items-center justify-center"
                    style={{
                      left: `calc(${
                        ((current_period_user1_spent || 0) /
                          Math.max(
                            (current_period_user1_spent || 0) +
                              (current_period_user2_spent || 0),
                            1
                          )) *
                        100
                      }% + (${
                        ((current_period_user2_spent || 0) /
                          Math.max(
                            (current_period_user1_spent || 0) +
                              (current_period_user2_spent || 0),
                            1
                          )) *
                        100
                      }% / 2))`,
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    <div className="w-4 h-4 rounded-full flex items-center justify-center overflow-hidden border border-white/20">
                      {user2AvatarUrl ? (
                        <img
                          src={user2AvatarUrl}
                          alt={`${userNames.user2} avatar`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs text-white font-bold">
                          {userNames.user2.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Dividing Line */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white opacity-80"
                    style={{
                      left: `${
                        ((current_period_user1_spent || 0) /
                          Math.max(
                            (current_period_user1_spent || 0) +
                              (current_period_user2_spent || 0),
                            1
                          )) *
                        100
                      }%`,
                    }}
                  />
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
              {category_name} - {getMonthName()} Transactions
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
                  <p>No transactions in {getMonthName()}</p>
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
