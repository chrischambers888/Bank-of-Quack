-- Fix auto-rollup calculation drift issue
-- The problem is that the trigger is adding differences instead of recalculating totals

-- Drop the problematic trigger
drop trigger if exists trigger_auto_recalculate_sector_budget on category_budgets;

-- Function to properly recalculate sector budget from scratch
create or replace function public.auto_recalculate_sector_budget()
returns trigger
language plpgsql
security definer
as $$
declare
  v_sector_id uuid;
  v_year integer;
  v_month integer;
  v_category_budgets_total numeric := 0;
  v_sector_budget_id uuid;
begin
  -- Get the sector for this category
  select sc.sector_id into v_sector_id
  from sector_categories sc
  where sc.category_id = new.category_id
  limit 1;

  if v_sector_id is null then
    return new;
  end if;

  -- Get year and month from the category budget
  v_year := new.year;
  v_month := new.month;

  -- Calculate the TOTAL of ALL category budgets for this sector and month
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
    and cb.year = v_year
    and cb.month = v_month;

  -- Get the sector budget ID
  select id into v_sector_budget_id
  from sector_budgets
  where sector_id = v_sector_id
    and year = v_year
    and month = v_month;

  -- Update sector budget if it exists and auto-rollup is enabled
  if v_sector_budget_id is not null then
    update sector_budgets
    set absolute_amount = v_category_budgets_total,
        updated_at = now()
    where id = v_sector_budget_id
      and auto_rollup = true
      and budget_type = 'absolute';

    -- Update corresponding budget period
    update sector_budget_periods
    set budget_amount = v_category_budgets_total,
        updated_at = now()
    where sector_budget_id = v_sector_budget_id;
  end if;

  return new;
end;
$$;

-- Create trigger for auto-recalculating sector budgets
create trigger trigger_auto_recalculate_sector_budget
  after insert or update on category_budgets
  for each row
  execute function public.auto_recalculate_sector_budget(); 