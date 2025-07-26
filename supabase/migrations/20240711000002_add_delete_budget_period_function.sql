-- 20240711000002_add_delete_budget_period_function.sql
-- Add function to delete only the budget period for a specific month
---------------------------------------------------------------

-- Function to delete only the budget period for a specific month
create or replace function public.delete_budget_period_for_month(
  p_category_id uuid,
  p_year integer,
  p_month integer
)
returns void
language plpgsql
security definer
as $$
declare
  v_budget_period_id uuid;
begin
  -- Find the budget period for this category and month
  select bp.id into v_budget_period_id
  from public.budget_periods bp
  join public.category_budgets cb on bp.category_budget_id = cb.id
  where cb.category_id = p_category_id
    and bp.year = p_year
    and bp.month = p_month;
  
  -- Delete only the budget period, not the entire budget
  if v_budget_period_id is not null then
    delete from public.budget_periods
    where id = v_budget_period_id;
  end if;
end;
$$; 