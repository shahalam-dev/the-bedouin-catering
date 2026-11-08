import { changed, type Status } from './shared'

export type Occasion = {
  id: number
  slug: string
  name: string
  description: string | null
  image_id: number | null
  sort_order: number
  status: Status
  created_at: string
  updated_at: string
}

export type OccasionInput = Omit<Occasion, 'id' | 'created_at' | 'updated_at'>

export async function listPublishedOccasions(db: D1Database): Promise<Occasion[]> {
  const { results } = await db
    .prepare("SELECT * FROM occasions WHERE status = 'published' ORDER BY sort_order, name")
    .all<Occasion>()
  return results
}

export async function listOccasions(db: D1Database): Promise<Occasion[]> {
  const { results } = await db.prepare('SELECT * FROM occasions ORDER BY sort_order, name').all<Occasion>()
  return results
}

export function getOccasionById(db: D1Database, id: number): Promise<Occasion | null> {
  return db.prepare('SELECT * FROM occasions WHERE id = ?').bind(id).first<Occasion>()
}

export function getPublishedOccasionBySlug(db: D1Database, slug: string): Promise<Occasion | null> {
  return db
    .prepare("SELECT * FROM occasions WHERE slug = ? AND status = 'published'")
    .bind(slug)
    .first<Occasion>()
}

export async function createOccasion(db: D1Database, o: OccasionInput): Promise<number> {
  const row = await db
    .prepare(
      `INSERT INTO occasions (slug, name, description, image_id, sort_order, status)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .bind(o.slug, o.name, o.description, o.image_id, o.sort_order, o.status)
    .first<{ id: number }>()
  return row!.id
}

export async function updateOccasion(db: D1Database, id: number, o: OccasionInput): Promise<boolean> {
  const r = await db
    .prepare(
      `UPDATE occasions SET slug = ?, name = ?, description = ?, image_id = ?, sort_order = ?, status = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
       WHERE id = ?`,
    )
    .bind(o.slug, o.name, o.description, o.image_id, o.sort_order, o.status, id)
    .run()
  return changed(r)
}

export async function setOccasionStatus(db: D1Database, id: number, status: Status): Promise<boolean> {
  const r = await db
    .prepare("UPDATE occasions SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?")
    .bind(status, id)
    .run()
  return changed(r)
}

export async function deleteOccasion(db: D1Database, id: number): Promise<boolean> {
  return changed(await db.prepare('DELETE FROM occasions WHERE id = ?').bind(id).run())
}
