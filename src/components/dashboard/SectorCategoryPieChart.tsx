import React, { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  ChartContainer,
  ChartStyle,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { PieChart, Pie, Sector as RechartsSector, Label } from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import TransactionList from "@/components/TransactionList";
import { Transaction, Category, Sector as SectorType } from "@/types";
import { formatMoney } from "@/lib/utils";

const CHART_COLORS = [
  "#26A69A", // Teal
  "#80CBC4", // Light Teal
  "#B2DFDB", // Pale Teal
  "#FFF176", // Bright Yellow
  "#FFEB3B", // Standard Yellow
  "#FFD54F", // Gold Yellow
  "#AED581", // Light Green
  "#004D40", // Deep Teal (background match)
];

interface SectorCategoryPieChartProps {
  transactions: Transaction[];
  allTransactions: Transaction[];
  categories: Category[];
  sectors: SectorType[];
  showValues?: boolean;
  emptyStateImageUrl?: string;
  deleteTransaction: (id: string) => Promise<void>;
  userNames: string[];
  incomeImageUrl?: string;
  settlementImageUrl?: string;
  reimbursementImageUrl?: string;
  handleSetEditingTransaction: (transaction: Transaction) => void;
  personInvolvementFilter: { user1: boolean; user2: boolean; shared: boolean };
}

const SectorCategoryPieChart: React.FC<SectorCategoryPieChartProps> = ({
  transactions,
  allTransactions,
  categories,
  sectors,
  showValues = true,
  emptyStateImageUrl,
  deleteTransaction,
  userNames,
  incomeImageUrl,
  settlementImageUrl,
  reimbursementImageUrl,
  handleSetEditingTransaction,
  personInvolvementFilter,
}) => {
  // Find categories not linked to any sector
  const unlinkedCategories = categories.filter(
    (cat) => !sectors.some((sector) => sector.category_ids.includes(cat.id))
  );

  const sectorTotals = useMemo(() => {
    const map: Record<string, number> = {};
    const expenseTransactions = transactions.filter(
      (t) => t.transaction_type === "expense"
    );

    // Determine filter mode
    const onlyUser1Selected =
      personInvolvementFilter.user1 &&
      !personInvolvementFilter.user2 &&
      personInvolvementFilter.shared;
    const onlyUser2Selected =
      !personInvolvementFilter.user1 &&
      personInvolvementFilter.user2 &&
      personInvolvementFilter.shared;

    expenseTransactions.forEach((expense) => {
      const cat = categories.find((c) => c.id === expense.category_id);
      if (!cat) return;
      const sector = sectors.find((s) => s.category_ids.includes(cat.id));
      const reimbursements = allTransactions.filter(
        (t) =>
          t.transaction_type === "reimbursement" &&
          t.reimburses_transaction_id === expense.id
      );
      const reimbursementTotal = reimbursements.reduce(
        (sum, r) => sum + r.amount,
        0
      );
      let netExpense = expense.amount - reimbursementTotal;
      if (netExpense <= 0) return;

      // Apply personInvolvementFilter logic
      let filteredAmount = 0;
      if (onlyUser1Selected) {
        if (expense.split_type === "user1_only") {
          filteredAmount = netExpense;
        } else if (expense.split_type === "splitEqually") {
          filteredAmount = netExpense / 2;
        }
      } else if (onlyUser2Selected) {
        if (expense.split_type === "user2_only") {
          filteredAmount = netExpense;
        } else if (expense.split_type === "splitEqually") {
          filteredAmount = netExpense / 2;
        }
      } else {
        filteredAmount = netExpense;
      }

      if (!sector) {
        map[cat.id] = (map[cat.id] || 0) + filteredAmount;
        return;
      }
      map[sector.id] = (map[sector.id] || 0) + filteredAmount;
    });

    // Compose sector objects for linked sectors
    const sectorObjs = sectors
      .map((s, i) => ({
        id: s.id,
        name: s.name,
        value: map[s.id] || 0,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      }))
      .filter((s) => s.value > 0);

    // Compose sector objects for unlinked categories
    const unlinkedObjs = unlinkedCategories
      .map((cat, i) => ({
        id: cat.id,
        name: cat.name,
        value: map[cat.id] || 0,
        fill: CHART_COLORS[(sectors.length + i) % CHART_COLORS.length],
      }))
      .filter((c) => c.value > 0);

    return [...sectorObjs, ...unlinkedObjs];
  }, [
    transactions,
    categories,
    sectors,
    allTransactions,
    unlinkedCategories,
    personInvolvementFilter,
  ]);

  const getCategoryTotalsForSector = (sectorId: string) => {
    // If sectorId is a sector, show its categories
    const sector = sectors.find((s) => s.id === sectorId);
    if (sector) {
      const map: Record<string, number> = {};
      const expenseTransactions = transactions.filter(
        (t) =>
          t.transaction_type === "expense" &&
          t.category_id &&
          sector.category_ids.includes(t.category_id)
      );
      // Determine filter mode
      const onlyUser1Selected =
        personInvolvementFilter.user1 &&
        !personInvolvementFilter.user2 &&
        personInvolvementFilter.shared;
      const onlyUser2Selected =
        !personInvolvementFilter.user1 &&
        personInvolvementFilter.user2 &&
        personInvolvementFilter.shared;
      expenseTransactions.forEach((expense) => {
        const reimbursements = allTransactions.filter(
          (t) =>
            t.transaction_type === "reimbursement" &&
            t.reimburses_transaction_id === expense.id
        );
        const reimbursementTotal = reimbursements.reduce(
          (sum, r) => sum + r.amount,
          0
        );
        let netExpense = expense.amount - reimbursementTotal;
        if (netExpense <= 0 || !expense.category_id) return;
        // Apply personInvolvementFilter logic
        let filteredAmount = 0;
        if (onlyUser1Selected) {
          if (expense.split_type === "user1_only") {
            filteredAmount = netExpense;
          } else if (expense.split_type === "splitEqually") {
            filteredAmount = netExpense / 2;
          }
        } else if (onlyUser2Selected) {
          if (expense.split_type === "user2_only") {
            filteredAmount = netExpense;
          } else if (expense.split_type === "splitEqually") {
            filteredAmount = netExpense / 2;
          }
        } else {
          filteredAmount = netExpense;
        }
        map[expense.category_id] =
          (map[expense.category_id] || 0) + filteredAmount;
      });
      return (
        sector.category_ids
          .map((catId: string, i: number) => {
            const cat = categories.find((c) => c.id === catId);
            return cat && map[catId]
              ? {
                  id: cat.id,
                  name: cat.name,
                  value: map[catId],
                  fill: CHART_COLORS[i % CHART_COLORS.length],
                  image_url: cat.image_url,
                }
              : null;
          })
          .filter(Boolean) as {
          id: string;
          name: string;
          value: number;
          fill: string;
          image_url?: string;
        }[]
      ).sort((a, b) => b.value - a.value);
    }
    // If sectorId is an unlinked category, show just itself
    const cat = unlinkedCategories.find((c) => c.id === sectorId);
    if (cat) {
      const value = sectorTotals.find((s) => s.id === cat.id)?.value || 0;
      return [
        {
          id: cat.id,
          name: cat.name,
          value,
          fill: CHART_COLORS[
            (sectors.length +
              unlinkedCategories.findIndex((c) => c.id === cat.id)) %
              CHART_COLORS.length
          ],
          image_url: cat.image_url,
        },
      ];
    }
    return [];
  };

  const [selectedSectorId, setSelectedSectorId] = useState<string | "all">(
    "all"
  );

  const pieData =
    selectedSectorId === "all"
      ? sectorTotals
      : getCategoryTotalsForSector(selectedSectorId);

  const chartConfig: ChartConfig = useMemo(() => {
    const config: ChartConfig = {};
    pieData.forEach((item) => {
      config[item.id] = {
        label: item.name,
        color: item.fill,
      };
    });
    return config;
  }, [pieData]);

  const [activeIndex, setActiveIndex] = useState(0);
  React.useEffect(() => {
    setActiveIndex(0);
  }, [selectedSectorId, pieData.length]);

  const sectorOptions = [
    { id: "all", name: "All Sectors" },
    ...sectors.map((s) => ({ id: s.id, name: s.name })),
    ...unlinkedCategories.map((cat) => ({ id: cat.id, name: cat.name })),
  ];

  const renderCenterLabel = ({ viewBox }: any) => {
    if (!pieData[activeIndex]) return null;
    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
      const { cx, cy } = viewBox;
      const amountText = showValues
        ? formatMoney(pieData[activeIndex].value)
        : "•••••";
      const nameText = pieData[activeIndex].name;
      const words = nameText.split(" ");
      let lines = [nameText];
      // If the name is long and has spaces, split it into two lines
      if (nameText.length > 12 && words.length > 1) {
        const midpoint = Math.ceil(words.length / 2);
        lines = [
          words.slice(0, midpoint).join(" "),
          words.slice(midpoint).join(" "),
        ];
      }

      const isMultiLine = lines.length > 1;
      const amountY = isMultiLine ? cy - 14 : cy - 4;
      const nameY = isMultiLine ? cy + 10 : cy + 20;

      return (
        <g>
          <text
            x={cx}
            y={amountY}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-foreground text-2xl font-bold"
            style={{ filter: "drop-shadow(0px 1px 3px rgb(0 0 0 / 0.8))" }}
          >
            {amountText}
          </text>
          <text
            x={cx}
            y={nameY}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-muted-foreground text-base"
            style={{ filter: "drop-shadow(0px 1px 3px rgb(0 0 0 / 0.8))" }}
          >
            {lines.map((line, index) => (
              <tspan x={cx} dy={index > 0 ? "1.2em" : 0} key={index}>
                {line}
              </tspan>
            ))}
          </text>
        </g>
      );
    }
    return null;
  };

  const total = useMemo(
    () => pieData.reduce((sum, item) => sum + item.value, 0),
    [pieData]
  );

  const breakdownSectors = useMemo(() => {
    // For "all", show all sectors and unlinked categories that have values
    if (selectedSectorId === "all") {
      const sectorObjs = sectors.filter((s) =>
        sectorTotals.some((st) => st.id === s.id)
      );
      const unlinkedObjs = unlinkedCategories.filter((cat) =>
        sectorTotals.some((st) => st.id === cat.id)
      );
      // For breakdown, treat unlinked categories as sectors
      return [...sectorObjs, ...unlinkedObjs].sort((a, b) => {
        const aValue = sectorTotals.find((st) => st.id === a.id)?.value || 0;
        const bValue = sectorTotals.find((st) => st.id === b.id)?.value || 0;
        return bValue - aValue;
      });
    } else {
      // If selected is a sector
      const sector = sectors.find((s) => s.id === selectedSectorId);
      if (sector) return [sector];
      // If selected is an unlinked category
      const cat = unlinkedCategories.find((c) => c.id === selectedSectorId);
      if (cat) return [cat];
      return [];
    }
  }, [selectedSectorId, sectors, sectorTotals, unlinkedCategories]);

  const [expandedSectors, setExpandedSectors] = useState<string[]>([]);
  const allExpanded = expandedSectors.length === breakdownSectors.length;

  const handleExpandCollapseAll = () => {
    if (allExpanded) {
      setExpandedSectors([]);
    } else {
      setExpandedSectors(breakdownSectors.map((s) => s.id));
    }
  };

  const [isSheetOpen, setSheetOpen] = useState(false);
  const [sheetTransactions, setSheetTransactions] = useState<Transaction[]>([]);
  const [sheetTitle, setSheetTitle] = useState("");

  // Create a custom deleteTransaction function that updates sheetTransactions
  const handleDeleteTransaction = async (id: string) => {
    await deleteTransaction(id);
    // Remove the deleted transaction from sheetTransactions
    setSheetTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  const handleBreakdownClick = (
    type: "sector" | "category",
    id: string,
    name: string
  ) => {
    let relevantExpenses: Transaction[] = [];
    if (type === "sector") {
      const sector = sectors.find((s) => s.id === id);
      if (sector) {
        relevantExpenses = transactions.filter(
          (t) =>
            t.transaction_type === "expense" &&
            sector.category_ids.includes(t.category_id || "")
        );
      }
    } else {
      relevantExpenses = transactions.filter(
        (t) => t.transaction_type === "expense" && t.category_id === id
      );
    }

    const relevantExpenseIds = relevantExpenses.map((t) => t.id);
    const relevantReimbursements = allTransactions.filter(
      (t) =>
        t.transaction_type === "reimbursement" &&
        t.reimburses_transaction_id &&
        relevantExpenseIds.includes(t.reimburses_transaction_id)
    );

    const finalTransactions = [...relevantExpenses, ...relevantReimbursements];

    setSheetTransactions(finalTransactions);
    setSheetTitle(name);
    setSheetOpen(true);
  };

  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sector & Category Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-6 min-h-[400px]">
          {emptyStateImageUrl ? (
            <img
              src={emptyStateImageUrl}
              alt="No data available"
              className="w-48 h-48 object-contain"
            />
          ) : (
            <p className="text-muted-foreground">
              No expenses in this date range.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Sector & Category Breakdown</CardTitle>
          {breakdownSectors.length > 1 && (
            <Button variant="ghost" size="sm" onClick={handleExpandCollapseAll}>
              {allExpanded ? "Collapse All" : "Expand All"}
            </Button>
          )}
        </div>
        <div className="mt-4">
          <Select value={selectedSectorId} onValueChange={setSelectedSectorId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a sector" />
            </SelectTrigger>
            <SelectContent>
              {sectorOptions.map((opt) => (
                <SelectItem key={opt.id} value={opt.id}>
                  {opt.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-8">
          <ChartContainer
            config={chartConfig}
            className="w-full h-[300px] aspect-square"
          >
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                strokeWidth={2}
                activeIndex={activeIndex}
                onMouseEnter={(_, index) => setActiveIndex(index)}
                activeShape={(props: any) => (
                  <RechartsSector
                    {...props}
                    outerRadius={props.outerRadius + 8}
                  />
                )}
              >
                <Label
                  content={renderCenterLabel}
                  className="fill-foreground text-lg"
                />
              </Pie>
            </PieChart>
          </ChartContainer>

          <Accordion
            type="multiple"
            value={expandedSectors}
            onValueChange={setExpandedSectors}
            className="w-full"
          >
            {breakdownSectors.map((sector) => {
              const sectorTotal =
                sectorTotals.find((s) => s.id === sector.id)?.value || 0;
              const sectorCategories = getCategoryTotalsForSector(sector.id);

              return (
                <AccordionItem key={sector.id} value={sector.id}>
                  <AccordionTrigger>
                    <div className="flex justify-between w-full items-center">
                      <span
                        className="hover:underline"
                        onClick={() =>
                          handleBreakdownClick("sector", sector.id, sector.name)
                        }
                      >
                        {sector.name}
                      </span>
                      <div className="flex items-baseline">
                        <span className="font-bold">
                          {showValues ? formatMoney(sectorTotal) : "•••••"}
                        </span>
                        <span className="text-xs text-muted-foreground ml-2">
                          ({((sectorTotal / total) * 100).toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="flex flex-row flex-wrap gap-4 pt-2 pl-4">
                      {sectorCategories.map((cat) => (
                        <div
                          key={cat.id}
                          className="flex flex-col items-center gap-2 cursor-pointer text-center w-24 group"
                          onClick={() =>
                            handleBreakdownClick("category", cat.id, cat.name)
                          }
                        >
                          <div className="w-16 h-16 rounded-full bg-muted-foreground/10 flex items-center justify-center overflow-hidden border-2 border-yellow-400 transition-colors">
                            {cat.image_url ? (
                              <img
                                src={cat.image_url}
                                alt={cat.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-3xl font-bold">
                                {cat.name.charAt(0)}
                              </span>
                            )}
                          </div>
                          <div className="text-xs">
                            <p
                              className={
                                `font-semibold break-words text-center` +
                                (cat.name.length > 14
                                  ? " text-[11px] leading-tight"
                                  : "")
                              }
                              title={cat.name}
                              style={{ maxHeight: "2.5em", overflow: "hidden" }}
                            >
                              {cat.name}
                            </p>
                            <p>
                              {showValues ? formatMoney(cat.value) : "•••••"}
                            </p>
                            <p className="text-muted-foreground">
                              ({((cat.value / sectorTotal) * 100).toFixed(1)}%)
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      </CardContent>
      <Sheet open={isSheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md p-0 flex flex-col bg-gradient-to-b from-[#004D40] to-[#26A69A] border-none text-white [&>button]:text-white">
          <SheetHeader className="p-4">
            <SheetTitle>Transactions for {sheetTitle}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4">
            <TransactionList
              transactions={sheetTransactions}
              categories={categories}
              userNames={userNames}
              deleteTransaction={handleDeleteTransaction}
              showValues={showValues}
              incomeImageUrl={incomeImageUrl}
              settlementImageUrl={settlementImageUrl}
              reimbursementImageUrl={reimbursementImageUrl}
              handleSetEditingTransaction={handleSetEditingTransaction}
              allTransactions={allTransactions}
              variant="dialog"
            />
          </div>
        </SheetContent>
      </Sheet>
    </Card>
  );
};

export default SectorCategoryPieChart;
