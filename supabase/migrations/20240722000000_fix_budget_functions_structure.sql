-- 20240722000000_fix_budget_functions_structure.sql
-- Fix the budget functions to have the correct return structure and exclude transactions

-- Fix the get_budget_summary_for_month function to exclude transactions
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

-- Fix the get_sector_budget_summary_for_month function to exclude transactions
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
    coalesce((
      select count(*)
      from public.category_budgets cb
      join public.sector_categories sc on cb.category_id = sc.category_id
      where sc.sector_id = s.id
        and cb.year = p_year
        and cb.month = p_month
    ), 0) as category_budgets_total
  from public.sectors s
  left join public.sector_budgets sb on s.id = sb.sector_id 
    and sb.year = p_year and sb.month = p_month
  order by s.name;
end;
$$; 