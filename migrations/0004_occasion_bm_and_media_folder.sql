-- Occasions get Bahasa Malaysia copy (NULL = fall back to English),
-- and the media library gets an 'occasions' folder.

ALTER TABLE occasions ADD COLUMN name_bm TEXT;
ALTER TABLE occasions ADD COLUMN description_bm TEXT;

-- SQLite cannot change a CHECK constraint, so the media table is rebuilt.
-- DROP TABLE runs the ON DELETE SET NULL actions on every table that points at media,
-- so the image links are saved first and put back after.
PRAGMA defer_foreign_keys = on;

CREATE TABLE _image_links AS
  SELECT 'branches' AS tbl, id, image_id FROM branches WHERE image_id IS NOT NULL
  UNION ALL SELECT 'cuisines', id, image_id FROM cuisines WHERE image_id IS NOT NULL
  UNION ALL SELECT 'packages', id, image_id FROM packages WHERE image_id IS NOT NULL
  UNION ALL SELECT 'menu_items', id, image_id FROM menu_items WHERE image_id IS NOT NULL
  UNION ALL SELECT 'occasions', id, image_id FROM occasions WHERE image_id IS NOT NULL;

CREATE TABLE media_new (
  id           INTEGER PRIMARY KEY,
  r2_key       TEXT NOT NULL UNIQUE,
  folder       TEXT NOT NULL CHECK (folder IN ('packages', 'menu', 'gallery', 'cuisines', 'branches', 'occasions')),
  alt          TEXT NOT NULL CHECK (length(trim(alt)) > 0),
  content_type TEXT NOT NULL,
  size_bytes   INTEGER NOT NULL CHECK (size_bytes >= 0),
  width        INTEGER CHECK (width > 0),
  height       INTEGER CHECK (height > 0),
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
INSERT INTO media_new SELECT id, r2_key, folder, alt, content_type, size_bytes, width, height, created_at FROM media;
DROP TABLE media;
ALTER TABLE media_new RENAME TO media;
CREATE INDEX media_folder_created ON media (folder, created_at DESC);

UPDATE branches SET image_id = (SELECT l.image_id FROM _image_links l WHERE l.tbl = 'branches' AND l.id = branches.id)
  WHERE id IN (SELECT id FROM _image_links WHERE tbl = 'branches');
UPDATE cuisines SET image_id = (SELECT l.image_id FROM _image_links l WHERE l.tbl = 'cuisines' AND l.id = cuisines.id)
  WHERE id IN (SELECT id FROM _image_links WHERE tbl = 'cuisines');
UPDATE packages SET image_id = (SELECT l.image_id FROM _image_links l WHERE l.tbl = 'packages' AND l.id = packages.id)
  WHERE id IN (SELECT id FROM _image_links WHERE tbl = 'packages');
UPDATE menu_items SET image_id = (SELECT l.image_id FROM _image_links l WHERE l.tbl = 'menu_items' AND l.id = menu_items.id)
  WHERE id IN (SELECT id FROM _image_links WHERE tbl = 'menu_items');
UPDATE occasions SET image_id = (SELECT l.image_id FROM _image_links l WHERE l.tbl = 'occasions' AND l.id = occasions.id)
  WHERE id IN (SELECT id FROM _image_links WHERE tbl = 'occasions');

DROP TABLE _image_links;
