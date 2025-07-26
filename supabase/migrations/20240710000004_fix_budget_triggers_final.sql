-- 20240710000004_fix_budget_triggers_final.sql
-- Fix budget triggers to ensure proper split_type calculation

-- Drop any existing triggers that might conflict
drop trigger if exists trigger_create_current_budget_period on public.category_budgets;
drop trigger if exists trigger_handle_budget_changes on public.category_budgets;
drop trigger if exists trigger_handle_budget_delete on public.category_budgets;

-- Create the comprehensive trigger that handles both INSERT and UPDATE operations
create trigger trigger_handle_budget_changes
  after insert or update on public.category_budgets
  for each row
  execute function public.handle_budget_changes();

-- Also create a trigger for DELETE operations to clean up budget_periods
create or replace function public.handle_budget_delete()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Delete all budget periods for this budget
  delete from public.budget_periods
  where category_budget_id = old.id;
  
  return old;
end;
$$;

create trigger trigger_handle_budget_delete
  after delete on public.category_budgets
  for each row
  execute function public.handle_budget_delete(); 