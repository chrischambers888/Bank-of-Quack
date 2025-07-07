-- 20240709153000_budget_periods_on_budget_create_update_spent_inline.sql
-- Inline spent calculation in the trigger function for new/updated budgets

create or replace function public.upsert_budget_periods_for_budget()
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