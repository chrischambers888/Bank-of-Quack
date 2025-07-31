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
import {
  formatCurrency,
  getOrphanedYearlyBudgetSummaries,
  getCategoriesForSector,
  getBudgetSummariesForSector,
  getYearlyBudgetStats,
  getExcludedYearlySectors,
} from "./budgetUtils";
import { BudgetStats } from "./BudgetStats";
import { Badge } from "@/components/ui/badge";
import { SectorBudgetCard } from "./SectorBudgetCard";

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
  const [modalData, setModalData] = useState<any>(null);
  const [tooltip, setTooltip] = useState<{
    show: boolean;
    message: string;
    x: number;
    y: number;
  }>({
    show: false,
    message: "",
    x: 0,
    y: 0,
  });

  const showTooltip = (
    message: string,
    event: React.MouseEvent | React.TouchEvent
  ) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({
      show: true,
      message,
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
    });
  };

  const hideTooltip = () => {
    setTooltip({ show: false, message: "", x: 0, y: 0 });
  };

  // Auto-hide tooltip after 3 seconds
  useEffect(() => {
    if (tooltip.show) {
      const timer = setTimeout(() => {
        hideTooltip();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [tooltip.show]);

  // Hide tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (tooltip.show) {
        hideTooltip();
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [tooltip.show]);

  // Helper function to get sectors without yearly budgets
  const getSectorsWithoutYearlyBudgets = (
    sectors: Sector[],
    yearlyBudgetSummaries: YearlyBudgetSummary[],
    yearlySectorBudgetSummaries: YearlySectorBudgetSummary[]
  ) => {
    return sectors.filter((sector) => {
      const sectorBudget = yearlySectorBudgetSummaries.find(
        (sb) => sb.sector_id === sector.id
      );
      const sectorHasBudget = sectorBudget?.budget_id;

      // Check if any categories in this sector have yearly budgets
      const sectorCategories = getCategoriesForSector(sector, categories);
      const sectorBudgets = yearlyBudgetSummaries.filter((budget) =>
        sector.category_ids.includes(budget.category_id)
      );
      const hasCategoryBudgets = sectorBudgets.length > 0;

      // Return true if sector has no budget but has categories with budgets
      return !sectorHasBudget && hasCategoryBudgets;
    });
  };

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

  const stats = getYearlyBudgetStats(
    sectors,
    yearlyBudgetSummaries,
    yearlySectorBudgetSummaries
  );
  const excludedSectors = getExcludedYearlySectors(
    sectors,
    yearlySectorBudgetSummaries
  );

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <BudgetStats
        totalBudget={stats.totalBudget}
        totalSpent={stats.totalSpent}
        totalRemaining={stats.totalRemaining}
        overallPercentage={stats.overallPercentage}
        monthName={`${selectedYear} (Progress through ${getMonthName(
          selectedMonthForProgress
        )})`}
        excludedSectors={excludedSectors}
      />

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
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
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
                      Over/Under
                    </th>
                    <th className="text-right py-3 px-4 font-semibold">
                      % Used
                    </th>
                    <th className="text-center py-3 px-4 font-semibold">
                      Auto Rollup
                    </th>
                    <th className="text-center py-3 px-4 font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
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
                        <tr className="bg-muted/30 hover:bg-muted/50">
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
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span className="font-semibold">
                                {sector.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                ({sectorCategories.length} categories)
                              </span>
                              {getSectorsWithoutYearlyBudgets(
                                sectors,
                                yearlyBudgetSummaries,
                                yearlySectorBudgetSummaries
                              ).some((s) => s.id === sector.id) && (
                                <div
                                  onMouseEnter={(e) =>
                                    showTooltip(
                                      "Sector has categories with yearly budgets but no yearly sector budget",
                                      e
                                    )
                                  }
                                  onMouseLeave={hideTooltip}
                                  onTouchStart={(e) =>
                                    showTooltip(
                                      "Sector has categories with yearly budgets but no yearly sector budget",
                                      e
                                    )
                                  }
                                >
                                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                </div>
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
                                    (sectorBudget?.current_period_budget || 0) -
                                      (sectorBudget?.current_period_spent ||
                                        0) >=
                                    0
                                      ? "text-green-600 font-medium"
                                      : "text-red-600 font-medium"
                                  }
                                >
                                  {formatCurrency(
                                    Math.abs(
                                      (sectorBudget?.current_period_budget ||
                                        0) -
                                        (sectorBudget?.current_period_spent ||
                                          0)
                                    )
                                  )}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end space-x-2">
                                  <div
                                    className={`w-16 rounded-full h-2 ${
                                      (sectorBudget?.current_period_budget ||
                                        0) === 0
                                        ? "bg-gray-600"
                                        : "bg-gray-200"
                                    }`}
                                  >
                                    <div
                                      className={`h-2 rounded-full ${
                                        (sectorBudget?.current_period_spent ||
                                          0) /
                                          Math.max(
                                            sectorBudget?.current_period_budget ||
                                              1,
                                            1
                                          ) >
                                        1
                                          ? "bg-red-500"
                                          : (sectorBudget?.current_period_spent ||
                                              0) /
                                              Math.max(
                                                sectorBudget?.current_period_budget ||
                                                  1,
                                                1
                                              ) >=
                                            0.9
                                          ? "bg-yellow-500"
                                          : "bg-green-500"
                                      }`}
                                      style={{
                                        width: `${Math.min(
                                          ((sectorBudget?.current_period_spent ||
                                            0) /
                                            Math.max(
                                              sectorBudget?.current_period_budget ||
                                                1,
                                              1
                                            )) *
                                            100,
                                          100
                                        )}%`,
                                      }}
                                    />
                                  </div>
                                  <span className="text-sm">
                                    {(
                                      ((sectorBudget?.current_period_spent ||
                                        0) /
                                        Math.max(
                                          sectorBudget?.current_period_budget ||
                                            1,
                                          1
                                        )) *
                                      100
                                    ).toFixed(1)}
                                    %
                                  </span>
                                </div>
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
                              {sectorBudget?.budget_id ? (
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
                        {isExpanded && (
                          <>
                            {sectorBudgets.length > 0
                              ? sectorBudgets
                                  .map((budget) => {
                                    const totalBudget =
                                      budget.budget_type === "absolute"
                                        ? budget.absolute_amount || 0
                                        : (budget.user1_amount || 0) +
                                          (budget.user2_amount || 0);
                                    const spent =
                                      budget.current_period_spent || 0;
                                    const overUnder = totalBudget - spent;
                                    const percentage =
                                      totalBudget > 0
                                        ? (spent / totalBudget) * 100
                                        : 0;

                                    return {
                                      budget,
                                      totalBudget,
                                      spent,
                                      overUnder,
                                      percentage,
                                    };
                                  })
                                  .sort((a, b) => b.percentage - a.percentage)
                                  .map(
                                    ({
                                      budget,
                                      totalBudget,
                                      spent,
                                      overUnder,
                                      percentage,
                                    }) => (
                                      <tr
                                        key={budget.category_id}
                                        className="hover:bg-muted/20"
                                      >
                                        <td className="py-3 px-4">
                                          <div className="flex items-center space-x-3 ml-8">
                                            {(() => {
                                              const category = categories.find(
                                                (c) =>
                                                  c.id === budget.category_id
                                              );
                                              return category?.image_url ? (
                                                <img
                                                  src={category.image_url}
                                                  alt={category.name}
                                                  className="w-6 h-6 rounded-full object-cover"
                                                />
                                              ) : (
                                                <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center">
                                                  <DollarSign className="h-3 w-3 text-muted-foreground" />
                                                </div>
                                              );
                                            })()}
                                            <span className="font-medium">
                                              {(() => {
                                                const category =
                                                  categories.find(
                                                    (c) =>
                                                      c.id ===
                                                      budget.category_id
                                                  );
                                                return (
                                                  category?.name ||
                                                  "Unknown Category"
                                                );
                                              })()}
                                            </span>
                                          </div>
                                        </td>
                                        <td className="py-3 px-4 text-right font-medium">
                                          {formatCurrency(totalBudget)}
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                          {formatCurrency(spent)}
                                        </td>
                                        <td
                                          className={`py-3 px-4 text-right font-medium ${
                                            overUnder < 0
                                              ? "text-red-600"
                                              : "text-green-600"
                                          }`}
                                        >
                                          {formatCurrency(Math.abs(overUnder))}
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                          <div className="flex items-center justify-end space-x-2">
                                            <div
                                              className={`w-16 rounded-full h-2 ${
                                                percentage === 0
                                                  ? "bg-gray-600"
                                                  : "bg-gray-200"
                                              }`}
                                            >
                                              <div
                                                className={`h-2 rounded-full ${
                                                  percentage > 100
                                                    ? "bg-red-500"
                                                    : percentage >= 90
                                                    ? "bg-yellow-500"
                                                    : "bg-green-500"
                                                }`}
                                                style={{
                                                  width: `${Math.min(
                                                    percentage,
                                                    100
                                                  )}%`,
                                                }}
                                              />
                                            </div>
                                            <span className="text-sm">
                                              {percentage.toFixed(1)}%
                                            </span>
                                          </div>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                          —
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                          <div className="flex gap-2 justify-center">
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
                                          </div>
                                        </td>
                                      </tr>
                                    )
                                  )
                              : null}

                            {/* Special row for unset categories */}
                            {(() => {
                              const categoriesWithBudgets = new Set(
                                sectorBudgets.map((b) => b.category_id)
                              );
                              const unsetCategories = sectorCategories.filter(
                                (cat) => !categoriesWithBudgets.has(cat.id)
                              );

                              if (unsetCategories.length === 0) return null;

                              return (
                                <tr className="bg-muted/20 border-t">
                                  <td colSpan={7} className="py-4 px-4">
                                    <div className="flex justify-center">
                                      <div className="flex flex-wrap justify-center gap-2">
                                        {unsetCategories.map((category) => (
                                          <Button
                                            key={category.id}
                                            size="sm"
                                            variant="outline"
                                            onClick={() =>
                                              onCreateYearlyBudget(category)
                                            }
                                            className="text-xs h-7 px-3"
                                          >
                                            <Plus className="h-3 w-3 mr-1" />
                                            {category.name}
                                          </Button>
                                        ))}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })()}
                          </>
                        )}
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
        {/* Sector Budget Cards */}
        {sectors
          .map((sector) => {
            const sectorBudget = yearlySectorBudgetSummaries.find(
              (s) => s.sector_id === sector.id
            );

            // Calculate sector percentage for sorting (same as desktop)
            const sectorTotal = sectorBudget?.current_period_budget || 0;
            const sectorSpent = sectorBudget?.current_period_spent || 0;
            const sectorPercentage =
              sectorTotal > 0 ? (sectorSpent / sectorTotal) * 100 : 0;

            return {
              sector,
              sectorBudget,
              sectorPercentage,
            };
          })
          .sort((a, b) => {
            // First sort by whether sector has a defined budget
            const aHasBudget = !!a.sectorBudget?.budget_id;
            const bHasBudget = !!b.sectorBudget?.budget_id;

            if (aHasBudget && !bHasBudget) return -1; // a has budget, b doesn't
            if (!aHasBudget && bHasBudget) return 1; // b has budget, a doesn't

            // If both have the same budget status, sort by percentage used (descending)
            return b.sectorPercentage - a.sectorPercentage;
          })
          .map(({ sector, sectorBudget }) => {
            // Check if sector has no yearly budget defined (no budget_id) or has a zero yearly budget
            const hasNoBudget = !sectorBudget || !sectorBudget.budget_id;
            const hasZeroBudget =
              sectorBudget &&
              sectorBudget.budget_id &&
              ((sectorBudget.budget_type === "absolute" &&
                (sectorBudget.absolute_amount || 0) === 0) ||
                (sectorBudget.budget_type === "split" &&
                  (sectorBudget.user1_amount || 0) +
                    (sectorBudget.user2_amount || 0) ===
                    0));

            if (hasNoBudget || hasZeroBudget) {
              // Show create budget card for sectors without yearly budgets or with zero yearly budgets
              return (
                <Card key={sector.id} className="border-dashed border-2">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center space-x-2">
                      <Building2 className="h-5 w-5" />
                      <span>{sector.name}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-4">
                      <Button
                        onClick={() => onCreateYearlySectorBudget(sector)}
                        className="w-full"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Create Yearly Sector Budget
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            }

            return (
              <Card key={sector.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-foreground">
                      {sector.name}
                    </CardTitle>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          toggleSectorExpansion(sector.id);
                        }}
                        className="h-8 w-8"
                      >
                        {expandedSectors.has(sector.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEditYearlySectorBudget(sectorBudget)}
                        className="h-8 w-8"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDeleteYearlySectorBudget(sector.id)}
                        className="h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary">
                      {sectorBudget.budget_type === "absolute"
                        ? "Absolute"
                        : "Split"}
                    </Badge>
                    {sectorBudget.auto_rollup ? (
                      <Badge
                        variant="secondary"
                        className="bg-green-500/20 text-green-600"
                      >
                        Auto Rollup
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="bg-blue-500/20 text-blue-600"
                      >
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
                        {selectedYear} (through{" "}
                        {getMonthName(selectedMonthForProgress)}):
                      </span>
                      <span className="font-medium">
                        {formatCurrency(sectorBudget.current_period_spent || 0)}{" "}
                        /{" "}
                        {formatCurrency(
                          sectorBudget.current_period_budget || 0
                        )}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full transition-all duration-300 ${
                          (sectorBudget.current_period_spent || 0) >
                          (sectorBudget.current_period_budget || 0)
                            ? "bg-red-500"
                            : (sectorBudget.current_period_spent || 0) >=
                              (sectorBudget.current_period_budget || 0) * 0.8
                            ? "bg-yellow-500"
                            : "bg-green-500"
                        }`}
                        style={{
                          width: `${Math.min(
                            ((sectorBudget.current_period_spent || 0) /
                              (sectorBudget.current_period_budget || 1)) *
                              100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {(
                          ((sectorBudget.current_period_spent || 0) /
                            (sectorBudget.current_period_budget || 1)) *
                          100
                        ).toFixed(1)}
                        % used
                      </span>
                      <span
                        className={
                          (sectorBudget.current_period_budget || 0) -
                            (sectorBudget.current_period_spent || 0) >=
                          0
                            ? "text-green-600"
                            : "text-red-600"
                        }
                      >
                        {formatCurrency(
                          Math.abs(
                            (sectorBudget.current_period_budget || 0) -
                              (sectorBudget.current_period_spent || 0)
                          )
                        )}{" "}
                        {(sectorBudget.current_period_budget || 0) -
                          (sectorBudget.current_period_spent || 0) >=
                        0
                          ? "under"
                          : "over"}
                      </span>
                    </div>
                  </div>

                  {/* Budget Details */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Total Budget</p>
                      <p className="font-medium">
                        {formatCurrency(
                          sectorBudget.current_period_budget || 0
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Spent</p>
                      <p className="text-muted-foreground">
                        {formatCurrency(sectorBudget.current_period_spent || 0)}
                      </p>
                    </div>
                  </div>

                  {/* User Spending Breakdown for Split Budgets */}
                  {sectorBudget.budget_type === "split" && (
                    <div className="text-xs text-muted-foreground space-y-1 pt-2">
                      <div className="flex justify-between items-center">
                        <span>
                          {userNames[0]}:{" "}
                          {formatCurrency(
                            sectorBudget.current_period_user1_spent || 0
                          )}
                          {` / ${formatCurrency(
                            sectorBudget.user1_amount || 0
                          )}`}
                        </span>
                        <span>
                          {userNames[1]}:{" "}
                          {formatCurrency(
                            sectorBudget.current_period_user2_spent || 0
                          )}
                          {` / ${formatCurrency(
                            sectorBudget.user2_amount || 0
                          )}`}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Expandable Category Budgets */}
                  {expandedSectors.has(sector.id) && (
                    <div className="space-y-3 pt-4 border-t border-muted">
                      {/* Categories with existing budgets */}
                      {yearlyBudgetSummaries
                        .filter((budget) => {
                          // Check if this category belongs to the current sector
                          return (
                            sector.category_ids &&
                            sector.category_ids.includes(budget.category_id)
                          );
                        })
                        .map((budget) => {
                          const category = categories.find(
                            (c) => c.id === budget.category_id
                          );
                          const totalBudget =
                            budget.budget_type === "absolute"
                              ? budget.absolute_amount || 0
                              : (budget.user1_amount || 0) +
                                (budget.user2_amount || 0);
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
                                    onClick={() => onEditYearlyBudget(budget)}
                                    className="h-6 w-6"
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() =>
                                      onDeleteYearlyBudget(budget.category_id)
                                    }
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
                                    {selectedYear} (through{" "}
                                    {getMonthName(selectedMonthForProgress)}):
                                  </span>
                                  <span className="font-medium">
                                    {formatCurrency(spent)} /{" "}
                                    {formatCurrency(totalBudget)}
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
                                      width: `${Math.min(
                                        percentageUsed,
                                        100
                                      )}%`,
                                    }}
                                  />
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">
                                    {percentageUsed.toFixed(1)}% used
                                  </span>
                                  <span
                                    className={
                                      remaining >= 0
                                        ? "text-green-600"
                                        : "text-red-600"
                                    }
                                  >
                                    {formatCurrency(Math.abs(remaining))}{" "}
                                    {remaining >= 0 ? "under" : "over"}
                                  </span>
                                </div>
                              </div>

                              {/* Budget Details */}
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <p className="text-muted-foreground">
                                    Budget
                                  </p>
                                  <p className="font-medium">
                                    {formatCurrency(totalBudget)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Spent</p>
                                  <p className="text-muted-foreground">
                                    {formatCurrency(spent)}
                                  </p>
                                </div>
                              </div>

                              {/* User Spending for Split Budgets */}
                              {budget.budget_type === "split" && (
                                <div className="text-xs text-muted-foreground space-y-1 pt-2">
                                  <div className="flex justify-between items-center">
                                    <span>
                                      {userNames[0]}:{" "}
                                      {formatCurrency(
                                        budget.current_period_user1_spent || 0
                                      )}
                                      {` / ${formatCurrency(
                                        budget.user1_amount || 0
                                      )}`}
                                    </span>
                                    <span>
                                      {userNames[1]}:{" "}
                                      {formatCurrency(
                                        budget.current_period_user2_spent || 0
                                      )}
                                      {` / ${formatCurrency(
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
                        // Get all categories that belong to this sector
                        const sectorCategories = categories.filter((cat) =>
                          sector.category_ids.includes(cat.id)
                        );

                        // Get categories that have yearly budgets
                        const categoriesWithBudgets = yearlyBudgetSummaries
                          .filter((budget) =>
                            sector.category_ids.includes(budget.category_id)
                          )
                          .map((budget) => budget.category_id);

                        // Find categories without yearly budgets
                        const categoriesWithoutBudgets =
                          sectorCategories.filter(
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
                                    onEditYearlyBudget({
                                      category_id: category.id,
                                    } as any)
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
          })}
      </div>

      {/* Categories without sector budgets */}
      {(() => {
        const orphanedBudgets = getOrphanedYearlyBudgetSummaries(
          sectors,
          yearlyBudgetSummaries,
          yearlySectorBudgetSummaries
        );

        if (orphanedBudgets.length === 0) {
          return null;
        }

        return (
          <div className="mt-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-foreground">
                  Categories without Sector Budgets
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  These categories have budgets but their sectors don't have
                  yearly budgets set up.
                </p>
              </CardHeader>
              <CardContent>
                {/* Desktop Table View */}
                <div className="hidden lg:block">
                  <div className="rounded-md border">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-muted/20">
                          <th className="text-left py-3 px-4 font-semibold">
                            Category
                          </th>
                          <th className="text-left py-3 px-4 font-semibold">
                            Sector
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
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {orphanedBudgets.map((budget: YearlyBudgetSummary) => {
                          const category = categories.find(
                            (c) => c.id === budget.category_id
                          );
                          const sector = sectors.find((s) =>
                            s.category_ids.includes(budget.category_id)
                          );
                          const totalBudget =
                            budget.budget_type === "absolute"
                              ? budget.absolute_amount || 0
                              : (budget.user1_amount || 0) +
                                (budget.user2_amount || 0);
                          const spent = budget.current_period_spent || 0;
                          const remaining = totalBudget - spent;

                          return (
                            <tr
                              key={budget.category_id}
                              className="border-b hover:bg-muted/20"
                            >
                              <td className="py-3 px-4">
                                <div className="flex items-center space-x-2">
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
                                  <span className="font-medium">
                                    {category?.name}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-muted-foreground">
                                {sector?.name || "Unknown"}
                              </td>
                              <td className="py-3 px-4 text-right font-medium">
                                {formatCurrency(totalBudget)}
                              </td>
                              <td className="py-3 px-4 text-right text-muted-foreground">
                                {formatCurrency(spent)}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span
                                  className={
                                    remaining >= 0
                                      ? "text-green-600 font-medium"
                                      : "text-red-600 font-medium"
                                  }
                                >
                                  {formatCurrency(remaining)}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                {sector && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      onCreateYearlySectorBudget(sector)
                                    }
                                    className="h-8 px-3"
                                  >
                                    <Plus className="h-3 w-3 mr-1" />
                                    Create Yearly Sector Budget
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden space-y-3">
                  {orphanedBudgets.map((budget: YearlyBudgetSummary) => {
                    const category = categories.find(
                      (c) => c.id === budget.category_id
                    );
                    const sector = sectors.find((s) =>
                      s.category_ids.includes(budget.category_id)
                    );
                    const totalBudget =
                      budget.budget_type === "absolute"
                        ? budget.absolute_amount || 0
                        : (budget.user1_amount || 0) +
                          (budget.user2_amount || 0);
                    const spent = budget.current_period_spent || 0;
                    const remaining = totalBudget - spent;

                    return (
                      <div
                        key={budget.category_id}
                        className="border rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            {category?.image_url ? (
                              <img
                                src={category.image_url}
                                alt={category.name}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <p className="font-medium">{category?.name}</p>
                              <p className="text-sm text-muted-foreground">
                                Sector: {sector?.name || "Unknown"}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                          <div>
                            <p className="text-muted-foreground">Budget</p>
                            <p className="font-medium">
                              {formatCurrency(totalBudget)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Spent</p>
                            <p className="text-muted-foreground">
                              {formatCurrency(spent)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Remaining</p>
                            <p
                              className={
                                remaining >= 0
                                  ? "text-green-600 font-medium"
                                  : "text-red-600 font-medium"
                              }
                            >
                              {formatCurrency(remaining)}
                            </p>
                          </div>
                        </div>
                        {sector && (
                          <div className="flex justify-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onCreateYearlySectorBudget(sector)}
                              className="w-full"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Create Yearly Sector Budget
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })()}
    </div>
  );
}
