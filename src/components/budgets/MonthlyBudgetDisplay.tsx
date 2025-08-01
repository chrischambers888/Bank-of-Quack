import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BudgetStats } from "./BudgetStats";
import { BudgetTable } from "./BudgetTable";
import { BudgetModal } from "./BudgetModal";
import { DeleteBudgetDialog } from "./DeleteBudgetDialog";
import { EmptyStateCard } from "@/components/settings/EmptyStateCard";
import {
  Category,
  BudgetSummary,
  Sector,
  SectorBudgetSummary,
  SelectedMonth,
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
} from "lucide-react";
import { useBudgetSettings } from "@/hooks/useBudgetSettings";
import { supabase } from "@/supabaseClient";
import {
  formatCurrency,
  getMonthName,
  getCategoriesForSector,
  getBudgetSummariesForSector,
  getSectorBudgetSummary,
  getUnassignedCategories,
  getUnassignedBudgetSummaries,
  getOrphanedBudgetSummaries,
  getSectorsWithoutBudgets,
  calculateSectorTotal,
  calculateSectorSpent,
  getBudgetStats,
  getExcludedSectors,
} from "./budgetUtils";
import { SectorBudgetCard } from "./SectorBudgetCard";
import { CategoryBudgetCard } from "./CategoryBudgetCard";

interface MonthlyBudgetDisplayProps {
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
  allTransactions?: Transaction[];
  incomeImageUrl?: string | null;
  settlementImageUrl?: string | null;
  reimbursementImageUrl?: string | null;
  // UI state props
  expandedSectors?: Set<string>;
  onExpandedSectorsChange?: (expandedSectors: Set<string>) => void;
}

export function MonthlyBudgetDisplay({
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
  allTransactions = [],
  incomeImageUrl,
  settlementImageUrl,
  reimbursementImageUrl,
  // UI state props
  expandedSectors: externalExpandedSectors,
  onExpandedSectorsChange,
}: MonthlyBudgetDisplayProps) {
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

  const openSectorModal = async (sector: Sector) => {
    const sectorBudget = getSectorBudgetSummary(
      sector.id,
      sectorBudgetSummaries
    );
    const sectorCategories = getCategoriesForSector(sector, categories);
    const sectorBudgets = getBudgetSummariesForSector(sector, budgetSummaries);

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

  const handleDeleteTransaction = async (id: string) => {
    console.log(
      "MonthlyBudgetDisplay handleDeleteTransaction called with id:",
      id
    );

    try {
      // Call the parent's modal-specific delete function
      await deleteTransaction(id);

      // Simply remove the transaction from the modal's transaction list
      if (modalData) {
        setModalData({
          ...modalData,
          transactions: modalData.transactions.filter((t) => t.id !== id),
        });
      }
    } catch (error) {
      console.error("Error in handleDeleteTransaction:", error);
    }
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

  const stats = getBudgetStats(sectors, budgetSummaries, sectorBudgetSummaries);
  const excludedSectors = getExcludedSectors(sectors, sectorBudgetSummaries);

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

      {/* Summary Stats */}
      <BudgetStats
        totalBudget={stats.totalBudget}
        totalSpent={stats.totalSpent}
        totalRemaining={stats.totalRemaining}
        overallPercentage={stats.overallPercentage}
        monthName={getMonthName(selectedMonth)}
        excludedSectors={excludedSectors}
      />

      {/* Desktop Table View */}
      <div className="hidden lg:block">
        <BudgetTable
          sectors={sectors}
          categories={categories}
          budgetSummaries={budgetSummaries}
          sectorBudgetSummaries={sectorBudgetSummaries}
          selectedMonth={selectedMonth}
          expandedSectors={expandedSectors}
          onToggleSectorExpansion={toggleSectorExpansion}
          onOpenSectorModal={openSectorModal}
          onOpenCategoryModal={openCategoryModal}
          onEditBudget={onEditBudget}
          onDeleteBudget={onDeleteBudget}
          onEditSectorBudget={onEditSectorBudget}
          onDeleteSectorBudget={handleDeleteSectorBudget}
          onCreateBudget={onCreateBudget}
          onCreateSectorBudget={onCreateSectorBudget}
          showTooltip={showTooltip}
          hideTooltip={hideTooltip}
        />
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-4">
        {/* Sector Budget Cards */}
        {sectors
          .map((sector) => {
            const sectorBudget = sectorBudgetSummaries.find(
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
            // Check if sector has no budget defined (no budget_id)
            const hasNoBudget = !sectorBudget || !sectorBudget.budget_id;

            if (hasNoBudget) {
              // Show create budget card for sectors without budgets
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
                        onClick={() => onCreateSectorBudget(sector)}
                        className="w-full"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Create Sector Budget
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            }

            // Get category budgets for this sector
            const sectorBudgets = budgetSummaries.filter((budget) =>
              sector.category_ids.includes(budget.category_id)
            );

            return (
              <div key={sector.id}>
                <SectorBudgetCard
                  sectorBudgetSummary={sectorBudget}
                  onEdit={onEditSectorBudget}
                  onDelete={onDeleteSectorBudget}
                  selectedMonth={selectedMonth}
                  user1AvatarUrl={user1AvatarUrl}
                  user2AvatarUrl={user2AvatarUrl}
                  budgetSummaries={budgetSummaries}
                  sectors={sectors}
                  isExpanded={expandedSectors.has(sector.id)}
                  onToggleExpansion={() => {
                    toggleSectorExpansion(sector.id);
                  }}
                  categories={categories}
                  onEditBudget={onEditBudget}
                  onDeleteBudget={onDeleteBudget}
                  userNames={{ user1: userNames[0], user2: userNames[1] }}
                  getMonthName={getMonthName}
                  formatCurrency={(amount: number | null | undefined) =>
                    formatCurrency(amount || 0)
                  }
                  allTransactions={allTransactions}
                  deleteTransaction={deleteTransaction}
                  handleSetEditingTransaction={handleSetEditingTransaction}
                  onToggleExclude={onToggleExclude}
                  incomeImageUrl={incomeImageUrl}
                  settlementImageUrl={settlementImageUrl}
                  reimbursementImageUrl={reimbursementImageUrl}
                />
              </div>
            );
          })}
      </div>

      {/* Orphaned Category Budgets Section */}
      {(() => {
        const orphanedBudgets = getOrphanedBudgetSummaries(
          sectors,
          budgetSummaries,
          sectorBudgetSummaries
        );
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
                                    onClick={() => onCreateSectorBudget(sector)}
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

                    return (
                      <CategoryBudgetCard
                        key={budget.category_id}
                        budgetSummary={budget}
                        onEdit={onEditBudget}
                        onDelete={onDeleteBudget}
                        selectedMonth={selectedMonth}
                        user1AvatarUrl={user1AvatarUrl}
                        user2AvatarUrl={user2AvatarUrl}
                        category={category}
                        userNames={{ user1: userNames[0], user2: userNames[1] }}
                        getMonthName={getMonthName}
                        formatCurrency={(amount: number | null | undefined) => {
                          if (amount === null || amount === undefined)
                            return "$0.00";
                          return formatCurrency(amount);
                        }}
                        allTransactions={allTransactions}
                        deleteTransaction={deleteTransaction}
                        handleSetEditingTransaction={
                          handleSetEditingTransaction
                        }
                        onToggleExclude={onToggleExclude}
                        incomeImageUrl={incomeImageUrl}
                        settlementImageUrl={settlementImageUrl}
                        reimbursementImageUrl={reimbursementImageUrl}
                        categories={categories}
                      />
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })()}

      {/* Budget Details Modal */}
      <BudgetModal
        modalData={modalData}
        onClose={() => setModalData(null)}
        selectedMonth={selectedMonth}
        user1AvatarUrl={user1AvatarUrl}
        user2AvatarUrl={user2AvatarUrl}
        onEditBudget={onEditBudget}
        onDeleteBudget={onDeleteBudget}
        onEditSectorBudget={onEditSectorBudget}
        onDeleteSectorBudget={onDeleteSectorBudget}
        onCreateSectorBudget={onCreateSectorBudget}
        userNames={userNames}
        deleteTransaction={handleDeleteTransaction}
        handleSetEditingTransaction={handleSetEditingTransaction}
        onToggleExclude={onToggleExclude}
        allTransactions={allTransactions}
        incomeImageUrl={incomeImageUrl}
        settlementImageUrl={settlementImageUrl}
        reimbursementImageUrl={reimbursementImageUrl}
        budgetSummaries={budgetSummaries}
        sectors={sectors}
        categories={categories}
      />

      {/* Delete Sector Budget Confirmation Dialog */}
      <DeleteBudgetDialog
        isOpen={deleteSectorDialog.show}
        onClose={cancelDeleteSectorBudget}
        onConfirm={confirmDeleteSectorBudget}
        sectorName={deleteSectorDialog.sectorName}
        deleteCategoryBudgets={deleteSectorDialog.deleteCategoryBudgets}
        onDeleteCategoryBudgetsChange={(checked) =>
          setDeleteSectorDialog((prev) => ({
            ...prev,
            deleteCategoryBudgets: checked,
          }))
        }
      />
    </div>
  );
}
