import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomProgress } from "@/components/ui/custom-progress";
import { Badge } from "@/components/ui/badge";
import {
  Edit,
  Trash2,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  ChevronDown,
  ChevronRight,
  Plus,
} from "lucide-react";
import { SectorBudgetSummary, SelectedMonth, BudgetSummary } from "@/types";
import { useBudgetSettings } from "@/hooks/useBudgetSettings";
import { supabase } from "@/supabaseClient";

interface SectorBudgetCardProps {
  sectorBudgetSummary: SectorBudgetSummary;
  onEdit: (sectorBudgetSummary: SectorBudgetSummary) => void;
  onDelete: (sectorId: string) => void;
  selectedMonth: SelectedMonth;
  user1AvatarUrl?: string | null;
  user2AvatarUrl?: string | null;
  budgetSummaries?: BudgetSummary[];
  sectors?: any[];
  isExpanded?: boolean;
  onToggleExpansion?: () => void;
  categories?: any[];
  onEditBudget?: (budget: BudgetSummary) => void;
  onDeleteBudget?: (categoryId: string) => void;
  userNames?: { user1: string; user2: string };
  getMonthName?: (month: SelectedMonth) => string;
  formatCurrency?: (amount: number | null | undefined) => string;
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
}: SectorBudgetCardProps) {
  const [userNames, setUserNames] = useState({
    user1: "User 1",
    user2: "User 2",
  });
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

              {/* User Spending Breakdown */}
              {(budget_type === "split" || budget_type === "absolute") && (
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
                  <div
                    key={budget.category_id}
                    className="ml-4 border-l-4 border-primary/30 bg-card/50 rounded-lg p-4 shadow-sm"
                  >
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
                          <h4 className="font-medium text-sm">
                            {category?.name}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {budget.budget_type === "absolute"
                              ? "Absolute"
                              : "Split"}{" "}
                            Budget
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            // Ensure budget has required fields before editing
                            if (!budget.budget_id) {
                              console.error("Budget ID is missing:", budget);
                              return;
                            }
                            onEditBudget(budget);
                          }}
                          className="h-6 w-6"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDeleteBudget(budget.category_id)}
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
                          {finalFormatCurrency(spent)} /{" "}
                          {finalFormatCurrency(totalBudget)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            percentageUsed > 100
                              ? "bg-red-500"
                              : percentageUsed >= 80
                              ? "bg-yellow-500"
                              : "bg-green-500"
                          }`}
                          style={{
                            width: `${Math.min(percentageUsed, 100)}%`,
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {percentageUsed.toFixed(1)}% used
                        </span>
                        <span
                          className={
                            remaining >= 0 ? "text-green-600" : "text-red-600"
                          }
                        >
                          {finalFormatCurrency(Math.abs(remaining))}{" "}
                          {remaining >= 0 ? "under" : "over"}
                        </span>
                      </div>
                    </div>

                    {/* Budget Details */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Budget</p>
                        <p className="font-medium">
                          {finalFormatCurrency(totalBudget)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Spent</p>
                        <p className="text-muted-foreground">
                          {finalFormatCurrency(spent)}
                        </p>
                      </div>
                    </div>

                    {/* User Spending for Split Budgets */}
                    {budget.budget_type === "split" && (
                      <div className="text-xs text-muted-foreground space-y-1 pt-2">
                        <div className="flex justify-between items-center">
                          <span>
                            {finalUserNames.user1}:{" "}
                            {finalFormatCurrency(
                              budget.current_period_user1_spent || 0
                            )}
                            {` / ${finalFormatCurrency(
                              budget.user1_amount || 0
                            )}`}
                          </span>
                          <span>
                            {finalUserNames.user2}:{" "}
                            {finalFormatCurrency(
                              budget.current_period_user2_spent || 0
                            )}
                            {` / ${finalFormatCurrency(
                              budget.user2_amount || 0
                            )}`}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
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
    </Card>
  );
}
