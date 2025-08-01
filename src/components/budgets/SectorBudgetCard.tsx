import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  SectorBudgetSummary,
  SelectedMonth,
  BudgetSummary,
  Transaction,
  Sector,
  Category,
} from "@/types";
import { useBudgetSettings } from "@/hooks/useBudgetSettings";
import { supabase } from "@/supabaseClient";
import TransactionList from "@/components/TransactionList";
import { CategoryBudgetCard } from "./CategoryBudgetCard";

interface SectorBudgetCardProps {
  sectorBudgetSummary: SectorBudgetSummary;
  onEdit: (sectorBudgetSummary: SectorBudgetSummary) => void;
  onDelete: (sectorId: string) => void;
  selectedMonth: SelectedMonth;
  user1AvatarUrl?: string | null;
  user2AvatarUrl?: string | null;
  budgetSummaries?: BudgetSummary[];
  sectors?: Sector[];
  isExpanded?: boolean;
  onToggleExpansion?: () => void;
  categories?: Category[];
  onEditBudget?: (budget: BudgetSummary) => void;
  onDeleteBudget?: (categoryId: string) => void;
  userNames?: { user1: string; user2: string };
  getMonthName?: (month: SelectedMonth) => string;
  formatCurrency?: (amount: number | null | undefined) => string;
  // New props for transaction functionality
  allTransactions?: Transaction[];
  deleteTransaction?: (id: string) => Promise<void>;
  handleSetEditingTransaction?: (transaction: Transaction) => void;
  onToggleExclude?: (transactionId: string, excluded: boolean) => Promise<void>;
  incomeImageUrl?: string | null;
  settlementImageUrl?: string | null;
  reimbursementImageUrl?: string | null;
  // Hide "?" button when rendered inside a modal
  hideTransactionsButton?: boolean;
}

export function SectorBudgetCard({
  sectorBudgetSummary,
  onEdit,
  onDelete,
  selectedMonth,
  user1AvatarUrl,
  user2AvatarUrl,
  budgetSummaries = [],
  sectors = [],
  isExpanded = false,
  onToggleExpansion,
  categories = [],
  onEditBudget,
  onDeleteBudget,
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
  hideTransactionsButton,
}: SectorBudgetCardProps) {
  const [userNames, setUserNames] = useState({
    user1: "User 1",
    user2: "User 2",
  });
  const [showTransactions, setShowTransactions] = useState(false);
  const [sectorTransactions, setSectorTransactions] = useState<Transaction[]>(
    []
  );
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
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

  // Function to load transactions for this sector
  const loadSectorTransactions = async () => {
    setIsLoadingTransactions(true);
    try {
      // Find the current sector
      const currentSector = sectors.find(
        (s) => s.id === sectorBudgetSummary.sector_id
      );
      if (!currentSector) {
        console.error("Sector not found:", sectorBudgetSummary.sector_id);
        return;
      }

      // Fetch transactions for all categories in the sector
      const { data: transactions } = await supabase
        .from("transactions")
        .select("*")
        .in("category_id", currentSector.category_ids)
        .gte(
          "date",
          `${selectedMonth.year}-${selectedMonth.month
            .toString()
            .padStart(2, "0")}-01`
        )
        .lt(
          "date",
          `${selectedMonth.year}-${(selectedMonth.month + 1)
            .toString()
            .padStart(2, "0")}-01`
        )
        .order("date", { ascending: false });

      // Find reimbursements that reimburse these transactions
      const relevantExpenseIds = (transactions || []).map((t) => t.id);
      const relevantReimbursements = allTransactions.filter(
        (t) =>
          t.transaction_type === "reimbursement" &&
          t.reimburses_transaction_id &&
          relevantExpenseIds.includes(t.reimburses_transaction_id)
      );

      const finalTransactions = [
        ...(transactions || []),
        ...relevantReimbursements,
      ];

      setSectorTransactions(finalTransactions);
    } catch (error) {
      console.error("Error loading sector transactions:", error);
    } finally {
      setIsLoadingTransactions(false);
    }
  };

  const handleViewTransactions = () => {
    setShowTransactions(true);
    loadSectorTransactions();
  };

  // Use prop values if provided, otherwise use local state
  const finalUserNames = propUserNames || userNames;

  // Define local functions first
  const formatCurrency = (amount: number | null | undefined) => {
    return amount != null ? `$${amount.toFixed(2)}` : "$0.00";
  };

  const getMonthName = () => {
    if (!selectedMonth) return "Current Month";
    const date = new Date(selectedMonth.year, selectedMonth.month - 1, 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  const finalGetMonthName = propGetMonthName || getMonthName;
  const finalFormatCurrency = propFormatCurrency || formatCurrency;

  const {
    sector_id,
    sector_name,
    budget_id,
    budget_type,
    absolute_amount,
    user1_amount,
    user2_amount,
    auto_rollup,
    current_period_budget,
    current_period_spent,
    current_period_user1_spent,
    current_period_user2_spent,
    current_period_remaining_percentage,
    current_period_remaining_amount,
    category_budgets_total,
  } = sectorBudgetSummary;

  const getBudgetAmount = () => {
    if (budget_type === "absolute") {
      return absolute_amount || 0;
    } else {
      return (user1_amount || 0) + (user2_amount || 0);
    }
  };

  const getActualPercentage = () => {
    if (!current_period_budget || current_period_budget === 0) {
      // For zero budgets, show 100% if there's any spending, 0% if no spending
      return (current_period_spent || 0) > 0 ? 100 : 0;
    }
    return ((current_period_spent || 0) / current_period_budget) * 100;
  };

  const getProgressPercentage = () => {
    if (!current_period_budget || current_period_budget === 0) {
      // For zero budgets, show 100% if there's any spending, 0% if no spending
      return (current_period_spent || 0) > 0 ? 100 : 0;
    }
    return (
      Math.min((current_period_spent || 0) / current_period_budget, 1) * 100
    );
  };

  const getProgressColor = () => {
    const percentage = getActualPercentage();
    // For zero budgets, any spending should be red
    if (current_period_budget === 0 && (current_period_spent || 0) > 0)
      return "bg-red-500";
    if (percentage > 100) return "bg-red-500";
    if (percentage >= yellowThreshold) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getRemainingAmount = () => {
    // For zero budgets, any spending is over budget
    if (current_period_budget === 0) {
      return -(current_period_spent || 0);
    }
    return current_period_remaining_amount || 0;
  };

  const getRemainingColor = () => {
    const remaining = getRemainingAmount();
    return remaining < 0 ? "text-red-600" : "text-green-600";
  };

  const isOverBudget = () => {
    return getRemainingAmount() < 0;
  };

  const isOverCategoryBudgets = () => {
    return category_budgets_total > getBudgetAmount();
  };

  // Calculate category budgets total client-side
  const calculateCategoryBudgetsTotal = () => {
    if (!budgetSummaries || budgetSummaries.length === 0) {
      return category_budgets_total || 0; // Fallback to database value if no client data
    }

    // Find the current sector
    const currentSector = sectors.find((s) => s.id === sector_id);
    if (!currentSector) {
      return category_budgets_total || 0; // Fallback if sector not found
    }

    // Filter budgets for categories that belong to this sector
    return budgetSummaries
      .filter((budget) => {
        // Check if this category belongs to the current sector
        return (
          currentSector.category_ids &&
          currentSector.category_ids.includes(budget.category_id)
        );
      })
      .reduce((total, budget) => {
        const budgetAmount = budget.current_period_budget || 0;
        return total + budgetAmount;
      }, 0);
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">
            {sector_name}
          </CardTitle>
          <div className="flex items-center space-x-2">
            {onToggleExpansion && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleExpansion}
                className="h-8 w-8"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            )}
            {!hideTransactionsButton && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleViewTransactions}
                className="h-8 w-8"
                title="View transactions for this sector"
              >
                <HelpCircle className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(sectorBudgetSummary)}
              className="h-8 w-8"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(sector_id)}
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
          {auto_rollup ? (
            <Badge
              variant="secondary"
              className="bg-green-500/20 text-green-600"
            >
              Auto Rollup
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-blue-500/20 text-blue-600">
              Manual
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Category Budgets Total - Only show for manual budgets */}
        {!auto_rollup && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Category Budgets
            </span>
            <div className="text-right">
              <div className="font-semibold">
                ${calculateCategoryBudgetsTotal().toFixed(2)}
              </div>
              {isOverCategoryBudgets() && (
                <div className="text-xs text-red-500">Over sector budget</div>
              )}
            </div>
          </div>
        )}

        {/* Progress Bar */}
        {current_period_budget !== undefined &&
          current_period_budget !== null && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {finalGetMonthName(selectedMonth)}:
                </span>
                <span className="font-medium">
                  {finalFormatCurrency(current_period_spent)} /{" "}
                  {finalFormatCurrency(current_period_budget)}
                </span>
              </div>
              <CustomProgress
                value={getProgressPercentage()}
                className="h-4"
                backgroundColor={
                  (current_period_budget === 0 &&
                    (current_period_spent || 0) > 0) ||
                  getActualPercentage() > 100
                    ? "rgb(239 68 68)"
                    : "rgb(75 85 99)" // Subtle dark gray that matches the theme
                }
                indicatorColor={
                  (current_period_budget === 0 &&
                    (current_period_spent || 0) > 0) ||
                  getActualPercentage() > 100
                    ? "rgb(239 68 68)"
                    : getActualPercentage() >= yellowThreshold
                    ? "rgb(234 179 8)"
                    : "rgb(34 197 94)"
                }
              />
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {current_period_budget && current_period_spent !== undefined
                    ? `${(100 - getProgressPercentage()).toFixed(1)}% remaining`
                    : current_period_spent && current_period_spent > 0
                    ? "100.0% used"
                    : "No spending data"}
                </span>
                <span className={getProgressColor().replace("bg-", "text-")}>
                  {(() => {
                    const remaining =
                      current_period_budget === 0
                        ? -(current_period_spent || 0) // Show negative amount for zero budgets
                        : current_period_budget
                        ? current_period_budget - (current_period_spent || 0)
                        : 0;
                    const isOver = remaining < 0;
                    return `${finalFormatCurrency(Math.abs(remaining))} ${
                      isOver ? "over" : "under"
                    }`;
                  })()}
                </span>
              </div>

              {/* User Spending Breakdown - Show in BudgetModal context */}
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
            </div>
          )}

        {/* Warning if no budget set */}
        {!budget_id && (
          <div className="text-center py-4">
            <div className="text-sm text-muted-foreground">
              No budget set for this sector
            </div>
          </div>
        )}

        {/* Expandable Category Budgets */}
        {isExpanded && onEditBudget && onDeleteBudget && categories && (
          <div className="space-y-3 pt-4 border-t border-muted">
            {/* Categories with existing budgets */}
            {budgetSummaries
              .filter((budget) => {
                // Find the current sector
                const currentSector = sectors.find((s) => s.id === sector_id);
                if (!currentSector) return false;

                // Check if this category belongs to the current sector
                return (
                  currentSector.category_ids &&
                  currentSector.category_ids.includes(budget.category_id)
                );
              })
              .map((budget) => {
                const category = categories.find(
                  (c) => c.id === budget.category_id
                );
                const totalBudget =
                  budget.budget_type === "absolute"
                    ? budget.absolute_amount || 0
                    : (budget.user1_amount || 0) + (budget.user2_amount || 0);
                const spent = budget.current_period_spent || 0;
                const remaining = totalBudget - spent;
                const percentageUsed =
                  totalBudget > 0 ? (spent / totalBudget) * 100 : 0;

                return (
                  <CategoryBudgetCard
                    key={budget.category_id}
                    budgetSummary={budget}
                    onEdit={onEditBudget}
                    onDelete={onDeleteBudget}
                    selectedMonth={selectedMonth}
                    user1AvatarUrl={user1AvatarUrl}
                    user2AvatarUrl={user2AvatarUrl}
                    category={category}
                    userNames={finalUserNames}
                    getMonthName={finalGetMonthName}
                    formatCurrency={finalFormatCurrency}
                    allTransactions={allTransactions}
                    deleteTransaction={deleteTransaction}
                    handleSetEditingTransaction={handleSetEditingTransaction}
                    onToggleExclude={onToggleExclude}
                    incomeImageUrl={incomeImageUrl}
                    settlementImageUrl={settlementImageUrl}
                    reimbursementImageUrl={reimbursementImageUrl}
                    hideTransactionsButton={hideTransactionsButton}
                    categories={categories}
                  />
                );
              })}

            {/* Categories without budgets */}
            {(() => {
              const currentSector = sectors.find((s) => s.id === sector_id);
              if (!currentSector) return null;

              // Get all categories that belong to this sector
              const sectorCategories = categories.filter((cat) =>
                currentSector.category_ids.includes(cat.id)
              );

              // Get categories that have budgets
              const categoriesWithBudgets = budgetSummaries
                .filter((budget) =>
                  currentSector.category_ids.includes(budget.category_id)
                )
                .map((budget) => budget.category_id);

              // Find categories without budgets
              const categoriesWithoutBudgets = sectorCategories.filter(
                (cat) => !categoriesWithBudgets.includes(cat.id)
              );

              if (categoriesWithoutBudgets.length === 0) return null;

              return (
                <div className="space-y-2 pt-3 border-t border-muted/30">
                  <div className="text-xs text-muted-foreground font-medium">
                    Categories without budgets:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {categoriesWithoutBudgets.map((category) => (
                      <Button
                        key={category.id}
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          onEditBudget({ category_id: category.id } as any)
                        }
                        className="h-7 px-3 text-xs"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        {category.name}
                      </Button>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </CardContent>

      {/* Transactions Dialog */}
      <Dialog open={showTransactions} onOpenChange={setShowTransactions}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden bg-gradient-to-b from-[#004D40] to-[#26A69A] text-gray-200 border-gray-600">
          <DialogHeader>
            <DialogTitle className="text-gray-200">
              {sector_name} - {finalGetMonthName(selectedMonth)} Transactions
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
                <div className="flex-1 overflow-y-auto max-h-[60vh]">
                  <TransactionList
                    transactions={sectorTransactions}
                    categories={categories}
                    userNames={[finalUserNames.user1, finalUserNames.user2]}
                    showValues={true}
                    deleteTransaction={
                      deleteTransaction || (() => Promise.resolve())
                    }
                    handleSetEditingTransaction={handleSetEditingTransaction}
                    allTransactions={allTransactions}
                    variant="dialog"
                    showExcludeOption={true}
                    onToggleExclude={onToggleExclude}
                    incomeImageUrl={incomeImageUrl}
                    settlementImageUrl={settlementImageUrl}
                    reimbursementImageUrl={reimbursementImageUrl}
                  />
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
