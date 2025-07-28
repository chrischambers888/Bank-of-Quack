-- 20240719000000_simplify_budget_system.sql
-- Simplify budget system by removing budget_periods and sector_budget_periods tables
-- and calculating spent amounts dynamically from transaction data

-- Drop all triggers first
drop trigger if exists trigger_handle_budget_changes on category_budgets;
drop trigger if exists trigger_handle_budget_delete on category_budgets;
drop trigger if exists trigger_create_current_budget_period on category_budgets;
drop trigger if exists trigger_auto_create_sector_budget on category_budgets;
drop trigger if exists trigger_validate_sector_budget on sector_budgets;
drop trigger if exists trigger_auto_delete_sector_budget on category_budgets;
drop trigger if exists trigger_roll_down_sector_budget on category_budgets;
drop trigger if exists trigger_auto_update_sector_budget on category_budgets;
drop trigger if exists trigger_auto_recalculate_sector_budget on category_budgets;

-- Drop functions that manage budget_periods and sector_budget_periods (but keep auto-rollup functions)
drop function if exists public.handle_budget_changes();
drop function if exists public.handle_budget_delete();
drop function if exists public.create_current_budget_period();
drop function if exists public.upsert_budget_periods_for_budget();
drop function if exists public.update_budget_spent(uuid, integer, integer);
drop function if exists public.delete_budget_period_for_month(uuid, integer, integer);
drop function if exists public.update_sector_budget_spent(uuid, integer, integer);
drop function if exists public.handle_transaction_budget_update();
drop function if exists public.auto_update_sector_budget();
drop function if exists public.auto_recalculate_sector_budget();
drop function if exists public.recalculate_sector_budget_from_categories(uuid, integer, integer);
drop function if exists public.recalculate_all_sector_budgets_for_month(integer, integer);
drop function if exists public.recalculate_all_budgets();

-- Drop the budget_periods and sector_budget_periods tables
drop table if exists public.budget_periods cascade;
drop table if exists public.sector_budget_periods cascade;

-- Update the create_budget_for_month function to be simpler (no budget_periods)
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
begin
  -- Insert or update the budget for the specific month
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

  return v_budget_id;
end;
$$;

-- Update the create_sector_budget_for_month function to be simpler (no sector_budget_periods)
create or replace function public.create_sector_budget_for_month(
  p_sector_id uuid,
  p_year integer,
  p_month integer,
  p_budget_type text,
  p_absolute_amount numeric,
  p_user1_amount numeric,
  p_user2_amount numeric,
  p_auto_rollup boolean default true
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_budget_id uuid;
begin
  -- Insert or update the sector budget for the specific month
  insert into sector_budgets (
    sector_id, year, month, budget_type, absolute_amount, user1_amount, user2_amount, auto_rollup, created_at, updated_at
  ) values (
    p_sector_id, p_year, p_month, p_budget_type, p_absolute_amount, p_user1_amount, p_user2_amount, p_auto_rollup, now(), now()
  )
  on conflict (sector_id, year, month) do update
  set budget_type = excluded.budget_type,
      absolute_amount = excluded.absolute_amount,
      user1_amount = excluded.user1_amount,
      user2_amount = excluded.user2_amount,
      auto_rollup = excluded.auto_rollup,
      updated_at = now()
  returning id into v_budget_id;

  return v_budget_id;
end;
$$;

-- Update the get_budget_summary_for_month function to calculate spent amounts dynamically
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
    -- Calculate budget amount dynamically
    case
      when cb.budget_type = 'absolute' then cb.absolute_amount
      when cb.budget_type = 'split' then coalesce(cb.user1_amount,0) + coalesce(cb.user2_amount,0)
      else 0
    end as current_period_budget,
    -- Calculate spent amounts dynamically from transactions (matching dashboard logic)
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
            ), 0))
          else 0
        end
      )
      from public.transactions t
      where t.category_id = c.id
        and t.transaction_type = 'expense'
        and extract(year from t.date) = p_year
        and extract(month from t.date) = p_month
    ), 0) as current_period_spent,
    -- Calculate user1 spent dynamically (matching dashboard logic)
    coalesce((
      select sum(
        case 
          when t.split_type = 'user1_only' then
            -- For user1_only expenses, subtract reimbursements
            greatest(0, t.amount - coalesce((
              select sum(r.amount)
              from public.transactions r
              where r.transaction_type = 'reimbursement'
                and r.reimburses_transaction_id = t.id
            ), 0))
          when t.split_type = 'splitEqually' then
            -- For splitEqually expenses, subtract reimbursements and divide by 2
            greatest(0, (t.amount - coalesce((
              select sum(r.amount)
              from public.transactions r
              where r.transaction_type = 'reimbursement'
                and r.reimburses_transaction_id = t.id
            ), 0)) / 2)
          when t.split_type = 'user2_only' then 0
          else 0
        end
      )
      from public.transactions t
      where t.category_id = c.id
        and t.transaction_type = 'expense'
        and extract(year from t.date) = p_year
        and extract(month from t.date) = p_month
    ), 0) as current_period_user1_spent,
    -- Calculate user2 spent dynamically (matching dashboard logic)
    coalesce((
      select sum(
        case 
          when t.split_type = 'user1_only' then 0
          when t.split_type = 'splitEqually' then
            -- For splitEqually expenses, subtract reimbursements and divide by 2
            greatest(0, (t.amount - coalesce((
              select sum(r.amount)
              from public.transactions r
              where r.transaction_type = 'reimbursement'
                and r.reimburses_transaction_id = t.id
            ), 0)) / 2)
          when t.split_type = 'user2_only' then
            -- For user2_only expenses, subtract reimbursements
            greatest(0, t.amount - coalesce((
              select sum(r.amount)
              from public.transactions r
              where r.transaction_type = 'reimbursement'
                and r.reimburses_transaction_id = t.id
            ), 0))
          else 0
        end
      )
      from public.transactions t
      where t.category_id = c.id
        and t.transaction_type = 'expense'
        and extract(year from t.date) = p_year
        and extract(month from t.date) = p_month
    ), 0) as current_period_user2_spent,
    -- Calculate remaining percentage (matching dashboard logic)
    case 
      when cb.budget_type = 'absolute' and cb.absolute_amount > 0 then 
        round(((cb.absolute_amount - coalesce((
          select sum(
            case 
              when t.transaction_type = 'expense' then
                -- For each expense, subtract any reimbursements
                greatest(0, t.amount - coalesce((
                  select sum(r.amount)
                  from public.transactions r
                  where r.transaction_type = 'reimbursement'
                    and r.reimburses_transaction_id = t.id
                ), 0))
              else 0
            end
          )
          from public.transactions t
          where t.category_id = c.id
            and t.transaction_type = 'expense'
            and extract(year from t.date) = p_year
            and extract(month from t.date) = p_month
        ), 0)) / cb.absolute_amount) * 100, 2)
      when cb.budget_type = 'split' and (coalesce(cb.user1_amount,0) + coalesce(cb.user2_amount,0)) > 0 then
        round((((coalesce(cb.user1_amount,0) + coalesce(cb.user2_amount,0)) - coalesce((
          select sum(
            case 
              when t.transaction_type = 'expense' then
                -- For each expense, subtract any reimbursements
                greatest(0, t.amount - coalesce((
                  select sum(r.amount)
                  from public.transactions r
                  where r.transaction_type = 'reimbursement'
                    and r.reimburses_transaction_id = t.id
                ), 0))
              else 0
            end
          )
          from public.transactions t
          where t.category_id = c.id
            and t.transaction_type = 'expense'
            and extract(year from t.date) = p_year
            and extract(month from t.date) = p_month
        ), 0)) / (coalesce(cb.user1_amount,0) + coalesce(cb.user2_amount,0))) * 100, 2)
      else null 
    end as current_period_remaining_percentage,
    -- Calculate remaining amount (matching dashboard logic)
    case 
      when cb.budget_type = 'absolute' then 
        cb.absolute_amount - coalesce((
          select sum(
            case 
              when t.transaction_type = 'expense' then
                -- For each expense, subtract any reimbursements
                greatest(0, t.amount - coalesce((
                  select sum(r.amount)
                  from public.transactions r
                  where r.transaction_type = 'reimbursement'
                    and r.reimburses_transaction_id = t.id
                ), 0))
              else 0
            end
          )
          from public.transactions t
          where t.category_id = c.id
            and t.transaction_type = 'expense'
            and extract(year from t.date) = p_year
            and extract(month from t.date) = p_month
        ), 0)
      when cb.budget_type = 'split' then 
        (coalesce(cb.user1_amount,0) + coalesce(cb.user2_amount,0)) - coalesce((
          select sum(
            case 
              when t.transaction_type = 'expense' then
                -- For each expense, subtract any reimbursements
                greatest(0, t.amount - coalesce((
                  select sum(r.amount)
                  from public.transactions r
                  where r.transaction_type = 'reimbursement'
                    and r.reimburses_transaction_id = t.id
                ), 0))
              else 0
            end
          )
          from public.transactions t
          where t.category_id = c.id
            and t.transaction_type = 'expense'
            and extract(year from t.date) = p_year
            and extract(month from t.date) = p_month
        ), 0)
      else null 
    end as current_period_remaining_amount
  from categories c
  left join category_budgets cb on c.id = cb.category_id 
    and cb.year = p_year and cb.month = p_month
  order by c.name;
end;
$$;

-- Update the get_sector_budget_summary_for_month function to calculate spent amounts dynamically
create or replace function public.get_sector_budget_summary_for_month(
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
  category_budgets_total numeric
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
    -- Calculate spent amounts dynamically from transactions (matching dashboard logic)
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
            ), 0))
          else 0
        end
      )
      from public.transactions t
      join public.sector_categories sc on t.category_id = sc.category_id
      where sc.sector_id = s.id
        and t.transaction_type = 'expense'
        and extract(year from t.date) = p_year
        and extract(month from t.date) = p_month
    ), 0) as current_period_spent,
    -- Calculate user1 spent dynamically (matching dashboard logic)
    coalesce((
      select sum(
        case 
          when t.split_type = 'user1_only' then
            -- For user1_only expenses, subtract reimbursements
            greatest(0, t.amount - coalesce((
              select sum(r.amount)
              from public.transactions r
              where r.transaction_type = 'reimbursement'
                and r.reimburses_transaction_id = t.id
            ), 0))
          when t.split_type = 'splitEqually' then
            -- For splitEqually expenses, subtract reimbursements and divide by 2
            greatest(0, (t.amount - coalesce((
              select sum(r.amount)
              from public.transactions r
              where r.transaction_type = 'reimbursement'
                and r.reimburses_transaction_id = t.id
            ), 0)) / 2)
          when t.split_type = 'user2_only' then 0
          else 0
        end
      )
      from public.transactions t
      join public.sector_categories sc on t.category_id = sc.category_id
      where sc.sector_id = s.id
        and t.transaction_type = 'expense'
        and extract(year from t.date) = p_year
        and extract(month from t.date) = p_month
    ), 0) as current_period_user1_spent,
    -- Calculate user2 spent dynamically (matching dashboard logic)
    coalesce((
      select sum(
        case 
          when t.split_type = 'user1_only' then 0
          when t.split_type = 'splitEqually' then
            -- For splitEqually expenses, subtract reimbursements and divide by 2
            greatest(0, (t.amount - coalesce((
              select sum(r.amount)
              from public.transactions r
              where r.transaction_type = 'reimbursement'
                and r.reimburses_transaction_id = t.id
            ), 0)) / 2)
          when t.split_type = 'user2_only' then
            -- For user2_only expenses, subtract reimbursements
            greatest(0, t.amount - coalesce((
              select sum(r.amount)
              from public.transactions r
              where r.transaction_type = 'reimbursement'
                and r.reimburses_transaction_id = t.id
            ), 0))
          else 0
        end
      )
      from public.transactions t
      join public.sector_categories sc on t.category_id = sc.category_id
      where sc.sector_id = s.id
        and t.transaction_type = 'expense'
        and extract(year from t.date) = p_year
        and extract(month from t.date) = p_month
    ), 0) as current_period_user2_spent,
    -- Calculate remaining percentage (matching dashboard logic)
    case 
      when sb.budget_type = 'absolute' and sb.absolute_amount > 0 then 
        round(((sb.absolute_amount - coalesce((
          select sum(
            case 
              when t.transaction_type = 'expense' then
                -- For each expense, subtract any reimbursements
                greatest(0, t.amount - coalesce((
                  select sum(r.amount)
                  from public.transactions r
                  where r.transaction_type = 'reimbursement'
                    and r.reimburses_transaction_id = t.id
                ), 0))
              else 0
            end
          )
          from public.transactions t
          join public.sector_categories sc on t.category_id = sc.category_id
          where sc.sector_id = s.id
            and t.transaction_type = 'expense'
            and extract(year from t.date) = p_year
            and extract(month from t.date) = p_month
        ), 0)) / sb.absolute_amount) * 100, 2)
      when sb.budget_type = 'split' and (coalesce(sb.user1_amount,0) + coalesce(sb.user2_amount,0)) > 0 then
        round((((coalesce(sb.user1_amount,0) + coalesce(sb.user2_amount,0)) - coalesce((
          select sum(
            case 
              when t.transaction_type = 'expense' then
                -- For each expense, subtract any reimbursements
                greatest(0, t.amount - coalesce((
                  select sum(r.amount)
                  from public.transactions r
                  where r.transaction_type = 'reimbursement'
                    and r.reimburses_transaction_id = t.id
                ), 0))
              else 0
            end
          )
          from public.transactions t
          join public.sector_categories sc on t.category_id = sc.category_id
          where sc.sector_id = s.id
            and t.transaction_type = 'expense'
            and extract(year from t.date) = p_year
            and extract(month from t.date) = p_month
        ), 0)) / (coalesce(sb.user1_amount,0) + coalesce(sb.user2_amount,0))) * 100, 2)
      else null 
    end as current_period_remaining_percentage,
    -- Calculate remaining amount (matching dashboard logic)
    case 
      when sb.budget_type = 'absolute' then 
        sb.absolute_amount - coalesce((
          select sum(
            case 
              when t.transaction_type = 'expense' then
                -- For each expense, subtract any reimbursements
                greatest(0, t.amount - coalesce((
                  select sum(r.amount)
                  from public.transactions r
                  where r.transaction_type = 'reimbursement'
                    and r.reimburses_transaction_id = t.id
                ), 0))
              else 0
            end
          )
          from public.transactions t
          join public.sector_categories sc on t.category_id = sc.category_id
          where sc.sector_id = s.id
            and t.transaction_type = 'expense'
            and extract(year from t.date) = p_year
            and extract(month from t.date) = p_month
        ), 0)
      when sb.budget_type = 'split' then 
        (coalesce(sb.user1_amount,0) + coalesce(sb.user2_amount,0)) - coalesce((
          select sum(
            case 
              when t.transaction_type = 'expense' then
                -- For each expense, subtract any reimbursements
                greatest(0, t.amount - coalesce((
                  select sum(r.amount)
                  from public.transactions r
                  where r.transaction_type = 'reimbursement'
                    and r.reimburses_transaction_id = t.id
                ), 0))
              else 0
            end
          )
          from public.transactions t
          join public.sector_categories sc on t.category_id = sc.category_id
          where sc.sector_id = s.id
            and t.transaction_type = 'expense'
            and extract(year from t.date) = p_year
            and extract(month from t.date) = p_month
        ), 0)
      else null 
    end as current_period_remaining_amount,
    -- Calculate category budgets total
    coalesce((
      select sum(
        case
          when cb.budget_type = 'absolute' then cb.absolute_amount
          when cb.budget_type = 'split' then coalesce(cb.user1_amount,0) + coalesce(cb.user2_amount,0)
          else 0
        end
      )
      from category_budgets cb
      join sector_categories sc on cb.category_id = sc.category_id
      where sc.sector_id = s.id
        and cb.year = p_year
        and cb.month = p_month
    ), 0) as category_budgets_total
  from sectors s
  left join sector_budgets sb on s.id = sb.sector_id 
    and sb.year = p_year and sb.month = p_month
  order by s.name;
end;
$$;

-- Update the copy_budgets_from_month function to be simpler
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

-- Update the carry_forward_budgets_to_month function to be simpler
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

-- Update the delete_budget_for_month function to be simpler
create or replace function public.delete_budget_for_month(
  p_category_id uuid,
  p_year integer,
  p_month integer
)
returns void
language plpgsql
security definer
as $$
begin
  -- Delete the budget for this category and month
  delete from category_budgets
  where category_id = p_category_id
    and year = p_year
    and month = p_month;
end;
$$;

-- Update the delete_sector_budget_for_month function to be simpler
create or replace function public.delete_sector_budget_for_month(
  p_sector_id uuid,
  p_year integer,
  p_month integer
)
returns void
language plpgsql
security definer
as $$
begin
  -- Delete the sector budget for this sector and month
  delete from sector_budgets
  where sector_id = p_sector_id
    and year = p_year
    and month = p_month;
end;
$$;

-- Update the copy_sector_budgets_from_month function to be simpler
create or replace function public.copy_sector_budgets_from_month(
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
  sector_budget_record record;
begin
  -- Copy sector budgets from source month to target month
  for sector_budget_record in 
    select * from sector_budgets 
    where year = p_from_year and month = p_from_month
  loop
    -- Only create if sector budget doesn't exist for target month
    if not exists (
      select 1 from sector_budgets 
      where sector_id = sector_budget_record.sector_id 
        and year = p_to_year 
        and month = p_to_month
    ) then
      perform public.create_sector_budget_for_month(
        sector_budget_record.sector_id,
        p_to_year,
        p_to_month,
        sector_budget_record.budget_type,
        sector_budget_record.absolute_amount,
        sector_budget_record.user1_amount,
        sector_budget_record.user2_amount,
        sector_budget_record.auto_rollup
      );
    end if;
  end loop;
end;
$$;

-- Update the delete_all_budgets_for_month function to be simpler
create or replace function public.delete_all_budgets_for_month(
  p_year integer,
  p_month integer
)
returns void
language plpgsql
security definer
as $$
begin
  -- Delete all category budgets for the specified month
  delete from category_budgets
  where year = p_year and month = p_month;
end;
$$;

-- Update the delete_all_sector_budgets_for_month function to be simpler
create or replace function public.delete_all_sector_budgets_for_month(
  p_year integer,
  p_month integer
)
returns void
language plpgsql
security definer
as $$
begin
  -- Delete all sector budgets for the specified month
  delete from sector_budgets
  where year = p_year and month = p_month;
end;
$$;

-- Update the month_has_budget_data function to be simpler
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
  -- Check if there are any budgets for the specified month
  select count(*) into v_count
  from category_budgets
  where year = p_year and month = p_month;
  
  return v_count > 0;
end;
$$;

-- Update the get_available_budget_months function to be simpler
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
    cb.year,
    cb.month,
    to_char(make_date(cb.year, cb.month, 1), 'Month YYYY') as month_name
  from category_budgets cb
  order by cb.year desc, cb.month desc;
end;
$$;

-- Recreate auto-rollup functions (updated to work without sector_budget_periods)
create or replace function public.auto_create_sector_budget()
returns trigger
language plpgsql
security definer
as $$
declare
  v_sector_id uuid;
  v_category_budget_amount numeric := 0;
begin
  -- Get the sector for this category
  select sc.sector_id into v_sector_id
  from sector_categories sc
  where sc.category_id = new.category_id
  limit 1;

  if v_sector_id is null then
    return new;
  end if;

  -- Calculate the budget amount for the new category budget
  v_category_budget_amount := coalesce(
    case
      when new.budget_type = 'absolute' then new.absolute_amount
      when new.budget_type = 'split' then coalesce(new.user1_amount,0) + coalesce(new.user2_amount,0)
      else 0
    end, 0);

  -- Check if sector budget already exists for this month
  if not exists (
    select 1 from sector_budgets 
    where sector_id = v_sector_id 
      and year = new.year 
      and month = new.month
  ) then
    -- Auto-create sector budget with absolute type and auto-rollup enabled
    perform public.create_sector_budget_for_month(
      v_sector_id,
      new.year,
      new.month,
      'absolute',
      v_category_budget_amount,
      null,
      null,
      true
    );
  else
    -- Sector budget exists, check if auto-rollup is enabled
    if exists (
      select 1 from sector_budgets 
      where sector_id = v_sector_id 
        and year = new.year 
        and month = new.month
        and auto_rollup = true
    ) then
      -- Update sector budget by adding the new category budget amount
      update sector_budgets
      set absolute_amount = absolute_amount + v_category_budget_amount,
          updated_at = now()
      where sector_id = v_sector_id 
        and year = new.year 
        and month = new.month
        and auto_rollup = true;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.auto_delete_sector_budget()
returns trigger
language plpgsql
security definer
as $$
declare
  v_sector_id uuid;
  v_remaining_categories integer;
begin
  -- Get the sector for this category
  select sc.sector_id into v_sector_id
  from sector_categories sc
  where sc.category_id = old.category_id
  limit 1;

  if v_sector_id is null then
    return old;
  end if;

  -- Check if there are any remaining categories in this sector
  select count(*) into v_remaining_categories
  from sector_categories sc
  where sc.sector_id = v_sector_id;

  -- If no categories remain and sector budget has auto-rollup enabled, delete the sector budget
  if v_remaining_categories = 0 then
    delete from sector_budgets
    where sector_id = v_sector_id
      and auto_rollup = true;
  end if;

  return old;
end;
$$;

create or replace function public.roll_down_sector_budget()
returns trigger
language plpgsql
security definer
as $$
declare
  v_sector_id uuid;
  v_deleted_budget_amount numeric := 0;
  v_remaining_category_budgets numeric := 0;
begin
  -- Get the sector for this category
  select sc.sector_id into v_sector_id
  from sector_categories sc
  where sc.category_id = old.category_id
  limit 1;

  if v_sector_id is null then
    return old;
  end if;

  -- Calculate the budget amount that was deleted
  v_deleted_budget_amount := coalesce(
    case
      when old.budget_type = 'absolute' then old.absolute_amount
      when old.budget_type = 'split' then coalesce(old.user1_amount,0) + coalesce(old.user2_amount,0)
      else 0
    end, 0);

  -- Calculate remaining category budgets for this sector
  select coalesce(sum(
    case
      when cb.budget_type = 'absolute' then cb.absolute_amount
      when cb.budget_type = 'split' then coalesce(cb.user1_amount,0) + coalesce(cb.user2_amount,0)
      else 0
    end
  ), 0) into v_remaining_category_budgets
  from category_budgets cb
  join sector_categories sc on cb.category_id = sc.category_id
  where sc.sector_id = v_sector_id
    and cb.year = old.year
    and cb.month = old.month;

  -- Only update sector budget if it won't violate the constraint
  if v_remaining_category_budgets = 0 then
    -- No remaining category budgets, delete the sector budget if auto-rollup
    delete from sector_budgets
    where sector_id = v_sector_id
      and auto_rollup = true
      and year = old.year
      and month = old.month;
  else
    -- Update sector budget by subtracting the deleted category budget amount
    update sector_budgets
    set absolute_amount = absolute_amount - v_deleted_budget_amount,
        updated_at = now()
    where sector_id = v_sector_id 
      and auto_rollup = true
      and budget_type = 'absolute'
      and year = old.year
      and month = old.month;
  end if;

  return old;
end;
$$;

create or replace function public.validate_sector_budget_constraint()
returns trigger
language plpgsql
security definer
as $$
declare
  v_category_budgets_total numeric := 0;
  v_sector_budget_amount numeric := 0;
begin
  -- Only validate if this is a sector budget update
  if tg_table_name = 'sector_budgets' then
    -- Get total of all category budgets for this sector and month
    select coalesce(sum(
      case
        when cb.budget_type = 'absolute' then cb.absolute_amount
        when cb.budget_type = 'split' then coalesce(cb.user1_amount,0) + coalesce(cb.user2_amount,0)
        else 0
      end
    ), 0) into v_category_budgets_total
    from category_budgets cb
    join sector_categories sc on cb.category_id = sc.category_id
    where sc.sector_id = new.sector_id
      and cb.year = new.year
      and cb.month = new.month;

    -- Get the sector budget amount
    v_sector_budget_amount := coalesce(
      case
        when new.budget_type = 'absolute' then new.absolute_amount
        when new.budget_type = 'split' then coalesce(new.user1_amount,0) + coalesce(new.user2_amount,0)
        else 0
      end, 0);

    -- If auto-rollup is enabled, the sector budget should equal the sum of category budgets
    if new.auto_rollup = true and v_sector_budget_amount != v_category_budgets_total then
      raise exception 'Sector budget amount (%) does not match sum of category budgets (%) for sector %', 
        v_sector_budget_amount, v_category_budgets_total, new.sector_id;
    end if;
  end if;

  return new;
end;
$$;

-- Recreate the auto-rollup triggers
create trigger trigger_auto_create_sector_budget
  after insert on category_budgets
  for each row
  execute function public.auto_create_sector_budget();

create trigger trigger_auto_delete_sector_budget
  after delete on category_budgets
  for each row
  execute function public.auto_delete_sector_budget();

create trigger trigger_roll_down_sector_budget
  after delete on category_budgets
  for each row
  execute function public.roll_down_sector_budget();

create trigger trigger_validate_sector_budget
  before insert or update on sector_budgets
  for each row
  execute function public.validate_sector_budget_constraint();

-- Add back the missing functions that were removed
create or replace function public.delete_all_sector_budgets_for_month(
  p_year integer,
  p_month integer
)
returns void
language plpgsql
security definer
as $$
begin
  -- Delete all sector budgets for the specified month
  delete from sector_budgets
  where year = p_year and month = p_month;
end;
$$;

create or replace function public.copy_sector_budgets_from_month(
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
  sector_budget_record record;
begin
  -- Copy sector budgets from source month to target month
  for sector_budget_record in 
    select * from sector_budgets 
    where year = p_from_year and month = p_from_month
  loop
    -- Only create if sector budget doesn't exist for target month
    if not exists (
      select 1 from sector_budgets 
      where sector_id = sector_budget_record.sector_id 
        and year = p_to_year 
        and month = p_to_month
    ) then
      perform public.create_sector_budget_for_month(
        sector_budget_record.sector_id,
        p_to_year,
        p_to_month,
        sector_budget_record.budget_type,
        sector_budget_record.absolute_amount,
        sector_budget_record.user1_amount,
        sector_budget_record.user2_amount,
        sector_budget_record.auto_rollup
      );
    end if;
  end loop;
end;
$$;

-- Update the budget_summary view to calculate spent amounts dynamically
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
  -- Calculate budget amount dynamically
  case
    when cb.budget_type = 'absolute' then cb.absolute_amount
    when cb.budget_type = 'split' then coalesce(cb.user1_amount, 0) + coalesce(cb.user2_amount, 0)
    else null
  end as current_period_budget,
  -- Calculate spent amounts dynamically from transactions
  coalesce((
    select sum(amount)
    from public.transactions
    where category_id = c.id
      and transaction_type = 'expense'
      and extract(year from date) = extract(year from current_date)
      and extract(month from date) = extract(month from current_date)
  ), 0) as current_period_spent,
  -- Calculate user1 spent dynamically
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
    where category_id = c.id
      and transaction_type = 'expense'
      and extract(year from date) = extract(year from current_date)
      and extract(month from date) = extract(month from current_date)
  ), 0) as current_period_user1_spent,
  -- Calculate user2 spent dynamically
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
    where category_id = c.id
      and transaction_type = 'expense'
      and extract(year from date) = extract(year from current_date)
      and extract(month from date) = extract(month from current_date)
  ), 0) as current_period_user2_spent,
  -- Calculate remaining percentage
  case 
    when cb.budget_type = 'absolute' and cb.absolute_amount > 0 then 
      round(((cb.absolute_amount - coalesce((
        select sum(amount)
        from public.transactions
        where category_id = c.id
          and transaction_type = 'expense'
          and extract(year from date) = extract(year from current_date)
          and extract(month from date) = extract(month from current_date)
      ), 0)) / cb.absolute_amount) * 100, 2)
    when cb.budget_type = 'split' and (coalesce(cb.user1_amount, 0) + coalesce(cb.user2_amount, 0)) > 0 then
      round((((coalesce(cb.user1_amount, 0) + coalesce(cb.user2_amount, 0)) - coalesce((
        select sum(amount)
        from public.transactions
        where category_id = c.id
          and transaction_type = 'expense'
          and extract(year from date) = extract(year from current_date)
          and extract(month from date) = extract(month from current_date)
      ), 0)) / (coalesce(cb.user1_amount, 0) + coalesce(cb.user2_amount, 0))) * 100, 2)
    else null 
  end as current_period_remaining_percentage,
  -- Calculate remaining amount
  case 
    when cb.budget_type = 'absolute' then 
      cb.absolute_amount - coalesce((
        select sum(amount)
        from public.transactions
        where category_id = c.id
          and transaction_type = 'expense'
          and extract(year from date) = extract(year from current_date)
          and extract(month from date) = extract(month from current_date)
      ), 0)
    when cb.budget_type = 'split' then 
      (coalesce(cb.user1_amount, 0) + coalesce(cb.user2_amount, 0)) - coalesce((
        select sum(amount)
        from public.transactions
        where category_id = c.id
          and transaction_type = 'expense'
          and extract(year from date) = extract(year from current_date)
          and extract(month from date) = extract(month from current_date)
      ), 0)
    else null 
  end as current_period_remaining_amount
from public.categories c
left join public.category_budgets cb on c.id = cb.category_id
  and cb.year = extract(year from current_date)
  and cb.month = extract(month from current_date);

-- Update the transactions_with_budgets view to calculate spent amounts dynamically
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
  -- Calculate spent amounts dynamically from transactions for the same month
  coalesce((
    select sum(amount)
    from public.transactions
    where category_id = t.category_id
      and transaction_type = 'expense'
      and extract(year from date) = extract(year from t.date)
      and extract(month from date) = extract(month from t.date)
  ), 0) as period_spent_amount,
  -- Calculate user1 spent dynamically for the same month
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
      and extract(year from date) = extract(year from t.date)
      and extract(month from date) = extract(month from t.date)
  ), 0) as period_user1_spent,
  -- Calculate user2 spent dynamically for the same month
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
      and extract(year from date) = extract(year from t.date)
      and extract(month from date) = extract(month from t.date)
  ), 0) as period_user2_spent,
  -- Calculate remaining percentage
  case 
    when cb.budget_type = 'absolute' and cb.absolute_amount > 0 then 
      round(((cb.absolute_amount - coalesce((
        select sum(amount)
        from public.transactions
        where category_id = t.category_id
          and transaction_type = 'expense'
          and extract(year from date) = extract(year from t.date)
          and extract(month from date) = extract(month from t.date)
      ), 0)) / cb.absolute_amount) * 100, 2)
    when cb.budget_type = 'split' and (coalesce(cb.user1_amount, 0) + coalesce(cb.user2_amount, 0)) > 0 then
      round((((coalesce(cb.user1_amount, 0) + coalesce(cb.user2_amount, 0)) - coalesce((
        select sum(amount)
        from public.transactions
        where category_id = t.category_id
          and transaction_type = 'expense'
          and extract(year from date) = extract(year from t.date)
          and extract(month from date) = extract(month from t.date)
      ), 0)) / (coalesce(cb.user1_amount, 0) + coalesce(cb.user2_amount, 0))) * 100, 2)
    else null 
  end as budget_remaining_percentage,
  -- Calculate remaining amount
  case 
    when cb.budget_type = 'absolute' then 
      cb.absolute_amount - coalesce((
        select sum(amount)
        from public.transactions
        where category_id = t.category_id
          and transaction_type = 'expense'
          and extract(year from date) = extract(year from t.date)
          and extract(month from date) = extract(month from t.date)
      ), 0)
    when cb.budget_type = 'split' then 
      (coalesce(cb.user1_amount, 0) + coalesce(cb.user2_amount, 0)) - coalesce((
        select sum(amount)
        from public.transactions
        where category_id = t.category_id
          and transaction_type = 'expense'
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