-- 20240731000007_comprehensive_fix_update_budget_function.sql
-- Comprehensive fix for update_budget_for_month function signature

-- Drop ALL possible versions of the function with ANY signature
drop function if exists public.update_budget_for_month(uuid, text, numeric, numeric, numeric);
drop function if exists public.update_budget_for_month(numeric, uuid, text, numeric, numeric);
drop function if exists public.update_budget_for_month(text, numeric, numeric, numeric, uuid);
drop function if exists public.update_budget_for_month(uuid, text, numeric, numeric);
drop function if exists public.update_budget_for_month(text, numeric, numeric, numeric);
drop function if exists public.update_budget_for_month(numeric, text, numeric, numeric);
drop function if exists public.update_budget_for_month(uuid, text, numeric);
drop function if exists public.update_budget_for_month(text, numeric, numeric);
drop function if exists public.update_budget_for_month(numeric, text, numeric);

-- Also drop any function with similar names that might be causing confusion
drop function if exists public.update_budget_for_month();

-- Recreate with the EXACT signature that the frontend expects
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