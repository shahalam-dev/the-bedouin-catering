import { changed, type Status } from './shared'

export type Cuisine = {
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

export type CuisineInput = Omit<Cuisine, 'id' | 'created_at' | 'updated_at'>

export async function listPublishedCuisines(db: D1Database): Promise<Cuisine[]> {
  const { results } = await db
    .prepare("SELECT * FROM cuisines WHERE status = 'published' ORDER BY sort_order, name")
    .all<Cuisine>()
  return results
}

/** Package selector step 2: published cuisines that have a published package at this branch. */
export async function listCuisinesForBranch(db: D1Database, branchId: number): Promise<Cuisine[]> {
  const { results } = await db
    .prepare(
      `SELECT c.* FROM cuisines c
       WHERE c.status = 'published'
         AND EXISTS (SELECT 1 FROM packages p
                     WHERE p.cuisine_id = c.id AND p.branch_id = ? AND p.status = 'published')
       ORDER BY c.sort_order, c.name`,
    )
    .bind(branchId)
    .all<Cuisine>()
  return results
}

export async function listCuisines(db: D1Database): Promise<Cuisine[]> {
  const { results } = await db.prepare('SELECT * FROM cuisines ORDER BY sort_order, name').all<Cuisine>()
  return results
}

export function getCuisineById(db: D1Database, id: number): Promise<Cuisine | null> {
  return db.prepare('SELECT * FROM cuisines WHERE id = ?').bind(id).first<Cuisine>()
}

export function getPublishedCuisineBySlug(db: D1Database, slug: string): Promise<Cuisine | null> {
  return db
    .prepare("SELECT * FROM cuisines WHERE slug = ? AND status = 'published'")
    .bind(slug)
    .first<Cuisine>()
}

export async function createCuisine(db: D1Database, c: CuisineInput): Promise<number> {
  const row = await db
    .prepare(
      `INSERT INTO cuisines (slug, name, description, image_id, sort_order, status)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .bind(c.slug, c.name, c.description, c.image_id, c.sort_order, c.status)
    .first<{ id: number }>()
  return row!.id
}

export async function updateCuisine(db: D1Database, id: number, c: CuisineInput): Promise<boolean> {
  const r = await db
    .prepare(
      `UPDATE cuisines SET slug = ?, name = ?, description = ?, image_id = ?, sort_order = ?, status = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
       WHERE id = ?`,
    )
    .bind(c.slug, c.name, c.description, c.image_id, c.sort_order, c.status, id)
    .run()
  return changed(r)
}

export async function setCuisineStatus(db: D1Database, id: number, status: Status): Promise<boolean> {
  const r = await db
    .prepare("UPDATE cuisines SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?")
    .bind(status, id)
    .run()
  return changed(r)
}

/** Throws a FOREIGN KEY error while packages still use this cuisine. */
export async function deleteCuisine(db: D1Database, id: number): Promise<boolean> {
  return changed(await db.prepare('DELETE FROM cuisines WHERE id = ?').bind(id).run())
}
