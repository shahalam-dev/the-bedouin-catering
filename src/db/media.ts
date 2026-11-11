import { changed } from './shared'

export type MediaFolder = 'packages' | 'menu' | 'gallery' | 'cuisines' | 'branches' | 'occasions'

export type Media = {
  id: number
  r2_key: string
  folder: MediaFolder
  alt: string
  content_type: string
  size_bytes: number
  width: number | null
  height: number | null
  created_at: string
}

export type MediaInput = Omit<Media, 'id' | 'created_at'>

export function getMediaById(db: D1Database, id: number): Promise<Media | null> {
  return db.prepare('SELECT * FROM media WHERE id = ?').bind(id).first<Media>()
}

export function getMediaByKey(db: D1Database, r2Key: string): Promise<Media | null> {
  return db.prepare('SELECT * FROM media WHERE r2_key = ?').bind(r2Key).first<Media>()
}

/** Newest first. Pass a folder to filter the media library. */
export async function listMedia(db: D1Database, folder?: MediaFolder): Promise<Media[]> {
  const { results } = await db
    .prepare('SELECT * FROM media WHERE (?1 IS NULL OR folder = ?1) ORDER BY created_at DESC, id DESC')
    .bind(folder ?? null)
    .all<Media>()
  return results
}

/** Call after the object is stored in R2. The schema rejects empty alt text. */
export async function createMedia(db: D1Database, m: MediaInput): Promise<number> {
  const row = await db
    .prepare(
      `INSERT INTO media (r2_key, folder, alt, content_type, size_bytes, width, height)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .bind(m.r2_key, m.folder, m.alt, m.content_type, m.size_bytes, m.width, m.height)
    .first<{ id: number }>()
  return row!.id
}

export async function updateMediaAlt(db: D1Database, id: number, alt: string): Promise<boolean> {
  return changed(await db.prepare('UPDATE media SET alt = ? WHERE id = ?').bind(alt, id).run())
}

/**
 * Deletes the row and returns its R2 key so the caller can delete the object,
 * or null if there was no such row. Rows that used it get image_id = NULL.
 */
export async function deleteMedia(db: D1Database, id: number): Promise<string | null> {
  const row = await db.prepare('DELETE FROM media WHERE id = ? RETURNING r2_key').bind(id).first<{ r2_key: string }>()
  return row?.r2_key ?? null
}
