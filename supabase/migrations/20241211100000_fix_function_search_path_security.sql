-- 20241211100000_fix_function_search_path_security.sql
-- Fix search_path security vulnerability for all PostgreSQL functions
-- This addresses Supabase Security Advisor warning: function_search_path_mutable
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

-- Setting search_path = '' prevents potential search_path manipulation attacks
-- by ensuring all object references must be fully schema-qualified within the function body

-- =============================================
-- TRIGGER FUNCTIONS (no parameters)
-- =============================================

-- Transaction templates updated_at trigger
ALTER FUNCTION public.update_transaction_templates_updated_at() SET search_path = '';

-- Yearly sector budget auto-management triggers
ALTER FUNCTION public.auto_create_yearly_sector_budget() SET search_path = '';
ALTER FUNCTION public.auto_update_yearly_sector_budget() SET search_path = '';
ALTER FUNCTION public.auto_delete_yearly_sector_budget() SET search_path = '';
ALTER FUNCTION public.roll_down_yearly_sector_budget() SET search_path = '';

-- Monthly sector budget auto-management triggers
ALTER FUNCTION public.auto_create_sector_budget() SET search_path = '';
ALTER FUNCTION public.auto_update_sector_budget() SET search_path = '';
ALTER FUNCTION public.auto_delete_sector_budget() SET search_path = '';
ALTER FUNCTION public.roll_down_sector_budget() SET search_path = '';
ALTER FUNCTION public.validate_sector_budget_constraint() SET search_path = '';

-- =============================================
-- YEARLY BUDGET FUNCTIONS
-- =============================================

-- Create yearly budget functions
ALTER FUNCTION public.create_yearly_budget_for_category(uuid, integer, text, numeric, numeric, numeric) SET search_path = '';
ALTER FUNCTION public.create_yearly_budget_for_sector(uuid, integer, text, numeric, numeric, numeric, boolean) SET search_path = '';

-- Update yearly budget functions
ALTER FUNCTION public.update_yearly_budget_for_category(uuid, text, numeric, numeric, numeric) SET search_path = '';
ALTER FUNCTION public.update_yearly_budget_for_sector(uuid, text, numeric, numeric, numeric, boolean) SET search_path = '';

-- Delete yearly budget functions
ALTER FUNCTION public.delete_yearly_budget_for_category(uuid, integer) SET search_path = '';
ALTER FUNCTION public.delete_yearly_budget_for_sector(uuid, integer) SET search_path = '';
ALTER FUNCTION public.delete_all_yearly_budgets_for_year(integer) SET search_path = '';

-- Copy and query yearly budget functions
ALTER FUNCTION public.copy_yearly_budgets_from_year(integer, integer) SET search_path = '';
ALTER FUNCTION public.year_has_budget_data(integer) SET search_path = '';
ALTER FUNCTION public.get_available_budget_years() SET search_path = '';

-- Yearly budget summary functions
ALTER FUNCTION public.get_yearly_budget_summary_for_category(uuid, integer, integer) SET search_path = '';
ALTER FUNCTION public.get_yearly_budget_summary_for_sector(uuid, integer, integer) SET search_path = '';

-- Yearly sector budget recalculation
ALTER FUNCTION public.recalculate_yearly_sector_budget_from_categories(uuid, integer) SET search_path = '';

-- =============================================
-- MONTHLY BUDGET FUNCTIONS
-- =============================================

-- Create monthly budget functions
ALTER FUNCTION public.create_budget_for_month(uuid, integer, integer, text, numeric, numeric, numeric) SET search_path = '';
ALTER FUNCTION public.create_sector_budget_for_month(uuid, integer, integer, text, numeric, numeric, numeric, boolean) SET search_path = '';

-- Update monthly budget functions
ALTER FUNCTION public.update_budget_for_month(uuid, text, numeric, numeric, numeric) SET search_path = '';
ALTER FUNCTION public.update_sector_budget_for_month(uuid, text, numeric, numeric, numeric, boolean) SET search_path = '';

-- Delete monthly budget functions
ALTER FUNCTION public.delete_budget_for_month(uuid, integer, integer) SET search_path = '';
ALTER FUNCTION public.delete_sector_budget_for_month(uuid, integer, integer) SET search_path = '';
ALTER FUNCTION public.delete_all_budgets_for_month(integer, integer) SET search_path = '';
ALTER FUNCTION public.delete_all_sector_budgets_for_month(integer, integer) SET search_path = '';

-- Copy and query monthly budget functions
ALTER FUNCTION public.copy_budgets_from_month(integer, integer, integer, integer) SET search_path = '';
ALTER FUNCTION public.carry_forward_budgets_to_month(integer, integer) SET search_path = '';
ALTER FUNCTION public.month_has_budget_data(integer, integer) SET search_path = '';
ALTER FUNCTION public.get_available_budget_months() SET search_path = '';
ALTER FUNCTION public.get_budget_summary_for_month(integer, integer) SET search_path = '';

-- =============================================
-- SECTOR BUDGET COPY FUNCTIONS
-- =============================================

-- copy_sector_budgets_from_month has two overloads - 4 param and 5 param versions
-- 4 parameter version
ALTER FUNCTION public.copy_sector_budgets_from_month(integer, integer, integer, integer) SET search_path = '';

-- 5 parameter version (includes p_from_year_adjusted)
DO $$
BEGIN
  -- Try to alter the 5-param version if it exists
  EXECUTE 'ALTER FUNCTION public.copy_sector_budgets_from_month(integer, integer, integer, integer, integer) SET search_path = ''';
EXCEPTION
  WHEN undefined_function THEN
    -- Function doesn't exist with this signature, skip it
    NULL;
END $$;

-- =============================================
-- OPTIONAL: Functions that may or may not exist
-- =============================================

-- upsert_budget_period - may be an old function or created outside migrations
DO $$
BEGIN
  EXECUTE 'ALTER FUNCTION public.upsert_budget_period() SET search_path = ''';
EXCEPTION
  WHEN undefined_function THEN
    NULL;
END $$;

-- check_category_before_delete - may be an old function or created outside migrations
DO $$
BEGIN
  EXECUTE 'ALTER FUNCTION public.check_category_before_delete() SET search_path = ''';
EXCEPTION
  WHEN undefined_function THEN
    NULL;
END $$;
