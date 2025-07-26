-- 20240710000002_fix_budget_split_calculation.sql
-- Fix budget split calculation to use split_type instead of paid_by_user_name

-- Update the function to use split_type for proper budget calculation
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