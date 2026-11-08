import { changed, type Status } from './shared'

export type Testimonial = {
  id: number
  customer_name: string
  event_type: string | null
  quote: string
  rating: number
  sort_order: number
  status: Status
  created_at: string
  updated_at: string
}

export type TestimonialInput = Omit<Testimonial, 'id' | 'created_at' | 'updated_at'>

export async function listPublishedTestimonials(db: D1Database): Promise<Testimonial[]> {
  const { results } = await db
    .prepare("SELECT * FROM testimonials WHERE status = 'published' ORDER BY sort_order, id DESC")
    .all<Testimonial>()
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
      `INSERT INTO testimonials (customer_name, event_type, quote, rating, sort_order, status)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .bind(t.customer_name, t.event_type, t.quote, t.rating, t.sort_order, t.status)
    .first<{ id: number }>()
  return row!.id
}

export async function updateTestimonial(db: D1Database, id: number, t: TestimonialInput): Promise<boolean> {
  const r = await db
    .prepare(
      `UPDATE testimonials SET customer_name = ?, event_type = ?, quote = ?, rating = ?, sort_order = ?, status = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
       WHERE id = ?`,
    )
    .bind(t.customer_name, t.event_type, t.quote, t.rating, t.sort_order, t.status, id)
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
