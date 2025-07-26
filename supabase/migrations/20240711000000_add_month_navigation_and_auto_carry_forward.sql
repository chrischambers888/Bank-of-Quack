-- 20240711000000_add_month_navigation_and_auto_carry_forward.sql
-- Add month navigation and auto-carry-forward functionality for budgets
---------------------------------------------------------------

--------------------
--  UPDATE BUDGET SUMMARY VIEW TO SUPPORT MONTH PARAMETERS
--------------------

-- Drop and recreate budget summary view to support month parameters
drop view if exists public.budget_summary;
create view public.budget_summary as
select 
  c.id as category_id,
  c.name as category_name,
  c.image_url as category_image,
  cb.id as budget_id,
  cb.budget_type,
  cb.absolute_amount,
  cb.user1_amount,
  cb.user2_amount,
  extract(year from current_date) as current_year,
  extract(month from current_date) as current_month,
  bp.budget_amount as current_period_budget,
  bp.spent_amount as current_period_spent,
  bp.user1_spent as current_period_user1_spent,
  bp.user2_spent as current_period_user2_spent,
  case 
    when bp.budget_amount > 0 then 
      round(((bp.budget_amount - bp.spent_amount) / bp.budget_amount) * 100, 2)
    else null 
  end as current_period_remaining_percentage,
  case 
    when bp.budget_amount > 0 then 
      bp.budget_amount - bp.spent_amount
    else null 
  end as current_period_remaining_amount
from public.categories c
left join public.category_budgets cb on c.id = cb.category_id
left join public.budget_periods bp on cb.id = bp.category_budget_id 
  and bp.year = extract(year from current_date)
  and bp.month = extract(month from current_date);

-- Create a function to get budget summary for a specific month
create or replace function public.get_budget_summary_for_month(
  p_year integer,
  p_month integer
)
returns table (
  category_id uuid,
  category_name text,
  category_image text,
  budget_id uuid,
  budget_type text,
  absolute_amount numeric,
  user1_amount numeric,
  user2_amount numeric,
  current_year integer,
  current_month integer,
  current_period_budget numeric,
  current_period_spent numeric,
  current_period_user1_spent numeric,
  current_period_user2_spent numeric,
  current_period_remaining_percentage numeric,
  current_period_remaining_amount numeric
)
language plpgsql
security definer
as $$
begin
  return query
  select 
    c.id as category_id,
    c.name as category_name,
    c.image_url as category_image,
    cb.id as budget_id,
    cb.budget_type,
    cb.absolute_amount,
    cb.user1_amount,
    cb.user2_amount,
    p_year as current_year,
    p_month as current_month,
    bp.budget_amount as current_period_budget,
    bp.spent_amount as current_period_spent,
    bp.user1_spent as current_period_user1_spent,
    bp.user2_spent as current_period_user2_spent,
    case 
      when bp.budget_amount > 0 then 
        round(((bp.budget_amount - bp.spent_amount) / bp.budget_amount) * 100, 2)
      else null 
    end as current_period_remaining_percentage,
    case 
      when bp.budget_amount > 0 then 
        bp.budget_amount - bp.spent_amount
      else null 
    end as current_period_remaining_amount
  from public.categories c
  left join public.category_budgets cb on c.id = cb.category_id
  left join public.budget_periods bp on cb.id = bp.category_budget_id 
    and bp.year = p_year
    and bp.month = p_month;
end;
$$;

--------------------
--  AUTO CARRY FORWARD FUNCTIONALITY
--------------------

-- Function to carry forward budgets from the most recent month
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
  v_previous_year integer;
  v_previous_month integer;
  v_budget_amount numeric;
  v_total_spent numeric;
  v_user1_spent numeric;
  v_user2_spent numeric;
begin
  -- Calculate the previous month
  if p_month = 1 then
    v_previous_year := p_year - 1;
    v_previous_month := 12;
  else
    v_previous_year := p_year;
    v_previous_month := p_month - 1;
  end if;

  -- Loop through all category budgets
  for budget_record in 
    select cb.id, cb.category_id, cb.budget_type, cb.absolute_amount, cb.user1_amount, cb.user2_amount
    from public.category_budgets cb
    where not exists (
      select 1 from public.budget_periods bp 
      where bp.category_budget_id = cb.id 
      and bp.year = p_year 
      and bp.month = p_month
    )
  loop
    -- Calculate budget amount
    v_budget_amount := coalesce(
      case
        when budget_record.budget_type = 'absolute' then budget_record.absolute_amount
        when budget_record.budget_type = 'split' then coalesce(budget_record.user1_amount,0) + coalesce(budget_record.user2_amount,0)
        else 0
      end, 0);

    -- Calculate spent amounts for the target month
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
      and extract(year from date) = p_year
      and extract(month from date) = p_month;

    -- Insert the budget period for the target month
    insert into public.budget_periods (
      category_budget_id, year, month, budget_amount, spent_amount, user1_spent, user2_spent, created_at, updated_at
    ) values (
      budget_record.id,
      p_year,
      p_month,
      v_budget_amount,
      v_total_spent,
      v_user1_spent,
      v_user2_spent,
      now(),
      now()
    );
  end loop;
end;
$$;

-- Function to check if a month has any budget data
create or replace function public.month_has_budget_data(
  p_year integer,
  p_month integer
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_count integer;
begin
  select count(*)
  into v_count
  from public.budget_periods bp
  join public.category_budgets cb on bp.category_budget_id = cb.id
  where bp.year = p_year and bp.month = p_month;
  
  return v_count > 0;
end;
$$;

-- Function to get available months with budget data
create or replace function public.get_available_budget_months()
returns table (
  year integer,
  month integer,
  month_name text
)
language plpgsql
security definer
as $$
begin
  return query
  select distinct 
    bp.year,
    bp.month,
    to_char(make_date(bp.year, bp.month, 1), 'Month YYYY') as month_name
  from public.budget_periods bp
  order by bp.year desc, bp.month desc;
end;
$$; 