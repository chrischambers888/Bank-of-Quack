-- 20240714000002_debug_budget_creation.sql
-- Debug migration to help identify budget creation issues

-- Create a debug function to test budget creation
create or replace function public.debug_budget_creation(
  p_category_id uuid,
  p_year integer,
  p_month integer
)
returns text
language plpgsql
security definer
as $$
declare
  v_existing_count integer;
  v_result text;
begin
  -- Check how many budgets exist for this category
  select count(*) into v_existing_count
  from category_budgets
  where category_id = p_category_id;
  
  v_result := 'Category ' || p_category_id || ' has ' || v_existing_count || ' existing budgets';
  
  -- Check for budgets in the specific month
  select count(*) into v_existing_count
  from category_budgets
  where category_id = p_category_id
    and year = p_year
    and month = p_month;
    
  v_result := v_result || '. Month ' || p_month || '/' || p_year || ' has ' || v_existing_count || ' budgets';
  
  -- Check for budgets in any month
  select count(*) into v_existing_count
  from category_budgets
  where category_id = p_category_id
    and year = p_year;
    
  v_result := v_result || '. Year ' || p_year || ' has ' || v_existing_count || ' budgets';
  
  return v_result;
end;
$$;

-- Create a function to list all budgets for a category
create or replace function public.list_category_budgets(p_category_id uuid)
returns table (
  budget_id uuid,
  year integer,
  month integer,
  budget_type text,
  absolute_amount numeric
)
language plpgsql
security definer
as $$
begin
  return query
  select 
    cb.id,
    cb.year,
    cb.month,
    cb.budget_type,
    cb.absolute_amount
  from category_budgets cb
  where cb.category_id = p_category_id
  order by cb.year desc, cb.month desc;
end;
$$; 