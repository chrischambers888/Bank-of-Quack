import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sector,
  SectorBudget,
  SectorBudgetFormData,
  SelectedMonth,
} from "@/types";
import { supabase } from "@/supabaseClient";
import { useAppData } from "@/hooks/useAppData";

interface SectorBudgetFormProps {
  sector: Sector;
  existingBudget?: SectorBudget;
  selectedMonth: SelectedMonth;
  onSave: () => void;
  onCancel: () => void;
  categoryBudgetsTotal?: number; // Add this to get the sum of category budgets
}

export function SectorBudgetForm({
  sector,
  existingBudget,
  selectedMonth,
  onSave,
  onCancel,
  categoryBudgetsTotal = 0,
}: SectorBudgetFormProps) {
  const { userNames } = useAppData();
  const [formData, setFormData] = useState<SectorBudgetFormData>(() => {
    // Initialize with existing budget data if available
    if (existingBudget) {
      return {
        sector_id: existingBudget.sector_id,
        budget_type: existingBudget.budget_type,
        absolute_amount: existingBudget.absolute_amount ?? 0,
        user1_amount: existingBudget.user1_amount ?? 0,
        user2_amount: existingBudget.user2_amount ?? 0,
        auto_rollup: existingBudget.auto_rollup,
      };
    }
    // Default values for new budget
    return {
      sector_id: sector.id,
      budget_type: "absolute",
      absolute_amount: 0,
      user1_amount: 0,
      user2_amount: 0,
      auto_rollup: true,
    };
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null); // Clear any previous errors

    try {
      const { error } = await supabase.rpc("create_sector_budget_for_month", {
        p_sector_id: formData.sector_id,
        p_year: selectedMonth.year,
        p_month: selectedMonth.month,
        p_budget_type: formData.budget_type,
        p_absolute_amount:
          formData.budget_type === "absolute"
            ? formData.auto_rollup
              ? categoryBudgetsTotal
              : formData.absolute_amount
            : null,
        p_user1_amount:
          formData.budget_type === "split" ? formData.user1_amount : null,
        p_user2_amount:
          formData.budget_type === "split" ? formData.user2_amount : null,
        p_auto_rollup: formData.auto_rollup,
      });

      if (error) throw error;
      onSave();
    } catch (error) {
      console.error("Error saving sector budget:", error);

      let errorMessage = "Error saving sector budget. Please try again.";

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === "object" && "message" in error) {
        // Handle Supabase error objects
        const message = error.message as string;

        // Check for the specific constraint error and format it nicely
        if (message.includes("Sector budget amount")) {
          // Extract the actual amounts from the error message
          const match = message.match(
            /Sector budget amount \(\$([^)]+)\) cannot be less than the sum of category budgets \(\$([^)]+)\)/
          );
          if (match) {
            const sectorAmount = match[1];
            const categoryTotal = match[2];
            errorMessage = `Sector budget amount ($${sectorAmount}) cannot be less than the sum of category budgets ($${categoryTotal}). Please increase the budget amount or enable auto-rollup to automatically match the category budgets total.`;
          } else {
            errorMessage = message;
          }
        } else {
          errorMessage = message;
        }
      } else {
        errorMessage = String(error);
      }

      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBudgetTypeChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      budget_type: value as "absolute" | "split",
      absolute_amount: value === "absolute" ? prev.absolute_amount : 0,
      user1_amount: value === "split" ? prev.user1_amount : 0,
      user2_amount: value === "split" ? prev.user2_amount : 0,
      // Auto-rollup must be disabled for split budgets
      auto_rollup: value === "split" ? false : prev.auto_rollup,
    }));
  };

  const getTotalAmount = () => {
    if (formData.budget_type === "absolute") {
      if (formData.auto_rollup) {
        return categoryBudgetsTotal;
      }
      return formData.absolute_amount || 0;
    } else {
      return (formData.user1_amount || 0) + (formData.user2_amount || 0);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Error Display */}
      {error && (
        <div
          key={error}
          className="p-3 bg-red-500/10 border border-red-500/20 rounded-md"
        >
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
      <div className="space-y-2">
        <Label className="text-white">Sector</Label>
        <div className="text-white font-medium">{sector.name}</div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="budget-type" className="text-white">
          Budget Type
        </Label>
        <Select
          value={formData.budget_type}
          onValueChange={handleBudgetTypeChange}
        >
          <SelectTrigger className="bg-card border-border text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="absolute">Absolute Amount</SelectItem>
            <SelectItem value="split">Split Between Users</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {formData.budget_type === "absolute" ? (
        <div className="space-y-2">
          <Label htmlFor="absolute-amount" className="text-white">
            Total Budget Amount
          </Label>
          <Input
            id="absolute-amount"
            type="number"
            step="0.01"
            min="0"
            value={formData.auto_rollup ? "" : formData.absolute_amount || ""}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                absolute_amount: parseFloat(e.target.value) || 0,
              }))
            }
            disabled={formData.auto_rollup}
            className="bg-card border-border text-foreground"
            placeholder={
              formData.auto_rollup
                ? "Auto-calculated from category budgets"
                : "0.00"
            }
          />
          {formData.auto_rollup && (
            <p className="text-xs text-gray-300">
              Amount will be automatically calculated from category budgets in
              this sector
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="user1-amount" className="text-white">
              {userNames[0]} Amount
            </Label>
            <Input
              id="user1-amount"
              type="number"
              step="0.01"
              min="0"
              value={formData.user1_amount || ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  user1_amount: parseFloat(e.target.value) || 0,
                }))
              }
              className="bg-card border-border text-foreground"
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user2-amount" className="text-white">
              {userNames[1]} Amount
            </Label>
            <Input
              id="user2-amount"
              type="number"
              step="0.01"
              min="0"
              value={formData.user2_amount || ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  user2_amount: parseFloat(e.target.value) || 0,
                }))
              }
              className="bg-card border-border text-foreground"
              placeholder="0.00"
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="auto-rollup" className="text-white">
            Auto Rollup
          </Label>
          <Switch
            id="auto-rollup"
            checked={formData.auto_rollup}
            disabled={formData.budget_type === "split"}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({
                ...prev,
                auto_rollup: checked,
                // Clear amount when auto-rollup is enabled
                absolute_amount: checked ? 0 : prev.absolute_amount,
              }))
            }
          />
        </div>
        <p className="text-xs text-gray-300">
          {formData.budget_type === "split"
            ? "Auto-rollup is disabled for split budgets to ensure proper user allocation"
            : "When enabled, category budgets in this sector will automatically roll up into this sector budget"}
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-white">Total Budget</Label>
        <div className="text-2xl font-bold text-white">
          ${getTotalAmount().toFixed(2)}
        </div>
      </div>

      <div className="flex space-x-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1 text-white border-white/20 hover:bg-white/10"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={
            isSubmitting || (!formData.auto_rollup && getTotalAmount() <= 0)
          }
          className="flex-1"
        >
          {isSubmitting
            ? "Saving..."
            : existingBudget
            ? "Update Budget"
            : "Create Budget"}
        </Button>
      </div>
    </form>
  );
}
