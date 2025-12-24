-- 20251224000001_fix_budget_functions_search_path.sql
-- Fix month_has_budget_data and get_available_budget_months functions
-- to use explicit public schema references

-- Fix month_has_budget_data function to use explicit schema
create or replace function public.month_has_budget_data(
  p_year integer,
  p_month integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from (
    select 1 from public.category_budgets where year = p_year and month = p_month
    union
    select 1 from public.sector_budgets where year = p_year and month = p_month
  ) as all_budgets;

  return v_count > 0;
end;
$$;

-- Fix get_available_budget_months function to use explicit schema
create or replace function public.get_available_budget_months()
returns table (
  year integer,
  month integer,
  month_name text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select distinct
    budget_data.year,
    budget_data.month,
    to_char(make_date(budget_data.year, budget_data.month, 1), 'Month YYYY') as month_name
  from (
    select cb.year, cb.month from public.category_budgets cb
    union
    select sb.year, sb.month from public.sector_budgets sb
  ) as budget_data
  order by budget_data.year desc, budget_data.month desc;
end;
$$;

-- Ensure RLS is enabled on category_budgets (in case it wasn't)
alter table if exists public.category_budgets enable row level security;

-- Add RLS policy if missing
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'category_budgets'
      and policyname = 'category_budgets_all'
  ) then
    execute '
      create policy category_budgets_all on public.category_budgets
        for all
        to authenticated
        using (true)
        with check (true);
    ';
  end if;
end $$;
