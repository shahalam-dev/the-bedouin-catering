import { changed, type Status } from './shared'

export type Branch = {
  id: number
  slug: string
  name: string
  address: string | null
  phone: string | null
  image_id: number | null
  sort_order: number
  status: Status
  created_at: string
  updated_at: string
}

export type BranchInput = Omit<Branch, 'id' | 'created_at' | 'updated_at'>

export async function listPublishedBranches(db: D1Database): Promise<Branch[]> {
  const { results } = await db
    .prepare("SELECT * FROM branches WHERE status = 'published' ORDER BY sort_order, name")
    .all<Branch>()
  return results
}

export async function listBranches(db: D1Database): Promise<Branch[]> {
  const { results } = await db.prepare('SELECT * FROM branches ORDER BY sort_order, name').all<Branch>()
  return results
}

export function getBranchById(db: D1Database, id: number): Promise<Branch | null> {
  return db.prepare('SELECT * FROM branches WHERE id = ?').bind(id).first<Branch>()
}

export function getPublishedBranchBySlug(db: D1Database, slug: string): Promise<Branch | null> {
  return db
    .prepare("SELECT * FROM branches WHERE slug = ? AND status = 'published'")
    .bind(slug)
    .first<Branch>()
}

export async function createBranch(db: D1Database, b: BranchInput): Promise<number> {
  const row = await db
    .prepare(
      `INSERT INTO branches (slug, name, address, phone, image_id, sort_order, status)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .bind(b.slug, b.name, b.address, b.phone, b.image_id, b.sort_order, b.status)
    .first<{ id: number }>()
  return row!.id
}

export async function updateBranch(db: D1Database, id: number, b: BranchInput): Promise<boolean> {
  const r = await db
    .prepare(
      `UPDATE branches SET slug = ?, name = ?, address = ?, phone = ?, image_id = ?, sort_order = ?, status = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
       WHERE id = ?`,
    )
    .bind(b.slug, b.name, b.address, b.phone, b.image_id, b.sort_order, b.status, id)
    .run()
  return changed(r)
}

export async function setBranchStatus(db: D1Database, id: number, status: Status): Promise<boolean> {
  const r = await db
    .prepare("UPDATE branches SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?")
    .bind(status, id)
    .run()
  return changed(r)
}

/** Throws a FOREIGN KEY error while packages still use this branch. */
export async function deleteBranch(db: D1Database, id: number): Promise<boolean> {
  return changed(await db.prepare('DELETE FROM branches WHERE id = ?').bind(id).run())
}
