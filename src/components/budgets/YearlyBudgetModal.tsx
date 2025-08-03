import React, { useState } from "react";
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
import { calculateYearlyBudgetOnTrack } from "./budgetUtils";
import { ChevronDown, ChevronRight } from "lucide-react";

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
  const [isOnTrackExpanded, setIsOnTrackExpanded] = useState(false);

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
          {/* On Track Information */}
          {(() => {
            if (modalData.type === "sector") {
              const sectorBudget = modalData.data.sectorBudget;
              if (sectorBudget?.budget_id) {
                const budgetAmount = sectorBudget.current_period_budget || 0;
                const spent = sectorBudget.current_period_spent || 0;
                const onTrackData = calculateYearlyBudgetOnTrack(
                  budgetAmount,
                  spent,
                  selectedMonthForProgress
                );

                if (budgetAmount > 0) {
                  return (
                    <div className="bg-black/60 rounded-xl border shadow backdrop-blur-sm p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium">
                          On Track Status
                        </span>
                        <div className="flex items-center space-x-2">
                          {(() => {
                            // Determine status based on spending vs implied spend and actual budget
                            let statusText = "On Track";
                            let dotColor = "bg-green-500";
                            let textColor = "text-green-400";

                            if (spent > budgetAmount) {
                              // Over the actual budget
                              statusText = "Over Budget";
                              dotColor = "bg-red-500";
                              textColor = "text-red-400";
                            } else if (spent > onTrackData.shouldBeSpentByNow) {
                              // Ahead of implied spend but not over budget
                              statusText = "Outpacing budget";
                              dotColor = "bg-yellow-500";
                              textColor = "text-yellow-400";
                            }
                            // else: on track (behind implied spend) - default values above

                            return (
                              <>
                                <div
                                  className={`w-4 h-4 rounded-full ${dotColor}`}
                                />
                                <span
                                  className={`text-sm font-medium ${textColor}`}
                                >
                                  {statusText}
                                </span>
                              </>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Expandable On Track Calculation */}
                      <div className="space-y-3">
                        <button
                          onClick={() =>
                            setIsOnTrackExpanded(!isOnTrackExpanded)
                          }
                          className="flex items-center justify-between w-full p-3 bg-black/40 rounded hover:bg-black/50 transition-colors"
                        >
                          <span className="text-xs text-muted-foreground">
                            On Track Calculation
                          </span>
                          {isOnTrackExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>

                        {isOnTrackExpanded && (
                          <div className="bg-black/40 rounded p-3 space-y-2">
                            <div className="text-sm space-y-1">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                  Daily Budget:
                                </span>
                                <span className="font-mono">
                                  {formatCurrency(budgetAmount / 365)}/day
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                  Days Elapsed:
                                </span>
                                <span className="font-mono">
                                  {Math.floor(
                                    (selectedMonthForProgress / 12) * 365
                                  )}{" "}
                                  days
                                </span>
                              </div>
                              <div className="flex justify-between border-t border-white/10 pt-1">
                                <span className="text-muted-foreground">
                                  Implied Spend:
                                </span>
                                <span className="font-mono text-blue-400">
                                  {formatCurrency(
                                    onTrackData.shouldBeSpentByNow
                                  )}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                  Actually Spent:
                                </span>
                                <span className="font-mono">
                                  {formatCurrency(spent)}
                                </span>
                              </div>
                              <div className="flex justify-between border-t border-white/10 pt-1">
                                <span className="text-muted-foreground">
                                  Difference:
                                </span>
                                <span
                                  className={`font-mono ${
                                    spent > onTrackData.shouldBeSpentByNow
                                      ? "text-red-400"
                                      : "text-green-400"
                                  }`}
                                >
                                  {formatCurrency(
                                    Math.abs(onTrackData.difference)
                                  )}{" "}
                                  {spent > onTrackData.shouldBeSpentByNow
                                    ? "over"
                                    : "under"}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
              }
            } else if (modalData.type === "category") {
              const budget = modalData.data.budgetSummary;
              if (budget?.budget_id) {
                const budgetAmount = budget.current_period_budget || 0;
                const spent = budget.current_period_spent || 0;
                const onTrackData = calculateYearlyBudgetOnTrack(
                  budgetAmount,
                  spent,
                  selectedMonthForProgress
                );

                if (budgetAmount > 0) {
                  return (
                    <div className="bg-black/60 rounded-xl border shadow backdrop-blur-sm p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium">
                          On Track Status
                        </span>
                        <div className="flex items-center space-x-2">
                          {(() => {
                            // Determine status based on spending vs implied spend and actual budget
                            let statusText = "On Track";
                            let dotColor = "bg-green-500";
                            let textColor = "text-green-400";

                            if (spent > budgetAmount) {
                              // Over the actual budget
                              statusText = "Over Budget";
                              dotColor = "bg-red-500";
                              textColor = "text-red-400";
                            } else if (spent > onTrackData.shouldBeSpentByNow) {
                              // Ahead of implied spend but not over budget
                              statusText = "Outpacing budget";
                              dotColor = "bg-yellow-500";
                              textColor = "text-yellow-400";
                            }
                            // else: on track (behind implied spend) - default values above

                            return (
                              <>
                                <div
                                  className={`w-4 h-4 rounded-full ${dotColor}`}
                                />
                                <span
                                  className={`text-sm font-medium ${textColor}`}
                                >
                                  {statusText}
                                </span>
                              </>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Expandable On Track Calculation */}
                      <div className="space-y-3">
                        <button
                          onClick={() =>
                            setIsOnTrackExpanded(!isOnTrackExpanded)
                          }
                          className="flex items-center justify-between w-full p-3 bg-black/40 rounded hover:bg-black/50 transition-colors"
                        >
                          <span className="text-xs text-muted-foreground">
                            On Track Calculation
                          </span>
                          {isOnTrackExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>

                        {isOnTrackExpanded && (
                          <div className="bg-black/40 rounded p-3 space-y-2">
                            <div className="text-sm space-y-1">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                  Daily Budget:
                                </span>
                                <span className="font-mono">
                                  {formatCurrency(budgetAmount / 365)}/day
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                  Days Elapsed:
                                </span>
                                <span className="font-mono">
                                  {Math.floor(
                                    (selectedMonthForProgress / 12) * 365
                                  )}{" "}
                                  days
                                </span>
                              </div>
                              <div className="flex justify-between border-t border-white/10 pt-1">
                                <span className="text-muted-foreground">
                                  Implied Spend:
                                </span>
                                <span className="font-mono text-blue-400">
                                  {formatCurrency(
                                    onTrackData.shouldBeSpentByNow
                                  )}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                  Actually Spent:
                                </span>
                                <span className="font-mono">
                                  {formatCurrency(spent)}
                                </span>
                              </div>
                              <div className="flex justify-between border-t border-white/10 pt-1">
                                <span className="text-muted-foreground">
                                  Difference:
                                </span>
                                <span
                                  className={`font-mono ${
                                    spent > onTrackData.shouldBeSpentByNow
                                      ? "text-red-400"
                                      : "text-green-400"
                                  }`}
                                >
                                  {formatCurrency(
                                    Math.abs(onTrackData.difference)
                                  )}{" "}
                                  {spent > onTrackData.shouldBeSpentByNow
                                    ? "over"
                                    : "under"}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
              }
            }
            return null;
          })()}

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
