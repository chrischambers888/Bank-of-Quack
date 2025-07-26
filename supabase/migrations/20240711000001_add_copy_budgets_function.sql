-- 20240711000001_add_copy_budgets_function.sql
-- Add function to copy budgets from a specific month to another month
---------------------------------------------------------------

-- Function to copy budgets from a specific month to another month
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
  v_budget_amount numeric;
  v_total_spent numeric;
  v_user1_spent numeric;
  v_user2_spent numeric;
begin
  -- Loop through all category budgets
  for budget_record in 
    select cb.id, cb.category_id, cb.budget_type, cb.absolute_amount, cb.user1_amount, cb.user2_amount
    from public.category_budgets cb
    where not exists (
      select 1 from public.budget_periods bp 
      where bp.category_budget_id = cb.id 
      and bp.year = p_to_year 
      and bp.month = p_to_month
    )
  loop
    -- Calculate budget amount
    v_budget_amount := coalesce(
      case
        when budget_record.budget_type = 'absolute' then budget_record.absolute_amount
        when budget_record.budget_type = 'split' then coalesce(budget_record.user1_amount,0) + coalesce(budget_record.user2_amount,0)
        else 0
      end, 0);

    -- Calculate spent amounts for the target month
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
    where category_id = budget_record.category_id
      and transaction_type = 'expense'
      and extract(year from date) = p_to_year
      and extract(month from date) = p_to_month;

    -- Insert the budget period for the target month
    insert into public.budget_periods (
      category_budget_id, year, month, budget_amount, spent_amount, user1_spent, user2_spent, created_at, updated_at
    ) values (
      budget_record.id,
      p_to_year,
      p_to_month,
      v_budget_amount,
      v_total_spent,
      v_user1_spent,
      v_user2_spent,
      now(),
      now()
    );
  end loop;
end;
$$; 