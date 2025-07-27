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
} from "lucide-react";
import { SectorBudgetSummary, SelectedMonth } from "@/types";
import { useBudgetSettings } from "@/hooks/useBudgetSettings";
import { supabase } from "@/supabaseClient";

interface SectorBudgetCardProps {
  sectorBudgetSummary: SectorBudgetSummary;
  onEdit: (sectorBudgetSummary: SectorBudgetSummary) => void;
  onDelete: (sectorId: string) => void;
  selectedMonth: SelectedMonth;
  user1AvatarUrl?: string | null;
  user2AvatarUrl?: string | null;
}

export function SectorBudgetCard({
  sectorBudgetSummary,
  onEdit,
  onDelete,
  selectedMonth,
  user1AvatarUrl,
  user2AvatarUrl,
}: SectorBudgetCardProps) {
  const [userNames, setUserNames] = useState({
    user1: "User 1",
    user2: "User 2",
  });
  const { yellowThreshold, redThreshold } = useBudgetSettings();

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
    if (percentage >= redThreshold) return "bg-red-500";
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

  const formatCurrency = (amount: number | null | undefined) => {
    return amount != null ? `$${amount.toFixed(2)}` : "$0.00";
  };

  const getMonthName = () => {
    if (!selectedMonth) return "Current Month";
    const date = new Date(selectedMonth.year, selectedMonth.month - 1, 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">
            {sector_name}
          </CardTitle>
          <div className="flex items-center space-x-2">
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
          {auto_rollup && (
            <Badge
              variant="secondary"
              className="bg-green-500/20 text-green-600"
            >
              Auto Rollup
            </Badge>
          )}
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
                <span className="text-muted-foreground">{getMonthName()}:</span>
                <span className="font-medium">
                  {formatCurrency(current_period_spent)} /{" "}
                  {formatCurrency(current_period_budget)}
                </span>
              </div>
              <CustomProgress
                value={getProgressPercentage()}
                className="h-4"
                backgroundColor={
                  (current_period_budget === 0 &&
                    (current_period_spent || 0) > 0) ||
                  getProgressPercentage() >= redThreshold
                    ? "rgb(239 68 68)"
                    : undefined
                }
                indicatorColor={
                  (current_period_budget === 0 &&
                    (current_period_spent || 0) > 0) ||
                  getProgressPercentage() >= redThreshold
                    ? "rgb(239 68 68)"
                    : getProgressPercentage() >= yellowThreshold
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
                  {formatCurrency(
                    current_period_budget === 0
                      ? -(current_period_spent || 0) // Show negative amount for zero budgets
                      : current_period_budget
                      ? current_period_budget - (current_period_spent || 0)
                      : 0
                  )}
                </span>
              </div>

              {/* User Spending Breakdown */}
              {(budget_type === "split" || budget_type === "absolute") && (
                <div className="text-xs text-muted-foreground space-y-1 pt-2">
                  <div className="flex justify-between items-center">
                    <span>
                      {userNames.user1}:{" "}
                      {formatCurrency(current_period_user1_spent)}
                      {budget_type === "split" &&
                        ` / ${formatCurrency(user1_amount)}`}
                    </span>
                    <span>
                      {userNames.user2}:{" "}
                      {formatCurrency(current_period_user2_spent)}
                      {budget_type === "split" &&
                        ` / ${formatCurrency(user2_amount)}`}
                    </span>
                  </div>
                  <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
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
                            alt={`${userNames.user1} avatar`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs text-white font-bold">
                            {userNames.user1.charAt(0).toUpperCase()}
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
                            alt={`${userNames.user2} avatar`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs text-white font-bold">
                            {userNames.user2.charAt(0).toUpperCase()}
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
      </CardContent>
    </Card>
  );
}
