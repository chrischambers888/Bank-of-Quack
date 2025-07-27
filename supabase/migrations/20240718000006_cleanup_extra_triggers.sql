-- Clean up the extra triggers I created that are causing conflicts

-- Drop the problematic trigger from the previous migration
drop trigger if exists trigger_auto_recalculate_sector_budget on category_budgets;

-- Drop the function that was causing issues
drop function if exists public.auto_recalculate_sector_budget();

-- Drop the other functions I created unnecessarily
drop function if exists public.recalculate_sector_budget_from_categories(uuid, integer, integer);
drop function if exists public.recalculate_all_sector_budgets_for_month(integer, integer); 