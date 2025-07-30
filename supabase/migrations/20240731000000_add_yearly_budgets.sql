-- 20240731000000_add_yearly_budgets.sql
-- Add yearly budget tables that mirror the monthly budget structure

-- Create yearly category budgets table
create table if not exists public.yearly_category_budgets (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  year integer not null,
  budget_type text not null check (budget_type in ('absolute', 'split')),
  absolute_amount numeric(10,2) check (absolute_amount >= 0),
  user1_amount numeric(10,2) check (user1_amount >= 0),
  user2_amount numeric(10,2) check (user2_amount >= 0),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(category_id, year)
);

-- Create yearly sector budgets table
create table if not exists public.yearly_sector_budgets (
  id uuid primary key default gen_random_uuid(),
  sector_id uuid not null references public.sectors(id) on delete cascade,
  year integer not null,
  budget_type text not null check (budget_type in ('absolute', 'split')),
  absolute_amount numeric(10,2) check (absolute_amount >= 0),
  user1_amount numeric(10,2) check (user1_amount >= 0),
  user2_amount numeric(10,2) check (user2_amount >= 0),
  auto_rollup boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(sector_id, year)
);

-- Add constraints to ensure at least one amount is set
alter table public.yearly_category_budgets 
add constraint yearly_category_budgets_amount_check 
check (
  (budget_type = 'absolute' and absolute_amount is not null and absolute_amount > 0) or
  (budget_type = 'split' and user1_amount is not null and user1_amount >= 0 and user2_amount is not null and user2_amount >= 0 and (user1_amount > 0 or user2_amount > 0))
);

alter table public.yearly_sector_budgets 
add constraint yearly_sector_budgets_amount_check 
check (
  (budget_type = 'absolute' and absolute_amount is not null and absolute_amount > 0) or
  (budget_type = 'split' and user1_amount is not null and user1_amount >= 0 and user2_amount is not null and user2_amount >= 0 and (user1_amount > 0 or user2_amount > 0))
);

-- Create functions for yearly budgets

-- Create yearly budget for a category
create or replace function public.create_yearly_budget_for_category(
  p_category_id uuid,
  p_year integer,
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
  -- Insert or update the yearly budget for the specific year
  insert into yearly_category_budgets (
    category_id, year, budget_type, absolute_amount, user1_amount, user2_amount, created_at, updated_at
  ) values (
    p_category_id, p_year, p_budget_type, p_absolute_amount, p_user1_amount, p_user2_amount, now(), now()
  )
  on conflict (category_id, year) do update
  set budget_type = excluded.budget_type,
      absolute_amount = excluded.absolute_amount,
      user1_amount = excluded.user1_amount,
      user2_amount = excluded.user2_amount,
      updated_at = now()
  returning id into v_budget_id;

  return v_budget_id;
end;
$$;

-- Create yearly budget for a sector
create or replace function public.create_yearly_budget_for_sector(
  p_sector_id uuid,
  p_year integer,
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
  -- Insert or update the yearly sector budget for the specific year
  insert into yearly_sector_budgets (
    sector_id, year, budget_type, absolute_amount, user1_amount, user2_amount, auto_rollup, created_at, updated_at
  ) values (
    p_sector_id, p_year, p_budget_type, p_absolute_amount, p_user1_amount, p_user2_amount, p_auto_rollup, now(), now()
  )
  on conflict (sector_id, year) do update
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

-- Update yearly budget for a category
create or replace function public.update_yearly_budget_for_category(
  p_budget_id uuid,
  p_budget_type text,
  p_absolute_amount numeric,
  p_user1_amount numeric,
  p_user2_amount numeric
)
returns void
language plpgsql
security definer
as $$
begin
  -- Update the yearly budget directly in yearly_category_budgets table
  update yearly_category_budgets 
  set budget_type = p_budget_type,
      absolute_amount = p_absolute_amount,
      user1_amount = p_user1_amount,
      user2_amount = p_user2_amount,
      updated_at = now()
  where id = p_budget_id;
end;
$$;

-- Update yearly budget for a sector
create or replace function public.update_yearly_budget_for_sector(
  p_budget_id uuid,
  p_budget_type text,
  p_absolute_amount numeric,
  p_user1_amount numeric,
  p_user2_amount numeric,
  p_auto_rollup boolean
)
returns void
language plpgsql
security definer
as $$
begin
  -- Update the yearly sector budget directly in yearly_sector_budgets table
  update yearly_sector_budgets 
  set budget_type = p_budget_type,
      absolute_amount = p_absolute_amount,
      user1_amount = p_user1_amount,
      user2_amount = p_user2_amount,
      auto_rollup = p_auto_rollup,
      updated_at = now()
  where id = p_budget_id;
end;
$$;

-- Delete yearly budget for a category
create or replace function public.delete_yearly_budget_for_category(
  p_category_id uuid,
  p_year integer
)
returns void
language plpgsql
security definer
as $$
begin
  delete from yearly_category_budgets 
  where category_id = p_category_id and year = p_year;
end;
$$;

-- Delete yearly budget for a sector
create or replace function public.delete_yearly_budget_for_sector(
  p_sector_id uuid,
  p_year integer
)
returns void
language plpgsql
security definer
as $$
begin
  delete from yearly_sector_budgets 
  where sector_id = p_sector_id and year = p_year;
end;
$$;

-- Delete all yearly budgets for a year
create or replace function public.delete_all_yearly_budgets_for_year(
  p_year integer
)
returns void
language plpgsql
security definer
as $$
begin
  delete from yearly_category_budgets where year = p_year;
  delete from yearly_sector_budgets where year = p_year;
end;
$$;

-- Copy yearly budgets from one year to another
create or replace function public.copy_yearly_budgets_from_year(
  p_from_year integer,
  p_to_year integer
)
returns void
language plpgsql
security definer
as $$
begin
  -- Copy category budgets
  insert into yearly_category_budgets (
    category_id, year, budget_type, absolute_amount, user1_amount, user2_amount, created_at, updated_at
  )
  select 
    category_id, p_to_year, budget_type, absolute_amount, user1_amount, user2_amount, now(), now()
  from yearly_category_budgets 
  where year = p_from_year
  on conflict (category_id, year) do update
  set budget_type = excluded.budget_type,
      absolute_amount = excluded.absolute_amount,
      user1_amount = excluded.user1_amount,
      user2_amount = excluded.user2_amount,
      updated_at = now();

  -- Copy sector budgets
  insert into yearly_sector_budgets (
    sector_id, year, budget_type, absolute_amount, user1_amount, user2_amount, auto_rollup, created_at, updated_at
  )
  select 
    sector_id, p_to_year, budget_type, absolute_amount, user1_amount, user2_amount, auto_rollup, now(), now()
  from yearly_sector_budgets 
  where year = p_from_year
  on conflict (sector_id, year) do update
  set budget_type = excluded.budget_type,
      absolute_amount = excluded.absolute_amount,
      user1_amount = excluded.user1_amount,
      user2_amount = excluded.user2_amount,
      auto_rollup = excluded.auto_rollup,
      updated_at = now();
end;
$$;

-- Check if a year has budget data
create or replace function public.year_has_budget_data(
  p_year integer
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_has_data boolean;
begin
  select exists(
    select 1 from yearly_category_budgets where year = p_year
    union
    select 1 from yearly_sector_budgets where year = p_year
  ) into v_has_data;
  
  return v_has_data;
end;
$$;

-- Get available budget years
create or replace function public.get_available_budget_years()
returns table(year integer)
language plpgsql
security definer
as $$
begin
  return query
  select distinct year 
  from (
    select year from yearly_category_budgets
    union
    select year from yearly_sector_budgets
  ) years
  order by year desc;
end;
$$;

-- Create indexes for better performance
create index if not exists idx_yearly_category_budgets_year on yearly_category_budgets(year);
create index if not exists idx_yearly_category_budgets_category_year on yearly_category_budgets(category_id, year);
create index if not exists idx_yearly_sector_budgets_year on yearly_sector_budgets(year);
create index if not exists idx_yearly_sector_budgets_sector_year on yearly_sector_budgets(sector_id, year); 