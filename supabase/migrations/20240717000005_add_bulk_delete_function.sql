-- 20240717000005_add_bulk_delete_function.sql
-- Add a function to handle bulk deletion of all budgets for a month

create or replace function public.delete_all_budgets_for_month(
  p_year integer,
  p_month integer
)
returns void
language plpgsql
security definer
as $$
begin
  -- Delete sector budget periods first
  delete from sector_budget_periods
  where sector_budget_id in (
    select id from sector_budgets 
    where year = p_year and month = p_month
  );
  
  -- Delete sector budgets
  delete from sector_budgets
  where year = p_year and month = p_month;
  
  -- Delete category budget periods
  delete from budget_periods
  where category_budget_id in (
    select id from category_budgets 
    where year = p_year and month = p_month
  );
  
  -- Delete category budgets
  delete from category_budgets
  where year = p_year and month = p_month;
end;
$$; 