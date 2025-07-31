import {
  Category,
  BudgetSummary,
  Sector,
  SectorBudgetSummary,
  SelectedMonth,
  YearlyBudgetSummary,
  YearlySectorBudgetSummary,
} from "@/types";

export const formatCurrency = (amount: number) => {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const getMonthName = (selectedMonth: SelectedMonth) => {
  const date = new Date(selectedMonth.year, selectedMonth.month - 1, 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

export const getCategoriesForSector = (sector: Sector, categories: Category[]) => {
  return categories.filter((cat) => sector.category_ids.includes(cat.id));
};

export const getBudgetSummariesForSector = (sector: Sector, budgetSummaries: BudgetSummary[]) => {
  return budgetSummaries.filter(
    (budget) => sector.category_ids.includes(budget.category_id) && budget.budget_id
  );
};

export const getSectorBudgetSummary = (sectorId: string, sectorBudgetSummaries: SectorBudgetSummary[]) => {
  return sectorBudgetSummaries.find((summary) => summary.sector_id === sectorId);
};

export const getUnassignedCategories = (sectors: Sector[], categories: Category[]) => {
  const assignedCategoryIds = new Set();
  sectors.forEach((sector) => {
    sector.category_ids.forEach((catId) => assignedCategoryIds.add(catId));
  });
  return categories.filter((cat) => !assignedCategoryIds.has(cat.id));
};

export const getUnassignedBudgetSummaries = (sectors: Sector[], categories: Category[], budgetSummaries: BudgetSummary[]) => {
  const unassignedCategories = getUnassignedCategories(sectors, categories);
  return budgetSummaries.filter(
    (budget) =>
      unassignedCategories.some((cat) => cat.id === budget.category_id) && budget.budget_id
  );
};

export const getOrphanedBudgetSummaries = (sectors: Sector[], budgetSummaries: BudgetSummary[], sectorBudgetSummaries: SectorBudgetSummary[]) => {
  return budgetSummaries.filter((budget) => {
    // Find which sector this category belongs to
    const sector = sectors.find((s) => s.category_ids.includes(budget.category_id));
    if (!sector) return false; // Category not assigned to any sector

    // Check if the sector has a budget
    const sectorBudget = getSectorBudgetSummary(sector.id, sectorBudgetSummaries);
    const sectorHasBudget = sectorBudget?.budget_id;

    // Return true if category has budget but sector doesn't
    return budget.budget_id && !sectorHasBudget;
  });
};

export const getOrphanedYearlyBudgetSummaries = (sectors: Sector[], yearlyBudgetSummaries: YearlyBudgetSummary[], yearlySectorBudgetSummaries: YearlySectorBudgetSummary[]) => {
  return yearlyBudgetSummaries.filter((budget) => {
    // Find which sector this category belongs to
    const sector = sectors.find((s) => s.category_ids.includes(budget.category_id));
    if (!sector) return false; // Category not assigned to any sector

    // Check if the sector has a yearly budget
    const sectorBudget = yearlySectorBudgetSummaries.find((sb) => sb.sector_id === sector.id);
    const sectorHasBudget = sectorBudget?.budget_id;

    // Return true if category has budget but sector doesn't
    return budget.budget_id && !sectorHasBudget;
  });
};

export const getYearlyBudgetStats = (
  sectors: Sector[],
  yearlyBudgetSummaries: YearlyBudgetSummary[],
  yearlySectorBudgetSummaries: YearlySectorBudgetSummary[]
) => {
  // Calculate sector budgets total (only for sectors with budgets)
  const sectorBudgetsTotal = yearlySectorBudgetSummaries.reduce((sum, sectorBudget) => {
    if (!sectorBudget.budget_id) {
      return sum; // Skip sectors without budgets
    }
    const budget =
      sectorBudget.budget_type === "absolute"
        ? sectorBudget.absolute_amount || 0
        : (sectorBudget.user1_amount || 0) + (sectorBudget.user2_amount || 0);
    return sum + budget;
  }, 0);

  // Calculate category budgets total (excluding those covered by sector budgets)
  const activeCategoryBudgets = yearlyBudgetSummaries.filter((b) => b.budget_id);
  const categoryBudgetsTotal = activeCategoryBudgets.reduce((sum, budget) => {
    // Check if this category belongs to a sector with a budget
    const sectorWithBudget = sectors?.find((sector) => {
      if (!sector.category_ids?.includes(budget.category_id)) {
        return false; // Category doesn't belong to this sector
      }
      const sectorBudget = yearlySectorBudgetSummaries.find((sb) => sb.sector_id === sector.id);
      return sectorBudget?.budget_id; // Only exclude if sector has a budget
    });

    if (sectorWithBudget) {
      return sum; // Skip this category budget as it's covered by sector budget
    }

    const budgetAmount =
      budget.budget_type === "absolute"
        ? budget.absolute_amount || 0
        : (budget.user1_amount || 0) + (budget.user2_amount || 0);
    return sum + budgetAmount;
  }, 0);

  // Total budget is sector budgets + category budgets (for categories without sector budgets)
  const totalBudget = sectorBudgetsTotal + categoryBudgetsTotal;

  // Calculate total spent (from both sector and category budgets, with sector priority)
  const sectorSpent = yearlySectorBudgetSummaries.reduce((sum, b) => {
    if (b.budget_id) {
      return sum + (b.current_period_spent || 0);
    }
    return sum;
  }, 0);
  const categorySpent = activeCategoryBudgets.reduce((sum, budget) => {
    // Check if this category belongs to a sector with a budget
    const sectorWithBudget = sectors?.find((sector) => {
      if (!sector.category_ids?.includes(budget.category_id)) {
        return false; // Category doesn't belong to this sector
      }
      const sectorBudget = yearlySectorBudgetSummaries.find((sb) => sb.sector_id === sector.id);
      return sectorBudget?.budget_id; // Only exclude if sector has a budget
    });

    if (sectorWithBudget) {
      return sum; // Skip this category spending as it's covered by sector spending
    }
    return sum + (budget.current_period_spent || 0);
  }, 0);
  const totalSpent = sectorSpent + categorySpent;

  const totalRemaining = totalBudget - totalSpent;
  const overallPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  return {
    totalBudget,
    totalSpent,
    totalRemaining,
    overallPercentage,
  };
};

export const getExcludedYearlySectors = (sectors: Sector[], yearlySectorBudgetSummaries: YearlySectorBudgetSummary[]) => {
  return sectors.filter((sector) => {
    const sectorBudget = yearlySectorBudgetSummaries.find((sb) => sb.sector_id === sector.id);
    // Exclude sectors that don't have yearly budgets
    return !sectorBudget?.budget_id;
  });
};

export const getSectorsWithoutBudgets = (sectors: Sector[], budgetSummaries: BudgetSummary[], sectorBudgetSummaries: SectorBudgetSummary[]) => {
  return sectors.filter((sector) => {
    const sectorBudget = getSectorBudgetSummary(sector.id, sectorBudgetSummaries);
    const sectorHasBudget = sectorBudget?.budget_id;

    // Check if any categories in this sector have budgets
    const sectorCategories = getCategoriesForSector(sector, []);
    const sectorBudgets = getBudgetSummariesForSector(sector, budgetSummaries);
    const hasCategoryBudgets = sectorBudgets.length > 0;

    // Return true if sector has no budget but has categories with budgets
    return !sectorHasBudget && hasCategoryBudgets;
  });
};

export const calculateSectorTotal = (sector: Sector, sectorBudgetSummaries: SectorBudgetSummary[]) => {
  const sectorBudget = getSectorBudgetSummary(sector.id, sectorBudgetSummaries);
  if (sectorBudget?.budget_id) {
    return sectorBudget.budget_type === "absolute"
      ? sectorBudget.absolute_amount || 0
      : (sectorBudget.user1_amount || 0) + (sectorBudget.user2_amount || 0);
  }
  return 0;
};

export const calculateSectorSpent = (sector: Sector, sectorBudgetSummaries: SectorBudgetSummary[]) => {
  const sectorBudget = getSectorBudgetSummary(sector.id, sectorBudgetSummaries);
  return sectorBudget?.current_period_spent || 0;
};

export const getBudgetStats = (
  sectors: Sector[],
  budgetSummaries: BudgetSummary[],
  sectorBudgetSummaries: SectorBudgetSummary[]
) => {
  // Calculate sector budgets total (only for sectors with budgets)
  const sectorBudgetsTotal = sectorBudgetSummaries.reduce((sum, sectorBudget) => {
    if (!sectorBudget.budget_id) {
      return sum; // Skip sectors without budgets
    }
    const budget =
      sectorBudget.budget_type === "absolute"
        ? sectorBudget.absolute_amount || 0
        : (sectorBudget.user1_amount || 0) + (sectorBudget.user2_amount || 0);
    return sum + budget;
  }, 0);

  // Calculate category budgets total
  const activeCategoryBudgets = budgetSummaries.filter((b) => b.budget_id);
  const categoryBudgetsTotal = activeCategoryBudgets.reduce((sum, budget) => {
    // Check if this category belongs to a sector with a budget
    const sectorWithBudget = sectors?.find((sector) => {
      if (!sector.category_ids?.includes(budget.category_id)) {
        return false; // Category doesn't belong to this sector
      }
      const sectorBudget = sectorBudgetSummaries.find((sb) => sb.sector_id === sector.id);
      return sectorBudget?.budget_id; // Only exclude if sector has a budget
    });

    if (sectorWithBudget) {
      return sum; // Skip this category budget as it's covered by sector budget
    }

    const budgetAmount =
      budget.budget_type === "absolute"
        ? budget.absolute_amount || 0
        : (budget.user1_amount || 0) + (budget.user2_amount || 0);
    return sum + budgetAmount;
  }, 0);

  // Total budget is sector budgets + category budgets (for categories without sector budgets)
  const totalBudget = sectorBudgetsTotal + categoryBudgetsTotal;

  // Calculate total spent (from both sector and category budgets)
  const sectorSpent = sectorBudgetSummaries.reduce((sum, b) => {
    // Only include spending from sectors that have budgets
    if (b.budget_id) {
      return sum + (b.current_period_spent || 0);
    }
    return sum;
  }, 0);
  const categorySpent = activeCategoryBudgets.reduce((sum, budget) => {
    // Check if this category belongs to a sector with a budget
    const sectorWithBudget = sectors?.find((sector) => {
      if (!sector.category_ids?.includes(budget.category_id)) {
        return false; // Category doesn't belong to this sector
      }
      const sectorBudget = sectorBudgetSummaries.find((sb) => sb.sector_id === sector.id);
      return sectorBudget?.budget_id; // Only exclude if sector has a budget
    });

    if (sectorWithBudget) {
      return sum; // Skip this category spending as it's covered by sector spending
    }
    return sum + (budget.current_period_spent || 0);
  }, 0);
  const totalSpent = sectorSpent + categorySpent;

  const totalRemaining = totalBudget - totalSpent;
  const overallPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  return { totalBudget, totalSpent, totalRemaining, overallPercentage };
};

export const getExcludedSectors = (sectors: Sector[], sectorBudgetSummaries: SectorBudgetSummary[]) => {
  return sectors.filter((sector) => {
    const sectorBudget = sectorBudgetSummaries.find((sb) => sb.sector_id === sector.id);
    // Exclude sectors that don't have budgets
    return !sectorBudget?.budget_id;
  });
}; 