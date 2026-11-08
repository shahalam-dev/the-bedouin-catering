-- Initial schema. Never edit after it is applied; add a new migration instead.
-- Timestamps are UTC ISO-8601 text. Booleans are INTEGER 0/1. Prices are integer sen.

CREATE TABLE media (
  id           INTEGER PRIMARY KEY,
  r2_key       TEXT NOT NULL UNIQUE,
  folder       TEXT NOT NULL CHECK (folder IN ('packages', 'menu', 'gallery')),
  alt          TEXT NOT NULL CHECK (length(trim(alt)) > 0),
  content_type TEXT NOT NULL,
  size_bytes   INTEGER NOT NULL CHECK (size_bytes >= 0),
  width        INTEGER CHECK (width > 0),
  height       INTEGER CHECK (height > 0),
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX media_folder_created ON media (folder, created_at DESC);

CREATE TABLE branches (
  id          INTEGER PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  address     TEXT,
  phone       TEXT,
  image_id    INTEGER REFERENCES media (id) ON DELETE SET NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('published', 'draft', 'hidden')),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX branches_status_sort ON branches (status, sort_order);

CREATE TABLE cuisines (
  id          INTEGER PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  image_id    INTEGER REFERENCES media (id) ON DELETE SET NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('published', 'draft', 'hidden')),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX cuisines_status_sort ON cuisines (status, sort_order);

CREATE TABLE packages (
  id          INTEGER PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  branch_id   INTEGER NOT NULL REFERENCES branches (id) ON DELETE RESTRICT,
  cuisine_id  INTEGER NOT NULL REFERENCES cuisines (id) ON DELETE RESTRICT,
  name        TEXT NOT NULL,
  description TEXT,
  price_sen   INTEGER NOT NULL CHECK (price_sen >= 0),
  min_pax     INTEGER NOT NULL DEFAULT 1 CHECK (min_pax > 0),
  inclusions  TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(inclusions) AND json_type(inclusions) = 'array'),
  is_popular  INTEGER NOT NULL DEFAULT 0 CHECK (is_popular IN (0, 1)),
  image_id    INTEGER REFERENCES media (id) ON DELETE SET NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('published', 'draft', 'hidden')),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
-- Package selector: published packages filtered by branch, then cuisine.
CREATE INDEX packages_status_branch_cuisine ON packages (status, branch_id, cuisine_id, sort_order);
CREATE INDEX packages_cuisine ON packages (cuisine_id);

CREATE TABLE menu_items (
  id            INTEGER PRIMARY KEY,
  cuisine_id    INTEGER REFERENCES cuisines (id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  category      TEXT,
  price_sen     INTEGER CHECK (price_sen >= 0),
  is_bestseller INTEGER NOT NULL DEFAULT 0 CHECK (is_bestseller IN (0, 1)),
  image_id      INTEGER REFERENCES media (id) ON DELETE SET NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('published', 'draft', 'hidden')),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX menu_items_status_cuisine_sort ON menu_items (status, cuisine_id, sort_order);

CREATE TABLE occasions (
  id          INTEGER PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  image_id    INTEGER REFERENCES media (id) ON DELETE SET NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('published', 'draft', 'hidden')),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX occasions_status_sort ON occasions (status, sort_order);

CREATE TABLE testimonials (
  id            INTEGER PRIMARY KEY,
  customer_name TEXT NOT NULL,
  event_type    TEXT,
  quote         TEXT NOT NULL,
  rating        INTEGER NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  sort_order    INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('published', 'draft', 'hidden')),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX testimonials_status_sort ON testimonials (status, sort_order);

-- Links use ON DELETE SET NULL, so deleting a branch, cuisine or package never deletes an enquiry.
CREATE TABLE enquiries (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL,
  email       TEXT,
  event_date  TEXT CHECK (event_date IS NULL OR date(event_date) = event_date),
  pax         INTEGER CHECK (pax > 0),
  branch_id   INTEGER REFERENCES branches (id) ON DELETE SET NULL,
  cuisine_id  INTEGER REFERENCES cuisines (id) ON DELETE SET NULL,
  package_id  INTEGER REFERENCES packages (id) ON DELETE SET NULL,
  message     TEXT,
  status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'closed')),
  notified_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX enquiries_status_created ON enquiries (status, created_at DESC);
CREATE INDEX enquiries_created ON enquiries (created_at DESC);
-- Retry failed notifications.
CREATE INDEX enquiries_unnotified ON enquiries (created_at) WHERE notified_at IS NULL;

CREATE TABLE admin_users (
  id            INTEGER PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  last_login_at TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Key/value site settings (contact details, WhatsApp number, socials). Value is JSON.
CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL CHECK (json_valid(value)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
