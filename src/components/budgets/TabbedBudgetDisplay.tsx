import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MonthlyBudgetDisplay } from "./MonthlyBudgetDisplay";
import { YearlyBudgetDisplay } from "./YearlyBudgetDisplay";
import {
  Category,
  BudgetSummary,
  Sector,
  SectorBudgetSummary,
  SelectedMonth,
  Transaction,
  YearlyBudgetSummary,
  YearlySectorBudgetSummary,
} from "@/types";
import { TrendingUp, PieChart } from "lucide-react";

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
  onToggleExclude?: (
    transactionId: string,
    excluded: boolean,
    exclusionType: "monthly" | "yearly"
  ) => Promise<void>;
  onTabChange?: (tab: string) => void;
  allTransactions?: Transaction[];
  incomeImageUrl?: string | null;
  settlementImageUrl?: string | null;
  reimbursementImageUrl?: string | null;
  // UI state props
  activeTab?: string;
  expandedSectors?: Set<string>;
  expandedYearlySectors?: Set<string>;
  onExpandedSectorsChange?: (expandedSectors: Set<string>) => void;
  onExpandedYearlySectorsChange?: (expandedSectors: Set<string>) => void;
  // Yearly budget props
  yearlyBudgetSummaries?: YearlyBudgetSummary[];
  yearlySectorBudgetSummaries?: YearlySectorBudgetSummary[];
  selectedYear?: number;
  selectedMonthForProgress?: number;
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
  // UI state props
  activeTab: externalActiveTab,
  expandedSectors: externalExpandedSectors,
  expandedYearlySectors: externalExpandedYearlySectors,
  onExpandedSectorsChange,
  onExpandedYearlySectorsChange,
  // Yearly budget props
  yearlyBudgetSummaries = [],
  yearlySectorBudgetSummaries = [],
  selectedYear = new Date().getFullYear(),
  selectedMonthForProgress = new Date().getMonth() + 1,
  onEditYearlyBudget,
  onDeleteYearlyBudget,
  onEditYearlySectorBudget,
  onDeleteYearlySectorBudget,
  onDeleteYearlySectorBudgetDirect,
  onCreateYearlyBudget,
  onCreateYearlySectorBudget,
  onOpenCategoryModal,
}: TabbedBudgetDisplayProps) {
  // Use external state if provided, otherwise use internal state
  const [internalActiveTab, setInternalActiveTab] = useState("monthly");
  const [internalExpandedSectors, setInternalExpandedSectors] = useState<
    Set<string>
  >(new Set());
  const [internalExpandedYearlySectors, setInternalExpandedYearlySectors] =
    useState<Set<string>>(new Set());

  const activeTab = externalActiveTab ?? internalActiveTab;
  const expandedSectors = externalExpandedSectors ?? internalExpandedSectors;
  const expandedYearlySectors =
    externalExpandedYearlySectors ?? internalExpandedYearlySectors;

  const setActiveTab = (value: string) => {
    if (externalActiveTab !== undefined) {
      onTabChange?.(value);
    } else {
      setInternalActiveTab(value);
      onTabChange?.(value);
    }
  };

  const setExpandedSectors = (value: Set<string>) => {
    if (externalExpandedSectors !== undefined) {
      onExpandedSectorsChange?.(value);
    } else {
      setInternalExpandedSectors(value);
    }
  };

  const setExpandedYearlySectors = (value: Set<string>) => {
    if (externalExpandedYearlySectors !== undefined) {
      onExpandedYearlySectorsChange?.(value);
    } else {
      setInternalExpandedYearlySectors(value);
    }
  };

  return (
    <div className="space-y-6">
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

        {/* Monthly Tab */}
        <TabsContent value="monthly" className="space-y-6">
          <MonthlyBudgetDisplay
            sectors={sectors}
            categories={categories}
            budgetSummaries={budgetSummaries}
            sectorBudgetSummaries={sectorBudgetSummaries}
            selectedMonth={selectedMonth}
            user1AvatarUrl={user1AvatarUrl}
            user2AvatarUrl={user2AvatarUrl}
            onEditBudget={onEditBudget}
            onDeleteBudget={onDeleteBudget}
            onEditSectorBudget={onEditSectorBudget}
            onDeleteSectorBudget={onDeleteSectorBudget}
            onDeleteSectorBudgetDirect={onDeleteSectorBudgetDirect}
            onCreateBudget={onCreateBudget}
            onCreateSectorBudget={onCreateSectorBudget}
            userNames={userNames}
            deleteTransaction={deleteTransaction}
            handleSetEditingTransaction={handleSetEditingTransaction}
            onToggleExclude={onToggleExclude}
            allTransactions={allTransactions}
            incomeImageUrl={incomeImageUrl}
            settlementImageUrl={settlementImageUrl}
            reimbursementImageUrl={reimbursementImageUrl}
            // UI state props
            expandedSectors={expandedSectors}
            onExpandedSectorsChange={setExpandedSectors}
          />
        </TabsContent>

        {/* Yearly Tab */}
        <TabsContent value="yearly" className="space-y-6">
          <YearlyBudgetDisplay
            sectors={sectors}
            categories={categories}
            yearlyBudgetSummaries={yearlyBudgetSummaries}
            yearlySectorBudgetSummaries={yearlySectorBudgetSummaries}
            selectedYear={selectedYear}
            selectedMonthForProgress={selectedMonthForProgress}
            user1AvatarUrl={user1AvatarUrl}
            user2AvatarUrl={user2AvatarUrl}
            onEditYearlyBudget={onEditYearlyBudget}
            onDeleteYearlyBudget={onDeleteYearlyBudget}
            onEditYearlySectorBudget={onEditYearlySectorBudget}
            onDeleteYearlySectorBudget={onDeleteYearlySectorBudget}
            onDeleteYearlySectorBudgetDirect={onDeleteYearlySectorBudgetDirect}
            onCreateYearlyBudget={onCreateYearlyBudget}
            onCreateYearlySectorBudget={onCreateYearlySectorBudget}
            onOpenCategoryModal={onOpenCategoryModal}
            userNames={userNames}
            deleteTransaction={deleteTransaction}
            handleSetEditingTransaction={handleSetEditingTransaction}
            onToggleExclude={onToggleExclude}
            allTransactions={allTransactions}
            incomeImageUrl={incomeImageUrl}
            settlementImageUrl={settlementImageUrl}
            reimbursementImageUrl={reimbursementImageUrl}
            // UI state props
            expandedSectors={expandedYearlySectors}
            onExpandedSectorsChange={setExpandedYearlySectors}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
