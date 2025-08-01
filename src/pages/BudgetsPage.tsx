import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BudgetForm } from "@/components/budgets/BudgetForm";
import { SectorBudgetForm } from "@/components/budgets/SectorBudgetForm";
import { TabbedBudgetDisplay } from "@/components/budgets/TabbedBudgetDisplay";
import {
  Category,
  BudgetSummary,
  CategoryBudget,
  MonthOption,
  SelectedMonth,
  Sector,
  SectorBudget,
  SectorBudgetSummary,
  YearlyBudgetSummary,
  YearlySectorBudgetSummary,
  YearlyCategoryBudget,
  YearlySectorBudget,
} from "@/types";
import { supabase } from "@/supabaseClient";
import {
  Plus,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Calendar,
  ArrowLeft,
  ArrowRight,
  Trash2,
  Building2,
  MoreHorizontal,
  Copy,
  RotateCcw,
  EyeOff,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { useAppData } from "@/hooks/useAppData";
import { useBudgetMonthNavigation } from "@/hooks/useBudgetMonthNavigation";
import { parseInputDateLocal } from "@/utils/dateUtils";
import {
  calculateCategorySpent,
  calculateCategoryUser1Spent,
  calculateCategoryUser2Spent,
  calculateSectorSpent,
  calculateSectorUser1Spent,
  calculateSectorUser2Spent,
  calculateBudgetAmount,
  calculateRemainingPercentage,
  calculateRemainingAmount,
  calculateYearlyCategorySpent,
  calculateYearlyCategoryUser1Spent,
  calculateYearlyCategoryUser2Spent,
  calculateYearlySectorSpent,
  calculateYearlySectorUser1Spent,
  calculateYearlySectorUser2Spent,
} from "@/utils/budgetCalculations";

// Custom Month/Year Picker Component
interface MonthYearPickerProps {
  selectedYear: number;
  selectedMonth: number;
  onSelect: (year: number, month: number) => void;
  className?: string;
  showOKButton?: boolean;
  onOK?: () => void;
}

function MonthYearPicker({
  selectedYear,
  selectedMonth,
  onSelect,
  className,
  showOKButton = false,
  onOK,
}: MonthYearPickerProps) {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Year Selector */}
      <div>
        <Label className="text-white text-sm mb-2 block">Year</Label>
        <div className="grid grid-cols-5 gap-2">
          {years.map((year) => (
            <Button
              key={year}
              variant={selectedYear === year ? "default" : "outline"}
              size="sm"
              onClick={() => onSelect(year, selectedMonth)}
              className={`text-xs ${
                selectedYear === year
                  ? "bg-white text-black hover:bg-white/90"
                  : "text-white border-white/20 hover:bg-white/10"
              }`}
            >
              {year}
            </Button>
          ))}
        </div>
      </div>

      {/* Month Selector */}
      <div>
        <Label className="text-white text-sm mb-2 block">Month</Label>
        <div className="grid grid-cols-3 gap-2">
          {months.map((month, index) => (
            <Button
              key={month}
              variant={selectedMonth === index + 1 ? "default" : "outline"}
              size="sm"
              onClick={() => onSelect(selectedYear, index + 1)}
              className={`text-xs ${
                selectedMonth === index + 1
                  ? "bg-white text-black hover:bg-white/90"
                  : "text-white border-white/20 hover:bg-white/10"
              }`}
            >
              {month}
            </Button>
          ))}
        </div>
      </div>
      {showOKButton && onOK && (
        <div className="pt-4">
          <Button
            onClick={onOK}
            className="w-full bg-white text-black hover:bg-white/90"
          >
            OK
          </Button>
        </div>
      )}
    </div>
  );
}

export function BudgetsPage() {
  const {
    user1AvatarUrl,
    user2AvatarUrl,
    sectors,
    transactions,
    setTransactions,
    userNames,
    deleteTransaction,
  } = useAppData();

  const {
    selectedMonth,
    changeMonth,
    generateMonthOptions,
    carryForwardBudgets,
    checkMonthHasData,
  } = useBudgetMonthNavigation();

  // Get the App context properly like DashboardPage does
  const appContext = useOutletContext<any>();
  const incomeImageUrl = appContext?.incomeImageUrl;
  const settlementImageUrl = appContext?.settlementImageUrl;
  const reimbursementImageUrl = appContext?.reimbursementImageUrl;
  // Create a simple handleSetEditingTransaction function that navigates to edit URL
  const handleSetEditingTransaction = (transaction: any) => {
    // Navigate to the edit URL with the transaction ID
    window.location.href = `/transactions/${transaction.id}`;
  };

  // Create a custom deleteTransaction function that refreshes budget data
  const handleDeleteTransaction = async (id: string) => {
    try {
      await deleteTransaction(id);
      // Refresh budget data after transaction deletion
      // Use setTimeout to avoid potential state conflicts
      setTimeout(async () => {
        await loadData();
      }, 100);
    } catch (error) {
      console.error("Error in handleDeleteTransaction:", error);
    }
  };

  // Create a modal-specific delete function that doesn't trigger full data refresh
  const handleModalDeleteTransaction = async (id: string) => {
    try {
      // Delete from database
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", id);
      if (error) {
        console.error("Error deleting transaction:", error);
        return;
      }

      // Update local state immediately without triggering loadData
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    } catch (error) {
      console.error("Error in handleModalDeleteTransaction:", error);
    }
  };

  // Handle toggling transaction exclusion from monthly budgets
  const handleToggleExclude = async (
    transactionId: string,
    excluded: boolean,
    exclusionType: "monthly" | "yearly"
  ) => {
    try {
      const updateData =
        exclusionType === "monthly"
          ? { excluded_from_monthly_budget: excluded }
          : { excluded_from_yearly_budget: excluded };

      const { error } = await supabase
        .from("transactions")
        .update(updateData)
        .eq("id", transactionId);

      if (error) {
        console.error("Error updating transaction:", error);
        return;
      }

      // Update the transaction in the local state
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === transactionId
            ? {
                ...t,
                ...(exclusionType === "monthly"
                  ? { excluded_from_monthly_budget: excluded }
                  : { excluded_from_yearly_budget: excluded }),
              }
            : t
        )
      );
    } catch (error) {
      console.error("Error toggling exclude:", error);
    }
  };

  const toggleExpandedExcludedTransaction = (transactionId: string) => {
    setExpandedExcludedTransactions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(transactionId)) {
        newSet.delete(transactionId);
      } else {
        newSet.add(transactionId);
      }
      return newSet;
    });
  };

  const getSplitTypeLabel = (splitType: string) => {
    if (!userNames || userNames.length < 2) {
      switch (splitType) {
        case "splitEqually":
          return "Split Equally";
        case "user1_only":
          return "For User 1 Only";
        case "user2_only":
          return "For User 2 Only";
        default:
          return splitType || "N/A";
      }
    }
    switch (splitType) {
      case "splitEqually":
        return "Split Equally";
      case "user1_only":
        return `For ${userNames[0]} Only`;
      case "user2_only":
        return `For ${userNames[1]} Only`;
      default:
        return splitType || "N/A";
    }
  };

  const [budgetSummaries, setBudgetSummaries] = useState<BudgetSummary[]>([]);
  const [sectorBudgetSummaries, setSectorBudgetSummaries] = useState<
    SectorBudgetSummary[]
  >([]);
  const [yearlyBudgetSummaries, setYearlyBudgetSummaries] = useState<
    YearlyBudgetSummary[]
  >([]);
  const [yearlySectorBudgetSummaries, setYearlySectorBudgetSummaries] =
    useState<YearlySectorBudgetSummary[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [localSectors, setLocalSectors] = useState<Sector[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null
  );
  const [selectedSector, setSelectedSector] = useState<Sector | null>(null);
  const [editingBudget, setEditingBudget] = useState<CategoryBudget | null>(
    null
  );
  const [editingSectorBudget, setEditingSectorBudget] =
    useState<SectorBudget | null>(null);
  const [editingYearlyBudget, setEditingYearlyBudget] =
    useState<YearlyCategoryBudget | null>(null);
  const [editingYearlySectorBudget, setEditingYearlySectorBudget] =
    useState<YearlySectorBudget | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSectorFormOpen, setIsSectorFormOpen] = useState(false);
  const [isYearlyFormOpen, setIsYearlyFormOpen] = useState(false);
  const [isYearlySectorFormOpen, setIsYearlySectorFormOpen] = useState(false);
  const [deletingBudgetId, setDeletingBudgetId] = useState<string | null>(null);
  const [deletingSectorBudgetId, setDeletingSectorBudgetId] = useState<
    string | null
  >(null);
  const [deletingYearlyBudgetId, setDeletingYearlyBudgetId] = useState<
    string | null
  >(null);
  const [deletingYearlySectorBudgetId, setDeletingYearlySectorBudgetId] =
    useState<string | null>(null);
  const [hasBudgetData, setHasBudgetData] = useState(true);
  const [hasYearlyBudgetData, setHasYearlyBudgetData] = useState(true);
  const [isCarryingForward, setIsCarryingForward] = useState(false);
  const [isCopyingFromMonth, setIsCopyingFromMonth] = useState(false);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [isDeletingAllBudgets, setIsDeletingAllBudgets] = useState(false);
  const [copyFromMonth, setCopyFromMonth] = useState<SelectedMonth>(() => {
    const now = new Date();
    const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const prevYear =
      now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    return { year: prevYear, month: prevMonth + 1 };
  });
  const [copyFromMonthHasData, setCopyFromMonthHasData] = useState(false);
  const [showMainCalendar, setShowMainCalendar] = useState(false);
  const [showCopyCalendar, setShowCopyCalendar] = useState(false);
  const [expandedExcludedTransactions, setExpandedExcludedTransactions] =
    useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("monthly");

  // State for preserving UI state across re-renders
  const [expandedSectors, setExpandedSectors] = useState<Set<string>>(
    new Set()
  );
  const [expandedYearlySectors, setExpandedYearlySectors] = useState<
    Set<string>
  >(new Set());

  // Loading state for form operations
  const [isFormSaving, setIsFormSaving] = useState(false);

  const [tempMainSelection, setTempMainSelection] = useState<SelectedMonth>({
    year: 0,
    month: 0,
  });
  const [tempCopySelection, setTempCopySelection] = useState<SelectedMonth>({
    year: 0,
    month: 0,
  });

  useEffect(() => {
    if (transactions.length > 0) {
      loadData();
    }
  }, [selectedMonth, transactions]);

  useEffect(() => {
    if (showCopyDialog) {
      checkCopyFromMonthData(copyFromMonth.year, copyFromMonth.month);
    }
  }, [showCopyDialog, copyFromMonth]);

  useEffect(() => {
    if (showMainCalendar) {
      setTempMainSelection(selectedMonth);
    }
  }, [showMainCalendar, selectedMonth]);

  useEffect(() => {
    if (showCopyCalendar) {
      setTempCopySelection(copyFromMonth);
    }
  }, [showCopyCalendar, copyFromMonth]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Wait for transactions to be loaded from useAppData
      if (transactions.length === 0) {
        return; // Exit early if transactions aren't loaded yet
      }

      // Load categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from("categories")
        .select("*")
        .order("name");

      if (categoriesError) throw categoriesError;
      const categories = categoriesData || [];
      setCategories(categories);

      // Use sectors from useAppData instead of loading from database
      setLocalSectors(sectors);

      // Check if the selected month has budget data
      const monthHasData = await checkMonthHasData(
        selectedMonth.year,
        selectedMonth.month
      );
      setHasBudgetData(monthHasData);

      if (monthHasData) {
        // Load category budgets for the selected month
        const { data: categoryBudgetsData, error: categoryBudgetsError } =
          await supabase
            .from("category_budgets")
            .select("*")
            .eq("year", selectedMonth.year)
            .eq("month", selectedMonth.month);

        if (categoryBudgetsError) throw categoryBudgetsError;

        // Load sector budgets for the selected month
        const { data: sectorBudgetsData, error: sectorBudgetsError } =
          await supabase
            .from("sector_budgets")
            .select("*")
            .eq("year", selectedMonth.year)
            .eq("month", selectedMonth.month);

        if (sectorBudgetsError) {
          console.warn("Error loading sector budgets:", sectorBudgetsError);
        }

        // Calculate budget summaries client-side

        const budgetSummaries = categories
          .map((category) => {
            const budget = categoryBudgetsData?.find(
              (b) => b.category_id === category.id
            );
            if (!budget) return null;

            const spent = calculateCategorySpent(
              category.id,
              selectedMonth.year,
              selectedMonth.month,
              transactions
            );
            const user1Spent = calculateCategoryUser1Spent(
              category.id,
              selectedMonth.year,
              selectedMonth.month,
              transactions
            );
            const user2Spent = calculateCategoryUser2Spent(
              category.id,
              selectedMonth.year,
              selectedMonth.month,
              transactions
            );
            const budgetAmount = calculateBudgetAmount(budget);
            const remainingPercentage =
              calculateRemainingPercentage(budgetAmount, spent) || 0;
            const remainingAmount =
              calculateRemainingAmount(budgetAmount, spent) || 0;

            return {
              category_id: category.id,
              category_name: category.name,
              category_image: category.image_url,
              budget_id: budget.id,
              budget_type: budget.budget_type,
              absolute_amount: budget.absolute_amount,
              user1_amount: budget.user1_amount,
              user2_amount: budget.user2_amount,
              current_year: selectedMonth.year,
              current_month: selectedMonth.month,
              current_period_budget: budgetAmount,
              current_period_spent: spent,
              current_period_user1_spent: user1Spent,
              current_period_user2_spent: user2Spent,
              current_period_remaining_percentage: remainingPercentage,
              current_period_remaining_amount: remainingAmount,
            };
          })
          .filter(Boolean);

        setBudgetSummaries(budgetSummaries as BudgetSummary[]);

        // Calculate sector budget summaries client-side

        const sectorBudgetSummaries = sectors.map((sector: Sector) => {
          const budget = sectorBudgetsData?.find(
            (b) => b.sector_id === sector.id
          );

          const spent = calculateSectorSpent(
            sector.category_ids,
            selectedMonth.year,
            selectedMonth.month,
            transactions
          );
          const user1Spent = calculateSectorUser1Spent(
            sector.category_ids,
            selectedMonth.year,
            selectedMonth.month,
            transactions
          );
          const user2Spent = calculateSectorUser2Spent(
            sector.category_ids,
            selectedMonth.year,
            selectedMonth.month,
            transactions
          );
          const budgetAmount = budget ? calculateBudgetAmount(budget) : 0;
          const remainingPercentage = calculateRemainingPercentage(
            budgetAmount,
            spent
          );
          const remainingAmount = calculateRemainingAmount(budgetAmount, spent);

          // Count category budgets in this sector
          const categoryBudgetsTotal = budgetSummaries.filter(
            (bs) => bs && sector.category_ids.includes(bs.category_id)
          ).length;

          return {
            sector_id: sector.id,
            sector_name: sector.name,
            budget_id: budget?.id,
            budget_type: budget?.budget_type,
            absolute_amount: budget?.absolute_amount,
            user1_amount: budget?.user1_amount,
            user2_amount: budget?.user2_amount,
            auto_rollup: budget?.auto_rollup || false,
            current_period_budget: budgetAmount,
            current_period_spent: spent,
            current_period_user1_spent: user1Spent,
            current_period_user2_spent: user2Spent,
            current_period_remaining_percentage: remainingPercentage,
            current_period_remaining_amount: remainingAmount,
            category_budgets_total: categoryBudgetsTotal,
          };
        });

        setSectorBudgetSummaries(
          sectorBudgetSummaries as SectorBudgetSummary[]
        );
      } else {
        setBudgetSummaries([]);
        setSectorBudgetSummaries([]);
      }

      // Load yearly budgets for the selected year
      const {
        data: yearlyCategoryBudgetsData,
        error: yearlyCategoryBudgetsError,
      } = await supabase
        .from("yearly_category_budgets")
        .select("*")
        .eq("year", selectedMonth.year);

      if (yearlyCategoryBudgetsError) {
        console.warn(
          "Error loading yearly category budgets:",
          yearlyCategoryBudgetsError
        );
      }

      // Load yearly sector budgets for the selected year
      const { data: yearlySectorBudgetsData, error: yearlySectorBudgetsError } =
        await supabase
          .from("yearly_sector_budgets")
          .select("*")
          .eq("year", selectedMonth.year);

      if (yearlySectorBudgetsError) {
        console.warn(
          "Error loading yearly sector budgets:",
          yearlySectorBudgetsError
        );
      }

      // Check if the selected year has yearly budget data
      const hasYearlyData = Boolean(
        (yearlyCategoryBudgetsData && yearlyCategoryBudgetsData.length > 0) ||
          (yearlySectorBudgetsData && yearlySectorBudgetsData.length > 0)
      );
      setHasYearlyBudgetData(hasYearlyData);

      if (hasYearlyData) {
        // Calculate yearly budget summaries client-side
        const yearlyBudgetSummaries = categories
          .map((category) => {
            const budget = yearlyCategoryBudgetsData?.find(
              (b) => b.category_id === category.id
            );
            if (!budget) return null;

            const spent = calculateYearlyCategorySpent(
              category.id,
              selectedMonth.year,
              selectedMonth.month,
              transactions
            );
            const user1Spent = calculateYearlyCategoryUser1Spent(
              category.id,
              selectedMonth.year,
              selectedMonth.month,
              transactions
            );
            const user2Spent = calculateYearlyCategoryUser2Spent(
              category.id,
              selectedMonth.year,
              selectedMonth.month,
              transactions
            );
            const budgetAmount = calculateBudgetAmount(budget);
            const remainingPercentage =
              calculateRemainingPercentage(budgetAmount, spent) || 0;
            const remainingAmount =
              calculateRemainingAmount(budgetAmount, spent) || 0;

            return {
              category_id: category.id,
              category_name: category.name,
              category_image: category.image_url,
              budget_id: budget.id,
              budget_type: budget.budget_type,
              absolute_amount: budget.absolute_amount,
              user1_amount: budget.user1_amount,
              user2_amount: budget.user2_amount,
              year: selectedMonth.year,
              current_period_budget: budgetAmount,
              current_period_spent: spent,
              current_period_user1_spent: user1Spent,
              current_period_user2_spent: user2Spent,
              current_period_remaining_percentage: remainingPercentage,
              current_period_remaining_amount: remainingAmount,
            };
          })
          .filter(Boolean);

        setYearlyBudgetSummaries(
          yearlyBudgetSummaries as YearlyBudgetSummary[]
        );

        // Calculate yearly sector budget summaries client-side
        const yearlySectorBudgetSummaries = sectors.map((sector: Sector) => {
          const budget = yearlySectorBudgetsData?.find(
            (b) => b.sector_id === sector.id
          );

          const spent = calculateYearlySectorSpent(
            sector.category_ids,
            selectedMonth.year,
            selectedMonth.month,
            transactions
          );
          const user1Spent = calculateYearlySectorUser1Spent(
            sector.category_ids,
            selectedMonth.year,
            selectedMonth.month,
            transactions
          );
          const user2Spent = calculateYearlySectorUser2Spent(
            sector.category_ids,
            selectedMonth.year,
            selectedMonth.month,
            transactions
          );
          const budgetAmount = budget ? calculateBudgetAmount(budget) : 0;
          const remainingPercentage =
            calculateRemainingPercentage(budgetAmount, spent) || 0;
          const remainingAmount =
            calculateRemainingAmount(budgetAmount, spent) || 0;

          // Count category budgets in this sector
          const categoryBudgetsTotal = yearlyBudgetSummaries.filter(
            (bs) => bs && sector.category_ids.includes(bs.category_id)
          ).length;

          return {
            sector_id: sector.id,
            sector_name: sector.name,
            budget_id: budget?.id,
            budget_type: budget?.budget_type,
            absolute_amount: budget?.absolute_amount,
            user1_amount: budget?.user1_amount,
            user2_amount: budget?.user2_amount,
            auto_rollup: budget?.auto_rollup || false,
            year: selectedMonth.year,
            current_period_budget: budgetAmount,
            current_period_spent: spent,
            current_period_user1_spent: user1Spent,
            current_period_user2_spent: user2Spent,
            current_period_remaining_percentage: remainingPercentage,
            current_period_remaining_amount: remainingAmount,
            category_budgets_total: categoryBudgetsTotal,
          };
        });

        setYearlySectorBudgetSummaries(
          yearlySectorBudgetSummaries as YearlySectorBudgetSummary[]
        );
      } else {
        setYearlyBudgetSummaries([]);
        setYearlySectorBudgetSummaries([]);
      }
    } catch (error) {
      console.error("Error loading budget data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Optimized function to reload only budget data without full data reload
  const loadBudgetData = async () => {
    try {
      // Wait for transactions to be loaded from useAppData
      if (transactions.length === 0) {
        return; // Exit early if transactions aren't loaded yet
      }

      // Check if the selected month has budget data
      const monthHasData = await checkMonthHasData(
        selectedMonth.year,
        selectedMonth.month
      );
      setHasBudgetData(monthHasData);

      if (monthHasData) {
        // Load category budgets for the selected month
        const { data: categoryBudgetsData, error: categoryBudgetsError } =
          await supabase
            .from("category_budgets")
            .select("*")
            .eq("year", selectedMonth.year)
            .eq("month", selectedMonth.month);

        if (categoryBudgetsError) throw categoryBudgetsError;

        // Load sector budgets for the selected month
        const { data: sectorBudgetsData, error: sectorBudgetsError } =
          await supabase
            .from("sector_budgets")
            .select("*")
            .eq("year", selectedMonth.year)
            .eq("month", selectedMonth.month);

        if (sectorBudgetsError) {
          console.warn("Error loading sector budgets:", sectorBudgetsError);
        }

        // Calculate budget summaries client-side
        const budgetSummaries = categories
          .map((category) => {
            const budget = categoryBudgetsData?.find(
              (b) => b.category_id === category.id
            );
            if (!budget) return null;

            const spent = calculateCategorySpent(
              category.id,
              selectedMonth.year,
              selectedMonth.month,
              transactions
            );
            const user1Spent = calculateCategoryUser1Spent(
              category.id,
              selectedMonth.year,
              selectedMonth.month,
              transactions
            );
            const user2Spent = calculateCategoryUser2Spent(
              category.id,
              selectedMonth.year,
              selectedMonth.month,
              transactions
            );
            const budgetAmount = calculateBudgetAmount(budget);
            const remainingPercentage =
              calculateRemainingPercentage(budgetAmount, spent) || 0;
            const remainingAmount =
              calculateRemainingAmount(budgetAmount, spent) || 0;

            return {
              category_id: category.id,
              category_name: category.name,
              category_image: category.image_url,
              budget_id: budget.id,
              budget_type: budget.budget_type,
              absolute_amount: budget.absolute_amount,
              user1_amount: budget.user1_amount,
              user2_amount: budget.user2_amount,
              current_year: selectedMonth.year,
              current_month: selectedMonth.month,
              current_period_budget: budgetAmount,
              current_period_spent: spent,
              current_period_user1_spent: user1Spent,
              current_period_user2_spent: user2Spent,
              current_period_remaining_percentage: remainingPercentage,
              current_period_remaining_amount: remainingAmount,
            };
          })
          .filter(Boolean);

        setBudgetSummaries(budgetSummaries as BudgetSummary[]);

        // Calculate sector budget summaries client-side
        const sectorBudgetSummaries = sectors.map((sector: Sector) => {
          const budget = sectorBudgetsData?.find(
            (b) => b.sector_id === sector.id
          );

          const spent = calculateSectorSpent(
            sector.category_ids,
            selectedMonth.year,
            selectedMonth.month,
            transactions
          );
          const user1Spent = calculateSectorUser1Spent(
            sector.category_ids,
            selectedMonth.year,
            selectedMonth.month,
            transactions
          );
          const user2Spent = calculateSectorUser2Spent(
            sector.category_ids,
            selectedMonth.year,
            selectedMonth.month,
            transactions
          );
          const budgetAmount = budget ? calculateBudgetAmount(budget) : 0;
          const remainingPercentage = calculateRemainingPercentage(
            budgetAmount,
            spent
          );
          const remainingAmount = calculateRemainingAmount(budgetAmount, spent);

          // Count category budgets in this sector
          const categoryBudgetsTotal = budgetSummaries.filter(
            (bs) => bs && sector.category_ids.includes(bs.category_id)
          ).length;

          return {
            sector_id: sector.id,
            sector_name: sector.name,
            budget_id: budget?.id,
            budget_type: budget?.budget_type,
            absolute_amount: budget?.absolute_amount,
            user1_amount: budget?.user1_amount,
            user2_amount: budget?.user2_amount,
            auto_rollup: budget?.auto_rollup || false,
            current_period_budget: budgetAmount,
            current_period_spent: spent,
            current_period_user1_spent: user1Spent,
            current_period_user2_spent: user2Spent,
            current_period_remaining_percentage: remainingPercentage,
            current_period_remaining_amount: remainingAmount,
            category_budgets_total: categoryBudgetsTotal,
          };
        });

        setSectorBudgetSummaries(
          sectorBudgetSummaries as SectorBudgetSummary[]
        );
      } else {
        setBudgetSummaries([]);
        setSectorBudgetSummaries([]);
      }

      // Load yearly budgets for the selected year
      const {
        data: yearlyCategoryBudgetsData,
        error: yearlyCategoryBudgetsError,
      } = await supabase
        .from("yearly_category_budgets")
        .select("*")
        .eq("year", selectedMonth.year);

      if (yearlyCategoryBudgetsError) {
        console.warn(
          "Error loading yearly category budgets:",
          yearlyCategoryBudgetsError
        );
      }

      // Load yearly sector budgets for the selected year
      const { data: yearlySectorBudgetsData, error: yearlySectorBudgetsError } =
        await supabase
          .from("yearly_sector_budgets")
          .select("*")
          .eq("year", selectedMonth.year);

      if (yearlySectorBudgetsError) {
        console.warn(
          "Error loading yearly sector budgets:",
          yearlySectorBudgetsError
        );
      }

      // Check if the selected year has yearly budget data
      const hasYearlyData = Boolean(
        (yearlyCategoryBudgetsData && yearlyCategoryBudgetsData.length > 0) ||
          (yearlySectorBudgetsData && yearlySectorBudgetsData.length > 0)
      );
      setHasYearlyBudgetData(hasYearlyData);

      if (hasYearlyData) {
        // Calculate yearly budget summaries client-side
        const yearlyBudgetSummaries = categories
          .map((category) => {
            const budget = yearlyCategoryBudgetsData?.find(
              (b) => b.category_id === category.id
            );
            if (!budget) return null;

            const spent = calculateYearlyCategorySpent(
              category.id,
              selectedMonth.year,
              selectedMonth.month,
              transactions
            );
            const user1Spent = calculateYearlyCategoryUser1Spent(
              category.id,
              selectedMonth.year,
              selectedMonth.month,
              transactions
            );
            const user2Spent = calculateYearlyCategoryUser2Spent(
              category.id,
              selectedMonth.year,
              selectedMonth.month,
              transactions
            );
            const budgetAmount = calculateBudgetAmount(budget);
            const remainingPercentage =
              calculateRemainingPercentage(budgetAmount, spent) || 0;
            const remainingAmount =
              calculateRemainingAmount(budgetAmount, spent) || 0;

            return {
              category_id: category.id,
              category_name: category.name,
              category_image: category.image_url,
              budget_id: budget.id,
              budget_type: budget.budget_type,
              absolute_amount: budget.absolute_amount,
              user1_amount: budget.user1_amount,
              user2_amount: budget.user2_amount,
              year: selectedMonth.year,
              current_period_budget: budgetAmount,
              current_period_spent: spent,
              current_period_user1_spent: user1Spent,
              current_period_user2_spent: user2Spent,
              current_period_remaining_percentage: remainingPercentage,
              current_period_remaining_amount: remainingAmount,
            };
          })
          .filter(Boolean);

        setYearlyBudgetSummaries(
          yearlyBudgetSummaries as YearlyBudgetSummary[]
        );

        // Calculate yearly sector budget summaries client-side
        const yearlySectorBudgetSummaries = sectors.map((sector: Sector) => {
          const budget = yearlySectorBudgetsData?.find(
            (b) => b.sector_id === sector.id
          );

          const spent = calculateYearlySectorSpent(
            sector.category_ids,
            selectedMonth.year,
            selectedMonth.month,
            transactions
          );
          const user1Spent = calculateYearlySectorUser1Spent(
            sector.category_ids,
            selectedMonth.year,
            selectedMonth.month,
            transactions
          );
          const user2Spent = calculateYearlySectorUser2Spent(
            sector.category_ids,
            selectedMonth.year,
            selectedMonth.month,
            transactions
          );
          const budgetAmount = budget ? calculateBudgetAmount(budget) : 0;
          const remainingPercentage =
            calculateRemainingPercentage(budgetAmount, spent) || 0;
          const remainingAmount =
            calculateRemainingAmount(budgetAmount, spent) || 0;

          // Count category budgets in this sector
          const categoryBudgetsTotal = yearlyBudgetSummaries.filter(
            (bs) => bs && sector.category_ids.includes(bs.category_id)
          ).length;

          return {
            sector_id: sector.id,
            sector_name: sector.name,
            budget_id: budget?.id,
            budget_type: budget?.budget_type,
            absolute_amount: budget?.absolute_amount,
            user1_amount: budget?.user1_amount,
            user2_amount: budget?.user2_amount,
            auto_rollup: budget?.auto_rollup || false,
            year: selectedMonth.year,
            current_period_budget: budgetAmount,
            current_period_spent: spent,
            current_period_user1_spent: user1Spent,
            current_period_user2_spent: user2Spent,
            current_period_remaining_percentage: remainingPercentage,
            current_period_remaining_amount: remainingAmount,
            category_budgets_total: categoryBudgetsTotal,
          };
        });

        setYearlySectorBudgetSummaries(
          yearlySectorBudgetSummaries as YearlySectorBudgetSummary[]
        );
      } else {
        setYearlyBudgetSummaries([]);
        setYearlySectorBudgetSummaries([]);
      }
    } catch (error) {
      console.error("Error loading budget data:", error);
    }
  };

  const handleCreateBudget = (category: Category) => {
    setSelectedCategory(category);
    setEditingBudget(null);
    setIsFormOpen(true);
  };

  const handleEditBudget = (
    budget: CategoryBudget | BudgetSummary | { category_id: string }
  ) => {
    // Handle both CategoryBudget and BudgetSummary objects, or just category_id for new budgets
    const categoryId = budget.category_id;
    const budgetId =
      "id" in budget
        ? budget.id
        : "budget_id" in budget
        ? budget.budget_id
        : null;

    // If no budget ID is provided, this is a new budget creation
    if (!budgetId) {
      const category = categories.find((c) => c.id === categoryId);
      if (category) {
        setSelectedCategory(category);
        setEditingBudget(null);
        setIsFormOpen(true);
      }
      return;
    }

    const category = categories.find((c) => c.id === categoryId);
    if (category) {
      setSelectedCategory(category);

      // Convert to CategoryBudget format if needed
      const categoryBudget: CategoryBudget =
        "id" in budget
          ? budget
          : {
              id: (budget as BudgetSummary).budget_id!,
              category_id: budget.category_id,
              year: selectedMonth.year,
              month: selectedMonth.month,
              budget_type: (budget as BudgetSummary).budget_type!,
              absolute_amount: (budget as BudgetSummary).absolute_amount,
              user1_amount: (budget as BudgetSummary).user1_amount,
              user2_amount: (budget as BudgetSummary).user2_amount,
            };

      setEditingBudget(categoryBudget);
      setIsFormOpen(true);
    }
  };

  const handleSaveBudget = async () => {
    setIsFormSaving(true);

    try {
      // Add a small delay to ensure database triggers have time to execute
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Preserve current UI state
      const currentActiveTab = activeTab;
      const currentExpandedSectors = new Set(expandedSectors);
      const currentExpandedYearlySectors = new Set(expandedYearlySectors);

      // Only reload budget data, not all data
      await loadBudgetData();

      // Restore UI state after data reload
      setActiveTab(currentActiveTab);
      setExpandedSectors(currentExpandedSectors);
      setExpandedYearlySectors(currentExpandedYearlySectors);

      setIsFormOpen(false);
      setSelectedCategory(null);
      setEditingBudget(null);
    } finally {
      setIsFormSaving(false);
    }
  };

  const handleCreateSectorBudget = (sector: Sector) => {
    setSelectedSector(sector);
    setEditingSectorBudget(null);
    setIsSectorFormOpen(true);
  };

  const getCategoryBudgetsTotalForSector = (sectorId: string) => {
    return budgetSummaries
      .filter((budgetSummary) => {
        // Check if this category belongs to the sector
        const sector = localSectors.find((s) => s.id === sectorId);
        return (
          sector && sector.category_ids.includes(budgetSummary.category_id)
        );
      })
      .reduce((total, budgetSummary) => {
        const budgetAmount =
          budgetSummary.budget_type === "absolute"
            ? budgetSummary.absolute_amount || 0
            : (budgetSummary.user1_amount || 0) +
              (budgetSummary.user2_amount || 0);
        return total + budgetAmount;
      }, 0);
  };

  const getYearlyCategoryBudgetsTotalForSector = (sectorId: string) => {
    return yearlyBudgetSummaries
      .filter((budgetSummary) => {
        // Check if this category belongs to the sector
        const sector = localSectors.find((s) => s.id === sectorId);
        return (
          sector && sector.category_ids.includes(budgetSummary.category_id)
        );
      })
      .reduce((total, budgetSummary) => {
        const budgetAmount =
          budgetSummary.budget_type === "absolute"
            ? budgetSummary.absolute_amount || 0
            : (budgetSummary.user1_amount || 0) +
              (budgetSummary.user2_amount || 0);
        return total + budgetAmount;
      }, 0);
  };

  const handleEditSectorBudget = (sectorBudgetSummary: SectorBudgetSummary) => {
    const sector = localSectors.find(
      (s) => s.id === sectorBudgetSummary.sector_id
    );
    if (sector) {
      setSelectedSector(sector);
      console.log("Setting editing sector budget:", sectorBudgetSummary);
      setEditingSectorBudget({
        id: sectorBudgetSummary.budget_id!,
        sector_id: sectorBudgetSummary.sector_id,
        year: selectedMonth.year,
        month: selectedMonth.month,
        budget_type: sectorBudgetSummary.budget_type!,
        absolute_amount: sectorBudgetSummary.absolute_amount ?? 0,
        user1_amount: sectorBudgetSummary.user1_amount ?? 0,
        user2_amount: sectorBudgetSummary.user2_amount ?? 0,
        auto_rollup: sectorBudgetSummary.auto_rollup,
      });
      setIsSectorFormOpen(true);
    }
  };

  const handleSaveSectorBudget = async () => {
    setIsFormSaving(true);

    try {
      // Add a small delay to ensure database triggers have time to execute
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Preserve current UI state
      const currentActiveTab = activeTab;
      const currentExpandedSectors = new Set(expandedSectors);
      const currentExpandedYearlySectors = new Set(expandedYearlySectors);

      // Only reload budget data, not all data
      await loadBudgetData();

      // Restore UI state after data reload
      setActiveTab(currentActiveTab);
      setExpandedSectors(currentExpandedSectors);
      setExpandedYearlySectors(currentExpandedYearlySectors);

      setIsSectorFormOpen(false);
      setSelectedSector(null);
      setEditingSectorBudget(null);
    } finally {
      setIsFormSaving(false);
    }
  };

  // Yearly budget handlers
  const handleCreateYearlyBudget = (category: Category) => {
    setSelectedCategory(category);
    setEditingYearlyBudget(null);
    setIsYearlyFormOpen(true);
  };

  const handleEditYearlyBudget = (budget: YearlyBudgetSummary) => {
    const category = categories.find((c) => c.id === budget.category_id);
    if (category) {
      setSelectedCategory(category);
      setEditingYearlyBudget({
        id: budget.budget_id!,
        category_id: budget.category_id,
        year: selectedMonth.year,
        budget_type: budget.budget_type!,
        absolute_amount: budget.absolute_amount ?? 0,
        user1_amount: budget.user1_amount ?? 0,
        user2_amount: budget.user2_amount ?? 0,
      });
      setIsYearlyFormOpen(true);
    }
  };

  const handleSaveYearlyBudget = async () => {
    setIsFormSaving(true);

    try {
      // Add a small delay to ensure database triggers have time to execute
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Preserve current UI state
      const currentActiveTab = activeTab;
      const currentExpandedSectors = new Set(expandedSectors);
      const currentExpandedYearlySectors = new Set(expandedYearlySectors);

      // Only reload budget data, not all data
      await loadBudgetData();

      // Restore UI state after data reload
      setActiveTab(currentActiveTab);
      setExpandedSectors(currentExpandedSectors);
      setExpandedYearlySectors(currentExpandedYearlySectors);

      setIsYearlyFormOpen(false);
      setSelectedCategory(null);
      setEditingYearlyBudget(null);
    } finally {
      setIsFormSaving(false);
    }
  };

  const handleCreateYearlySectorBudget = (sector: Sector) => {
    setSelectedSector(sector);
    setEditingYearlySectorBudget(null);
    setIsYearlySectorFormOpen(true);
  };

  const handleEditYearlySectorBudget = (
    sectorBudgetSummary: YearlySectorBudgetSummary
  ) => {
    const sector = localSectors.find(
      (s) => s.id === sectorBudgetSummary.sector_id
    );
    if (sector) {
      setSelectedSector(sector);
      setEditingYearlySectorBudget({
        id: sectorBudgetSummary.budget_id!,
        sector_id: sectorBudgetSummary.sector_id,
        year: selectedMonth.year,
        budget_type: sectorBudgetSummary.budget_type!,
        absolute_amount: sectorBudgetSummary.absolute_amount ?? 0,
        user1_amount: sectorBudgetSummary.user1_amount ?? 0,
        user2_amount: sectorBudgetSummary.user2_amount ?? 0,
        auto_rollup: sectorBudgetSummary.auto_rollup,
      });
      setIsYearlySectorFormOpen(true);
    }
  };

  const handleSaveYearlySectorBudget = async () => {
    setIsFormSaving(true);

    try {
      // Add a small delay to ensure database triggers have time to execute
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Preserve current UI state
      const currentActiveTab = activeTab;
      const currentExpandedSectors = new Set(expandedSectors);
      const currentExpandedYearlySectors = new Set(expandedYearlySectors);

      // Only reload budget data, not all data
      await loadBudgetData();

      // Restore UI state after data reload
      setActiveTab(currentActiveTab);
      setExpandedSectors(currentExpandedSectors);
      setExpandedYearlySectors(currentExpandedYearlySectors);

      setIsYearlySectorFormOpen(false);
      setSelectedSector(null);
      setEditingYearlySectorBudget(null);
    } finally {
      setIsFormSaving(false);
    }
  };

  const handleDeleteYearlyBudget = async (categoryId: string) => {
    try {
      const { error } = await supabase.rpc(
        "delete_yearly_budget_for_category",
        {
          p_category_id: categoryId,
          p_year: selectedMonth.year,
        }
      );

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error("Error deleting yearly budget:", error);
      alert("Error deleting yearly budget. Please try again.");
    }
  };

  const handleDeleteYearlyBudgetConfirm = (categoryId: string) => {
    setDeletingYearlyBudgetId(categoryId);
  };

  const handleDeleteYearlySectorBudgetConfirm = (sectorId: string) => {
    setDeletingYearlySectorBudgetId(sectorId);
  };

  const handleDeleteYearlySectorBudget = async (
    sectorId: string,
    deleteCategoryBudgets: boolean = false
  ) => {
    try {
      // Delete yearly sector budget
      const { error: sectorError } = await supabase.rpc(
        "delete_yearly_budget_for_sector",
        {
          p_sector_id: sectorId,
          p_year: selectedMonth.year,
        }
      );

      if (sectorError) throw sectorError;

      // If checkbox is checked, also delete yearly category budgets in this sector
      if (deleteCategoryBudgets) {
        const sector = sectors.find((s) => s.id === sectorId);
        if (sector && sector.category_ids.length > 0) {
          // Delete yearly category budgets for all categories in this sector
          for (const categoryId of sector.category_ids) {
            const { error: categoryError } = await supabase.rpc(
              "delete_yearly_budget_for_category",
              {
                p_category_id: categoryId,
                p_year: selectedMonth.year,
              }
            );

            if (categoryError) throw categoryError;
          }
        }
      }

      await loadData();
    } catch (error) {
      console.error("Error deleting yearly sector budget:", error);
      alert("Error deleting yearly sector budget. Please try again.");
    }
  };

  const handleDeleteBudget = async (categoryId: string) => {
    try {
      const { error } = await supabase.rpc("delete_budget_for_month", {
        p_category_id: categoryId,
        p_year: selectedMonth.year,
        p_month: selectedMonth.month,
      });

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error("Error deleting budget:", error);
      alert("Error deleting budget. Please try again.");
    }
  };

  const handleDeleteBudgetConfirm = (categoryId: string) => {
    setDeletingBudgetId(categoryId);
  };

  const handleDeleteSectorBudgetConfirm = (sectorId: string) => {
    setDeletingSectorBudgetId(sectorId);
  };

  const handleDeleteSectorBudget = async (
    sectorId: string,
    deleteCategoryBudgets: boolean = false
  ) => {
    try {
      // Delete sector budget
      const { error: sectorError } = await supabase.rpc(
        "delete_sector_budget_for_month",
        {
          p_sector_id: sectorId,
          p_year: selectedMonth.year,
          p_month: selectedMonth.month,
        }
      );

      if (sectorError) throw sectorError;

      // If checkbox is checked, also delete category budgets in this sector
      if (deleteCategoryBudgets) {
        const sector = sectors.find((s) => s.id === sectorId);
        if (sector && sector.category_ids.length > 0) {
          // Delete category budgets for all categories in this sector
          for (const categoryId of sector.category_ids) {
            const { error: categoryError } = await supabase.rpc(
              "delete_budget_for_month",
              {
                p_category_id: categoryId,
                p_year: selectedMonth.year,
                p_month: selectedMonth.month,
              }
            );

            if (categoryError) throw categoryError;
          }
        }
      }

      await loadData();
    } catch (error) {
      console.error("Error deleting sector budget:", error);
      alert("Error deleting sector budget. Please try again.");
    }
  };

  const handleDeleteAllBudgets = async () => {
    if (
      !confirm(
        `Are you sure you want to delete all budgets for ${selectedMonthName}? This action cannot be undone.`
      )
    ) {
      return;
    }

    setIsDeletingAllBudgets(true);
    try {
      // Use the database function to handle bulk deletion properly
      const { error } = await supabase.rpc("delete_all_budgets_for_month", {
        p_year: selectedMonth.year,
        p_month: selectedMonth.month,
      });

      if (error) throw error;

      await loadData();
    } catch (error) {
      console.error("Error deleting all budgets:", error);
      alert("Error deleting all budgets. Please try again.");
    } finally {
      setIsDeletingAllBudgets(false);
    }
  };

  const handleMonthChange = (value: string) => {
    const [year, month] = value.split("-").map(Number);
    changeMonth(year, month);
  };

  const handleCarryForwardBudgets = async () => {
    setIsCarryingForward(true);
    try {
      // Step 1: Copy category budgets (this will auto-create sector budgets)
      await carryForwardBudgets(selectedMonth.year, selectedMonth.month);

      // Step 2: Delete auto-created sector budgets
      const { error: deleteError } = await supabase.rpc(
        "delete_all_sector_budgets_for_month",
        {
          p_year: selectedMonth.year,
          p_month: selectedMonth.month,
        }
      );
      if (deleteError) throw deleteError;

      // Step 3: Copy sector budgets from previous month
      const { error: copySectorError } = await supabase.rpc(
        "copy_sector_budgets_from_month",
        {
          p_from_year:
            selectedMonth.month - 1 === 0
              ? selectedMonth.year - 1
              : selectedMonth.year,
          p_from_month:
            selectedMonth.month - 1 === 0 ? 12 : selectedMonth.month - 1,
          p_to_year: selectedMonth.year,
          p_to_month: selectedMonth.month,
        }
      );
      if (copySectorError) throw copySectorError;

      await loadData();
    } catch (error) {
      console.error("Error carrying forward budgets:", error);
      if (error instanceof Error) {
        alert(`Error carrying forward budgets: ${error.message}`);
      } else {
        alert("Error carrying forward budgets. Please try again.");
      }
    } finally {
      setIsCarryingForward(false);
    }
  };

  const handleCopyFromMonth = async () => {
    setIsCopyingFromMonth(true);
    try {
      // Step 1: Copy category budgets (this will auto-create sector budgets)
      const { error: copyCategoryError } = await supabase.rpc(
        "copy_budgets_from_month",
        {
          p_from_year: copyFromMonth.year,
          p_from_month: copyFromMonth.month,
          p_to_year: selectedMonth.year,
          p_to_month: selectedMonth.month,
        }
      );
      if (copyCategoryError) throw copyCategoryError;

      // Step 2: Delete auto-created sector budgets
      const { error: deleteError } = await supabase.rpc(
        "delete_all_sector_budgets_for_month",
        {
          p_year: selectedMonth.year,
          p_month: selectedMonth.month,
        }
      );
      if (deleteError) throw deleteError;

      // Step 3: Copy sector budgets from source month
      const { error: copySectorError } = await supabase.rpc(
        "copy_sector_budgets_from_month",
        {
          p_from_year: copyFromMonth.year,
          p_from_month: copyFromMonth.month,
          p_to_year: selectedMonth.year,
          p_to_month: selectedMonth.month,
        }
      );
      if (copySectorError) throw copySectorError;

      await loadData();
      setShowCopyDialog(false);
    } catch (error) {
      console.error("Error copying budgets:", error);
      if (error instanceof Error) {
        alert(`Error copying budgets: ${error.message}`);
      } else {
        alert("Error copying budgets. Please try again.");
      }
    } finally {
      setIsCopyingFromMonth(false);
    }
  };

  const checkCopyFromMonthData = async (year: number, month: number) => {
    try {
      const hasData = await checkMonthHasData(year, month);
      setCopyFromMonthHasData(hasData);
    } catch (error) {
      console.error("Error checking copy from month data:", error);
      setCopyFromMonthHasData(false);
    }
  };

  const handleMainCalendarSelect = (date: Date | undefined) => {
    if (date) {
      changeMonth(date.getFullYear(), date.getMonth() + 1);
      setShowMainCalendar(false);
    }
  };

  const handleCopyCalendarSelect = (date: Date | undefined) => {
    if (date) {
      setCopyFromMonth({
        year: date.getFullYear(),
        month: date.getMonth() + 1,
      });
      checkCopyFromMonthData(date.getFullYear(), date.getMonth() + 1);
      setShowCopyCalendar(false);
    }
  };

  const handleMainMonthYearSelect = (year: number, month: number) => {
    setTempMainSelection({ year, month });
  };

  const handleCopyMonthYearSelect = (year: number, month: number) => {
    setTempCopySelection({ year, month });
    checkCopyFromMonthData(year, month);
  };

  const handleMainOK = () => {
    changeMonth(tempMainSelection.year, tempMainSelection.month);
    setShowMainCalendar(false);
  };

  const handleCopyOK = () => {
    setCopyFromMonth(tempCopySelection);
    checkCopyFromMonthData(tempCopySelection.year, tempCopySelection.month);
    setShowCopyCalendar(false);
  };

  const isCurrentMonth =
    selectedMonth.year === new Date().getFullYear() &&
    selectedMonth.month === new Date().getMonth() + 1;
  const isFutureMonth =
    selectedMonth.year > new Date().getFullYear() ||
    (selectedMonth.year === new Date().getFullYear() &&
      selectedMonth.month > new Date().getMonth() + 1);

  const getBudgetStats = () => {
    // Calculate sector budgets total
    const sectorBudgetsTotal = sectorBudgetSummaries.reduce(
      (sum, sectorBudget) => {
        const budget =
          sectorBudget.budget_type === "absolute"
            ? sectorBudget.absolute_amount || 0
            : (sectorBudget.user1_amount || 0) +
              (sectorBudget.user2_amount || 0);
        return sum + budget;
      },
      0
    );

    // Calculate category budgets total (only for categories without sector budgets)
    const categoriesWithSectors = new Set();
    sectors?.forEach((sector) => {
      sector.category_ids?.forEach((categoryId) => {
        categoriesWithSectors.add(categoryId);
      });
    });

    const activeCategoryBudgets = budgetSummaries.filter((b) => b.budget_id);
    const categoryBudgetsTotal = activeCategoryBudgets.reduce((sum, budget) => {
      // Only include category budgets for categories that don't have a sector budget
      if (categoriesWithSectors.has(budget.category_id)) {
        return sum; // Skip this category budget as it's covered by sector budget
      }

      const budgetAmount =
        budget.budget_type === "absolute"
          ? budget.absolute_amount || 0
          : (budget.user1_amount || 0) + (budget.user2_amount || 0);
      return sum + budgetAmount;
    }, 0);

    // Total budget is sector budgets + category budgets (for categories without sectors)
    const totalBudget = sectorBudgetsTotal + categoryBudgetsTotal;

    // Calculate total spent (from both sector and category budgets)
    const sectorSpent = sectorBudgetSummaries.reduce(
      (sum, b) => sum + (b.current_period_spent || 0),
      0
    );
    const categorySpent = activeCategoryBudgets.reduce((sum, budget) => {
      // Only include category spending for categories that don't have a sector budget
      if (categoriesWithSectors.has(budget.category_id)) {
        return sum; // Skip this category spending as it's covered by sector spending
      }
      return sum + (budget.current_period_spent || 0);
    }, 0);
    const totalSpent = sectorSpent + categorySpent;

    const totalRemaining = totalBudget - totalSpent;
    const overallPercentage =
      totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    return { totalBudget, totalSpent, totalRemaining, overallPercentage };
  };

  const stats = getBudgetStats();
  const monthOptions = generateMonthOptions();
  const selectedMonthValue = `${selectedMonth.year}-${selectedMonth.month
    .toString()
    .padStart(2, "0")}`;

  // Get excluded transactions for the selected month
  const getExcludedTransactions = () => {
    const startDate = new Date(selectedMonth.year, selectedMonth.month - 1, 1);
    const endDate = new Date(selectedMonth.year, selectedMonth.month, 0);
    endDate.setHours(23, 59, 59, 999);

    return transactions.filter((t) => {
      const transactionDate = parseInputDateLocal(t.date);
      return (
        t.excluded_from_monthly_budget &&
        transactionDate >= startDate &&
        transactionDate <= endDate
      );
    });
  };

  const excludedTransactions = getExcludedTransactions();

  // Create proper month name for any month (not just the last 24)
  const selectedMonthName = (() => {
    const date = new Date(selectedMonth.year, selectedMonth.month - 1, 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  })();

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading budgets...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Budgets</h1>
          <p className="text-muted-foreground text-sm sm:text-base hidden sm:block">
            Manage your monthly and yearly spending budgets by sector and
            category
          </p>
        </div>

        {/* Month Selector */}
        <div className="flex items-center justify-center sm:justify-end">
          <div className="flex items-center space-x-1 sm:space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                const newMonth =
                  selectedMonth.month === 1 ? 12 : selectedMonth.month - 1;
                const newYear =
                  selectedMonth.month === 1
                    ? selectedMonth.year - 1
                    : selectedMonth.year;
                changeMonth(newYear, newMonth);
              }}
              className="hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Dialog open={showMainCalendar} onOpenChange={setShowMainCalendar}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 bg-muted hover:bg-muted/80"
                >
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-xs sm:text-sm min-w-[80px] sm:min-w-[120px] text-center">
                    {selectedMonthName}
                  </span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm bg-gradient-to-b from-[#004D40] to-[#26A69A]">
                <DialogHeader>
                  <DialogTitle>Select Month</DialogTitle>
                </DialogHeader>
                <div className="p-4">
                  <MonthYearPicker
                    selectedYear={tempMainSelection.year}
                    selectedMonth={tempMainSelection.month}
                    onSelect={handleMainMonthYearSelect}
                    showOKButton={true}
                    onOK={handleMainOK}
                  />
                </div>
              </DialogContent>
            </Dialog>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                const newMonth =
                  selectedMonth.month === 12 ? 1 : selectedMonth.month + 1;
                const newYear =
                  selectedMonth.month === 12
                    ? selectedMonth.year + 1
                    : selectedMonth.year;
                changeMonth(newYear, newMonth);
              }}
              className="hover:bg-muted"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>

            {/* Actions Dropdown Menu */}
            {hasBudgetData && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hover:bg-muted"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {!hasBudgetData && (
                    <>
                      <DropdownMenuItem
                        onClick={() => setShowCopyDialog(true)}
                        disabled={isCopyingFromMonth}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy from Another Month
                      </DropdownMenuItem>
                      {isFutureMonth && (
                        <DropdownMenuItem
                          onClick={handleCarryForwardBudgets}
                          disabled={isCarryingForward}
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Carry Forward Current Budgets
                        </DropdownMenuItem>
                      )}
                    </>
                  )}

                  <DropdownMenuItem
                    onClick={handleDeleteAllBudgets}
                    disabled={isDeletingAllBudgets}
                    className="text-red-600 focus:text-red-600"
                  >
                    {isDeletingAllBudgets ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600 mr-2"></div>
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete All Budgets
                      </>
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      {/* No Budget Data Message */}
      {!hasBudgetData && (
        <Card className="text-center py-12">
          <CardContent>
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              No budget data for {selectedMonthName}
            </h3>
            <p className="text-muted-foreground mb-4">
              {selectedMonth.year === new Date().getFullYear() &&
              selectedMonth.month === new Date().getMonth() + 1
                ? "No budgets have been set up for this month yet."
                : "No budgets were configured for this month."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={() => setShowCopyDialog(true)}
                disabled={isCopyingFromMonth}
                variant="outline"
              >
                {isCopyingFromMonth ? "Copying..." : "Copy from another Month"}
              </Button>
              {isFutureMonth && (
                <Button
                  onClick={handleCarryForwardBudgets}
                  disabled={isCarryingForward}
                  variant="outline"
                >
                  {isCarryingForward
                    ? "Carrying Forward..."
                    : "Carry Forward Current Budgets"}
                </Button>
              )}
              <Button onClick={() => setIsFormOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Budget for {selectedMonthName}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabbed Budget Display */}
      {hasBudgetData && (
        <TabbedBudgetDisplay
          sectors={sectors}
          categories={categories}
          budgetSummaries={budgetSummaries}
          sectorBudgetSummaries={sectorBudgetSummaries}
          selectedMonth={selectedMonth}
          user1AvatarUrl={user1AvatarUrl}
          user2AvatarUrl={user2AvatarUrl}
          onEditBudget={handleEditBudget}
          onDeleteBudget={handleDeleteBudgetConfirm}
          onEditSectorBudget={handleEditSectorBudget}
          onDeleteSectorBudget={handleDeleteSectorBudgetConfirm}
          onDeleteSectorBudgetDirect={handleDeleteSectorBudget}
          onCreateBudget={handleCreateBudget}
          onCreateSectorBudget={handleCreateSectorBudget}
          userNames={userNames}
          deleteTransaction={handleModalDeleteTransaction}
          handleSetEditingTransaction={handleSetEditingTransaction}
          onToggleExclude={handleToggleExclude}
          onTabChange={setActiveTab}
          allTransactions={transactions}
          incomeImageUrl={incomeImageUrl}
          settlementImageUrl={settlementImageUrl}
          reimbursementImageUrl={reimbursementImageUrl}
          // UI state props
          activeTab={activeTab}
          expandedSectors={expandedSectors}
          expandedYearlySectors={expandedYearlySectors}
          onExpandedSectorsChange={setExpandedSectors}
          onExpandedYearlySectorsChange={setExpandedYearlySectors}
          // Yearly budget props
          yearlyBudgetSummaries={yearlyBudgetSummaries}
          yearlySectorBudgetSummaries={yearlySectorBudgetSummaries}
          selectedYear={selectedMonth.year}
          selectedMonthForProgress={selectedMonth.month}
          onEditYearlyBudget={handleEditYearlyBudget}
          onDeleteYearlyBudget={handleDeleteYearlyBudgetConfirm}
          onEditYearlySectorBudget={handleEditYearlySectorBudget}
          onDeleteYearlySectorBudget={handleDeleteYearlySectorBudgetConfirm}
          onDeleteYearlySectorBudgetDirect={handleDeleteYearlySectorBudget}
          onCreateYearlyBudget={handleCreateYearlyBudget}
          onCreateYearlySectorBudget={handleCreateYearlySectorBudget}
          onOpenCategoryModal={handleEditYearlyBudget}
        />
      )}

      {/* Excluded Transactions Section - Only show on monthly tab */}
      {excludedTransactions.length > 0 && activeTab === "monthly" && (
        <Card className="border border-white/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <EyeOff className="h-5 w-5 text-muted-foreground" />
              Excluded Transactions - {selectedMonthName}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              These transactions are excluded from monthly budget calculations
              for this month
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {excludedTransactions.map((transaction) => {
                const category = categories.find(
                  (c) => c.id === transaction.category_id
                );
                const isExpanded = expandedExcludedTransactions.has(
                  transaction.id
                );
                return (
                  <div
                    key={transaction.id}
                    className="bg-card/50 rounded-lg border border-border overflow-hidden"
                  >
                    <div className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {category?.image_url && (
                          <img
                            src={category.image_url}
                            alt={category.name}
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                          />
                        )}
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="font-medium text-foreground">
                            {transaction.description}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {new Date(transaction.date).toLocaleDateString()}
                            <span className="hidden md:inline">
                              {" "}
                              •{" "}
                              {getSplitTypeLabel(transaction.split_type || "")}
                              {category && ` • ${category.name}`}
                            </span>
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Excluded from monthly budget
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-red-500 font-medium">
                          -${Math.abs(transaction.amount).toFixed(2)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            toggleExpandedExcludedTransaction(transaction.id)
                          }
                          className="md:hidden p-1"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleToggleExclude(
                              transaction.id,
                              false,
                              "monthly"
                            )
                          }
                          className="text-xs hidden md:inline-flex"
                        >
                          Include
                        </Button>
                      </div>
                    </div>
                    {/* Mobile expanded section */}
                    <div
                      className={`md:hidden ${isExpanded ? "block" : "hidden"}`}
                    >
                      <div className="px-3 pb-3 border-t border-border/50">
                        <div className="pt-3 space-y-2">
                          <div className="text-sm text-muted-foreground">
                            <span className="font-medium">Split type:</span>{" "}
                            {getSplitTypeLabel(transaction.split_type || "")}
                          </div>
                          {category && (
                            <div className="text-sm text-muted-foreground">
                              <span className="font-medium">Category:</span>{" "}
                              {category.name}
                            </div>
                          )}
                          <div className="pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleToggleExclude(
                                  transaction.id,
                                  false,
                                  "monthly"
                                )
                              }
                              className="text-xs w-full"
                            >
                              Include
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Budget Form Dialogs - Always Available */}
      <Dialog
        open={isFormOpen && !selectedCategory}
        onOpenChange={setIsFormOpen}
      >
        <DialogContent className="max-w-md bg-gradient-to-b from-[#004D40] to-[#26A69A]">
          <DialogHeader>
            <DialogTitle>Add New Budget</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {categories.map((category) => (
                <Button
                  key={category.id}
                  variant="outline"
                  className="h-auto p-3 flex flex-col items-center space-y-2 bg-card border-border text-foreground hover:bg-muted"
                  onClick={() => handleCreateBudget(category)}
                >
                  {category.image_url && (
                    <img
                      src={category.image_url}
                      alt={category.name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  )}
                  <span className="text-sm">{category.name}</span>
                </Button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Budget Form Dialog (for editing or after picking a category) */}
      {isFormOpen && selectedCategory && (
        <Dialog
          open={isFormOpen && !!selectedCategory}
          onOpenChange={setIsFormOpen}
        >
          <DialogContent className="max-w-md bg-gradient-to-b from-[#004D40] to-[#26A69A]">
            {isFormSaving && (
              <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                  <span className="text-white font-medium">Saving...</span>
                </div>
              </div>
            )}
            <BudgetForm
              category={selectedCategory}
              existingBudget={editingBudget || undefined}
              selectedMonth={selectedMonth}
              sectorBudgets={sectorBudgetSummaries
                .filter((summary) => summary.budget_id) // Only include sectors with actual budgets
                .map((summary) => ({
                  sector_id: summary.sector_id,
                  sector_name: summary.sector_name,
                  budget_type: summary.budget_type!,
                  absolute_amount: summary.absolute_amount,
                  user1_amount: summary.user1_amount,
                  user2_amount: summary.user2_amount,
                  auto_rollup: summary.auto_rollup,
                  category_ids:
                    localSectors.find((s) => s.id === summary.sector_id)
                      ?.category_ids || [],
                }))}
              currentBudgets={budgetSummaries.map((summary) => ({
                category_id: summary.category_id,
                budget_type: summary.budget_type!,
                absolute_amount: summary.absolute_amount,
                user1_amount: summary.user1_amount,
                user2_amount: summary.user2_amount,
              }))}
              onSave={handleSaveBudget}
              onCancel={() => {
                setIsFormOpen(false);
                setSelectedCategory(null);
                setEditingBudget(null);
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Sector Budget Form Dialog (for editing or after picking a sector) */}
      {isSectorFormOpen && selectedSector && (
        <Dialog
          open={isSectorFormOpen && !!selectedSector}
          onOpenChange={setIsSectorFormOpen}
        >
          <DialogContent className="max-w-md bg-gradient-to-b from-[#004D40] to-[#26A69A]">
            {isFormSaving && (
              <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                  <span className="text-white font-medium">Saving...</span>
                </div>
              </div>
            )}
            <SectorBudgetForm
              key={editingSectorBudget?.id || "new"}
              sector={selectedSector}
              existingBudget={editingSectorBudget || undefined}
              selectedMonth={selectedMonth}
              categoryBudgetsTotal={getCategoryBudgetsTotalForSector(
                selectedSector.id
              )}
              onSave={handleSaveSectorBudget}
              onCancel={() => {
                setIsSectorFormOpen(false);
                setSelectedSector(null);
                setEditingSectorBudget(null);
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Yearly Budget Form Dialogs */}
      <Dialog
        open={isYearlyFormOpen && !selectedCategory}
        onOpenChange={setIsYearlyFormOpen}
      >
        <DialogContent className="max-w-md bg-gradient-to-b from-[#004D40] to-[#26A69A]">
          <DialogHeader>
            <DialogTitle>Add New Yearly Budget</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {categories.map((category) => (
                <Button
                  key={category.id}
                  variant="outline"
                  className="h-auto p-3 flex flex-col items-center space-y-2 bg-card border-border text-foreground hover:bg-muted"
                  onClick={() => handleCreateYearlyBudget(category)}
                >
                  {category.image_url && (
                    <img
                      src={category.image_url}
                      alt={category.name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  )}
                  <span className="text-sm">{category.name}</span>
                </Button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Yearly Budget Form Dialog (for editing or after picking a category) */}
      {isYearlyFormOpen && selectedCategory && (
        <Dialog
          open={isYearlyFormOpen && !!selectedCategory}
          onOpenChange={setIsYearlyFormOpen}
        >
          <DialogContent className="max-w-md bg-gradient-to-b from-[#004D40] to-[#26A69A]">
            {isFormSaving && (
              <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                  <span className="text-white font-medium">Saving...</span>
                </div>
              </div>
            )}
            <BudgetForm
              category={selectedCategory}
              existingBudget={editingYearlyBudget || undefined}
              selectedMonth={{ year: selectedMonth.year, month: 1 }}
              isYearly={true}
              sectorBudgets={yearlySectorBudgetSummaries
                .filter((summary) => summary.budget_id) // Only include sectors with actual budgets
                .map((summary) => ({
                  sector_id: summary.sector_id,
                  sector_name: summary.sector_name,
                  budget_type: summary.budget_type!,
                  absolute_amount: summary.absolute_amount,
                  user1_amount: summary.user1_amount,
                  user2_amount: summary.user2_amount,
                  auto_rollup: summary.auto_rollup,
                  category_ids:
                    localSectors.find((s) => s.id === summary.sector_id)
                      ?.category_ids || [],
                }))}
              currentBudgets={yearlyBudgetSummaries.map((summary) => ({
                category_id: summary.category_id,
                budget_type: summary.budget_type!,
                absolute_amount: summary.absolute_amount,
                user1_amount: summary.user1_amount,
                user2_amount: summary.user2_amount,
              }))}
              onSave={handleSaveYearlyBudget}
              onCancel={() => {
                setIsYearlyFormOpen(false);
                setSelectedCategory(null);
                setEditingYearlyBudget(null);
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Yearly Sector Budget Form Dialog (for editing or after picking a sector) */}
      {isYearlySectorFormOpen && selectedSector && (
        <Dialog
          open={isYearlySectorFormOpen && !!selectedSector}
          onOpenChange={setIsYearlySectorFormOpen}
        >
          <DialogContent className="max-w-md bg-gradient-to-b from-[#004D40] to-[#26A69A]">
            {isFormSaving && (
              <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                  <span className="text-white font-medium">Saving...</span>
                </div>
              </div>
            )}
            <SectorBudgetForm
              key={editingYearlySectorBudget?.id || "new"}
              sector={selectedSector}
              existingBudget={editingYearlySectorBudget || undefined}
              selectedMonth={{ year: selectedMonth.year, month: 1 }}
              isYearly={true}
              categoryBudgetsTotal={getYearlyCategoryBudgetsTotalForSector(
                selectedSector.id
              )}
              onSave={handleSaveYearlySectorBudget}
              onCancel={() => {
                setIsYearlySectorFormOpen(false);
                setSelectedSector(null);
                setEditingYearlySectorBudget(null);
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Copy from Month Dialog */}
      <Dialog open={showCopyDialog} onOpenChange={setShowCopyDialog}>
        <DialogContent className="max-w-md bg-gradient-to-b from-[#004D40] to-[#26A69A]">
          <DialogHeader>
            <DialogTitle>Copy Budgets from Another Month</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-300">
                Select month to copy from:
              </Label>
              <div className="flex items-center space-x-2 mt-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const newMonth =
                      copyFromMonth.month === 1 ? 12 : copyFromMonth.month - 1;
                    const newYear =
                      copyFromMonth.month === 1
                        ? copyFromMonth.year - 1
                        : copyFromMonth.year;
                    setCopyFromMonth({ year: newYear, month: newMonth });
                    checkCopyFromMonthData(newYear, newMonth);
                  }}
                  className="hover:bg-white/10"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Dialog
                  open={showCopyCalendar}
                  onOpenChange={setShowCopyCalendar}
                >
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      className="flex items-center space-x-2 px-4 py-2 bg-black/20 rounded-lg flex-1 justify-center hover:bg-black/30"
                    >
                      <Calendar className="h-4 w-4 text-gray-300" />
                      <span className="font-medium text-sm">
                        {(() => {
                          const date = new Date(
                            copyFromMonth.year,
                            copyFromMonth.month - 1,
                            1
                          );
                          return date.toLocaleDateString("en-US", {
                            month: "long",
                            year: "numeric",
                          });
                        })()}
                      </span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-sm bg-gradient-to-b from-[#004D40] to-[#26A69A]">
                    <DialogHeader>
                      <DialogTitle>Select Month to Copy From</DialogTitle>
                    </DialogHeader>
                    <div className="p-4">
                      <MonthYearPicker
                        selectedYear={tempCopySelection.year}
                        selectedMonth={tempCopySelection.month}
                        onSelect={handleCopyMonthYearSelect}
                        showOKButton={true}
                        onOK={handleCopyOK}
                      />
                    </div>
                  </DialogContent>
                </Dialog>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const newMonth =
                      copyFromMonth.month === 12 ? 1 : copyFromMonth.month + 1;
                    const newYear =
                      copyFromMonth.month === 12
                        ? copyFromMonth.year + 1
                        : copyFromMonth.year;
                    setCopyFromMonth({ year: newYear, month: newMonth });
                    checkCopyFromMonthData(newYear, newMonth);
                  }}
                  className="hover:bg-white/10"
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
              {!copyFromMonthHasData && (
                <p className="text-sm text-red-300 mt-2">
                  No budget data available for this month
                </p>
              )}
            </div>
            <div className="flex space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCopyDialog(false)}
                disabled={isCopyingFromMonth}
                className="flex-1 text-white border-white/20 hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCopyFromMonth}
                disabled={isCopyingFromMonth || !copyFromMonthHasData}
                className={`flex-1 ${
                  !copyFromMonthHasData && !isCopyingFromMonth
                    ? "bg-red-600 hover:bg-red-700"
                    : ""
                }`}
              >
                {isCopyingFromMonth ? "Copying..." : "Copy Budgets"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingBudgetId}
        onOpenChange={() => setDeletingBudgetId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete Budget for {selectedMonthName}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this budget for{" "}
              {selectedMonthName}? This will only remove the budget for this
              specific month and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingBudgetId) {
                  handleDeleteBudget(deletingBudgetId);
                  setDeletingBudgetId(null);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Budget for {selectedMonthName}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sector Budget Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingSectorBudgetId}
        onOpenChange={() => setDeletingSectorBudgetId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete Sector Budget for {selectedMonthName}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this sector budget for{" "}
              {selectedMonthName}? This will only remove the sector budget for
              this specific month and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingSectorBudgetId) {
                  handleDeleteSectorBudget(deletingSectorBudgetId);
                  setDeletingSectorBudgetId(null);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Sector Budget for {selectedMonthName}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Yearly Budget Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingYearlyBudgetId}
        onOpenChange={() => setDeletingYearlyBudgetId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete Yearly Budget for {selectedMonth.year}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this yearly budget for{" "}
              {selectedMonth.year}? This will only remove the yearly budget for
              this specific year and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingYearlyBudgetId) {
                  handleDeleteYearlyBudget(deletingYearlyBudgetId);
                  setDeletingYearlyBudgetId(null);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Yearly Budget for {selectedMonth.year}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Yearly Sector Budget Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingYearlySectorBudgetId}
        onOpenChange={() => setDeletingYearlySectorBudgetId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete Yearly Sector Budget for {selectedMonth.year}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this yearly sector budget for{" "}
              {selectedMonth.year}? This will only remove the yearly sector
              budget for this specific year and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingYearlySectorBudgetId) {
                  handleDeleteYearlySectorBudget(deletingYearlySectorBudgetId);
                  setDeletingYearlySectorBudgetId(null);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Yearly Sector Budget for {selectedMonth.year}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
