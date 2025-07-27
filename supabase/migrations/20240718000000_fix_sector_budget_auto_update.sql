-- 20240718000000_fix_sector_budget_auto_update.sql
-- Fix auto-rollup functionality by adding UPDATE trigger for category_budgets

-- Function to update sector budget when category budget is updated
create or replace function public.auto_update_sector_budget()
returns trigger
language plpgsql
security definer
as $$
declare
  v_sector_id uuid;
  v_old_category_budget_amount numeric := 0;
  v_new_category_budget_amount numeric := 0;
  v_budget_difference numeric := 0;
begin
  -- Get the sector for this category
  select sc.sector_id into v_sector_id
  from sector_categories sc
  where sc.category_id = new.category_id
  limit 1;

  if v_sector_id is null then
    return new;
  end if;

  -- Calculate the old budget amount
  v_old_category_budget_amount := coalesce(
    case
      when old.budget_type = 'absolute' then old.absolute_amount
      when old.budget_type = 'split' then coalesce(old.user1_amount,0) + coalesce(old.user2_amount,0)
      else 0
    end, 0);

  -- Calculate the new budget amount
  v_new_category_budget_amount := coalesce(
    case
      when new.budget_type = 'absolute' then new.absolute_amount
      when new.budget_type = 'split' then coalesce(new.user1_amount,0) + coalesce(new.user2_amount,0)
      else 0
    end, 0);

  -- Calculate the difference
  v_budget_difference := v_new_category_budget_amount - v_old_category_budget_amount;

  -- Only update if there's a difference and auto-rollup is enabled
  if v_budget_difference != 0 and exists (
    select 1 from sector_budgets 
    where sector_id = v_sector_id 
      and year = new.year 
      and month = new.month
      and auto_rollup = true
      and budget_type = 'absolute'
  ) then
    -- Update sector budget by adding the difference
    update sector_budgets
    set absolute_amount = absolute_amount + v_budget_difference,
        updated_at = now()
    where sector_id = v_sector_id 
      and year = new.year 
      and month = new.month
      and auto_rollup = true
      and budget_type = 'absolute';

    -- Update corresponding budget period
    update sector_budget_periods
    set budget_amount = budget_amount + v_budget_difference,
        updated_at = now()
    where sector_budget_id = (
      select id from sector_budgets 
      where sector_id = v_sector_id 
        and year = new.year 
        and month = new.month
        and auto_rollup = true
        and budget_type = 'absolute'
    );
  end if;

  return new;
end;
$$;

-- Create trigger for auto-updating sector budgets on category budget updates
create trigger trigger_auto_update_sector_budget
  after update on category_budgets
  for each row
  execute function public.auto_update_sector_budget(); 