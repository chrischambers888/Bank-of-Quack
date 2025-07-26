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
import { Category, BudgetFormData, CategoryBudget } from "@/types";
import { supabase } from "@/supabaseClient";

interface BudgetFormProps {
  category: Category;
  existingBudget?: CategoryBudget;
  selectedMonth?: { year: number; month: number };
  onSave: () => void;
  onCancel: () => void;
}

export function BudgetForm({
  category,
  existingBudget,
  selectedMonth,
  onSave,
  onCancel,
}: BudgetFormProps) {
  const [formData, setFormData] = useState<BudgetFormData>({
    category_id: category.id,
    budget_type: "absolute",
    absolute_amount: undefined,
    user1_amount: undefined,
    user2_amount: undefined,
  });

  const [isLoading, setIsLoading] = useState(false);
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

    try {
      if (existingBudget) {
        // Update existing budget
        const { error } = await supabase.rpc("update_budget_for_month", {
          p_budget_id: existingBudget.id,
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
      } else {
        // Create new budget for the selected month
        const currentDate = new Date();
        const year = selectedMonth?.year || currentDate.getFullYear();
        const month = selectedMonth?.month || currentDate.getMonth() + 1;

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

      onSave();
    } catch (error) {
      console.error("Error saving budget:", error);
      // Provide more specific error messages
      if (error instanceof Error) {
        alert(`Error saving budget: ${error.message}`);
      } else {
        alert("Error saving budget. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = () => {
    if (formData.budget_type === "absolute") {
      return formData.absolute_amount && formData.absolute_amount > 0;
    } else {
      return (
        formData.user1_amount !== undefined &&
        formData.user1_amount >= 0 &&
        formData.user2_amount !== undefined &&
        formData.user2_amount >= 0 &&
        (formData.user1_amount > 0 || formData.user2_amount > 0)
      );
    }
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
                value={formData.absolute_amount || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    absolute_amount: e.target.value
                      ? parseFloat(e.target.value)
                      : undefined,
                  }))
                }
                required
              />
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
                  value={formData.user1_amount || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      user1_amount: e.target.value
                        ? parseFloat(e.target.value)
                        : undefined,
                    }))
                  }
                  required
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
                  value={formData.user2_amount || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      user2_amount: e.target.value
                        ? parseFloat(e.target.value)
                        : undefined,
                    }))
                  }
                  required
                />
              </div>
              {formData.user1_amount !== undefined &&
                formData.user2_amount !== undefined && (
                  <div className="text-sm text-muted-foreground">
                    Total: $
                    {(
                      (formData.user1_amount || 0) +
                      (formData.user2_amount || 0)
                    ).toFixed(2)}
                  </div>
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
              {isLoading
                ? "Saving..."
                : existingBudget
                ? "Update Budget"
                : "Create Budget"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
