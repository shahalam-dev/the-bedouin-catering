-- Packages no longer belong to a branch. A branch is now only the venue for in-house events.
-- Packages get a service type (in-house, outside catering or both) and an optional max pax.

ALTER TABLE branches ADD COLUMN maps_link TEXT;
ALTER TABLE branches ADD COLUMN has_hall INTEGER NOT NULL DEFAULT 0 CHECK (has_hall IN (0, 1));
ALTER TABLE branches ADD COLUMN hall_capacity INTEGER CHECK (hall_capacity > 0);

-- SQLite cannot drop a foreign key column, so packages is rebuilt.
-- DROP TABLE runs ON DELETE SET NULL on enquiries.package_id, so those links are saved first and put back after.
PRAGMA defer_foreign_keys = on;

CREATE TABLE _enquiry_packages AS SELECT id, package_id FROM enquiries WHERE package_id IS NOT NULL;

CREATE TABLE packages_new (
  id             INTEGER PRIMARY KEY,
  slug           TEXT NOT NULL UNIQUE,
  cuisine_id     INTEGER NOT NULL REFERENCES cuisines (id) ON DELETE RESTRICT,
  service_type   TEXT NOT NULL DEFAULT 'both' CHECK (service_type IN ('in_house', 'outside', 'both')),
  name           TEXT NOT NULL,
  name_bm        TEXT,
  description    TEXT,
  description_bm TEXT,
  price_sen      INTEGER NOT NULL CHECK (price_sen >= 0),
  min_pax        INTEGER NOT NULL DEFAULT 1 CHECK (min_pax > 0),
  max_pax        INTEGER CHECK (max_pax IS NULL OR max_pax >= min_pax),
  inclusions     TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(inclusions) AND json_type(inclusions) = 'array'),
  inclusions_bm  TEXT NOT NULL DEFAULT '[]',
  is_popular     INTEGER NOT NULL DEFAULT 0 CHECK (is_popular IN (0, 1)),
  image_id       INTEGER REFERENCES media (id) ON DELETE SET NULL,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('published', 'draft', 'hidden')),
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
INSERT INTO packages_new
  (id, slug, cuisine_id, name, name_bm, description, description_bm, price_sen, min_pax,
   inclusions, inclusions_bm, is_popular, image_id, sort_order, status, created_at, updated_at)
SELECT id, slug, cuisine_id, name, name_bm, description, description_bm, price_sen, min_pax,
   inclusions, inclusions_bm, is_popular, image_id, sort_order, status, created_at, updated_at
FROM packages;
DROP TABLE packages;
ALTER TABLE packages_new RENAME TO packages;
-- Package selector: published packages filtered by cuisine, then service type.
CREATE INDEX packages_status_cuisine_service ON packages (status, cuisine_id, service_type, sort_order);

UPDATE enquiries SET package_id = (SELECT l.package_id FROM _enquiry_packages l WHERE l.id = enquiries.id)
  WHERE id IN (SELECT id FROM _enquiry_packages);
DROP TABLE _enquiry_packages;
