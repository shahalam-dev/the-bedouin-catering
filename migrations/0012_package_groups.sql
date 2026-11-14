-- Menu choice groups: "Choose 2 mains" from a list of menu items. A package without groups has a fixed menu.
CREATE TABLE package_groups (
  id           INTEGER PRIMARY KEY,
  package_id   INTEGER NOT NULL REFERENCES packages (id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  name_bm      TEXT,
  choose_count INTEGER NOT NULL DEFAULT 1 CHECK (choose_count > 0),
  sort_order   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX package_groups_package ON package_groups (package_id, sort_order);

CREATE TABLE package_group_items (
  group_id     INTEGER NOT NULL REFERENCES package_groups (id) ON DELETE CASCADE,
  menu_item_id INTEGER NOT NULL REFERENCES menu_items (id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, menu_item_id)
);
CREATE INDEX package_group_items_menu_item ON package_group_items (menu_item_id);
