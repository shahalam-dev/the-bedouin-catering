-- Menu items get Bahasa Malaysia copy (NULL = fall back to English).
-- Their images already use the existing 'menu' media folder.

ALTER TABLE menu_items ADD COLUMN name_bm TEXT;
ALTER TABLE menu_items ADD COLUMN description_bm TEXT;
