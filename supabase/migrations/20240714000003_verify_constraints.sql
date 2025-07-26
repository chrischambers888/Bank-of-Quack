-- 20240714000003_verify_constraints.sql
-- Verify that constraints are working correctly

-- First, let's check what constraints exist
do $$
declare
  constraint_rec record;
begin
  raise notice 'Checking constraints on category_budgets table:';
  for constraint_rec in
    select constraint_name, constraint_type
    from information_schema.table_constraints
    where table_name = 'category_budgets'
  loop
    raise notice 'Constraint: % (Type: %)', constraint_rec.constraint_name, constraint_rec.constraint_type;
  end loop;
end $$;

-- Check the unique constraint specifically
do $$
declare
  column_rec record;
begin
  raise notice 'Checking unique_category_month constraint columns:';
  for column_rec in
    select column_name
    from information_schema.key_column_usage
    where constraint_name = 'unique_category_month'
    and table_name = 'category_budgets'
    order by ordinal_position
  loop
    raise notice 'Column: %', column_rec.column_name;
  end loop;
end $$;

-- Test the constraint by trying to insert duplicate data
do $$
declare
  v_test_category_id uuid;
  v_budget_id1 uuid;
  v_budget_id2 uuid;
  v_error_occurred boolean := false;
begin
  -- Get a test category
  select id into v_test_category_id from categories limit 1;
  
  if v_test_category_id is null then
    raise exception 'No categories found for testing';
  end if;
  
  raise notice 'Testing constraint with category: %', v_test_category_id;
  
  -- Try to create a budget for June 2025
  begin
    select create_budget_for_month(v_test_category_id, 2025, 6, 'absolute', 100, null, null) into v_budget_id1;
    raise notice 'Successfully created budget for June 2025: %', v_budget_id1;
  exception when others then
    raise notice 'Failed to create budget for June 2025: %', SQLERRM;
    v_error_occurred := true;
  end;
  
  -- Try to create a budget for July 2025 (should work)
  begin
    select create_budget_for_month(v_test_category_id, 2025, 7, 'absolute', 200, null, null) into v_budget_id2;
    raise notice 'Successfully created budget for July 2025: %', v_budget_id2;
  exception when others then
    raise notice 'Failed to create budget for July 2025: %', SQLERRM;
    v_error_occurred := true;
  end;
  
  -- Try to create another budget for June 2025 (should fail due to constraint)
  begin
    perform create_budget_for_month(v_test_category_id, 2025, 6, 'absolute', 300, null, null);
    raise notice 'ERROR: Should have failed to create duplicate budget for June 2025';
    v_error_occurred := true;
  exception when unique_violation then
    raise notice 'Correctly prevented duplicate budget for June 2025';
  when others then
    raise notice 'Unexpected error creating duplicate budget: %', SQLERRM;
    v_error_occurred := true;
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
  
  if v_error_occurred then
    raise notice 'Constraint test completed with errors';
  else
    raise notice 'Constraint test completed successfully';
  end if;
end $$; 