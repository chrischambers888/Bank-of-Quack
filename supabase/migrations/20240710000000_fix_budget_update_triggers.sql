-- 20240710000000_fix_budget_update_triggers.sql
-- Fix budget update issues by adding proper triggers and functions

-- Drop the old trigger that only handles inserts
drop trigger if exists trigger_create_current_budget_period on public.category_budgets;

-- Create a comprehensive function that handles both INSERT and UPDATE operations
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

  -- Calculate total spent for the period (current month)
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

-- Create a trigger that handles both INSERT and UPDATE operations
create trigger trigger_handle_budget_changes
  after insert or update on public.category_budgets
  for each row
  execute function public.handle_budget_changes();

-- Also create a trigger for DELETE operations to clean up budget_periods
create or replace function public.handle_budget_delete()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Delete all budget periods for this budget
  delete from public.budget_periods
  where category_budget_id = old.id;
  
  return old;
end;
$$;

create trigger trigger_handle_budget_delete
  after delete on public.category_budgets
  for each row
  execute function public.handle_budget_delete(); 