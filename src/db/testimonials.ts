import { changed, type Status, type WithImage } from './shared'

export type Testimonial = {
  id: number
  name: string
  role: string | null
  location: string | null
  event_type: string | null
  event_detail: string | null
  quote: string
  rating: number
  image_id: number | null
  sort_order: number
  status: Status
  created_at: string
  updated_at: string
}

export type TestimonialInput = Omit<Testimonial, 'id' | 'created_at' | 'updated_at'>

export async function listPublishedTestimonials(db: D1Database): Promise<(Testimonial & WithImage)[]> {
  const { results } = await db
    .prepare(
      `SELECT t.*, m.r2_key AS image_key, m.alt AS image_alt FROM testimonials t
       LEFT JOIN media m ON m.id = t.image_id
       WHERE t.status = 'published' ORDER BY t.sort_order, t.id DESC`,
    )
    .all<Testimonial & WithImage>()
  return results
}

export async function listTestimonials(db: D1Database): Promise<Testimonial[]> {
  const { results } = await db.prepare('SELECT * FROM testimonials ORDER BY sort_order, id DESC').all<Testimonial>()
  return results
}

export function getTestimonialById(db: D1Database, id: number): Promise<Testimonial | null> {
  return db.prepare('SELECT * FROM testimonials WHERE id = ?').bind(id).first<Testimonial>()
}

export async function createTestimonial(db: D1Database, t: TestimonialInput): Promise<number> {
  const row = await db
    .prepare(
      `INSERT INTO testimonials (name, role, location, event_type, event_detail, quote, rating, image_id, sort_order, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .bind(t.name, t.role, t.location, t.event_type, t.event_detail, t.quote, t.rating, t.image_id, t.sort_order, t.status)
    .first<{ id: number }>()
  return row!.id
}

export async function updateTestimonial(db: D1Database, id: number, t: TestimonialInput): Promise<boolean> {
  const r = await db
    .prepare(
      `UPDATE testimonials SET name = ?, role = ?, location = ?, event_type = ?, event_detail = ?, quote = ?, rating = ?, image_id = ?, sort_order = ?, status = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
       WHERE id = ?`,
    )
    .bind(t.name, t.role, t.location, t.event_type, t.event_detail, t.quote, t.rating, t.image_id, t.sort_order, t.status, id)
    .run()
  return changed(r)
}

export async function setTestimonialStatus(db: D1Database, id: number, status: Status): Promise<boolean> {
  const r = await db
    .prepare("UPDATE testimonials SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?")
    .bind(status, id)
    .run()
  return changed(r)
}

export async function deleteTestimonial(db: D1Database, id: number): Promise<boolean> {
  return changed(await db.prepare('DELETE FROM testimonials WHERE id = ?').bind(id).run())
}
