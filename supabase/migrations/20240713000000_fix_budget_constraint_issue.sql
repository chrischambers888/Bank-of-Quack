-- 20240713000000_fix_budget_constraint_issue.sql
-- Fix budget creation issue by ensuring proper constraint setup and error handling

-- First, let's check and fix any constraint issues
-- Drop any existing problematic constraints
do $$
begin
  -- Drop unique_category_month constraint if it exists
  if exists (
    select 1 from information_schema.table_constraints 
    where constraint_name = 'unique_category_month' 
    and table_name = 'category_budgets'
  ) then
    alter table category_budgets drop constraint unique_category_month;
  end if;
  
  -- Drop unique_budget_period constraint if it exists
  if exists (
    select 1 from information_schema.table_constraints 
    where constraint_name = 'unique_budget_period' 
    and table_name = 'budget_periods'
  ) then
    alter table budget_periods drop constraint unique_budget_period;
  end if;
end $$;

-- Add the correct unique constraint on category_budgets
-- This should allow different months/years for the same category
alter table category_budgets 
add constraint unique_category_month unique (category_id, year, month);

-- Add the correct unique constraint on budget_periods
alter table budget_periods 
add constraint unique_budget_period unique (category_budget_id, year, month);

-- Drop and recreate the create_budget_for_month function with better error handling
drop function if exists public.create_budget_for_month(uuid, integer, integer, text, numeric, numeric, numeric);

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
  v_existing_budget_id uuid;
begin
  -- Check if a budget already exists for this category and month
  select id into v_existing_budget_id
  from category_budgets
  where category_id = p_category_id
    and year = p_year
    and month = p_month;
    
  if v_existing_budget_id is not null then
    -- Update existing budget instead of creating new one
    update category_budgets 
    set budget_type = p_budget_type,
        absolute_amount = p_absolute_amount,
        user1_amount = p_user1_amount,
        user2_amount = p_user2_amount,
        updated_at = now()
    where id = v_existing_budget_id
    returning id into v_budget_id;
  else
    -- Calculate budget amount
    v_budget_amount := coalesce(
      case
        when p_budget_type = 'absolute' then p_absolute_amount
        when p_budget_type = 'split' then coalesce(p_user1_amount,0) + coalesce(p_user2_amount,0)
        else 0
      end, 0);

    -- Calculate spent amounts for the month using split_type logic
    select 
      coalesce(sum(amount), 0),
      coalesce(sum(
        case 
          when split_type = 'user1_only' then amount
          when split_type = 'splitEqually' then amount / 2
          when split_type = 'user2_only' then 0
          else 0
        end
      ), 0),
      coalesce(sum(
        case 
          when split_type = 'user1_only' then 0
          when split_type = 'splitEqually' then amount / 2
          when split_type = 'user2_only' then amount
          else 0
        end
      ), 0)
    into v_total_spent, v_user1_spent, v_user2_spent
    from public.transactions
    where category_id = p_category_id
      and transaction_type = 'expense'
      and extract(year from date) = p_year
      and extract(month from date) = p_month;

    -- Insert the budget for the specific month
    insert into category_budgets (
      category_id, year, month, budget_type, absolute_amount, user1_amount, user2_amount, created_at, updated_at
    ) values (
      p_category_id, p_year, p_month, p_budget_type, p_absolute_amount, p_user1_amount, p_user2_amount, now(), now()
    ) returning id into v_budget_id;

    -- Insert corresponding budget_periods entry
    insert into budget_periods (
      category_budget_id, year, month, budget_amount, spent_amount, user1_spent, user2_spent, created_at, updated_at
    ) values (
      v_budget_id, p_year, p_month, v_budget_amount, v_total_spent, v_user1_spent, v_user2_spent, now(), now()
    );
  end if;

  return v_budget_id;
exception
  when unique_violation then
    -- Handle unique constraint violations more gracefully
    raise notice 'Budget already exists for category % in %/%', p_category_id, p_month, p_year;
    raise exception 'A budget already exists for this category in the selected month/year';
  when others then
    -- Log the error for debugging
    raise notice 'Error in create_budget_for_month: %', SQLERRM;
    raise;
end;
$$;

-- Update the copy_budgets_from_month function with better error handling
drop function if exists public.copy_budgets_from_month(integer, integer, integer, integer);

create or replace function public.copy_budgets_from_month(
  p_from_year integer,
  p_from_month integer,
  p_to_year integer,
  p_to_month integer
)
returns void
language plpgsql
security definer
as $$
declare
  v_budget record;
  v_success_count integer := 0;
  v_error_count integer := 0;
begin
  -- Copy budgets from source month to target month
  for v_budget in
    select 
      cb.category_id,
      cb.budget_type,
      cb.absolute_amount,
      cb.user1_amount,
      cb.user2_amount
    from category_budgets cb
    where cb.year = p_from_year and cb.month = p_from_month
  loop
    -- Check if target month already has a budget for this category
    if not exists (
      select 1 from category_budgets 
      where category_id = v_budget.category_id 
        and year = p_to_year 
        and month = p_to_month
    ) then
      begin
        -- Create budget for target month
        perform create_budget_for_month(
          v_budget.category_id,
          p_to_year,
          p_to_month,
          v_budget.budget_type,
          v_budget.absolute_amount,
          v_budget.user1_amount,
          v_budget.user2_amount
        );
        v_success_count := v_success_count + 1;
      exception
        when others then
          v_error_count := v_error_count + 1;
          raise notice 'Failed to copy budget for category %: %', v_budget.category_id, SQLERRM;
      end;
    end if;
  end loop;
  
  -- Raise an error if any budgets failed to copy
  if v_error_count > 0 then
    raise exception 'Failed to copy % budgets. % succeeded, % failed.', v_error_count + v_success_count, v_success_count, v_error_count;
  end if;
end;
$$;

-- Update the carry_forward_budgets_to_month function with better error handling
drop function if exists public.carry_forward_budgets_to_month(integer, integer);

create or replace function public.carry_forward_budgets_to_month(
  p_year integer,
  p_month integer
)
returns void
language plpgsql
security definer
as $$
declare
  v_budget record;
  v_current_year integer := extract(year from current_date)::integer;
  v_current_month integer := extract(month from current_date)::integer;
  v_success_count integer := 0;
  v_error_count integer := 0;
begin
  -- Carry forward budgets from current month to target month
  for v_budget in
    select 
      cb.category_id,
      cb.budget_type,
      cb.absolute_amount,
      cb.user1_amount,
      cb.user2_amount
    from category_budgets cb
    where cb.year = v_current_year and cb.month = v_current_month
  loop
    -- Check if target month already has a budget for this category
    if not exists (
      select 1 from category_budgets 
      where category_id = v_budget.category_id 
        and year = p_year 
        and month = p_month
    ) then
      begin
        -- Create budget for target month
        perform create_budget_for_month(
          v_budget.category_id,
          p_year,
          p_month,
          v_budget.budget_type,
          v_budget.absolute_amount,
          v_budget.user1_amount,
          v_budget.user2_amount
        );
        v_success_count := v_success_count + 1;
      exception
        when others then
          v_error_count := v_error_count + 1;
          raise notice 'Failed to carry forward budget for category %: %', v_budget.category_id, SQLERRM;
      end;
    end if;
  end loop;
  
  -- Raise an error if any budgets failed to carry forward
  if v_error_count > 0 then
    raise exception 'Failed to carry forward % budgets. % succeeded, % failed.', v_error_count + v_success_count, v_success_count, v_error_count;
  end if;
end;
$$; 