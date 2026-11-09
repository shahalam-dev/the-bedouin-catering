import { env } from 'cloudflare:workers'
import { sign } from 'hono/jwt'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import app from '../src/index'
import { createBranch } from '../src/db/branches'
import { createCuisine } from '../src/db/cuisines'
import { createEnquiry, getEnquiryById } from '../src/db/enquiries'
import { listMedia } from '../src/db/media'
import { getPackageById, listPackages } from '../src/db/packages'
import { rmToSen } from '../src/lib/validation'

const db = env.DB
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
    db.prepare('DELETE FROM packages'),
    db.prepare('DELETE FROM menu_items'),
    db.prepare('DELETE FROM branches'),
    db.prepare('DELETE FROM cuisines'),
    db.prepare('DELETE FROM media'),
  ])
  branchId = await createBranch(db, { slug: 'shah-alam', name: 'Shah Alam', address: null, phone: null, image_id: null, sort_order: 0, status: 'published' })
  cuisineId = await createCuisine(db, { slug: 'arab', name: 'Arab', description: null, image_id: null, sort_order: 0, status: 'published' })
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
      branch_id: String(branchId),
      cuisine_id: String(cuisineId),
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
    expect(p).toMatchObject({ name: 'Kambing Golek', price_sen: 3550, min_pax: 50, inclusions: ['Rice', 'Lamb', 'Drinks'], is_popular: true, description: null, sort_order: 0, status: 'published' })
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

describe('enquiries', () => {
  it('lists enquiries by status and updates a status', async () => {
    const id = await createEnquiry(db, { name: 'Aisha', phone: '+60 12-345 6789', email: null, event_date: null, pax: 80, branch_id: branchId, cuisine_id: null, package_id: null, message: 'Hi' })

    const html = await (await get('/admin/enquiries?status=new')).text()
    expect(html).toContain('Aisha')
    expect(html).toContain('Shah Alam')
    expect(html).toContain('href="tel:+60123456789"')

    const res = await post(`/admin/enquiries/${id}/status`, new URLSearchParams({ status: 'contacted', filter: 'new' }))
    expect(res.status).toBe(303)
    expect(res.headers.get('Location')).toBe('/admin/enquiries?status=new')
    expect((await getEnquiryById(db, id))?.status).toBe('contacted')

    expect(await (await get('/admin/enquiries?status=new')).text()).not.toContain('Aisha')
  })

  it('rejects an unknown status', async () => {
    const id = await createEnquiry(db, { name: 'A', phone: '+60123456789', email: null, event_date: null, pax: null, branch_id: null, cuisine_id: null, package_id: null, message: null })
    expect((await post(`/admin/enquiries/${id}/status`, new URLSearchParams({ status: 'deleted' }))).status).toBe(400)
  })
})

describe('image upload', () => {
  const upload = (fields: Record<string, string>, file: File) => {
    const fd = new FormData()
    for (const [k, v] of Object.entries(fields)) fd.set(k, v)
    fd.set('file', file)
    return post('/admin/media', fd)
  }
  const jpeg = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'mandi.jpg', { type: 'image/jpeg' })

  it('stores the file in R2 and the row with its alt text', async () => {
    const res = await upload({ folder: 'menu', alt: 'Lamb mandi on a platter' }, jpeg)
    expect(res.status).toBe(303)
    const [m] = await listMedia(db)
    expect(m).toMatchObject({ folder: 'menu', alt: 'Lamb mandi on a platter', content_type: 'image/jpeg', size_bytes: 3 })
    expect(m.r2_key).toMatch(/^menu\/[0-9a-f-]{36}\.jpg$/)
    const obj = await env.MEDIA.get(m.r2_key)
    expect(obj?.httpMetadata?.contentType).toBe('image/jpeg')

    // The image shows up in the package form's image picker.
    expect(await (await get('/admin/packages/new')).text()).toContain('Lamb mandi on a platter (Menu)')
  })

  it('requires alt text and an allowed image type', async () => {
    const noAlt = await upload({ folder: 'menu', alt: '  ' }, jpeg)
    expect(noAlt.status).toBe(400)
    expect(await noAlt.text()).toContain('Please describe the image')

    const svg = await upload({ folder: 'menu', alt: 'Logo' }, new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' }))
    expect(svg.status).toBe(400)
    expect(await listMedia(db)).toHaveLength(0)
  })
})
