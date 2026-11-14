import { changed } from './shared'

export type EnquiryStatus = 'new' | 'quoted' | 'confirmed' | 'declined'

/** group id -> chosen menu item ids */
export type MenuChoices = Record<string, number[]>

export type Enquiry = {
  id: number
  name: string
  phone: string
  email: string | null
  /** NULL for a general message from /contact. */
  service_type: 'in_house' | 'outside' | null
  /** YYYY-MM-DD */
  event_date: string | null
  /** HH:MM */
  event_time: string | null
  pax: number | null
  /** The venue for in-house events; assigned by staff for outside catering. */
  branch_id: number | null
  cuisine_id: number | null
  package_id: number | null
  menu_choices: MenuChoices | null
  address_line: string | null
  postcode: string | null
  city: string | null
  state: string | null
  setup_notes: string | null
  message: string | null
  estimate_sen: number | null
  delivery_fee_sen: number | null
  status: EnquiryStatus
  decline_reason: string | null
  admin_notes: string | null
  notified_at: string | null
  created_at: string
}

export type EnquiryInput = Omit<
  Enquiry,
  'id' | 'status' | 'delivery_fee_sen' | 'decline_reason' | 'admin_notes' | 'notified_at' | 'created_at'
>

export type EnquiryAdminInput = Pick<Enquiry, 'status' | 'branch_id' | 'delivery_fee_sen' | 'decline_reason' | 'admin_notes'>

type Row = Omit<Enquiry, 'menu_choices'> & { menu_choices: string | null }
const fromRow = (r: Row): Enquiry => ({ ...r, menu_choices: r.menu_choices ? (JSON.parse(r.menu_choices) as MenuChoices) : null })

/** Saves the enquiry first; notification happens afterwards (see markEnquiryNotified). */
export async function createEnquiry(db: D1Database, e: EnquiryInput): Promise<number> {
  const row = await db
    .prepare(
      `INSERT INTO enquiries
         (name, phone, email, service_type, event_date, event_time, pax, branch_id, cuisine_id, package_id, menu_choices,
          address_line, postcode, city, state, setup_notes, message, estimate_sen)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .bind(
      e.name, e.phone, e.email, e.service_type, e.event_date, e.event_time, e.pax, e.branch_id, e.cuisine_id, e.package_id,
      e.menu_choices ? JSON.stringify(e.menu_choices) : null,
      e.address_line, e.postcode, e.city, e.state, e.setup_notes, e.message, e.estimate_sen,
    )
    .first<{ id: number }>()
  return row!.id
}

export async function getEnquiryById(db: D1Database, id: number): Promise<Enquiry | null> {
  const row = await db.prepare('SELECT * FROM enquiries WHERE id = ?').bind(id).first<Row>()
  return row ? fromRow(row) : null
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
    .all<Row>()
  return results.map(fromRow)
}

/** Staff fields: status, venue branch, delivery fee, decline reason, notes. */
export async function updateEnquiryAdmin(db: D1Database, id: number, e: EnquiryAdminInput): Promise<boolean> {
  const r = await db
    .prepare('UPDATE enquiries SET status = ?, branch_id = ?, delivery_fee_sen = ?, decline_reason = ?, admin_notes = ? WHERE id = ?')
    .bind(e.status, e.branch_id, e.delivery_fee_sen, e.decline_reason, e.admin_notes, id)
    .run()
  return changed(r)
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
    .all<Row>()
  return results.map(fromRow)
}
