-- 20240711000003_fix_budget_delete_and_creation.sql
-- Fix budget deletion to delete the entire budget, not just the period
-- Fix budget creation to only create for the current month

-- Drop the old delete function
drop function if exists public.delete_budget_period_for_month(uuid, integer, integer);

-- Create function that deletes only the budget period for a specific month
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

-- Update the budget creation trigger to only create for the current month
-- and not interfere with existing budget periods
create or replace function public.handle_budget_changes()
returns trigger
language plpgsql
security definer
as $$
declare
  v_budget_amount numeric := 0;
  v_budget_id uuid;
  v_year integer := extract(year from current_date)::integer;
  v_month integer := extract(month from current_date)::integer;
  v_total_spent numeric := 0;
  v_user1_spent numeric := 0;
  v_user2_spent numeric := 0;
begin
  -- Determine the budget amount
  v_budget_amount := coalesce(
    case
      when new.budget_type = 'absolute' then new.absolute_amount
      when new.budget_type = 'split' then coalesce(new.user1_amount,0) + coalesce(new.user2_amount,0)
      else 0
    end, 0);
  v_budget_id := new.id;

  -- Only create/update for the current month
  -- Check if a budget period already exists for this month
  if not exists (
    select 1 from public.budget_periods 
    where category_budget_id = v_budget_id 
      and year = v_year 
      and month = v_month
  ) then
    -- Calculate total spent for the current month
    select 
      coalesce(sum(amount), 0),
      coalesce(sum(case when paid_by_user_name = (select value from public.app_settings where key = 'user1_name') then amount else 0 end), 0),
      coalesce(sum(case when paid_by_user_name = (select value from public.app_settings where key = 'user2_name') then amount else 0 end), 0)
    into v_total_spent, v_user1_spent, v_user2_spent
    from public.transactions
    where category_id = new.category_id
      and transaction_type = 'expense'
      and extract(year from date) = v_year
      and extract(month from date) = v_month;

    -- Insert new budget period for current month only
    insert into public.budget_periods (
      category_budget_id, year, month, budget_amount, spent_amount, user1_spent, user2_spent, created_at, updated_at
    ) values (
      v_budget_id,
      v_year,
      v_month,
      v_budget_amount,
      v_total_spent,
      v_user1_spent,
      v_user2_spent,
      now(),
      now()
    );
  else
    -- Update existing budget period for current month
    update public.budget_periods
    set budget_amount = v_budget_amount,
        updated_at = now()
    where category_budget_id = v_budget_id
      and year = v_year
      and month = v_month;
  end if;

  return new;
end;
$$; 