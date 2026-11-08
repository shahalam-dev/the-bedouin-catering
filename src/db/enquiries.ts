import { changed } from './shared'

export type EnquiryStatus = 'new' | 'contacted' | 'closed'

export type Enquiry = {
  id: number
  name: string
  phone: string
  email: string | null
  /** YYYY-MM-DD */
  event_date: string | null
  pax: number | null
  branch_id: number | null
  cuisine_id: number | null
  package_id: number | null
  message: string | null
  status: EnquiryStatus
  notified_at: string | null
  created_at: string
}

export type EnquiryInput = Omit<Enquiry, 'id' | 'status' | 'notified_at' | 'created_at'>

/** Saves the enquiry first; notification happens afterwards (see markEnquiryNotified). */
export async function createEnquiry(db: D1Database, e: EnquiryInput): Promise<number> {
  const row = await db
    .prepare(
      `INSERT INTO enquiries
         (name, phone, email, event_date, pax, branch_id, cuisine_id, package_id, message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .bind(e.name, e.phone, e.email, e.event_date, e.pax, e.branch_id, e.cuisine_id, e.package_id, e.message)
    .first<{ id: number }>()
  return row!.id
}

export function getEnquiryById(db: D1Database, id: number): Promise<Enquiry | null> {
  return db.prepare('SELECT * FROM enquiries WHERE id = ?').bind(id).first<Enquiry>()
}

/** Newest first, paginated. Optional status filter. */
export async function listEnquiries(
  db: D1Database,
  opts: { status?: EnquiryStatus; limit?: number; offset?: number } = {},
): Promise<Enquiry[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM enquiries
       WHERE (?1 IS NULL OR status = ?1)
       ORDER BY created_at DESC, id DESC
       LIMIT ?2 OFFSET ?3`,
    )
    .bind(opts.status ?? null, opts.limit ?? 50, opts.offset ?? 0)
    .all<Enquiry>()
  return results
}

export async function setEnquiryStatus(db: D1Database, id: number, status: EnquiryStatus): Promise<boolean> {
  return changed(await db.prepare('UPDATE enquiries SET status = ? WHERE id = ?').bind(status, id).run())
}

export async function markEnquiryNotified(db: D1Database, id: number): Promise<boolean> {
  const r = await db
    .prepare("UPDATE enquiries SET notified_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?")
    .bind(id)
    .run()
  return changed(r)
}

/** Enquiries whose notification failed or never ran, oldest first, for retrying. */
export async function listUnnotifiedEnquiries(db: D1Database, limit = 20): Promise<Enquiry[]> {
  const { results } = await db
    .prepare('SELECT * FROM enquiries WHERE notified_at IS NULL ORDER BY created_at LIMIT ?')
    .bind(limit)
    .all<Enquiry>()
  return results
}
