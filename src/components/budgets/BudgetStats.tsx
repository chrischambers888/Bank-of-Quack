import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, Calendar } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface BudgetStatsProps {
  totalBudget: number;
  totalSpent: number;
  totalRemaining: number;
  overallPercentage: number;
  monthName: string;
  excludedSectors: Array<{ name: string }>;
}

export function BudgetStats({
  totalBudget,
  totalSpent,
  totalRemaining,
  overallPercentage,
  monthName,
  excludedSectors,
}: BudgetStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${totalBudget.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">{monthName}'s budget</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {(() => {
              if (excludedSectors.length > 0) {
                const sectorNames = excludedSectors.map((s) => s.name);
                let excludedText;

                if (sectorNames.length === 1) {
                  excludedText = `(excluding ${sectorNames[0]})`;
                } else if (sectorNames.length === 2) {
                  excludedText = `(excluding ${sectorNames[0]} and ${sectorNames[1]})`;
                } else {
                  excludedText = `(excluding ${sectorNames[0]}, ${sectorNames[1]} etc.)`;
                }

                return (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">
                          Total Spent {excludedText}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">
                          Excluded sectors: {sectorNames.join(", ")}
                          <br />
                          This number only counts expenses against budgeted
                          items, minus any excluded transactions
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              }
              return "Total Spent";
            })()}
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${totalSpent.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">
            {overallPercentage.toFixed(1)}% of budget used
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Progress</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div
            className={`text-2xl font-bold ${
              totalRemaining < 0 ? "text-red-600" : "text-green-600"
            }`}
          >
            ${Math.abs(totalRemaining).toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground">
            {totalRemaining < 0 ? "Over budget" : "Available"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
