-- 20240709150000_budget_periods_on_budget_create_update_spent.sql
-- After creating a budget_periods row for the current month, immediately update spent_amount

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
  insert into public.budget_periods (
    category_budget_id, year, month, budget_amount, spent_amount, user1_spent, user2_spent, created_at, updated_at
  ) values (
    v_budget_id,
    v_year,
    v_month,
    v_budget_amount,
    0, 0, 0, now(), now()
  )
  on conflict (category_budget_id, year, month) do nothing;

  -- On update, update budget_amount for all periods for this budget (current month only)
  if TG_OP = 'UPDATE' then
    update public.budget_periods
    set budget_amount = v_budget_amount,
        updated_at = now()
    where category_budget_id = v_budget_id
      and year = v_year
      and month = v_month;
  end if;

  -- Immediately update spent_amount for the current month
  perform public.update_budget_spent(new.category_id, v_year, v_month);

  return new;
end;
$$; 