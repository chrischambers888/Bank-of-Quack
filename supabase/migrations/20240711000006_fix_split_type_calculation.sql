-- 20240711000006_fix_split_type_calculation.sql
-- Fix the split type calculation to use split_type instead of paid_by_user_name

-- Update the create_budget_for_month function to use split_type
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

  -- Calculate spent amounts for the month based on split_type
  select 
    coalesce(sum(amount), 0),
    coalesce(sum(
      case 
        when split_type = 'user1_only' then amount
        when split_type = 'splitEqually' then amount / 2
        else 0
      end
    ), 0),
    coalesce(sum(
      case 
        when split_type = 'user2_only' then amount
        when split_type = 'splitEqually' then amount / 2
        else 0
      end
    ), 0)
  into v_total_spent, v_user1_spent, v_user2_spent
  from public.transactions
  where category_id = p_category_id
    and transaction_type = 'expense'
    and extract(year from date) = p_year
    and extract(month from date) = p_month;

  -- Insert the budget for the specific month (or update if exists)
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

  -- Upsert corresponding budget_periods entry
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

-- Update the copy function to use split_type
create or replace function public.copy_budgets_from_month(
  p_from_year integer,
  p_from_month integer,
  p_to_year integer,
  p_to_month integer
)
returns void
language plpgsql
security definer
as $$
declare
  budget_record record;
  v_budget_amount numeric := 0;
  v_total_spent numeric := 0;
  v_user1_spent numeric := 0;
  v_user2_spent numeric := 0;
begin
  -- Copy budgets from source month to target month
  for budget_record in 
    select * from category_budgets 
    where year = p_from_year and month = p_from_month
  loop
    -- Only create if budget doesn't exist for target month
    if not exists (
      select 1 from category_budgets 
      where category_id = budget_record.category_id 
        and year = p_to_year 
        and month = p_to_month
    ) then
      -- Calculate spent amounts for the target month based on split_type
      select 
        coalesce(sum(amount), 0),
        coalesce(sum(
          case 
            when split_type = 'user1_only' then amount
            when split_type = 'splitEqually' then amount / 2
            else 0
          end
        ), 0),
        coalesce(sum(
          case 
            when split_type = 'user2_only' then amount
            when split_type = 'splitEqually' then amount / 2
            else 0
          end
        ), 0)
      into v_total_spent, v_user1_spent, v_user2_spent
      from public.transactions
      where category_id = budget_record.category_id
        and transaction_type = 'expense'
        and extract(year from date) = p_to_year
        and extract(month from date) = p_to_month;

      -- Calculate budget amount
      v_budget_amount := coalesce(
        case
          when budget_record.budget_type = 'absolute' then budget_record.absolute_amount
          when budget_record.budget_type = 'split' then coalesce(budget_record.user1_amount,0) + coalesce(budget_record.user2_amount,0)
          else 0
        end, 0);

      -- Create the budget for target month
      perform public.create_budget_for_month(
        budget_record.category_id,
        p_to_year,
        p_to_month,
        budget_record.budget_type,
        budget_record.absolute_amount,
        budget_record.user1_amount,
        budget_record.user2_amount
      );
    end if;
  end loop;
end;
$$;

-- Update the carry forward function to use split_type
create or replace function public.carry_forward_budgets_to_month(
  p_year integer,
  p_month integer
)
returns void
language plpgsql
security definer
as $$
declare
  budget_record record;
  v_current_year integer := extract(year from current_date)::integer;
  v_current_month integer := extract(month from current_date)::integer;
begin
  -- Carry forward budgets from current month to target month
  for budget_record in 
    select * from category_budgets 
    where year = v_current_year and month = v_current_month
  loop
    -- Only create if budget doesn't exist for target month
    if not exists (
      select 1 from category_budgets 
      where category_id = budget_record.category_id 
        and year = p_year 
        and month = p_month
    ) then
      perform public.create_budget_for_month(
        budget_record.category_id,
        p_year,
        p_month,
        budget_record.budget_type,
        budget_record.absolute_amount,
        budget_record.user1_amount,
        budget_record.user2_amount
      );
    end if;
  end loop;
end;
$$; 