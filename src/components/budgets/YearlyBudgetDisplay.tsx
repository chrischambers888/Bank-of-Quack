import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyStateCard } from "@/components/settings/EmptyStateCard";
import {
  Category,
  YearlyBudgetSummary,
  YearlySectorBudgetSummary,
  Sector,
  Transaction,
} from "@/types";
import {
  Plus,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Calendar,
  Building2,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Edit,
  CheckCircle,
  Circle,
  Trash2,
  PieChart,
} from "lucide-react";
import { useBudgetSettings } from "@/hooks/useBudgetSettings";
import { supabase } from "@/supabaseClient";
import { formatCurrency } from "./budgetUtils";

interface YearlyBudgetDisplayProps {
  sectors: Sector[];
  categories: Category[];
  yearlyBudgetSummaries: YearlyBudgetSummary[];
  yearlySectorBudgetSummaries: YearlySectorBudgetSummary[];
  selectedYear: number;
  selectedMonthForProgress: number;
  user1AvatarUrl?: string | null;
  user2AvatarUrl?: string | null;
  onEditYearlyBudget: (budget: YearlyBudgetSummary) => void;
  onDeleteYearlyBudget: (categoryId: string) => void;
  onEditYearlySectorBudget: (sectorBudget: YearlySectorBudgetSummary) => void;
  onDeleteYearlySectorBudget: (sectorId: string) => void;
  onDeleteYearlySectorBudgetDirect?: (
    sectorId: string,
    deleteCategoryBudgets?: boolean
  ) => Promise<void>;
  onCreateYearlyBudget: (category: Category) => void;
  onCreateYearlySectorBudget: (sector: Sector) => void;
  userNames: string[];
  deleteTransaction: (id: string) => Promise<void>;
  handleSetEditingTransaction: (transaction: any) => void;
  onToggleExclude?: (transactionId: string, excluded: boolean) => Promise<void>;
  allTransactions?: Transaction[];
  incomeImageUrl?: string | null;
  settlementImageUrl?: string | null;
  reimbursementImageUrl?: string | null;
}

export function YearlyBudgetDisplay({
  sectors,
  categories,
  yearlyBudgetSummaries,
  yearlySectorBudgetSummaries,
  selectedYear,
  selectedMonthForProgress,
  user1AvatarUrl,
  user2AvatarUrl,
  onEditYearlyBudget,
  onDeleteYearlyBudget,
  onEditYearlySectorBudget,
  onDeleteYearlySectorBudget,
  onDeleteYearlySectorBudgetDirect,
  onCreateYearlyBudget,
  onCreateYearlySectorBudget,
  userNames,
  deleteTransaction,
  handleSetEditingTransaction,
  onToggleExclude,
  allTransactions = [],
  incomeImageUrl,
  settlementImageUrl,
  reimbursementImageUrl,
}: YearlyBudgetDisplayProps) {
  const { yellowThreshold } = useBudgetSettings();
  const [expandedSectors, setExpandedSectors] = useState<Set<string>>(
    new Set()
  );

  const getMonthName = (month: number) => {
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
  };

  const toggleSectorExpansion = (sectorId: string) => {
    const newExpanded = new Set(expandedSectors);
    if (newExpanded.has(sectorId)) {
      newExpanded.delete(sectorId);
    } else {
      newExpanded.add(sectorId);
    }
    setExpandedSectors(newExpanded);
  };

  // Calculate yearly stats
  // Calculate sector budgets total (only for sectors with budgets)
  const sectorBudgetsTotal = yearlySectorBudgetSummaries.reduce(
    (sum, sectorBudget) => {
      if (!sectorBudget.budget_id) {
        return sum; // Skip sectors without budgets
      }
      const budget =
        sectorBudget.budget_type === "absolute"
          ? sectorBudget.absolute_amount || 0
          : (sectorBudget.user1_amount || 0) + (sectorBudget.user2_amount || 0);
      return sum + budget;
    },
    0
  );

  // Calculate category budgets total
  const activeCategoryBudgets = yearlyBudgetSummaries.filter(
    (b) => b.budget_id
  );
  const categoryBudgetsTotal = activeCategoryBudgets.reduce((sum, budget) => {
    // Check if this category belongs to a sector with a budget
    const sectorWithBudget = sectors?.find((sector) => {
      if (!sector.category_ids?.includes(budget.category_id)) {
        return false; // Category doesn't belong to this sector
      }
      const sectorBudget = yearlySectorBudgetSummaries.find(
        (sb) => sb.sector_id === sector.id
      );
      return sectorBudget?.budget_id; // Only exclude if sector has a budget
    });

    if (sectorWithBudget) {
      return sum; // Skip this category budget as it's covered by sector budget
    }

    const budgetAmount =
      budget.budget_type === "absolute"
        ? budget.absolute_amount || 0
        : (budget.user1_amount || 0) + (budget.user2_amount || 0);
    return sum + budgetAmount;
  }, 0);

  // Total budget is sector budgets + category budgets (for categories without sector budgets)
  const totalBudget = sectorBudgetsTotal + categoryBudgetsTotal;

  // Calculate total spent (from both sector and category budgets)
  const sectorSpent = yearlySectorBudgetSummaries.reduce((sum, b) => {
    // Only include spending from sectors that have budgets
    if (b.budget_id) {
      return sum + (b.current_period_spent || 0);
    }
    return sum;
  }, 0);
  const categorySpent = activeCategoryBudgets.reduce((sum, budget) => {
    // Check if this category belongs to a sector with a budget
    const sectorWithBudget = sectors?.find((sector) => {
      if (!sector.category_ids?.includes(budget.category_id)) {
        return false; // Category doesn't belong to this sector
      }
      const sectorBudget = yearlySectorBudgetSummaries.find(
        (sb) => sb.sector_id === sector.id
      );
      return sectorBudget?.budget_id; // Only exclude if sector has a budget
    });

    if (sectorWithBudget) {
      return sum; // Skip this category spending as it's covered by sector spending
    }
    return sum + (budget.current_period_spent || 0);
  }, 0);
  const totalSpent = sectorSpent + categorySpent;

  const totalRemaining = totalBudget - totalSpent;
  const overallPercentage =
    totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  // If no sectors exist, show a different empty state
  if (sectors.length === 0) {
    return (
      <EmptyStateCard
        icon={Building2}
        title="No Sectors Configured"
        description="Sectors help organize your categories and budgets. Set up sectors in Settings to get started."
        actionText="Go to Settings"
        onAction={() => {
          console.log("Navigate to settings");
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card/50 rounded-lg p-4 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-green-500" />
            <span className="text-sm text-muted-foreground">Total Budget</span>
          </div>
          <div className="text-2xl font-bold">
            {formatCurrency(totalBudget)}
          </div>
        </div>
        <div className="bg-card/50 rounded-lg p-4 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            <span className="text-sm text-muted-foreground">Spent</span>
          </div>
          <div className="text-2xl font-bold">{formatCurrency(totalSpent)}</div>
        </div>
        <div className="bg-card/50 rounded-lg p-4 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <span className="text-sm text-muted-foreground">Remaining</span>
          </div>
          <div className="text-2xl font-bold">
            {formatCurrency(totalRemaining)}
          </div>
        </div>
        <div className="bg-card/50 rounded-lg p-4 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <PieChart className="h-4 w-4 text-purple-500" />
            <span className="text-sm text-muted-foreground">Progress</span>
          </div>
          <div className="text-2xl font-bold">
            {overallPercentage.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Yearly Budgets - {selectedYear} (Progress through{" "}
              {getMonthName(selectedMonthForProgress)})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-4 font-semibold">
                      Sector/Category
                    </th>
                    <th className="text-right py-3 px-4 font-semibold">
                      Budget
                    </th>
                    <th className="text-right py-3 px-4 font-semibold">
                      Spent
                    </th>
                    <th className="text-right py-3 px-4 font-semibold">
                      Remaining
                    </th>
                    <th className="text-center py-3 px-4 font-semibold">
                      Progress
                    </th>
                    <th className="text-center py-3 px-4 font-semibold">
                      Auto Rollup
                    </th>
                    <th className="text-center py-3 px-4 font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sectors.map((sector) => {
                    const sectorBudget = yearlySectorBudgetSummaries.find(
                      (s) => s.sector_id === sector.id
                    );
                    const sectorCategories = categories.filter((c) =>
                      sector.category_ids.includes(c.id)
                    );
                    const sectorBudgets = yearlyBudgetSummaries.filter(
                      (budget) =>
                        sector.category_ids.includes(budget.category_id)
                    );

                    const isExpanded = expandedSectors.has(sector.id);

                    return (
                      <React.Fragment key={sector.id}>
                        {/* Sector Row */}
                        <tr className="border-b hover:bg-muted/20">
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => toggleSectorExpansion(sector.id)}
                                className="p-1 hover:bg-muted rounded"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </button>
                              <Building2 className="h-4 w-4 text-blue-500" />
                              <span className="font-medium">{sector.name}</span>
                              {sectorBudget && (
                                <span className="text-xs text-muted-foreground">
                                  (Sector Budget)
                                </span>
                              )}
                            </div>
                          </td>
                          {sectorBudget?.budget_id ? (
                            <>
                              <td className="py-3 px-4 text-right font-medium">
                                {formatCurrency(
                                  sectorBudget.current_period_budget || 0
                                )}
                              </td>
                              <td className="py-3 px-4 text-right text-muted-foreground">
                                {formatCurrency(
                                  sectorBudget.current_period_spent || 0
                                )}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span
                                  className={
                                    (sectorBudget?.current_period_remaining_amount ||
                                      0) >= 0
                                      ? "text-green-600 font-medium"
                                      : "text-red-600 font-medium"
                                  }
                                >
                                  {formatCurrency(
                                    sectorBudget.current_period_remaining_amount ||
                                      0
                                  )}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                {sectorBudget
                                  ? (
                                      sectorBudget.current_period_remaining_percentage ||
                                      0
                                    ).toFixed(1)
                                  : "0.0"}
                                %
                              </td>
                              <td className="text-center py-3 px-4">
                                <div className="flex justify-center">
                                  {sectorBudget?.auto_rollup ? (
                                    <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                                      <svg
                                        className="w-3 h-3 text-green-600"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                      >
                                        <path
                                          fillRule="evenodd"
                                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                    </div>
                                  ) : (
                                    <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center">
                                      <span className="text-xs font-semibold text-blue-600">
                                        M
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-3 px-4 text-right text-muted-foreground">
                                —
                              </td>
                              <td className="py-3 px-4 text-right text-muted-foreground">
                                —
                              </td>
                              <td className="py-3 px-4 text-right text-muted-foreground">
                                —
                              </td>
                              <td className="py-3 px-4 text-center text-muted-foreground">
                                —
                              </td>
                              <td className="py-3 px-4 text-center text-muted-foreground">
                                —
                              </td>
                            </>
                          )}
                          <td className="py-3 px-4 text-center">
                            <div className="flex gap-2 justify-center">
                              {sectorBudget ? (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      onEditYearlySectorBudget(sectorBudget)
                                    }
                                    className="h-8 px-3"
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      onDeleteYearlySectorBudget(sector.id)
                                    }
                                    className="h-8 px-3 text-red-500 hover:text-red-400"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    onCreateYearlySectorBudget(sector)
                                  }
                                  className="h-8 px-3"
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Create
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Category Rows (when expanded) */}
                        {isExpanded &&
                          sectorCategories.map((category) => {
                            const budget = sectorBudgets.find(
                              (b) => b.category_id === category.id
                            );

                            return (
                              <tr
                                key={category.id}
                                className="border-b hover:bg-muted/10"
                              >
                                <td className="py-3 px-4">
                                  <div className="flex items-center space-x-3 ml-8">
                                    {category.image_url ? (
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
                                    <span className="font-medium">
                                      {category.name}
                                    </span>
                                  </div>
                                </td>
                                {budget?.budget_id ? (
                                  <>
                                    <td className="py-3 px-4 text-right font-medium">
                                      {formatCurrency(
                                        budget.current_period_budget || 0
                                      )}
                                    </td>
                                    <td className="py-3 px-4 text-right text-muted-foreground">
                                      {formatCurrency(
                                        budget.current_period_spent || 0
                                      )}
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                      <span
                                        className={
                                          (budget?.current_period_remaining_amount ||
                                            0) >= 0
                                            ? "text-green-600 font-medium"
                                            : "text-red-600 font-medium"
                                        }
                                      >
                                        {formatCurrency(
                                          budget.current_period_remaining_amount ||
                                            0
                                        )}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                      {budget
                                        ? (
                                            budget.current_period_remaining_percentage ||
                                            0
                                          ).toFixed(1)
                                        : "0.0"}
                                      %
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td className="py-3 px-4 text-right text-muted-foreground">
                                      —
                                    </td>
                                    <td className="py-3 px-4 text-right text-muted-foreground">
                                      —
                                    </td>
                                    <td className="py-3 px-4 text-right text-muted-foreground">
                                      —
                                    </td>
                                    <td className="py-3 px-4 text-center text-muted-foreground">
                                      —
                                    </td>
                                  </>
                                )}
                                <td className="py-3 px-4 text-center">
                                  <div className="flex gap-2 justify-center">
                                    {budget ? (
                                      <>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() =>
                                            onEditYearlyBudget(budget)
                                          }
                                          className="h-8 px-3"
                                        >
                                          <Edit className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() =>
                                            onDeleteYearlyBudget(
                                              budget.category_id
                                            )
                                          }
                                          className="h-8 px-3 text-red-500 hover:text-red-400"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </>
                                    ) : (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          onCreateYearlyBudget(category)
                                        }
                                        className="h-8 px-3"
                                      >
                                        <Plus className="h-3 w-3 mr-1" />
                                        Create
                                      </Button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Yearly Budget Overview - {selectedYear}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Mobile cards content will be implemented in a separate component */}
            <div className="text-center py-8 text-muted-foreground">
              Mobile cards view - to be implemented
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
