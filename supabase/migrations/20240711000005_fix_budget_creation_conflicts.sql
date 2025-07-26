-- 20240711000005_fix_budget_creation_conflicts.sql
-- Fix the create_budget_for_month function to handle existing budgets properly

-- Add unique constraint to budget_periods to support upsert
-- First check if the constraint already exists
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints 
    where constraint_name = 'unique_budget_period' 
    and table_name = 'budget_periods'
  ) then
    alter table budget_periods 
    add constraint unique_budget_period unique (category_budget_id, year, month);
  end if;
end $$;

-- Drop the existing function
drop function if exists public.create_budget_for_month(uuid, integer, integer, text, numeric, numeric, numeric);

-- Create improved function that handles existing budgets
create or replace function public.create_budget_for_month(
  p_category_id uuid,
  p_year integer,
  p_month integer,
  p_budget_type text,
  p_absolute_amount numeric,
  p_user1_amount numeric,
  p_user2_amount numeric
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_budget_id uuid;
  v_budget_amount numeric := 0;
  v_total_spent numeric := 0;
  v_user1_spent numeric := 0;
  v_user2_spent numeric := 0;
begin
  -- Calculate budget amount
  v_budget_amount := coalesce(
    case
      when p_budget_type = 'absolute' then p_absolute_amount
      when p_budget_type = 'split' then coalesce(p_user1_amount,0) + coalesce(p_user2_amount,0)
      else 0
    end, 0);

  -- Calculate spent amounts for the month
  select 
    coalesce(sum(amount), 0),
    coalesce(sum(case when paid_by_user_name = (select value from public.app_settings where key = 'user1_name') then amount else 0 end), 0),
    coalesce(sum(case when paid_by_user_name = (select value from public.app_settings where key = 'user2_name') then amount else 0 end), 0)
  into v_total_spent, v_user1_spent, v_user2_spent
  from public.transactions
  where category_id = p_category_id
    and transaction_type = 'expense'
    and extract(year from date) = p_year
    and extract(month from date) = p_month;

  -- Insert the budget for the specific month (or update if exists)
  insert into category_budgets (
    category_id, year, month, budget_type, absolute_amount, user1_amount, user2_amount, created_at, updated_at
  ) values (
    p_category_id, p_year, p_month, p_budget_type, p_absolute_amount, p_user1_amount, p_user2_amount, now(), now()
  )
  on conflict (category_id, year, month) do update
  set budget_type = excluded.budget_type,
      absolute_amount = excluded.absolute_amount,
      user1_amount = excluded.user1_amount,
      user2_amount = excluded.user2_amount,
      updated_at = now()
  returning id into v_budget_id;

  -- Upsert corresponding budget_periods entry
  insert into budget_periods (
    category_budget_id, year, month, budget_amount, spent_amount, user1_spent, user2_spent, created_at, updated_at
  ) values (
    v_budget_id, p_year, p_month, v_budget_amount, v_total_spent, v_user1_spent, v_user2_spent, now(), now()
  )
  on conflict (category_budget_id, year, month) do update
  set budget_amount = excluded.budget_amount,
      spent_amount = excluded.spent_amount,
      user1_spent = excluded.user1_spent,
      user2_spent = excluded.user2_spent,
      updated_at = now();

  return v_budget_id;
end;
$$; 