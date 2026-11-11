import { changed, type Status, type WithImage } from './shared'

export type GalleryItem = {
  id: number
  name: string
  event_type: string
  caption: string | null
  is_tall: boolean
  image_id: number | null
  sort_order: number
  status: Status
  created_at: string
  updated_at: string
}

export type GalleryItemInput = Omit<GalleryItem, 'id' | 'created_at' | 'updated_at'>

type Row = Omit<GalleryItem, 'is_tall'> & { is_tall: number }
const fromRow = <T extends Row>(r: T) => ({ ...r, is_tall: r.is_tall === 1 })

/** Published gallery items that have a photo. */
export async function listPublishedGallery(db: D1Database): Promise<(GalleryItem & WithImage)[]> {
  const { results } = await db
    .prepare(
      `SELECT g.*, m.r2_key AS image_key, m.alt AS image_alt FROM gallery_items g
       JOIN media m ON m.id = g.image_id
       WHERE g.status = 'published' ORDER BY g.sort_order, g.id DESC`,
    )
    .all<Row & WithImage>()
  return results.map(fromRow)
}

export async function listGallery(db: D1Database): Promise<GalleryItem[]> {
  const { results } = await db.prepare('SELECT * FROM gallery_items ORDER BY sort_order, id DESC').all<Row>()
  return results.map(fromRow)
}

export async function getGalleryItemById(db: D1Database, id: number): Promise<GalleryItem | null> {
  const row = await db.prepare('SELECT * FROM gallery_items WHERE id = ?').bind(id).first<Row>()
  return row && fromRow(row)
}

export async function createGalleryItem(db: D1Database, g: GalleryItemInput): Promise<number> {
  const row = await db
    .prepare(
      `INSERT INTO gallery_items (name, event_type, caption, is_tall, image_id, sort_order, status)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .bind(g.name, g.event_type, g.caption, g.is_tall ? 1 : 0, g.image_id, g.sort_order, g.status)
    .first<{ id: number }>()
  return row!.id
}

export async function updateGalleryItem(db: D1Database, id: number, g: GalleryItemInput): Promise<boolean> {
  const r = await db
    .prepare(
      `UPDATE gallery_items SET name = ?, event_type = ?, caption = ?, is_tall = ?, image_id = ?, sort_order = ?, status = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
       WHERE id = ?`,
    )
    .bind(g.name, g.event_type, g.caption, g.is_tall ? 1 : 0, g.image_id, g.sort_order, g.status, id)
    .run()
  return changed(r)
}
