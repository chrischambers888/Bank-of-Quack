import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Building2,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  DollarSign,
  Plus,
} from "lucide-react";
import {
  YearlySectorBudgetSummary,
  Sector,
  Transaction,
  Category,
} from "@/types";
import { supabase } from "@/supabaseClient";
import { useBudgetSettings } from "@/hooks/useBudgetSettings";
import TransactionList from "@/components/TransactionList";
import { YearlyCategoryBudgetCard } from "./YearlyCategoryBudgetCard";

interface YearlySectorBudgetCardProps {
  sectorBudgetSummary: YearlySectorBudgetSummary;
  onEdit: (sectorBudgetSummary: YearlySectorBudgetSummary) => void;
  onDelete: (sectorId: string) => void;
  selectedYear: number;
  selectedMonthForProgress: number;
  user1AvatarUrl?: string | null;
  user2AvatarUrl?: string | null;
  budgetSummaries?: any[];
  sectors?: Sector[];
  isExpanded?: boolean;
  onToggleExpansion?: () => void;
  categories?: Category[];
  onEditBudget?: (budget: any) => void;
  onDeleteBudget?: (categoryId: string) => void;
  userNames?: { user1: string; user2: string };
  getMonthName?: (month: number) => string;
  formatCurrency?: (amount: number | null | undefined) => string;
  // New props for transaction functionality
  allTransactions?: Transaction[];
  deleteTransaction?: (id: string) => Promise<void>;
  handleSetEditingTransaction?: (transaction: any) => void;
  onToggleExclude?: (transactionId: string, excluded: boolean) => Promise<void>;
  incomeImageUrl?: string | null;
  settlementImageUrl?: string | null;
  reimbursementImageUrl?: string | null;
  // Hide "?" button when rendered inside a modal
  hideTransactionsButton?: boolean;
}

export function YearlySectorBudgetCard({
  sectorBudgetSummary,
  onEdit,
  onDelete,
  selectedYear,
  selectedMonthForProgress,
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
  hideTransactionsButton = false,
}: YearlySectorBudgetCardProps) {
  const [showTransactions, setShowTransactions] = useState(false);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [sectorTransactions, setSectorTransactions] = useState<Transaction[]>(
    []
  );
  const [userNames, setUserNames] = useState({
    user1: "User 1",
    user2: "User 2",
  });

  const {
    sector_id: sectorId,
    sector_name,
    current_period_spent,
    current_period_budget,
    current_period_user1_spent,
    current_period_user2_spent,
    budget_type,
    user1_amount,
    user2_amount,
    auto_rollup,
  } = sectorBudgetSummary;

  const sector_id = sectorId as string;

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

  const loadSectorTransactions = async () => {
    setIsLoadingTransactions(true);
    try {
      // Filter transactions for this sector and selected year, excluding excluded transactions
      const filtered = allTransactions.filter((transaction) => {
        // Exclude transactions that are marked as excluded from monthly budget
        if (transaction.excluded_from_monthly_budget) {
          return false;
        }

        // Find the sector that this transaction's category belongs to
        const transactionSector = sectors.find(
          (sector) =>
            transaction.category_id &&
            sector.category_ids.includes(transaction.category_id)
        );

        if (
          !transactionSector ||
          !sector_id ||
          transactionSector.id !== sector_id
        )
          return false;

        const transactionDate = new Date(transaction.date);
        const transactionYear = transactionDate.getFullYear();

        return transactionYear === selectedYear;
      });

      setSectorTransactions(filtered);
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

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return "$0.00";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const getMonthName = () => {
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
    return monthNames[selectedMonthForProgress - 1];
  };

  const getBudgetAmount = () => {
    if (budget_type === "absolute") {
      return current_period_budget || 0;
    }
    return (user1_amount || 0) + (user2_amount || 0);
  };

  const getActualPercentage = () => {
    const budget = getBudgetAmount();
    if (budget === 0) return 0;
    return ((current_period_spent || 0) / budget) * 100;
  };

  const getProgressPercentage = () => {
    const budget = getBudgetAmount();
    if (budget === 0) return 0;
    return Math.min((current_period_spent || 0) / budget, 1) * 100;
  };

  const getProgressColor = () => {
    const percentage = getActualPercentage();
    if (percentage >= 100) return "text-red-500";
    if (percentage >= yellowThreshold) return "text-yellow-500";
    return "text-green-500";
  };

  const getRemainingAmount = () => {
    return getBudgetAmount() - (current_period_spent || 0);
  };

  const getRemainingColor = () => {
    return getRemainingAmount() >= 0 ? "text-green-600" : "text-red-600";
  };

  const isOverBudget = () => {
    return (current_period_spent || 0) > getBudgetAmount();
  };

  const isOverCategoryBudgets = () => {
    const categoryBudgetsTotal = calculateCategoryBudgetsTotal();
    return (current_period_spent || 0) > categoryBudgetsTotal;
  };

  const calculateCategoryBudgetsTotal = () => {
    return budgetSummaries
      .filter((budget) => {
        const sector = sectors.find((s) => s.id === sector_id);
        return sector?.category_ids.includes(budget.category_id);
      })
      .reduce((total, budget) => {
        if (budget.budget_type === "absolute") {
          return total + (budget.absolute_amount || 0);
        }
        return total + (budget.user1_amount || 0) + (budget.user2_amount || 0);
      }, 0);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">
            {sector_name}
          </CardTitle>
          <div className="flex items-center space-x-2">
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
              onClick={() => {
                if (sector_id) {
                  onDelete(sector_id);
                }
              }}
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
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {selectedYear} (through {getMonthName()}):
            </span>
            <span className="font-medium">
              {formatCurrency(current_period_spent || 0)} /{" "}
              {formatCurrency(current_period_budget || 0)}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all duration-300 ${
                (current_period_spent || 0) > (current_period_budget || 0)
                  ? "bg-red-500"
                  : (current_period_spent || 0) >=
                    (current_period_budget || 0) * 0.8
                  ? "bg-yellow-500"
                  : "bg-green-500"
              }`}
              style={{
                width: `${Math.min(
                  ((current_period_spent || 0) / (current_period_budget || 1)) *
                    100,
                  100
                )}%`,
              }}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {(
                ((current_period_spent || 0) / (current_period_budget || 1)) *
                100
              ).toFixed(1)}
              % used
            </span>
            <span
              className={
                (current_period_budget || 0) - (current_period_spent || 0) >= 0
                  ? "text-green-600"
                  : "text-red-600"
              }
            >
              {formatCurrency(
                Math.abs(
                  (current_period_budget || 0) - (current_period_spent || 0)
                )
              )}{" "}
              {(current_period_budget || 0) - (current_period_spent || 0) >= 0
                ? "under"
                : "over"}
            </span>
          </div>
        </div>

        {/* Expandable Category Budgets */}
        {isExpanded && (
          <div className="space-y-3 pt-4 border-t border-muted">
            {/* Categories with existing budgets */}
            {budgetSummaries
              .filter((budget) => {
                // Check if this category belongs to the current sector
                return (
                  sectors.find((s) => s.id === sector_id)?.category_ids &&
                  sectors
                    .find((s) => s.id === sector_id)
                    ?.category_ids.includes(budget.category_id)
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
                  <YearlyCategoryBudgetCard
                    key={budget.category_id}
                    budgetSummary={budget}
                    onEdit={onEditBudget || (() => {})}
                    onDelete={onDeleteBudget || (() => {})}
                    selectedYear={selectedYear}
                    selectedMonthForProgress={selectedMonthForProgress}
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
                    categories={categories}
                  />
                );
              })}

            {/* Categories without budgets */}
            {(() => {
              // Get all categories that belong to this sector
              const sectorCategories = categories.filter((cat) =>
                sectors
                  .find((s) => s.id === sector_id)
                  ?.category_ids.includes(cat.id)
              );

              // Get categories that have yearly budgets
              const categoriesWithBudgets = budgetSummaries
                .filter((budget) =>
                  sectors
                    .find((s) => s.id === sector_id)
                    ?.category_ids.includes(budget.category_id)
                )
                .map((budget) => budget.category_id);

              // Find categories without yearly budgets
              const categoriesWithoutBudgets = sectorCategories.filter(
                (cat) => !categoriesWithBudgets.includes(cat.id)
              );

              if (categoriesWithoutBudgets.length === 0) return null;

              return (
                <div className="space-y-2 pt-3 border-t border-muted/30">
                  <div className="text-xs text-muted-foreground font-medium">
                    Categories without yearly budgets:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {categoriesWithoutBudgets.map((category) => (
                      <Button
                        key={category.id}
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          onEditBudget?.({ category_id: category.id } as any)
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
              {sector_name} - {selectedYear} Transactions
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
