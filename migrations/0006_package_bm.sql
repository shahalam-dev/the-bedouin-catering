-- Packages get Bahasa Malaysia copy. NULL name/description and an empty inclusions
-- list fall back to English. Their images already use the existing 'packages' media folder.

ALTER TABLE packages ADD COLUMN name_bm TEXT;
ALTER TABLE packages ADD COLUMN description_bm TEXT;
ALTER TABLE packages ADD COLUMN inclusions_bm TEXT NOT NULL DEFAULT '[]';
