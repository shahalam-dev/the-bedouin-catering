import { changed, type Status, type WithImage } from './shared'

export type MenuItem = {
  id: number
  cuisine_id: number | null
  name: string
  description: string | null
  category: string | null
  price_sen: number | null
  is_bestseller: boolean
  image_id: number | null
  sort_order: number
  status: Status
  created_at: string
  updated_at: string
}

export type MenuItemInput = Omit<MenuItem, 'id' | 'created_at' | 'updated_at'>

type Row = Omit<MenuItem, 'is_bestseller'> & { is_bestseller: number }
const fromRow = (r: Row): MenuItem => ({ ...r, is_bestseller: r.is_bestseller === 1 })

/** Public menu. Optional cuisine filter; `bestsellersOnly` for the Bestsellers block. */
export async function listPublishedMenuItems(
  db: D1Database,
  filter: { cuisineId?: number; bestsellersOnly?: boolean } = {},
): Promise<(MenuItem & WithImage)[]> {
  const { results } = await db
    .prepare(
      `SELECT i.*, m.r2_key AS image_key, m.alt AS image_alt FROM menu_items i
       LEFT JOIN media m ON m.id = i.image_id
       WHERE i.status = 'published'
         AND (?1 IS NULL OR i.cuisine_id = ?1)
         AND (?2 = 0 OR i.is_bestseller = 1)
       ORDER BY i.sort_order, i.name`,
    )
    .bind(filter.cuisineId ?? null, filter.bestsellersOnly ? 1 : 0)
    .all<Row & WithImage>()
  return results.map((r) => ({ ...r, is_bestseller: r.is_bestseller === 1 }))
}

export async function listMenuItems(db: D1Database): Promise<MenuItem[]> {
  const { results } = await db.prepare('SELECT * FROM menu_items ORDER BY cuisine_id, sort_order, name').all<Row>()
  return results.map(fromRow)
}

export async function getMenuItemById(db: D1Database, id: number): Promise<MenuItem | null> {
  const row = await db.prepare('SELECT * FROM menu_items WHERE id = ?').bind(id).first<Row>()
  return row ? fromRow(row) : null
}

export async function createMenuItem(db: D1Database, m: MenuItemInput): Promise<number> {
  const row = await db
    .prepare(
      `INSERT INTO menu_items
         (cuisine_id, name, description, category, price_sen, is_bestseller, image_id, sort_order, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .bind(
      m.cuisine_id, m.name, m.description, m.category, m.price_sen,
      m.is_bestseller ? 1 : 0, m.image_id, m.sort_order, m.status,
    )
    .first<{ id: number }>()
  return row!.id
}

export async function updateMenuItem(db: D1Database, id: number, m: MenuItemInput): Promise<boolean> {
  const r = await db
    .prepare(
      `UPDATE menu_items SET
         cuisine_id = ?, name = ?, description = ?, category = ?, price_sen = ?, is_bestseller = ?,
         image_id = ?, sort_order = ?, status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
       WHERE id = ?`,
    )
    .bind(
      m.cuisine_id, m.name, m.description, m.category, m.price_sen,
      m.is_bestseller ? 1 : 0, m.image_id, m.sort_order, m.status, id,
    )
    .run()
  return changed(r)
}

export async function setMenuItemStatus(db: D1Database, id: number, status: Status): Promise<boolean> {
  const r = await db
    .prepare("UPDATE menu_items SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?")
    .bind(status, id)
    .run()
  return changed(r)
}

export async function deleteMenuItem(db: D1Database, id: number): Promise<boolean> {
  return changed(await db.prepare('DELETE FROM menu_items WHERE id = ?').bind(id).run())
}
