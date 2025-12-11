-- 20241211000000_fix_security_definer_views_and_rls.sql
-- Fix security issues flagged by Supabase Security Advisor:
-- 1. Remove SECURITY DEFINER from views (use SECURITY INVOKER instead)
-- 2. Enable RLS on yearly_category_budgets and yearly_sector_budgets tables

--------------------
-- FIX SECURITY DEFINER VIEWS
-- Recreate views without SECURITY DEFINER (SECURITY INVOKER is the default and safer)
--------------------

-- Recreate transactions_view with SECURITY INVOKER
drop view if exists public.transactions_view;
create view public.transactions_view
with (security_invoker = true)
as
select t.id,
       t.created_at,
       t.date,
       t.description,
       t.amount,
       t.paid_by_user_name,
       t.split_type,
       t.transaction_type,
       t.paid_to_user_name,
       t.reimburses_transaction_id,
       t.category_id,
       t.excluded_from_monthly_budget,
       t.excluded_from_yearly_budget,
       c.name as category_name
from public.transactions t
left join public.categories c on t.category_id = c.id;

-- Recreate transactions_with_budgets view with SECURITY INVOKER
drop view if exists public.transactions_with_budgets;
create view public.transactions_with_budgets
with (security_invoker = true)
as
select
  t.id,
  t.created_at,
  t.date,
  t.description,
  t.amount,
  t.paid_by_user_name,
  t.split_type,
  t.transaction_type,
  t.paid_to_user_name,
  t.reimburses_transaction_id,
  t.category_id,
  t.excluded_from_monthly_budget,
  t.excluded_from_yearly_budget,
  c.name as category_name,
  cb.id as budget_id,
  cb.budget_type,
  cb.absolute_amount as budget_absolute_amount,
  cb.user1_amount as budget_user1_amount,
  cb.user2_amount as budget_user2_amount,
  -- Calculate budget amount dynamically
  case
    when cb.budget_type = 'absolute' then cb.absolute_amount
    when cb.budget_type = 'split' then coalesce(cb.user1_amount, 0) + coalesce(cb.user2_amount, 0)
    else null
  end as period_budget_amount,
  -- Calculate spent amounts dynamically from transactions for the same month (excluding excluded transactions)
  coalesce((
    select sum(amount)
    from public.transactions
    where category_id = t.category_id
      and transaction_type = 'expense'
      and excluded_from_monthly_budget = false
      and extract(year from date) = extract(year from t.date)
      and extract(month from date) = extract(month from t.date)
  ), 0) as period_spent_amount,
  -- Calculate user1 spent dynamically for the same month (excluding excluded transactions)
  coalesce((
    select sum(
      case
        when split_type = 'user1_only' then amount
        when split_type = 'splitEqually' then amount / 2
        when split_type = 'user2_only' then 0
        else 0
      end
    )
    from public.transactions
    where category_id = t.category_id
      and transaction_type = 'expense'
      and excluded_from_monthly_budget = false
      and extract(year from date) = extract(year from t.date)
      and extract(month from date) = extract(month from t.date)
  ), 0) as period_user1_spent,
  -- Calculate user2 spent dynamically for the same month (excluding excluded transactions)
  coalesce((
    select sum(
      case
        when split_type = 'user2_only' then amount
        when split_type = 'splitEqually' then amount / 2
        when split_type = 'user1_only' then 0
        else 0
      end
    )
    from public.transactions
    where category_id = t.category_id
      and transaction_type = 'expense'
      and excluded_from_monthly_budget = false
      and extract(year from date) = extract(year from t.date)
      and extract(month from date) = extract(month from t.date)
  ), 0) as period_user2_spent
from public.transactions t
left join public.categories c on t.category_id = c.id
left join public.category_budgets cb on t.category_id = cb.category_id
  and extract(year from t.date) = cb.year
  and extract(month from t.date) = cb.month;

-- Recreate budget_summary view with SECURITY INVOKER
drop view if exists public.budget_summary;
create view public.budget_summary
with (security_invoker = true)
as
select
  c.id as category_id,
  c.name as category_name,
  c.image_url as category_image,
  cb.id as budget_id,
  cb.budget_type,
  cb.absolute_amount,
  cb.user1_amount,
  cb.user2_amount,
  extract(year from current_date) as current_year,
  extract(month from current_date) as current_month,
  -- Calculate budget amount dynamically
  case
    when cb.budget_type = 'absolute' then cb.absolute_amount
    when cb.budget_type = 'split' then coalesce(cb.user1_amount, 0) + coalesce(cb.user2_amount, 0)
    else null
  end as current_period_budget,
  -- Calculate spent amounts dynamically from transactions
  coalesce((
    select sum(amount)
    from public.transactions
    where category_id = c.id
      and transaction_type = 'expense'
      and extract(year from date) = extract(year from current_date)
      and extract(month from date) = extract(month from current_date)
  ), 0) as current_period_spent,
  -- Calculate user1 spent dynamically
  coalesce((
    select sum(
      case
        when split_type = 'user1_only' then amount
        when split_type = 'splitEqually' then amount / 2
        when split_type = 'user2_only' then 0
        else 0
      end
    )
    from public.transactions
    where category_id = c.id
      and transaction_type = 'expense'
      and extract(year from date) = extract(year from current_date)
      and extract(month from date) = extract(month from current_date)
  ), 0) as current_period_user1_spent,
  -- Calculate user2 spent dynamically
  coalesce((
    select sum(
      case
        when split_type = 'user1_only' then 0
        when split_type = 'splitEqually' then amount / 2
        when split_type = 'user2_only' then amount
        else 0
      end
    )
    from public.transactions
    where category_id = c.id
      and transaction_type = 'expense'
      and extract(year from date) = extract(year from current_date)
      and extract(month from date) = extract(month from current_date)
  ), 0) as current_period_user2_spent,
  -- Calculate remaining percentage
  case
    when cb.budget_type = 'absolute' and cb.absolute_amount > 0 then
      round(((cb.absolute_amount - coalesce((
        select sum(amount)
        from public.transactions
        where category_id = c.id
          and transaction_type = 'expense'
          and extract(year from date) = extract(year from current_date)
          and extract(month from date) = extract(month from current_date)
      ), 0)) / cb.absolute_amount) * 100, 2)
    when cb.budget_type = 'split' and (coalesce(cb.user1_amount, 0) + coalesce(cb.user2_amount, 0)) > 0 then
      round((((coalesce(cb.user1_amount, 0) + coalesce(cb.user2_amount, 0)) - coalesce((
        select sum(amount)
        from public.transactions
        where category_id = c.id
          and transaction_type = 'expense'
          and extract(year from date) = extract(year from current_date)
          and extract(month from date) = extract(month from current_date)
      ), 0)) / (coalesce(cb.user1_amount, 0) + coalesce(cb.user2_amount, 0))) * 100, 2)
    else null
  end as current_period_remaining_percentage,
  -- Calculate remaining amount
  case
    when cb.budget_type = 'absolute' then
      cb.absolute_amount - coalesce((
        select sum(amount)
        from public.transactions
        where category_id = c.id
          and transaction_type = 'expense'
          and extract(year from date) = extract(year from current_date)
          and extract(month from date) = extract(month from current_date)
      ), 0)
    when cb.budget_type = 'split' then
      (coalesce(cb.user1_amount, 0) + coalesce(cb.user2_amount, 0)) - coalesce((
        select sum(amount)
        from public.transactions
        where category_id = c.id
          and transaction_type = 'expense'
          and extract(year from date) = extract(year from current_date)
          and extract(month from date) = extract(month from current_date)
      ), 0)
    else null
  end as current_period_remaining_amount
from public.categories c
left join public.category_budgets cb on c.id = cb.category_id
  and cb.year = extract(year from current_date)
  and cb.month = extract(month from current_date);

--------------------
-- ENABLE RLS ON YEARLY BUDGET TABLES
--------------------

alter table public.yearly_category_budgets enable row level security;
alter table public.yearly_sector_budgets enable row level security;

--------------------
-- ADD RLS POLICIES FOR YEARLY BUDGET TABLES
-- Using the same pattern as other tables: allow all operations for authenticated users
--------------------

do $$
begin
  -- Create policy for yearly_category_budgets if it doesn't exist
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'yearly_category_budgets'
      and policyname = 'yearly_category_budgets_all'
  ) then
    execute '
      create policy yearly_category_budgets_all on public.yearly_category_budgets
        for all
        to authenticated
        using (true)
        with check (true);
    ';
  end if;

  -- Create policy for yearly_sector_budgets if it doesn't exist
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'yearly_sector_budgets'
      and policyname = 'yearly_sector_budgets_all'
  ) then
    execute '
      create policy yearly_sector_budgets_all on public.yearly_sector_budgets
        for all
        to authenticated
        using (true)
        with check (true);
    ';
  end if;
end $$;
