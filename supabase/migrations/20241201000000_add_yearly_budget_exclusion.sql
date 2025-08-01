-- 20241201000000_add_yearly_budget_exclusion.sql
-- Add separate exclusion field for yearly budgets and update all functions to use appropriate exclusion

-- Add the excluded_from_yearly_budget column to transactions table
alter table public.transactions 
add column if not exists excluded_from_yearly_budget boolean not null default false;

-- Update the transactions_view to include the new column
drop view if exists public.transactions_view;
create view public.transactions_view as
select t.id,
       t.created_at,
       t.date,
       t.description,
       t.amount,
       t.paid_by_user_name,
       t.split_type,
       t.transaction_type,
       t.paid_to_user_name,
       t.reimburses_transaction_id,
       t.category_id,
       t.excluded_from_monthly_budget,
       t.excluded_from_yearly_budget,
       c.name as category_name
from public.transactions t
left join public.categories c on t.category_id = c.id;

-- Update the transactions_with_budgets view to include the new column
drop view if exists public.transactions_with_budgets;
create view public.transactions_with_budgets as
select 
  t.id,
  t.created_at,
  t.date,
  t.description,
  t.amount,
  t.paid_by_user_name,
  t.split_type,
  t.transaction_type,
  t.paid_to_user_name,
  t.reimburses_transaction_id,
  t.category_id,
  t.excluded_from_monthly_budget,
  t.excluded_from_yearly_budget,
  c.name as category_name,
  cb.id as budget_id,
  cb.budget_type,
  cb.absolute_amount as budget_absolute_amount,
  cb.user1_amount as budget_user1_amount,
  cb.user2_amount as budget_user2_amount,
  -- Calculate budget amount dynamically
  case
    when cb.budget_type = 'absolute' then cb.absolute_amount
    when cb.budget_type = 'split' then coalesce(cb.user1_amount, 0) + coalesce(cb.user2_amount, 0)
    else null
  end as period_budget_amount,
  -- Calculate spent amounts dynamically from transactions for the same month (excluding excluded transactions)
  coalesce((
    select sum(amount)
    from public.transactions
    where category_id = t.category_id
      and transaction_type = 'expense'
      and excluded_from_monthly_budget = false
      and extract(year from date) = extract(year from t.date)
      and extract(month from date) = extract(month from t.date)
  ), 0) as period_spent_amount,
  -- Calculate user1 spent dynamically for the same month (excluding excluded transactions)
  coalesce((
    select sum(
      case 
        when split_type = 'user1_only' then amount
        when split_type = 'splitEqually' then amount / 2
        when split_type = 'user2_only' then 0
        else 0
      end
    )
    from public.transactions
    where category_id = t.category_id
      and transaction_type = 'expense'
      and excluded_from_monthly_budget = false
      and extract(year from date) = extract(year from t.date)
      and extract(month from date) = extract(month from t.date)
  ), 0) as period_user1_spent,
  -- Calculate user2 spent dynamically for the same month (excluding excluded transactions)
  coalesce((
    select sum(
      case 
        when split_type = 'user2_only' then amount
        when split_type = 'splitEqually' then amount / 2
        when split_type = 'user1_only' then 0
        else 0
      end
    )
    from public.transactions
    where category_id = t.category_id
      and transaction_type = 'expense'
      and excluded_from_monthly_budget = false
      and extract(year from date) = extract(year from t.date)
      and extract(month from date) = extract(month from t.date)
  ), 0) as period_user2_spent
from public.transactions t
left join public.categories c on t.category_id = c.id
left join public.category_budgets cb on t.category_id = cb.category_id
  and extract(year from t.date) = cb.year
  and extract(month from t.date) = cb.month;

-- Update the get_budget_summary_for_month function to use monthly exclusion
drop function if exists public.get_budget_summary_for_month(integer, integer);
create function public.get_budget_summary_for_month(
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
    -- Calculate budget amount
    case
      when cb.budget_type = 'absolute' then cb.absolute_amount
      when cb.budget_type = 'split' then coalesce(cb.user1_amount, 0) + coalesce(cb.user2_amount, 0)
      else null
    end as current_period_budget,
    -- Calculate spent amount (excluding monthly excluded transactions)
    coalesce((
      select sum(t.amount)
      from public.transactions t
      where t.category_id = c.id
        and t.transaction_type = 'expense'
        and t.excluded_from_monthly_budget = false
        and extract(year from t.date) = p_year
        and extract(month from t.date) = p_month
    ), 0) as current_period_spent,
    -- Calculate user1 spent (excluding monthly excluded transactions)
    coalesce((
      select sum(
        case 
          when t.split_type = 'user1_only' then t.amount
          when t.split_type = 'splitEqually' then t.amount / 2
          when t.split_type = 'user2_only' then 0
          else 0
        end
      )
      from public.transactions t
      where t.category_id = c.id
        and t.transaction_type = 'expense'
        and t.excluded_from_monthly_budget = false
        and extract(year from t.date) = p_year
        and extract(month from t.date) = p_month
    ), 0) as current_period_user1_spent,
    -- Calculate user2 spent (excluding monthly excluded transactions)
    coalesce((
      select sum(
        case 
          when t.split_type = 'user2_only' then t.amount
          when t.split_type = 'splitEqually' then t.amount / 2
          when t.split_type = 'user1_only' then 0
          else 0
        end
      )
      from public.transactions t
      where t.category_id = c.id
        and t.transaction_type = 'expense'
        and t.excluded_from_monthly_budget = false
        and extract(year from t.date) = p_year
        and extract(month from t.date) = p_month
    ), 0) as current_period_user2_spent,
    -- Calculate remaining percentage
    case
      when cb.budget_type = 'absolute' and cb.absolute_amount > 0 then
        ((cb.absolute_amount - coalesce((
          select sum(t.amount)
          from public.transactions t
          where t.category_id = c.id
            and t.transaction_type = 'expense'
            and t.excluded_from_monthly_budget = false
            and extract(year from t.date) = p_year
            and extract(month from t.date) = p_month
        ), 0)) / cb.absolute_amount) * 100
      when cb.budget_type = 'split' and (coalesce(cb.user1_amount, 0) + coalesce(cb.user2_amount, 0)) > 0 then
        (((coalesce(cb.user1_amount, 0) + coalesce(cb.user2_amount, 0)) - coalesce((
          select sum(t.amount)
          from public.transactions t
          where t.category_id = c.id
            and t.transaction_type = 'expense'
            and t.excluded_from_monthly_budget = false
            and extract(year from t.date) = p_year
            and extract(month from t.date) = p_month
        ), 0)) / (coalesce(cb.user1_amount, 0) + coalesce(cb.user2_amount, 0))) * 100
      else null
    end as current_period_remaining_percentage,
    -- Calculate remaining amount
    case
      when cb.budget_type = 'absolute' then
        cb.absolute_amount - coalesce((
          select sum(t.amount)
          from public.transactions t
          where t.category_id = c.id
            and t.transaction_type = 'expense'
            and t.excluded_from_monthly_budget = false
            and extract(year from t.date) = p_year
            and extract(month from t.date) = p_month
        ), 0)
      when cb.budget_type = 'split' then
        (coalesce(cb.user1_amount, 0) + coalesce(cb.user2_amount, 0)) - coalesce((
          select sum(t.amount)
          from public.transactions t
          where t.category_id = c.id
            and t.transaction_type = 'expense'
            and t.excluded_from_monthly_budget = false
            and extract(year from t.date) = p_year
            and extract(month from t.date) = p_month
        ), 0)
      else null
    end as current_period_remaining_amount
  from public.categories c
  left join public.category_budgets cb on c.id = cb.category_id
    and cb.year = p_year
    and cb.month = p_month
  where cb.id is not null;
end;
$$;

-- Create a new function for yearly budget summary that uses yearly exclusion
create or replace function public.get_yearly_budget_summary_for_category(
  p_category_id uuid,
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
  year integer,
  month integer,
  period_budget numeric,
  period_spent numeric,
  period_user1_spent numeric,
  period_user2_spent numeric,
  period_remaining_percentage numeric,
  period_remaining_amount numeric
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
    ycb.id as budget_id,
    ycb.budget_type,
    ycb.absolute_amount,
    ycb.user1_amount,
    ycb.user2_amount,
    p_year as year,
    p_month as month,
    -- Calculate budget amount
    case
      when ycb.budget_type = 'absolute' then ycb.absolute_amount
      when ycb.budget_type = 'split' then coalesce(ycb.user1_amount, 0) + coalesce(ycb.user2_amount, 0)
      else null
    end as period_budget,
    -- Calculate spent amount from January to the selected month (excluding yearly excluded transactions)
    coalesce((
      select sum(t.amount)
      from public.transactions t
      where t.category_id = c.id
        and t.transaction_type = 'expense'
        and t.excluded_from_yearly_budget = false
        and extract(year from t.date) = p_year
        and extract(month from t.date) between 1 and p_month
    ), 0) as period_spent,
    -- Calculate user1 spent from January to the selected month (excluding yearly excluded transactions)
    coalesce((
      select sum(
        case 
          when t.split_type = 'user1_only' then t.amount
          when t.split_type = 'splitEqually' then t.amount / 2
          when t.split_type = 'user2_only' then 0
          else 0
        end
      )
      from public.transactions t
      where t.category_id = c.id
        and t.transaction_type = 'expense'
        and t.excluded_from_yearly_budget = false
        and extract(year from t.date) = p_year
        and extract(month from t.date) between 1 and p_month
    ), 0) as period_user1_spent,
    -- Calculate user2 spent from January to the selected month (excluding yearly excluded transactions)
    coalesce((
      select sum(
        case 
          when t.split_type = 'user2_only' then t.amount
          when t.split_type = 'splitEqually' then t.amount / 2
          when t.split_type = 'user1_only' then 0
          else 0
        end
      )
      from public.transactions t
      where t.category_id = c.id
        and t.transaction_type = 'expense'
        and t.excluded_from_yearly_budget = false
        and extract(year from t.date) = p_year
        and extract(month from t.date) between 1 and p_month
    ), 0) as period_user2_spent,
    -- Calculate remaining percentage
    case
      when ycb.budget_type = 'absolute' and ycb.absolute_amount > 0 then
        ((ycb.absolute_amount - coalesce((
          select sum(t.amount)
          from public.transactions t
          where t.category_id = c.id
            and t.transaction_type = 'expense'
            and t.excluded_from_yearly_budget = false
            and extract(year from t.date) = p_year
            and extract(month from t.date) between 1 and p_month
        ), 0)) / ycb.absolute_amount) * 100
      when ycb.budget_type = 'split' and (coalesce(ycb.user1_amount, 0) + coalesce(ycb.user2_amount, 0)) > 0 then
        (((coalesce(ycb.user1_amount, 0) + coalesce(ycb.user2_amount, 0)) - coalesce((
          select sum(t.amount)
          from public.transactions t
          where t.category_id = c.id
            and t.transaction_type = 'expense'
            and t.excluded_from_yearly_budget = false
            and extract(year from t.date) = p_year
            and extract(month from t.date) between 1 and p_month
        ), 0)) / (coalesce(ycb.user1_amount, 0) + coalesce(ycb.user2_amount, 0))) * 100
      else null
    end as period_remaining_percentage,
    -- Calculate remaining amount
    case
      when ycb.budget_type = 'absolute' then
        ycb.absolute_amount - coalesce((
          select sum(t.amount)
          from public.transactions t
          where t.category_id = c.id
            and t.transaction_type = 'expense'
            and t.excluded_from_yearly_budget = false
            and extract(year from t.date) = p_year
            and extract(month from t.date) between 1 and p_month
        ), 0)
      when ycb.budget_type = 'split' then
        (coalesce(ycb.user1_amount, 0) + coalesce(ycb.user2_amount, 0)) - coalesce((
          select sum(t.amount)
          from public.transactions t
          where t.category_id = c.id
            and t.transaction_type = 'expense'
            and t.excluded_from_yearly_budget = false
            and extract(year from t.date) = p_year
            and extract(month from t.date) between 1 and p_month
        ), 0)
      else null
    end as period_remaining_amount
  from public.categories c
  left join public.yearly_category_budgets ycb on c.id = ycb.category_id
    and ycb.year = p_year
  where c.id = p_category_id and ycb.id is not null;
end;
$$;

-- Create a new function for yearly sector budget summary that uses yearly exclusion
create or replace function public.get_yearly_budget_summary_for_sector(
  p_sector_id uuid,
  p_year integer,
  p_month integer
)
returns table (
  sector_id uuid,
  sector_name text,
  budget_id uuid,
  budget_type text,
  absolute_amount numeric,
  user1_amount numeric,
  user2_amount numeric,
  year integer,
  month integer,
  period_budget numeric,
  period_spent numeric,
  period_user1_spent numeric,
  period_user2_spent numeric,
  period_remaining_percentage numeric,
  period_remaining_amount numeric
)
language plpgsql
security definer
as $$
begin
  return query
  select 
    s.id as sector_id,
    s.name as sector_name,
    ysb.id as budget_id,
    ysb.budget_type,
    ysb.absolute_amount,
    ysb.user1_amount,
    ysb.user2_amount,
    p_year as year,
    p_month as month,
    -- Calculate budget amount
    case
      when ysb.budget_type = 'absolute' then ysb.absolute_amount
      when ysb.budget_type = 'split' then coalesce(ysb.user1_amount, 0) + coalesce(ysb.user2_amount, 0)
      else null
    end as period_budget,
    -- Calculate spent amount from January to the selected month (excluding yearly excluded transactions)
    coalesce((
      select sum(t.amount)
      from public.transactions t
      join public.sector_categories sc on t.category_id = sc.category_id
      where sc.sector_id = s.id
        and t.transaction_type = 'expense'
        and t.excluded_from_yearly_budget = false
        and extract(year from t.date) = p_year
        and extract(month from t.date) between 1 and p_month
    ), 0) as period_spent,
    -- Calculate user1 spent from January to the selected month (excluding yearly excluded transactions)
    coalesce((
      select sum(
        case 
          when t.split_type = 'user1_only' then t.amount
          when t.split_type = 'splitEqually' then t.amount / 2
          when t.split_type = 'user2_only' then 0
          else 0
        end
      )
      from public.transactions t
      join public.sector_categories sc on t.category_id = sc.category_id
      where sc.sector_id = s.id
        and t.transaction_type = 'expense'
        and t.excluded_from_yearly_budget = false
        and extract(year from t.date) = p_year
        and extract(month from t.date) between 1 and p_month
    ), 0) as period_user1_spent,
    -- Calculate user2 spent from January to the selected month (excluding yearly excluded transactions)
    coalesce((
      select sum(
        case 
          when t.split_type = 'user2_only' then t.amount
          when t.split_type = 'splitEqually' then t.amount / 2
          when t.split_type = 'user1_only' then 0
          else 0
        end
      )
      from public.transactions t
      join public.sector_categories sc on t.category_id = sc.category_id
      where sc.sector_id = s.id
        and t.transaction_type = 'expense'
        and t.excluded_from_yearly_budget = false
        and extract(year from t.date) = p_year
        and extract(month from t.date) between 1 and p_month
    ), 0) as period_user2_spent,
    -- Calculate remaining percentage
    case
      when ysb.budget_type = 'absolute' and ysb.absolute_amount > 0 then
        ((ysb.absolute_amount - coalesce((
          select sum(t.amount)
          from public.transactions t
          join public.sector_categories sc on t.category_id = sc.category_id
          where sc.sector_id = s.id
            and t.transaction_type = 'expense'
            and t.excluded_from_yearly_budget = false
            and extract(year from t.date) = p_year
            and extract(month from t.date) between 1 and p_month
        ), 0)) / ysb.absolute_amount) * 100
      when ysb.budget_type = 'split' and (coalesce(ysb.user1_amount, 0) + coalesce(ysb.user2_amount, 0)) > 0 then
        (((coalesce(ysb.user1_amount, 0) + coalesce(ysb.user2_amount, 0)) - coalesce((
          select sum(t.amount)
          from public.transactions t
          join public.sector_categories sc on t.category_id = sc.category_id
          where sc.sector_id = s.id
            and t.transaction_type = 'expense'
            and t.excluded_from_yearly_budget = false
            and extract(year from t.date) = p_year
            and extract(month from t.date) between 1 and p_month
        ), 0)) / (coalesce(ysb.user1_amount, 0) + coalesce(ysb.user2_amount, 0))) * 100
      else null
    end as period_remaining_percentage,
    -- Calculate remaining amount
    case
      when ysb.budget_type = 'absolute' then
        ysb.absolute_amount - coalesce((
          select sum(t.amount)
          from public.transactions t
          join public.sector_categories sc on t.category_id = sc.category_id
          where sc.sector_id = s.id
            and t.transaction_type = 'expense'
            and t.excluded_from_yearly_budget = false
            and extract(year from t.date) = p_year
            and extract(month from t.date) between 1 and p_month
        ), 0)
      when ysb.budget_type = 'split' then
        (coalesce(ysb.user1_amount, 0) + coalesce(ysb.user2_amount, 0)) - coalesce((
          select sum(t.amount)
          from public.transactions t
          join public.sector_categories sc on t.category_id = sc.category_id
          where sc.sector_id = s.id
            and t.transaction_type = 'expense'
            and t.excluded_from_yearly_budget = false
            and extract(year from t.date) = p_year
            and extract(month from t.date) between 1 and p_month
        ), 0)
      else null
    end as period_remaining_amount
  from public.sectors s
  left join public.yearly_sector_budgets ysb on s.id = ysb.sector_id
    and ysb.year = p_year
  where s.id = p_sector_id and ysb.id is not null;
end;
$$; 