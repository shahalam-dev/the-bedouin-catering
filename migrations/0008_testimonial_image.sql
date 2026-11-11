-- Testimonials get a client photo (own 'testimonials' media folder). customer_name becomes name
-- so the generic CMS editor can handle the table.

ALTER TABLE testimonials RENAME COLUMN customer_name TO name;
ALTER TABLE testimonials ADD COLUMN image_id INTEGER REFERENCES media (id) ON DELETE SET NULL;

-- Same media rebuild as 0007 (SQLite cannot change a CHECK constraint). Image links are
-- saved first because DROP TABLE runs ON DELETE SET NULL on every table pointing at media.
PRAGMA defer_foreign_keys = on;

CREATE TABLE _image_links AS
  SELECT 'branches' AS tbl, id, image_id FROM branches WHERE image_id IS NOT NULL
  UNION ALL SELECT 'cuisines', id, image_id FROM cuisines WHERE image_id IS NOT NULL
  UNION ALL SELECT 'packages', id, image_id FROM packages WHERE image_id IS NOT NULL
  UNION ALL SELECT 'menu_items', id, image_id FROM menu_items WHERE image_id IS NOT NULL
  UNION ALL SELECT 'occasions', id, image_id FROM occasions WHERE image_id IS NOT NULL;
-- Separate insert: D1 limits how many SELECTs one UNION may have.
INSERT INTO _image_links SELECT 'clients', id, image_id FROM clients WHERE image_id IS NOT NULL;

CREATE TABLE media_new (
  id           INTEGER PRIMARY KEY,
  r2_key       TEXT NOT NULL UNIQUE,
  folder       TEXT NOT NULL CHECK (folder IN ('packages', 'menu', 'gallery', 'cuisines', 'branches', 'occasions', 'clients', 'testimonials')),
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
UPDATE clients SET image_id = (SELECT l.image_id FROM _image_links l WHERE l.tbl = 'clients' AND l.id = clients.id)
  WHERE id IN (SELECT id FROM _image_links WHERE tbl = 'clients');

DROP TABLE _image_links;
