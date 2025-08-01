import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BudgetCard } from "./BudgetCard";
import { SectorBudgetCard } from "./SectorBudgetCard";
import { CategoryBudgetCard } from "./CategoryBudgetCard";
import TransactionList from "@/components/TransactionList";
import {
  BudgetSummary,
  SectorBudgetSummary,
  Sector,
  Category,
  Transaction,
  SelectedMonth,
} from "@/types";

interface BudgetModalProps {
  modalData: {
    type: "sector" | "category";
    data: any;
    transactions: Transaction[];
  } | null;
  onClose: () => void;
  selectedMonth: SelectedMonth;
  user1AvatarUrl?: string | null;
  user2AvatarUrl?: string | null;
  onEditBudget: (budget: any) => void;
  onDeleteBudget: (categoryId: string) => void;
  onEditSectorBudget: (sectorBudget: SectorBudgetSummary) => void;
  onDeleteSectorBudget: (sectorId: string) => void;
  onCreateSectorBudget: (sector: Sector) => void;
  userNames: string[];
  deleteTransaction: (id: string) => Promise<void>;
  handleSetEditingTransaction: (transaction: any) => void;
  onToggleExclude?: (transactionId: string, excluded: boolean) => Promise<void>;
  allTransactions?: Transaction[];
  incomeImageUrl?: string | null;
  settlementImageUrl?: string | null;
  reimbursementImageUrl?: string | null;
  budgetSummaries: BudgetSummary[];
  sectors: Sector[];
  categories: Category[];
}

export function BudgetModal({
  modalData,
  onClose,
  selectedMonth,
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
}: BudgetModalProps) {
  if (!modalData) return null;

  return (
    <Dialog open={!!modalData} onOpenChange={onClose}>
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
                allTransactions={allTransactions}
                deleteTransaction={deleteTransaction}
                handleSetEditingTransaction={handleSetEditingTransaction}
                onToggleExclude={onToggleExclude}
                incomeImageUrl={incomeImageUrl}
                settlementImageUrl={settlementImageUrl}
                reimbursementImageUrl={reimbursementImageUrl}
                hideTransactionsButton={true}
              />
            ) : (
              <div className="text-center py-8">
                <p className="text-white/80 mb-4">No sector budget found</p>
                <p className="text-white/60 text-sm mb-4">
                  Transactions are shown below, but spending is not tracked at
                  the sector level without a budget.
                </p>
                <Button
                  onClick={() => onCreateSectorBudget(modalData.data.sector)}
                  className="bg-white/10 hover:bg-white/20 text-white"
                >
                  Create Sector Budget
                </Button>
              </div>
            )
          ) : (
            <CategoryBudgetCard
              budgetSummary={modalData.data.budgetSummary}
              onEdit={onEditBudget}
              onDelete={onDeleteBudget}
              selectedMonth={selectedMonth}
              user1AvatarUrl={user1AvatarUrl}
              user2AvatarUrl={user2AvatarUrl}
              category={modalData.data.category}
              userNames={{ user1: userNames[0], user2: userNames[1] }}
              getMonthName={(month: SelectedMonth) => {
                const date = new Date(month.year, month.month - 1, 1);
                return date.toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                });
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
            />
          )}

          {/* Transactions Section */}
          <div className="border-t border-white/20 pt-6">
            <TransactionList
              transactions={modalData.transactions}
              categories={categories}
              userNames={userNames}
              showValues={true}
              deleteTransaction={deleteTransaction}
              handleSetEditingTransaction={(transaction) => {
                handleSetEditingTransaction(transaction);
                onClose(); // Close the modal
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
  );
}
