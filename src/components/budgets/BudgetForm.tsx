import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import {
  Category,
  BudgetFormData,
  CategoryBudget,
  YearlyCategoryBudget,
} from "@/types";
import { supabase } from "@/supabaseClient";

interface BudgetFormProps {
  category: Category;
  existingBudget?: CategoryBudget | YearlyCategoryBudget;
  selectedMonth?: { year: number; month: number };
  onSave: () => void;
  onCancel: () => void;
  isYearly?: boolean;
  sectorBudgets?: Array<{
    sector_id: string;
    sector_name: string;
    budget_type: "absolute" | "split";
    absolute_amount?: number;
    user1_amount?: number;
    user2_amount?: number;
    auto_rollup: boolean;
    category_ids: string[];
  }>;
  currentBudgets?: Array<{
    category_id: string;
    budget_type: "absolute" | "split";
    absolute_amount?: number;
    user1_amount?: number;
    user2_amount?: number;
  }>;
}

export function BudgetForm({
  category,
  existingBudget,
  selectedMonth,
  onSave,
  onCancel,
  isYearly = false,
  sectorBudgets = [],
  currentBudgets = [],
}: BudgetFormProps) {
  const [formData, setFormData] = useState<BudgetFormData>({
    category_id: category.id,
    budget_type: "absolute",
    absolute_amount: undefined,
    user1_amount: undefined,
    user2_amount: undefined,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userNames, setUserNames] = useState({
    user1: "User 1",
    user2: "User 2",
  });

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

  useEffect(() => {
    if (existingBudget) {
      setFormData({
        category_id: existingBudget.category_id,
        budget_type: existingBudget.budget_type,
        absolute_amount: existingBudget.absolute_amount,
        user1_amount: existingBudget.user1_amount,
        user2_amount: existingBudget.user2_amount,
      });
    }
  }, [existingBudget]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null); // Clear any previous errors

    // Pre-validate sector budget constraints
    const sectorConstraintError = validateSectorBudgetConstraints();
    if (sectorConstraintError) {
      setError(sectorConstraintError);
      setIsLoading(false);
      return;
    }

    // Allow $0 budgets - they are valid
    const totalAmount = getTotalAmount();
    if (totalAmount < 0) {
      setError("Budget amount cannot be negative.");
      setIsLoading(false);
      return;
    }

    try {
      if (existingBudget) {
        // Validate existingBudget has required fields
        if (!existingBudget.id || !existingBudget.category_id) {
          throw new Error(
            "Invalid budget data. Please try refreshing the page."
          );
        }

        // Update existing budget
        if (isYearly) {
          // Use direct SQL update for yearly budgets too
          const { error } = await supabase
            .from("yearly_category_budgets")
            .update({
              budget_type: formData.budget_type,
              absolute_amount:
                formData.budget_type === "absolute"
                  ? formData.absolute_amount
                  : null,
              user1_amount:
                formData.budget_type === "split" ? formData.user1_amount : null,
              user2_amount:
                formData.budget_type === "split" ? formData.user2_amount : null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingBudget.id);
          if (error) throw error;
        } else {
          // Ensure we have a valid budget ID
          if (!existingBudget.id) {
            throw new Error(
              "Budget ID is missing. Please try refreshing the page."
            );
          }

          // Use direct SQL update instead of RPC function to avoid parameter issues
          const { error } = await supabase
            .from("category_budgets")
            .update({
              budget_type: formData.budget_type,
              absolute_amount:
                formData.budget_type === "absolute"
                  ? formData.absolute_amount
                  : null,
              user1_amount:
                formData.budget_type === "split" ? formData.user1_amount : null,
              user2_amount:
                formData.budget_type === "split" ? formData.user2_amount : null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingBudget.id);
          if (error) throw error;
        }
      } else {
        // Create new budget
        const currentDate = new Date();
        const year = selectedMonth?.year || currentDate.getFullYear();
        const month = selectedMonth?.month || currentDate.getMonth() + 1;

        if (isYearly) {
          const { error } = await supabase.rpc(
            "create_yearly_budget_for_category",
            {
              p_category_id: formData.category_id,
              p_year: year,
              p_budget_type: formData.budget_type,
              p_absolute_amount:
                formData.budget_type === "absolute"
                  ? formData.absolute_amount
                  : null,
              p_user1_amount:
                formData.budget_type === "split" ? formData.user1_amount : null,
              p_user2_amount:
                formData.budget_type === "split" ? formData.user2_amount : null,
            }
          );
          if (error) throw error;
        } else {
          const { error } = await supabase.rpc("create_budget_for_month", {
            p_category_id: formData.category_id,
            p_year: year,
            p_month: month,
            p_budget_type: formData.budget_type,
            p_absolute_amount:
              formData.budget_type === "absolute"
                ? formData.absolute_amount
                : null,
            p_user1_amount:
              formData.budget_type === "split" ? formData.user1_amount : null,
            p_user2_amount:
              formData.budget_type === "split" ? formData.user2_amount : null,
          });
          if (error) throw error;
        }
      }

      onSave();
    } catch (error) {
      console.error("Error saving budget:", error);
      let errorMessage = "Error saving budget. Please try again.";

      if (error instanceof Error) {
        // Check for the specific constraint error
        if (
          error.message.includes(
            "cannot be less than the sum of category budgets"
          )
        ) {
          errorMessage = `Category budget amount cannot exceed the sector budget limit. Please reduce the budget amount or increase the sector budget.`;
        } else {
          errorMessage = `Error saving budget: ${error.message}`;
        }
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = () => {
    if (formData.budget_type === "absolute") {
      return (
        formData.absolute_amount !== undefined && formData.absolute_amount >= 0
      );
    } else {
      return (
        formData.user1_amount !== undefined &&
        formData.user1_amount >= 0 &&
        formData.user2_amount !== undefined &&
        formData.user2_amount >= 0
      );
    }
  };

  const getTotalAmount = () => {
    if (formData.budget_type === "absolute") {
      return formData.absolute_amount || 0;
    } else {
      return (formData.user1_amount || 0) + (formData.user2_amount || 0);
    }
  };

  const validateSectorBudgetConstraints = () => {
    const newBudgetAmount = getTotalAmount();

    // Find sectors that contain this category and have manual budgets (not auto-rollup)
    // Only validate against sectors that actually have budget records (sectorBudgets only includes sectors with budgets)
    const relevantSectors = sectorBudgets.filter(
      (sector) =>
        sector.category_ids.includes(category.id) && !sector.auto_rollup
    );

    for (const sector of relevantSectors) {
      const sectorBudgetAmount =
        sector.budget_type === "absolute"
          ? sector.absolute_amount || 0
          : (sector.user1_amount || 0) + (sector.user2_amount || 0);

      // Calculate current category budgets total for this sector
      const currentCategoryBudgetsTotal = currentBudgets
        .filter(
          (budget) =>
            sector.category_ids.includes(budget.category_id) &&
            budget.category_id !== category.id // Exclude current category if editing
        )
        .reduce((total, budget) => {
          const budgetAmount =
            budget.budget_type === "absolute"
              ? budget.absolute_amount || 0
              : (budget.user1_amount || 0) + (budget.user2_amount || 0);
          return total + budgetAmount;
        }, 0);

      const totalAfterNewBudget = currentCategoryBudgetsTotal + newBudgetAmount;

      if (totalAfterNewBudget > sectorBudgetAmount) {
        return `Adding this budget would exceed the sector budget limit for "${
          sector.sector_name
        }" ($${sectorBudgetAmount.toFixed(
          2
        )}). Please reduce the budget amount or increase the sector budget.`;
      }
    }

    return null;
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Budget for {category.name}</CardTitle>
        <CardDescription>
          Configure monthly budget for this category
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md">
              <div className="flex items-center space-x-2">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-red-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="text-sm text-red-400">{error}</div>
              </div>
            </div>
          )}
          {/* Budget Type Toggle */}
          <div className="space-y-2">
            <Label>Budget Type</Label>
            <ToggleGroup
              type="single"
              value={formData.budget_type}
              onValueChange={(value) => {
                if (value) {
                  setFormData((prev) => ({
                    ...prev,
                    budget_type: value as "absolute" | "split",
                    absolute_amount: undefined,
                    user1_amount: undefined,
                    user2_amount: undefined,
                  }));
                }
              }}
              className="w-full"
            >
              <ToggleGroupItem value="absolute" className="flex-1">
                Absolute
              </ToggleGroupItem>
              <ToggleGroupItem value="split" className="flex-1">
                Split
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Budget Amount Fields */}
          {formData.budget_type === "absolute" ? (
            <div className="space-y-2">
              <Label htmlFor="absolute_amount">Monthly Budget Amount</Label>
              <Input
                id="absolute_amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={
                  formData.absolute_amount !== undefined
                    ? formData.absolute_amount
                    : ""
                }
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    absolute_amount:
                      e.target.value !== ""
                        ? parseFloat(e.target.value)
                        : undefined,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Enter 0 to set a zero budget (no spending allowed)
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="user1_amount">{userNames.user1}'s Amount</Label>
                <Input
                  id="user1_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={
                    formData.user1_amount !== undefined
                      ? formData.user1_amount
                      : ""
                  }
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      user1_amount:
                        e.target.value !== ""
                          ? parseFloat(e.target.value)
                          : undefined,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user2_amount">{userNames.user2}'s Amount</Label>
                <Input
                  id="user2_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={
                    formData.user2_amount !== undefined
                      ? formData.user2_amount
                      : ""
                  }
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      user2_amount:
                        e.target.value !== ""
                          ? parseFloat(e.target.value)
                          : undefined,
                    }))
                  }
                />
              </div>
              {formData.user1_amount !== undefined &&
                formData.user2_amount !== undefined && (
                  <>
                    <div className="text-sm text-muted-foreground">
                      Total: $
                      {(
                        (formData.user1_amount || 0) +
                        (formData.user2_amount || 0)
                      ).toFixed(2)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Enter 0 for both users to set a zero budget (no spending
                      allowed)
                    </p>
                  </>
                )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !validateForm()}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : existingBudget ? (
                "Update Budget"
              ) : (
                "Create Budget"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
