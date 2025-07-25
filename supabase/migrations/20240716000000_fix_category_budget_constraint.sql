-- 20240716000000_fix_category_budget_constraint.sql
-- Fix the uq_category_budget constraint that's preventing multiple budgets for the same category

-- First, let's identify and drop the problematic constraint
do $$
begin
  -- Check if the problematic constraint exists
  if exists (
    select 1 from information_schema.table_constraints 
    where constraint_name = 'uq_category_budget' 
    and table_name = 'category_budgets'
  ) then
    -- Drop the problematic constraint
    alter table category_budgets drop constraint uq_category_budget;
    raise notice 'Dropped uq_category_budget constraint';
  else
    raise notice 'uq_category_budget constraint not found';
  end if;
end $$;

-- Ensure we have the correct unique constraint on category_budgets
-- Drop any existing unique_category_month constraint first
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints 
    where constraint_name = 'unique_category_month' 
    and table_name = 'category_budgets'
  ) then
    alter table category_budgets drop constraint unique_category_month;
    raise notice 'Dropped existing unique_category_month constraint';
  end if;
end $$;

-- Add the correct unique constraint that allows multiple budgets per category
-- but prevents duplicates for the same category/month combination
alter table category_budgets 
add constraint unique_category_month unique (category_id, year, month);

-- Ensure we have the correct unique constraint on budget_periods
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints 
    where constraint_name = 'unique_budget_period' 
    and table_name = 'budget_periods'
  ) then
    alter table budget_periods drop constraint unique_budget_period;
    raise notice 'Dropped existing unique_budget_period constraint';
  end if;
end $$;

alter table budget_periods 
add constraint unique_budget_period unique (category_budget_id, year, month);

-- Drop and recreate the create_budget_for_month function with clean logic
drop function if exists public.create_budget_for_month(uuid, integer, integer, text, numeric, numeric, numeric);

create or replace function public.create_budget_for_month(
  p_category_id uuid,
  p_year integer,
  p_month integer,
  p_budget_type text,
  p_absolute_amount numeric,
  p_user1_amount numeric,
  p_user2_amount numeric
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_budget_id uuid;
  v_budget_amount numeric := 0;
  v_total_spent numeric := 0;
  v_user1_spent numeric := 0;
  v_user2_spent numeric := 0;
begin
  -- Calculate budget amount
  v_budget_amount := coalesce(
    case
      when p_budget_type = 'absolute' then p_absolute_amount
      when p_budget_type = 'split' then coalesce(p_user1_amount,0) + coalesce(p_user2_amount,0)
      else 0
    end, 0);

  -- Calculate spent amounts for the month using split_type logic
  select 
    coalesce(sum(amount), 0),
    coalesce(sum(
      case 
        when split_type = 'user1_only' then amount
        when split_type = 'splitEqually' then amount / 2
        when split_type = 'user2_only' then 0
        else 0
      end
    ), 0),
    coalesce(sum(
      case 
        when split_type = 'user1_only' then 0
        when split_type = 'splitEqually' then amount / 2
        when split_type = 'user2_only' then amount
        else 0
      end
    ), 0)
  into v_total_spent, v_user1_spent, v_user2_spent
  from public.transactions
  where category_id = p_category_id
    and transaction_type = 'expense'
    and extract(year from date) = p_year
    and extract(month from date) = p_month;

  -- Insert the budget for the specific month
  -- If a budget already exists for this category/month, it will be updated
  insert into category_budgets (
    category_id, year, month, budget_type, absolute_amount, user1_amount, user2_amount, created_at, updated_at
  ) values (
    p_category_id, p_year, p_month, p_budget_type, p_absolute_amount, p_user1_amount, p_user2_amount, now(), now()
  )
  on conflict (category_id, year, month) do update
  set budget_type = excluded.budget_type,
      absolute_amount = excluded.absolute_amount,
      user1_amount = excluded.user1_amount,
      user2_amount = excluded.user2_amount,
      updated_at = now()
  returning id into v_budget_id;

  -- Insert or update corresponding budget_periods entry
  insert into budget_periods (
    category_budget_id, year, month, budget_amount, spent_amount, user1_spent, user2_spent, created_at, updated_at
  ) values (
    v_budget_id, p_year, p_month, v_budget_amount, v_total_spent, v_user1_spent, v_user2_spent, now(), now()
  )
  on conflict (category_budget_id, year, month) do update
  set budget_amount = excluded.budget_amount,
      spent_amount = excluded.spent_amount,
      user1_spent = excluded.user1_spent,
      user2_spent = excluded.user2_spent,
      updated_at = now();

  return v_budget_id;
end;
$$;

-- Create a test function to verify the fix works
create or replace function public.test_constraint_fix()
returns text
language plpgsql
security definer
as $$
declare
  v_category_id uuid;
  v_budget_id1 uuid;
  v_budget_id2 uuid;
  v_result text := '';
begin
  -- Get a category to test with
  select id into v_category_id from categories limit 1;
  
  if v_category_id is null then
    return 'No categories found for testing';
  end if;
  
  v_result := 'Testing constraint fix with category: ' || v_category_id;
  
  -- Test 1: Create budget for May 2025
  begin
    select create_budget_for_month(v_category_id, 2025, 5, 'absolute', 100, null, null) into v_budget_id1;
    v_result := v_result || ' | ✓ Created budget for May 2025';
  exception when others then
    v_result := v_result || ' | ✗ Failed to create budget for May 2025: ' || SQLERRM;
    return v_result;
  end;
  
  -- Test 2: Create budget for June 2025 (different month, should work)
  begin
    select create_budget_for_month(v_category_id, 2025, 6, 'absolute', 200, null, null) into v_budget_id2;
    v_result := v_result || ' | ✓ Created budget for June 2025';
  exception when others then
    v_result := v_result || ' | ✗ Failed to create budget for June 2025: ' || SQLERRM;
    return v_result;
  end;
  
  -- Test 3: Try to create another budget for May 2025 (should update existing)
  begin
    select create_budget_for_month(v_category_id, 2025, 5, 'absolute', 150, null, null) into v_budget_id1;
    v_result := v_result || ' | ✓ Updated budget for May 2025';
  exception when others then
    v_result := v_result || ' | ✗ Failed to update budget for May 2025: ' || SQLERRM;
  end;
  
  -- Clean up test data
  if v_budget_id1 is not null then
    delete from budget_periods where category_budget_id = v_budget_id1;
    delete from category_budgets where id = v_budget_id1;
  end if;
  
  if v_budget_id2 is not null then
    delete from budget_periods where category_budget_id = v_budget_id2;
    delete from category_budgets where id = v_budget_id2;
  end if;
  
  return v_result;
end;
$$;

-- Run the test
select public.test_constraint_fix();

-- Clean up test function
drop function if exists public.test_constraint_fix(); 