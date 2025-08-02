import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CustomProgress } from "@/components/ui/custom-progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  YearlyBudgetSummary,
  SelectedMonth,
  Transaction,
  Category,
} from "@/types";
import { supabase } from "@/supabaseClient";
import { useBudgetSettings } from "@/hooks/useBudgetSettings";
import TransactionList from "@/components/TransactionList";
import { calculateYearlyBudgetOnTrack } from "./budgetUtils";

interface YearlyCategoryBudgetCardProps {
  budgetSummary: YearlyBudgetSummary;
  onEdit: (budgetSummary: YearlyBudgetSummary) => void;
  onDelete: (categoryId: string) => void;
  selectedYear: number;
  selectedMonthForProgress: number;
  user1AvatarUrl?: string | null;
  user2AvatarUrl?: string | null;
  category?: Category;
  userNames?: { user1: string; user2: string };
  getMonthName?: (month: number) => string;
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
  exclusionType?: "monthly" | "yearly";
}

export function YearlyCategoryBudgetCard({
  budgetSummary,
  onEdit,
  onDelete,
  selectedYear,
  selectedMonthForProgress,
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
  exclusionType = "yearly",
}: YearlyCategoryBudgetCardProps) {
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
    ((month: number) => {
      const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      return monthNames[month - 1];
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
      // Filter transactions for this category and selected year (show all, including excluded)
      const filtered = allTransactions.filter((transaction) => {
        if (transaction.category_id !== category_id) return false;

        const transactionDate = new Date(transaction.date);
        const transactionYear = transactionDate.getFullYear();

        return transactionYear === selectedYear;
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
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-foreground">
              {category?.name}
            </CardTitle>
            <div className="flex items-center space-x-2">
              {!hideTransactionsButton && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleViewTransactions}
                  className="h-8 w-8"
                  title="View transactions for this category"
                >
                  <HelpCircle className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(budgetSummary)}
                className="h-8 w-8"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(category_id)}
                className="h-8 w-8"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary">
              {budget_type === "absolute" ? "Absolute" : "Split"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {selectedYear} (through{" "}
                {finalGetMonthName(selectedMonthForProgress)}):
              </span>
              <span className="font-medium">
                {finalFormatCurrency(current_period_spent)} /{" "}
                {finalFormatCurrency(current_period_budget)}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all duration-300 ${
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

          {/* User Spending Breakdown - Show in modal context */}
          {hideTransactionsButton &&
            ((current_period_user1_spent || 0) > 0 ||
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
        </CardContent>
      </Card>

      {/* Transactions Dialog */}
      <Dialog open={showTransactions} onOpenChange={setShowTransactions}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden bg-gradient-to-b from-[#004D40] to-[#26A69A] text-gray-200 border-gray-600">
          <DialogHeader>
            <DialogTitle className="text-gray-200">
              {category?.name} - {selectedYear} Transactions
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* On Track Information */}
            {(() => {
              const budgetAmount = current_period_budget || 0;
              const spent = current_period_spent || 0;
              const onTrackData = calculateYearlyBudgetOnTrack(
                budgetAmount,
                spent,
                selectedMonthForProgress
              );

              if (budgetAmount > 0) {
                return (
                  <div className="bg-white/10 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium">
                        On Track Status
                      </span>
                      <div className="flex items-center space-x-2">
                        <div
                          className={`w-4 h-4 rounded-full ${
                            onTrackData.isOnTrack
                              ? "bg-green-500"
                              : "bg-red-500"
                          }`}
                        />
                        <span
                          className={`text-sm font-medium ${
                            onTrackData.isOnTrack
                              ? "text-green-400"
                              : "text-red-400"
                          }`}
                        >
                          {onTrackData.isOnTrack ? "On Track" : "Behind"}
                        </span>
                      </div>
                    </div>

                    {/* On Track Calculation */}
                    <div className="space-y-3">
                      <div className="bg-white/5 rounded p-3 space-y-2">
                        <div className="text-xs text-muted-foreground">
                          On Track Calculation:
                        </div>
                        <div className="text-sm space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Daily Budget:
                            </span>
                            <span className="font-mono">
                              {finalFormatCurrency(budgetAmount / 365)}/day
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Days Elapsed:
                            </span>
                            <span className="font-mono">
                              {Math.floor(
                                (selectedMonthForProgress / 12) * 365
                              )}{" "}
                              days
                            </span>
                          </div>
                          <div className="flex justify-between border-t border-white/10 pt-1">
                            <span className="text-muted-foreground">
                              Implied Spend:
                            </span>
                            <span className="font-mono text-blue-400">
                              {finalFormatCurrency(
                                onTrackData.shouldBeSpentByNow
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Actually Spent:
                            </span>
                            <span className="font-mono">
                              {finalFormatCurrency(spent)}
                            </span>
                          </div>
                          <div className="flex justify-between border-t border-white/10 pt-1">
                            <span className="text-muted-foreground">
                              Difference:
                            </span>
                            <span
                              className={`font-mono ${
                                onTrackData.isOnTrack
                                  ? "text-green-400"
                                  : "text-red-400"
                              }`}
                            >
                              {finalFormatCurrency(
                                Math.abs(onTrackData.difference)
                              )}{" "}
                              {onTrackData.isOnTrack ? "under" : "over"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {isLoadingTransactions ? (
              <div className="text-center py-8">
                <div className="text-white/80">Loading transactions...</div>
              </div>
            ) : (
              <>
                {/* Scrollable Transactions List */}
                <div className="overflow-y-auto max-h-[60vh]">
                  <TransactionList
                    transactions={filteredTransactions}
                    allTransactions={allTransactions}
                    deleteTransaction={deleteTransaction}
                    handleSetEditingTransaction={handleSetEditingTransaction}
                    onToggleExclude={
                      onToggleExclude
                        ? (transactionId: string, excluded: boolean) =>
                            onToggleExclude(transactionId, excluded, "yearly")
                        : undefined
                    }
                    incomeImageUrl={incomeImageUrl}
                    settlementImageUrl={settlementImageUrl}
                    reimbursementImageUrl={reimbursementImageUrl}
                    userNames={[finalUserNames.user1, finalUserNames.user2]}
                    categories={categories}
                    variant="dialog"
                    showExcludeOption={true}
                    exclusionType={exclusionType}
                  />
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
