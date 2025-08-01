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
  if (!modalData) return null;

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
                  getMonthName={(month: number) => {
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
                  }}
                  formatCurrency={(amount: number | null | undefined) => {
                    if (amount === null || amount === undefined) return "$0.00";
                    return new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                    }).format(amount);
                  }}
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
              getMonthName={(month: number) => {
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
              }}
              formatCurrency={(amount: number | null | undefined) => {
                if (amount === null || amount === undefined) return "$0.00";
                return new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                }).format(amount);
              }}
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
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
