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
import { BudgetForm } from "@/components/settings/BudgetForm";
import { SectorBudgetForm } from "@/components/settings/SectorBudgetForm";
import { TabbedBudgetDisplay } from "@/components/settings/TabbedBudgetDisplay";
import {
  Category,
  BudgetSummary,
  CategoryBudget,
  MonthOption,
  SelectedMonth,
  Sector,
  SectorBudget,
  SectorBudgetSummary,
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

  // Handle toggling transaction exclusion from monthly budgets
  const handleToggleExclude = async (
    transactionId: string,
    excluded: boolean
  ) => {
    try {
      const { error } = await supabase
        .from("transactions")
        .update({ excluded_from_monthly_budget: excluded })
        .eq("id", transactionId);

      if (error) {
        console.error("Error updating transaction:", error);
        return;
      }

      // Update the transaction in the local state
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === transactionId
            ? { ...t, excluded_from_monthly_budget: excluded }
            : t
        )
      );
    } catch (error) {
      console.error("Error toggling exclude:", error);
    }
  };

  const [budgetSummaries, setBudgetSummaries] = useState<BudgetSummary[]>([]);
  const [sectorBudgetSummaries, setSectorBudgetSummaries] = useState<
    SectorBudgetSummary[]
  >([]);
  const [categories, setCategories] = useState<Category[]>([]);
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
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSectorFormOpen, setIsSectorFormOpen] = useState(false);
  const [deletingBudgetId, setDeletingBudgetId] = useState<string | null>(null);
  const [deletingSectorBudgetId, setDeletingSectorBudgetId] = useState<
    string | null
  >(null);
  const [hasBudgetData, setHasBudgetData] = useState(true);
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

  const [tempMainSelection, setTempMainSelection] = useState<SelectedMonth>({
    year: 0,
    month: 0,
  });
  const [tempCopySelection, setTempCopySelection] = useState<SelectedMonth>({
    year: 0,
    month: 0,
  });

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  // Debug: Log sectors when they change
  useEffect(() => {
    console.log("Sectors from useAppData:", sectors?.length || 0, "sectors");
    console.log("Sectors data:", sectors);
  }, [sectors]);

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
      // Load categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from("categories")
        .select("*")
        .order("name");

      if (categoriesError) throw categoriesError;
      setCategories(categoriesData || []);

      // Check if the selected month has budget data
      const monthHasData = await checkMonthHasData(
        selectedMonth.year,
        selectedMonth.month
      );
      setHasBudgetData(monthHasData);

      if (monthHasData) {
        // Load budget summaries for the selected month
        const { data: budgetData, error: budgetError } = await supabase.rpc(
          "get_budget_summary_for_month",
          {
            p_year: selectedMonth.year,
            p_month: selectedMonth.month,
          }
        );

        if (budgetError) throw budgetError;
        setBudgetSummaries(budgetData || []);

        // Load sector budget summaries for the selected month
        const { data: sectorBudgetData, error: sectorBudgetError } =
          await supabase.rpc("get_sector_budget_summary_for_month", {
            p_year: selectedMonth.year,
            p_month: selectedMonth.month,
          });

        if (sectorBudgetError) {
          console.warn(
            "Error loading sector budget summaries:",
            sectorBudgetError
          );
          setSectorBudgetSummaries([]);
        } else {
          setSectorBudgetSummaries(sectorBudgetData || []);
        }
      } else {
        setBudgetSummaries([]);
        setSectorBudgetSummaries([]);
      }
    } catch (error) {
      console.error("Error loading budget data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBudget = (category: Category) => {
    setSelectedCategory(category);
    setEditingBudget(null);
    setIsFormOpen(true);
  };

  const handleEditBudget = (budget: CategoryBudget) => {
    const category = categories.find((c) => c.id === budget.category_id);
    if (category) {
      setSelectedCategory(category);
      setEditingBudget(budget);
      setIsFormOpen(true);
    }
  };

  const handleSaveBudget = async () => {
    // Add a small delay to ensure database triggers have time to execute
    await new Promise((resolve) => setTimeout(resolve, 500));
    await loadData();
    setIsFormOpen(false);
    setSelectedCategory(null);
    setEditingBudget(null);
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
        const sector = sectors.find((s) => s.id === sectorId);
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
    const sector = sectors.find((s) => s.id === sectorBudgetSummary.sector_id);
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
    // Add a small delay to ensure database triggers have time to execute
    await new Promise((resolve) => setTimeout(resolve, 500));
    await loadData();
    setIsSectorFormOpen(false);
    setSelectedSector(null);
    setEditingSectorBudget(null);
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

  const handleDeleteSectorBudget = async (sectorId: string) => {
    try {
      const { error } = await supabase.rpc("delete_sector_budget_for_month", {
        p_sector_id: sectorId,
        p_year: selectedMonth.year,
        p_month: selectedMonth.month,
      });

      if (error) throw error;
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
          p_from_year: selectedMonth.year,
          p_from_month:
            selectedMonth.month - 1 === 0 ? 12 : selectedMonth.month - 1,
          p_from_year_adjusted:
            selectedMonth.month - 1 === 0
              ? selectedMonth.year - 1
              : selectedMonth.year,
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
          p_from_year_adjusted: copyFromMonth.year,
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
            Manage your monthly spending budgets by sector and category
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
          onCreateBudget={handleCreateBudget}
          onCreateSectorBudget={handleCreateSectorBudget}
          userNames={userNames}
          deleteTransaction={handleDeleteTransaction}
          handleSetEditingTransaction={handleSetEditingTransaction}
          onToggleExclude={handleToggleExclude}
        />
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
                    sectors.find((s) => s.id === summary.sector_id)
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
    </div>
  );
}
