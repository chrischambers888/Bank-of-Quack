import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BudgetSummary, CategoryBudget } from "@/types";
import { Edit, Trash2 } from "lucide-react";

interface BudgetCardProps {
  budgetSummary: BudgetSummary;
  onEdit: (budget: CategoryBudget) => void;
  onDelete: (budgetId: string) => void;
  onToggleActive?: (budgetId: string, isActive: boolean) => void;
}

export function BudgetCard({
  budgetSummary,
  onEdit,
  onDelete,
  onToggleActive,
}: BudgetCardProps) {
  const {
    category_name,
    category_image,
    budget_type,
    absolute_amount,
    user1_amount,
    user2_amount,
    current_period_budget,
    current_period_spent,
    current_period_user1_spent,
    current_period_user2_spent,
    current_period_remaining_percentage,
    current_period_remaining_amount,
  } = budgetSummary;

  const hasBudget =
    budget_type && (absolute_amount || (user1_amount && user2_amount));
  const totalBudget =
    budget_type === "absolute"
      ? absolute_amount
      : (user1_amount || 0) + (user2_amount || 0);
  const spentPercentage =
    totalBudget && current_period_spent
      ? Math.min((current_period_spent / totalBudget) * 100, 100)
      : 0;

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return "bg-red-500";
    if (percentage >= 75) return "bg-yellow-500";
    return "bg-green-500";
  };

  const formatCurrency = (amount: number | undefined) => {
    return amount !== undefined ? `$${amount.toFixed(2)}` : "$0.00";
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {category_image && (
              <img
                src={category_image}
                alt={category_name}
                className="w-8 h-8 rounded-full object-cover"
              />
            )}
            <div>
              <CardTitle className="text-lg">{category_name}</CardTitle>
              <CardDescription>
                {budget_type === "absolute"
                  ? "Absolute Budget"
                  : "Split Budget"}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                onEdit({
                  id: budgetSummary.budget_id!,
                  category_id: budgetSummary.category_id,
                  budget_type: budget_type!,
                  absolute_amount,
                  user1_amount,
                  user2_amount,
                })
              }
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(budgetSummary.budget_id!)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Budget Configuration */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Monthly Budget:</span>
            <span className="font-medium">{formatCurrency(totalBudget)}</span>
          </div>

          {budget_type === "split" && (
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>User 1:</span>
                <span>{formatCurrency(user1_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span>User 2:</span>
                <span>{formatCurrency(user2_amount)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Current Period Progress */}
        {hasBudget && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">This Month:</span>
              <span className="font-medium">
                {formatCurrency(current_period_spent)} /{" "}
                {formatCurrency(totalBudget)}
              </span>
            </div>

            <Progress value={spentPercentage} className="h-2" />

            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">
                {totalBudget && current_period_spent !== undefined
                  ? `${(100 - spentPercentage).toFixed(1)}% remaining`
                  : "No spending data"}
              </span>
              <span
                className={getProgressColor(spentPercentage).replace(
                  "bg-",
                  "text-"
                )}
              >
                {formatCurrency(
                  totalBudget ? totalBudget - (current_period_spent || 0) : 0
                )}
              </span>
            </div>

            {/* User Spending Breakdown */}
            {budget_type === "split" && (
              <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                <div className="flex justify-between">
                  <span>User 1 spent:</span>
                  <span>{formatCurrency(current_period_user1_spent)}</span>
                </div>
                <div className="flex justify-between">
                  <span>User 2 spent:</span>
                  <span>{formatCurrency(current_period_user2_spent)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
