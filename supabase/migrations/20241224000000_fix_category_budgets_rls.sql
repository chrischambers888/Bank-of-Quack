-- 20241224000000_fix_category_budgets_rls.sql
-- Fix missing RLS policies on category_budgets and budget_periods tables
-- These tables were missing policies which prevented authenticated users from reading budget data

--------------------
-- ENABLE RLS ON CATEGORY BUDGET TABLES (if not already enabled)
--------------------

alter table public.category_budgets enable row level security;
alter table public.budget_periods enable row level security;

--------------------
-- ADD RLS POLICIES FOR CATEGORY BUDGET TABLES
-- Using the same pattern as other tables: allow all operations for authenticated users
--------------------

do $$
begin
  -- Create policy for category_budgets if it doesn't exist
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

  -- Create policy for budget_periods if it doesn't exist
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'budget_periods'
      and policyname = 'budget_periods_all'
  ) then
    execute '
      create policy budget_periods_all on public.budget_periods
        for all
        to authenticated
        using (true)
        with check (true);
    ';
  end if;
end $$;
