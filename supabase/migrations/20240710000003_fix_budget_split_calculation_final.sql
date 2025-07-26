-- 20240710000003_fix_budget_split_calculation_final.sql
-- Fix budget split calculation to use split_type instead of paid_by_user_name
-- This migration updates the existing functions without modifying previous migrations

-- Update the existing update_budget_spent function to use split_type
create or replace function public.update_budget_spent(
  p_category_id uuid,
  p_year integer,
  p_month integer
)
returns void
language plpgsql
security definer
as $$
declare
  v_budget_id uuid;
  v_total_spent numeric := 0;
  v_user1_spent numeric := 0;
  v_user2_spent numeric := 0;
begin
  -- Get the budget for this category (no is_active filter)
  select id into v_budget_id
  from public.category_budgets
  where category_id = p_category_id;
  
  if v_budget_id is null then
    return;
  end if;
  
  -- Calculate total spent and user-specific amounts based on split_type
  select 
    coalesce(sum(amount), 0),
    coalesce(sum(
      case 
        when split_type = 'user1_only' then amount
        when split_type = 'splitEqually' then amount / 2
        else 0
      end
    ), 0),
    coalesce(sum(
      case 
        when split_type = 'user2_only' then amount
        when split_type = 'splitEqually' then amount / 2
        else 0
      end
    ), 0)
  into v_total_spent, v_user1_spent, v_user2_spent
  from public.transactions
  where category_id = p_category_id
    and transaction_type = 'expense'
    and extract(year from date) = p_year
    and extract(month from date) = p_month;
  
  -- Update the budget period
  update public.budget_periods
  set 
    spent_amount = v_total_spent,
    user1_spent = v_user1_spent,
    user2_spent = v_user2_spent,
    updated_at = now()
  where category_budget_id = v_budget_id
    and year = p_year
    and month = p_month;
end;
$$;

-- Update the existing handle_budget_changes function to use split_type
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

  -- Calculate total spent for the period (current month) based on split_type
  select 
    coalesce(sum(amount), 0),
    coalesce(sum(
      case 
        when split_type = 'user1_only' then amount
        when split_type = 'splitEqually' then amount / 2
        else 0
      end
    ), 0),
    coalesce(sum(
      case 
        when split_type = 'user2_only' then amount
        when split_type = 'splitEqually' then amount / 2
        else 0
      end
    ), 0)
  into v_total_spent, v_user1_spent, v_user2_spent
  from public.transactions
  where category_id = new.category_id
    and transaction_type = 'expense'
    and extract(year from date) = v_year
    and extract(month from date) = v_month;

  -- Upsert for the current month
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
  )
  on conflict (category_budget_id, year, month) do update
    set budget_amount = excluded.budget_amount,
        spent_amount = excluded.spent_amount,
        user1_spent = excluded.user1_spent,
        user2_spent = excluded.user2_spent,
        updated_at = now();

  return new;
end;
$$; 