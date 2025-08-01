import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { EmptyStateCard } from "@/components/settings/EmptyStateCard";
import {
  Category,
  YearlyBudgetSummary,
  YearlySectorBudgetSummary,
  Sector,
  Transaction,
} from "@/types";
import {
  Plus,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Calendar,
  Building2,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Edit,
  CheckCircle,
  Circle,
  Trash2,
  PieChart,
  EyeOff,
  ChevronUp,
} from "lucide-react";
import { useBudgetSettings } from "@/hooks/useBudgetSettings";
import { supabase } from "@/supabaseClient";
import {
  formatCurrency,
  getOrphanedYearlyBudgetSummaries,
  getCategoriesForSector,
  getBudgetSummariesForSector,
  getYearlyBudgetStats,
  getExcludedYearlySectors,
} from "./budgetUtils";
import { BudgetStats } from "./BudgetStats";
import { Badge } from "@/components/ui/badge";
import { SectorBudgetCard } from "./SectorBudgetCard";
import { YearlySectorBudgetCard } from "./YearlySectorBudgetCard";
import { YearlyCategoryBudgetCard } from "./YearlyCategoryBudgetCard";
import { YearlyBudgetModal } from "./YearlyBudgetModal";

interface YearlyBudgetDisplayProps {
  sectors: Sector[];
  categories: Category[];
  yearlyBudgetSummaries: YearlyBudgetSummary[];
  yearlySectorBudgetSummaries: YearlySectorBudgetSummary[];
  selectedYear: number;
  selectedMonthForProgress: number;
  user1AvatarUrl?: string | null;
  user2AvatarUrl?: string | null;
  onEditYearlyBudget: (budget: YearlyBudgetSummary) => void;
  onDeleteYearlyBudget: (categoryId: string) => void;
  onEditYearlySectorBudget: (sectorBudget: YearlySectorBudgetSummary) => void;
  onDeleteYearlySectorBudget: (sectorId: string) => void;
  onDeleteYearlySectorBudgetDirect?: (
    sectorId: string,
    deleteCategoryBudgets?: boolean
  ) => Promise<void>;
  onCreateYearlyBudget: (category: Category) => void;
  onCreateYearlySectorBudget: (sector: Sector) => void;
  onOpenCategoryModal: (budgetSummary: YearlyBudgetSummary) => void;
  userNames: string[];
  deleteTransaction: (id: string) => Promise<void>;
  handleSetEditingTransaction: (transaction: any) => void;
  onToggleExclude?: (
    transactionId: string,
    excluded: boolean,
    exclusionType: "monthly" | "yearly"
  ) => Promise<void>;
  allTransactions?: Transaction[];
  incomeImageUrl?: string | null;
  settlementImageUrl?: string | null;
  reimbursementImageUrl?: string | null;
  // UI state props
  expandedSectors?: Set<string>;
  onExpandedSectorsChange?: (expandedSectors: Set<string>) => void;
}

export function YearlyBudgetDisplay({
  sectors,
  categories,
  yearlyBudgetSummaries,
  yearlySectorBudgetSummaries,
  selectedYear,
  selectedMonthForProgress,
  user1AvatarUrl,
  user2AvatarUrl,
  onEditYearlyBudget,
  onDeleteYearlyBudget,
  onEditYearlySectorBudget,
  onDeleteYearlySectorBudget,
  onDeleteYearlySectorBudgetDirect,
  onCreateYearlyBudget,
  onCreateYearlySectorBudget,
  onOpenCategoryModal,
  userNames,
  deleteTransaction,
  handleSetEditingTransaction,
  onToggleExclude,
  allTransactions = [],
  incomeImageUrl,
  settlementImageUrl,
  reimbursementImageUrl,
  // UI state props
  expandedSectors: externalExpandedSectors,
  onExpandedSectorsChange,
}: YearlyBudgetDisplayProps) {
  const { yellowThreshold } = useBudgetSettings();

  // Use external state if provided, otherwise use internal state
  const [internalExpandedSectors, setInternalExpandedSectors] = useState<
    Set<string>
  >(new Set());

  const expandedSectors = externalExpandedSectors ?? internalExpandedSectors;

  const setExpandedSectors = (value: Set<string>) => {
    if (externalExpandedSectors !== undefined) {
      onExpandedSectorsChange?.(value);
    } else {
      setInternalExpandedSectors(value);
    }
  };
  const [modalData, setModalData] = useState<any>(null);
  const [tooltip, setTooltip] = useState<{
    show: boolean;
    message: string;
    x: number;
    y: number;
  }>({
    show: false,
    message: "",
    x: 0,
    y: 0,
  });

  const showTooltip = (
    message: string,
    event: React.MouseEvent | React.TouchEvent
  ) => {
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

  // Helper function to get sectors without yearly budgets
  const getSectorsWithoutYearlyBudgets = (
    sectors: Sector[],
    yearlyBudgetSummaries: YearlyBudgetSummary[],
    yearlySectorBudgetSummaries: YearlySectorBudgetSummary[]
  ) => {
    return sectors.filter((sector) => {
      const sectorBudget = yearlySectorBudgetSummaries.find(
        (sb) => sb.sector_id === sector.id
      );
      const sectorHasBudget = sectorBudget?.budget_id;

      // Check if any categories in this sector have yearly budgets
      const sectorCategories = getCategoriesForSector(sector, categories);
      const sectorBudgets = yearlyBudgetSummaries.filter((budget) =>
        sector.category_ids.includes(budget.category_id)
      );
      const hasCategoryBudgets = sectorBudgets.length > 0;

      // Return true if sector has no budget but has categories with budgets
      return !sectorHasBudget && hasCategoryBudgets;
    });
  };

  const getMonthName = (month: number) => {
    const monthNames = [
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
    return monthNames[month - 1];
  };

  const toggleSectorExpansion = (sectorId: string) => {
    const newExpanded = new Set(expandedSectors);
    if (newExpanded.has(sectorId)) {
      newExpanded.delete(sectorId);
    } else {
      newExpanded.add(sectorId);
    }
    setExpandedSectors(newExpanded);
  };

  // State for excluded transactions
  const [expandedExcludedTransactions, setExpandedExcludedTransactions] =
    useState<Set<string>>(new Set());

  // Get excluded transactions for the selected year
  const getExcludedTransactions = () => {
    const startDate = new Date(selectedYear, 0, 1); // January 1st of selected year
    const endDate = new Date(selectedYear, selectedMonthForProgress, 0); // Last day of current progress month
    endDate.setHours(23, 59, 59, 999);

    return allTransactions.filter((t) => {
      const transactionDate = new Date(t.date);
      return (
        t.excluded_from_yearly_budget &&
        transactionDate >= startDate &&
        transactionDate <= endDate
      );
    });
  };

  const excludedTransactions = getExcludedTransactions();

  const toggleExpandedExcludedTransaction = (transactionId: string) => {
    const newExpanded = new Set(expandedExcludedTransactions);
    if (newExpanded.has(transactionId)) {
      newExpanded.delete(transactionId);
    } else {
      newExpanded.add(transactionId);
    }
    setExpandedExcludedTransactions(newExpanded);
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
        return `Split Equally`;
      case "user1_only":
        return `For ${userNames[0]} Only`;
      case "user2_only":
        return `For ${userNames[1]} Only`;
      default:
        return splitType || "N/A";
    }
  };

  const openSectorModal = async (sector: Sector) => {
    const sectorBudget = yearlySectorBudgetSummaries.find(
      (s) => s.sector_id === sector.id
    );
    const sectorCategories = categories.filter((c) =>
      sector.category_ids.includes(c.id)
    );
    const sectorBudgets = yearlyBudgetSummaries.filter((budget) =>
      sector.category_ids.includes(budget.category_id)
    );

    // Fetch transactions for all categories in the sector up to the current progress month
    const { data: transactions } = await supabase
      .from("transactions")
      .select("*")
      .in("category_id", sector.category_ids)
      .gte("date", `${selectedYear}-01-01`)
      .lt(
        "date",
        `${selectedYear}-${String(selectedMonthForProgress + 1).padStart(
          2,
          "0"
        )}-01`
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

    // Set modal data to open the sector modal with transactions
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

  const openCategoryModal = async (budget: YearlyBudgetSummary) => {
    const category = categories.find((c) => c.id === budget.category_id);

    // Fetch transactions for this specific category up to the current progress month
    const { data: transactions } = await supabase
      .from("transactions")
      .select("*")
      .eq("category_id", budget.category_id)
      .gte("date", `${selectedYear}-01-01`)
      .lt(
        "date",
        `${selectedYear}-${String(selectedMonthForProgress + 1).padStart(
          2,
          "0"
        )}-01`
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

    // Set modal data to open the category modal with transactions
    setModalData({
      type: "category",
      data: {
        budgetSummary: budget,
        category,
      },
      transactions: finalTransactions,
    });
  };

  // If no sectors exist, show a different empty state
  if (sectors.length === 0) {
    return (
      <EmptyStateCard
        icon={Building2}
        title="No Sectors Configured"
        description="Sectors help organize your categories and budgets. Set up sectors in Settings to get started."
        actionText="Go to Settings"
        onAction={() => {
          console.log("Navigate to settings");
        }}
      />
    );
  }

  const stats = getYearlyBudgetStats(
    sectors,
    yearlyBudgetSummaries,
    yearlySectorBudgetSummaries
  );
  const excludedSectors = getExcludedYearlySectors(
    sectors,
    yearlySectorBudgetSummaries
  );

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <BudgetStats
        totalBudget={stats.totalBudget}
        totalSpent={stats.totalSpent}
        totalRemaining={stats.totalRemaining}
        overallPercentage={stats.overallPercentage}
        monthName={`${selectedYear} (Progress through ${getMonthName(
          selectedMonthForProgress
        )})`}
        excludedSectors={excludedSectors}
      />

      {/* Desktop Table View */}
      <div className="hidden lg:block">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Yearly Budgets - {selectedYear} (Progress through{" "}
              {getMonthName(selectedMonthForProgress)})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold">
                      Sector/Category
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
                  {sectors
                    .map((sector) => {
                      const sectorBudget = yearlySectorBudgetSummaries.find(
                        (s) => s.sector_id === sector.id
                      );
                      const sectorCategories = categories.filter((c) =>
                        sector.category_ids.includes(c.id)
                      );
                      const sectorBudgets = yearlyBudgetSummaries.filter(
                        (budget) =>
                          sector.category_ids.includes(budget.category_id)
                      );

                      // Calculate percentage used for sorting
                      const sectorPercentage =
                        sectorBudget?.current_period_budget &&
                        sectorBudget.current_period_budget > 0
                          ? ((sectorBudget.current_period_spent || 0) /
                              sectorBudget.current_period_budget) *
                            100
                          : 0;

                      return {
                        sector,
                        sectorBudget,
                        sectorCategories,
                        sectorBudgets,
                        sectorPercentage,
                      };
                    })
                    .sort((a, b) => {
                      // First sort by whether sector has a defined budget
                      const aHasBudget = !!a.sectorBudget?.budget_id;
                      const bHasBudget = !!b.sectorBudget?.budget_id;

                      if (aHasBudget && !bHasBudget) return -1; // a has budget, b doesn't
                      if (!aHasBudget && bHasBudget) return 1; // b has budget, a doesn't

                      // If both have the same budget status, sort by percentage used
                      return b.sectorPercentage - a.sectorPercentage;
                    })
                    .map(
                      ({
                        sector,
                        sectorBudget,
                        sectorCategories,
                        sectorBudgets,
                      }) => {
                        const isExpanded = expandedSectors.has(sector.id);

                        return (
                          <React.Fragment key={sector.id}>
                            {/* Sector Row */}
                            <tr className="bg-muted/30 hover:bg-muted/50">
                              <td className="py-3 px-4">
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() =>
                                      toggleSectorExpansion(sector.id)
                                    }
                                    className="p-1 hover:bg-muted rounded"
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                  </button>
                                  <Building2 className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-semibold">
                                    {sector.name}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    ({sectorCategories.length} categories)
                                  </span>
                                  {getSectorsWithoutYearlyBudgets(
                                    sectors,
                                    yearlyBudgetSummaries,
                                    yearlySectorBudgetSummaries
                                  ).some((s) => s.id === sector.id) && (
                                    <div
                                      onMouseEnter={(e) =>
                                        showTooltip(
                                          "Sector has categories with yearly budgets but no yearly sector budget",
                                          e
                                        )
                                      }
                                      onMouseLeave={hideTooltip}
                                      onTouchStart={(e) =>
                                        showTooltip(
                                          "Sector has categories with yearly budgets but no yearly sector budget",
                                          e
                                        )
                                      }
                                    >
                                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                    </div>
                                  )}
                                </div>
                              </td>
                              {sectorBudget?.budget_id ? (
                                <>
                                  <td className="py-3 px-4 text-right font-medium">
                                    {formatCurrency(
                                      sectorBudget.current_period_budget || 0
                                    )}
                                  </td>
                                  <td className="py-3 px-4 text-right text-muted-foreground">
                                    {formatCurrency(
                                      sectorBudget.current_period_spent || 0
                                    )}
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    <span
                                      className={
                                        (sectorBudget?.current_period_budget ||
                                          0) -
                                          (sectorBudget?.current_period_spent ||
                                            0) >=
                                        0
                                          ? "text-green-600 font-medium"
                                          : "text-red-600 font-medium"
                                      }
                                    >
                                      {formatCurrency(
                                        Math.abs(
                                          (sectorBudget?.current_period_budget ||
                                            0) -
                                            (sectorBudget?.current_period_spent ||
                                              0)
                                        )
                                      )}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    <div className="flex items-center justify-end space-x-2">
                                      <div
                                        className={`w-16 rounded-full h-2 ${
                                          (sectorBudget?.current_period_budget ||
                                            0) === 0
                                            ? "bg-gray-600"
                                            : "bg-gray-200"
                                        }`}
                                      >
                                        <div
                                          className={`h-2 rounded-full ${
                                            (sectorBudget?.current_period_spent ||
                                              0) /
                                              Math.max(
                                                sectorBudget?.current_period_budget ||
                                                  1,
                                                1
                                              ) >
                                            1
                                              ? "bg-red-500"
                                              : (sectorBudget?.current_period_spent ||
                                                  0) /
                                                  Math.max(
                                                    sectorBudget?.current_period_budget ||
                                                      1,
                                                    1
                                                  ) >=
                                                0.9
                                              ? "bg-yellow-500"
                                              : "bg-green-500"
                                          }`}
                                          style={{
                                            width: `${Math.min(
                                              ((sectorBudget?.current_period_spent ||
                                                0) /
                                                Math.max(
                                                  sectorBudget?.current_period_budget ||
                                                    1,
                                                  1
                                                )) *
                                                100,
                                              100
                                            )}%`,
                                          }}
                                        />
                                      </div>
                                      <span className="text-sm">
                                        {(
                                          ((sectorBudget?.current_period_spent ||
                                            0) /
                                            Math.max(
                                              sectorBudget?.current_period_budget ||
                                                1,
                                              1
                                            )) *
                                          100
                                        ).toFixed(1)}
                                        %
                                      </span>
                                    </div>
                                  </td>
                                  <td className="text-center py-3 px-4">
                                    <div className="flex justify-center">
                                      {sectorBudget?.auto_rollup ? (
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
                                </>
                              ) : (
                                <>
                                  <td className="py-3 px-4 text-right text-muted-foreground">
                                    —
                                  </td>
                                  <td className="py-3 px-4 text-right text-muted-foreground">
                                    —
                                  </td>
                                  <td className="py-3 px-4 text-right text-muted-foreground">
                                    —
                                  </td>
                                  <td className="py-3 px-4 text-center text-muted-foreground">
                                    —
                                  </td>
                                  <td className="py-3 px-4 text-center text-muted-foreground">
                                    —
                                  </td>
                                </>
                              )}
                              <td className="py-3 px-4 text-center">
                                <div className="flex gap-2 justify-center">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openSectorModal(sector)}
                                    className="h-8 px-3"
                                    title="View transactions for this sector"
                                  >
                                    <HelpCircle className="h-3 w-3" />
                                  </Button>
                                  {sectorBudget?.budget_id ? (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          onEditYearlySectorBudget(sectorBudget)
                                        }
                                        className="h-8 px-3"
                                      >
                                        <Edit className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          onDeleteYearlySectorBudget(sector.id)
                                        }
                                        className="h-8 px-3 text-red-500 hover:text-red-400"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </>
                                  ) : (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        onCreateYearlySectorBudget(sector)
                                      }
                                      className="h-8 px-3"
                                    >
                                      <Plus className="h-3 w-3 mr-1" />
                                      Create
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>

                            {/* Category Rows (when expanded) */}
                            {isExpanded && (
                              <>
                                {sectorBudgets.length > 0
                                  ? sectorBudgets
                                      .map((budget) => {
                                        const totalBudget =
                                          budget.budget_type === "absolute"
                                            ? budget.absolute_amount || 0
                                            : (budget.user1_amount || 0) +
                                              (budget.user2_amount || 0);
                                        const spent =
                                          budget.current_period_spent || 0;
                                        const overUnder = totalBudget - spent;
                                        const percentage =
                                          totalBudget > 0
                                            ? (spent / totalBudget) * 100
                                            : 0;

                                        return {
                                          budget,
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
                                          budget,
                                          totalBudget,
                                          spent,
                                          overUnder,
                                          percentage,
                                        }) => (
                                          <tr
                                            key={budget.category_id}
                                            className="hover:bg-muted/20"
                                          >
                                            <td className="py-3 px-4">
                                              <div className="flex items-center space-x-3 ml-8">
                                                {(() => {
                                                  const category =
                                                    categories.find(
                                                      (c) =>
                                                        c.id ===
                                                        budget.category_id
                                                    );
                                                  return category?.image_url ? (
                                                    <img
                                                      src={category.image_url}
                                                      alt={category.name}
                                                      className="w-6 h-6 rounded-full object-cover"
                                                    />
                                                  ) : (
                                                    <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center">
                                                      <DollarSign className="h-3 w-3 text-muted-foreground" />
                                                    </div>
                                                  );
                                                })()}
                                                <span className="font-medium">
                                                  {(() => {
                                                    const category =
                                                      categories.find(
                                                        (c) =>
                                                          c.id ===
                                                          budget.category_id
                                                      );
                                                    return (
                                                      category?.name ||
                                                      "Unknown Category"
                                                    );
                                                  })()}
                                                </span>
                                              </div>
                                            </td>
                                            <td className="py-3 px-4 text-right font-medium">
                                              {formatCurrency(totalBudget)}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                              {formatCurrency(spent)}
                                            </td>
                                            <td
                                              className={`py-3 px-4 text-right font-medium ${
                                                overUnder < 0
                                                  ? "text-red-600"
                                                  : "text-green-600"
                                              }`}
                                            >
                                              {formatCurrency(
                                                Math.abs(overUnder)
                                              )}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                              <div className="flex items-center justify-end space-x-2">
                                                <div
                                                  className={`w-16 rounded-full h-2 ${
                                                    percentage === 0
                                                      ? "bg-gray-600"
                                                      : "bg-gray-200"
                                                  }`}
                                                >
                                                  <div
                                                    className={`h-2 rounded-full ${
                                                      percentage > 100
                                                        ? "bg-red-500"
                                                        : percentage >= 90
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
                                                <span className="text-sm">
                                                  {percentage.toFixed(1)}%
                                                </span>
                                              </div>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                              —
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                              <div className="flex gap-2 justify-center">
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  onClick={() =>
                                                    openCategoryModal(budget)
                                                  }
                                                  className="h-8 px-3"
                                                  title="View transactions for this category"
                                                >
                                                  <HelpCircle className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  onClick={() =>
                                                    onEditYearlyBudget(budget)
                                                  }
                                                  className="h-8 px-3"
                                                >
                                                  <Edit className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  onClick={() =>
                                                    onDeleteYearlyBudget(
                                                      budget.category_id
                                                    )
                                                  }
                                                  className="h-8 px-3 text-red-500 hover:text-red-400"
                                                >
                                                  <Trash2 className="h-3 w-3" />
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

                                  if (unsetCategories.length === 0) return null;

                                  return (
                                    <tr className="bg-muted/20 border-t">
                                      <td colSpan={7} className="py-4 px-4">
                                        <div className="flex justify-center">
                                          <div className="flex flex-wrap justify-center gap-2">
                                            {unsetCategories.map((category) => (
                                              <Button
                                                key={category.id}
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                  onCreateYearlyBudget(category)
                                                }
                                                className="text-xs h-7 px-3"
                                              >
                                                <Plus className="h-3 w-3 mr-1" />
                                                {category.name}
                                              </Button>
                                            ))}
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })()}
                              </>
                            )}
                          </React.Fragment>
                        );
                      }
                    )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-4">
        {/* Sector Budget Cards */}
        {sectors
          .map((sector) => {
            const sectorBudget = yearlySectorBudgetSummaries.find(
              (s) => s.sector_id === sector.id
            );

            // Calculate sector percentage for sorting (same as desktop)
            const sectorTotal = sectorBudget?.current_period_budget || 0;
            const sectorSpent = sectorBudget?.current_period_spent || 0;
            const sectorPercentage =
              sectorTotal > 0 ? (sectorSpent / sectorTotal) * 100 : 0;

            return {
              sector,
              sectorBudget,
              sectorPercentage,
            };
          })
          .sort((a, b) => {
            // First sort by whether sector has a defined budget
            const aHasBudget = !!a.sectorBudget?.budget_id;
            const bHasBudget = !!b.sectorBudget?.budget_id;

            if (aHasBudget && !bHasBudget) return -1; // a has budget, b doesn't
            if (!aHasBudget && bHasBudget) return 1; // b has budget, a doesn't

            // If both have the same budget status, sort by percentage used (descending)
            return b.sectorPercentage - a.sectorPercentage;
          })
          .map(({ sector, sectorBudget }) => {
            // Check if sector has no yearly budget defined (no budget_id) or has a zero yearly budget
            const hasNoBudget = !sectorBudget || !sectorBudget.budget_id;
            const hasZeroBudget =
              sectorBudget &&
              sectorBudget.budget_id &&
              ((sectorBudget.budget_type === "absolute" &&
                (sectorBudget.absolute_amount || 0) === 0) ||
                (sectorBudget.budget_type === "split" &&
                  (sectorBudget.user1_amount || 0) +
                    (sectorBudget.user2_amount || 0) ===
                    0));

            if (hasNoBudget || hasZeroBudget) {
              // Show create budget card for sectors without yearly budgets or with zero yearly budgets
              return (
                <Card key={sector.id} className="border-dashed border-2">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center space-x-2">
                      <Building2 className="h-5 w-5" />
                      <span>{sector.name}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-4">
                      <Button
                        onClick={() => onCreateYearlySectorBudget(sector)}
                        className="w-full"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Create Yearly Sector Budget
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            }

            return (
              <YearlySectorBudgetCard
                key={sector.id}
                sectorBudgetSummary={sectorBudget}
                onEdit={onEditYearlySectorBudget}
                onDelete={onDeleteYearlySectorBudget}
                selectedYear={selectedYear}
                selectedMonthForProgress={selectedMonthForProgress}
                user1AvatarUrl={user1AvatarUrl}
                user2AvatarUrl={user2AvatarUrl}
                budgetSummaries={yearlyBudgetSummaries}
                sectors={sectors}
                isExpanded={expandedSectors.has(sector.id)}
                onToggleExpansion={() => toggleSectorExpansion(sector.id)}
                categories={categories}
                onEditBudget={onEditYearlyBudget}
                onDeleteBudget={onDeleteYearlyBudget}
                userNames={{ user1: userNames[0], user2: userNames[1] }}
                getMonthName={getMonthName}
                formatCurrency={(amount: number | null | undefined) => {
                  if (amount === null || amount === undefined) return "$0.00";
                  return formatCurrency(amount);
                }}
                allTransactions={allTransactions}
                deleteTransaction={deleteTransaction}
                handleSetEditingTransaction={handleSetEditingTransaction}
                onToggleExclude={onToggleExclude}
                incomeImageUrl={incomeImageUrl}
                settlementImageUrl={settlementImageUrl}
                reimbursementImageUrl={reimbursementImageUrl}
              />
            );
          })}
      </div>

      {/* Categories without sector budgets */}
      {(() => {
        const orphanedBudgets = getOrphanedYearlyBudgetSummaries(
          sectors,
          yearlyBudgetSummaries,
          yearlySectorBudgetSummaries
        );

        if (orphanedBudgets.length === 0) {
          return null;
        }

        return (
          <div className="mt-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-foreground">
                  Categories without Sector Budgets
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  These categories have budgets but their sectors don't have
                  yearly budgets set up.
                </p>
              </CardHeader>
              <CardContent>
                {/* Desktop Table View */}
                <div className="hidden lg:block">
                  <div className="rounded-md border">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-muted/20">
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
                        {orphanedBudgets.map((budget: YearlyBudgetSummary) => {
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
                                {formatCurrency(totalBudget)}
                              </td>
                              <td className="py-3 px-4 text-right text-muted-foreground">
                                {formatCurrency(spent)}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span
                                  className={
                                    remaining >= 0
                                      ? "text-green-600 font-medium"
                                      : "text-red-600 font-medium"
                                  }
                                >
                                  {formatCurrency(remaining)}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                {sector && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      onCreateYearlySectorBudget(sector)
                                    }
                                    className="h-8 px-3"
                                  >
                                    <Plus className="h-3 w-3 mr-1" />
                                    Create Yearly Sector Budget
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
                  {orphanedBudgets.map((budget: YearlyBudgetSummary) => {
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
                              <p className="font-medium">{category?.name}</p>
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
                              {formatCurrency(totalBudget)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Spent</p>
                            <p className="text-muted-foreground">
                              {formatCurrency(spent)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Remaining</p>
                            <p
                              className={
                                remaining >= 0
                                  ? "text-green-600 font-medium"
                                  : "text-red-600 font-medium"
                              }
                            >
                              {formatCurrency(remaining)}
                            </p>
                          </div>
                        </div>
                        {sector && (
                          <div className="flex justify-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onCreateYearlySectorBudget(sector)}
                              className="w-full"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Create Yearly Sector Budget
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

      {/* Excluded Transactions Section */}
      {excludedTransactions.length > 0 && (
        <Card className="border border-white/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <EyeOff className="h-5 w-5 text-muted-foreground" />
              Excluded Transactions - {selectedYear}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              These transactions are excluded from yearly budget calculations
              for {selectedYear}
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
                            Excluded from yearly budget
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
                            onToggleExclude?.(transaction.id, false, "yearly")
                          }
                          className="text-xs hidden md:inline-flex"
                        >
                          Include
                        </Button>
                      </div>
                    </div>
                    {/* Mobile expanded view */}
                    <div className="md:hidden">
                      {isExpanded && (
                        <div className="px-3 pb-3 pt-2 border-t border-border bg-muted/20">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                            <div>
                              <strong>Type:</strong>{" "}
                              {transaction.transaction_type}
                            </div>
                            {transaction.transaction_type === "expense" &&
                              transaction.category_id && (
                                <div>
                                  <strong>Category:</strong>{" "}
                                  {categories.find(
                                    (c) => c.id === transaction.category_id
                                  )?.name || "N/A"}
                                </div>
                              )}
                            {transaction.transaction_type === "expense" && (
                              <div>
                                <strong>Paid By:</strong>{" "}
                                {transaction.paid_by_user_name}
                              </div>
                            )}
                            {transaction.transaction_type === "expense" &&
                              transaction.split_type && (
                                <div>
                                  <strong>Split:</strong>{" "}
                                  {getSplitTypeLabel(transaction.split_type)}
                                </div>
                              )}
                          </div>
                          <div className="pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                onToggleExclude?.(
                                  transaction.id,
                                  false,
                                  "yearly"
                                )
                              }
                              className="text-xs w-full"
                            >
                              Include
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal */}
      {modalData && (
        <YearlyBudgetModal
          modalData={modalData}
          onClose={() => setModalData(null)}
          selectedYear={selectedYear}
          selectedMonthForProgress={selectedMonthForProgress}
          user1AvatarUrl={user1AvatarUrl}
          user2AvatarUrl={user2AvatarUrl}
          onEditBudget={onEditYearlyBudget}
          onDeleteBudget={onDeleteYearlyBudget}
          onEditSectorBudget={onEditYearlySectorBudget}
          onDeleteSectorBudget={onDeleteYearlySectorBudget}
          onCreateSectorBudget={onCreateYearlySectorBudget}
          userNames={userNames}
          deleteTransaction={deleteTransaction}
          handleSetEditingTransaction={handleSetEditingTransaction}
          onToggleExclude={onToggleExclude}
          allTransactions={allTransactions}
          incomeImageUrl={incomeImageUrl}
          settlementImageUrl={settlementImageUrl}
          reimbursementImageUrl={reimbursementImageUrl}
          budgetSummaries={yearlyBudgetSummaries}
          sectors={sectors}
          categories={categories}
        />
      )}
    </div>
  );
}
