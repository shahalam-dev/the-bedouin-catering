-- Enquiries from the package selector carry full booking details and an estimate.
-- Status set changes to new / quoted / confirmed / declined (contacted -> quoted, closed -> confirmed).
-- SQLite cannot change a CHECK constraint, so enquiries is rebuilt. No table points at enquiries.
-- service_type NULL = general message from /contact.

CREATE TABLE enquiries_new (
  id               INTEGER PRIMARY KEY,
  name             TEXT NOT NULL,
  phone            TEXT NOT NULL,
  email            TEXT,
  service_type     TEXT CHECK (service_type IN ('in_house', 'outside')),
  event_date       TEXT CHECK (event_date IS NULL OR date(event_date) = event_date),
  event_time       TEXT CHECK (event_time IS NULL OR event_time GLOB '[0-2][0-9]:[0-5][0-9]'),
  pax              INTEGER CHECK (pax > 0),
  branch_id        INTEGER REFERENCES branches (id) ON DELETE SET NULL,
  cuisine_id       INTEGER REFERENCES cuisines (id) ON DELETE SET NULL,
  package_id       INTEGER REFERENCES packages (id) ON DELETE SET NULL,
  -- {"<group_id>": [menu_item_id, ...]}
  menu_choices     TEXT CHECK (menu_choices IS NULL OR json_valid(menu_choices)),
  address_line     TEXT,
  postcode         TEXT,
  city             TEXT,
  state            TEXT,
  setup_notes      TEXT,
  message          TEXT,
  estimate_sen     INTEGER CHECK (estimate_sen >= 0),
  delivery_fee_sen INTEGER CHECK (delivery_fee_sen >= 0),
  status           TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'quoted', 'confirmed', 'declined')),
  decline_reason   TEXT,
  admin_notes      TEXT,
  notified_at      TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  CHECK (status <> 'declined' OR decline_reason IS NOT NULL)
);
INSERT INTO enquiries_new
  (id, name, phone, email, event_date, pax, branch_id, cuisine_id, package_id, message, status, notified_at, created_at)
SELECT id, name, phone, email, event_date, pax, branch_id, cuisine_id, package_id, message,
  CASE status WHEN 'contacted' THEN 'quoted' WHEN 'closed' THEN 'confirmed' ELSE status END,
  notified_at, created_at
FROM enquiries;
DROP TABLE enquiries;
ALTER TABLE enquiries_new RENAME TO enquiries;

CREATE INDEX enquiries_status_created ON enquiries (status, created_at DESC);
CREATE INDEX enquiries_created ON enquiries (created_at DESC);
-- Retry failed notifications.
CREATE INDEX enquiries_unnotified ON enquiries (created_at) WHERE notified_at IS NULL;
