// src/utils/budgetCalculations.ts
import { Transaction, BudgetSummary, SectorBudgetSummary } from "@/types";
import { parseInputDateLocal } from "@/utils/dateUtils";

// Calculate reimbursements for an expense transaction
const findReimbursementsForExpense = (expenseId: string, allTransactions: Transaction[]) => {
  return allTransactions
    .filter(
      (t) =>
        t.transaction_type === "reimbursement" &&
        t.reimburses_transaction_id === expenseId
    )
    .reduce((sum, r) => sum + r.amount, 0);
};

// Calculate spent amount for a category in a given month
export const calculateCategorySpent = (
  categoryId: string,
  year: number,
  month: number,
  allTransactions: Transaction[]
): number => {
  // Use the same date range logic as the dashboard
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // Last day of the month
  endDate.setHours(23, 59, 59, 999);

  const categoryTransactions = allTransactions.filter(
    (t) => {
      const transactionDate = parseInputDateLocal(t.date);
      return (
        t.category_id === categoryId &&
        t.transaction_type === "expense" &&
        !t.excluded_from_monthly_budget &&
        transactionDate >= startDate &&
        transactionDate <= endDate
      );
    }
  );

  return categoryTransactions.reduce((sum, t) => {
    const reimbursedAmount = findReimbursementsForExpense(t.id, allTransactions);
    return sum + Math.max(0, t.amount - reimbursedAmount);
  }, 0);
};

// Calculate user1 spent amount for a category in a given month
export const calculateCategoryUser1Spent = (
  categoryId: string,
  year: number,
  month: number,
  allTransactions: Transaction[]
): number => {
  // Use the same date range logic as the dashboard
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // Last day of the month
  endDate.setHours(23, 59, 59, 999);

  const categoryTransactions = allTransactions.filter(
    (t) => {
      const transactionDate = parseInputDateLocal(t.date);
      return (
        t.category_id === categoryId &&
        t.transaction_type === "expense" &&
        !t.excluded_from_monthly_budget &&
        transactionDate >= startDate &&
        transactionDate <= endDate
      );
    }
  );

  return categoryTransactions.reduce((sum, t) => {
    const reimbursedAmount = findReimbursementsForExpense(t.id, allTransactions);
    let userExpense = 0;
    
    if (t.split_type === "user1_only") {
      userExpense = t.amount;
    } else if (t.split_type === "splitEqually") {
      userExpense = t.amount / 2;
    }
    
    return sum + Math.max(0, userExpense - reimbursedAmount);
  }, 0);
};

// Calculate user2 spent amount for a category in a given month
export const calculateCategoryUser2Spent = (
  categoryId: string,
  year: number,
  month: number,
  allTransactions: Transaction[]
): number => {
  // Use the same date range logic as the dashboard
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // Last day of the month
  endDate.setHours(23, 59, 59, 999);

  const categoryTransactions = allTransactions.filter(
    (t) => {
      const transactionDate = parseInputDateLocal(t.date);
      return (
        t.category_id === categoryId &&
        t.transaction_type === "expense" &&
        !t.excluded_from_monthly_budget &&
        transactionDate >= startDate &&
        transactionDate <= endDate
      );
    }
  );

  return categoryTransactions.reduce((sum, t) => {
    const reimbursedAmount = findReimbursementsForExpense(t.id, allTransactions);
    let userExpense = 0;
    
    if (t.split_type === "user2_only") {
      userExpense = t.amount;
    } else if (t.split_type === "splitEqually") {
      userExpense = t.amount / 2;
    }
    
    return sum + Math.max(0, userExpense - reimbursedAmount);
  }, 0);
};

// Calculate spent amount for a sector in a given month
export const calculateSectorSpent = (
  sectorCategoryIds: string[],
  year: number,
  month: number,
  allTransactions: Transaction[]
): number => {
  // Use the same date range logic as the dashboard
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // Last day of the month
  endDate.setHours(23, 59, 59, 999);

  const sectorTransactions = allTransactions.filter(
    (t) => {
      const transactionDate = parseInputDateLocal(t.date);
      return (
        sectorCategoryIds.includes(t.category_id!) &&
        t.transaction_type === "expense" &&
        !t.excluded_from_monthly_budget &&
        transactionDate >= startDate &&
        transactionDate <= endDate
      );
    }
  );

  return sectorTransactions.reduce((sum, t) => {
    const reimbursedAmount = findReimbursementsForExpense(t.id, allTransactions);
    return sum + Math.max(0, t.amount - reimbursedAmount);
  }, 0);
};

// Calculate user1 spent amount for a sector in a given month
export const calculateSectorUser1Spent = (
  sectorCategoryIds: string[],
  year: number,
  month: number,
  allTransactions: Transaction[]
): number => {
  // Use the same date range logic as the dashboard
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // Last day of the month
  endDate.setHours(23, 59, 59, 999);

  const sectorTransactions = allTransactions.filter(
    (t) => {
      const transactionDate = parseInputDateLocal(t.date);
      return (
        sectorCategoryIds.includes(t.category_id!) &&
        t.transaction_type === "expense" &&
        !t.excluded_from_monthly_budget &&
        transactionDate >= startDate &&
        transactionDate <= endDate
      );
    }
  );

  return sectorTransactions.reduce((sum, t) => {
    const reimbursedAmount = findReimbursementsForExpense(t.id, allTransactions);
    let userExpense = 0;
    
    if (t.split_type === "user1_only") {
      userExpense = t.amount;
    } else if (t.split_type === "splitEqually") {
      userExpense = t.amount / 2;
    }
    
    return sum + Math.max(0, userExpense - reimbursedAmount);
  }, 0);
};

// Calculate user2 spent amount for a sector in a given month
export const calculateSectorUser2Spent = (
  sectorCategoryIds: string[],
  year: number,
  month: number,
  allTransactions: Transaction[]
): number => {
  // Use the same date range logic as the dashboard
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // Last day of the month
  endDate.setHours(23, 59, 59, 999);

  const sectorTransactions = allTransactions.filter(
    (t) => {
      const transactionDate = parseInputDateLocal(t.date);
      return (
        sectorCategoryIds.includes(t.category_id!) &&
        t.transaction_type === "expense" &&
        !t.excluded_from_monthly_budget &&
        transactionDate >= startDate &&
        transactionDate <= endDate
      );
    }
  );

  return sectorTransactions.reduce((sum, t) => {
    const reimbursedAmount = findReimbursementsForExpense(t.id, allTransactions);
    let userExpense = 0;
    
    if (t.split_type === "user2_only") {
      userExpense = t.amount;
    } else if (t.split_type === "splitEqually") {
      userExpense = t.amount / 2;
    }
    
    return sum + Math.max(0, userExpense - reimbursedAmount);
  }, 0);
};

// Calculate budget amount from budget summary
export const calculateBudgetAmount = (budget: BudgetSummary | SectorBudgetSummary): number => {
  if (budget.budget_type === "absolute") {
    return budget.absolute_amount || 0;
  } else if (budget.budget_type === "split") {
    return (budget.user1_amount || 0) + (budget.user2_amount || 0);
  }
  return 0;
};

// Calculate remaining percentage
export const calculateRemainingPercentage = (budgetAmount: number, spentAmount: number): number | null => {
  if (budgetAmount > 0) {
    return Math.round(((budgetAmount - spentAmount) / budgetAmount) * 100 * 100) / 100;
  }
  return null;
};

// Calculate remaining amount
export const calculateRemainingAmount = (budgetAmount: number, spentAmount: number): number | null => {
  if (budgetAmount > 0) {
    return budgetAmount - spentAmount;
  }
  return null;
};

// Yearly budget calculation functions

// Calculate spent amount for a category in a given year up to a specific month
export const calculateYearlyCategorySpent = (
  categoryId: string,
  year: number,
  month: number,
  allTransactions: Transaction[]
): number => {
  // Calculate spent from January to the selected month
  const startDate = new Date(year, 0, 1); // January 1st of the year
  const endDate = new Date(year, month, 0); // Last day of the selected month
  endDate.setHours(23, 59, 59, 999);

  const categoryTransactions = allTransactions.filter(
    (t) => {
      const transactionDate = parseInputDateLocal(t.date);
      return (
        t.category_id === categoryId &&
        t.transaction_type === "expense" &&
        !t.excluded_from_yearly_budget &&
        transactionDate >= startDate &&
        transactionDate <= endDate
      );
    }
  );

  return categoryTransactions.reduce((sum, t) => {
    const reimbursedAmount = findReimbursementsForExpense(t.id, allTransactions);
    return sum + Math.max(0, t.amount - reimbursedAmount);
  }, 0);
};

// Calculate user1 spent amount for a category in a given year up to a specific month
export const calculateYearlyCategoryUser1Spent = (
  categoryId: string,
  year: number,
  month: number,
  allTransactions: Transaction[]
): number => {
  // Calculate spent from January to the selected month
  const startDate = new Date(year, 0, 1); // January 1st of the year
  const endDate = new Date(year, month, 0); // Last day of the selected month
  endDate.setHours(23, 59, 59, 999);

  const categoryTransactions = allTransactions.filter(
    (t) => {
      const transactionDate = parseInputDateLocal(t.date);
      return (
        t.category_id === categoryId &&
        t.transaction_type === "expense" &&
        !t.excluded_from_yearly_budget &&
        transactionDate >= startDate &&
        transactionDate <= endDate
      );
    }
  );

  return categoryTransactions.reduce((sum, t) => {
    const reimbursedAmount = findReimbursementsForExpense(t.id, allTransactions);
    let userExpense = 0;
    
    if (t.split_type === "user1_only") {
      userExpense = t.amount;
    } else if (t.split_type === "splitEqually") {
      userExpense = t.amount / 2;
    }
    
    return sum + Math.max(0, userExpense - reimbursedAmount);
  }, 0);
};

// Calculate user2 spent amount for a category in a given year up to a specific month
export const calculateYearlyCategoryUser2Spent = (
  categoryId: string,
  year: number,
  month: number,
  allTransactions: Transaction[]
): number => {
  // Calculate spent from January to the selected month
  const startDate = new Date(year, 0, 1); // January 1st of the year
  const endDate = new Date(year, month, 0); // Last day of the selected month
  endDate.setHours(23, 59, 59, 999);

  const categoryTransactions = allTransactions.filter(
    (t) => {
      const transactionDate = parseInputDateLocal(t.date);
      return (
        t.category_id === categoryId &&
        t.transaction_type === "expense" &&
        !t.excluded_from_yearly_budget &&
        transactionDate >= startDate &&
        transactionDate <= endDate
      );
    }
  );

  return categoryTransactions.reduce((sum, t) => {
    const reimbursedAmount = findReimbursementsForExpense(t.id, allTransactions);
    let userExpense = 0;
    
    if (t.split_type === "user2_only") {
      userExpense = t.amount;
    } else if (t.split_type === "splitEqually") {
      userExpense = t.amount / 2;
    }
    
    return sum + Math.max(0, userExpense - reimbursedAmount);
  }, 0);
};

// Calculate spent amount for a sector in a given year up to a specific month
export const calculateYearlySectorSpent = (
  sectorCategoryIds: string[],
  year: number,
  month: number,
  allTransactions: Transaction[]
): number => {
  // Calculate spent from January to the selected month
  const startDate = new Date(year, 0, 1); // January 1st of the year
  const endDate = new Date(year, month, 0); // Last day of the selected month
  endDate.setHours(23, 59, 59, 999);

  const sectorTransactions = allTransactions.filter(
    (t) => {
      const transactionDate = parseInputDateLocal(t.date);
      return (
        sectorCategoryIds.includes(t.category_id!) &&
        t.transaction_type === "expense" &&
        !t.excluded_from_yearly_budget &&
        transactionDate >= startDate &&
        transactionDate <= endDate
      );
    }
  );

  return sectorTransactions.reduce((sum, t) => {
    const reimbursedAmount = findReimbursementsForExpense(t.id, allTransactions);
    return sum + Math.max(0, t.amount - reimbursedAmount);
  }, 0);
};

// Calculate user1 spent amount for a sector in a given year up to a specific month
export const calculateYearlySectorUser1Spent = (
  sectorCategoryIds: string[],
  year: number,
  month: number,
  allTransactions: Transaction[]
): number => {
  // Calculate spent from January to the selected month
  const startDate = new Date(year, 0, 1); // January 1st of the year
  const endDate = new Date(year, month, 0); // Last day of the selected month
  endDate.setHours(23, 59, 59, 999);

  const sectorTransactions = allTransactions.filter(
    (t) => {
      const transactionDate = parseInputDateLocal(t.date);
      return (
        sectorCategoryIds.includes(t.category_id!) &&
        t.transaction_type === "expense" &&
        !t.excluded_from_yearly_budget &&
        transactionDate >= startDate &&
        transactionDate <= endDate
      );
    }
  );

  return sectorTransactions.reduce((sum, t) => {
    const reimbursedAmount = findReimbursementsForExpense(t.id, allTransactions);
    let userExpense = 0;
    
    if (t.split_type === "user1_only") {
      userExpense = t.amount;
    } else if (t.split_type === "splitEqually") {
      userExpense = t.amount / 2;
    }
    
    return sum + Math.max(0, userExpense - reimbursedAmount);
  }, 0);
};

// Calculate user2 spent amount for a sector in a given year up to a specific month
export const calculateYearlySectorUser2Spent = (
  sectorCategoryIds: string[],
  year: number,
  month: number,
  allTransactions: Transaction[]
): number => {
  // Calculate spent from January to the selected month
  const startDate = new Date(year, 0, 1); // January 1st of the year
  const endDate = new Date(year, month, 0); // Last day of the selected month
  endDate.setHours(23, 59, 59, 999);

  const sectorTransactions = allTransactions.filter(
    (t) => {
      const transactionDate = parseInputDateLocal(t.date);
      return (
        sectorCategoryIds.includes(t.category_id!) &&
        t.transaction_type === "expense" &&
        !t.excluded_from_yearly_budget &&
        transactionDate >= startDate &&
        transactionDate <= endDate
      );
    }
  );

  return sectorTransactions.reduce((sum, t) => {
    const reimbursedAmount = findReimbursementsForExpense(t.id, allTransactions);
    let userExpense = 0;
    
    if (t.split_type === "user2_only") {
      userExpense = t.amount;
    } else if (t.split_type === "splitEqually") {
      userExpense = t.amount / 2;
    }
    
    return sum + Math.max(0, userExpense - reimbursedAmount);
  }, 0);
}; 

// Calculate spent amount for a category in a given year up to previous month (excluding current month)
export const calculateYearlyCategorySpentPreviousMonths = (
  categoryId: string,
  year: number,
  month: number,
  allTransactions: Transaction[]
): number => {
  // Calculate spent from January to the previous month (excluding current month)
  const startDate = new Date(year, 0, 1); // January 1st of the year
  const endDate = new Date(year, month - 1, 0); // Last day of the previous month
  endDate.setHours(23, 59, 59, 999);

  const categoryTransactions = allTransactions.filter(
    (t) => {
      const transactionDate = parseInputDateLocal(t.date);
      return (
        t.category_id === categoryId &&
        t.transaction_type === "expense" &&
        !t.excluded_from_yearly_budget &&
        transactionDate >= startDate &&
        transactionDate <= endDate
      );
    }
  );

  return categoryTransactions.reduce((sum, t) => {
    const reimbursedAmount = findReimbursementsForExpense(t.id, allTransactions);
    return sum + Math.max(0, t.amount - reimbursedAmount);
  }, 0);
};

// Calculate spent amount for a sector in a given year up to previous month (excluding current month)
export const calculateYearlySectorSpentPreviousMonths = (
  sectorCategoryIds: string[],
  year: number,
  month: number,
  allTransactions: Transaction[]
): number => {
  // Calculate spent from January to the previous month (excluding current month)
  const startDate = new Date(year, 0, 1); // January 1st of the year
  const endDate = new Date(year, month - 1, 0); // Last day of the previous month
  endDate.setHours(23, 59, 59, 999);

  const sectorTransactions = allTransactions.filter(
    (t) => {
      const transactionDate = parseInputDateLocal(t.date);
      return (
        sectorCategoryIds.includes(t.category_id!) &&
        t.transaction_type === "expense" &&
        !t.excluded_from_yearly_budget &&
        transactionDate >= startDate &&
        transactionDate <= endDate
      );
    }
  );

  return sectorTransactions.reduce((sum, t) => {
    const reimbursedAmount = findReimbursementsForExpense(t.id, allTransactions);
    return sum + Math.max(0, t.amount - reimbursedAmount);
  }, 0);
}; 