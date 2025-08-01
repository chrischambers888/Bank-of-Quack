import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { BudgetCard } from "./BudgetCard";
import { SectorBudgetCard } from "./SectorBudgetCard";
import { EmptyStateCard } from "./EmptyStateCard";
import {
  BudgetSummary,
  SectorBudgetSummary,
  Sector,
  Category,
  SelectedMonth,
} from "@/types";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Building2,
  DollarSign,
  Calendar,
} from "lucide-react";

interface HierarchicalBudgetDisplayProps {
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
  onCreateBudget: (category: Category) => void;
  onCreateSectorBudget: (sector: Sector) => void;
  // Transaction-related props
  allTransactions?: Transaction[];
  deleteTransaction?: (id: string) => Promise<void>;
  handleSetEditingTransaction?: (transaction: Transaction) => void;
  onToggleExclude?: (
    transactionId: string,
    excluded: boolean,
    exclusionType: "monthly" | "yearly"
  ) => Promise<void>;
  incomeImageUrl?: string | null;
  settlementImageUrl?: string | null;
  reimbursementImageUrl?: string | null;
}

export function HierarchicalBudgetDisplay({
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
  onCreateBudget,
  onCreateSectorBudget,
  allTransactions = [],
  deleteTransaction,
  handleSetEditingTransaction,
  onToggleExclude,
  incomeImageUrl,
  settlementImageUrl,
  reimbursementImageUrl,
}: HierarchicalBudgetDisplayProps) {
  const [expandedSectors, setExpandedSectors] = useState<Set<string>>(
    new Set()
  );

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
      {/* Sector Budgets */}
      {sectors.map((sector) => {
        const sectorBudget = getSectorBudgetSummary(sector.id);
        const sectorCategories = getCategoriesForSector(sector);
        const sectorBudgets = getBudgetSummariesForSector(sector);
        const sectorTotal = calculateSectorTotal(sector);
        const sectorSpent = calculateSectorSpent(sector);
        const isExpanded = expandedSectors.has(sector.id);

        return (
          <Collapsible
            key={sector.id}
            open={isExpanded}
            onOpenChange={() => toggleSectorExpansion(sector.id)}
          >
            <Card className="border-2 border-muted/20 hover:border-muted/40 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-muted/50"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-lg">{sector.name}</CardTitle>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-sm text-muted-foreground">
                          {sectorCategories.length} categories
                        </span>
                        {sectorBudget?.budget_id && (
                          <>
                            <span className="text-muted-foreground">•</span>
                            <span className="text-sm font-medium">
                              {formatCurrency(sectorTotal)} budget
                            </span>
                            <span className="text-muted-foreground">•</span>
                            <span className="text-sm">
                              {formatCurrency(sectorSpent)} spent
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {!sectorBudget?.budget_id && (
                      <Button
                        size="sm"
                        onClick={() => onCreateSectorBudget(sector)}
                        className="text-xs"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Budget
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CollapsibleContent>
                <CardContent className="pt-0 space-y-4">
                  {/* Sector Budget Card */}
                  {sectorBudget?.budget_id && (
                    <div className="mb-4">
                      <SectorBudgetCard
                        sectorBudgetSummary={sectorBudget}
                        onEdit={onEditSectorBudget}
                        onDelete={onDeleteSectorBudget}
                        selectedMonth={selectedMonth}
                        user1AvatarUrl={user1AvatarUrl}
                        user2AvatarUrl={user2AvatarUrl}
                        allTransactions={allTransactions}
                        deleteTransaction={deleteTransaction}
                        handleSetEditingTransaction={
                          handleSetEditingTransaction
                        }
                        onToggleExclude={onToggleExclude}
                        incomeImageUrl={incomeImageUrl}
                        settlementImageUrl={settlementImageUrl}
                        reimbursementImageUrl={reimbursementImageUrl}
                      />
                    </div>
                  )}

                  {/* Category Budgets */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-muted-foreground">
                        Category Budgets
                      </h4>
                      {sectorCategories.length > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onCreateBudget(sectorCategories[0])}
                          className="text-xs"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add Category Budget
                        </Button>
                      )}
                    </div>

                    {sectorBudgets.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {sectorBudgets.map((budgetSummary) => (
                          <BudgetCard
                            key={budgetSummary.category_id}
                            budgetSummary={budgetSummary}
                            onEdit={onEditBudget}
                            onDelete={onDeleteBudget}
                            user1AvatarUrl={user1AvatarUrl}
                            user2AvatarUrl={user2AvatarUrl}
                            selectedMonth={selectedMonth}
                          />
                        ))}
                      </div>
                    ) : (
                      <EmptyStateCard
                        icon={DollarSign}
                        title="No category budgets set"
                        description="Add budgets for individual categories in this sector to track spending."
                        actionText="Add Category Budget"
                        onAction={() =>
                          sectorCategories.length > 0 &&
                          onCreateBudget(sectorCategories[0])
                        }
                        className="py-6"
                      />
                    )}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}

      {/* Unassigned Categories */}
      {(() => {
        const unassignedCategories = getUnassignedCategories();
        const unassignedBudgets = getUnassignedBudgetSummaries();

        if (unassignedCategories.length === 0) return null;

        return (
          <Card className="border-2 border-muted/20 hover:border-muted/40 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-lg">Other Categories</CardTitle>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-sm text-muted-foreground">
                        {unassignedCategories.length} unassigned categories
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              {unassignedBudgets.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {unassignedBudgets.map((budgetSummary) => (
                    <BudgetCard
                      key={budgetSummary.category_id}
                      budgetSummary={budgetSummary}
                      onEdit={onEditBudget}
                      onDelete={onDeleteBudget}
                      user1AvatarUrl={user1AvatarUrl}
                      user2AvatarUrl={user2AvatarUrl}
                      selectedMonth={selectedMonth}
                    />
                  ))}
                </div>
              ) : (
                <EmptyStateCard
                  icon={DollarSign}
                  title="No budgets for unassigned categories"
                  description="These categories aren't assigned to any sector. You can still create budgets for them."
                  actionText="Add Budget"
                  onAction={() =>
                    unassignedCategories.length > 0 &&
                    onCreateBudget(unassignedCategories[0])
                  }
                  className="py-6"
                />
              )}
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}
