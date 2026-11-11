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

  it('renders the hero video with silent-autoplay attributes and no native controls', async () => {
    const html = await (await app.request('/', {}, env)).text()
    const tag = html.match(/<video[^>]*>/)?.[0] ?? ''
    for (const attr of ['autoplay', 'muted', 'loop', 'playsinline']) expect(tag).toMatch(new RegExp(` ${attr}=""`))
    expect(tag).not.toMatch(/ controls/)
  })
})

describe('card photos', () => {
  it('renders the package image with its alt text, and a placeholder without one', async () => {
    const media = await db
      .prepare("INSERT INTO media (r2_key, folder, alt, content_type, size_bytes) VALUES ('packages/x.webp', 'packages', 'Lamb mandi on rice', 'image/webp', 1) RETURNING id")
      .first<{ id: number }>()
    await db.batch([
      db.prepare("INSERT INTO branches (id, slug, name, status) VALUES (1, 'kl', 'KL', 'published')"),
      db.prepare("INSERT INTO cuisines (id, slug, name, status) VALUES (1, 'arab', 'Arab', 'published')"),
      db
        .prepare("INSERT INTO packages (slug, branch_id, cuisine_id, name, price_sen, min_pax, inclusions, image_id, status) VALUES ('p1', 1, 1, 'With Photo', 3500, 50, '[]', ?, 'published'), ('p2', 1, 1, 'No Photo', 3500, 50, '[]', NULL, 'published')")
        .bind(media!.id),
    ])
    const html = await (await app.request('/packages?branch=kl&cuisine=arab', {}, env)).text()
    expect(html).toContain('src="/img/card/packages/x.webp"')
    expect(html).toContain('alt="Lamb mandi on rice"')
    expect(html).toContain('<span class="card__photo" aria-hidden="true"></span>')
    await db.prepare('DELETE FROM media').run()
  })
})
