-- 20240730000001_fix_update_budget_function.sql
-- Fix update_budget_for_month function to not reference the dropped budget_periods table

-- Drop and recreate the update_budget_for_month function without budget_periods references
drop function if exists public.update_budget_for_month(uuid, text, numeric, numeric, numeric);

create or replace function public.update_budget_for_month(
  p_budget_id uuid,
  p_budget_type text,
  p_absolute_amount numeric,
  p_user1_amount numeric,
  p_user2_amount numeric
)
returns void
language plpgsql
security definer
as $$
begin
  -- Update the budget directly in category_budgets table
  update category_budgets 
  set budget_type = p_budget_type,
      absolute_amount = p_absolute_amount,
      user1_amount = p_user1_amount,
      user2_amount = p_user2_amount,
      updated_at = now()
  where id = p_budget_id;
end;
$$; 