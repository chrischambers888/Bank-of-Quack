import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Category,
  BudgetSummary,
  Sector,
  SectorBudgetSummary,
  SelectedMonth,
} from "@/types";
import {
  Plus,
  Building2,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Edit,
  Trash2,
  AlertTriangle,
  DollarSign,
} from "lucide-react";
import { useBudgetSettings } from "@/hooks/useBudgetSettings";
import {
  formatCurrency,
  getMonthName,
  getCategoriesForSector,
  getBudgetSummariesForSector,
  getSectorBudgetSummary,
  getUnassignedCategories,
  getUnassignedBudgetSummaries,
  getOrphanedBudgetSummaries,
  getSectorsWithoutBudgets,
  calculateSectorTotal,
  calculateSectorSpent,
} from "./budgetUtils";

interface BudgetTableProps {
  sectors: Sector[];
  categories: Category[];
  budgetSummaries: BudgetSummary[];
  sectorBudgetSummaries: SectorBudgetSummary[];
  selectedMonth: SelectedMonth;
  expandedSectors: Set<string>;
  onToggleSectorExpansion: (sectorId: string) => void;
  onOpenSectorModal: (sector: Sector) => void;
  onOpenCategoryModal: (budgetSummary: BudgetSummary) => void;
  onEditBudget: (budget: any) => void;
  onDeleteBudget: (categoryId: string) => void;
  onEditSectorBudget: (sectorBudget: SectorBudgetSummary) => void;
  onDeleteSectorBudget: (sectorId: string, sectorName: string) => void;
  onCreateBudget: (category: Category) => void;
  onCreateSectorBudget: (sector: Sector) => void;
  showTooltip: (
    message: string,
    event: React.MouseEvent | React.TouchEvent
  ) => void;
  hideTooltip: () => void;
}

export function BudgetTable({
  sectors,
  categories,
  budgetSummaries,
  sectorBudgetSummaries,
  selectedMonth,
  expandedSectors,
  onToggleSectorExpansion,
  onOpenSectorModal,
  onOpenCategoryModal,
  onEditBudget,
  onDeleteBudget,
  onEditSectorBudget,
  onDeleteSectorBudget,
  onCreateBudget,
  onCreateSectorBudget,
  showTooltip,
  hideTooltip,
}: BudgetTableProps) {
  const { yellowThreshold } = useBudgetSettings();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          Budget Overview - {getMonthName(selectedMonth)}
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
                <th className="text-right py-3 px-4 font-semibold">Budget</th>
                <th className="text-right py-3 px-4 font-semibold">Spent</th>
                <th className="text-right py-3 px-4 font-semibold">
                  Over/Under
                </th>
                <th className="text-right py-3 px-4 font-semibold">% Used</th>
                <th className="text-center py-3 px-4 font-semibold">
                  Auto Rollup
                </th>
                <th className="text-center py-3 px-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {/* Sectors and their categories - sorted by percentage used */}
              {sectors
                .map((sector) => {
                  const sectorBudget = getSectorBudgetSummary(
                    sector.id,
                    sectorBudgetSummaries
                  );
                  const sectorCategories = getCategoriesForSector(
                    sector,
                    categories
                  );
                  const sectorBudgets = getBudgetSummariesForSector(
                    sector,
                    budgetSummaries
                  );
                  const sectorTotal = calculateSectorTotal(
                    sector,
                    sectorBudgetSummaries
                  );
                  const sectorSpent = calculateSectorSpent(
                    sector,
                    sectorBudgetSummaries
                  );
                  const sectorOverUnder = sectorTotal - sectorSpent;
                  const sectorPercentage =
                    sectorTotal > 0 ? (sectorSpent / sectorTotal) * 100 : 0;
                  const isExpanded = expandedSectors.has(sector.id);

                  return {
                    sector,
                    sectorBudget,
                    sectorCategories,
                    sectorBudgets,
                    sectorTotal,
                    sectorSpent,
                    sectorOverUnder,
                    sectorPercentage,
                    isExpanded,
                  };
                })
                .sort((a, b) => {
                  // First sort by whether sector has a defined budget
                  const aHasBudget = !!a.sectorBudget?.budget_id;
                  const bHasBudget = !!b.sectorBudget?.budget_id;

                  if (aHasBudget && !bHasBudget) return -1; // a has budget, b doesn't
                  if (!aHasBudget && bHasBudget) return 1; // b has budget, a doesn't

                  // If both have the same budget status, sort by percentage used
                  return b.sectorPercentage - a.sectorPercentage;
                })
                .map(
                  ({
                    sector,
                    sectorBudget,
                    sectorCategories,
                    sectorBudgets,
                    sectorTotal,
                    sectorSpent,
                    sectorOverUnder,
                    sectorPercentage,
                    isExpanded,
                  }) => (
                    <React.Fragment key={sector.id}>
                      {/* Sector Row */}
                      <tr className="bg-muted/30 hover:bg-muted/50">
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 hover:bg-muted/50"
                              onClick={() => onToggleSectorExpansion(sector.id)}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold">{sector.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ({sectorCategories.length} categories)
                            </span>
                            {getSectorsWithoutBudgets(
                              sectors,
                              budgetSummaries,
                              sectorBudgetSummaries
                            ).some((s) => s.id === sector.id) && (
                              <div
                                onMouseEnter={(e) =>
                                  showTooltip(
                                    "Sector has categories with budgets but no sector budget",
                                    e
                                  )
                                }
                                onMouseLeave={hideTooltip}
                                onTouchStart={(e) =>
                                  showTooltip(
                                    "Sector has categories with budgets but no sector budget",
                                    e
                                  )
                                }
                              >
                                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                              </div>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 hover:bg-muted/50"
                              onClick={() => onOpenSectorModal(sector)}
                            >
                              <HelpCircle className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </div>
                        </td>
                        {sectorBudget?.budget_id ? (
                          <>
                            <td className="text-right py-3 px-4 font-medium">
                              {formatCurrency(sectorTotal)}
                            </td>
                            <td className="text-right py-3 px-4">
                              {formatCurrency(sectorSpent)}
                            </td>
                            <td
                              className={`text-right py-3 px-4 font-medium ${
                                sectorOverUnder < 0
                                  ? "text-red-600"
                                  : "text-green-600"
                              }`}
                            >
                              {formatCurrency(Math.abs(sectorOverUnder))}
                            </td>
                            <td className="text-right py-3 px-4">
                              <div className="flex items-center justify-end space-x-2">
                                <div
                                  className={`w-16 rounded-full h-2 ${
                                    sectorPercentage === 0
                                      ? "bg-gray-600"
                                      : "bg-gray-200"
                                  }`}
                                >
                                  <div
                                    className={`h-2 rounded-full transition-all duration-300 ${
                                      sectorPercentage > 100
                                        ? "bg-red-500"
                                        : sectorPercentage >= yellowThreshold
                                        ? "bg-yellow-500"
                                        : sectorPercentage > 0
                                        ? "bg-green-500"
                                        : "bg-gray-600"
                                    }`}
                                    style={{
                                      width: `${Math.min(
                                        sectorPercentage,
                                        100
                                      )}%`,
                                    }}
                                  />
                                </div>
                                <span className="text-xs w-12 text-right">
                                  {sectorPercentage.toFixed(1)}%
                                </span>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="text-right py-3 px-4 text-muted-foreground">
                              —
                            </td>
                            <td className="text-right py-3 px-4 text-muted-foreground">
                              —
                            </td>
                            <td className="text-right py-3 px-4 text-muted-foreground">
                              —
                            </td>
                            <td className="text-right py-3 px-4 text-muted-foreground">
                              —
                            </td>
                          </>
                        )}
                        {sectorBudget?.budget_id ? (
                          <td className="text-center py-3 px-4">
                            <div className="flex justify-center">
                              {sectorBudget.auto_rollup ? (
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
                        ) : (
                          <td className="text-center py-3 px-4 text-muted-foreground">
                            —
                          </td>
                        )}
                        <td className="text-center py-3 px-4">
                          <div className="flex justify-center space-x-1">
                            {sectorBudget?.budget_id ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    onEditSectorBudget(sectorBudget)
                                  }
                                  className="h-8 px-3"
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    onDeleteSectorBudget(sector.id, sector.name)
                                  }
                                  className="h-8 px-3 text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onCreateSectorBudget(sector)}
                                className="h-8 px-3"
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Create
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Category Rows - Show when expanded, sorted by percentage used */}
                      {isExpanded && (
                        <>
                          {sectorBudgets.length > 0
                            ? sectorBudgets
                                .map((budgetSummary) => {
                                  const totalBudget =
                                    budgetSummary.budget_type === "absolute"
                                      ? budgetSummary.absolute_amount || 0
                                      : (budgetSummary.user1_amount || 0) +
                                        (budgetSummary.user2_amount || 0);
                                  const spent =
                                    budgetSummary.current_period_spent || 0;
                                  const overUnder = totalBudget - spent;
                                  const percentage =
                                    totalBudget > 0
                                      ? (spent / totalBudget) * 100
                                      : 0;

                                  return {
                                    budgetSummary,
                                    totalBudget,
                                    spent,
                                    overUnder,
                                    percentage,
                                  };
                                })
                                .sort((a, b) => b.percentage - a.percentage)
                                .map(
                                  ({
                                    budgetSummary,
                                    totalBudget,
                                    spent,
                                    overUnder,
                                    percentage,
                                  }) => (
                                    <tr
                                      key={budgetSummary.category_id}
                                      className="hover:bg-muted/20"
                                    >
                                      <td className="py-2 px-4 pl-12">
                                        <div className="flex items-center space-x-2">
                                          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                                            {budgetSummary.category_image ? (
                                              <img
                                                src={
                                                  budgetSummary.category_image
                                                }
                                                alt={
                                                  budgetSummary.category_name
                                                }
                                                className="w-full h-full object-cover"
                                              />
                                            ) : (
                                              <div className="w-4 h-4 bg-muted-foreground rounded-full"></div>
                                            )}
                                          </div>
                                          <span className="text-sm">
                                            {budgetSummary.category_name}
                                          </span>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-4 w-4 p-0 hover:bg-muted/50"
                                            onClick={() =>
                                              onOpenCategoryModal(budgetSummary)
                                            }
                                          >
                                            <HelpCircle className="h-3 w-3 text-muted-foreground" />
                                          </Button>
                                        </div>
                                      </td>
                                      <td className="text-right py-2 px-4 text-sm">
                                        {formatCurrency(totalBudget)}
                                      </td>
                                      <td className="text-right py-2 px-4 text-sm">
                                        {formatCurrency(spent)}
                                      </td>
                                      <td
                                        className={`text-right py-2 px-4 text-sm font-medium ${
                                          overUnder < 0
                                            ? "text-red-600"
                                            : "text-green-600"
                                        }`}
                                      >
                                        {formatCurrency(Math.abs(overUnder))}
                                      </td>
                                      <td className="text-right py-2 px-4">
                                        <div className="flex items-center justify-end space-x-2">
                                          <div
                                            className={`w-12 rounded-full h-1.5 ${
                                              percentage === 0
                                                ? "bg-gray-600"
                                                : "bg-gray-200"
                                            }`}
                                          >
                                            <div
                                              className={`h-1.5 rounded-full transition-all duration-300 ${
                                                percentage > 100
                                                  ? "bg-red-500"
                                                  : percentage >=
                                                    yellowThreshold
                                                  ? "bg-yellow-500"
                                                  : percentage > 0
                                                  ? "bg-green-500"
                                                  : "bg-gray-600"
                                              }`}
                                              style={{
                                                width: `${Math.min(
                                                  percentage,
                                                  100
                                                )}%`,
                                              }}
                                            />
                                          </div>
                                          <span className="text-xs w-10 text-right">
                                            {percentage.toFixed(1)}%
                                          </span>
                                        </div>
                                      </td>
                                      <td className="text-center py-2 px-4">
                                        <div className="flex justify-center space-x-1">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                              onEditBudget({
                                                id: budgetSummary.budget_id!,
                                                category_id:
                                                  budgetSummary.category_id,
                                                year: selectedMonth.year,
                                                month: selectedMonth.month,
                                                budget_type:
                                                  budgetSummary.budget_type!,
                                                absolute_amount:
                                                  budgetSummary.absolute_amount,
                                                user1_amount:
                                                  budgetSummary.user1_amount,
                                                user2_amount:
                                                  budgetSummary.user2_amount,
                                              });
                                            }}
                                            className="h-8 px-3"
                                          >
                                            <Edit className="h-3 w-3" />
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() =>
                                              onDeleteBudget(
                                                budgetSummary.category_id
                                              )
                                            }
                                            className="h-8 px-3 text-red-600 hover:text-red-700"
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
                                            onCreateBudget(category)
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
                  )
                )}

              {/* Unassigned Categories - sorted by percentage used */}
              {(() => {
                const unassignedCategories = getUnassignedCategories(
                  sectors,
                  categories
                );
                const unassignedBudgets = getUnassignedBudgetSummaries(
                  sectors,
                  categories,
                  budgetSummaries
                );

                if (unassignedCategories.length === 0) return null;

                // Calculate totals for unassigned categories
                const totalBudget = unassignedBudgets.reduce((sum, budget) => {
                  const budgetAmount =
                    budget.budget_type === "absolute"
                      ? budget.absolute_amount || 0
                      : (budget.user1_amount || 0) + (budget.user2_amount || 0);
                  return sum + budgetAmount;
                }, 0);
                const totalSpent = unassignedBudgets.reduce(
                  (sum, budget) => sum + (budget.current_period_spent || 0),
                  0
                );
                const totalOverUnder = totalBudget - totalSpent;
                const totalPercentage =
                  totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

                return (
                  <React.Fragment>
                    {/* Unassigned Categories Header */}
                    <tr className="bg-muted/30 hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold">
                            Other Categories
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({unassignedCategories.length} unassigned)
                          </span>
                        </div>
                      </td>
                      <td className="text-right py-3 px-4 font-medium">
                        {formatCurrency(totalBudget)}
                      </td>
                      <td className="text-right py-3 px-4">
                        {formatCurrency(totalSpent)}
                      </td>
                      <td className="text-right py-3 px-4">
                        <span
                          className={`font-medium ${
                            totalOverUnder < 0
                              ? "text-red-600"
                              : "text-green-600"
                          }`}
                        >
                          {formatCurrency(Math.abs(totalOverUnder))}
                        </span>
                      </td>
                      <td className="text-right py-3 px-4">
                        <div className="flex items-center justify-end space-x-2">
                          <div
                            className={`w-16 rounded-full h-2 ${
                              totalPercentage === 0
                                ? "bg-gray-600"
                                : "bg-gray-200"
                            }`}
                          >
                            <div
                              className={`h-2 rounded-full transition-all duration-300 ${
                                totalPercentage > 100
                                  ? "bg-red-500"
                                  : totalPercentage >= yellowThreshold
                                  ? "bg-yellow-500"
                                  : totalPercentage > 0
                                  ? "bg-green-500"
                                  : "bg-gray-600"
                              }`}
                              style={{
                                width: `${Math.min(totalPercentage, 100)}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs w-12 text-right">
                            {totalPercentage.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="text-center py-3 px-4">
                        {/* Removed action buttons from header */}
                      </td>
                      <td className="text-center py-3 px-4">
                        {/* No actions for unassigned categories header */}
                      </td>
                    </tr>

                    {/* Unassigned Category Rows - sorted by percentage used */}
                    {unassignedBudgets
                      .map((budgetSummary) => {
                        const totalBudget =
                          budgetSummary.budget_type === "absolute"
                            ? budgetSummary.absolute_amount || 0
                            : (budgetSummary.user1_amount || 0) +
                              (budgetSummary.user2_amount || 0);
                        const spent = budgetSummary.current_period_spent || 0;
                        const overUnder = totalBudget - spent;
                        const percentage =
                          totalBudget > 0 ? (spent / totalBudget) * 100 : 0;

                        return {
                          budgetSummary,
                          totalBudget,
                          spent,
                          overUnder,
                          percentage,
                        };
                      })
                      .sort((a, b) => b.percentage - a.percentage)
                      .map(
                        ({
                          budgetSummary,
                          totalBudget,
                          spent,
                          overUnder,
                          percentage,
                        }) => (
                          <tr
                            key={budgetSummary.category_id}
                            className="hover:bg-muted/20"
                          >
                            <td className="py-2 px-4 pl-12">
                              <div className="flex items-center space-x-2">
                                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                                  {budgetSummary.category_image ? (
                                    <img
                                      src={budgetSummary.category_image}
                                      alt={budgetSummary.category_name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-4 h-4 bg-muted-foreground rounded-full"></div>
                                  )}
                                </div>
                                <span className="text-sm">
                                  {budgetSummary.category_name}
                                </span>
                              </div>
                            </td>
                            <td className="text-right py-2 px-4 text-sm">
                              {formatCurrency(totalBudget)}
                            </td>
                            <td className="text-right py-2 px-4 text-sm">
                              {formatCurrency(spent)}
                            </td>
                            <td
                              className={`text-right py-2 px-4 text-sm font-medium ${
                                overUnder < 0
                                  ? "text-red-600"
                                  : "text-green-600"
                              }`}
                            >
                              {formatCurrency(Math.abs(overUnder))}
                            </td>
                            <td className="text-right py-2 px-4">
                              <div className="flex items-center justify-end space-x-2">
                                <div className="w-12 bg-gray-200 rounded-full h-1.5">
                                  <div
                                    className={`h-1.5 rounded-full transition-all duration-300 ${
                                      percentage > 100
                                        ? "bg-red-500"
                                        : percentage >= yellowThreshold
                                        ? "bg-yellow-500"
                                        : "bg-green-500"
                                    }`}
                                    style={{
                                      width: `${Math.min(percentage, 100)}%`,
                                    }}
                                  />
                                </div>
                                <span className="text-xs w-10 text-right">
                                  {percentage.toFixed(1)}%
                                </span>
                              </div>
                            </td>
                            <td className="text-center py-2 px-4">
                              <div className="flex justify-center space-x-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => onEditBudget(budgetSummary)}
                                  className="h-8 px-3"
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    onDeleteBudget(budgetSummary.category_id)
                                  }
                                  className="h-8 px-3 text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )
                      )}
                  </React.Fragment>
                );
              })()}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
