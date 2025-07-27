-- 20240717000004_fix_bulk_delete_triggers.sql
-- Fix triggers to handle bulk deletions properly

-- Drop the problematic triggers first
drop trigger if exists trigger_auto_delete_sector_budget on category_budgets;
drop trigger if exists trigger_roll_down_sector_budget on category_budgets;

-- Recreate the auto-delete function with better logic
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

-- Recreate the roll-down function with better logic
create or replace function public.roll_down_sector_budget()
returns trigger
language plpgsql
security definer
as $$
declare
  v_sector_id uuid;
  v_deleted_budget_amount numeric := 0;
  v_remaining_category_budgets numeric := 0;
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

  -- Calculate remaining category budgets for this sector
  select coalesce(sum(
    case
      when cb.budget_type = 'absolute' then cb.absolute_amount
      when cb.budget_type = 'split' then coalesce(cb.user1_amount,0) + coalesce(cb.user2_amount,0)
      else 0
    end
  ), 0) into v_remaining_category_budgets
  from category_budgets cb
  join sector_categories sc on cb.category_id = sc.category_id
  where sc.sector_id = v_sector_id
    and cb.year = old.year
    and cb.month = old.month;

  -- Only update sector budget if it won't violate the constraint
  if v_remaining_category_budgets = 0 then
    -- No remaining category budgets, delete the sector budget if auto-rollup
    delete from sector_budgets
    where sector_id = v_sector_id
      and auto_rollup = true
      and year = old.year
      and month = old.month;
  else
    -- Update sector budget by subtracting the deleted category budget amount
    update sector_budgets
    set absolute_amount = absolute_amount - v_deleted_budget_amount,
        updated_at = now()
    where sector_id = v_sector_id 
      and auto_rollup = true
      and budget_type = 'absolute'
      and year = old.year
      and month = old.month;

    -- Update corresponding budget period
    update sector_budget_periods
    set budget_amount = budget_amount - v_deleted_budget_amount,
        updated_at = now()
    where sector_budget_id = (
      select id from sector_budgets 
      where sector_id = v_sector_id 
        and auto_rollup = true
        and budget_type = 'absolute'
        and year = old.year
        and month = old.month
    );
  end if;

  return old;
end;
$$;

-- Recreate the triggers
create trigger trigger_auto_delete_sector_budget
  after delete on category_budgets
  for each row
  execute function public.auto_delete_sector_budget();

create trigger trigger_roll_down_sector_budget
  after delete on category_budgets
  for each row
  execute function public.roll_down_sector_budget(); 