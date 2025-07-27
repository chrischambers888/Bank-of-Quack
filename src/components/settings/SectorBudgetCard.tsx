import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Edit,
  Trash2,
  TrendingUp,
  AlertTriangle,
  DollarSign,
} from "lucide-react";
import { SectorBudgetSummary, SelectedMonth } from "@/types";
import { useAppData } from "@/hooks/useAppData";

interface SectorBudgetCardProps {
  sectorBudgetSummary: SectorBudgetSummary;
  onEdit: (sectorBudgetSummary: SectorBudgetSummary) => void;
  onDelete: (sectorId: string) => void;
  selectedMonth: SelectedMonth;
}

export function SectorBudgetCard({
  sectorBudgetSummary,
  onEdit,
  onDelete,
  selectedMonth,
}: SectorBudgetCardProps) {
  const { userNames } = useAppData();
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
    const percentage = getProgressPercentage();
    // For zero budgets, any spending should be red
    if (current_period_budget === 0 && (current_period_spent || 0) > 0)
      return "bg-red-500";
    if (percentage >= 90) return "bg-red-500";
    if (percentage >= 75) return "bg-yellow-500";
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
    // Only check for manual budgets, auto-rollup budgets always match
    return !auto_rollup && getBudgetAmount() < category_budgets_total;
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">
            {sector_name}
          </CardTitle>
          <div className="flex items-center space-x-2">
            {auto_rollup && (
              <Badge variant="secondary" className="text-xs">
                Auto Rollup
              </Badge>
            )}
            <div className="flex space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(sectorBudgetSummary)}
                className="h-8 w-8 p-0"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(sector_id)}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Budget Amount */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Sector Budget</span>
          </div>
          <div className="text-right">
            <div className="font-semibold">${getBudgetAmount().toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">
              {budget_type === "absolute" ? "Absolute" : "Split"}
            </div>
          </div>
        </div>

        {/* Category Budgets Total - Only show for manual budgets */}
        {!auto_rollup && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Category Budgets
            </span>
            <div className="text-right">
              <div className="font-semibold">
                ${category_budgets_total.toFixed(2)}
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
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">
                  ${current_period_spent?.toFixed(2) || "0.00"} / $
                  {current_period_budget.toFixed(2)}
                </span>
              </div>
              <Progress value={getProgressPercentage()} className="h-2" />
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {getProgressPercentage().toFixed(1)}% used
                </span>
                <div
                  className={`flex items-center space-x-1 ${getRemainingColor()}`}
                >
                  {isOverBudget() ? (
                    <AlertTriangle className="h-3 w-3" />
                  ) : (
                    <TrendingUp className="h-3 w-3" />
                  )}
                  <span>
                    ${Math.abs(getRemainingAmount()).toFixed(2)}{" "}
                    {isOverBudget() ? "over" : "remaining"}
                  </span>
                </div>
              </div>
            </div>
          )}

        {/* Split Budget Details */}
        {budget_type === "split" && (
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{userNames[0]}</span>
              <span className="font-medium">
                ${user1_amount?.toFixed(2) || "0.00"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{userNames[1]}</span>
              <span className="font-medium">
                ${user2_amount?.toFixed(2) || "0.00"}
              </span>
            </div>
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
      </CardContent>
    </Card>
  );
}
