import { changed } from './shared'

export type PackageGroup = {
  id: number
  package_id: number
  name: string
  name_bm: string | null
  choose_count: number
  sort_order: number
}

export type GroupItem = { id: number; name: string; name_bm: string | null }

/** A group with the menu items a customer can pick from. */
export type GroupWithItems = PackageGroup & { items: GroupItem[] }

export type PackageGroupInput = Omit<PackageGroup, 'id'>

/**
 * Groups of a package, in order, each with its menu items.
 * `publishedOnly` (public selector) leaves out items that are not published.
 */
export async function listGroups(db: D1Database, packageId: number, opts: { publishedOnly?: boolean } = {}): Promise<GroupWithItems[]> {
  const [groups, items] = await db.batch([
    db.prepare('SELECT * FROM package_groups WHERE package_id = ? ORDER BY sort_order, id').bind(packageId),
    db
      .prepare(
        `SELECT gi.group_id, i.id, i.name, i.name_bm FROM package_group_items gi
         JOIN package_groups g ON g.id = gi.group_id
         JOIN menu_items i ON i.id = gi.menu_item_id
         WHERE g.package_id = ?1 AND (?2 = 0 OR i.status = 'published')
         ORDER BY i.sort_order, i.name`,
      )
      .bind(packageId, opts.publishedOnly ? 1 : 0),
  ])
  const rows = items.results as (GroupItem & { group_id: number })[]
  return (groups.results as PackageGroup[]).map((g) => ({
    ...g,
    items: rows.filter((r) => r.group_id === g.id).map(({ id, name, name_bm }) => ({ id, name, name_bm })),
  }))
}

export function getGroupById(db: D1Database, id: number): Promise<PackageGroup | null> {
  return db.prepare('SELECT * FROM package_groups WHERE id = ?').bind(id).first<PackageGroup>()
}

/** Menu item ids in a group (admin form checkboxes). */
export async function listGroupItemIds(db: D1Database, groupId: number): Promise<number[]> {
  const { results } = await db.prepare('SELECT menu_item_id FROM package_group_items WHERE group_id = ?').bind(groupId).all<{ menu_item_id: number }>()
  return results.map((r) => r.menu_item_id)
}

export async function createGroup(db: D1Database, g: PackageGroupInput, itemIds: number[]): Promise<number> {
  const row = await db
    .prepare('INSERT INTO package_groups (package_id, name, name_bm, choose_count, sort_order) VALUES (?, ?, ?, ?, ?) RETURNING id')
    .bind(g.package_id, g.name, g.name_bm, g.choose_count, g.sort_order)
    .first<{ id: number }>()
  await setGroupItems(db, row!.id, itemIds)
  return row!.id
}

/** package_id is not changed: a group stays with its package. */
export async function updateGroup(db: D1Database, id: number, g: Omit<PackageGroupInput, 'package_id'>, itemIds: number[]): Promise<boolean> {
  const r = await db
    .prepare('UPDATE package_groups SET name = ?, name_bm = ?, choose_count = ?, sort_order = ? WHERE id = ?')
    .bind(g.name, g.name_bm, g.choose_count, g.sort_order, id)
    .run()
  if (!changed(r)) return false
  await setGroupItems(db, id, itemIds)
  return true
}

/** Replaces the group's items in one batch (a transaction in D1). */
export async function setGroupItems(db: D1Database, groupId: number, itemIds: number[]): Promise<void> {
  await db.batch([
    db.prepare('DELETE FROM package_group_items WHERE group_id = ?').bind(groupId),
    ...[...new Set(itemIds)].map((itemId) =>
      db.prepare('INSERT INTO package_group_items (group_id, menu_item_id) VALUES (?, ?)').bind(groupId, itemId),
    ),
  ])
}

export async function deleteGroup(db: D1Database, id: number): Promise<boolean> {
  return changed(await db.prepare('DELETE FROM package_groups WHERE id = ?').bind(id).run())
}
