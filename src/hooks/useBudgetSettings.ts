import { useState, useEffect } from "react";
import { supabase } from "@/supabaseClient";

interface BudgetSettings {
  yellowThreshold: number;
  isLoading: boolean;
}

export function useBudgetSettings(): BudgetSettings {
  const [yellowThreshold, setYellowThreshold] = useState(75);
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

      if (yellowData?.value) {
        setYellowThreshold(parseInt(yellowData.value));
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
    isLoading,
  };
} 