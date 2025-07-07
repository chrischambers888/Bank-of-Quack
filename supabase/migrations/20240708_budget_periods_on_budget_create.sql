-- 20240708_budget_periods_on_budget_create.sql
-- Create a budget_periods row for the current month when a new budget is created

-- Function to insert a budget_periods row for the current month
create or replace function public.create_current_budget_period()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.budget_periods (
    category_budget_id,
    year,
    month,
    budget_amount,
    spent_amount,
    user1_spent,
    user2_spent,
    created_at,
    updated_at
  ) values (
    new.id,
    extract(year from current_date)::integer,
    extract(month from current_date)::integer,
    coalesce(
      case
        when new.budget_type = 'absolute' then new.absolute_amount
        when new.budget_type = 'split' then coalesce(new.user1_amount,0) + coalesce(new.user2_amount,0)
        else 0
      end, 0),
    0, -- spent_amount
    0, -- user1_spent
    0, -- user2_spent
    now(),
    now()
  )
  on conflict (category_budget_id, year, month) do nothing;
  return new;
end;
$$;

-- Trigger to call the function after insert on category_budgets
create trigger trigger_create_current_budget_period
  after insert on public.category_budgets
  for each row
  execute function public.create_current_budget_period(); 