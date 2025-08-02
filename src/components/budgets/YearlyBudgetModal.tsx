import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { YearlySectorBudgetCard } from "./YearlySectorBudgetCard";
import { YearlyCategoryBudgetCard } from "./YearlyCategoryBudgetCard";
import TransactionList from "@/components/TransactionList";
import {
  YearlyBudgetSummary,
  YearlySectorBudgetSummary,
  Sector,
  Category,
  Transaction,
} from "@/types";
import { useBudgetSettings } from "@/hooks/useBudgetSettings";

interface YearlyBudgetModalProps {
  modalData: {
    type: "sector" | "category";
    data: any;
    transactions: Transaction[];
  } | null;
  onClose: () => void;
  selectedYear: number;
  selectedMonthForProgress: number;
  user1AvatarUrl?: string | null;
  user2AvatarUrl?: string | null;
  onEditBudget: (budget: any) => void;
  onDeleteBudget: (categoryId: string) => void;
  onEditSectorBudget: (sectorBudget: YearlySectorBudgetSummary) => void;
  onDeleteSectorBudget: (sectorId: string) => void;
  onCreateSectorBudget: (sector: Sector) => void;
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
  budgetSummaries: YearlyBudgetSummary[];
  sectors: Sector[];
  categories: Category[];
}

export function YearlyBudgetModal({
  modalData,
  onClose,
  selectedYear,
  selectedMonthForProgress,
  user1AvatarUrl,
  user2AvatarUrl,
  onEditBudget,
  onDeleteBudget,
  onEditSectorBudget,
  onDeleteSectorBudget,
  onCreateSectorBudget,
  userNames,
  deleteTransaction,
  handleSetEditingTransaction,
  onToggleExclude,
  allTransactions = [],
  incomeImageUrl,
  settlementImageUrl,
  reimbursementImageUrl,
  budgetSummaries,
  sectors,
  categories,
}: YearlyBudgetModalProps) {
  const { yellowThreshold } = useBudgetSettings();

  if (!modalData) return null;

  // Helper function to format currency
  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return "$0.00";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // Helper function to get month name
  const getMonthName = (month: number) => {
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
    return months[month - 1] || "Unknown";
  };

  return (
    <Dialog open={!!modalData} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gradient-to-b from-[#004D40] to-[#26A69A] border-none shadow-2xl text-white [&>button]:absolute [&>button]:right-4 [&>button]:top-4 [&>button]:rounded-sm [&>button]:opacity-70 [&>button]:ring-offset-background [&>button]:transition-opacity [&>button]:hover:opacity-100 [&>button]:focus:outline-none [&>button]:focus:ring-2 [&>button]:focus:ring-ring [&>button]:focus:ring-offset-2 [&>button]:disabled:pointer-events-none [&>button]:data-[state=open]:bg-secondary [&>button]:p-2 [&>button_svg]:h-6 [&>button_svg]:w-6">
        <DialogHeader className="border-b border-white/20 pb-4 pt-6">
          <DialogTitle className="text-xl font-semibold text-white">
            {modalData.type === "sector"
              ? `${modalData.data.sector.name} Budget Details - ${selectedYear}`
              : `${modalData.data.category?.name} Budget Details - ${selectedYear}`}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 pt-4">
          {/* Budget Card */}
          {modalData.type === "sector" ? (
            modalData.data.sectorBudget?.budget_id ? (
              <>
                <YearlySectorBudgetCard
                  sectorBudgetSummary={modalData.data.sectorBudget}
                  selectedYear={selectedYear}
                  selectedMonthForProgress={selectedMonthForProgress}
                  user1AvatarUrl={user1AvatarUrl}
                  user2AvatarUrl={user2AvatarUrl}
                  onEdit={onEditSectorBudget}
                  onDelete={onDeleteSectorBudget}
                  budgetSummaries={budgetSummaries}
                  sectors={sectors}
                  categories={categories}
                  onEditBudget={onEditBudget}
                  onDeleteBudget={onDeleteBudget}
                  userNames={{ user1: userNames[0], user2: userNames[1] }}
                  getMonthName={getMonthName}
                  formatCurrency={formatCurrency}
                  allTransactions={allTransactions}
                  deleteTransaction={deleteTransaction}
                  handleSetEditingTransaction={handleSetEditingTransaction}
                  onToggleExclude={onToggleExclude}
                  incomeImageUrl={incomeImageUrl}
                  settlementImageUrl={settlementImageUrl}
                  reimbursementImageUrl={reimbursementImageUrl}
                  hideTransactionsButton={true}
                  exclusionType="yearly"
                />
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-white/80">No sector budget found.</p>
              </div>
            )
          ) : modalData.data.budgetSummary?.budget_id ? (
            <>
              <YearlyCategoryBudgetCard
                budgetSummary={modalData.data.budgetSummary}
                selectedYear={selectedYear}
                selectedMonthForProgress={selectedMonthForProgress}
                user1AvatarUrl={user1AvatarUrl}
                user2AvatarUrl={user2AvatarUrl}
                onEdit={onEditBudget}
                onDelete={onDeleteBudget}
                category={modalData.data.category}
                userNames={{ user1: userNames[0], user2: userNames[1] }}
                getMonthName={getMonthName}
                formatCurrency={formatCurrency}
                allTransactions={allTransactions}
                deleteTransaction={deleteTransaction}
                handleSetEditingTransaction={handleSetEditingTransaction}
                onToggleExclude={onToggleExclude}
                incomeImageUrl={incomeImageUrl}
                settlementImageUrl={settlementImageUrl}
                reimbursementImageUrl={reimbursementImageUrl}
                hideTransactionsButton={true}
                categories={categories}
                exclusionType="yearly"
              />

              {/* User Split Progress Bar for Category Budgets */}
              {(() => {
                const budget = modalData.data.budgetSummary;
                const {
                  current_period_user1_spent,
                  current_period_user2_spent,
                  budget_type,
                  user1_amount,
                  user2_amount,
                } = budget;

                // Only show if there's user spending data
                if (
                  (current_period_user1_spent || 0) > 0 ||
                  (current_period_user2_spent || 0) > 0
                ) {
                  return (
                    <div className="bg-white/10 rounded-lg p-4 border border-white/20">
                      <h4 className="text-sm font-medium text-white mb-3">
                        User Spending Breakdown - {selectedYear} (through{" "}
                        {getMonthName(selectedMonthForProgress)})
                      </h4>
                      <div className="text-xs text-white/80 space-y-1">
                        <div className="flex justify-between items-center">
                          <span>
                            {userNames[0]}:{" "}
                            {formatCurrency(current_period_user1_spent)}
                            {budget_type === "split" &&
                              ` / ${formatCurrency(user1_amount)}`}
                          </span>
                          <span>
                            {userNames[1]}:{" "}
                            {formatCurrency(current_period_user2_spent)}
                            {budget_type === "split" &&
                              ` / ${formatCurrency(user2_amount)}`}
                          </span>
                        </div>
                        <div className="relative h-4 bg-gray-600 rounded-full overflow-hidden">
                          {/* User 1 Progress */}
                          <div
                            className="absolute left-0 h-full transition-all duration-300"
                            style={{
                              width: `${
                                ((current_period_user1_spent || 0) /
                                  Math.max(
                                    (current_period_user1_spent || 0) +
                                      (current_period_user2_spent || 0),
                                    1
                                  )) *
                                100
                              }%`,
                              backgroundColor:
                                budget_type === "split"
                                  ? // For split budgets, use color coding based on budget adherence
                                    (budget.current_period_budget === 0 &&
                                      (current_period_user1_spent || 0) > 0) ||
                                    (current_period_user1_spent || 0) >=
                                      (user1_amount || 0)
                                    ? "rgb(239 68 68)"
                                    : (current_period_user1_spent || 0) >=
                                      ((user1_amount || 0) * yellowThreshold) /
                                        100
                                    ? "rgb(234 179 8)"
                                    : "rgb(34 197 94)"
                                  : // For absolute budgets, use neutral gray
                                    "rgb(156 163 175)",
                            }}
                          />
                          {/* User 2 Progress */}
                          <div
                            className="absolute right-0 h-full transition-all duration-300"
                            style={{
                              width: `${
                                ((current_period_user2_spent || 0) /
                                  Math.max(
                                    (current_period_user1_spent || 0) +
                                      (current_period_user2_spent || 0),
                                    1
                                  )) *
                                100
                              }%`,
                              backgroundColor:
                                budget_type === "split"
                                  ? // For split budgets, use color coding based on budget adherence
                                    (budget.current_period_budget === 0 &&
                                      (current_period_user2_spent || 0) > 0) ||
                                    (current_period_user2_spent || 0) >=
                                      (user2_amount || 0)
                                    ? "rgb(239 68 68)"
                                    : (current_period_user2_spent || 0) >=
                                      ((user2_amount || 0) * yellowThreshold) /
                                        100
                                    ? "rgb(234 179 8)"
                                    : "rgb(34 197 94)"
                                  : // For absolute budgets, use neutral gray
                                    "rgb(156 163 175)",
                            }}
                          />
                          {/* User 1 Avatar */}
                          <div
                            className="absolute top-1/2 flex items-center justify-center"
                            style={{
                              left: `calc(${
                                ((current_period_user1_spent || 0) /
                                  Math.max(
                                    (current_period_user1_spent || 0) +
                                      (current_period_user2_spent || 0),
                                    1
                                  )) *
                                100
                              }% / 2)`,
                              transform: "translate(-50%, -50%)",
                            }}
                          >
                            <div className="w-4 h-4 rounded-full flex items-center justify-center overflow-hidden border border-white/20">
                              {user1AvatarUrl ? (
                                <img
                                  src={user1AvatarUrl}
                                  alt={`${userNames[0]} avatar`}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-xs text-white font-bold">
                                  {userNames[0].charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                          </div>
                          {/* User 2 Avatar */}
                          <div
                            className="absolute top-1/2 flex items-center justify-center"
                            style={{
                              left: `calc(${
                                ((current_period_user1_spent || 0) /
                                  Math.max(
                                    (current_period_user1_spent || 0) +
                                      (current_period_user2_spent || 0),
                                    1
                                  )) *
                                100
                              }% + (${
                                ((current_period_user2_spent || 0) /
                                  Math.max(
                                    (current_period_user1_spent || 0) +
                                      (current_period_user2_spent || 0),
                                    1
                                  )) *
                                100
                              }% / 2))`,
                              transform: "translate(-50%, -50%)",
                            }}
                          >
                            <div className="w-4 h-4 rounded-full flex items-center justify-center overflow-hidden border border-white/20">
                              {user2AvatarUrl ? (
                                <img
                                  src={user2AvatarUrl}
                                  alt={`${userNames[1]} avatar`}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-xs text-white font-bold">
                                  {userNames[1].charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                          </div>
                          {/* Dividing Line */}
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-white opacity-80"
                            style={{
                              left: `${
                                ((current_period_user1_spent || 0) /
                                  Math.max(
                                    (current_period_user1_spent || 0) +
                                      (current_period_user2_spent || 0),
                                    1
                                  )) *
                                100
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-white/80">No category budget found.</p>
            </div>
          )}

          {/* Transactions List */}
          <div className="space-y-4">
            <TransactionList
              transactions={modalData.transactions}
              userNames={userNames}
              categories={categories}
              hideIncome={false}
              showExcludeOption={true}
              onToggleExclude={onToggleExclude}
              exclusionType="yearly"
              deleteTransaction={deleteTransaction}
              handleSetEditingTransaction={handleSetEditingTransaction}
              allTransactions={allTransactions}
              variant="dialog"
              showValues={true}
              incomeImageUrl={incomeImageUrl}
              settlementImageUrl={settlementImageUrl}
              reimbursementImageUrl={reimbursementImageUrl}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
