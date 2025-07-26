-- 20240711000004_restructure_budgets_for_month_specific.sql
-- Restructure budget system to support month-specific budgets
-- Add year/month columns to category_budgets table

-- First, let's backup existing data
create table if not exists category_budgets_backup as 
select * from category_budgets;

create table if not exists budget_periods_backup as 
select * from budget_periods;

-- Add year and month columns to category_budgets
alter table category_budgets 
add column if not exists year integer,
add column if not exists month integer;

-- Update existing category_budgets to have year/month based on current date
update category_budgets 
set year = extract(year from current_date)::integer,
    month = extract(month from current_date)::integer
where year is null or month is null;

-- Make year and month required
alter table category_budgets 
alter column year set not null,
alter column month set not null;

-- Add unique constraint to prevent duplicate budgets for same category/month
alter table category_budgets 
add constraint unique_category_month unique (category_id, year, month);

-- Drop the old triggers that are causing issues
drop trigger if exists trigger_handle_budget_changes on category_budgets;
drop trigger if exists trigger_handle_budget_delete on category_budgets;
drop trigger if exists trigger_create_current_budget_period on category_budgets;

-- Drop old functions
drop function if exists public.handle_budget_changes();
drop function if exists public.handle_budget_delete();
drop function if exists public.create_current_budget_period();
drop function if exists public.upsert_budget_periods_for_budget();

-- Create new function for creating month-specific budgets
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

  -- Insert the budget for the specific month
  insert into category_budgets (
    category_id, year, month, budget_type, absolute_amount, user1_amount, user2_amount, created_at, updated_at
  ) values (
    p_category_id, p_year, p_month, p_budget_type, p_absolute_amount, p_user1_amount, p_user2_amount, now(), now()
  ) returning id into v_budget_id;

  -- Create corresponding budget_periods entry
  insert into budget_periods (
    category_budget_id, year, month, budget_amount, spent_amount, user1_spent, user2_spent, created_at, updated_at
  ) values (
    v_budget_id, p_year, p_month, v_budget_amount, v_total_spent, v_user1_spent, v_user2_spent, now(), now()
  );

  return v_budget_id;
end;
$$;

-- Create function to update budget for specific month
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

-- Create function to delete budget for specific month
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

-- Update the copy function to work with new structure
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
  budget_record record;
begin
  -- Copy budgets from source month to target month
  for budget_record in 
    select * from category_budgets 
    where year = p_from_year and month = p_from_month
  loop
    -- Only create if budget doesn't exist for target month
    if not exists (
      select 1 from category_budgets 
      where category_id = budget_record.category_id 
        and year = p_to_year 
        and month = p_to_month
    ) then
      perform public.create_budget_for_month(
        budget_record.category_id,
        p_to_year,
        p_to_month,
        budget_record.budget_type,
        budget_record.absolute_amount,
        budget_record.user1_amount,
        budget_record.user2_amount
      );
    end if;
  end loop;
end;
$$;

-- Update the carry forward function
create or replace function public.carry_forward_budgets_to_month(
  p_year integer,
  p_month integer
)
returns void
language plpgsql
security definer
as $$
declare
  budget_record record;
  v_current_year integer := extract(year from current_date)::integer;
  v_current_month integer := extract(month from current_date)::integer;
begin
  -- Carry forward budgets from current month to target month
  for budget_record in 
    select * from category_budgets 
    where year = v_current_year and month = v_current_month
  loop
    -- Only create if budget doesn't exist for target month
    if not exists (
      select 1 from category_budgets 
      where category_id = budget_record.category_id 
        and year = p_year 
        and month = p_month
    ) then
      perform public.create_budget_for_month(
        budget_record.category_id,
        p_year,
        p_month,
        budget_record.budget_type,
        budget_record.absolute_amount,
        budget_record.user1_amount,
        budget_record.user2_amount
      );
    end if;
  end loop;
end;
$$;

-- Update the get_budget_summary_for_month function
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