-- 20240708_budget_periods_insert_fix.sql
-- Fix update_budget_spent to insert into budget_periods if no row exists

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
  v_budget_amount numeric := 0;
begin
  -- Get the budget for this category (no is_active filter)
  select id,
         coalesce(
           case
             when budget_type = 'absolute' then absolute_amount
             when budget_type = 'split' then coalesce(user1_amount,0) + coalesce(user2_amount,0)
             else 0
           end, 0)
    into v_budget_id, v_budget_amount
  from public.category_budgets
  where category_id = p_category_id;

  if v_budget_id is null then
    return;
  end if;

  -- Calculate total spent for the period
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

  -- Try to update the budget period
  update public.budget_periods
  set 
    spent_amount = v_total_spent,
    user1_spent = v_user1_spent,
    user2_spent = v_user2_spent,
    updated_at = now()
  where category_budget_id = v_budget_id
    and year = p_year
    and month = p_month;

  -- If no row was updated, insert a new one
  if not found then
    insert into public.budget_periods (
      category_budget_id, year, month, budget_amount, spent_amount, user1_spent, user2_spent, created_at, updated_at
    ) values (
      v_budget_id, p_year, p_month, v_budget_amount, v_total_spent, v_user1_spent, v_user2_spent, now(), now()
    );
  end if;
end;
$$; 