export interface Transaction {
  id: string;
  created_at?: string;
  description: string;
  amount: number;
  date: string;
  transaction_type: string;
  category_id?: string | null;
  category_name?: string | null;
  paid_by_user_id?: string | null;
  paid_by_user_name?: string | null;
  split_type?: string | null;
  paid_to_user_id?: string | null;
  paid_to_user_name?: string | null;
  reimburses_transaction_id?: string | null;
  // For client-side state
  is_new?: boolean;
}

export interface Category {
  id: string;
  name: string;
  image_url?: string;
}

export interface Sector {
  id: string;
  name: string;
  category_ids: string[];
}

// Budget-related interfaces
export interface CategoryBudget {
  id: string;
  category_id: string;
  year: number;
  month: number;
  created_at?: string;
  updated_at?: string;
  budget_type: 'absolute' | 'split';
  absolute_amount?: number;
  user1_amount?: number;
  user2_amount?: number;
}

export interface SectorBudget {
  id: string;
  sector_id: string;
  year: number;
  month: number;
  created_at?: string;
  updated_at?: string;
  budget_type: 'absolute' | 'split';
  absolute_amount?: number;
  user1_amount?: number;
  user2_amount?: number;
  auto_rollup: boolean;
}

// Budget periods are no longer stored in the database - spent amounts are calculated dynamically from transaction data

export interface TransactionWithBudget extends Transaction {
  budget_id?: string;
  budget_type?: 'absolute' | 'split';
  budget_absolute_amount?: number;
  budget_user1_amount?: number;
  budget_user2_amount?: number;
  budget_period_id?: string;
  period_budget_amount?: number;
  period_spent_amount?: number;
  period_user1_spent?: number;
  period_user2_spent?: number;
  budget_remaining_percentage?: number;
  budget_remaining_amount?: number;
}

export interface BudgetSummary {
  category_id: string;
  category_name: string;
  category_image?: string;
  budget_id?: string;
  budget_type?: 'absolute' | 'split';
  absolute_amount?: number;
  user1_amount?: number;
  user2_amount?: number;
  current_year: number;
  current_month: number;
  current_period_budget?: number;
  current_period_spent?: number;
  current_period_user1_spent?: number;
  current_period_user2_spent?: number;
  current_period_remaining_percentage?: number;
  current_period_remaining_amount?: number;
}

export interface SectorBudgetSummary {
  sector_id: string;
  sector_name: string;
  budget_id?: string;
  budget_type?: 'absolute' | 'split';
  absolute_amount?: number;
  user1_amount?: number;
  user2_amount?: number;
  auto_rollup: boolean;
  current_period_budget?: number;
  current_period_spent?: number;
  current_period_user1_spent?: number;
  current_period_user2_spent?: number;
  current_period_remaining_percentage?: number;
  current_period_remaining_amount?: number;
  category_budgets_total: number;
}

export interface BudgetFormData {
  category_id: string;
  budget_type: 'absolute' | 'split';
  absolute_amount?: number;
  user1_amount?: number;
  user2_amount?: number;
}

export interface SectorBudgetFormData {
  sector_id: string;
  budget_type: 'absolute' | 'split';
  absolute_amount?: number;
  user1_amount?: number;
  user2_amount?: number;
  auto_rollup: boolean;
}

// Month navigation types
export interface MonthOption {
  year: number;
  month: number;
  month_name: string;
}

export interface SelectedMonth {
  year: number;
  month: number;
}
