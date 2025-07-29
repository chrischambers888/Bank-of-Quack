-- 20240727000000_remove_complex_budget_functions.sql
-- Remove complex budget calculation functions since we're moving to client-side calculations

-- Drop the complex budget calculation functions that calculate spent amounts
drop function if exists public.get_budget_summary_for_month(integer, integer);
drop function if exists public.get_sector_budget_summary_for_month(integer, integer);

-- Drop functions that update spent amounts (no longer needed with client-side calculations)
drop function if exists public.update_budget_spent(uuid, integer, integer);
drop function if exists public.update_sector_budget_spent(uuid, integer, integer);
drop function if exists public.handle_transaction_budget_update();
drop function if exists public.auto_update_sector_budget();
drop function if exists public.auto_recalculate_sector_budget();
drop function if exists public.recalculate_sector_budget_from_categories(uuid, integer, integer);
drop function if exists public.recalculate_all_sector_budgets_for_month(integer, integer);
drop function if exists public.recalculate_all_budgets();

-- Drop old budget period functions (no longer used)
drop function if exists public.upsert_budget_periods_for_budget();
drop function if exists public.create_current_budget_period();
drop function if exists public.delete_budget_period_for_month(uuid, integer, integer);

-- Drop old budget change handlers (no longer needed)
drop function if exists public.handle_budget_changes();
drop function if exists public.handle_budget_delete();

-- Drop triggers that depend on the removed functions
drop trigger if exists trigger_auto_recalculate_sector_budget on category_budgets;
drop trigger if exists trigger_auto_update_sector_budget on category_budgets;
drop trigger if exists trigger_transaction_budget_update on transactions;
drop trigger if exists trigger_handle_budget_changes on category_budgets;
drop trigger if exists trigger_handle_budget_delete on category_budgets;
drop trigger if exists trigger_create_current_budget_period on category_budgets;

-- Keep the basic budget creation/management functions since they're still needed
-- (These are used for creating/updating/deleting budgets, not calculating spent amounts)
-- create_budget_for_month, create_sector_budget_for_month, copy_budgets_from_month, etc. remain unchanged

-- Keep sector budget triggers that are still needed for auto-creation/deletion
-- trigger_auto_create_sector_budget, trigger_auto_delete_sector_budget, trigger_roll_down_sector_budget, trigger_validate_sector_budget 