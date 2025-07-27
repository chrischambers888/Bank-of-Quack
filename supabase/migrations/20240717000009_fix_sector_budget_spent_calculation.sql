-- 20240717000009_fix_sector_budget_spent_calculation.sql
-- Fix the copy_sector_budgets_from_month function to properly calculate spent amounts

-- Drop and recreate the copy_sector_budgets_from_month function with proper spent calculation
drop function if exists public.copy_sector_budgets_from_month(integer, integer, integer, integer, integer);

create or replace function public.copy_sector_budgets_from_month(
  p_from_year integer,
  p_from_month integer,
  p_from_year_adjusted integer,
  p_to_year integer,
  p_to_month integer
)
returns void
language plpgsql
security definer
as $$
declare
  v_sector_budget record;
  v_new_sector_budget_id uuid;
  v_total_spent numeric := 0;
  v_user1_spent numeric := 0;
  v_user2_spent numeric := 0;
begin
  -- Copy sector budgets from source month to target month
  for v_sector_budget in
    select * from public.sector_budgets
    where year = p_from_year_adjusted and month = p_from_month
  loop
    -- Calculate spent amounts for this sector in the target month
    select 
      coalesce(sum(t.amount), 0),
      coalesce(sum(case when t.paid_by_user_name = (select value from public.app_settings where key = 'user1_name') then t.amount else 0 end), 0),
      coalesce(sum(case when t.paid_by_user_name = (select value from public.app_settings where key = 'user2_name') then t.amount else 0 end), 0)
    into v_total_spent, v_user1_spent, v_user2_spent
    from public.sector_categories sc
    join public.categories c on sc.category_id = c.id
    left join public.transactions t on c.id = t.category_id 
      and t.transaction_type = 'expense'
      and extract(year from t.date) = p_to_year
      and extract(month from t.date) = p_to_month
    where sc.sector_id = v_sector_budget.sector_id;
    
    -- Insert the sector budget for the target month
    insert into public.sector_budgets (
      sector_id,
      year,
      month,
      budget_type,
      absolute_amount,
      user1_amount,
      user2_amount,
      auto_rollup,
      created_at,
      updated_at
    ) values (
      v_sector_budget.sector_id,
      p_to_year,
      p_to_month,
      v_sector_budget.budget_type,
      v_sector_budget.absolute_amount,
      v_sector_budget.user1_amount,
      v_sector_budget.user2_amount,
      v_sector_budget.auto_rollup,
      now(),
      now()
    ) returning id into v_new_sector_budget_id;
    
    -- Insert the sector budget period with calculated spent amounts
    insert into public.sector_budget_periods (
      sector_budget_id,
      year,
      month,
      budget_amount,
      spent_amount,
      user1_spent,
      user2_spent,
      created_at,
      updated_at
    )
    select 
      v_new_sector_budget_id,
      p_to_year,
      p_to_month,
      budget_amount,
      v_total_spent,
      v_user1_spent,
      v_user2_spent,
      now(),
      now()
    from public.sector_budget_periods
    where sector_budget_id = v_sector_budget.id
      and year = p_from_year_adjusted 
      and month = p_from_month;
  end loop;
end;
$$; 