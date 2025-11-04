-- 20241203000000_add_plaid_pending_transactions.sql
-- Add Plaid integration for pending transactions from connected bank accounts

--------------------
--  TABLES
--------------------

-- Connected accounts table - stores Plaid-connected bank/card accounts
create table if not exists public.connected_accounts (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  
  -- Account info
  account_type        text not null check (account_type in ('checking', 'savings', 'credit_card', 'investment')),
  provider            text not null default 'plaid',
  account_name        text not null,
  account_last_four   text,
  
  -- Plaid-specific fields
  plaid_item_id       text unique, -- Plaid item_id (one item = one institution connection)
  plaid_access_token  text, -- Access token for Plaid API calls (should be encrypted in production)
  plaid_account_id    text, -- Specific account ID from Plaid
  institution_id      text, -- Plaid institution_id (e.g., 'ins_109508')
  institution_name    text, -- Human-readable name (e.g., 'American Express')
  
  -- Status
  is_active           boolean not null default true,
  last_synced_at      timestamptz,
  sync_frequency      text default 'manual', -- 'manual', 'daily', 'weekly'
  
  -- Error handling
  error_code          text, -- Plaid error codes
  needs_reauth        boolean default false,
  
  metadata            jsonb
);

-- Pending transactions table - stores transactions from Plaid awaiting approval
create table if not exists public.pending_transactions (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  date                date not null,
  description         text not null,
  amount              numeric not null,
  transaction_type    text not null default 'expense',
  category_id         uuid references public.categories(id) on delete set null,
  
  -- Bank/card connection info
  connected_account_id uuid not null references public.connected_accounts(id) on delete cascade,
  plaid_transaction_id text unique, -- Plaid's transaction ID (prevents duplicates)
  
  -- Status tracking
  status              text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'edited')),
  
  -- Fields that might need user input (can be null initially)
  paid_by_user_name   text,
  split_type          text,
  paid_to_user_name   text,
  
  -- Original Plaid data (for debugging/reference)
  raw_data            jsonb, -- Store original Plaid response
  
  -- Approval tracking
  approved_at         timestamptz,
  rejected_at         timestamptz,
  approved_by_user_id uuid references auth.users(id),
  
  -- Link to created transaction if approved
  transaction_id      uuid references public.transactions(id) on delete set null
);

--------------------
--  INDEXES
--------------------
create index if not exists connected_accounts_user_id_idx 
  on public.connected_accounts(user_id);

create index if not exists connected_accounts_plaid_item_id_idx 
  on public.connected_accounts(plaid_item_id);

create index if not exists pending_transactions_status_idx 
  on public.pending_transactions(status);

create index if not exists pending_transactions_plaid_transaction_id_idx 
  on public.pending_transactions(plaid_transaction_id);

create index if not exists pending_transactions_connected_account_id_idx 
  on public.pending_transactions(connected_account_id);

create index if not exists pending_transactions_date_idx 
  on public.pending_transactions(date desc);

create index if not exists pending_transactions_user_lookup_idx
  on public.pending_transactions(connected_account_id, status, date desc);

--------------------
--  ENABLE RLS
--------------------
alter table public.connected_accounts enable row level security;
alter table public.pending_transactions enable row level security;

--------------------
--  POLICIES
--------------------

-- Connected accounts: users can only access their own accounts
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'connected_accounts'
      and policyname = 'connected_accounts_user_policy'
  ) then
    execute format(
      'create policy connected_accounts_user_policy on public.connected_accounts
         for all
         to authenticated
         using (auth.uid() = user_id)
         with check (auth.uid() = user_id);'
    );
  end if;
end $$;

-- Pending transactions: users can only access transactions from their own connected accounts
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'pending_transactions'
      and policyname = 'pending_transactions_user_policy'
  ) then
    execute format(
      'create policy pending_transactions_user_policy on public.pending_transactions
         for all
         to authenticated
         using (
           exists (
             select 1 from public.connected_accounts ca
             where ca.id = pending_transactions.connected_account_id
             and ca.user_id = auth.uid()
           )
         )
         with check (
           exists (
             select 1 from public.connected_accounts ca
             where ca.id = pending_transactions.connected_account_id
             and ca.user_id = auth.uid()
           )
         );'
    );
  end if;
end $$;
