-- 20240731000003_add_update_sector_budget_for_month.sql
-- Add the missing update_sector_budget_for_month function that the frontend is trying to call

-- Function to update an existing sector budget for a month
create or replace function public.update_sector_budget_for_month(
  p_budget_id uuid,
  p_budget_type text,
  p_absolute_amount numeric,
  p_user1_amount numeric,
  p_user2_amount numeric,
  p_auto_rollup boolean
)
returns void
language plpgsql
security definer
as $$
begin
  -- Update the existing sector budget
  update sector_budgets
  set budget_type = p_budget_type,
      absolute_amount = p_absolute_amount,
      user1_amount = p_user1_amount,
      user2_amount = p_user2_amount,
      auto_rollup = p_auto_rollup,
      updated_at = now()
  where id = p_budget_id;
end;
$$; 