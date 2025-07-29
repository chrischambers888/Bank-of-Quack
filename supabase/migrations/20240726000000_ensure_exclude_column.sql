-- 20240726000000_ensure_exclude_column.sql
-- Ensure the excluded_from_monthly_budget column exists

-- Add the excluded_from_monthly_budget column to transactions table if it doesn't exist
alter table public.transactions 
add column if not exists excluded_from_monthly_budget boolean not null default false;

-- Update the transactions_view to include the new column if it doesn't already
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