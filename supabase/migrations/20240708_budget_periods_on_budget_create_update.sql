-- 20240708_budget_periods_on_budget_create_update.sql
-- Ensure budget_periods rows exist for all months with transactions and for the current month when a budget is created or updated

create or replace function public.upsert_budget_periods_for_budget()
returns trigger
language plpgsql
security definer
as $$
declare
  v_budget_amount numeric := 0;
  v_budget_id uuid;
begin
  -- Determine the budget amount
  v_budget_amount := coalesce(
    case
      when new.budget_type = 'absolute' then new.absolute_amount
      when new.budget_type = 'split' then coalesce(new.user1_amount,0) + coalesce(new.user2_amount,0)
      else 0
    end, 0);
  v_budget_id := new.id;

  -- 1. For every year/month with a transaction for this category, ensure a budget_periods row exists
  insert into public.budget_periods (
    category_budget_id, year, month, budget_amount, spent_amount, user1_spent, user2_spent, created_at, updated_at
  )
  select
    v_budget_id,
    extract(year from t.date)::integer,
    extract(month from t.date)::integer,
    v_budget_amount,
    0, 0, 0, now(), now()
  from public.transactions t
  where t.category_id = new.category_id
  group by extract(year from t.date), extract(month from t.date)
  on conflict (category_budget_id, year, month) do nothing;

  -- 2. Ensure a row for the current month exists
  insert into public.budget_periods (
    category_budget_id, year, month, budget_amount, spent_amount, user1_spent, user2_spent, created_at, updated_at
  ) values (
    v_budget_id,
    extract(year from current_date)::integer,
    extract(month from current_date)::integer,
    v_budget_amount,
    0, 0, 0, now(), now()
  )
  on conflict (category_budget_id, year, month) do nothing;

  -- 3. On update, update budget_amount for all periods for this budget
  if TG_OP = 'UPDATE' then
    update public.budget_periods
    set budget_amount = v_budget_amount,
        updated_at = now()
    where category_budget_id = v_budget_id;
  end if;

  return new;
end;
$$;

-- Drop old trigger if it exists
 drop trigger if exists trigger_create_current_budget_period on public.category_budgets;

-- Create new trigger for insert and update
create trigger trigger_upsert_budget_periods_for_budget
  after insert or update on public.category_budgets
  for each row
  execute function public.upsert_budget_periods_for_budget(); 