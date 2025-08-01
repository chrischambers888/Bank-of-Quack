import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

import { CustomProgress } from "@/components/ui/custom-progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Edit,
  Trash2,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  ChevronDown,
  ChevronRight,
  Plus,
  HelpCircle,
} from "lucide-react";
import { BudgetSummary, SelectedMonth, Transaction, Category } from "@/types";
import { supabase } from "@/supabaseClient";
import { useBudgetSettings } from "@/hooks/useBudgetSettings";
import TransactionList from "@/components/TransactionList";

interface CategoryBudgetCardProps {
  budgetSummary: BudgetSummary;
  onEdit: (budgetSummary: BudgetSummary) => void;
  onDelete: (categoryId: string) => void;
  selectedMonth: SelectedMonth;
  user1AvatarUrl?: string | null;
  user2AvatarUrl?: string | null;
  category?: Category;
  userNames?: { user1: string; user2: string };
  getMonthName?: (month: SelectedMonth) => string;
  formatCurrency?: (amount: number | null | undefined) => string;
  // New props for transaction functionality
  allTransactions?: Transaction[];
  deleteTransaction?: (id: string) => Promise<void>;
  handleSetEditingTransaction?: (transaction: any) => void;
  onToggleExclude?: (
    transactionId: string,
    excluded: boolean,
    exclusionType: "monthly" | "yearly"
  ) => Promise<void>;
  incomeImageUrl?: string | null;
  settlementImageUrl?: string | null;
  reimbursementImageUrl?: string | null;
  hideTransactionsButton?: boolean;
  categories?: Category[];
}

export function CategoryBudgetCard({
  budgetSummary,
  onEdit,
  onDelete,
  selectedMonth,
  user1AvatarUrl,
  user2AvatarUrl,
  category,
  userNames: propUserNames,
  getMonthName: propGetMonthName,
  formatCurrency: propFormatCurrency,
  allTransactions = [],
  deleteTransaction,
  handleSetEditingTransaction,
  onToggleExclude,
  incomeImageUrl,
  settlementImageUrl,
  reimbursementImageUrl,
  hideTransactionsButton = false,
  categories = [],
}: CategoryBudgetCardProps) {
  const [showTransactions, setShowTransactions] = useState(false);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [filteredTransactions, setFilteredTransactions] = useState<
    Transaction[]
  >([]);
  const [userNames, setUserNames] = useState({
    user1: "User 1",
    user2: "User 2",
  });

  const {
    current_period_spent,
    current_period_budget,
    current_period_user1_spent,
    current_period_user2_spent,
    budget_type,
    user1_amount,
    user2_amount,
    category_id,
  } = budgetSummary;

  const { yellowThreshold } = useBudgetSettings();

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

  const finalUserNames = propUserNames || userNames;
  const finalGetMonthName =
    propGetMonthName ||
    ((month: SelectedMonth) => {
      const date = new Date(month.year, month.month - 1, 1);
      return date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
    });
  const finalFormatCurrency =
    propFormatCurrency ||
    ((amount: number | null | undefined) => {
      if (amount === null || amount === undefined) return "$0.00";
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(amount);
    });

  const getProgressPercentage = () => {
    if (!current_period_budget || current_period_budget === 0) return 0;
    return (
      Math.min((current_period_spent || 0) / current_period_budget, 1) * 100
    );
  };

  const getActualPercentage = () => {
    if (!current_period_budget || current_period_budget === 0) return 0;
    return ((current_period_spent || 0) / current_period_budget) * 100;
  };

  const getProgressColor = () => {
    const percentage = getActualPercentage();
    if (percentage >= 100) return "text-red-500";
    if (percentage >= yellowThreshold) return "text-yellow-500";
    return "text-green-500";
  };

  const loadTransactions = async () => {
    setIsLoadingTransactions(true);
    try {
      // Filter transactions for this category and selected month
      const filtered = allTransactions.filter((transaction) => {
        if (transaction.category_id !== category_id) return false;

        const transactionDate = new Date(transaction.date);
        const transactionMonth = transactionDate.getMonth() + 1;
        const transactionYear = transactionDate.getFullYear();

        return (
          transactionMonth === selectedMonth.month &&
          transactionYear === selectedMonth.year
        );
      });

      setFilteredTransactions(filtered);
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

  const totalBudget =
    budget_type === "absolute"
      ? (user1_amount || 0) + (user2_amount || 0)
      : (user1_amount || 0) + (user2_amount || 0);

  return (
    <div className="ml-4 border-l-4 border-primary/30 bg-card/50 rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          {category?.image_url ? (
            <img
              src={category.image_url}
              alt={category.name}
              className="w-6 h-6 rounded-full object-cover"
            />
          ) : (
            <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center">
              <DollarSign className="h-3 w-3 text-muted-foreground" />
            </div>
          )}
          <div>
            <h4 className="font-medium text-sm">{category?.name}</h4>
            <p className="text-xs text-muted-foreground">
              {budget_type === "absolute" ? "Absolute" : "Split"} Budget
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {!hideTransactionsButton && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleViewTransactions}
              className="h-6 w-6"
              title="View transactions for this category"
            >
              <HelpCircle className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(budgetSummary)}
            className="h-6 w-6"
          >
            <Edit className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(category_id)}
            className="h-6 w-6"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2 mb-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {finalGetMonthName(selectedMonth)}:
          </span>
          <span className="font-medium">
            {finalFormatCurrency(current_period_spent)} /{" "}
            {finalFormatCurrency(current_period_budget)}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              getActualPercentage() > 100
                ? "bg-red-500"
                : getActualPercentage() >= yellowThreshold
                ? "bg-yellow-500"
                : "bg-green-500"
            }`}
            style={{
              width: `${Math.min(getActualPercentage(), 100)}%`,
            }}
          />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {getActualPercentage().toFixed(1)}% used
          </span>
          <span
            className={
              current_period_budget - (current_period_spent || 0) >= 0
                ? "text-green-600"
                : "text-red-600"
            }
          >
            {finalFormatCurrency(
              Math.abs(current_period_budget - (current_period_spent || 0))
            )}{" "}
            {current_period_budget - (current_period_spent || 0) >= 0
              ? "under"
              : "over"}
          </span>
        </div>
      </div>

      {/* Transactions Dialog */}
      <Dialog open={showTransactions} onOpenChange={setShowTransactions}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden bg-gradient-to-b from-[#004D40] to-[#26A69A] text-gray-200 border-gray-600">
          <DialogHeader>
            <DialogTitle className="text-gray-200">
              {category?.name} - {finalGetMonthName(selectedMonth)} Transactions
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {isLoadingTransactions ? (
              <div className="text-center py-8">
                <div className="text-white/80">Loading transactions...</div>
              </div>
            ) : (
              <>
                {/* User Spending Breakdown - Show above transactions */}
                {((current_period_user1_spent || 0) > 0 ||
                  (current_period_user2_spent || 0) > 0) && (
                  <div className="text-xs text-muted-foreground space-y-1 pt-2">
                    <div className="flex justify-between items-center">
                      <span>
                        {finalUserNames.user1}:{" "}
                        {finalFormatCurrency(current_period_user1_spent)}
                        {budget_type === "split" &&
                          ` / ${finalFormatCurrency(user1_amount)}`}
                      </span>
                      <span>
                        {finalUserNames.user2}:{" "}
                        {finalFormatCurrency(current_period_user2_spent)}
                        {budget_type === "split" &&
                          ` / ${finalFormatCurrency(user2_amount)}`}
                      </span>
                    </div>
                    <div className="relative h-4 bg-gray-600 rounded-full overflow-hidden">
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
                            budget_type === "split"
                              ? // For split budgets, use color coding based on budget adherence
                                (current_period_budget === 0 &&
                                  (current_period_user1_spent || 0) > 0) ||
                                (current_period_user1_spent || 0) >=
                                  (user1_amount || 0)
                                ? "rgb(239 68 68)"
                                : (current_period_user1_spent || 0) >=
                                  ((user1_amount || 0) * yellowThreshold) / 100
                                ? "rgb(234 179 8)"
                                : "rgb(34 197 94)"
                              : // For absolute budgets, use neutral gray
                                "rgb(156 163 175)",
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
                            budget_type === "split"
                              ? // For split budgets, use color coding based on budget adherence
                                (current_period_budget === 0 &&
                                  (current_period_user2_spent || 0) > 0) ||
                                (current_period_user2_spent || 0) >=
                                  (user2_amount || 0)
                                ? "rgb(239 68 68)"
                                : (current_period_user2_spent || 0) >=
                                  ((user2_amount || 0) * yellowThreshold) / 100
                                ? "rgb(234 179 8)"
                                : "rgb(34 197 94)"
                              : // For absolute budgets, use neutral gray
                                "rgb(156 163 175)",
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
                              alt={`${finalUserNames.user1} avatar`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xs text-white font-bold">
                              {finalUserNames.user1.charAt(0).toUpperCase()}
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
                              alt={`${finalUserNames.user2} avatar`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xs text-white font-bold">
                              {finalUserNames.user2.charAt(0).toUpperCase()}
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

                {/* Scrollable Transactions List */}
                <div className="overflow-y-auto max-h-[60vh]">
                  <TransactionList
                    transactions={filteredTransactions}
                    allTransactions={allTransactions}
                    deleteTransaction={deleteTransaction}
                    handleSetEditingTransaction={handleSetEditingTransaction}
                    onToggleExclude={onToggleExclude}
                    incomeImageUrl={incomeImageUrl}
                    settlementImageUrl={settlementImageUrl}
                    reimbursementImageUrl={reimbursementImageUrl}
                    userNames={[finalUserNames.user1, finalUserNames.user2]}
                    categories={categories}
                    variant="dialog"
                    showExcludeOption={true}
                  />
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
