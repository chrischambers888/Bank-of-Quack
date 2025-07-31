-- Fix monthly auto-rollup and constraint issues
-- Follow the same pattern as yearly system which works correctly

-- First, drop the problematic constraint trigger
drop trigger if exists trigger_validate_sector_budget on sector_budgets;

-- Drop the existing auto-rollup triggers to recreate them properly
drop trigger if exists trigger_auto_update_sector_budget on category_budgets;
drop trigger if exists trigger_auto_create_sector_budget on category_budgets;
drop trigger if exists trigger_auto_delete_sector_budget on category_budgets;
drop trigger if exists trigger_roll_down_sector_budget on category_budgets;

-- Function to auto-create sector budget when first category budget is created
create or replace function public.auto_create_sector_budget()
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

  -- Check if sector budget already exists for this month
  if not exists (
    select 1 from sector_budgets 
    where sector_id = v_sector_id 
      and year = new.year 
      and month = new.month
  ) then
    -- Auto-create sector budget with absolute type and auto-rollup enabled
    perform public.create_sector_budget_for_month(
      v_sector_id,
      new.year,
      new.month,
      'absolute',
      v_category_budget_amount,
      null,
      null,
      true
    );
  else
    -- Sector budget exists, check if auto-rollup is enabled
    if exists (
      select 1 from sector_budgets 
      where sector_id = v_sector_id 
        and year = new.year 
        and month = new.month
        and auto_rollup = true
    ) then
      -- Update sector budget by adding the new category budget amount
      update sector_budgets
      set absolute_amount = absolute_amount + v_category_budget_amount,
          updated_at = now()
      where sector_id = v_sector_id 
        and year = new.year 
        and month = new.month
        and auto_rollup = true;
    end if;
  end if;

  return new;
end;
$$;

-- Function to auto-update sector budget when category budget is updated
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
  ) then
    -- Update sector budget by adding the difference
    update sector_budgets
    set absolute_amount = absolute_amount + v_budget_difference,
        updated_at = now()
    where sector_id = v_sector_id 
      and year = new.year
      and month = new.month
      and auto_rollup = true;
  end if;

  return new;
end;
$$;

-- Function to auto-delete sector budget when last category budget is deleted
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

  -- Calculate the deleted budget amount
  v_deleted_budget_amount := coalesce(
    case
      when old.budget_type = 'absolute' then old.absolute_amount
      when old.budget_type = 'split' then coalesce(old.user1_amount,0) + coalesce(old.user2_amount,0)
      else 0
    end, 0);

  -- Update sector budget by subtracting the deleted amount if auto-rollup is enabled
  if v_deleted_budget_amount > 0 and exists (
    select 1 from sector_budgets 
    where sector_id = v_sector_id 
      and year = old.year
      and month = old.month
      and auto_rollup = true
  ) then
    update sector_budgets
    set absolute_amount = absolute_amount - v_deleted_budget_amount,
        updated_at = now()
    where sector_id = v_sector_id 
      and year = old.year
      and month = old.month
      and auto_rollup = true;
  end if;

  return old;
end;
$$;

-- Create triggers for all operations
create trigger trigger_auto_create_sector_budget
  after insert on category_budgets
  for each row
  execute function public.auto_create_sector_budget();

create trigger trigger_auto_update_sector_budget
  after update on category_budgets
  for each row
  execute function public.auto_update_sector_budget();

create trigger trigger_auto_delete_sector_budget
  after delete on category_budgets
  for each row
  execute function public.auto_delete_sector_budget();

create trigger trigger_roll_down_sector_budget
  after delete on category_budgets
  for each row
  execute function public.roll_down_sector_budget();

-- Create a more lenient constraint validation function
create or replace function public.validate_sector_budget_constraint()
returns trigger
language plpgsql
security definer
as $$
declare
  v_category_budgets_total numeric := 0;
  v_sector_budget_amount numeric := 0;
begin
  -- Only validate if this is a sector budget update and auto-rollup is enabled
  if tg_table_name = 'sector_budgets' and new.auto_rollup = true then
    -- Get total of all category budgets for this sector and month
    select coalesce(sum(
      case
        when cb.budget_type = 'absolute' then cb.absolute_amount
        when cb.budget_type = 'split' then coalesce(cb.user1_amount,0) + coalesce(cb.user2_amount,0)
        else 0
      end
    ), 0) into v_category_budgets_total
    from category_budgets cb
    join sector_categories sc on cb.category_id = sc.category_id
    where sc.sector_id = new.sector_id
      and cb.year = new.year
      and cb.month = new.month;

    -- Get the sector budget amount
    v_sector_budget_amount := coalesce(
      case
        when new.budget_type = 'absolute' then new.absolute_amount
        when new.budget_type = 'split' then coalesce(new.user1_amount,0) + coalesce(new.user2_amount,0)
        else 0
      end, 0);

    -- Only validate if there are category budgets and the amounts don't match
    if v_category_budgets_total > 0 and v_sector_budget_amount != v_category_budgets_total then
      raise exception 'Sector budget amount (%) does not match sum of category budgets (%) for sector %', 
        v_sector_budget_amount, v_category_budgets_total, new.sector_id;
    end if;
  end if;

  return new;
end;
$$;

-- Recreate the constraint trigger
create trigger trigger_validate_sector_budget
  before insert or update on sector_budgets
  for each row
  execute function public.validate_sector_budget_constraint(); 