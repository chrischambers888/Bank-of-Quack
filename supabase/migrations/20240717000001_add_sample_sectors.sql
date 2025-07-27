-- 20240717000001_add_sample_sectors.sql
-- Add sample sectors and sector-category relationships for testing

-- Insert sample sectors
INSERT INTO public.sectors (name) VALUES
  ('Housing'),
  ('Transportation'),
  ('Food & Dining'),
  ('Entertainment'),
  ('Healthcare'),
  ('Shopping'),
  ('Utilities'),
  ('Other')
ON CONFLICT (name) DO NOTHING;

-- Get sector IDs for reference
DO $$
DECLARE
  housing_id uuid;
  transportation_id uuid;
  food_dining_id uuid;
  entertainment_id uuid;
  healthcare_id uuid;
  shopping_id uuid;
  utilities_id uuid;
  other_id uuid;
BEGIN
  -- Get sector IDs
  SELECT id INTO housing_id FROM sectors WHERE name = 'Housing';
  SELECT id INTO transportation_id FROM sectors WHERE name = 'Transportation';
  SELECT id INTO food_dining_id FROM sectors WHERE name = 'Food & Dining';
  SELECT id INTO entertainment_id FROM sectors WHERE name = 'Entertainment';
  SELECT id INTO healthcare_id FROM sectors WHERE name = 'Healthcare';
  SELECT id INTO shopping_id FROM sectors WHERE name = 'Shopping';
  SELECT id INTO utilities_id FROM sectors WHERE name = 'Utilities';
  SELECT id INTO other_id FROM sectors WHERE name = 'Other';

  -- Insert sector-category relationships
  -- Housing sector
  INSERT INTO sector_categories (sector_id, category_id)
  SELECT housing_id, id FROM categories 
  WHERE name IN ('Rent', 'Mortgage', 'Home Insurance', 'Property Tax', 'Home Maintenance')
  ON CONFLICT (sector_id, category_id) DO NOTHING;

  -- Transportation sector
  INSERT INTO sector_categories (sector_id, category_id)
  SELECT transportation_id, id FROM categories 
  WHERE name IN ('Gas', 'Car Insurance', 'Car Maintenance', 'Public Transit', 'Parking', 'Uber/Lyft')
  ON CONFLICT (sector_id, category_id) DO NOTHING;

  -- Food & Dining sector
  INSERT INTO sector_categories (sector_id, category_id)
  SELECT food_dining_id, id FROM categories 
  WHERE name IN ('Groceries', 'Restaurants', 'Coffee', 'Takeout', 'Alcohol')
  ON CONFLICT (sector_id, category_id) DO NOTHING;

  -- Entertainment sector
  INSERT INTO sector_categories (sector_id, category_id)
  SELECT entertainment_id, id FROM categories 
  WHERE name IN ('Movies', 'Concerts', 'Sports', 'Gaming', 'Books', 'Streaming Services')
  ON CONFLICT (sector_id, category_id) DO NOTHING;

  -- Healthcare sector
  INSERT INTO sector_categories (sector_id, category_id)
  SELECT healthcare_id, id FROM categories 
  WHERE name IN ('Doctor Visits', 'Dental', 'Vision', 'Medications', 'Health Insurance')
  ON CONFLICT (sector_id, category_id) DO NOTHING;

  -- Shopping sector
  INSERT INTO sector_categories (sector_id, category_id)
  SELECT shopping_id, id FROM categories 
  WHERE name IN ('Clothing', 'Electronics', 'Home Goods', 'Personal Care', 'Gifts')
  ON CONFLICT (sector_id, category_id) DO NOTHING;

  -- Utilities sector
  INSERT INTO sector_categories (sector_id, category_id)
  SELECT utilities_id, id FROM categories 
  WHERE name IN ('Electricity', 'Water', 'Internet', 'Phone', 'Gas')
  ON CONFLICT (sector_id, category_id) DO NOTHING;

  -- Other sector (catch-all for categories not in other sectors)
  INSERT INTO sector_categories (sector_id, category_id)
  SELECT other_id, id FROM categories 
  WHERE id NOT IN (
    SELECT category_id FROM sector_categories
  )
  ON CONFLICT (sector_id, category_id) DO NOTHING;

END $$; 