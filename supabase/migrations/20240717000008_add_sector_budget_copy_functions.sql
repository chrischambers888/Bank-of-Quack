-- 20240717000008_add_sector_budget_copy_functions.sql
-- Add functions for copying sector budgets and deleting all sector budgets for a month

-- Function to delete all sector budgets for a specific month
create or replace function public.delete_all_sector_budgets_for_month(
  p_year integer,
  p_month integer
)
returns void
language plpgsql
security definer
as $$
begin
  -- Delete sector budget periods first
  delete from public.sector_budget_periods
  where year = p_year and month = p_month;
  
  -- Delete sector budgets
  delete from public.sector_budgets
  where year = p_year and month = p_month;
end;
$$;

-- Function to copy sector budgets from one month to another
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
begin
  -- Copy sector budgets from source month to target month
  for v_sector_budget in
    select * from public.sector_budgets
    where year = p_from_year_adjusted and month = p_from_month
  loop
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
    
    -- Copy the corresponding sector budget period
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
      0, -- Reset spent amounts for new month
      0, -- Reset user1 spent
      0, -- Reset user2 spent
      now(),
      now()
    from public.sector_budget_periods
    where sector_budget_id = v_sector_budget.id
      and year = p_from_year_adjusted 
      and month = p_from_month;
  end loop;
end;
$$; 