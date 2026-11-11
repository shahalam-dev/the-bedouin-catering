import type { Lang } from '../lib/i18n'
import { changed, type Status, type WithImage } from './shared'

export type Branch = {
  id: number
  slug: string
  name: string
  name_bm: string | null
  address: string | null
  phone: string | null
  image_id: number | null
  sort_order: number
  status: Status
  created_at: string
  updated_at: string
}

export type BranchInput = Omit<Branch, 'id' | 'created_at' | 'updated_at'>

/** Name in the visitor's language; BM falls back to English when not filled in. */
export const branchInLang = <T extends Branch>(b: T, lang: Lang): T => (lang === 'bm' ? { ...b, name: b.name_bm || b.name } : b)

export async function listPublishedBranches(db: D1Database): Promise<(Branch & WithImage)[]> {
  const { results } = await db
    .prepare(
      `SELECT b.*, m.r2_key AS image_key, m.alt AS image_alt FROM branches b
       LEFT JOIN media m ON m.id = b.image_id
       WHERE b.status = 'published' ORDER BY b.sort_order, b.name`,
    )
    .all<Branch & WithImage>()
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
      `INSERT INTO branches (slug, name, name_bm, address, phone, image_id, sort_order, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .bind(b.slug, b.name, b.name_bm, b.address, b.phone, b.image_id, b.sort_order, b.status)
    .first<{ id: number }>()
  return row!.id
}

export async function updateBranch(db: D1Database, id: number, b: BranchInput): Promise<boolean> {
  const r = await db
    .prepare(
      `UPDATE branches SET slug = ?, name = ?, name_bm = ?, address = ?, phone = ?, image_id = ?, sort_order = ?, status = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
       WHERE id = ?`,
    )
    .bind(b.slug, b.name, b.name_bm, b.address, b.phone, b.image_id, b.sort_order, b.status, id)
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
