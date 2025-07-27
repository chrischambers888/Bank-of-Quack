-- 20240717000000_add_sector_budgets.sql
-- Add sector budget functionality with auto-rollup capabilities

-- Create sector_budgets table
create table if not exists public.sector_budgets (
  id            uuid primary key default gen_random_uuid(),
  sector_id     uuid not null references public.sectors(id) on delete cascade,
  year          integer not null,
  month         integer not null,
  budget_type   text not null check (budget_type in ('absolute', 'split')),
  absolute_amount numeric,
  user1_amount  numeric,
  user2_amount  numeric,
  auto_rollup   boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint unique_sector_month unique (sector_id, year, month)
);

-- Create sector_budget_periods table
create table if not exists public.sector_budget_periods (
  id                uuid primary key default gen_random_uuid(),
  sector_budget_id  uuid not null references public.sector_budgets(id) on delete cascade,
  year              integer not null,
  month             integer not null,
  budget_amount     numeric not null default 0,
  spent_amount      numeric not null default 0,
  user1_spent       numeric not null default 0,
  user2_spent       numeric not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint unique_sector_budget_period unique (sector_budget_id, year, month)
);

-- Enable RLS on new tables
alter table public.sector_budgets enable row level security;
alter table public.sector_budget_periods enable row level security;

-- Create policies for sector_budgets
create policy sector_budgets_all on public.sector_budgets
  for all to authenticated using (true) with check (true);

-- Create policies for sector_budget_periods
create policy sector_budget_periods_all on public.sector_budget_periods
  for all to authenticated using (true) with check (true);

-- Function to create sector budget
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

  -- Calculate spent amounts for the sector for the month
  select 
    coalesce(sum(t.amount), 0),
    coalesce(sum(
      case 
        when t.split_type = 'user1_only' then t.amount
        when t.split_type = 'splitEqually' then t.amount / 2
        when t.split_type = 'user2_only' then 0
        else 0
      end
    ), 0),
    coalesce(sum(
      case 
        when t.split_type = 'user1_only' then 0
        when t.split_type = 'splitEqually' then t.amount / 2
        when t.split_type = 'user2_only' then t.amount
        else 0
      end
    ), 0)
  into v_total_spent, v_user1_spent, v_user2_spent
  from public.transactions t
  join public.sector_categories sc on t.category_id = sc.category_id
  where sc.sector_id = p_sector_id
    and t.transaction_type = 'expense'
    and extract(year from t.date) = p_year
    and extract(month from t.date) = p_month;

  -- Insert the sector budget for the specific month
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

  -- Insert or update corresponding sector_budget_periods entry
  insert into sector_budget_periods (
    sector_budget_id, year, month, budget_amount, spent_amount, user1_spent, user2_spent, created_at, updated_at
  ) values (
    v_budget_id, p_year, p_month, v_budget_amount, v_total_spent, v_user1_spent, v_user2_spent, now(), now()
  )
  on conflict (sector_budget_id, year, month) do update
  set budget_amount = excluded.budget_amount,
      spent_amount = excluded.spent_amount,
      user1_spent = excluded.user1_spent,
      user2_spent = excluded.user2_spent,
      updated_at = now();

  return v_budget_id;
end;
$$;

-- Function to auto-create sector budget when first category budget is created
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

      -- Update corresponding budget period
      update sector_budget_periods
      set budget_amount = budget_amount + v_category_budget_amount,
          updated_at = now()
      where sector_budget_id = (
        select id from sector_budgets 
        where sector_id = v_sector_id 
          and year = new.year 
          and month = new.month
      );
    end if;
  end if;

  return new;
end;
$$;

-- Create trigger for auto-creating sector budgets
create trigger trigger_auto_create_sector_budget
  after insert on category_budgets
  for each row
  execute function public.auto_create_sector_budget();

-- Function to validate sector budget constraints
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

-- Create trigger for sector budget validation
create trigger trigger_validate_sector_budget
  before insert or update on sector_budgets
  for each row
  execute function public.validate_sector_budget_constraint();

-- Function to get sector budget summary for month
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
    sbp.budget_amount as current_period_budget,
    sbp.spent_amount as current_period_spent,
    sbp.user1_spent as current_period_user1_spent,
    sbp.user2_spent as current_period_user2_spent,
    case 
      when sbp.budget_amount > 0 then 
        round(((sbp.budget_amount - sbp.spent_amount) / sbp.budget_amount) * 100, 2)
      else null 
    end as current_period_remaining_percentage,
    case 
      when sbp.budget_amount > 0 then 
        sbp.budget_amount - sbp.spent_amount
      else null 
    end as current_period_remaining_amount,
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
  left join sector_budget_periods sbp on sb.id = sbp.sector_budget_id
  order by s.name;
end;
$$;

-- Function to update sector budget spent amounts
create or replace function public.update_sector_budget_spent(
  p_sector_id uuid,
  p_year integer,
  p_month integer
)
returns void
language plpgsql
security definer
as $$
declare
  v_budget_id uuid;
  v_total_spent numeric := 0;
  v_user1_spent numeric := 0;
  v_user2_spent numeric := 0;
begin
  -- Get the sector budget for this sector (no is_active filter)
  select id into v_budget_id
  from public.sector_budgets
  where sector_id = p_sector_id
    and year = p_year
    and month = p_month;
  
  if v_budget_id is null then
    return;
  end if;
  
  -- Calculate total spent for the sector for the period
  select 
    coalesce(sum(t.amount), 0),
    coalesce(sum(
      case 
        when t.split_type = 'user1_only' then t.amount
        when t.split_type = 'splitEqually' then t.amount / 2
        when t.split_type = 'user2_only' then 0
        else 0
      end
    ), 0),
    coalesce(sum(
      case 
        when t.split_type = 'user1_only' then 0
        when t.split_type = 'splitEqually' then t.amount / 2
        when t.split_type = 'user2_only' then t.amount
        else 0
      end
    ), 0)
  into v_total_spent, v_user1_spent, v_user2_spent
  from public.transactions t
  join public.sector_categories sc on t.category_id = sc.category_id
  where sc.sector_id = p_sector_id
    and t.transaction_type = 'expense'
    and extract(year from t.date) = p_year
    and extract(month from t.date) = p_month;
  
  -- Update the sector budget period
  update public.sector_budget_periods
  set 
    spent_amount = v_total_spent,
    user1_spent = v_user1_spent,
    user2_spent = v_user2_spent,
    updated_at = now()
  where sector_budget_id = v_budget_id
    and year = p_year
    and month = p_month;
end;
$$;

-- Update the transaction trigger to also update sector budgets
create or replace function public.handle_transaction_budget_update()
returns trigger
language plpgsql
as $$
declare
  v_sector_id uuid;
begin
  -- Update budget spent amounts for the transaction's date
  if tg_op = 'INSERT' or tg_op = 'UPDATE' then
    -- Update category budget
    perform public.update_budget_spent(
      new.category_id,
      extract(year from new.date)::integer,
      extract(month from new.date)::integer
    );
    
    -- Update sector budget if category belongs to a sector
    select sc.sector_id into v_sector_id
    from sector_categories sc
    where sc.category_id = new.category_id
    limit 1;
    
    if v_sector_id is not null then
      perform public.update_sector_budget_spent(
        v_sector_id,
        extract(year from new.date)::integer,
        extract(month from new.date)::integer
      );
    end if;
    
    return new;
  elsif tg_op = 'DELETE' then
    -- Update category budget
    perform public.update_budget_spent(
      old.category_id,
      extract(year from old.date)::integer,
      extract(month from old.date)::integer
    );
    
    -- Update sector budget if category belongs to a sector
    select sc.sector_id into v_sector_id
    from sector_categories sc
    where sc.category_id = old.category_id
    limit 1;
    
    if v_sector_id is not null then
      perform public.update_sector_budget_spent(
        v_sector_id,
        extract(year from old.date)::integer,
        extract(month from old.date)::integer
      );
    end if;
    
    return old;
  end if;
  
  return null;
end;
$$;

-- Function to delete sector budget for month
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
  -- This will cascade to sector_budget_periods via foreign key
  delete from sector_budgets
  where sector_id = p_sector_id
    and year = p_year
    and month = p_month;
end;
$$; 