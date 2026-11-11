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
    db.prepare('DELETE FROM clients'),
    db.prepare('DELETE FROM gallery_items'),
    db.prepare("DELETE FROM media WHERE r2_key LIKE 'gallery/%'"),
    db.prepare("INSERT INTO occasions (slug, name, status) VALUES ('weddings', 'Weddings', 'published'), ('secret', 'Secret Party', 'draft')"),
    db.prepare(
      "INSERT INTO testimonials (name, event_type, quote, rating, status) VALUES ('Aisyah', 'Wedding', 'Lovely food', 4, 'published'), ('Hidden', NULL, 'Draft quote', 5, 'draft')",
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
    expect(html).toContain('4 out of 5 stars') // average of published ratings
    expect(html).not.toContain('Secret Party')
    expect(html).not.toContain('Draft quote')
  })

  it('shows testimonials as a list plus one quote panel, switchable via ?t= without JS', async () => {
    await db.prepare("INSERT INTO testimonials (name, role, location, event_type, event_detail, quote, rating, status) VALUES ('Daniel Lim', 'HR Manager', 'Petaling Jaya', 'Corporate', 'Annual dinner · 300 guests', 'Great service', 5, 'published')").run()
    const html = await (await app.request('/', {}, env)).text()
    const section = html.slice(html.indexOf('class="section testimonials"'), html.indexOf('class="section team"'))
    expect(html.indexOf('cta-band')).toBeLessThan(html.indexOf('class="section testimonials"'))
    expect(section).toContain('4.5') // average rating
    expect(section).toContain('>DL</span>') // initials when no photo
    expect(section).toContain('/js/testimonials.js')
    expect(section).toContain('HR Manager · Petaling Jaya')
    expect(section).toContain('<span class="testimonials__pill">Corporate</span>')
    expect(section).toMatch(/<span class="testimonials__tag">Corporate<\/span>Annual dinner · 300 guests/)
    // Both quotes rendered; only the first is visible and current.
    expect(section.match(/class="testimonials__slide"( hidden="")?/g)).toEqual(['class="testimonials__slide"', 'class="testimonials__slide" hidden=""'])
    expect(section.match(/aria-current="true"/g)?.length).toBe(1)
    expect(section).toContain('01 / 02')

    const second = await (await app.request('/?t=1', {}, env)).text()
    expect(second).toMatch(/class="testimonials__slide" hidden="">.*Lovely food/s)
    expect(second).toContain('02 / 02')
    expect((await (await app.request('/?t=99', {}, env)).text())).toContain('01 / 02') // out of range falls back
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

describe('our clients', () => {
  it('shows 8 published logos on home, all of them on /clients, and links to /clients in nav and footer', async () => {
    const media = await db
      .prepare("INSERT INTO media (r2_key, folder, alt, content_type, size_bytes) VALUES ('clients/x.webp', 'clients', 'Client logo', 'image/webp', 1) RETURNING id")
      .first<{ id: number }>()
    await db.batch([
      ...Array.from({ length: 10 }, (_, i) =>
        db.prepare("INSERT INTO clients (name, image_id, sort_order, status) VALUES (?, ?, ?, 'published')").bind(`C${i}`, media!.id, i),
      ),
      db.prepare("INSERT INTO clients (name, image_id, status) VALUES ('Draft Co', ?, 'draft')").bind(media!.id),
      db.prepare("INSERT INTO clients (name, status) VALUES ('No Logo Co', 'published')"),
    ])
    const count = (html: string) => html.match(/clients\/x\.webp/g)?.length ?? 0

    const home = await (await app.request('/', {}, env)).text()
    expect(count(home)).toBe(8)
    expect(home.indexOf('Our Clients')).toBeLessThan(home.indexOf('occasion-strip'))
    expect(home.match(/href="\/clients"/g)?.length).toBe(4) // desktop + mobile nav, footer, "See all"
    expect(count(await (await app.request('/clients', {}, env)).text())).toBe(10)
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

  it('shows the event gallery above clients, filtered by ?event= with counts from all items', async () => {
    const { meta } = await db
      .prepare("INSERT INTO media (r2_key, folder, alt, content_type, size_bytes) VALUES ('gallery/a.webp', 'gallery', 'Buffet line', 'image/webp', 1)")
      .run()
    const img = meta.last_row_id
    await db.batch([
      db.prepare("INSERT INTO gallery_items (name, event_type, image_id, status) VALUES ('Garden Wedding', 'Weddings', ?1, 'published'), ('Annual Dinner', 'Corporate', ?1, 'published'), ('Draft Party', 'Birthdays', ?1, 'draft'), ('No Photo', 'Birthdays', NULL, 'published')").bind(img),
      db.prepare("INSERT INTO clients (name, image_id, status) VALUES ('Acme', ?, 'published')").bind(img),
    ])

    const html = await (await app.request('/', {}, env)).text()
    expect(html.indexOf('id="gallery"')).toBeGreaterThan(-1)
    expect(html.indexOf('id="gallery"')).toBeLessThan(html.indexOf('class="section clients"'))
    expect(html).toContain('Garden Wedding')
    expect(html).toContain('Annual Dinner')
    expect(html).not.toContain('Draft Party')
    expect(html).not.toContain('No Photo')

    const filtered = await (await app.request('/?event=Corporate', {}, env)).text()
    expect(filtered).not.toContain('Garden Wedding')
    expect(filtered).toContain('Annual Dinner')
    expect(html.match(/href="\/gallery"/g)?.length).toBe(4) // desktop + mobile nav, footer, "View Full Gallery"
    expect(filtered).toMatch(/aria-current="page">Corporate <span class="gallery-chip__count">\(1\)/)
    expect(filtered).toMatch(/All <span class="gallery-chip__count">\(2\)/)
  })
})
