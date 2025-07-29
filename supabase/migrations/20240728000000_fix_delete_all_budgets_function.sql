-- 20240728000000_fix_delete_all_budgets_function.sql
-- Fix the delete_all_budgets_for_month function to delete both sector and category budgets

create or replace function public.delete_all_budgets_for_month(
  p_year integer,
  p_month integer
)
returns void
language plpgsql
security definer
as $$
begin
  -- Delete all sector budgets for the specified month first
  delete from sector_budgets
  where year = p_year and month = p_month;
  
  -- Delete all category budgets for the specified month
  delete from category_budgets
  where year = p_year and month = p_month;
end;
$$; 