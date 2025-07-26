-- 20240710000005_recalculate_existing_budgets.sql
-- Recalculate all existing budgets using the correct split_type logic

-- Function to recalculate all budgets for the current month
create or replace function public.recalculate_all_budgets()
returns void
language plpgsql
security definer
as $$
declare
  budget_record record;
  v_year integer := extract(year from current_date)::integer;
  v_month integer := extract(month from current_date)::integer;
begin
  -- Loop through all category budgets
  for budget_record in 
    select id, category_id 
    from public.category_budgets
  loop
    -- Recalculate budget spent amounts for each budget
    perform public.update_budget_spent(
      budget_record.category_id,
      v_year,
      v_month
    );
  end loop;
end;
$$;

-- Execute the recalculation
select public.recalculate_all_budgets();

-- Clean up the temporary function
drop function public.recalculate_all_budgets(); 