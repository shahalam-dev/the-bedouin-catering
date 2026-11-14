-- Local development data with placeholder names. NOT a migration (excluded by migrations_pattern).
-- Run: npx wrangler d1 execute catering-db --local --file migrations/seed.sql
-- Safe to re-run: existing ids are left untouched.

INSERT INTO branches (id, slug, name, address, phone, has_hall, hall_capacity, sort_order, status) VALUES
  (1, 'branch-a', 'Branch A', 'Placeholder address A', '+60 3-0000 0001', 1, 300, 1, 'published'),
  (2, 'branch-b', 'Branch B', 'Placeholder address B', '+60 3-0000 0002', 1, 150, 2, 'published'),
  (3, 'branch-c', 'Branch C', 'Placeholder address C', '+60 3-0000 0003', 0, NULL, 3, 'published')
ON CONFLICT (id) DO NOTHING;

INSERT INTO cuisines (id, slug, name, description, sort_order, status) VALUES
  (1, 'cuisine-arab', 'Arab Cuisine', 'Placeholder description for Arab cuisine.', 1, 'published'),
  (2, 'cuisine-malay', 'Malay Cuisine', 'Placeholder description for Malay cuisine.', 2, 'published'),
  (3, 'cuisine-western', 'Western Cuisine', 'Placeholder description for Western cuisine.', 3, 'published')
ON CONFLICT (id) DO NOTHING;

INSERT INTO packages (id, slug, service_type, cuisine_id, name, description, price_sen, min_pax, inclusions, is_popular, sort_order, status) VALUES
  (1, 'package-1', 'both', 1, 'Package One',   'Placeholder package description.', 3500, 50,  '["Main dish","Two sides","Dessert","Drinks"]', 1, 1, 'published'),
  (2, 'package-2', 'in_house', 2, 'Package Two',   'Placeholder package description.', 2800, 50,  '["Main dish","Two sides","Drinks"]', 0, 2, 'published'),
  (3, 'package-3', 'both', 1, 'Package Three', 'Placeholder package description.', 4500, 100, '["Two mains","Three sides","Dessert","Drinks","Buffet setup"]', 1, 1, 'published'),
  (4, 'package-4', 'outside', 3, 'Package Four',  'Placeholder package description.', 3900, 30,  '["Main dish","Salad","Dessert","Drinks"]', 0, 2, 'published'),
  (5, 'package-5', 'outside', 2, 'Package Five',  'Placeholder package description.', 2500, 80,  '["Main dish","Two sides","Drinks"]', 0, 1, 'published'),
  (6, 'package-6', 'both', 3, 'Package Six',   'Placeholder package description.', 5500, 50,  '["Two mains","Three sides","Dessert","Drinks","Waiter service"]', 0, 2, 'draft')
ON CONFLICT (id) DO NOTHING;

INSERT INTO menu_items (id, cuisine_id, name, description, category, price_sen, is_bestseller, sort_order, status) VALUES
  (1, 1, 'Dish One',   'Placeholder dish description.', 'Mains',    NULL, 1, 1, 'published'),
  (2, 1, 'Dish Two',   'Placeholder dish description.', 'Mains',    NULL, 0, 2, 'published'),
  (3, 1, 'Dish Three', 'Placeholder dish description.', 'Sides',    NULL, 0, 3, 'published'),
  (4, 2, 'Dish Four',  'Placeholder dish description.', 'Mains',    NULL, 1, 1, 'published'),
  (5, 2, 'Dish Five',  'Placeholder dish description.', 'Desserts', NULL, 0, 2, 'published'),
  (6, 3, 'Dish Six',   'Placeholder dish description.', 'Mains',    NULL, 1, 1, 'published'),
  (7, 3, 'Dish Seven', 'Placeholder dish description.', 'Sides',    NULL, 0, 2, 'published'),
  (8, NULL, 'Dish Eight', 'Placeholder dish description.', 'Drinks', 500, 0, 1, 'hidden')
ON CONFLICT (id) DO NOTHING;

-- Package One (Arab): choose 1 main.
INSERT INTO package_groups (id, package_id, name, choose_count, sort_order) VALUES
  (1, 1, 'Choose 1 main', 1, 1)
ON CONFLICT (id) DO NOTHING;
INSERT INTO package_group_items (group_id, menu_item_id) VALUES (1, 1), (1, 2)
ON CONFLICT DO NOTHING;

INSERT INTO occasions (id, slug, name, description, sort_order, status) VALUES
  (1, 'weddings',   'Weddings',   'Placeholder description for weddings.', 1, 'published'),
  (2, 'corporate',  'Corporate',  'Placeholder description for corporate events.', 2, 'published'),
  (3, 'birthdays',  'Birthdays',  'Placeholder description for birthdays.', 3, 'published'),
  (4, 'aqiqah',     'Aqiqah',     'Placeholder description for aqiqah.', 4, 'published'),
  (5, 'open-house', 'Open House', 'Placeholder description for open houses.', 5, 'published')
ON CONFLICT (id) DO NOTHING;
