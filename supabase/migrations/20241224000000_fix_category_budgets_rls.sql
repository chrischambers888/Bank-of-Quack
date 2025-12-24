-- 20241224000000_fix_category_budgets_rls.sql
-- Fix missing RLS policy on category_budgets table
-- This table was missing a policy which prevented authenticated users from reading budget data

--------------------
-- ENABLE RLS ON CATEGORY_BUDGETS TABLE (if not already enabled)
--------------------

alter table public.category_budgets enable row level security;

--------------------
-- ADD RLS POLICY FOR CATEGORY_BUDGETS TABLE
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
end $$;
