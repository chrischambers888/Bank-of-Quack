-- 20240720000000_add_excluded_transactions.sql
-- Add excluded_from_monthly_budget column to transactions table and update budget calculations

-- Add the excluded_from_monthly_budget column to transactions table
alter table public.transactions 
add column if not exists excluded_from_monthly_budget boolean not null default false;

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
       c.name as category_name
from public.transactions t
left join public.categories c on t.category_id = c.id;

-- Drop and recreate the get_budget_summary_for_month function to exclude transactions
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
    -- Calculate budget amount dynamically
    case
      when cb.budget_type = 'absolute' then cb.absolute_amount
      when cb.budget_type = 'split' then coalesce(cb.user1_amount,0) + coalesce(cb.user2_amount,0)
      else 0
    end as current_period_budget,
    -- Calculate spent amounts dynamically from transactions (excluding excluded transactions)
    coalesce((
      select sum(
        case 
          when t.transaction_type = 'expense' then
            -- For each expense, subtract any reimbursements
            greatest(0, t.amount - coalesce((
              select sum(r.amount)
              from public.transactions r
              where r.transaction_type = 'reimbursement'
                and r.reimburses_transaction_id = t.id
                and r.excluded_from_monthly_budget = false
            ), 0))
          else 0
        end
      )
      from public.transactions t
      where t.category_id = c.id
        and t.transaction_type = 'expense'
        and t.excluded_from_monthly_budget = false
        and extract(year from t.date) = p_year
        and extract(month from t.date) = p_month
    ), 0) as current_period_spent,
    -- Calculate user1 spent dynamically (excluding excluded transactions)
    coalesce((
      select sum(
        case 
          when t.split_type = 'user1_only' then
            greatest(0, t.amount - coalesce((
              select sum(r.amount)
              from public.transactions r
              where r.transaction_type = 'reimbursement'
                and r.reimburses_transaction_id = t.id
                and r.excluded_from_monthly_budget = false
            ), 0))
          when t.split_type = 'splitEqually' then
            greatest(0, (t.amount - coalesce((
              select sum(r.amount)
              from public.transactions r
              where r.transaction_type = 'reimbursement'
                and r.reimburses_transaction_id = t.id
                and r.excluded_from_monthly_budget = false
            ), 0)) / 2)
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
    -- Calculate user2 spent dynamically (excluding excluded transactions)
    coalesce((
      select sum(
        case 
          when t.split_type = 'user2_only' then
            greatest(0, t.amount - coalesce((
              select sum(r.amount)
              from public.transactions r
              where r.transaction_type = 'reimbursement'
                and r.reimburses_transaction_id = t.id
                and r.excluded_from_monthly_budget = false
            ), 0))
          when t.split_type = 'splitEqually' then
            greatest(0, (t.amount - coalesce((
              select sum(r.amount)
              from public.transactions r
              where r.transaction_type = 'reimbursement'
                and r.reimburses_transaction_id = t.id
                and r.excluded_from_monthly_budget = false
            ), 0)) / 2)
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
      when case
        when cb.budget_type = 'absolute' then cb.absolute_amount
        when cb.budget_type = 'split' then coalesce(cb.user1_amount,0) + coalesce(cb.user2_amount,0)
        else 0
      end > 0 then 
        round((
          (case
            when cb.budget_type = 'absolute' then cb.absolute_amount
            when cb.budget_type = 'split' then coalesce(cb.user1_amount,0) + coalesce(cb.user2_amount,0)
            else 0
          end - coalesce((
            select sum(
              case 
                when t.transaction_type = 'expense' then
                  greatest(0, t.amount - coalesce((
                    select sum(r.amount)
                    from public.transactions r
                    where r.transaction_type = 'reimbursement'
                      and r.reimburses_transaction_id = t.id
                      and r.excluded_from_monthly_budget = false
                  ), 0))
                else 0
              end
            )
            from public.transactions t
            where t.category_id = c.id
              and t.transaction_type = 'expense'
              and t.excluded_from_monthly_budget = false
              and extract(year from t.date) = p_year
              and extract(month from t.date) = p_month
          ), 0)) / case
            when cb.budget_type = 'absolute' then cb.absolute_amount
            when cb.budget_type = 'split' then coalesce(cb.user1_amount,0) + coalesce(cb.user2_amount,0)
            else 0
          end
        ) * 100, 2)
      else null 
    end as current_period_remaining_percentage,
    -- Calculate remaining amount
    case 
      when case
        when cb.budget_type = 'absolute' then cb.absolute_amount
        when cb.budget_type = 'split' then coalesce(cb.user1_amount,0) + coalesce(cb.user2_amount,0)
        else 0
      end > 0 then 
        case
          when cb.budget_type = 'absolute' then cb.absolute_amount
          when cb.budget_type = 'split' then coalesce(cb.user1_amount,0) + coalesce(cb.user2_amount,0)
          else 0
        end - coalesce((
          select sum(
            case 
              when t.transaction_type = 'expense' then
                greatest(0, t.amount - coalesce((
                  select sum(r.amount)
                  from public.transactions r
                  where r.transaction_type = 'reimbursement'
                    and r.reimburses_transaction_id = t.id
                    and r.excluded_from_monthly_budget = false
                ), 0))
              else 0
            end
          )
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
    and cb.year = p_year and cb.month = p_month
  order by c.name;
end;
$$;

-- Drop and recreate the get_sector_budget_summary_for_month function to exclude transactions
drop function if exists public.get_sector_budget_summary_for_month(integer, integer);
create function public.get_sector_budget_summary_for_month(
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
  auto_rollup boolean,
  current_period_budget numeric,
  current_period_spent numeric,
  current_period_user1_spent numeric,
  current_period_user2_spent numeric,
  current_period_remaining_percentage numeric,
  current_period_remaining_amount numeric,
  category_budgets_total integer
)
language plpgsql
security definer
as $$
begin
  return query
  select 
    s.id as sector_id,
    s.name as sector_name,
    sb.id as budget_id,
    sb.budget_type,
    sb.absolute_amount,
    sb.user1_amount,
    sb.user2_amount,
    sb.auto_rollup,
    -- Calculate budget amount dynamically
    case
      when sb.budget_type = 'absolute' then sb.absolute_amount
      when sb.budget_type = 'split' then coalesce(sb.user1_amount,0) + coalesce(sb.user2_amount,0)
      else 0
    end as current_period_budget,
    -- Calculate spent amounts dynamically from transactions (excluding excluded transactions)
    coalesce((
      select sum(
        case 
          when t.transaction_type = 'expense' then
            greatest(0, t.amount - coalesce((
              select sum(r.amount)
              from public.transactions r
              where r.transaction_type = 'reimbursement'
                and r.reimburses_transaction_id = t.id
                and r.excluded_from_monthly_budget = false
            ), 0))
          else 0
        end
      )
      from public.transactions t
      join public.sector_categories sc on t.category_id = sc.category_id
      where sc.sector_id = s.id
        and t.transaction_type = 'expense'
        and t.excluded_from_monthly_budget = false
        and extract(year from t.date) = p_year
        and extract(month from t.date) = p_month
    ), 0) as current_period_spent,
    -- Calculate user1 spent dynamically (excluding excluded transactions)
    coalesce((
      select sum(
        case 
          when t.split_type = 'user1_only' then
            greatest(0, t.amount - coalesce((
              select sum(r.amount)
              from public.transactions r
              where r.transaction_type = 'reimbursement'
                and r.reimburses_transaction_id = t.id
                and r.excluded_from_monthly_budget = false
            ), 0))
          when t.split_type = 'splitEqually' then
            greatest(0, (t.amount - coalesce((
              select sum(r.amount)
              from public.transactions r
              where r.transaction_type = 'reimbursement'
                and r.reimburses_transaction_id = t.id
                and r.excluded_from_monthly_budget = false
            ), 0)) / 2)
          else 0
        end
      )
      from public.transactions t
      join public.sector_categories sc on t.category_id = sc.category_id
      where sc.sector_id = s.id
        and t.transaction_type = 'expense'
        and t.excluded_from_monthly_budget = false
        and extract(year from t.date) = p_year
        and extract(month from t.date) = p_month
    ), 0) as current_period_user1_spent,
    -- Calculate user2 spent dynamically (excluding excluded transactions)
    coalesce((
      select sum(
        case 
          when t.split_type = 'user2_only' then
            greatest(0, t.amount - coalesce((
              select sum(r.amount)
              from public.transactions r
              where r.transaction_type = 'reimbursement'
                and r.reimburses_transaction_id = t.id
                and r.excluded_from_monthly_budget = false
            ), 0))
          when t.split_type = 'splitEqually' then
            greatest(0, (t.amount - coalesce((
              select sum(r.amount)
              from public.transactions r
              where r.transaction_type = 'reimbursement'
                and r.reimburses_transaction_id = t.id
                and r.excluded_from_monthly_budget = false
            ), 0)) / 2)
          else 0
        end
      )
      from public.transactions t
      join public.sector_categories sc on t.category_id = sc.category_id
      where sc.sector_id = s.id
        and t.transaction_type = 'expense'
        and t.excluded_from_monthly_budget = false
        and extract(year from t.date) = p_year
        and extract(month from t.date) = p_month
    ), 0) as current_period_user2_spent,
    -- Calculate remaining percentage
    case 
      when case
        when sb.budget_type = 'absolute' then sb.absolute_amount
        when sb.budget_type = 'split' then coalesce(sb.user1_amount,0) + coalesce(sb.user2_amount,0)
        else 0
      end > 0 then 
        round((
          (case
            when sb.budget_type = 'absolute' then sb.absolute_amount
            when sb.budget_type = 'split' then coalesce(sb.user1_amount,0) + coalesce(sb.user2_amount,0)
            else 0
          end - coalesce((
            select sum(
              case 
                when t.transaction_type = 'expense' then
                  greatest(0, t.amount - coalesce((
                    select sum(r.amount)
                    from public.transactions r
                    where r.transaction_type = 'reimbursement'
                      and r.reimburses_transaction_id = t.id
                      and r.excluded_from_monthly_budget = false
                  ), 0))
                else 0
              end
            )
            from public.transactions t
            join public.sector_categories sc on t.category_id = sc.category_id
            where sc.sector_id = s.id
              and t.transaction_type = 'expense'
              and t.excluded_from_monthly_budget = false
              and extract(year from t.date) = p_year
              and extract(month from t.date) = p_month
          ), 0)) / case
            when sb.budget_type = 'absolute' then sb.absolute_amount
            when sb.budget_type = 'split' then coalesce(sb.user1_amount,0) + coalesce(sb.user2_amount,0)
            else 0
          end
        ) * 100, 2)
      else null 
    end as current_period_remaining_percentage,
    -- Calculate remaining amount
    case 
      when case
        when sb.budget_type = 'absolute' then sb.absolute_amount
        when sb.budget_type = 'split' then coalesce(sb.user1_amount,0) + coalesce(sb.user2_amount,0)
        else 0
      end > 0 then 
        case
          when sb.budget_type = 'absolute' then sb.absolute_amount
          when sb.budget_type = 'split' then coalesce(sb.user1_amount,0) + coalesce(sb.user2_amount,0)
          else 0
        end - coalesce((
          select sum(
            case 
              when t.transaction_type = 'expense' then
                greatest(0, t.amount - coalesce((
                  select sum(r.amount)
                  from public.transactions r
                  where r.transaction_type = 'reimbursement'
                    and r.reimburses_transaction_id = t.id
                    and r.excluded_from_monthly_budget = false
                ), 0))
              else 0
            end
          )
          from public.transactions t
          join public.sector_categories sc on t.category_id = sc.category_id
          where sc.sector_id = s.id
            and t.transaction_type = 'expense'
            and t.excluded_from_monthly_budget = false
            and extract(year from t.date) = p_year
            and extract(month from t.date) = p_month
        ), 0)
      else null 
    end as current_period_remaining_amount,
    -- Count category budgets in this sector
    (
      select count(*)
      from public.category_budgets cb
      join public.sector_categories sc on cb.category_id = sc.category_id
      where sc.sector_id = s.id
        and cb.year = p_year
        and cb.month = p_month
    ) as category_budgets_total
  from public.sectors s
  left join public.sector_budgets sb on s.id = sb.sector_id 
    and sb.year = p_year and sb.month = p_month
  order by s.name;
end;
$$;

-- Update the transactions_with_budgets view to exclude transactions
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
        when split_type = 'user1_only' then 0
        when split_type = 'splitEqually' then amount / 2
        when split_type = 'user2_only' then amount
        else 0
      end
    )
    from public.transactions
    where category_id = t.category_id
      and transaction_type = 'expense'
      and excluded_from_monthly_budget = false
      and extract(year from date) = extract(year from t.date)
      and extract(month from date) = extract(month from t.date)
  ), 0) as period_user2_spent,
  case 
    when case
      when cb.budget_type = 'absolute' then cb.absolute_amount
      when cb.budget_type = 'split' then coalesce(cb.user1_amount, 0) + coalesce(cb.user2_amount, 0)
      else null
    end > 0 then 
      round(((case
        when cb.budget_type = 'absolute' then cb.absolute_amount
        when cb.budget_type = 'split' then coalesce(cb.user1_amount, 0) + coalesce(cb.user2_amount, 0)
        else null
      end - coalesce((
        select sum(amount)
        from public.transactions
        where category_id = t.category_id
          and transaction_type = 'expense'
          and excluded_from_monthly_budget = false
          and extract(year from date) = extract(year from t.date)
          and extract(month from date) = extract(month from t.date)
      ), 0)) / case
        when cb.budget_type = 'absolute' then cb.absolute_amount
        when cb.budget_type = 'split' then coalesce(cb.user1_amount, 0) + coalesce(cb.user2_amount, 0)
        else null
      end) * 100, 2)
    else null 
  end as budget_remaining_percentage,
  case 
    when case
      when cb.budget_type = 'absolute' then cb.absolute_amount
      when cb.budget_type = 'split' then coalesce(cb.user1_amount, 0) + coalesce(cb.user2_amount, 0)
      else null
    end > 0 then 
      case
        when cb.budget_type = 'absolute' then cb.absolute_amount
        when cb.budget_type = 'split' then coalesce(cb.user1_amount, 0) + coalesce(cb.user2_amount, 0)
        else null
      end - coalesce((
        select sum(amount)
        from public.transactions
        where category_id = t.category_id
          and transaction_type = 'expense'
          and excluded_from_monthly_budget = false
          and extract(year from date) = extract(year from t.date)
          and extract(month from date) = extract(month from t.date)
      ), 0)
    else null 
  end as budget_remaining_amount
from public.transactions t
left join public.categories c on t.category_id = c.id
left join public.category_budgets cb on t.category_id = cb.category_id
  and extract(year from t.date) = cb.year 
  and extract(month from t.date) = cb.month
where t.transaction_type = 'expense'; 