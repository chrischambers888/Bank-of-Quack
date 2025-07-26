import { useState, useEffect } from "react";
import { supabase } from "@/supabaseClient";
import { MonthOption, SelectedMonth } from "@/types";

export function useBudgetMonthNavigation() {
  const [selectedMonth, setSelectedMonth] = useState<SelectedMonth>(() => {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    };
  });

  const [availableMonths, setAvailableMonths] = useState<MonthOption[]>([]);
  const [isLoadingMonths, setIsLoadingMonths] = useState(false);

  // Load available months with budget data
  const loadAvailableMonths = async () => {
    setIsLoadingMonths(true);
    try {
      const { data, error } = await supabase.rpc("get_available_budget_months");
      if (error) throw error;
      setAvailableMonths(data || []);
    } catch (error) {
      console.error("Error loading available months:", error);
    } finally {
      setIsLoadingMonths(false);
    }
  };

  // Check if a month has budget data
  const checkMonthHasData = async (year: number, month: number): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc("month_has_budget_data", {
        p_year: year,
        p_month: month,
      });
      if (error) throw error;
      return data || false;
    } catch (error) {
      console.error("Error checking month data:", error);
      return false;
    }
  };

  // Carry forward budgets to a month (only for current month)
  const carryForwardBudgets = async (year: number, month: number) => {
    try {
      const { error } = await supabase.rpc("carry_forward_budgets_to_month", {
        p_year: year,
        p_month: month,
      });
      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Error carrying forward budgets:", error);
      return false;
    }
  };

  // Auto-carry forward for current month if no data exists
  const autoCarryForwardIfNeeded = async () => {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    // Only auto-carry forward for current month
    if (selectedMonth.year === currentYear && selectedMonth.month === currentMonth) {
      const hasData = await checkMonthHasData(currentYear, currentMonth);
      if (!hasData) {
        await carryForwardBudgets(currentYear, currentMonth);
        // Reload available months after carrying forward
        await loadAvailableMonths();
      }
    }
  };

  // Change selected month
  const changeMonth = (year: number, month: number) => {
    setSelectedMonth({ year, month });
  };

  // Generate month options for dropdown (last 24 months + available months)
  const generateMonthOptions = (): MonthOption[] => {
    const options: MonthOption[] = [];
    const currentDate = new Date();
    
    // Add last 24 months
    for (let i = 0; i < 24; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      
      options.push({
        year,
        month,
        month_name: monthName,
      });
    }

    // Add any available months that aren't in the last 24 months
    availableMonths.forEach(availableMonth => {
      const exists = options.some(option => 
        option.year === availableMonth.year && option.month === availableMonth.month
      );
      if (!exists) {
        options.push(availableMonth);
      }
    });

    // Sort by year desc, month desc
    return options.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
  };

  useEffect(() => {
    loadAvailableMonths();
  }, []);

  useEffect(() => {
    autoCarryForwardIfNeeded();
  }, [selectedMonth]);

  return {
    selectedMonth,
    availableMonths,
    isLoadingMonths,
    changeMonth,
    generateMonthOptions,
    carryForwardBudgets,
    checkMonthHasData,
    loadAvailableMonths,
  };
} 