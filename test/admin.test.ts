import { env } from 'cloudflare:workers'
import { sign } from 'hono/jwt'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import app from '../src/index'
import { createBranch, getBranchById } from '../src/db/branches'
import { createCuisine, getCuisineById } from '../src/db/cuisines'
import { createEnquiry, getEnquiryById, type EnquiryInput } from '../src/db/enquiries'
import { createMedia, listMedia } from '../src/db/media'
import { createMenuItem } from '../src/db/menu_items'
import { listGroups } from '../src/db/package_groups'
import { createPackage, getPackageById, listPackages } from '../src/db/packages'
import { rmToSen } from '../src/lib/validation'

const db = env.DB
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAACgAAAAeCAIAAADRv8uKAAAALElEQVR4nO3NMQ0AAAgDsCnhxr8KZCEDjib9m6k+EbFYLBaLxWKxWCwW/40XH5zx3XTu5yYAAAAASUVORK5CYII='
const ORIGIN = 'http://localhost'
// Local dev bypass on (tests run against http://localhost).
const devEnv = { ...env, ADMIN_DEV_EMAIL: 'staff@example.com' } as Env

const get = (path: string, e: Env = devEnv) => app.request(path, {}, e)
const post = (path: string, body: URLSearchParams | FormData, headers: Record<string, string> = { Origin: ORIGIN }) =>
  app.request(path, { method: 'POST', body, headers }, devEnv)

let branchId: number
let cuisineId: number

beforeEach(async () => {
  await db.batch([
    db.prepare('DELETE FROM enquiries'),
    db.prepare('DELETE FROM package_groups'),
    db.prepare('DELETE FROM packages'),
    db.prepare('DELETE FROM menu_items'),
    db.prepare('DELETE FROM occasions'),
    db.prepare('DELETE FROM clients'),
    db.prepare('DELETE FROM gallery_items'),
    db.prepare('DELETE FROM testimonials'),
    db.prepare('DELETE FROM branches'),
    db.prepare('DELETE FROM cuisines'),
    db.prepare('DELETE FROM media'),
  ])
  branchId = await createBranch(db, { slug: 'shah-alam', name: 'Shah Alam', name_bm: null, address: null, phone: null, maps_link: null, has_hall: true, hall_capacity: 200, image_id: null, sort_order: 0, status: 'published' })
  cuisineId = await createCuisine(db, { slug: 'arab', name: 'Arab', name_bm: null, description: null, description_bm: null, image_id: null, sort_order: 0, status: 'published' })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('rmToSen', () => {
  it('converts RM text to integer sen without float error', () => {
    expect(rmToSen('35')).toBe(3500)
    expect(rmToSen('35.5')).toBe(3550)
    expect(rmToSen('0.29')).toBe(29)
    expect(rmToSen('1234.05')).toBe(123405)
  })
})

describe('Cloudflare Access', () => {
  const team = 'bedouin.cloudflareaccess.com'
  const aud = 'test-aud'
  const accessEnv = { ...env, ADMIN_DEV_EMAIL: '', ACCESS_TEAM_DOMAIN: team, ACCESS_AUD: aud } as unknown as Env

  const keys = async () => {
    const pair = (await crypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['sign', 'verify'],
    )) as CryptoKeyPair
    const pub = { ...((await crypto.subtle.exportKey('jwk', pair.publicKey)) as JsonWebKey), kid: 'k1', alg: 'RS256' }
    const priv = { ...((await crypto.subtle.exportKey('jwk', pair.privateKey)) as JsonWebKey), kid: 'k1', alg: 'RS256' }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ keys: [pub] }))
    return priv
  }
  const token = (priv: JsonWebKey, claims: Record<string, unknown> = {}) =>
    sign({ email: 'staff@example.com', aud, iss: `https://${team}`, exp: Math.floor(Date.now() / 1000) + 60, ...claims }, priv, 'RS256')
  const withToken = (jwt: string) => app.request('/admin/packages', { headers: { 'Cf-Access-Jwt-Assertion': jwt } }, accessEnv)

  it('answers 503 when Access is not configured, and never caches it', async () => {
    const res = await get('/admin/packages', { ...env, ADMIN_DEV_EMAIL: '', ACCESS_TEAM_DOMAIN: '', ACCESS_AUD: '' } as unknown as Env)
    expect(res.status).toBe(503)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('rejects a request without the Access JWT', async () => {
    expect((await app.request('/admin/packages', {}, accessEnv)).status).toBe(401)
  })

  it('accepts a valid Access JWT and shows the signed-in email', async () => {
    const res = await withToken(await token(await keys()))
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('Signed in as staff@example.com')
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(`https://${team}/cdn-cgi/access/certs`)
  })

  it('rejects wrong audience, wrong issuer and expired tokens', async () => {
    const priv = await keys()
    expect((await withToken(await token(priv, { aud: 'other-app' }))).status).toBe(401)
    expect((await withToken(await token(priv, { iss: 'https://evil.cloudflareaccess.com' }))).status).toBe(401)
    expect((await withToken(await token(priv, { exp: Math.floor(Date.now() / 1000) - 60 }))).status).toBe(401)
  })

  it('ignores the dev bypass on a real hostname', async () => {
    const e = { ...accessEnv, ADMIN_DEV_EMAIL: 'staff@example.com' } as Env
    expect((await app.request('https://bedouin.ssalam.co.uk/admin/packages', {}, e)).status).toBe(401)
  })
})

describe('admin pages', () => {
  it('uses the admin layout, not the public one, and is not cacheable', async () => {
    const res = await get('/admin/packages')
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    const html = await res.text()
    expect(html).toContain('admin-sidebar')
    expect(html).not.toContain('site-header')
  })

  it('rejects cross-site form posts (CSRF)', async () => {
    const res = await post('/admin/branches/new', new URLSearchParams({ name: 'X', slug: 'x', status: 'draft' }), { Origin: 'https://evil.example' })
    expect(res.status).toBe(403)
  })
})

describe('content editor', () => {
  const pkgForm = (over: Record<string, string> = {}) =>
    new URLSearchParams({
      name: 'Kambing Golek',
      slug: 'kambing-golek',
      cuisine_id: String(cuisineId),
      service_type: 'both',
      price_sen: '35.50',
      min_pax: '50',
      inclusions: 'Rice\n\n  Lamb  \nDrinks',
      description: '',
      is_popular: 'on',
      image_id: '',
      sort_order: '',
      status: 'published',
      ...over,
    })

  it('creates a package from the form', async () => {
    const res = await post('/admin/packages/new', pkgForm())
    expect(res.status).toBe(303)
    expect(res.headers.get('Location')).toBe('/admin/packages?saved=1')
    const [p] = await listPackages(db)
    expect(p).toMatchObject({ name: 'Kambing Golek', service_type: 'both', price_sen: 3550, min_pax: 50, max_pax: null, inclusions: ['Rice', 'Lamb', 'Drinks'], is_popular: true, description: null, sort_order: 0, status: 'published' })
  })

  it('rejects a maximum pax below the minimum', async () => {
    const res = await post('/admin/packages/new', pkgForm({ max_pax: '10' }))
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('at least the minimum pax')
    expect(await listPackages(db)).toHaveLength(0)
  })

  it('shows field errors and keeps the typed values', async () => {
    const res = await post('/admin/packages/new', pkgForm({ slug: 'Bad Slug', price_sen: '35.555' }))
    expect(res.status).toBe(400)
    const html = await res.text()
    expect(html).toContain('Use lowercase letters, numbers and hyphens only')
    expect(html).toContain('Please enter an amount like 35 or 35.50.')
    expect(html).toContain('value="Kambing Golek"')
    expect(await listPackages(db)).toHaveLength(0)
  })

  it('reports a slug that is already taken', async () => {
    await post('/admin/packages/new', pkgForm())
    const res = await post('/admin/packages/new', pkgForm({ name: 'Other' }))
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('This slug is already used.')
  })

  it('edits a package: loads current values, then saves a new status', async () => {
    await post('/admin/packages/new', pkgForm({ is_popular: '' }))
    const [{ id }] = await listPackages(db)

    const page = await (await get(`/admin/packages/${id}`)).text()
    expect(page).toContain('value="35.50"')
    expect(page).toContain('Rice\nLamb\nDrinks')

    // Unchecked checkbox: the field is not sent at all.
    const form = pkgForm({ status: 'hidden' })
    form.delete('is_popular')
    expect((await post(`/admin/packages/${id}`, form)).status).toBe(303)
    expect(await getPackageById(db, id)).toMatchObject({ status: 'hidden', is_popular: false })

    const list = await (await get('/admin/packages')).text()
    expect(list).toContain('status-pill--hidden')
  })

  it('404s when editing a missing row', async () => {
    expect((await get('/admin/branches/9999')).status).toBe(404)
    expect((await post('/admin/branches/9999', new URLSearchParams({ name: 'X', slug: 'x', status: 'draft' }))).status).toBe(404)
  })

  it('saves menu items with an optional price', async () => {
    const res = await post('/admin/menu/new', new URLSearchParams({ name: 'Hummus', cuisine_id: '', price_sen: '', status: 'draft' }))
    expect(res.status).toBe(303)
    const row = await db.prepare('SELECT * FROM menu_items').first()
    expect(row).toMatchObject({ name: 'Hummus', cuisine_id: null, price_sen: null, is_bestseller: 0, status: 'draft' })
  })
})

describe('cuisine editor', () => {
  const png = () => new File([Uint8Array.from(atob(PNG_B64), (ch) => ch.charCodeAt(0))], 'mandi.png', { type: 'image/png' })
  const form = (over: Record<string, string | File> = {}) => {
    const fd = new FormData()
    const fields = { name: 'Arab', name_bm: 'Arab (BM)', slug: 'arab', description: 'Rice', description_bm: 'Nasi', sort_order: '0', status: 'published', image_id: '', image_alt: '', image_file: new File([], ''), ...over }
    for (const [k, v] of Object.entries(fields)) fd.set(k, v)
    return fd
  }

  it('saves BM copy, uploads the image into the cuisines folder and links it', async () => {
    const res = await post(`/admin/cuisines/${cuisineId}`, form({ image_file: png(), image_alt: 'Lamb mandi platter' }))
    expect(res.status).toBe(303)
    const [m] = await listMedia(db)
    expect(m).toMatchObject({ folder: 'cuisines', alt: 'Lamb mandi platter' })
    expect(m.r2_key).toMatch(/^cuisines\/[0-9a-f-]{36}\.webp$/)
    expect(await getCuisineById(db, cuisineId)).toMatchObject({ name_bm: 'Arab (BM)', description_bm: 'Nasi', image_id: m.id })

    // The form shows the upload box and the library picker with this image chosen.
    const html = await (await get(`/admin/cuisines/${cuisineId}`)).text()
    expect(html).toContain('enctype="multipart/form-data"')
    expect(html).toMatch(new RegExp(`name="image_id" value="${m.id}" checked`))
  })

  it('picks an existing library image, or none, without uploading', async () => {
    const img = { content_type: 'image/webp', size_bytes: 1, width: null, height: null }
    const id = await createMedia(db, { ...img, r2_key: 'cuisines/x.webp', folder: 'cuisines', alt: 'Dates' })
    await createMedia(db, { ...img, r2_key: 'gallery/y.webp', folder: 'gallery', alt: 'Gallery only' })
    // Only images from the cuisines folder are offered.
    const html = await (await get(`/admin/cuisines/${cuisineId}`)).text()
    expect(html).toContain('Dates')
    expect(html).not.toContain('Gallery only')
    expect((await post(`/admin/cuisines/${cuisineId}`, form({ image_id: String(id) }))).status).toBe(303)
    expect((await getCuisineById(db, cuisineId))?.image_id).toBe(id)
    expect(await listMedia(db)).toHaveLength(2)

    expect((await post(`/admin/cuisines/${cuisineId}`, form({ name_bm: '' }))).status).toBe(303)
    expect(await getCuisineById(db, cuisineId)).toMatchObject({ image_id: null, name_bm: null })
  })

  it('requires alt text for an uploaded image and stores nothing', async () => {
    const res = await post(`/admin/cuisines/${cuisineId}`, form({ image_file: png(), image_alt: ' ' }))
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('Please describe the image')
    expect(await listMedia(db)).toHaveLength(0)
  })

  it('shows the BM name and description on the public site with ?lang=bm, English otherwise', async () => {
    await post(`/admin/cuisines/${cuisineId}`, form())
    await post('/admin/packages/new', new URLSearchParams({ name: 'Mandi', slug: 'mandi', cuisine_id: String(cuisineId), service_type: 'both', price_sen: '30', min_pax: '10', inclusions: '', status: 'published' }))
    const bm = await (await app.request('/packages?service=in_house&lang=bm', {}, env)).text()
    expect(bm).toContain('Arab (BM)')
    expect(bm).toContain('Nasi')
    const en = await (await app.request('/packages?service=in_house', {}, env)).text()
    expect(en).not.toContain('Arab (BM)')
    expect(await (await app.request('/packages?service=in_house&cuisine=arab&lang=bm', {}, env)).text()).toContain('Arab (BM)')
  })
})

describe('branch editor', () => {
  it('saves the BM name, uploads into the branches folder, offers only branch images, shows BM publicly', async () => {
    await createMedia(db, { r2_key: 'cuisines/x.webp', folder: 'cuisines', alt: 'Cuisine only', content_type: 'image/webp', size_bytes: 1, width: null, height: null })
    const fd = new FormData()
    const png = new File([Uint8Array.from(atob(PNG_B64), (ch) => ch.charCodeAt(0))], 'shop.png', { type: 'image/png' })
    const fields = { name: 'Shah Alam', name_bm: 'Cawangan Shah Alam', slug: 'shah-alam', address: '', phone: '', maps_link: 'https://maps.app.goo.gl/abc', has_hall: 'on', hall_capacity: '250', sort_order: '0', status: 'published', image_id: '', image_alt: 'Our Shah Alam kitchen', image_file: png }
    for (const [k, v] of Object.entries(fields)) fd.set(k, v)
    expect((await post(`/admin/branches/${branchId}`, fd)).status).toBe(303)

    const [m] = (await listMedia(db)).filter((x) => x.folder === 'branches')
    expect(m.r2_key).toMatch(/^branches\//)
    expect(await getBranchById(db, branchId)).toMatchObject({ name_bm: 'Cawangan Shah Alam', image_id: m.id, maps_link: 'https://maps.app.goo.gl/abc', has_hall: true, hall_capacity: 250 })

    const html = await (await get(`/admin/branches/${branchId}`)).text()
    expect(html).toContain('Our Shah Alam kitchen')
    expect(html).not.toContain('Cuisine only')

    // The branch is the venue on the details step of an in-house booking.
    await createPackage(db, { slug: 'p', cuisine_id: cuisineId, service_type: 'in_house', name: 'P', name_bm: null, description: null, description_bm: null, price_sen: 3000, min_pax: 10, max_pax: null, inclusions: [], inclusions_bm: [], is_popular: false, image_id: null, sort_order: 0, status: 'published' })
    const details = '/packages?service=in_house&cuisine=arab&package=p'
    expect(await (await app.request(`${details}&lang=bm`, {}, env)).text()).toContain('Cawangan Shah Alam (dewan sehingga 250 pax)')
    expect(await (await app.request(details, {}, env)).text()).not.toContain('Cawangan Shah Alam')
  })

  it('rejects a maps link that is not a web address', async () => {
    const res = await post(`/admin/branches/${branchId}`, new URLSearchParams({ name: 'Shah Alam', slug: 'shah-alam', maps_link: 'javascript:alert(1)', status: 'published' }))
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('starting with https://')
  })
})

describe('occasion editor', () => {
  it('saves BM copy, uploads into the occasions folder, offers only occasion images, shows BM publicly', async () => {
    await createMedia(db, { r2_key: 'branches/x.webp', folder: 'branches', alt: 'Branch only', content_type: 'image/webp', size_bytes: 1, width: null, height: null })
    const fd = new FormData()
    const png = new File([Uint8Array.from(atob(PNG_B64), (ch) => ch.charCodeAt(0))], 'w.png', { type: 'image/png' })
    const fields = { name: 'Wedding', name_bm: 'Perkahwinan', slug: 'wedding', description: 'Big day', description_bm: 'Hari besar', sort_order: '0', status: 'published', image_id: '', image_alt: 'Wedding buffet table', image_file: png }
    for (const [k, v] of Object.entries(fields)) fd.set(k, v)
    expect((await post('/admin/occasions/new', fd)).status).toBe(303)

    const [m] = (await listMedia(db)).filter((x) => x.folder === 'occasions')
    expect(m.r2_key).toMatch(/^occasions\//)
    const row = await db.prepare('SELECT * FROM occasions').first()
    expect(row).toMatchObject({ name_bm: 'Perkahwinan', description_bm: 'Hari besar', image_id: m.id })

    const html = await (await get(`/admin/occasions/${row!.id}`)).text()
    expect(html).toContain('Wedding buffet table')
    expect(html).not.toContain('Branch only')

    const bm = await (await app.request('/occasions?lang=bm', {}, env)).text()
    expect(bm).toContain('Perkahwinan')
    expect(bm).toContain('Hari besar')
    expect(await (await app.request('/?lang=bm', {}, env)).text()).toContain('Perkahwinan')
    expect(await (await app.request('/occasions', {}, env)).text()).not.toContain('Perkahwinan')
  })
})

describe('gallery editor', () => {
  it('offers only event gallery folder images in the picker', async () => {
    await createMedia(db, { r2_key: 'gallery/g.webp', folder: 'gallery', alt: 'Gallery photo', content_type: 'image/webp', size_bytes: 1, width: null, height: null })
    await createMedia(db, { r2_key: 'clients/c.webp', folder: 'clients', alt: 'Client logo', content_type: 'image/webp', size_bytes: 1, width: null, height: null })
    const html = await (await app.request('/admin/gallery/new', {}, devEnv)).text()
    expect(html).toContain('Gallery photo')
    expect(html).not.toContain('Client logo')
  })

  it('requires a photo, uploads into the gallery folder, shows the card on home and /gallery', async () => {
    const fd = new FormData()
    for (const [k, v] of Object.entries({ name: 'Garden Wedding', event_type: 'Weddings', caption: 'Shah Alam · 600 pax', is_tall: 'on', sort_order: '0', status: 'published', image_id: '', image_alt: '' })) fd.set(k, v)
    expect((await post('/admin/gallery/new', fd)).status).toBe(400)

    fd.set('image_file', new File([Uint8Array.from(atob(PNG_B64), (ch) => ch.charCodeAt(0))], 'w.png', { type: 'image/png' }))
    fd.set('image_alt', 'Long banquet tables under fairy lights')
    expect((await post('/admin/gallery/new', fd)).status).toBe(303)

    const [m] = (await listMedia(db)).filter((x) => x.folder === 'gallery')
    expect(m.r2_key).toMatch(/^gallery\//)
    expect(await db.prepare('SELECT * FROM gallery_items').first()).toMatchObject({ name: 'Garden Wedding', event_type: 'Weddings', is_tall: 1, image_id: m.id })

    for (const path of ['/', '/gallery']) {
      const html = await (await app.request(path, {}, env)).text()
      expect(html).toContain('alt="Long banquet tables under fairy lights"')
      expect(html).toContain('gallery-card gallery-card--tall')
      expect(html).toContain('Shah Alam · 600 pax')
    }
  })
})

describe('client editor', () => {
  it('requires a logo, uploads into the clients folder, shows the logo with its alt text publicly', async () => {
    const fd = new FormData()
    for (const [k, v] of Object.entries({ name: 'Petronas', sort_order: '0', status: 'published', image_id: '', image_alt: '' })) fd.set(k, v)
    expect((await post('/admin/clients/new', fd)).status).toBe(400)

    fd.set('image_file', new File([Uint8Array.from(atob(PNG_B64), (ch) => ch.charCodeAt(0))], 'logo.png', { type: 'image/png' }))
    fd.set('image_alt', 'Petronas logo')
    expect((await post('/admin/clients/new', fd)).status).toBe(303)

    const [m] = (await listMedia(db)).filter((x) => x.folder === 'clients')
    expect(m.r2_key).toMatch(/^clients\//)
    expect(await db.prepare('SELECT * FROM clients').first()).toMatchObject({ name: 'Petronas', image_id: m.id })

    const html = await (await app.request('/clients', {}, env)).text()
    expect(html).toContain('alt="Petronas logo"')
    expect(html).toContain(`/img/thumb/${m.r2_key}`)
  })
})

describe('testimonial editor', () => {
  it('needs a quote and a 1-5 rating, uploads the photo into testimonials, shows it on home', async () => {
    const fd = new FormData()
    for (const [k, v] of Object.entries({ name: 'Aisyah', quote: '', rating: '6', sort_order: '0', status: 'published', image_id: '', image_alt: '' })) fd.set(k, v)
    expect((await post('/admin/testimonials/new', fd)).status).toBe(400)

    fd.set('quote', 'Best mandi in town')
    fd.set('rating', '5')
    fd.set('image_file', new File([Uint8Array.from(atob(PNG_B64), (ch) => ch.charCodeAt(0))], 'me.png', { type: 'image/png' }))
    fd.set('image_alt', 'Aisyah smiling')
    fd.set('role', 'Bride')
    fd.set('location', 'Shah Alam')
    fd.set('event_type', 'Wedding')
    fd.set('event_detail', 'Reception · 600 guests')
    expect((await post('/admin/testimonials/new', fd)).status).toBe(303)

    const [m] = (await listMedia(db)).filter((x) => x.folder === 'testimonials')
    expect(m.r2_key).toMatch(/^testimonials\//)
    expect(await db.prepare('SELECT * FROM testimonials').first()).toMatchObject({ name: 'Aisyah', role: 'Bride', location: 'Shah Alam', event_type: 'Wedding', event_detail: 'Reception · 600 guests', quote: 'Best mandi in town', rating: 5, image_id: m.id })

    const html = await (await app.request('/', {}, env)).text()
    expect(html).toContain('Best mandi in town')
    expect(html).toContain('alt="Aisyah smiling"')
    expect(html).toContain(`/img/thumb/${m.r2_key}`)
  })
})

describe('menu item editor', () => {
  it('saves BM copy, uploads into the menu folder, offers only menu images, shows BM publicly', async () => {
    await createMedia(db, { r2_key: 'gallery/x.webp', folder: 'gallery', alt: 'Gallery only', content_type: 'image/webp', size_bytes: 1, width: null, height: null })
    const fd = new FormData()
    const png = new File([Uint8Array.from(atob(PNG_B64), (ch) => ch.charCodeAt(0))], 'h.png', { type: 'image/png' })
    const fields = { name: 'Hummus', name_bm: 'Humus', cuisine_id: '', category: '', price_sen: '', description: 'Chickpea dip', description_bm: 'Celup kacang kuda', sort_order: '0', status: 'published', image_id: '', image_alt: 'Bowl of hummus', image_file: png }
    for (const [k, v] of Object.entries(fields)) fd.set(k, v)
    expect((await post('/admin/menu/new', fd)).status).toBe(303)

    const [m] = (await listMedia(db)).filter((x) => x.folder === 'menu')
    expect(m.r2_key).toMatch(/^menu\//)
    const row = await db.prepare('SELECT * FROM menu_items').first()
    expect(row).toMatchObject({ name_bm: 'Humus', description_bm: 'Celup kacang kuda', image_id: m.id })

    const html = await (await get(`/admin/menu/${row!.id}`)).text()
    expect(html).toContain('Bowl of hummus')
    expect(html).not.toContain('Gallery only')

    const bm = await (await app.request('/menu?lang=bm', {}, env)).text()
    expect(bm).toContain('Celup kacang kuda')
    expect(await (await app.request('/menu', {}, env)).text()).not.toContain('Celup kacang kuda')
  })
})

describe('package editor', () => {
  it('saves BM copy, uploads into the packages folder, shows BM name and inclusions publicly', async () => {
    const fd = new FormData()
    const png = new File([Uint8Array.from(atob(PNG_B64), (ch) => ch.charCodeAt(0))], 'p.png', { type: 'image/png' })
    const fields = {
      name: 'Kambing Golek', name_bm: 'Kambing Golek Istimewa', slug: 'kg', cuisine_id: String(cuisineId), service_type: 'outside',
      price_sen: '35', min_pax: '50', inclusions: 'Rice\nDrinks', inclusions_bm: 'Nasi\nMinuman', description: '', description_bm: '',
      sort_order: '0', status: 'published', image_id: '', image_alt: 'Whole roasted lamb', image_file: png,
    }
    for (const [k, v] of Object.entries(fields)) fd.set(k, v)
    expect((await post('/admin/packages/new', fd)).status).toBe(303)

    const [p] = await listPackages(db)
    const [m] = await listMedia(db)
    expect(m).toMatchObject({ folder: 'packages', alt: 'Whole roasted lamb' })
    expect(p).toMatchObject({ name_bm: 'Kambing Golek Istimewa', inclusions_bm: ['Nasi', 'Minuman'], image_id: m.id })

    const bm = await (await app.request('/packages?service=outside&cuisine=arab&lang=bm', {}, env)).text()
    expect(bm).toContain('Kambing Golek Istimewa')
    expect(bm).toContain('Minuman')
    const en = await (await app.request('/packages?service=outside&cuisine=arab', {}, env)).text()
    expect(en).not.toContain('Istimewa')
    expect(en).toContain('Drinks')
  })
})

describe('package groups editor', () => {
  it('creates, edits and deletes a group with dishes of the package cuisine only', async () => {
    const id = await createPackage(db, { slug: 'kg', cuisine_id: cuisineId, service_type: 'both', name: 'KG', name_bm: null, description: null, description_bm: null, price_sen: 3000, min_pax: 10, max_pax: null, inclusions: [], inclusions_bm: [], is_popular: false, image_id: null, sort_order: 0, status: 'published' })
    const item = { name_bm: null, description: null, description_bm: null, category: null, price_sen: null, is_bestseller: false, image_id: null, sort_order: 0, status: 'published' as const }
    const lamb = await createMenuItem(db, { ...item, cuisine_id: cuisineId, name: 'Lamb Mandi' })
    const chicken = await createMenuItem(db, { ...item, cuisine_id: cuisineId, name: 'Chicken Kabsa' })
    const other = await createMenuItem(db, { ...item, cuisine_id: null, name: 'Teh Tarik' })
    const base = `/admin/packages/${id}/groups`

    expect(await (await get(`/admin/packages/${id}`)).text()).toContain(`href="${base}"`)
    const form = await (await get(`${base}/new`)).text()
    expect(form).toContain('Lamb Mandi')
    expect(form).not.toContain('Teh Tarik')

    const body = (over: Record<string, string> = {}, items = [lamb, chicken]) => {
      const f = new URLSearchParams({ name: 'Mains', choose_count: '1', sort_order: '0', ...over })
      for (const i of items) f.append('items', String(i))
      return f
    }
    // Fewer dishes than the customer must choose, or a dish from another cuisine.
    expect((await post(`${base}/new`, body({ choose_count: '3' }))).status).toBe(400)
    expect((await post(`${base}/new`, body({}, [lamb, other]))).status).toBe(400)

    expect((await post(`${base}/new`, body())).status).toBe(303)
    const [g] = await listGroups(db, id)
    expect(g).toMatchObject({ name: 'Mains', choose_count: 1 })
    expect(g!.items.map((i) => i.id).sort()).toEqual([lamb, chicken].sort())

    expect((await post(`${base}/${g!.id}`, body({ name: 'Main course' }, [lamb]))).status).toBe(303)
    expect((await listGroups(db, id))[0]).toMatchObject({ name: 'Main course', items: [expect.objectContaining({ id: lamb })] })

    // A group is only reachable under its own package.
    expect((await get(`/admin/packages/999/groups/${g!.id}`)).status).toBe(404)

    expect((await post(`${base}/${g!.id}/delete`, new URLSearchParams())).status).toBe(303)
    expect(await listGroups(db, id)).toEqual([])
  })
})

describe('enquiries', () => {
  const input = (over: Partial<EnquiryInput> = {}): EnquiryInput => ({
    name: 'Aisha', phone: '+60 12-345 6789', email: null, service_type: 'in_house', event_date: null, event_time: '19:00', pax: 80,
    branch_id: branchId, cuisine_id: null, package_id: null, menu_choices: null, address_line: null, postcode: null, city: null,
    state: null, setup_notes: null, message: 'Hi', estimate_sen: 280000, ...over,
  })

  it('lists enquiries by status and updates status and notes', async () => {
    const id = await createEnquiry(db, input())

    const html = await (await get('/admin/enquiries?status=new')).text()
    expect(html).toContain('Aisha')
    expect(html).toContain('href="tel:+60123456789"')
    expect(html).toContain(`href="/admin/enquiries/${id}"`)
    expect(html).toContain('At branch')
    expect(html).not.toContain('Shah Alam')

    const detail = await (await get(`/admin/enquiries/${id}`)).text()
    expect(detail).toContain('Shah Alam')
    expect(detail).toContain('80 pax')
    expect(detail).toContain('RM 2,800')
    expect(detail).toContain(`action="/admin/enquiries/${id}"`)
    expect(detail).not.toContain('name="delivery_fee_sen"')
    expect((await get('/admin/enquiries/999999')).status).toBe(404)

    const res = await post(`/admin/enquiries/${id}`, new URLSearchParams({ status: 'quoted', branch_id: String(branchId), admin_notes: 'Sent quote' }))
    expect(res.status).toBe(303)
    expect(res.headers.get('Location')).toBe(`/admin/enquiries/${id}?saved=1`)
    expect(await getEnquiryById(db, id)).toMatchObject({ status: 'quoted', admin_notes: 'Sent quote', branch_id: branchId })

    expect(await (await get('/admin/enquiries?status=new')).text()).not.toContain('Aisha')
  })

  it('lets staff assign a branch and delivery fee to outside catering', async () => {
    const id = await createEnquiry(db, input({ service_type: 'outside', branch_id: null, address_line: '12 Jalan Mawar', postcode: '40150', city: 'Shah Alam' }))
    expect(await (await get(`/admin/enquiries/${id}`)).text()).toContain('delivery fee (not set)')
    await post(`/admin/enquiries/${id}`, new URLSearchParams({ status: 'quoted', branch_id: String(branchId), delivery_fee_sen: '150' }))
    expect(await getEnquiryById(db, id)).toMatchObject({ branch_id: branchId, delivery_fee_sen: 15000 })
    expect(await (await get(`/admin/enquiries/${id}`)).text()).toContain('+ RM 150 delivery = RM 2,950')
  })

  it('ignores a delivery fee on an in-house enquiry', async () => {
    const id = await createEnquiry(db, input())
    await post(`/admin/enquiries/${id}`, new URLSearchParams({ status: 'new', delivery_fee_sen: '99' }))
    expect((await getEnquiryById(db, id))?.delivery_fee_sen).toBeNull()
  })

  it('needs a reason to decline, and rejects an unknown status', async () => {
    const id = await createEnquiry(db, input())
    const res = await post(`/admin/enquiries/${id}`, new URLSearchParams({ status: 'declined', decline_reason: ' ' }))
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('Please give a reason when declining.')
    expect((await post(`/admin/enquiries/${id}`, new URLSearchParams({ status: 'deleted' }))).status).toBe(400)

    await post(`/admin/enquiries/${id}`, new URLSearchParams({ status: 'declined', decline_reason: 'Fully booked' }))
    expect(await getEnquiryById(db, id)).toMatchObject({ status: 'declined', decline_reason: 'Fully booked' })
  })
})

describe('image upload', () => {
  const upload = (fields: Record<string, string>, file: File, e: Env = devEnv) => {
    const fd = new FormData()
    for (const [k, v] of Object.entries(fields)) fd.set(k, v)
    fd.set('file', file)
    return app.request('/admin/media', { method: 'POST', body: fd, headers: { Origin: ORIGIN } }, e)
  }
  // A real 40x30 PNG, so the local Images binding can decode it.
  const png = new File([Uint8Array.from(atob(PNG_B64), (ch) => ch.charCodeAt(0))], 'mandi.png', { type: 'image/png' })
  const throwingImages = (code: number) =>
    ({ input: () => { throw Object.assign(new Error(`IMAGES_TRANSFORM_ERROR ${code}`), { code }) } }) as unknown as ImagesBinding

  it('stores only a WebP copy in R2 and the row with its alt text', async () => {
    const res = await upload({ folder: 'menu', alt: 'Lamb mandi on a platter' }, png)
    expect(res.status).toBe(303)
    const [m] = await listMedia(db)
    expect(m).toMatchObject({ folder: 'menu', alt: 'Lamb mandi on a platter', content_type: 'image/webp' })
    expect(m.r2_key).toMatch(/^menu\/[0-9a-f-]{36}\.webp$/)
    const obj = await env.MEDIA.get(m.r2_key)
    expect(obj?.httpMetadata?.contentType).toBe('image/webp')
    const bytes = new Uint8Array(await obj!.arrayBuffer())
    expect(m.size_bytes).toBe(bytes.length)
    expect(new TextDecoder().decode(bytes.slice(8, 12))).toBe('WEBP')

    // The image shows up in the menu form's picker (its folder), not in other sections.
    expect(await (await get('/admin/menu/new')).text()).toContain('Lamb mandi on a platter')
    expect(await (await get('/admin/packages/new')).text()).not.toContain('Lamb mandi on a platter')
  })

  it('requires alt text and an allowed image type', async () => {
    const noAlt = await upload({ folder: 'menu', alt: '  ' }, png)
    expect(noAlt.status).toBe(400)
    expect(await noAlt.text()).toContain('Please describe the image')

    const svg = await upload({ folder: 'menu', alt: 'Logo' }, new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' }))
    expect(svg.status).toBe(400)
    const avif = await upload({ folder: 'menu', alt: 'Dish' }, new File(['x'], 'x.avif', { type: 'image/avif' }))
    expect(avif.status).toBe(400)
    const big = await upload({ folder: 'menu', alt: 'Dish' }, new File([new Uint8Array(15 * 1024 * 1024 + 1)], 'x.png', { type: 'image/png' }))
    expect(big.status).toBe(400)
    expect(await listMedia(db)).toHaveLength(0)
  })

  it('stores nothing and explains when the Images binding fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const limit = await upload({ folder: 'menu', alt: 'Dish photo' }, png, { ...devEnv, IMAGES: throwingImages(9422) })
    expect(limit.status).toBe(503)
    expect(await limit.text()).toContain('Image processing is temporarily unavailable')

    const bad = await upload({ folder: 'menu', alt: 'Dish photo' }, png, { ...devEnv, IMAGES: throwingImages(9412) })
    expect(bad.status).toBe(422)
    expect(await bad.text()).toContain('could not be read as an image')

    expect(await listMedia(db)).toHaveLength(0)
    expect((await env.MEDIA.list({ prefix: 'menu/' })).objects.filter((o) => o.key.endsWith('.png'))).toHaveLength(0)
  })
})
