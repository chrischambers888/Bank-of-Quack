import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { BudgetCard } from "./BudgetCard";
import { SectorBudgetCard } from "./SectorBudgetCard";
import { EmptyStateCard } from "./EmptyStateCard";
import TransactionList from "@/components/TransactionList";
import { supabase } from "@/supabaseClient";
import { useBudgetSettings } from "@/hooks/useBudgetSettings";
import {
  BudgetSummary,
  SectorBudgetSummary,
  Sector,
  Category,
  SelectedMonth,
  Transaction,
} from "@/types";
import {
  Plus,
  Building2,
  DollarSign,
  TrendingUp,
  PieChart,
  Calendar,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  Circle,
  Edit,
  Trash2,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TabbedBudgetDisplayProps {
  sectors: Sector[];
  categories: Category[];
  budgetSummaries: BudgetSummary[];
  sectorBudgetSummaries: SectorBudgetSummary[];
  selectedMonth: SelectedMonth;
  user1AvatarUrl?: string | null;
  user2AvatarUrl?: string | null;
  onEditBudget: (budget: any) => void;
  onDeleteBudget: (categoryId: string) => void;
  onEditSectorBudget: (sectorBudget: SectorBudgetSummary) => void;
  onDeleteSectorBudget: (sectorId: string) => void;
  onDeleteSectorBudgetDirect?: (
    sectorId: string,
    deleteCategoryBudgets?: boolean
  ) => Promise<void>;
  onCreateBudget: (category: Category) => void;
  onCreateSectorBudget: (sector: Sector) => void;
  userNames: string[];
  deleteTransaction: (id: string) => Promise<void>;
  handleSetEditingTransaction: (transaction: any) => void;
  onToggleExclude?: (transactionId: string, excluded: boolean) => Promise<void>;
  onTabChange?: (tab: string) => void;
  allTransactions?: Transaction[];
  incomeImageUrl?: string | null;
  settlementImageUrl?: string | null;
  reimbursementImageUrl?: string | null;
}

export function TabbedBudgetDisplay({
  sectors,
  categories,
  budgetSummaries,
  sectorBudgetSummaries,
  selectedMonth,
  user1AvatarUrl,
  user2AvatarUrl,
  onEditBudget,
  onDeleteBudget,
  onEditSectorBudget,
  onDeleteSectorBudget,
  onDeleteSectorBudgetDirect,
  onCreateBudget,
  onCreateSectorBudget,
  userNames,
  deleteTransaction,
  handleSetEditingTransaction,
  onToggleExclude,
  onTabChange,
  allTransactions = [],
  incomeImageUrl,
  settlementImageUrl,
  reimbursementImageUrl,
}: TabbedBudgetDisplayProps) {
  const { yellowThreshold } = useBudgetSettings();
  const [activeTab, setActiveTab] = useState("monthly");
  const [expandedSectors, setExpandedSectors] = useState<Set<string>>(
    new Set()
  );
  const [tooltip, setTooltip] = useState<{
    show: boolean;
    message: string;
    x: number;
    y: number;
  }>({ show: false, message: "", x: 0, y: 0 });
  const [modalData, setModalData] = useState<{
    type: "sector" | "category";
    data: any;
    transactions: any[];
  } | null>(null);
  const [deleteSectorDialog, setDeleteSectorDialog] = useState<{
    show: boolean;
    sectorId: string;
    sectorName: string;
    deleteCategoryBudgets: boolean;
  }>({
    show: false,
    sectorId: "",
    sectorName: "",
    deleteCategoryBudgets: true,
  });

  const showTooltip = (
    message: string,
    event: React.MouseEvent | React.TouchEvent
  ) => {
    console.log("showTooltip called with message:", message);
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({
      show: true,
      message,
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
    });
  };

  const hideTooltip = () => {
    setTooltip({ show: false, message: "", x: 0, y: 0 });
  };

  // Auto-hide tooltip after 3 seconds
  useEffect(() => {
    if (tooltip.show) {
      const timer = setTimeout(() => {
        hideTooltip();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [tooltip.show]);

  // Hide tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (tooltip.show) {
        hideTooltip();
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [tooltip.show]);

  const toggleSectorExpansion = (sectorId: string) => {
    const newExpanded = new Set(expandedSectors);
    if (newExpanded.has(sectorId)) {
      newExpanded.delete(sectorId);
    } else {
      newExpanded.add(sectorId);
    }
    setExpandedSectors(newExpanded);
  };

  const getCategoriesForSector = (sector: Sector) => {
    return categories.filter((cat) => sector.category_ids.includes(cat.id));
  };

  const getBudgetSummariesForSector = (sector: Sector) => {
    return budgetSummaries.filter(
      (budget) =>
        sector.category_ids.includes(budget.category_id) && budget.budget_id
    );
  };

  const getSectorBudgetSummary = (sectorId: string) => {
    return sectorBudgetSummaries.find(
      (summary) => summary.sector_id === sectorId
    );
  };

  const getUnassignedCategories = () => {
    const assignedCategoryIds = new Set();
    sectors.forEach((sector) => {
      sector.category_ids.forEach((catId) => assignedCategoryIds.add(catId));
    });
    return categories.filter((cat) => !assignedCategoryIds.has(cat.id));
  };

  const getUnassignedBudgetSummaries = () => {
    const unassignedCategories = getUnassignedCategories();
    return budgetSummaries.filter(
      (budget) =>
        unassignedCategories.some((cat) => cat.id === budget.category_id) &&
        budget.budget_id
    );
  };

  const getOrphanedBudgetSummaries = () => {
    return budgetSummaries.filter((budget) => {
      // Find which sector this category belongs to
      const sector = sectors.find((s) =>
        s.category_ids.includes(budget.category_id)
      );
      if (!sector) return false; // Category not assigned to any sector

      // Check if the sector has a budget
      const sectorBudget = getSectorBudgetSummary(sector.id);
      const sectorHasBudget = sectorBudget?.budget_id;

      // Return true if category has budget but sector doesn't
      return budget.budget_id && !sectorHasBudget;
    });
  };

  const getSectorsWithoutBudgets = () => {
    return sectors.filter((sector) => {
      const sectorBudget = getSectorBudgetSummary(sector.id);
      const sectorHasBudget = sectorBudget?.budget_id;

      // Check if any categories in this sector have budgets
      const sectorCategories = getCategoriesForSector(sector);
      const sectorBudgets = getBudgetSummariesForSector(sector);
      const hasCategoryBudgets = sectorBudgets.length > 0;

      // Return true if sector has no budget but has categories with budgets
      return !sectorHasBudget && hasCategoryBudgets;
    });
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  const calculateSectorTotal = (sector: Sector) => {
    const sectorBudget = getSectorBudgetSummary(sector.id);
    if (sectorBudget?.budget_id) {
      return sectorBudget.budget_type === "absolute"
        ? sectorBudget.absolute_amount || 0
        : (sectorBudget.user1_amount || 0) + (sectorBudget.user2_amount || 0);
    }
    return 0;
  };

  const calculateSectorSpent = (sector: Sector) => {
    const sectorBudget = getSectorBudgetSummary(sector.id);
    return sectorBudget?.current_period_spent || 0;
  };

  const getMonthName = () => {
    const date = new Date(selectedMonth.year, selectedMonth.month - 1, 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  const openSectorModal = async (sector: Sector) => {
    const sectorBudget = getSectorBudgetSummary(sector.id);
    const sectorCategories = getCategoriesForSector(sector);
    const sectorBudgets = getBudgetSummariesForSector(sector);

    // Fetch transactions for all categories in the sector
    const { data: transactions } = await supabase
      .from("transactions")
      .select("*")
      .in("category_id", sector.category_ids)
      .gte(
        "date",
        `${selectedMonth.year}-${selectedMonth.month
          .toString()
          .padStart(2, "0")}-01`
      )
      .lt(
        "date",
        `${selectedMonth.year}-${(selectedMonth.month + 1)
          .toString()
          .padStart(2, "0")}-01`
      )
      .order("date", { ascending: false });

    // Find reimbursements that reimburse these transactions
    const relevantExpenseIds = (transactions || []).map((t) => t.id);
    const relevantReimbursements = allTransactions.filter(
      (t) =>
        t.transaction_type === "reimbursement" &&
        t.reimburses_transaction_id &&
        relevantExpenseIds.includes(t.reimburses_transaction_id)
    );

    const finalTransactions = [
      ...(transactions || []),
      ...relevantReimbursements,
    ];

    setModalData({
      type: "sector",
      data: {
        sector,
        sectorBudget,
        sectorCategories,
        sectorBudgets,
      },
      transactions: finalTransactions,
    });
  };

  const openCategoryModal = async (budgetSummary: BudgetSummary) => {
    const category = categories.find((c) => c.id === budgetSummary.category_id);

    // Fetch transactions for the category
    const { data: transactions } = await supabase
      .from("transactions")
      .select("*")
      .eq("category_id", budgetSummary.category_id)
      .gte(
        "date",
        `${selectedMonth.year}-${selectedMonth.month
          .toString()
          .padStart(2, "0")}-01`
      )
      .lt(
        "date",
        `${selectedMonth.year}-${(selectedMonth.month + 1)
          .toString()
          .padStart(2, "0")}-01`
      )
      .order("date", { ascending: false });

    // Find reimbursements that reimburse these transactions
    const relevantExpenseIds = (transactions || []).map((t) => t.id);
    const relevantReimbursements = allTransactions.filter(
      (t) =>
        t.transaction_type === "reimbursement" &&
        t.reimburses_transaction_id &&
        relevantExpenseIds.includes(t.reimburses_transaction_id)
    );

    const finalTransactions = [
      ...(transactions || []),
      ...relevantReimbursements,
    ];

    setModalData({
      type: "category",
      data: {
        budgetSummary,
        category,
      },
      transactions: finalTransactions,
    });
  };

  // Function to refresh transactions in the modal
  const refreshModalTransactions = async () => {
    if (!modalData) return;

    if (modalData.type === "sector") {
      const sector = modalData.data.sector;
      const { data: transactions } = await supabase
        .from("transactions")
        .select("*")
        .in("category_id", sector.category_ids)
        .gte(
          "date",
          `${selectedMonth.year}-${selectedMonth.month
            .toString()
            .padStart(2, "0")}-01`
        )
        .lt(
          "date",
          `${selectedMonth.year}-${(selectedMonth.month + 1)
            .toString()
            .padStart(2, "0")}-01`
        )
        .order("date", { ascending: false });

      // Find reimbursements that reimburse these transactions
      const relevantExpenseIds = (transactions || []).map((t) => t.id);
      const relevantReimbursements = allTransactions.filter(
        (t) =>
          t.transaction_type === "reimbursement" &&
          t.reimburses_transaction_id &&
          relevantExpenseIds.includes(t.reimburses_transaction_id)
      );

      const finalTransactions = [
        ...(transactions || []),
        ...relevantReimbursements,
      ];

      setModalData({
        ...modalData,
        transactions: finalTransactions,
      });
    } else {
      const budgetSummary = modalData.data.budgetSummary;
      const { data: transactions } = await supabase
        .from("transactions")
        .select("*")
        .eq("category_id", budgetSummary.category_id)
        .gte(
          "date",
          `${selectedMonth.year}-${selectedMonth.month
            .toString()
            .padStart(2, "0")}-01`
        )
        .lt(
          "date",
          `${selectedMonth.year}-${(selectedMonth.month + 1)
            .toString()
            .padStart(2, "0")}-01`
        )
        .order("date", { ascending: false });

      // Find reimbursements that reimburse these transactions
      const relevantExpenseIds = (transactions || []).map((t) => t.id);
      const relevantReimbursements = allTransactions.filter(
        (t) =>
          t.transaction_type === "reimbursement" &&
          t.reimburses_transaction_id &&
          relevantExpenseIds.includes(t.reimburses_transaction_id)
      );

      const finalTransactions = [
        ...(transactions || []),
        ...relevantReimbursements,
      ];

      setModalData({
        ...modalData,
        transactions: finalTransactions,
      });
    }
  };

  // Custom delete function that refreshes the modal
  const handleDeleteTransaction = async (id: string) => {
    console.log(
      "TabbedBudgetDisplay handleDeleteTransaction called with id:",
      id
    );
    await deleteTransaction(id);
    // The parent's deleteTransaction should handle refreshing the budget data
    // We just need to refresh the modal transactions
    await refreshModalTransactions();
  };

  const handleDeleteSectorBudget = (sectorId: string, sectorName: string) => {
    setDeleteSectorDialog({
      show: true,
      sectorId,
      sectorName,
      deleteCategoryBudgets: true,
    });
  };

  const confirmDeleteSectorBudget = async () => {
    if (onDeleteSectorBudgetDirect) {
      await onDeleteSectorBudgetDirect(
        deleteSectorDialog.sectorId,
        deleteSectorDialog.deleteCategoryBudgets
      );
    } else {
      onDeleteSectorBudget(deleteSectorDialog.sectorId);
    }
    setDeleteSectorDialog({
      show: false,
      sectorId: "",
      sectorName: "",
      deleteCategoryBudgets: true,
    });
  };

  const cancelDeleteSectorBudget = () => {
    setDeleteSectorDialog({
      show: false,
      sectorId: "",
      sectorName: "",
      deleteCategoryBudgets: true,
    });
  };

  const getBudgetStats = () => {
    // Calculate sector budgets total (only for sectors with budgets)
    const sectorBudgetsTotal = sectorBudgetSummaries.reduce(
      (sum, sectorBudget) => {
        if (!sectorBudget.budget_id) {
          return sum; // Skip sectors without budgets
        }
        const budget =
          sectorBudget.budget_type === "absolute"
            ? sectorBudget.absolute_amount || 0
            : (sectorBudget.user1_amount || 0) +
              (sectorBudget.user2_amount || 0);
        return sum + budget;
      },
      0
    );

    // Calculate category budgets total
    const activeCategoryBudgets = budgetSummaries.filter((b) => b.budget_id);
    const categoryBudgetsTotal = activeCategoryBudgets.reduce((sum, budget) => {
      // Check if this category belongs to a sector with a budget
      const sectorWithBudget = sectors?.find((sector) => {
        if (!sector.category_ids?.includes(budget.category_id)) {
          return false; // Category doesn't belong to this sector
        }
        const sectorBudget = sectorBudgetSummaries.find(
          (sb) => sb.sector_id === sector.id
        );
        return sectorBudget?.budget_id; // Only exclude if sector has a budget
      });

      if (sectorWithBudget) {
        return sum; // Skip this category budget as it's covered by sector budget
      }

      const budgetAmount =
        budget.budget_type === "absolute"
          ? budget.absolute_amount || 0
          : (budget.user1_amount || 0) + (budget.user2_amount || 0);
      return sum + budgetAmount;
    }, 0);

    // Total budget is sector budgets + category budgets (for categories without sector budgets)
    const totalBudget = sectorBudgetsTotal + categoryBudgetsTotal;

    // Calculate total spent (from both sector and category budgets)
    const sectorSpent = sectorBudgetSummaries.reduce((sum, b) => {
      // Only include spending from sectors that have budgets
      if (b.budget_id) {
        return sum + (b.current_period_spent || 0);
      }
      return sum;
    }, 0);
    const categorySpent = activeCategoryBudgets.reduce((sum, budget) => {
      // Check if this category belongs to a sector with a budget
      const sectorWithBudget = sectors?.find((sector) => {
        if (!sector.category_ids?.includes(budget.category_id)) {
          return false; // Category doesn't belong to this sector
        }
        const sectorBudget = sectorBudgetSummaries.find(
          (sb) => sb.sector_id === sector.id
        );
        return sectorBudget?.budget_id; // Only exclude if sector has a budget
      });

      if (sectorWithBudget) {
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

  // If no sectors exist, show a different empty state
  if (sectors.length === 0) {
    return (
      <EmptyStateCard
        icon={Building2}
        title="No Sectors Configured"
        description="Sectors help organize your categories and budgets. Set up sectors in Settings to get started."
        actionText="Go to Settings"
        onAction={() => {
          // This would typically navigate to settings
          console.log("Navigate to settings");
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Custom Tooltip */}
      {tooltip.show && (
        <div
          className="fixed z-[9999] px-3 py-1.5 text-xs text-white bg-black/90 rounded-md shadow-md pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, -100%)",
          }}
        >
          {tooltip.message}
        </div>
      )}

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value);
          onTabChange?.(value);
        }}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="monthly" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Monthly
          </TabsTrigger>
          <TabsTrigger value="yearly" className="flex items-center gap-2">
            <PieChart className="h-4 w-4" />
            Yearly
          </TabsTrigger>
        </TabsList>

        {/* Monthly Tab - Pivot Table */}
        <TabsContent value="monthly" className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Budget
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${stats.totalBudget.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {getMonthName()}'s budget
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Spent
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${stats.totalSpent.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats.overallPercentage.toFixed(1)}% of budget used
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Progress</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${
                    stats.totalRemaining < 0 ? "text-red-600" : "text-green-600"
                  }`}
                >
                  ${Math.abs(stats.totalRemaining).toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats.totalRemaining < 0 ? "Over budget" : "Available"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Budget Overview - {getMonthName()}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-semibold">
                          Category
                        </th>
                        <th className="text-right py-3 px-4 font-semibold">
                          Budget
                        </th>
                        <th className="text-right py-3 px-4 font-semibold">
                          Spent
                        </th>
                        <th className="text-right py-3 px-4 font-semibold">
                          Over/Under
                        </th>
                        <th className="text-right py-3 px-4 font-semibold">
                          % Used
                        </th>
                        <th className="text-center py-3 px-4 font-semibold">
                          Auto Rollup
                        </th>
                        <th className="text-center py-3 px-4 font-semibold">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {/* Sectors and their categories - sorted by percentage used */}
                      {sectors
                        .map((sector) => {
                          const sectorBudget = getSectorBudgetSummary(
                            sector.id
                          );
                          const sectorCategories =
                            getCategoriesForSector(sector);
                          const sectorBudgets =
                            getBudgetSummariesForSector(sector);
                          const sectorTotal = calculateSectorTotal(sector);
                          const sectorSpent = calculateSectorSpent(sector);
                          const sectorOverUnder = sectorTotal - sectorSpent;
                          const sectorPercentage =
                            sectorTotal > 0
                              ? (sectorSpent / sectorTotal) * 100
                              : 0;
                          const isExpanded = expandedSectors.has(sector.id);

                          return {
                            sector,
                            sectorBudget,
                            sectorCategories,
                            sectorBudgets,
                            sectorTotal,
                            sectorSpent,
                            sectorOverUnder,
                            sectorPercentage,
                            isExpanded,
                          };
                        })
                        .sort((a, b) => b.sectorPercentage - a.sectorPercentage)
                        .map(
                          ({
                            sector,
                            sectorBudget,
                            sectorCategories,
                            sectorBudgets,
                            sectorTotal,
                            sectorSpent,
                            sectorOverUnder,
                            sectorPercentage,
                            isExpanded,
                          }) => (
                            <React.Fragment key={sector.id}>
                              {/* Sector Row */}
                              <tr className="bg-muted/30 hover:bg-muted/50">
                                <td className="py-3 px-4">
                                  <div className="flex items-center space-x-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 hover:bg-muted/50"
                                      onClick={() =>
                                        toggleSectorExpansion(sector.id)
                                      }
                                    >
                                      {isExpanded ? (
                                        <ChevronDown className="h-4 w-4" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4" />
                                      )}
                                    </Button>
                                    <Building2 className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-semibold">
                                      {sector.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      ({sectorCategories.length} categories)
                                    </span>
                                    {getSectorsWithoutBudgets().some(
                                      (s) => s.id === sector.id
                                    ) && (
                                      <div
                                        onMouseEnter={(e) =>
                                          showTooltip(
                                            "Sector has categories with budgets but no sector budget",
                                            e
                                          )
                                        }
                                        onMouseLeave={hideTooltip}
                                        onTouchStart={(e) =>
                                          showTooltip(
                                            "Sector has categories with budgets but no sector budget",
                                            e
                                          )
                                        }
                                      >
                                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                      </div>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 hover:bg-muted/50"
                                      onClick={() => openSectorModal(sector)}
                                    >
                                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                  </div>
                                </td>
                                {sectorBudget?.budget_id ? (
                                  <>
                                    <td className="text-right py-3 px-4 font-medium">
                                      {formatCurrency(sectorTotal)}
                                    </td>
                                    <td className="text-right py-3 px-4">
                                      {formatCurrency(sectorSpent)}
                                    </td>
                                    <td
                                      className={`text-right py-3 px-4 font-medium ${
                                        sectorOverUnder < 0
                                          ? "text-red-600"
                                          : "text-green-600"
                                      }`}
                                    >
                                      {formatCurrency(
                                        Math.abs(sectorOverUnder)
                                      )}
                                    </td>
                                    <td className="text-right py-3 px-4">
                                      <div className="flex items-center justify-end space-x-2">
                                        <div
                                          className={`w-16 rounded-full h-2 ${
                                            sectorPercentage === 0
                                              ? "bg-gray-600"
                                              : "bg-gray-200"
                                          }`}
                                        >
                                          <div
                                            className={`h-2 rounded-full transition-all duration-300 ${
                                              sectorPercentage > 100
                                                ? "bg-red-500"
                                                : sectorPercentage >=
                                                  yellowThreshold
                                                ? "bg-yellow-500"
                                                : sectorPercentage > 0
                                                ? "bg-green-500"
                                                : "bg-gray-600"
                                            }`}
                                            style={{
                                              width: `${Math.min(
                                                sectorPercentage,
                                                100
                                              )}%`,
                                            }}
                                          />
                                        </div>
                                        <span className="text-xs w-12 text-right">
                                          {sectorPercentage.toFixed(1)}%
                                        </span>
                                      </div>
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td className="text-right py-3 px-4 text-muted-foreground">
                                      —
                                    </td>
                                    <td className="text-right py-3 px-4 text-muted-foreground">
                                      —
                                    </td>
                                    <td className="text-right py-3 px-4 text-muted-foreground">
                                      —
                                    </td>
                                    <td className="text-right py-3 px-4 text-muted-foreground">
                                      —
                                    </td>
                                  </>
                                )}
                                {sectorBudget?.budget_id ? (
                                  <td className="text-center py-3 px-4">
                                    <div className="flex justify-center">
                                      {sectorBudget.auto_rollup ? (
                                        <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                                          <svg
                                            className="w-3 h-3 text-green-600"
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                          >
                                            <path
                                              fillRule="evenodd"
                                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                              clipRule="evenodd"
                                            />
                                          </svg>
                                        </div>
                                      ) : (
                                        <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center">
                                          <span className="text-xs font-semibold text-blue-600">
                                            M
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                ) : (
                                  <td className="text-center py-3 px-4 text-muted-foreground">
                                    —
                                  </td>
                                )}
                                <td className="text-center py-3 px-4">
                                  <div className="flex justify-center space-x-1">
                                    {sectorBudget?.budget_id ? (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() =>
                                            onEditSectorBudget(sectorBudget)
                                          }
                                          className="h-6 px-2 text-xs"
                                        >
                                          <Edit className="h-3 w-3 mr-1" />
                                          Edit
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() =>
                                            handleDeleteSectorBudget(
                                              sector.id,
                                              sector.name
                                            )
                                          }
                                          className="h-6 px-2 text-xs text-red-600 hover:text-red-700"
                                        >
                                          <Trash2 className="h-3 w-3 mr-1" />
                                          Delete
                                        </Button>
                                      </>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          onCreateSectorBudget(sector)
                                        }
                                        className="h-6 px-2 text-xs"
                                      >
                                        <Plus className="h-3 w-3 mr-1" />
                                        Create
                                      </Button>
                                    )}
                                  </div>
                                </td>
                              </tr>

                              {/* Category Rows - Show when expanded, sorted by percentage used */}
                              {isExpanded && (
                                <>
                                  {sectorBudgets.length > 0
                                    ? sectorBudgets
                                        .map((budgetSummary) => {
                                          const totalBudget =
                                            budgetSummary.budget_type ===
                                            "absolute"
                                              ? budgetSummary.absolute_amount ||
                                                0
                                              : (budgetSummary.user1_amount ||
                                                  0) +
                                                (budgetSummary.user2_amount ||
                                                  0);
                                          const spent =
                                            budgetSummary.current_period_spent ||
                                            0;
                                          const overUnder = totalBudget - spent;
                                          const percentage =
                                            totalBudget > 0
                                              ? (spent / totalBudget) * 100
                                              : 0;

                                          return {
                                            budgetSummary,
                                            totalBudget,
                                            spent,
                                            overUnder,
                                            percentage,
                                          };
                                        })
                                        .sort(
                                          (a, b) => b.percentage - a.percentage
                                        )
                                        .map(
                                          ({
                                            budgetSummary,
                                            totalBudget,
                                            spent,
                                            overUnder,
                                            percentage,
                                          }) => (
                                            <tr
                                              key={budgetSummary.category_id}
                                              className="hover:bg-muted/20"
                                            >
                                              <td className="py-2 px-4 pl-12">
                                                <div className="flex items-center space-x-2">
                                                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                                                    {budgetSummary.category_image ? (
                                                      <img
                                                        src={
                                                          budgetSummary.category_image
                                                        }
                                                        alt={
                                                          budgetSummary.category_name
                                                        }
                                                        className="w-full h-full object-cover"
                                                      />
                                                    ) : (
                                                      <div className="w-4 h-4 bg-muted-foreground rounded-full"></div>
                                                    )}
                                                  </div>
                                                  <span className="text-sm">
                                                    {
                                                      budgetSummary.category_name
                                                    }
                                                  </span>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-4 w-4 p-0 hover:bg-muted/50"
                                                    onClick={() =>
                                                      openCategoryModal(
                                                        budgetSummary
                                                      )
                                                    }
                                                  >
                                                    <HelpCircle className="h-3 w-3 text-muted-foreground" />
                                                  </Button>
                                                </div>
                                              </td>
                                              <td className="text-right py-2 px-4 text-sm">
                                                {formatCurrency(totalBudget)}
                                              </td>
                                              <td className="text-right py-2 px-4 text-sm">
                                                {formatCurrency(spent)}
                                              </td>
                                              <td
                                                className={`text-right py-2 px-4 text-sm font-medium ${
                                                  overUnder < 0
                                                    ? "text-red-600"
                                                    : "text-green-600"
                                                }`}
                                              >
                                                {formatCurrency(
                                                  Math.abs(overUnder)
                                                )}
                                              </td>
                                              <td className="text-right py-2 px-4">
                                                <div className="flex items-center justify-end space-x-2">
                                                  <div
                                                    className={`w-12 rounded-full h-1.5 ${
                                                      percentage === 0
                                                        ? "bg-gray-600"
                                                        : "bg-gray-200"
                                                    }`}
                                                  >
                                                    <div
                                                      className={`h-1.5 rounded-full transition-all duration-300 ${
                                                        percentage > 100
                                                          ? "bg-red-500"
                                                          : percentage >=
                                                            yellowThreshold
                                                          ? "bg-yellow-500"
                                                          : percentage > 0
                                                          ? "bg-green-500"
                                                          : "bg-gray-600"
                                                      }`}
                                                      style={{
                                                        width: `${Math.min(
                                                          percentage,
                                                          100
                                                        )}%`,
                                                      }}
                                                    />
                                                  </div>
                                                  <span className="text-xs w-10 text-right">
                                                    {percentage.toFixed(1)}%
                                                  </span>
                                                </div>
                                              </td>
                                              <td className="text-center py-2 px-4">
                                                <div className="flex justify-center space-x-1">
                                                  <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() =>
                                                      onEditBudget({
                                                        id: budgetSummary.budget_id!,
                                                        category_id:
                                                          budgetSummary.category_id,
                                                        year: selectedMonth.year,
                                                        month:
                                                          selectedMonth.month,
                                                        budget_type:
                                                          budgetSummary.budget_type!,
                                                        absolute_amount:
                                                          budgetSummary.absolute_amount,
                                                        user1_amount:
                                                          budgetSummary.user1_amount,
                                                        user2_amount:
                                                          budgetSummary.user2_amount,
                                                      })
                                                    }
                                                    className="h-6 px-2 text-xs"
                                                  >
                                                    Edit
                                                  </Button>
                                                  <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() =>
                                                      onDeleteBudget(
                                                        budgetSummary.category_id
                                                      )
                                                    }
                                                    className="h-6 px-2 text-xs text-red-600 hover:text-red-700"
                                                  >
                                                    Delete
                                                  </Button>
                                                </div>
                                              </td>
                                            </tr>
                                          )
                                        )
                                    : null}

                                  {/* Special row for unset categories */}
                                  {(() => {
                                    const categoriesWithBudgets = new Set(
                                      sectorBudgets.map((b) => b.category_id)
                                    );
                                    const unsetCategories =
                                      sectorCategories.filter(
                                        (cat) =>
                                          !categoriesWithBudgets.has(cat.id)
                                      );

                                    if (unsetCategories.length === 0)
                                      return null;

                                    return (
                                      <tr className="bg-muted/20 border-t">
                                        <td colSpan={7} className="py-4 px-4">
                                          <div className="flex justify-center">
                                            <div className="flex flex-wrap justify-center gap-2">
                                              {unsetCategories.map(
                                                (category) => (
                                                  <Button
                                                    key={category.id}
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() =>
                                                      onCreateBudget(category)
                                                    }
                                                    className="text-xs h-7 px-3"
                                                  >
                                                    <Plus className="h-3 w-3 mr-1" />
                                                    {category.name}
                                                  </Button>
                                                )
                                              )}
                                            </div>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })()}
                                </>
                              )}
                            </React.Fragment>
                          )
                        )}

                      {/* Unassigned Categories - sorted by percentage used */}
                      {(() => {
                        const unassignedCategories = getUnassignedCategories();
                        const unassignedBudgets =
                          getUnassignedBudgetSummaries();

                        if (unassignedCategories.length === 0) return null;

                        // Calculate totals for unassigned categories
                        const totalBudget = unassignedBudgets.reduce(
                          (sum, budget) => {
                            const budgetAmount =
                              budget.budget_type === "absolute"
                                ? budget.absolute_amount || 0
                                : (budget.user1_amount || 0) +
                                  (budget.user2_amount || 0);
                            return sum + budgetAmount;
                          },
                          0
                        );
                        const totalSpent = unassignedBudgets.reduce(
                          (sum, budget) =>
                            sum + (budget.current_period_spent || 0),
                          0
                        );
                        const totalOverUnder = totalBudget - totalSpent;
                        const totalPercentage =
                          totalBudget > 0
                            ? (totalSpent / totalBudget) * 100
                            : 0;

                        return (
                          <React.Fragment>
                            {/* Unassigned Categories Header */}
                            <tr className="bg-muted/30 hover:bg-muted/50">
                              <td className="py-3 px-4">
                                <div className="flex items-center space-x-2">
                                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-semibold">
                                    Other Categories
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    ({unassignedCategories.length} unassigned)
                                  </span>
                                </div>
                              </td>
                              <td className="text-right py-3 px-4 font-medium">
                                {formatCurrency(totalBudget)}
                              </td>
                              <td className="text-right py-3 px-4">
                                {formatCurrency(totalSpent)}
                              </td>
                              <td className="text-right py-3 px-4">
                                <span
                                  className={`font-medium ${
                                    totalOverUnder < 0
                                      ? "text-red-600"
                                      : "text-green-600"
                                  }`}
                                >
                                  {formatCurrency(Math.abs(totalOverUnder))}
                                </span>
                              </td>
                              <td className="text-right py-3 px-4">
                                <div className="flex items-center justify-end space-x-2">
                                  <div
                                    className={`w-16 rounded-full h-2 ${
                                      totalPercentage === 0
                                        ? "bg-gray-600"
                                        : "bg-gray-200"
                                    }`}
                                  >
                                    <div
                                      className={`h-2 rounded-full transition-all duration-300 ${
                                        totalPercentage > 100
                                          ? "bg-red-500"
                                          : totalPercentage >= yellowThreshold
                                          ? "bg-yellow-500"
                                          : totalPercentage > 0
                                          ? "bg-green-500"
                                          : "bg-gray-600"
                                      }`}
                                      style={{
                                        width: `${Math.min(
                                          totalPercentage,
                                          100
                                        )}%`,
                                      }}
                                    />
                                  </div>
                                  <span className="text-xs w-12 text-right">
                                    {totalPercentage.toFixed(1)}%
                                  </span>
                                </div>
                              </td>
                              <td className="text-center py-3 px-4">
                                {/* Removed action buttons from header */}
                              </td>
                              <td className="text-center py-3 px-4">
                                {/* No actions for unassigned categories header */}
                              </td>
                            </tr>

                            {/* Unassigned Category Rows - sorted by percentage used */}
                            {unassignedBudgets
                              .map((budgetSummary) => {
                                const totalBudget =
                                  budgetSummary.budget_type === "absolute"
                                    ? budgetSummary.absolute_amount || 0
                                    : (budgetSummary.user1_amount || 0) +
                                      (budgetSummary.user2_amount || 0);
                                const spent =
                                  budgetSummary.current_period_spent || 0;
                                const overUnder = totalBudget - spent;
                                const percentage =
                                  totalBudget > 0
                                    ? (spent / totalBudget) * 100
                                    : 0;

                                return {
                                  budgetSummary,
                                  totalBudget,
                                  spent,
                                  overUnder,
                                  percentage,
                                };
                              })
                              .sort((a, b) => b.percentage - a.percentage)
                              .map(
                                ({
                                  budgetSummary,
                                  totalBudget,
                                  spent,
                                  overUnder,
                                  percentage,
                                }) => (
                                  <tr
                                    key={budgetSummary.category_id}
                                    className="hover:bg-muted/20"
                                  >
                                    <td className="py-2 px-4 pl-12">
                                      <div className="flex items-center space-x-2">
                                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                                          {budgetSummary.category_image ? (
                                            <img
                                              src={budgetSummary.category_image}
                                              alt={budgetSummary.category_name}
                                              className="w-full h-full object-cover"
                                            />
                                          ) : (
                                            <div className="w-4 h-4 bg-muted-foreground rounded-full"></div>
                                          )}
                                        </div>
                                        <span className="text-sm">
                                          {budgetSummary.category_name}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="text-right py-2 px-4 text-sm">
                                      {formatCurrency(totalBudget)}
                                    </td>
                                    <td className="text-right py-2 px-4 text-sm">
                                      {formatCurrency(spent)}
                                    </td>
                                    <td
                                      className={`text-right py-2 px-4 text-sm font-medium ${
                                        overUnder < 0
                                          ? "text-red-600"
                                          : "text-green-600"
                                      }`}
                                    >
                                      {formatCurrency(Math.abs(overUnder))}
                                    </td>
                                    <td className="text-right py-2 px-4">
                                      <div className="flex items-center justify-end space-x-2">
                                        <div className="w-12 bg-gray-200 rounded-full h-1.5">
                                          <div
                                            className={`h-1.5 rounded-full transition-all duration-300 ${
                                              percentage > 100
                                                ? "bg-red-500"
                                                : percentage >= yellowThreshold
                                                ? "bg-yellow-500"
                                                : "bg-green-500"
                                            }`}
                                            style={{
                                              width: `${Math.min(
                                                percentage,
                                                100
                                              )}%`,
                                            }}
                                          />
                                        </div>
                                        <span className="text-xs w-10 text-right">
                                          {percentage.toFixed(1)}%
                                        </span>
                                      </div>
                                    </td>
                                    <td className="text-center py-2 px-4">
                                      <div className="flex justify-center space-x-1">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() =>
                                            onEditBudget(budgetSummary)
                                          }
                                          className="h-6 px-2 text-xs"
                                        >
                                          Edit
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() =>
                                            onDeleteBudget(
                                              budgetSummary.category_id
                                            )
                                          }
                                          className="h-6 px-2 text-xs text-red-600 hover:text-red-700"
                                        >
                                          Delete
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                )
                              )}
                          </React.Fragment>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Budget Overview - {getMonthName()}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Sectors and their categories - sorted by percentage used */}
                  {sectors
                    .map((sector) => {
                      const sectorBudget = getSectorBudgetSummary(sector.id);
                      const sectorCategories = getCategoriesForSector(sector);
                      const sectorBudgets = getBudgetSummariesForSector(sector);
                      const sectorTotal = calculateSectorTotal(sector);
                      const sectorSpent = calculateSectorSpent(sector);
                      const sectorOverUnder = sectorTotal - sectorSpent;
                      const sectorPercentage =
                        sectorTotal > 0 ? (sectorSpent / sectorTotal) * 100 : 0;
                      const isExpanded = expandedSectors.has(sector.id);

                      return {
                        sector,
                        sectorBudget,
                        sectorCategories,
                        sectorBudgets,
                        sectorTotal,
                        sectorSpent,
                        sectorOverUnder,
                        sectorPercentage,
                        isExpanded,
                      };
                    })
                    .sort((a, b) => b.sectorPercentage - a.sectorPercentage)
                    .map(
                      ({
                        sector,
                        sectorBudget,
                        sectorCategories,
                        sectorBudgets,
                        sectorTotal,
                        sectorSpent,
                        sectorOverUnder,
                        sectorPercentage,
                        isExpanded,
                      }) => (
                        <div
                          key={sector.id}
                          className="border rounded-lg overflow-hidden"
                        >
                          {/* Sector Card */}
                          <div className="bg-muted/30 p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    toggleSectorExpansion(sector.id)
                                  }
                                  className="h-6 w-6 p-0"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </Button>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium break-words leading-tight">
                                    {sector.name}
                                  </p>
                                  <div className="flex items-center space-x-1">
                                    <p className="text-xs text-muted-foreground">
                                      {sectorCategories.length} categories
                                    </p>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openSectorModal(sector)}
                                      className="h-4 w-4 p-0 hover:bg-muted/50"
                                    >
                                      <HelpCircle className="h-3 w-3 text-muted-foreground" />
                                    </Button>
                                    {getSectorsWithoutBudgets().some(
                                      (s) => s.id === sector.id
                                    ) && (
                                      <div
                                        onMouseEnter={(e) =>
                                          showTooltip(
                                            "Sector has categories with budgets but no sector budget",
                                            e
                                          )
                                        }
                                        onMouseLeave={hideTooltip}
                                        onTouchStart={(e) =>
                                          showTooltip(
                                            "Sector has categories with budgets but no sector budget",
                                            e
                                          )
                                        }
                                      >
                                        <AlertTriangle className="h-3 w-3 text-yellow-500" />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-1">
                                {sectorBudget?.budget_id && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 hover:bg-muted/50"
                                    onClick={(e) => {
                                      console.log("Button clicked!");
                                      e.stopPropagation();
                                      showTooltip(
                                        sectorBudget.auto_rollup
                                          ? "Auto-rolled up budget"
                                          : "Manual budget",
                                        e
                                      );
                                    }}
                                    onTouchStart={(e) => {
                                      console.log("Button touched!");
                                      e.stopPropagation();
                                      showTooltip(
                                        sectorBudget.auto_rollup
                                          ? "Auto-rolled up budget"
                                          : "Manual budget",
                                        e
                                      );
                                    }}
                                    onMouseLeave={hideTooltip}
                                  >
                                    {sectorBudget.auto_rollup ? (
                                      <CheckCircle className="h-5 w-5 text-green-600" />
                                    ) : (
                                      <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center">
                                        <span className="text-xs font-semibold text-blue-600">
                                          M
                                        </span>
                                      </div>
                                    )}
                                  </Button>
                                )}
                                {sectorBudget?.budget_id ? (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() =>
                                        onEditSectorBudget(sectorBudget)
                                      }
                                      className="h-6 px-2 text-xs"
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() =>
                                        handleDeleteSectorBudget(
                                          sector.id,
                                          sector.name
                                        )
                                      }
                                      className="h-6 px-2 text-xs text-red-600 hover:text-red-700"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => onCreateSectorBudget(sector)}
                                    className="h-6 px-2 text-xs"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>

                            {/* Sector Stats */}
                            {sectorBudget?.budget_id ? (
                              <>
                                <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                                  <div>
                                    <p className="text-muted-foreground">
                                      Budget
                                    </p>
                                    <p className="font-medium">
                                      {formatCurrency(sectorTotal)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">
                                      Spent
                                    </p>
                                    <p className="font-medium">
                                      {formatCurrency(sectorSpent)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">
                                      {sectorOverUnder < 0 ? "Over" : "Under"}
                                    </p>
                                    <p
                                      className={`font-medium ${
                                        sectorOverUnder < 0
                                          ? "text-red-600"
                                          : "text-green-600"
                                      }`}
                                    >
                                      {formatCurrency(
                                        Math.abs(sectorOverUnder)
                                      )}
                                    </p>
                                  </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="mt-3">
                                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                    <span>Progress</span>
                                    <span>{sectorPercentage.toFixed(1)}%</span>
                                  </div>
                                  <div
                                    className={`w-full rounded-full h-2 ${
                                      sectorPercentage === 0
                                        ? "bg-gray-600"
                                        : "bg-gray-200"
                                    }`}
                                  >
                                    <div
                                      className={`h-2 rounded-full transition-all duration-300 ${
                                        sectorPercentage > 100
                                          ? "bg-red-500"
                                          : sectorPercentage >= yellowThreshold
                                          ? "bg-yellow-500"
                                          : sectorPercentage > 0
                                          ? "bg-green-500"
                                          : "bg-gray-600"
                                      }`}
                                      style={{
                                        width: `${Math.min(
                                          sectorPercentage,
                                          100
                                        )}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              </>
                            ) : null}
                          </div>

                          {/* Category Cards - Show when expanded */}
                          {isExpanded && (
                            <div className="border-t bg-background">
                              {sectorBudgets.length > 0 ? (
                                <div className="p-4 space-y-3">
                                  {sectorBudgets
                                    .map((budgetSummary) => {
                                      const totalBudget =
                                        budgetSummary.budget_type === "absolute"
                                          ? budgetSummary.absolute_amount || 0
                                          : (budgetSummary.user1_amount || 0) +
                                            (budgetSummary.user2_amount || 0);
                                      const spent =
                                        budgetSummary.current_period_spent || 0;
                                      const overUnder = totalBudget - spent;
                                      const percentage =
                                        totalBudget > 0
                                          ? (spent / totalBudget) * 100
                                          : 0;

                                      return {
                                        budgetSummary,
                                        totalBudget,
                                        spent,
                                        overUnder,
                                        percentage,
                                      };
                                    })
                                    .sort((a, b) => b.percentage - a.percentage)
                                    .map(
                                      ({
                                        budgetSummary,
                                        totalBudget,
                                        spent,
                                        overUnder,
                                        percentage,
                                      }) => (
                                        <div
                                          key={budgetSummary.category_id}
                                          className="p-3 bg-muted/20 rounded-lg"
                                        >
                                          <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center space-x-3">
                                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                                                {budgetSummary.category_image ? (
                                                  <img
                                                    src={
                                                      budgetSummary.category_image
                                                    }
                                                    alt={
                                                      budgetSummary.category_name
                                                    }
                                                    className="w-full h-full object-cover"
                                                  />
                                                ) : (
                                                  <div className="w-5 h-5 bg-muted-foreground rounded-full"></div>
                                                )}
                                              </div>
                                              <div>
                                                <p className="font-medium text-sm">
                                                  {budgetSummary.category_name}
                                                </p>
                                                <div className="flex items-center space-x-1">
                                                  <p className="text-xs text-muted-foreground">
                                                    {formatCurrency(
                                                      totalBudget
                                                    )}{" "}
                                                    budget
                                                  </p>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() =>
                                                      openCategoryModal(
                                                        budgetSummary
                                                      )
                                                    }
                                                    className="h-4 w-4 p-0 hover:bg-muted/50"
                                                  >
                                                    <HelpCircle className="h-3 w-3 text-muted-foreground" />
                                                  </Button>
                                                </div>
                                              </div>
                                            </div>
                                            <div className="flex space-x-1">
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() =>
                                                  onEditBudget({
                                                    id: budgetSummary.budget_id!,
                                                    category_id:
                                                      budgetSummary.category_id,
                                                    year: selectedMonth.year,
                                                    month: selectedMonth.month,
                                                    budget_type:
                                                      budgetSummary.budget_type!,
                                                    absolute_amount:
                                                      budgetSummary.absolute_amount,
                                                    user1_amount:
                                                      budgetSummary.user1_amount,
                                                    user2_amount:
                                                      budgetSummary.user2_amount,
                                                  })
                                                }
                                                className="h-6 w-6 p-0"
                                              >
                                                <Edit className="h-3 w-3" />
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() =>
                                                  onDeleteBudget(
                                                    budgetSummary.category_id
                                                  )
                                                }
                                                className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                                              >
                                                <Trash2 className="h-3 w-3" />
                                              </Button>
                                            </div>
                                          </div>
                                          <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                              <p className="text-muted-foreground text-xs">
                                                Spent
                                              </p>
                                              <p className="font-medium">
                                                {formatCurrency(spent)}
                                              </p>
                                            </div>
                                            <div>
                                              <p className="text-muted-foreground text-xs">
                                                {overUnder < 0
                                                  ? "Over"
                                                  : "Under"}
                                              </p>
                                              <p
                                                className={`font-medium ${
                                                  overUnder < 0
                                                    ? "text-red-600"
                                                    : "text-green-600"
                                                }`}
                                              >
                                                {formatCurrency(
                                                  Math.abs(overUnder)
                                                )}
                                              </p>
                                            </div>
                                          </div>
                                          <div className="mt-2">
                                            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                              <span>Progress</span>
                                              <span>
                                                {percentage.toFixed(1)}%
                                              </span>
                                            </div>
                                            <div
                                              className={`w-full rounded-full h-1.5 ${
                                                percentage === 0
                                                  ? "bg-gray-600"
                                                  : "bg-gray-200"
                                              }`}
                                            >
                                              <div
                                                className={`h-1.5 rounded-full transition-all duration-300 ${
                                                  percentage > 100
                                                    ? "bg-red-500"
                                                    : percentage >=
                                                      yellowThreshold
                                                    ? "bg-yellow-500"
                                                    : percentage > 0
                                                    ? "bg-green-500"
                                                    : "bg-gray-600"
                                                }`}
                                                style={{
                                                  width: `${Math.min(
                                                    percentage,
                                                    100
                                                  )}%`,
                                                }}
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      )
                                    )}
                                </div>
                              ) : null}

                              {/* Special section for unset categories */}
                              {(() => {
                                const categoriesWithBudgets = new Set(
                                  sectorBudgets.map((b) => b.category_id)
                                );
                                const unsetCategories = sectorCategories.filter(
                                  (cat) => !categoriesWithBudgets.has(cat.id)
                                );

                                if (unsetCategories.length === 0) return null;

                                return (
                                  <div className="p-4 bg-muted/20 border-t">
                                    <div className="flex flex-wrap justify-center gap-2">
                                      {unsetCategories.map((category) => (
                                        <Button
                                          key={category.id}
                                          size="sm"
                                          variant="outline"
                                          onClick={() =>
                                            onCreateBudget(category)
                                          }
                                          className="text-xs h-8 px-3"
                                        >
                                          <Plus className="h-3 w-3 mr-1" />
                                          {category.name}
                                        </Button>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      )
                    )}

                  {/* Unassigned Categories */}
                  {(() => {
                    const unassignedCategories = getUnassignedCategories();
                    const unassignedBudgets = getUnassignedBudgetSummaries();

                    if (unassignedCategories.length === 0) return null;

                    // Calculate totals for unassigned categories
                    const totalBudget = unassignedBudgets.reduce(
                      (sum, budget) => {
                        const budgetAmount =
                          budget.budget_type === "absolute"
                            ? budget.absolute_amount || 0
                            : (budget.user1_amount || 0) +
                              (budget.user2_amount || 0);
                        return sum + budgetAmount;
                      },
                      0
                    );
                    const totalSpent = unassignedBudgets.reduce(
                      (sum, budget) => sum + (budget.current_period_spent || 0),
                      0
                    );
                    const totalOverUnder = totalBudget - totalSpent;
                    const totalPercentage =
                      totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

                    return (
                      <div className="border rounded-lg overflow-hidden">
                        <div className="bg-muted/30 p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <DollarSign className="h-5 w-5 text-muted-foreground" />
                              <div>
                                <h3 className="font-semibold">
                                  Other Categories
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                  {unassignedCategories.length} unassigned
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 hover:bg-muted/50"
                              onClick={(e) => {
                                console.log("Unassigned button clicked!");
                                e.stopPropagation();
                                showTooltip(
                                  "Unassigned categories (no sector)",
                                  e
                                );
                              }}
                              onTouchStart={(e) => {
                                console.log("Unassigned button touched!");
                                e.stopPropagation();
                                showTooltip(
                                  "Unassigned categories (no sector)",
                                  e
                                );
                              }}
                              onMouseLeave={hideTooltip}
                            >
                              <Circle className="h-5 w-5 text-gray-400" />
                            </Button>
                          </div>

                          {/* Unassigned Stats */}
                          <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Budget</p>
                              <p className="font-medium">
                                {formatCurrency(totalBudget)}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Spent</p>
                              <p className="font-medium">
                                {formatCurrency(totalSpent)}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">
                                {totalOverUnder < 0 ? "Over" : "Under"}
                              </p>
                              <p
                                className={`font-medium ${
                                  totalOverUnder < 0
                                    ? "text-red-600"
                                    : "text-green-600"
                                }`}
                              >
                                {formatCurrency(Math.abs(totalOverUnder))}
                              </p>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className="mt-3">
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                              <span>Progress</span>
                              <span>{totalPercentage.toFixed(1)}%</span>
                            </div>
                            <div
                              className={`w-full rounded-full h-2 ${
                                totalPercentage === 0
                                  ? "bg-gray-600"
                                  : "bg-gray-200"
                              }`}
                            >
                              <div
                                className={`h-2 rounded-full transition-all duration-300 ${
                                  totalPercentage > 100
                                    ? "bg-red-500"
                                    : totalPercentage >= yellowThreshold
                                    ? "bg-yellow-500"
                                    : totalPercentage > 0
                                    ? "bg-green-500"
                                    : "bg-gray-600"
                                }`}
                                style={{
                                  width: `${Math.min(totalPercentage, 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Unassigned Category Cards */}
                        {unassignedBudgets.length > 0 && (
                          <div className="border-t bg-background p-4 space-y-3">
                            {unassignedBudgets
                              .map((budgetSummary) => {
                                const totalBudget =
                                  budgetSummary.budget_type === "absolute"
                                    ? budgetSummary.absolute_amount || 0
                                    : (budgetSummary.user1_amount || 0) +
                                      (budgetSummary.user2_amount || 0);
                                const spent =
                                  budgetSummary.current_period_spent || 0;
                                const overUnder = totalBudget - spent;
                                const percentage =
                                  totalBudget > 0
                                    ? (spent / totalBudget) * 100
                                    : 0;

                                return {
                                  budgetSummary,
                                  totalBudget,
                                  spent,
                                  overUnder,
                                  percentage,
                                };
                              })
                              .sort((a, b) => b.percentage - a.percentage)
                              .map(
                                ({
                                  budgetSummary,
                                  totalBudget,
                                  spent,
                                  overUnder,
                                  percentage,
                                }) => (
                                  <div
                                    key={budgetSummary.category_id}
                                    className="flex items-center justify-between p-3 bg-muted/20 rounded-lg"
                                  >
                                    <div className="flex items-center space-x-3">
                                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                                        {budgetSummary.category_image ? (
                                          <img
                                            src={budgetSummary.category_image}
                                            alt={budgetSummary.category_name}
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          <div className="w-5 h-5 bg-muted-foreground rounded-full"></div>
                                        )}
                                      </div>
                                      <div>
                                        <p className="font-medium text-sm">
                                          {budgetSummary.category_name}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {formatCurrency(totalBudget)} budget
                                        </p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-sm font-medium">
                                        {formatCurrency(spent)}
                                      </p>
                                      <p
                                        className={`text-xs ${
                                          overUnder < 0
                                            ? "text-red-600"
                                            : "text-green-600"
                                        }`}
                                      >
                                        {formatCurrency(Math.abs(overUnder))}
                                      </p>
                                      <div className="flex items-center space-x-2 mt-1">
                                        <div
                                          className={`w-12 rounded-full h-1 ${
                                            percentage === 0
                                              ? "bg-gray-600"
                                              : "bg-gray-200"
                                          }`}
                                        >
                                          <div
                                            className={`h-1 rounded-full transition-all duration-300 ${
                                              percentage > 100
                                                ? "bg-red-500"
                                                : percentage >= yellowThreshold
                                                ? "bg-yellow-500"
                                                : percentage > 0
                                                ? "bg-green-500"
                                                : "bg-gray-600"
                                            }`}
                                            style={{
                                              width: `${Math.min(
                                                percentage,
                                                100
                                              )}%`,
                                            }}
                                          />
                                        </div>
                                        <span className="text-xs w-8 text-right">
                                          {percentage.toFixed(1)}%
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )
                              )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Orphaned Category Budgets Section */}
          {(() => {
            const orphanedBudgets = getOrphanedBudgetSummaries();
            if (orphanedBudgets.length === 0) return null;

            return (
              <div className="mt-8">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center space-x-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                      <span>Orphaned Category Budgets</span>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      These category budgets exist but their sectors don't have
                      budgets. Consider creating sector budgets to better manage
                      these categories.
                    </p>
                  </CardHeader>
                  <CardContent>
                    {/* Desktop Table View */}
                    <div className="hidden lg:block">
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="text-left py-3 px-4 font-semibold">
                                Category
                              </th>
                              <th className="text-left py-3 px-4 font-semibold">
                                Sector
                              </th>
                              <th className="text-right py-3 px-4 font-semibold">
                                Budget
                              </th>
                              <th className="text-right py-3 px-4 font-semibold">
                                Spent
                              </th>
                              <th className="text-right py-3 px-4 font-semibold">
                                Remaining
                              </th>
                              <th className="text-center py-3 px-4 font-semibold">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {orphanedBudgets.map((budget) => {
                              const category = categories.find(
                                (c) => c.id === budget.category_id
                              );
                              const sector = sectors.find((s) =>
                                s.category_ids.includes(budget.category_id)
                              );
                              const totalBudget =
                                budget.budget_type === "absolute"
                                  ? budget.absolute_amount || 0
                                  : (budget.user1_amount || 0) +
                                    (budget.user2_amount || 0);
                              const spent = budget.current_period_spent || 0;
                              const remaining = totalBudget - spent;

                              return (
                                <tr
                                  key={budget.category_id}
                                  className="border-b hover:bg-muted/20"
                                >
                                  <td className="py-3 px-4">
                                    <div className="flex items-center space-x-2">
                                      {category?.image_url ? (
                                        <img
                                          src={category.image_url}
                                          alt={category.name}
                                          className="w-6 h-6 rounded-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center">
                                          <DollarSign className="h-3 w-3 text-muted-foreground" />
                                        </div>
                                      )}
                                      <span className="font-medium">
                                        {category?.name}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 text-muted-foreground">
                                    {sector?.name || "Unknown"}
                                  </td>
                                  <td className="py-3 px-4 text-right font-medium">
                                    ${totalBudget.toFixed(2)}
                                  </td>
                                  <td className="py-3 px-4 text-right text-muted-foreground">
                                    ${spent.toFixed(2)}
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    <span
                                      className={
                                        remaining >= 0
                                          ? "text-green-600 font-medium"
                                          : "text-red-600 font-medium"
                                      }
                                    >
                                      ${remaining.toFixed(2)}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    {sector && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          onCreateSectorBudget(sector)
                                        }
                                        className="h-8 px-3"
                                      >
                                        <Plus className="h-3 w-3 mr-1" />
                                        Create Sector Budget
                                      </Button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Mobile Card View */}
                    <div className="lg:hidden space-y-3">
                      {orphanedBudgets.map((budget) => {
                        const category = categories.find(
                          (c) => c.id === budget.category_id
                        );
                        const sector = sectors.find((s) =>
                          s.category_ids.includes(budget.category_id)
                        );
                        const totalBudget =
                          budget.budget_type === "absolute"
                            ? budget.absolute_amount || 0
                            : (budget.user1_amount || 0) +
                              (budget.user2_amount || 0);
                        const spent = budget.current_period_spent || 0;
                        const remaining = totalBudget - spent;

                        return (
                          <div
                            key={budget.category_id}
                            className="border rounded-lg p-4"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center space-x-3">
                                {category?.image_url ? (
                                  <img
                                    src={category.image_url}
                                    alt={category.name}
                                    className="w-8 h-8 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                )}
                                <div>
                                  <p className="font-medium">
                                    {category?.name}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    Sector: {sector?.name || "Unknown"}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                              <div>
                                <p className="text-muted-foreground">Budget</p>
                                <p className="font-medium">
                                  ${totalBudget.toFixed(2)}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Spent</p>
                                <p className="text-muted-foreground">
                                  ${spent.toFixed(2)}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">
                                  Remaining
                                </p>
                                <p
                                  className={
                                    remaining >= 0
                                      ? "text-green-600 font-medium"
                                      : "text-red-600 font-medium"
                                  }
                                >
                                  ${remaining.toFixed(2)}
                                </p>
                              </div>
                            </div>
                            {sector && (
                              <div className="flex justify-center">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => onCreateSectorBudget(sector)}
                                  className="w-full"
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Create Sector Budget
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })()}
        </TabsContent>

        {/* Yearly Tab */}
        <TabsContent value="yearly" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Yearly Budgets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <PieChart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
                <p className="text-muted-foreground">
                  Yearly budget planning and tracking will be available soon.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Budget Details Modal */}
      {modalData && (
        <Dialog open={!!modalData} onOpenChange={() => setModalData(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gradient-to-b from-[#004D40] to-[#26A69A] border-none shadow-2xl text-white [&>button]:absolute [&>button]:right-4 [&>button]:top-4 [&>button]:rounded-sm [&>button]:opacity-70 [&>button]:ring-offset-background [&>button]:transition-opacity [&>button]:hover:opacity-100 [&>button]:focus:outline-none [&>button]:focus:ring-2 [&>button]:focus:ring-ring [&>button]:focus:ring-offset-2 [&>button]:disabled:pointer-events-none [&>button]:data-[state=open]:bg-secondary [&>button]:p-2 [&>button_svg]:h-6 [&>button_svg]:w-6">
            <DialogHeader className="border-b border-white/20 pb-4 pt-6">
              <DialogTitle className="text-xl font-semibold text-white">
                {modalData.type === "sector"
                  ? `${modalData.data.sector.name} Budget Details`
                  : `${modalData.data.category?.name} Budget Details`}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6 pt-4">
              {/* Budget Card */}
              {modalData.type === "sector" ? (
                modalData.data.sectorBudget?.budget_id ? (
                  <SectorBudgetCard
                    sectorBudgetSummary={modalData.data.sectorBudget}
                    selectedMonth={selectedMonth}
                    user1AvatarUrl={user1AvatarUrl}
                    user2AvatarUrl={user2AvatarUrl}
                    onEdit={onEditSectorBudget}
                    onDelete={onDeleteSectorBudget}
                    budgetSummaries={budgetSummaries}
                    sectors={sectors}
                  />
                ) : (
                  <div className="text-center py-8">
                    <p className="text-white/80 mb-4">No sector budget found</p>
                    <p className="text-white/60 text-sm mb-4">
                      Transactions are shown below, but spending is not tracked
                      at the sector level without a budget.
                    </p>
                    <Button
                      onClick={() =>
                        onCreateSectorBudget(modalData.data.sector)
                      }
                      className="bg-white/10 hover:bg-white/20 text-white"
                    >
                      Create Sector Budget
                    </Button>
                  </div>
                )
              ) : (
                <BudgetCard
                  budgetSummary={modalData.data.budgetSummary}
                  onEdit={onEditBudget}
                  onDelete={onDeleteBudget}
                  user1AvatarUrl={user1AvatarUrl}
                  user2AvatarUrl={user2AvatarUrl}
                  selectedMonth={selectedMonth}
                  hideTransactionsButton={true}
                />
              )}

              {/* Transactions Section */}
              <div className="border-t border-white/20 pt-6">
                <TransactionList
                  transactions={modalData.transactions}
                  categories={categories}
                  userNames={userNames}
                  showValues={true}
                  deleteTransaction={handleDeleteTransaction}
                  handleSetEditingTransaction={(transaction) => {
                    handleSetEditingTransaction(transaction);
                    setModalData(null); // Close the modal
                    // The navigation will be handled by the handleSetEditingTransaction function
                  }}
                  allTransactions={allTransactions}
                  variant="dialog"
                  showExcludeOption={true}
                  onToggleExclude={onToggleExclude}
                  incomeImageUrl={incomeImageUrl}
                  settlementImageUrl={settlementImageUrl}
                  reimbursementImageUrl={reimbursementImageUrl}
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Sector Budget Confirmation Dialog */}
      <Dialog
        open={deleteSectorDialog.show}
        onOpenChange={() => cancelDeleteSectorBudget()}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Delete Sector Budget
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-foreground">
              Are you sure you want to delete the budget for "
              {deleteSectorDialog.sectorName}"?
            </p>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="delete-category-budgets"
                checked={deleteSectorDialog.deleteCategoryBudgets}
                onCheckedChange={(checked) =>
                  setDeleteSectorDialog((prev) => ({
                    ...prev,
                    deleteCategoryBudgets: checked as boolean,
                  }))
                }
              />
              <Label
                htmlFor="delete-category-budgets"
                className="text-sm text-foreground"
              >
                Also delete all category budgets in this sector
              </Label>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={cancelDeleteSectorBudget}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDeleteSectorBudget}>
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
