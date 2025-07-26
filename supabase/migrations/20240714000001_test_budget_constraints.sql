-- 20240714000001_test_budget_constraints.sql
-- Test migration to verify budget constraints are working correctly

-- First, let's verify the current constraint setup
do $$
begin
  -- Check if the unique constraint exists and is correct
  if not exists (
    select 1 from information_schema.table_constraints 
    where constraint_name = 'unique_category_month' 
    and table_name = 'category_budgets'
    and constraint_type = 'UNIQUE'
  ) then
    raise exception 'unique_category_month constraint does not exist or is not UNIQUE';
  end if;
  
  -- Check the constraint columns
  if not exists (
    select 1 from information_schema.key_column_usage
    where constraint_name = 'unique_category_month'
    and table_name = 'category_budgets'
    and column_name in ('category_id', 'year', 'month')
  ) then
    raise exception 'unique_category_month constraint does not include category_id, year, month';
  end if;
  
  raise notice 'Budget constraints are properly configured';
end $$;

-- Create a test function to verify budget creation works for different months
create or replace function public.test_budget_creation()
returns void
language plpgsql
security definer
as $$
declare
  v_test_category_id uuid;
  v_budget_id1 uuid;
  v_budget_id2 uuid;
begin
  -- Get a test category (first one available)
  select id into v_test_category_id from categories limit 1;
  
  if v_test_category_id is null then
    raise exception 'No categories found for testing';
  end if;
  
  -- Try to create budgets for different months
  -- This should work without errors
  select create_budget_for_month(v_test_category_id, 2025, 6, 'absolute', 100, null, null) into v_budget_id1;
  select create_budget_for_month(v_test_category_id, 2025, 7, 'absolute', 200, null, null) into v_budget_id2;
  
  -- Verify both budgets were created
  if v_budget_id1 is null or v_budget_id2 is null then
    raise exception 'Failed to create test budgets';
  end if;
  
  -- Verify they are different budgets
  if v_budget_id1 = v_budget_id2 then
    raise exception 'Created budgets have the same ID';
  end if;
  
  -- Clean up test data
  delete from budget_periods where category_budget_id in (v_budget_id1, v_budget_id2);
  delete from category_budgets where id in (v_budget_id1, v_budget_id2);
  
  raise notice 'Budget creation test passed - constraints are working correctly';
end;
$$;

-- Run the test
select public.test_budget_creation();

-- Clean up test function
drop function if exists public.test_budget_creation(); 