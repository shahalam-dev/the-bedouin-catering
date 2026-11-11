import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import app from '../src/index'
import { createBranch } from '../src/db/branches'
import { createCuisine } from '../src/db/cuisines'
import { createEnquiry, getEnquiryById, listEnquiries } from '../src/db/enquiries'
import { createPackage } from '../src/db/packages'
import { enquiryAlert, notifyEnquiry } from '../src/lib/email'
import { formatRM } from '../src/lib/format'
import { enquirySchema, todayInMalaysia } from '../src/lib/validation'


const db = env.DB
// NOTIFY_TO stays empty here, so route tests skip the alert.
const testEnv = { ...env, TURNSTILE_SECRET: 'test-secret', NOTIFY_TO: '' }
const mailEnv = (send: (...a: unknown[]) => unknown) => ({ ...env, NOTIFY_TO: 'staff@gmail.com', EMAIL: { send } as unknown as SendEmail })

let packageId: number
let draftPackageId: number

// Stub Turnstile's siteverify; nothing else in these tests calls fetch.
const siteverify = (success: boolean) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ success }))

// Waits for waitUntil() work (the email alert) so tests can check its effects.
const post = async (fields: Record<string, string>, query = '', e: Env = testEnv) => {
  const ctx = createExecutionContext()
  const res = await app.request(`/api/enquiries${query}`, { method: 'POST', body: new URLSearchParams(fields) }, e, ctx)
  await waitOnExecutionContext(ctx)
  return res
}

const valid = { name: 'Aisha', phone: '+60 12-345 6789', 'cf-turnstile-response': 'token' }

beforeEach(async () => {
  await db.batch([
    db.prepare('DELETE FROM enquiries'),
    db.prepare('DELETE FROM packages'),
    db.prepare('DELETE FROM branches'),
    db.prepare('DELETE FROM cuisines'),
  ])
  const branchId = await createBranch(db, { slug: 'a', name: 'Branch A', address: null, phone: null, image_id: null, sort_order: 0, status: 'published' })
  const cuisineId = await createCuisine(db, { slug: 'arab', name: 'Arab', name_bm: null, description: null, description_bm: null, image_id: null, sort_order: 0, status: 'published' })
  const pkg = { branch_id: branchId, cuisine_id: cuisineId, description: null, price_sen: 3500, min_pax: 50, inclusions: [], is_popular: false, image_id: null, sort_order: 0 }
  packageId = await createPackage(db, { ...pkg, slug: 'p1', name: 'P1', status: 'published' })
  draftPackageId = await createPackage(db, { ...pkg, slug: 'p2', name: 'P2', status: 'draft' })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('POST /api/enquiries', () => {
  it('saves a valid enquiry and redirects to the thank-you page', async () => {
    const fetch = siteverify(true)
    const res = await post({ ...valid, email: 'a@example.com', pax: '80', package_id: String(packageId), message: '  Hi  ' }, '?lang=bm')

    expect(res.status).toBe(303)
    expect(res.headers.get('Location')).toBe('/contact?sent=1&lang=bm')
    const [saved] = await listEnquiries(db)
    expect(saved).toMatchObject({ name: 'Aisha', email: 'a@example.com', pax: 80, package_id: packageId, message: 'Hi', status: 'new' })
    expect(saved!.notified_at).toBeNull()

    const sent = fetch.mock.calls[0]![1]!.body as FormData
    expect(sent.get('secret')).toBe('test-secret')
    expect(sent.get('response')).toBe('token')
  })

  it('re-renders the form with errors and keeps what was typed', async () => {
    const fetch = siteverify(true)
    const res = await post({ name: 'Aisha', phone: 'abc', email: 'nope' })
    const html = await res.text()

    expect(res.status).toBe(400)
    expect(html).toContain('Please enter a valid phone number')
    expect(html).toContain('Please enter a valid email address')
    expect(html).toContain('value="Aisha"')
    expect(html).toContain('aria-invalid="true"')
    expect(fetch).not.toHaveBeenCalled()
    expect(await listEnquiries(db)).toEqual([])
  })

  it('rejects a package that is not published', async () => {
    siteverify(true)
    const res = await post({ ...valid, package_id: String(draftPackageId) })
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('Please choose a package from the list')
    expect(await listEnquiries(db)).toEqual([])
  })

  it('does not save when Turnstile fails', async () => {
    siteverify(false)
    const res = await post(valid)
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('could not verify that you are human')
    expect(await listEnquiries(db)).toEqual([])
  })

  it('does not save when the Turnstile secret is missing', async () => {
    const fetch = siteverify(true)
    const res = await app.request('/api/enquiries', { method: 'POST', body: new URLSearchParams(valid) }, { ...env, TURNSTILE_SECRET: '' })
    expect(res.status).toBe(400)
    expect(fetch).not.toHaveBeenCalled()
    expect(await listEnquiries(db)).toEqual([])
  })

  it('escapes HTML that was typed into the form', async () => {
    siteverify(true)
    const html = await (await post({ name: '<script>alert(1)</script>', phone: 'x' })).text()
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })
})

describe('GET /contact', () => {
  it('pre-selects the package from ?package=', async () => {
    const html = await (await app.request('/contact?package=p1', {}, testEnv)).text()
    expect(html).toContain(`<option value="${packageId}" selected="">P1`)
  })
})

describe('alert email', () => {
  const input = { name: 'Aisha', phone: '012', email: 'a@example.com', event_date: null, pax: null, branch_id: null, cuisine_id: null, package_id: null, message: null }
  const noOptions = { branches: [], cuisines: [], packages: [] }

  it('sends the alert and marks the enquiry notified', async () => {
    const id = await createEnquiry(db, input)
    const send = vi.fn().mockResolvedValue({ messageId: 'm1' })
    await notifyEnquiry(mailEnv(send), id, input, noOptions)
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ from: expect.objectContaining({ email: env.NOTIFY_FROM }), to: 'staff@gmail.com', replyTo: 'a@example.com' }))
    expect((await getEnquiryById(db, id))!.notified_at).not.toBeNull()
  })

  it('keeps the enquiry unnotified when sending fails', async () => {
    const id = await createEnquiry(db, input)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await notifyEnquiry(mailEnv(vi.fn().mockRejectedValue(new Error('E_SENDER_NOT_VERIFIED'))), id, input, noOptions)
    expect((await getEnquiryById(db, id))!.notified_at).toBeNull()
  })

  it('skips sending when email is not configured', async () => {
    const id = await createEnquiry(db, input)
    const send = vi.fn()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await notifyEnquiry({ ...mailEnv(send), NOTIFY_TO: '' }, id, input, noOptions)
    expect(send).not.toHaveBeenCalled()
  })

  it('lists filled fields with names and prices', () => {
    const o = { branches: [{ id: 1, name: 'Shah Alam' }], cuisines: [], packages: [{ id: 2, name: 'Kabsa Feast', price_sen: 3500 }] } as never
    const m = enquiryAlert(7, { name: 'Aisha', phone: '012', email: null, event_date: null, pax: 80, branch_id: 1, cuisine_id: null, package_id: 2, message: null }, o)
    expect(m.subject).toBe('New enquiry #7 from Aisha')
    expect(m.text).toBe('Name: Aisha\nPhone: 012\nGuests: 80\nBranch: Shah Alam\nPackage: Kabsa Feast (RM 35 / pax)')
  })
})

describe('enquirySchema', () => {
  const parse = (v: Record<string, string>) => enquirySchema.safeParse({ ...valid, ...v })

  it('turns empty optional fields into null', () => {
    const r = parse({ email: '', pax: ' ', event_date: '', message: '' })
    expect(r.success && r.data).toMatchObject({ email: null, pax: null, event_date: null, message: null, package_id: null })
  })

  it('accepts today and rejects past or malformed dates', () => {
    expect(parse({ event_date: todayInMalaysia() }).success).toBe(true)
    expect(parse({ event_date: '2020-01-01' }).success).toBe(false)
    expect(parse({ event_date: '01/12/2030' }).success).toBe(false)
  })

  it('rejects non-integer or out-of-range pax', () => {
    expect(parse({ pax: '1.5' }).success).toBe(false)
    expect(parse({ pax: '0' }).success).toBe(false)
    expect(parse({ pax: '10001' }).success).toBe(false)
  })
})

describe('formatRM', () => {
  it('formats integer sen as ringgit', () => {
    expect(formatRM(3500)).toBe('RM 35')
    expect(formatRM(3550)).toBe('RM 35.50')
    expect(formatRM(150000)).toBe('RM 1,500')
  })
})
