-- Fix month_has_budget_data function to include sector budgets
-- The current function only checks category_budgets, but should also check sector_budgets
-- This ensures the UI shows the correct state when manual sector budgets exist

create or replace function public.month_has_budget_data(
  p_year integer,
  p_month integer
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_count integer;
begin
  -- Check if there are any budgets for the specified month
  select count(*) into v_count
  from (
    select 1 from category_budgets where year = p_year and month = p_month
    union
    select 1 from sector_budgets where year = p_year and month = p_month
  ) as all_budgets;
  
  return v_count > 0;
end;
$$;

-- Also update get_available_budget_months to include sector budgets
create or replace function public.get_available_budget_months()
returns table (
  year integer,
  month integer,
  month_name text
)
language plpgsql
security definer
as $$
begin
  return query
  select distinct
    budget_data.year,
    budget_data.month,
    to_char(make_date(budget_data.year, budget_data.month, 1), 'Month YYYY') as month_name
  from (
    select year, month from category_budgets
    union
    select year, month from sector_budgets
  ) as budget_data
  order by budget_data.year desc, budget_data.month desc;
end;
$$; 