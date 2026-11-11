-- Event gallery photos. Images go in the existing 'gallery' media folder.

CREATE TABLE gallery_items (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,                -- card title, e.g. "Garden Wedding Reception"
  event_type  TEXT NOT NULL,                -- tag and filter chip, e.g. "Weddings"
  caption     TEXT,                         -- place / guest count, e.g. "Shah Alam · 600 pax"
  is_tall     INTEGER NOT NULL DEFAULT 0 CHECK (is_tall IN (0, 1)),
  image_id    INTEGER REFERENCES media (id) ON DELETE SET NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('published', 'draft', 'hidden')),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
