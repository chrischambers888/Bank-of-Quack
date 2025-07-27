-- Fix auto-rollup validation issue
-- The problem is that when auto-rollup is enabled, the sector budget should automatically
-- adjust to match the category budgets total, so validation should be skipped

create or replace function public.validate_sector_budget_constraint()
returns trigger
language plpgsql
security definer
as $$
declare
  v_category_budgets_total numeric := 0;
  v_sector_budget_amount numeric := 0;
  v_auto_rollup boolean := false;
begin
  -- Only validate if this is a sector budget update
  if tg_table_name = 'sector_budgets' then
    -- Check if auto-rollup is enabled for this sector budget
    v_auto_rollup := coalesce(new.auto_rollup, false);
    
    -- If auto-rollup is enabled, skip validation since the sector budget
    -- will automatically adjust to match category budgets
    if v_auto_rollup then
      return new;
    end if;

    -- Get total of all category budgets for this sector and month
    select coalesce(sum(
      case
        when cb.budget_type = 'absolute' then cb.absolute_amount
        when cb.budget_type = 'split' then coalesce(cb.user1_amount,0) + coalesce(cb.user2_amount,0)
        else 0
      end
    ), 0)
    into v_category_budgets_total
    from category_budgets cb
    join sector_categories sc on cb.category_id = sc.category_id
    where sc.sector_id = new.sector_id
      and cb.year = new.year
      and cb.month = new.month;

    -- Get sector budget amount
    v_sector_budget_amount := coalesce(
      case
        when new.budget_type = 'absolute' then new.absolute_amount
        when new.budget_type = 'split' then coalesce(new.user1_amount,0) + coalesce(new.user2_amount,0)
        else 0
      end, 0);

    -- Validate that sector budget is not less than category budgets total
    if v_sector_budget_amount < v_category_budgets_total then
      raise exception 'Sector budget amount ($%) cannot be less than the sum of category budgets ($%)', 
        v_sector_budget_amount, v_category_budgets_total;
    end if;
  end if;

  return new;
end;
$$; 