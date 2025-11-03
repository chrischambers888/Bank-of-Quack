-- 20241202000000_add_transaction_templates.sql
-- Add transaction templates table for user-specific transaction presets

--------------------
--  TABLE
--------------------
create table if not exists public.transaction_templates (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  template_name text not null,
  transaction_type text not null default 'expense',
  description   text not null,
  amount        numeric not null,
  paid_by_user_name text,
  paid_to_user_name text,
  category_id   uuid references public.categories(id) on delete set null,
  split_type    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

--------------------
--  INDEXES
--------------------
create index if not exists transaction_templates_user_id_idx 
  on public.transaction_templates(user_id);

create index if not exists transaction_templates_user_id_created_at_idx 
  on public.transaction_templates(user_id, created_at desc);

--------------------
--  ENABLE RLS
--------------------
alter table public.transaction_templates enable row level security;

--------------------
--  POLICIES
--------------------
do $$
begin
  -- Users can only access their own templates
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'transaction_templates'
      and policyname = 'transaction_templates_user_policy'
  ) then
    execute format(
      'create policy transaction_templates_user_policy on public.transaction_templates
         for all
         to authenticated
         using (auth.uid() = user_id)
         with check (auth.uid() = user_id);'
    );
  end if;
end $$;

--------------------
--  UPDATE TRIGGER
--------------------
create or replace function update_transaction_templates_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger transaction_templates_updated_at
  before update on public.transaction_templates
  for each row
  execute function update_transaction_templates_updated_at();

