import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Category,
  YearlyBudgetSummary,
  YearlySectorBudgetSummary,
} from "@/types";
import {
  Plus,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  PieChart,
  CalendarDays,
} from "lucide-react";

interface YearlyBudgetDisplayProps {
  yearlyBudgetSummaries: YearlyBudgetSummary[];
  yearlySectorBudgetSummaries: YearlySectorBudgetSummary[];
  selectedYear: number;
  selectedMonthForProgress: number;
  categories: Category[];
  onEditYearlyBudget?: (budget: YearlyBudgetSummary) => void;
  onDeleteYearlyBudget?: (categoryId: string) => void;
  onEditYearlySectorBudget?: (sectorBudget: YearlySectorBudgetSummary) => void;
  onDeleteYearlySectorBudget?: (sectorId: string) => void;
  onDeleteYearlySectorBudgetDirect?: (
    sectorId: string,
    deleteCategoryBudgets?: boolean
  ) => Promise<void>;
  onCreateYearlyBudget?: (category: Category) => void;
  onCreateYearlySectorBudget?: (sector: any) => void;
}

export function YearlyBudgetDisplay({
  yearlyBudgetSummaries,
  yearlySectorBudgetSummaries,
  selectedYear,
  selectedMonthForProgress,
  categories,
  onEditYearlyBudget,
  onDeleteYearlyBudget,
  onEditYearlySectorBudget,
  onDeleteYearlySectorBudget,
  onDeleteYearlySectorBudgetDirect,
  onCreateYearlyBudget,
  onCreateYearlySectorBudget,
}: YearlyBudgetDisplayProps) {
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

  return (
    <div className="space-y-6">
      {/* Yearly Budget Overview */}
      <Card className="border border-white/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Yearly Budgets - {selectedYear}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Progress through {getMonthName(selectedMonthForProgress)}{" "}
            {selectedYear}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Yearly Budget Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-card/50 rounded-lg p-4 border border-border">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-green-500" />
                <span className="text-sm text-muted-foreground">
                  Total Budget
                </span>
              </div>
              <div className="text-2xl font-bold">
                $
                {yearlyBudgetSummaries
                  .reduce((sum, budget) => {
                    const budgetAmount =
                      budget.budget_type === "absolute"
                        ? budget.absolute_amount || 0
                        : (budget.user1_amount || 0) +
                          (budget.user2_amount || 0);
                    return sum + budgetAmount;
                  }, 0)
                  .toFixed(2)}
              </div>
            </div>
            <div className="bg-card/50 rounded-lg p-4 border border-border">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-muted-foreground">Spent</span>
              </div>
              <div className="text-2xl font-bold">
                $
                {yearlyBudgetSummaries
                  .reduce(
                    (sum, budget) => sum + (budget.current_period_spent || 0),
                    0
                  )
                  .toFixed(2)}
              </div>
            </div>
            <div className="bg-card/50 rounded-lg p-4 border border-border">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <span className="text-sm text-muted-foreground">Remaining</span>
              </div>
              <div className="text-2xl font-bold">
                $
                {yearlyBudgetSummaries
                  .reduce(
                    (sum, budget) =>
                      sum + (budget.current_period_remaining_amount || 0),
                    0
                  )
                  .toFixed(2)}
              </div>
            </div>
            <div className="bg-card/50 rounded-lg p-4 border border-border">
              <div className="flex items-center gap-2 mb-2">
                <PieChart className="h-4 w-4 text-purple-500" />
                <span className="text-sm text-muted-foreground">Progress</span>
              </div>
              <div className="text-2xl font-bold">
                {(() => {
                  const totalBudget = yearlyBudgetSummaries.reduce(
                    (sum, budget) => {
                      const budgetAmount =
                        budget.budget_type === "absolute"
                          ? budget.absolute_amount || 0
                          : (budget.user1_amount || 0) +
                            (budget.user2_amount || 0);
                      return sum + budgetAmount;
                    },
                    0
                  );
                  const totalSpent = yearlyBudgetSummaries.reduce(
                    (sum, budget) => sum + (budget.current_period_spent || 0),
                    0
                  );
                  return totalBudget > 0
                    ? ((totalSpent / totalBudget) * 100).toFixed(1)
                    : "0.0";
                })()}
                %
              </div>
            </div>
          </div>

          {/* Yearly Budget Categories */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Category Budgets</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {yearlyBudgetSummaries.map((budgetSummary) => {
                const category = categories.find(
                  (c) => c.id === budgetSummary.category_id
                );
                if (!category) return null;

                return (
                  <Card
                    key={budgetSummary.category_id}
                    className="border border-white/20"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        {category.image_url && (
                          <img
                            src={category.image_url}
                            alt={category.name}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-sm truncate">
                            {category.name}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground">
                            {budgetSummary.budget_type === "absolute"
                              ? "Absolute"
                              : "Split"}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Budget:</span>
                          <span className="font-medium">
                            $
                            {budgetSummary.current_period_budget?.toFixed(2) ||
                              "0.00"}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Spent:</span>
                          <span className="font-medium">
                            $
                            {budgetSummary.current_period_spent?.toFixed(2) ||
                              "0.00"}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Remaining:</span>
                          <span className="font-medium">
                            $
                            {budgetSummary.current_period_remaining_amount?.toFixed(
                              2
                            ) || "0.00"}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Progress:</span>
                          <span className="font-medium">
                            {budgetSummary.current_period_remaining_percentage?.toFixed(
                              1
                            ) || "0.0"}
                            %
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4">
                        {onEditYearlyBudget && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onEditYearlyBudget(budgetSummary)}
                            className="flex-1"
                          >
                            Edit
                          </Button>
                        )}
                        {onDeleteYearlyBudget && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              onDeleteYearlyBudget(budgetSummary.category_id)
                            }
                            className="text-red-500 hover:text-red-400"
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Create New Yearly Budget Button */}
            {onCreateYearlyBudget && categories.length > 0 && (
              <div className="mt-6">
                <Button
                  onClick={() => onCreateYearlyBudget(categories[0])}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Yearly Budget
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
