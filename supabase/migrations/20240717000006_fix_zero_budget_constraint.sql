-- 20240717000006_fix_zero_budget_constraint.sql
-- Fix database constraint to allow $0 budgets

-- Drop the problematic constraint that prevents zero budgets
do $$
begin
  -- Check if the constraint exists and drop it
  if exists (
    select 1 from information_schema.table_constraints 
    where constraint_name = 'category_budgets_absolute_amount_check' 
    and table_name = 'category_budgets'
  ) then
    alter table category_budgets drop constraint category_budgets_absolute_amount_check;
    raise notice 'Dropped category_budgets_absolute_amount_check constraint';
  else
    raise notice 'category_budgets_absolute_amount_check constraint not found';
  end if;
end $$;

-- Also check for any other similar constraints on user amounts
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints 
    where constraint_name = 'category_budgets_user1_amount_check' 
    and table_name = 'category_budgets'
  ) then
    alter table category_budgets drop constraint category_budgets_user1_amount_check;
    raise notice 'Dropped category_budgets_user1_amount_check constraint';
  else
    raise notice 'category_budgets_user1_amount_check constraint not found';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.table_constraints 
    where constraint_name = 'category_budgets_user2_amount_check' 
    and table_name = 'category_budgets'
  ) then
    alter table category_budgets drop constraint category_budgets_user2_amount_check;
    raise notice 'Dropped category_budgets_user2_amount_check constraint';
  else
    raise notice 'category_budgets_user2_amount_check constraint not found';
  end if;
end $$;

-- Add new constraints that allow zero values
alter table category_budgets 
add constraint category_budgets_absolute_amount_check 
check (absolute_amount is null or absolute_amount >= 0);

alter table category_budgets 
add constraint category_budgets_user1_amount_check 
check (user1_amount is null or user1_amount >= 0);

alter table category_budgets 
add constraint category_budgets_user2_amount_check 
check (user2_amount is null or user2_amount >= 0);

-- Also fix sector_budgets table if it has similar constraints
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints 
    where constraint_name = 'sector_budgets_absolute_amount_check' 
    and table_name = 'sector_budgets'
  ) then
    alter table sector_budgets drop constraint sector_budgets_absolute_amount_check;
    raise notice 'Dropped sector_budgets_absolute_amount_check constraint';
  else
    raise notice 'sector_budgets_absolute_amount_check constraint not found';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.table_constraints 
    where constraint_name = 'sector_budgets_user1_amount_check' 
    and table_name = 'sector_budgets'
  ) then
    alter table sector_budgets drop constraint sector_budgets_user1_amount_check;
    raise notice 'Dropped sector_budgets_user1_amount_check constraint';
  else
    raise notice 'sector_budgets_user1_amount_check constraint not found';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.table_constraints 
    where constraint_name = 'sector_budgets_user2_amount_check' 
    and table_name = 'sector_budgets'
  ) then
    alter table sector_budgets drop constraint sector_budgets_user2_amount_check;
    raise notice 'Dropped sector_budgets_user2_amount_check constraint';
  else
    raise notice 'sector_budgets_user2_amount_check constraint not found';
  end if;
end $$;

-- Add new constraints for sector_budgets that allow zero values
alter table sector_budgets 
add constraint sector_budgets_absolute_amount_check 
check (absolute_amount is null or absolute_amount >= 0);

alter table sector_budgets 
add constraint sector_budgets_user1_amount_check 
check (user1_amount is null or user1_amount >= 0);

alter table sector_budgets 
add constraint sector_budgets_user2_amount_check 
check (user2_amount is null or user2_amount >= 0); 