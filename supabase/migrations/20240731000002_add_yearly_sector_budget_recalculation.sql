-- 20240731000002_add_yearly_sector_budget_recalculation.sql
-- Add recalculation functionality for yearly sector budgets when yearly category budgets change

-- Function to recalculate yearly sector budget from category budgets
create or replace function public.recalculate_yearly_sector_budget_from_categories(
  p_sector_id uuid,
  p_year integer
)
returns void
language plpgsql
security definer
as $$
declare
  v_category_budgets_total numeric := 0;
  v_sector_budget_id uuid;
begin
  -- Calculate TOTAL of ALL yearly category budgets for this sector and year
  select coalesce(sum(
    case
      when ycb.budget_type = 'absolute' then ycb.absolute_amount
      when ycb.budget_type = 'split' then coalesce(ycb.user1_amount,0) + coalesce(ycb.user2_amount,0)
      else 0
    end
  ), 0)
  into v_category_budgets_total
  from yearly_category_budgets ycb
  join sector_categories sc on ycb.category_id = sc.category_id
  where sc.sector_id = p_sector_id
    and ycb.year = p_year;

  -- Get the yearly sector budget ID
  select id into v_sector_budget_id
  from yearly_sector_budgets
  where sector_id = p_sector_id
    and year = p_year;

  -- Update yearly sector budget if it exists and auto-rollup is enabled
  if v_sector_budget_id is not null then
    update yearly_sector_budgets
    set absolute_amount = v_category_budgets_total,
        updated_at = now()
    where id = v_sector_budget_id
      and auto_rollup = true
      and budget_type = 'absolute';
  end if;
end;
$$;



-- Function to roll down yearly sector budget when yearly category budget is deleted
create or replace function public.roll_down_yearly_sector_budget()
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
      when ycb.budget_type = 'absolute' then ycb.absolute_amount
      when ycb.budget_type = 'split' then coalesce(ycb.user1_amount,0) + coalesce(ycb.user2_amount,0)
      else 0
    end
  ), 0) into v_remaining_category_budgets
  from yearly_category_budgets ycb
  join sector_categories sc on ycb.category_id = sc.category_id
  where sc.sector_id = v_sector_id
    and ycb.year = old.year;

  -- Only update yearly sector budget if it won't violate the constraint
  if v_remaining_category_budgets = 0 then
    -- No remaining category budgets, delete the yearly sector budget if auto-rollup
    delete from yearly_sector_budgets
    where sector_id = v_sector_id
      and auto_rollup = true
      and year = old.year;
  else
    -- Update yearly sector budget by subtracting the deleted category budget amount
    update yearly_sector_budgets
    set absolute_amount = absolute_amount - v_deleted_budget_amount,
        updated_at = now()
    where sector_id = v_sector_id 
      and auto_rollup = true
      and budget_type = 'absolute'
      and year = old.year;
  end if;

  return old;
end;
$$;

-- Create trigger for rolling down yearly sector budgets on delete
create trigger trigger_roll_down_yearly_sector_budget
  after delete on yearly_category_budgets
  for each row
  execute function public.roll_down_yearly_sector_budget(); 