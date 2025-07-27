-- 20240717000002_cleanup_backup_tables.sql
-- Clean up backup tables that are no longer needed after budget system restructuring

-- Drop backup tables that were created during the budget system restructuring
DROP TABLE IF EXISTS category_budgets_backup;
DROP TABLE IF EXISTS budget_periods_backup; 