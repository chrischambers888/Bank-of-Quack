import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { CustomProgress } from "@/components/ui/custom-progress";
import { supabase } from "@/supabaseClient";
import { Save, Palette } from "lucide-react";

interface BudgetSettingsProps {
  onSave?: () => void;
}

export function BudgetSettings({ onSave }: BudgetSettingsProps) {
  const [yellowThreshold, setYellowThreshold] = useState(75);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const { data: yellowData } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "budget_yellow_threshold")
        .single();

      if (yellowData?.value) {
        setYellowThreshold(parseInt(yellowData.value));
      }
    } catch (error) {
      console.error("Error loading budget settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save yellow threshold
      const { error: yellowError } = await supabase
        .from("app_settings")
        .upsert({
          key: "budget_yellow_threshold",
          value: yellowThreshold.toString(),
        });

      if (yellowError) throw yellowError;

      onSave?.();
    } catch (error) {
      console.error("Error saving budget settings:", error);
      alert("Error saving budget settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage > 100) return "bg-red-500";
    if (percentage >= yellowThreshold) return "bg-yellow-500";
    return "bg-green-500";
  };

  const validateThresholds = () => {
    return yellowThreshold > 0 && yellowThreshold <= 100;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Budget Color Settings
          </CardTitle>
          <CardDescription>
            Configure the color thresholds for budget spending percentages
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span className="ml-2">Loading settings...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Budget Color Settings
        </CardTitle>
        <CardDescription>
          Configure the color thresholds for budget spending percentages
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Threshold Inputs */}
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <Label htmlFor="yellow-threshold">Yellow Threshold (%)</Label>
            <Input
              id="yellow-threshold"
              type="number"
              min="1"
              max="100"
              value={yellowThreshold}
              onChange={(e) =>
                setYellowThreshold(parseInt(e.target.value) || 0)
              }
            />
            <p className="text-xs text-muted-foreground">
              Budgets will show yellow when spending reaches this percentage.
              Red will show when spending exceeds 100%.
            </p>
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-4">
          <Label>Preview</Label>
          <div className="space-y-3">
            {/* Green Example */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Green (Good)</span>
                <span>0% - {yellowThreshold - 1}%</span>
              </div>
              <CustomProgress
                value={yellowThreshold - 10}
                className="h-2"
                indicatorColor="rgb(34 197 94)"
              />
            </div>

            {/* Yellow Example */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Yellow (Warning)</span>
                <span>{yellowThreshold}% - 100%</span>
              </div>
              <CustomProgress
                value={yellowThreshold + (100 - yellowThreshold) / 2}
                className="h-2"
                indicatorColor="rgb(234 179 8)"
              />
            </div>

            {/* Red Example */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Red (Over Budget)</span>
                <span>&gt;100%</span>
              </div>
              <CustomProgress
                value={110}
                className="h-2"
                backgroundColor="rgb(239 68 68)"
                indicatorColor="rgb(239 68 68)"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={isSaving || !validateThresholds()}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
