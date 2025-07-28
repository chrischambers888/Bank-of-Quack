// src/pages/DashboardPage.tsx
import React, { useState, useMemo, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, Filter as FilterIcon, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import BottomNavBar from "@/components/dashboard/BottomNavBar";
import BalanceSummary from "../components/dashboard/BalanceSummary";
import ExpensesIncomeNetWidget from "../components/dashboard/TotalExpensesWidget";
import TransactionList from "../components/TransactionList";
import SectorCategoryPieChart from "../components/dashboard/SectorCategoryPieChart";
import FilterSheet from "../components/dashboard/FilterSheet";
import { useTransactionFilters } from "../hooks/useTransactionFilters";
import { Transaction, Category, Sector } from "@/types";
import { Toggle } from "@/components/ui/toggle";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { FilterSummary } from "../components/dashboard/FilterSheet";

interface DashboardPageContext {
  transactions: Transaction[];
  userNames: string[];
  categories: Category[];
  sectors: Sector[];
  sectorCategoryEmptyStateImageUrl?: string;
  incomeImageUrl?: string;
  settlementImageUrl?: string;
  reimbursementImageUrl?: string;
  deleteTransaction: (id: string) => Promise<void>;
  user1AvatarUrl?: string | null;
  user2AvatarUrl?: string | null;
  fabOpen: boolean;
}

const DashboardPage: React.FC = () => {
  const {
    transactions,
    userNames,
    categories,
    sectors,
    sectorCategoryEmptyStateImageUrl,
    incomeImageUrl,
    settlementImageUrl,
    reimbursementImageUrl,
    deleteTransaction,
    user1AvatarUrl,
    user2AvatarUrl,
    fabOpen,
  } = useOutletContext<DashboardPageContext>();

  // Create a custom handleSetEditingTransaction function that uses URL-based approach
  const handleSetEditingTransaction = (transaction: Transaction) => {
    // Navigate to the edit URL with the transaction ID
    window.location.href = `/transactions/${transaction.id}`;
  };

  useEffect(() => {
    // Set the value once on mount and don't update on resize.
    // This prevents the jumpy behavior on mobile when the address bar hides.
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty("--vh", `${vh}px`);
  }, []);

  const {
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    personInvolvementFilter,
    setPersonInvolvementFilter,
    categorySectorFilter,
    setCategorySectorFilter,
    descriptionFilter,
    setDescriptionFilter,
    filteredTransactions,
    isFiltered,
  } = useTransactionFilters(transactions, categories, sectors, userNames);

  const [showValues, setShowValues] = useState(() => {
    const stored = localStorage.getItem("dashboard_show_values");
    return stored === null ? true : stored === "true";
  });

  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  const [hideOptions, setHideOptions] = useState(() => {
    const stored = localStorage.getItem("dashboard_hide_options");
    return stored
      ? JSON.parse(stored)
      : {
          hideAmounts: false,
          hideIncome: false,
          blurSummary: false,
        };
  });

  useEffect(() => {
    localStorage.setItem("dashboard_show_values", showValues.toString());
  }, [showValues]);

  useEffect(() => {
    localStorage.setItem("dashboard_hide_options", JSON.stringify(hideOptions));
  }, [hideOptions]);

  const handleOptionChange =
    (option: keyof typeof hideOptions) => (checked: boolean) => {
      setHideOptions((prev: typeof hideOptions) => ({
        ...prev,
        [option]: checked,
      }));
    };

  if (!transactions) return <div>Loading...</div>;

  const expenseTransactions = filteredTransactions.filter(
    (t) => t.transaction_type === "expense"
  );

  return (
    <div className="bg-gradient-to-b from-[#004D40] to-[#26A69A] text-gray-200 min-h-[calc(var(--vh,1vh)*100)]">
      <div className="relative h-[calc(var(--vh,1vh)*50)] flex items-center justify-center text-center">
        <img
          src="/BankerQuack.png"
          alt="Banker Quack"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none object-[center_30%] sm:object-center z-0"
        />
        <div className="absolute inset-0 bg-black/30 z-0" />
        <h1
          className="text-6xl md:text-8xl font-bold text-yellow-100 z-10"
          style={{
            fontFamily: "'Dancing Script', cursive",
            textShadow: "2px 2px 8px rgba(0,0,0,0.7)",
          }}
        >
          Bank of Quack
        </h1>
      </div>

      {!isFilterSheetOpen && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsFilterSheetOpen(true)}
          className={cn(
            "fixed bottom-28 right-4 z-[60] bg-black/30 text-white rounded-full w-14 h-14 hover:bg-black/50 transition-all duration-300",
            isFiltered && "border-2 border-yellow-400",
            fabOpen && "translate-y-24 opacity-0 pointer-events-none"
          )}
        >
          <FilterIcon />
        </Button>
      )}

      <FilterSheet
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        descriptionFilter={descriptionFilter}
        setDescriptionFilter={setDescriptionFilter}
        personInvolvementFilter={personInvolvementFilter}
        setPersonInvolvementFilter={setPersonInvolvementFilter}
        userNames={userNames}
        categorySectorFilter={categorySectorFilter}
        setCategorySectorFilter={setCategorySectorFilter}
        categories={categories}
        sectors={sectors}
        isOpen={isFilterSheetOpen}
        setIsOpen={setIsFilterSheetOpen}
        isFiltered={isFiltered}
      />

      <div className="max-w-4xl mx-auto w-full p-4 relative z-20">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center justify-between w-full gap-2 sm:gap-4 md:gap-6">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-white">Dashboard</h2>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/10"
                    aria-label="Hide options"
                  >
                    {hideOptions.hideAmounts ||
                    hideOptions.hideIncome ||
                    hideOptions.blurSummary ? (
                      <EyeOff />
                    ) : (
                      <Eye />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-4 space-y-3" align="end">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="hide-amounts"
                      checked={hideOptions.hideAmounts}
                      onCheckedChange={handleOptionChange("hideAmounts")}
                    />
                    <label
                      htmlFor="hide-amounts"
                      className="text-sm cursor-pointer select-none"
                    >
                      Hide all amounts
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="hide-income"
                      checked={hideOptions.hideIncome}
                      onCheckedChange={handleOptionChange("hideIncome")}
                    />
                    <label
                      htmlFor="hide-income"
                      className="text-sm cursor-pointer select-none"
                    >
                      Hide income & net saved
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="blur-summary"
                      checked={hideOptions.blurSummary}
                      onCheckedChange={handleOptionChange("blurSummary")}
                    />
                    <label
                      htmlFor="blur-summary"
                      className="text-sm cursor-pointer select-none"
                    >
                      Blur summary numbers
                    </label>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <FilterSummary
              startDate={startDate}
              endDate={endDate}
              personInvolvementFilter={personInvolvementFilter}
              userNames={userNames}
              categorySectorFilter={categorySectorFilter}
              categories={categories}
              sectors={sectors}
              descriptionFilter={descriptionFilter}
              isFiltered={true}
              dashboardMode={true}
              className="ml-1 sm:ml-4"
            />
          </div>
        </div>
        <div className="space-y-4">
          <BalanceSummary
            transactions={
              hideOptions.hideIncome
                ? filteredTransactions.filter(
                    (t) => t.transaction_type !== "income"
                  )
                : filteredTransactions
            }
            allTransactions={transactions}
            userNames={userNames}
            user1AvatarUrl={user1AvatarUrl || null}
            user2AvatarUrl={user2AvatarUrl || null}
            showValues={!hideOptions.hideAmounts}
          />
          <ExpensesIncomeNetWidget
            transactions={filteredTransactions}
            allTransactions={transactions}
            userNames={userNames}
            showValues={!hideOptions.hideAmounts}
            personInvolvementFilter={personInvolvementFilter}
            hideIncome={hideOptions.hideIncome}
            blurSummary={hideOptions.blurSummary}
          />
          <SectorCategoryPieChart
            sectors={sectors}
            categories={categories}
            transactions={filteredTransactions}
            allTransactions={transactions}
            emptyStateImageUrl={sectorCategoryEmptyStateImageUrl}
            showValues={!hideOptions.hideAmounts}
            deleteTransaction={deleteTransaction}
            userNames={userNames}
            incomeImageUrl={incomeImageUrl}
            settlementImageUrl={settlementImageUrl}
            reimbursementImageUrl={reimbursementImageUrl}
            handleSetEditingTransaction={handleSetEditingTransaction}
            personInvolvementFilter={personInvolvementFilter}
          />
          <Card>
            <CardContent className="pt-6">
              <TransactionList
                transactions={
                  hideOptions.hideIncome
                    ? filteredTransactions.filter(
                        (t) => t.transaction_type !== "income"
                      )
                    : filteredTransactions
                }
                categories={categories}
                userNames={userNames}
                showValues={!hideOptions.hideAmounts}
                incomeImageUrl={incomeImageUrl}
                settlementImageUrl={settlementImageUrl}
                reimbursementImageUrl={reimbursementImageUrl}
                deleteTransaction={deleteTransaction}
                handleSetEditingTransaction={handleSetEditingTransaction}
                allTransactions={transactions}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
