-- 20240711000008_fix_budget_creation_comprehensive.sql
-- Comprehensive fix for budget creation across multiple months

-- First, let's ensure we have the correct unique constraint on category_budgets
-- Drop and recreate the constraint to make sure it's correct
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints 
    where constraint_name = 'unique_category_month' 
    and table_name = 'category_budgets'
  ) then
    alter table category_budgets drop constraint unique_category_month;
  end if;
end $$;

-- Add the correct unique constraint
alter table category_budgets 
add constraint unique_category_month unique (category_id, year, month);

-- Drop any problematic constraints on budget_periods
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints 
    where constraint_name = 'unique_budget_period' 
    and table_name = 'budget_periods'
  ) then
    alter table budget_periods drop constraint unique_budget_period;
  end if;
end $$;

-- Drop all existing triggers that might interfere
drop trigger if exists trigger_create_current_budget_period on public.category_budgets;
drop trigger if exists trigger_handle_budget_changes on public.category_budgets;
drop trigger if exists trigger_handle_budget_delete on public.category_budgets;

-- Drop all existing functions to ensure clean slate
drop function if exists public.create_budget_for_month(uuid, integer, integer, text, numeric, numeric, numeric);
drop function if exists public.update_budget_for_month(uuid, text, numeric, numeric, numeric);
drop function if exists public.delete_budget_for_month(uuid, integer, integer);
drop function if exists public.copy_budgets_from_month(integer, integer, integer, integer);
drop function if exists public.carry_forward_budgets_to_month(integer, integer);
drop function if exists public.handle_budget_changes();
drop function if exists public.handle_budget_delete();
drop function if exists public.create_current_budget_period();
drop function if exists public.upsert_budget_periods_for_budget();

-- Create the final version of create_budget_for_month
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

  -- Insert or update the budget for the specific month
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

  -- Insert or update corresponding budget_periods entry
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

-- Create update_budget_for_month function
create or replace function public.update_budget_for_month(
  p_budget_id uuid,
  p_budget_type text,
  p_absolute_amount numeric,
  p_user1_amount numeric,
  p_user2_amount numeric
)
returns void
language plpgsql
security definer
as $$
declare
  v_budget_amount numeric := 0;
begin
  -- Calculate budget amount
  v_budget_amount := coalesce(
    case
      when p_budget_type = 'absolute' then p_absolute_amount
      when p_budget_type = 'split' then coalesce(p_user1_amount,0) + coalesce(p_user2_amount,0)
      else 0
    end, 0);

  -- Update the budget
  update category_budgets 
  set budget_type = p_budget_type,
      absolute_amount = p_absolute_amount,
      user1_amount = p_user1_amount,
      user2_amount = p_user2_amount,
      updated_at = now()
  where id = p_budget_id;

  -- Update corresponding budget_periods
  update budget_periods
  set budget_amount = v_budget_amount,
      updated_at = now()
  where category_budget_id = p_budget_id;
end;
$$;

-- Create delete_budget_for_month function
create or replace function public.delete_budget_for_month(
  p_category_id uuid,
  p_year integer,
  p_month integer
)
returns void
language plpgsql
security definer
as $$
begin
  -- Delete the budget for this category and month
  -- This will cascade to budget_periods via foreign key
  delete from category_budgets
  where category_id = p_category_id
    and year = p_year
    and month = p_month;
end;
$$;

-- Create copy_budgets_from_month function
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
    end if;
  end loop;
end;
$$;

-- Create carry_forward_budgets_to_month function
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
    end if;
  end loop;
end;
$$;

-- Update get_budget_summary_for_month to use the new structure
drop function if exists public.get_budget_summary_for_month(integer, integer);

create or replace function public.get_budget_summary_for_month(
  p_year integer,
  p_month integer
)
returns table (
  category_id uuid,
  category_name text,
  category_image text,
  budget_id uuid,
  budget_type text,
  absolute_amount numeric,
  user1_amount numeric,
  user2_amount numeric,
  current_period_budget numeric,
  current_period_spent numeric,
  current_period_user1_spent numeric,
  current_period_user2_spent numeric,
  current_period_remaining_percentage numeric,
  current_period_remaining_amount numeric
)
language plpgsql
security definer
as $$
begin
  return query
  select 
    c.id as category_id,
    c.name as category_name,
    c.image_url as category_image,
    cb.id as budget_id,
    cb.budget_type,
    cb.absolute_amount,
    cb.user1_amount,
    cb.user2_amount,
    bp.budget_amount as current_period_budget,
    bp.spent_amount as current_period_spent,
    bp.user1_spent as current_period_user1_spent,
    bp.user2_spent as current_period_user2_spent,
    case 
      when bp.budget_amount > 0 then 
        least((bp.spent_amount / bp.budget_amount) * 100, 100)
      else 0 
    end as current_period_remaining_percentage,
    greatest(bp.budget_amount - bp.spent_amount, 0) as current_period_remaining_amount
  from categories c
  left join category_budgets cb on c.id = cb.category_id 
    and cb.year = p_year and cb.month = p_month
  left join budget_periods bp on cb.id = bp.category_budget_id
  order by c.name;
end;
$$; 