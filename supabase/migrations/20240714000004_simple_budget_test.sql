-- 20240714000004_simple_budget_test.sql
-- Simple test to verify budget creation works correctly

-- Create a simple test function
create or replace function public.test_simple_budget_creation()
returns text
language plpgsql
security definer
as $$
declare
  v_category_id uuid;
  v_budget_id uuid;
  v_result text := '';
begin
  -- Get a category to test with
  select id into v_category_id from categories limit 1;
  
  if v_category_id is null then
    return 'No categories found for testing';
  end if;
  
  v_result := 'Testing with category: ' || v_category_id;
  
  -- Try to create a budget for January 2025
  begin
    select create_budget_for_month(v_category_id, 2025, 1, 'absolute', 100, null, null) into v_budget_id;
    v_result := v_result || ' | Successfully created budget for Jan 2025: ' || v_budget_id;
  exception when others then
    v_result := v_result || ' | Failed to create budget for Jan 2025: ' || SQLERRM;
    return v_result;
  end;
  
  -- Try to create a budget for February 2025 (should work)
  begin
    select create_budget_for_month(v_category_id, 2025, 2, 'absolute', 200, null, null) into v_budget_id;
    v_result := v_result || ' | Successfully created budget for Feb 2025: ' || v_budget_id;
  exception when others then
    v_result := v_result || ' | Failed to create budget for Feb 2025: ' || SQLERRM;
    return v_result;
  end;
  
  -- Try to create another budget for January 2025 (should fail)
  begin
    perform create_budget_for_month(v_category_id, 2025, 1, 'absolute', 300, null, null);
    v_result := v_result || ' | ERROR: Should have failed to create duplicate budget for Jan 2025';
  exception when unique_violation then
    v_result := v_result || ' | Correctly prevented duplicate budget for Jan 2025';
  when others then
    v_result := v_result || ' | Unexpected error creating duplicate budget: ' || SQLERRM;
  end;
  
  return v_result;
end;
$$;

-- Run the test
select public.test_simple_budget_creation();

-- Clean up test function
drop function if exists public.test_simple_budget_creation(); 