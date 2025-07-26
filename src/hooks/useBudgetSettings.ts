import { useState, useEffect } from "react";
import { supabase } from "@/supabaseClient";

interface BudgetSettings {
  yellowThreshold: number;
  redThreshold: number;
  isLoading: boolean;
}

export function useBudgetSettings(): BudgetSettings {
  const [yellowThreshold, setYellowThreshold] = useState(75);
  const [redThreshold, setRedThreshold] = useState(90);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data: yellowData } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "budget_yellow_threshold")
        .single();

      const { data: redData } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "budget_red_threshold")
        .single();

      if (yellowData?.value) {
        setYellowThreshold(parseInt(yellowData.value));
      }
      if (redData?.value) {
        setRedThreshold(parseInt(redData.value));
      }
    } catch (error) {
      console.error("Error loading budget settings:", error);
      // Keep default values if loading fails
    } finally {
      setIsLoading(false);
    }
  };

  return {
    yellowThreshold,
    redThreshold,
    isLoading,
  };
} 