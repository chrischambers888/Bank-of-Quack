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
  const [formData, setFormData] = useState<SectorBudgetFormData>({
    sector_id: sector.id,
    budget_type: "absolute",
    absolute_amount: 0,
    user1_amount: 0,
    user2_amount: 0,
    auto_rollup: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (existingBudget) {
      setFormData({
        sector_id: existingBudget.sector_id,
        budget_type: existingBudget.budget_type,
        absolute_amount: existingBudget.absolute_amount || 0,
        user1_amount: existingBudget.user1_amount || 0,
        user2_amount: existingBudget.user2_amount || 0,
        auto_rollup: existingBudget.auto_rollup,
      });
    }
  }, [existingBudget]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

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
      if (error instanceof Error) {
        alert(`Error saving sector budget: ${error.message}`);
      } else {
        alert("Error saving sector budget. Please try again.");
      }
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
