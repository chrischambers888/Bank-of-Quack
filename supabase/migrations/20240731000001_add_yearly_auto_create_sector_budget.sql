-- 20240731000001_add_yearly_auto_create_sector_budget.sql
-- Add auto-creation functionality for yearly sector budgets when yearly category budgets are created

-- Function to auto-create yearly sector budget when first yearly category budget is created
create or replace function public.auto_create_yearly_sector_budget()
returns trigger
language plpgsql
security definer
as $$
declare
  v_sector_id uuid;
  v_category_budget_amount numeric := 0;
begin
  -- Get the sector for this category
  select sc.sector_id into v_sector_id
  from sector_categories sc
  where sc.category_id = new.category_id
  limit 1;

  if v_sector_id is null then
    return new;
  end if;

  -- Calculate the budget amount for the new category budget
  v_category_budget_amount := coalesce(
    case
      when new.budget_type = 'absolute' then new.absolute_amount
      when new.budget_type = 'split' then coalesce(new.user1_amount,0) + coalesce(new.user2_amount,0)
      else 0
    end, 0);

  -- Check if yearly sector budget already exists for this year
  if not exists (
    select 1 from yearly_sector_budgets 
    where sector_id = v_sector_id 
      and year = new.year
  ) then
    -- Auto-create yearly sector budget with absolute type and auto-rollup enabled
    perform public.create_yearly_budget_for_sector(
      v_sector_id,
      new.year,
      'absolute',
      v_category_budget_amount,
      null,
      null,
      true
    );
  else
    -- Yearly sector budget exists, check if auto-rollup is enabled
    if exists (
      select 1 from yearly_sector_budgets 
      where sector_id = v_sector_id 
        and year = new.year
        and auto_rollup = true
    ) then
      -- Update yearly sector budget by adding the new category budget amount
      update yearly_sector_budgets
      set absolute_amount = absolute_amount + v_category_budget_amount,
          updated_at = now()
      where sector_id = v_sector_id 
        and year = new.year
        and auto_rollup = true;
    end if;
  end if;

  return new;
end;
$$;

-- Create trigger for auto-creating yearly sector budgets
create trigger trigger_auto_create_yearly_sector_budget
  after insert on yearly_category_budgets
  for each row
  execute function public.auto_create_yearly_sector_budget();

-- Function to auto-update yearly sector budget when yearly category budget is updated
create or replace function public.auto_update_yearly_sector_budget()
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
    select 1 from yearly_sector_budgets 
    where sector_id = v_sector_id 
      and year = new.year
      and auto_rollup = true
  ) then
    -- Update yearly sector budget by adding the difference
    update yearly_sector_budgets
    set absolute_amount = absolute_amount + v_budget_difference,
        updated_at = now()
    where sector_id = v_sector_id 
      and year = new.year
      and auto_rollup = true;
  end if;

  return new;
end;
$$;

-- Create trigger for auto-updating yearly sector budgets
create trigger trigger_auto_update_yearly_sector_budget
  after update on yearly_category_budgets
  for each row
  execute function public.auto_update_yearly_sector_budget();

-- Function to auto-delete yearly sector budget when last yearly category budget is deleted
create or replace function public.auto_delete_yearly_sector_budget()
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
    delete from yearly_sector_budgets
    where sector_id = v_sector_id
      and auto_rollup = true;
  end if;

  return old;
end;
$$;

-- Create trigger for auto-deleting yearly sector budgets
create trigger trigger_auto_delete_yearly_sector_budget
  after delete on yearly_category_budgets
  for each row
  execute function public.auto_delete_yearly_sector_budget(); 