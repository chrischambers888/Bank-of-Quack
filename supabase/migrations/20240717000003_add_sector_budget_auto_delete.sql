-- 20240717000003_add_sector_budget_auto_delete.sql
-- Add auto-delete functionality for sector budgets when all related categories are deleted

-- Function to auto-delete sector budget when all related categories are deleted
create or replace function public.auto_delete_sector_budget()
returns trigger
language plpgsql
security definer
as $$
declare
  v_sector_id uuid;
  v_remaining_categories integer;
begin
  -- Get the sector for this category
  select sc.sector_id into v_sector_id
  from sector_categories sc
  where sc.category_id = old.category_id
  limit 1;

  if v_sector_id is null then
    return old;
  end if;

  -- Check if there are any remaining categories in this sector
  select count(*) into v_remaining_categories
  from sector_categories sc
  where sc.sector_id = v_sector_id;

  -- If no categories remain and sector budget has auto-rollup enabled, delete the sector budget
  if v_remaining_categories = 0 then
    delete from sector_budgets
    where sector_id = v_sector_id
      and auto_rollup = true;
  end if;

  return old;
end;
$$;

-- Create trigger for auto-deleting sector budgets
create trigger trigger_auto_delete_sector_budget
  after delete on category_budgets
  for each row
  execute function public.auto_delete_sector_budget();

-- Function to roll down sector budget when category budget is deleted
create or replace function public.roll_down_sector_budget()
returns trigger
language plpgsql
security definer
as $$
declare
  v_sector_id uuid;
  v_deleted_budget_amount numeric := 0;
begin
  -- Get the sector for this category
  select sc.sector_id into v_sector_id
  from sector_categories sc
  where sc.category_id = old.category_id
  limit 1;

  if v_sector_id is null then
    return old;
  end if;

  -- Calculate the budget amount that was deleted
  v_deleted_budget_amount := coalesce(
    case
      when old.budget_type = 'absolute' then old.absolute_amount
      when old.budget_type = 'split' then coalesce(old.user1_amount,0) + coalesce(old.user2_amount,0)
      else 0
    end, 0);

  -- Update sector budget by subtracting the deleted category budget amount
  update sector_budgets
  set absolute_amount = absolute_amount - v_deleted_budget_amount,
      updated_at = now()
  where sector_id = v_sector_id 
    and auto_rollup = true
    and budget_type = 'absolute';

  -- Update corresponding budget period
  update sector_budget_periods
  set budget_amount = budget_amount - v_deleted_budget_amount,
      updated_at = now()
  where sector_budget_id = (
    select id from sector_budgets 
    where sector_id = v_sector_id 
      and auto_rollup = true
      and budget_type = 'absolute'
  );

  return old;
end;
$$;

-- Create trigger for rolling down sector budgets
create trigger trigger_roll_down_sector_budget
  after delete on category_budgets
  for each row
  execute function public.roll_down_sector_budget(); 