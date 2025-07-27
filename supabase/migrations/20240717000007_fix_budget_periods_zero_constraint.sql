-- 20240717000007_fix_budget_periods_zero_constraint.sql
-- Fix budget_periods table constraint to allow $0 budgets

-- Drop the problematic constraint that prevents zero budget amounts
do $$
begin
  -- Check if the constraint exists and drop it
  if exists (
    select 1 from information_schema.table_constraints 
    where constraint_name = 'budget_periods_budget_amount_check' 
    and table_name = 'budget_periods'
  ) then
    alter table budget_periods drop constraint budget_periods_budget_amount_check;
    raise notice 'Dropped budget_periods_budget_amount_check constraint';
  else
    raise notice 'budget_periods_budget_amount_check constraint not found';
  end if;
end $$;

-- Also check for other similar constraints on budget_periods
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints 
    where constraint_name = 'budget_periods_spent_amount_check' 
    and table_name = 'budget_periods'
  ) then
    alter table budget_periods drop constraint budget_periods_spent_amount_check;
    raise notice 'Dropped budget_periods_spent_amount_check constraint';
  else
    raise notice 'budget_periods_spent_amount_check constraint not found';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.table_constraints 
    where constraint_name = 'budget_periods_user1_spent_check' 
    and table_name = 'budget_periods'
  ) then
    alter table budget_periods drop constraint budget_periods_user1_spent_check;
    raise notice 'Dropped budget_periods_user1_spent_check constraint';
  else
    raise notice 'budget_periods_user1_spent_check constraint not found';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.table_constraints 
    where constraint_name = 'budget_periods_user2_spent_check' 
    and table_name = 'budget_periods'
  ) then
    alter table budget_periods drop constraint budget_periods_user2_spent_check;
    raise notice 'Dropped budget_periods_user2_spent_check constraint';
  else
    raise notice 'budget_periods_user2_spent_check constraint not found';
  end if;
end $$;

-- Add new constraints that allow zero values
alter table budget_periods 
add constraint budget_periods_budget_amount_check 
check (budget_amount >= 0);

alter table budget_periods 
add constraint budget_periods_spent_amount_check 
check (spent_amount >= 0);

alter table budget_periods 
add constraint budget_periods_user1_spent_check 
check (user1_spent >= 0);

alter table budget_periods 
add constraint budget_periods_user2_spent_check 
check (user2_spent >= 0);

-- Also fix sector_budget_periods table if it has similar constraints
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints 
    where constraint_name = 'sector_budget_periods_budget_amount_check' 
    and table_name = 'sector_budget_periods'
  ) then
    alter table sector_budget_periods drop constraint sector_budget_periods_budget_amount_check;
    raise notice 'Dropped sector_budget_periods_budget_amount_check constraint';
  else
    raise notice 'sector_budget_periods_budget_amount_check constraint not found';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.table_constraints 
    where constraint_name = 'sector_budget_periods_spent_amount_check' 
    and table_name = 'sector_budget_periods'
  ) then
    alter table sector_budget_periods drop constraint sector_budget_periods_spent_amount_check;
    raise notice 'Dropped sector_budget_periods_spent_amount_check constraint';
  else
    raise notice 'sector_budget_periods_spent_amount_check constraint not found';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.table_constraints 
    where constraint_name = 'sector_budget_periods_user1_spent_check' 
    and table_name = 'sector_budget_periods'
  ) then
    alter table sector_budget_periods drop constraint sector_budget_periods_user1_spent_check;
    raise notice 'Dropped sector_budget_periods_user1_spent_check constraint';
  else
    raise notice 'sector_budget_periods_user1_spent_check constraint not found';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.table_constraints 
    where constraint_name = 'sector_budget_periods_user2_spent_check' 
    and table_name = 'sector_budget_periods'
  ) then
    alter table sector_budget_periods drop constraint sector_budget_periods_user2_spent_check;
    raise notice 'Dropped sector_budget_periods_user2_spent_check constraint';
  else
    raise notice 'sector_budget_periods_user2_spent_check constraint not found';
  end if;
end $$;

-- Add new constraints for sector_budget_periods that allow zero values
alter table sector_budget_periods 
add constraint sector_budget_periods_budget_amount_check 
check (budget_amount >= 0);

alter table sector_budget_periods 
add constraint sector_budget_periods_spent_amount_check 
check (spent_amount >= 0);

alter table sector_budget_periods 
add constraint sector_budget_periods_user1_spent_check 
check (user1_spent >= 0);

alter table sector_budget_periods 
add constraint sector_budget_periods_user2_spent_check 
check (user2_spent >= 0); 