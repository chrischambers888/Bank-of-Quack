-- 20240710000001_fix_budget_summary_view.sql
-- Fix budget summary view to handle missing budget_periods records and use consistent calculations

-- Drop and recreate budget summary view with better handling of missing budget_periods
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
  -- Calculate budget amount directly from category_budgets for consistency
  case
    when cb.budget_type = 'absolute' then cb.absolute_amount
    when cb.budget_type = 'split' then coalesce(cb.user1_amount, 0) + coalesce(cb.user2_amount, 0)
    else null
  end as current_period_budget,
  -- Calculate spent amounts based on split_type for consistency
  coalesce(bp.spent_amount, 0) as current_period_spent,
  coalesce(bp.user1_spent, 0) as current_period_user1_spent,
  coalesce(bp.user2_spent, 0) as current_period_user2_spent,
  case 
    when cb.budget_type = 'absolute' and cb.absolute_amount > 0 then 
      round(((cb.absolute_amount - coalesce(bp.spent_amount, 0)) / cb.absolute_amount) * 100, 2)
    when cb.budget_type = 'split' and (coalesce(cb.user1_amount, 0) + coalesce(cb.user2_amount, 0)) > 0 then
      round((((coalesce(cb.user1_amount, 0) + coalesce(cb.user2_amount, 0)) - coalesce(bp.spent_amount, 0)) / (coalesce(cb.user1_amount, 0) + coalesce(cb.user2_amount, 0))) * 100, 2)
    else null 
  end as current_period_remaining_percentage,
  case 
    when cb.budget_type = 'absolute' then 
      cb.absolute_amount - coalesce(bp.spent_amount, 0)
    when cb.budget_type = 'split' then 
      (coalesce(cb.user1_amount, 0) + coalesce(cb.user2_amount, 0)) - coalesce(bp.spent_amount, 0)
    else null 
  end as current_period_remaining_amount
from public.categories c
left join public.category_budgets cb on c.id = cb.category_id
left join public.budget_periods bp on cb.id = bp.category_budget_id 
  and bp.year = extract(year from current_date)
  and bp.month = extract(month from current_date); 