-- Simple fix: Replace the existing auto_update_sector_budget to recalculate totals
-- instead of adding differences

-- Drop the existing trigger
drop trigger if exists trigger_auto_update_sector_budget on category_budgets;

-- Replace the function to recalculate totals from scratch
create or replace function public.auto_update_sector_budget()
returns trigger
language plpgsql
security definer
as $$
declare
  v_sector_id uuid;
  v_category_budgets_total numeric := 0;
begin
  -- Get the sector for this category
  select sc.sector_id into v_sector_id
  from sector_categories sc
  where sc.category_id = new.category_id
  limit 1;

  if v_sector_id is null then
    return new;
  end if;

  -- Calculate TOTAL of ALL category budgets for this sector and month
  select coalesce(sum(
    case
      when cb.budget_type = 'absolute' then cb.absolute_amount
      when cb.budget_type = 'split' then coalesce(cb.user1_amount,0) + coalesce(cb.user2_amount,0)
      else 0
    end
  ), 0)
  into v_category_budgets_total
  from category_budgets cb
  join sector_categories sc on cb.category_id = sc.category_id
  where sc.sector_id = v_sector_id
    and cb.year = new.year
    and cb.month = new.month;

  -- Update sector budget to match the total
  update sector_budgets
  set absolute_amount = v_category_budgets_total,
      updated_at = now()
  where sector_id = v_sector_id
    and year = new.year
    and month = new.month
    and auto_rollup = true
    and budget_type = 'absolute';

  -- Update corresponding budget period
  update sector_budget_periods
  set budget_amount = v_category_budgets_total,
      updated_at = now()
  where sector_budget_id = (
    select id from sector_budgets
    where sector_id = v_sector_id
      and year = new.year
      and month = new.month
      and auto_rollup = true
      and budget_type = 'absolute'
  );

  return new;
end;
$$;

-- Recreate the trigger
create trigger trigger_auto_update_sector_budget
  after update on category_budgets
  for each row
  execute function public.auto_update_sector_budget(); 