import { changed, type Status, type WithImage } from './shared'

export type Client = {
  id: number
  name: string
  image_id: number | null
  sort_order: number
  status: Status
  created_at: string
  updated_at: string
}

export type ClientInput = Omit<Client, 'id' | 'created_at' | 'updated_at'>

/** Published clients that have a logo. Pass a limit for the home page strip. */
export async function listPublishedClients(db: D1Database, limit = -1): Promise<(Client & WithImage)[]> {
  const { results } = await db
    .prepare(
      `SELECT c.*, m.r2_key AS image_key, m.alt AS image_alt FROM clients c
       JOIN media m ON m.id = c.image_id
       WHERE c.status = 'published' ORDER BY c.sort_order, c.name LIMIT ?`,
    )
    .bind(limit)
    .all<Client & WithImage>()
  return results
}

export async function listClients(db: D1Database): Promise<Client[]> {
  const { results } = await db.prepare('SELECT * FROM clients ORDER BY sort_order, name').all<Client>()
  return results
}

export function getClientById(db: D1Database, id: number): Promise<Client | null> {
  return db.prepare('SELECT * FROM clients WHERE id = ?').bind(id).first<Client>()
}

export async function createClient(db: D1Database, c: ClientInput): Promise<number> {
  const row = await db
    .prepare('INSERT INTO clients (name, image_id, sort_order, status) VALUES (?, ?, ?, ?) RETURNING id')
    .bind(c.name, c.image_id, c.sort_order, c.status)
    .first<{ id: number }>()
  return row!.id
}

export async function updateClient(db: D1Database, id: number, c: ClientInput): Promise<boolean> {
  const r = await db
    .prepare(
      `UPDATE clients SET name = ?, image_id = ?, sort_order = ?, status = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
       WHERE id = ?`,
    )
    .bind(c.name, c.image_id, c.sort_order, c.status, id)
    .run()
  return changed(r)
}
