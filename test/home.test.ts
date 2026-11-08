import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, it } from 'vitest'
import app from '../src/index'

const db = env.DB

beforeEach(async () => {
  await db.batch([
    db.prepare('DELETE FROM enquiries'),
    db.prepare('DELETE FROM packages'),
    db.prepare('DELETE FROM branches'),
    db.prepare('DELETE FROM cuisines'),
    db.prepare('DELETE FROM occasions'),
    db.prepare('DELETE FROM testimonials'),
    db.prepare("INSERT INTO occasions (slug, name, status) VALUES ('weddings', 'Weddings', 'published'), ('secret', 'Secret Party', 'draft')"),
    db.prepare(
      "INSERT INTO testimonials (customer_name, event_type, quote, rating, status) VALUES ('Aisyah', 'Wedding', 'Lovely food', 4, 'published'), ('Hidden', NULL, 'Draft quote', 5, 'draft')",
    ),
  ])
})

describe('home page', () => {
  it('shows only published occasions and testimonials', async () => {
    const res = await app.request('/', {}, env)
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('Weddings')
    expect(html).toContain('Lovely food')
    expect(html).toContain('4 out of 5 stars')
    expect(html).not.toContain('Secret Party')
    expect(html).not.toContain('Draft quote')
  })

  it('renders BM strings and hides empty sections', async () => {
    await db.prepare('DELETE FROM testimonials').run()
    const html = await (await app.request('/?lang=bm', {}, env)).text()
    expect(html).toContain('Jamuan yang Dikenang')
    expect(html).not.toContain('Kata Pelanggan Kami')
  })
})
