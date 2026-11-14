import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import app from '../src/index'
import { createBranch } from '../src/db/branches'
import { createCuisine } from '../src/db/cuisines'
import { createEnquiry, getEnquiryById, listEnquiries, type EnquiryInput } from '../src/db/enquiries'
import { createMenuItem } from '../src/db/menu_items'
import { createGroup } from '../src/db/package_groups'
import { createPackage } from '../src/db/packages'
import { enquiryAlert, notifyEnquiry } from '../src/lib/email'
import { formatRM } from '../src/lib/format'
import { enquirySchema, todayInMalaysia } from '../src/lib/validation'


const db = env.DB
// NOTIFY_TO stays empty here, so route tests skip the alert.
const testEnv = { ...env, TURNSTILE_SECRET: 'test-secret', NOTIFY_TO: '' }
const mailEnv = (send: (...a: unknown[]) => unknown) => ({ ...env, NOTIFY_TO: 'staff@gmail.com', EMAIL: { send } as unknown as SendEmail })

let packageId: number
let branchId: number
let groupId: number
let lambId: number

// Stub Turnstile's siteverify; nothing else in these tests calls fetch.
const siteverify = (success: boolean) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ success }))

// Waits for waitUntil() work (the email alert) so tests can check its effects.
const post = async (fields: Record<string, string> | URLSearchParams, query = '', e: Env = testEnv, path = '/api/enquiries') => {
  const ctx = createExecutionContext()
  const res = await app.request(`${path}${query}`, { method: 'POST', body: new URLSearchParams(fields) }, e, ctx)
  await waitOnExecutionContext(ctx)
  return res
}

const valid = { name: 'Aisha', phone: '+60 12-345 6789', 'cf-turnstile-response': 'token' }

beforeEach(async () => {
  await db.batch([
    db.prepare('DELETE FROM enquiries'),
    db.prepare('DELETE FROM package_groups'),
    db.prepare('DELETE FROM packages'),
    db.prepare('DELETE FROM menu_items'),
    db.prepare('DELETE FROM branches'),
    db.prepare('DELETE FROM cuisines'),
  ])
  branchId = await createBranch(db, { slug: 'a', name: 'Branch A', name_bm: null, address: null, phone: null, maps_link: null, has_hall: true, hall_capacity: 120, image_id: null, sort_order: 0, status: 'published' })
  const cuisineId = await createCuisine(db, { slug: 'arab', name: 'Arab', name_bm: null, description: null, description_bm: null, image_id: null, sort_order: 0, status: 'published' })
  const pkg = { cuisine_id: cuisineId, service_type: 'both' as const, name_bm: null, pdf_key: null, price_sen: 3500, min_pax: 50, max_pax: 300, inclusions: [], inclusions_bm: [], is_popular: false, image_id: null, sort_order: 0 }
  packageId = await createPackage(db, { ...pkg, slug: 'p1', name: 'P1', status: 'published' })
  const item = { cuisine_id: cuisineId, name_bm: null, pdf_key: null, category: null, price_sen: null, is_bestseller: false, image_id: null, sort_order: 0, status: 'published' as const }
  lambId = await createMenuItem(db, { ...item, name: 'Lamb Mandi' })
  const chicken = await createMenuItem(db, { ...item, name: 'Chicken Kabsa' })
  groupId = await createGroup(db, { package_id: packageId, name: 'Mains', name_bm: null, choose_count: 1, sort_order: 0 }, [lambId, chicken])
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('POST /api/enquiries', () => {
  it('saves a valid enquiry and redirects to the thank-you page', async () => {
    const fetch = siteverify(true)
    const res = await post({ ...valid, email: 'a@example.com', pax: '80', message: '  Hi  ' }, '?lang=bm')

    expect(res.status).toBe(303)
    expect(res.headers.get('Location')).toBe('/contact?sent=1&lang=bm')
    const [saved] = await listEnquiries(db)
    expect(saved).toMatchObject({ name: 'Aisha', email: 'a@example.com', pax: 80, service_type: null, package_id: null, message: 'Hi', status: 'new' })
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
  it('is a general message form without package dropdowns', async () => {
    const html = await (await app.request('/contact', {}, testEnv)).text()
    expect(html).toContain('name="message"')
    expect(html).not.toContain('name="package_id"')
  })
})

describe('POST /api/enquiries/booking', () => {
  const day = todayInMalaysia()
  const booking = (over: Record<string, string> = {}) => {
    const f = new URLSearchParams({ service: 'in_house', cuisine: 'arab', package: 'p1', ...valid, event_date: day, event_time: '19:30', pax: '100', branch_id: '', ...over })
    if (!f.get('branch_id')) f.set('branch_id', String(branchId))
    if (!('noChoice' in over)) f.append(`g${groupId}`, String(lambId))
    f.delete('noChoice')
    return f
  }
  const send = (f: URLSearchParams, query = '') => post(f, query, testEnv, '/api/enquiries/booking')

  it('saves an in-house booking with the server-side estimate and menu choices', async () => {
    siteverify(true)
    const res = await send(booking(), '?lang=bm')
    expect(res.status).toBe(303)
    expect(res.headers.get('Location')).toBe('/packages?sent=1&service=in_house&estimate=350000&lang=bm')
    const [saved] = await listEnquiries(db)
    expect(saved).toMatchObject({
      service_type: 'in_house', branch_id: branchId, package_id: packageId, event_time: '19:30', pax: 100,
      estimate_sen: 350000, menu_choices: { [groupId]: [lambId] }, address_line: null, status: 'new',
    })
  })

  it('saves an outside booking with its address and no branch', async () => {
    siteverify(true)
    const f = booking({ service: 'outside', address_line: '12 Jalan Mawar', postcode: '40150', city: 'Shah Alam', state: 'Selangor', setup_notes: 'Lift to 3rd floor' })
    f.delete('branch_id')
    expect((await send(f)).status).toBe(303)
    const [saved] = await listEnquiries(db)
    expect(saved).toMatchObject({ service_type: 'outside', branch_id: null, postcode: '40150', city: 'Shah Alam', setup_notes: 'Lift to 3rd floor', estimate_sen: 350000 })
  })

  it('rejects outside catering without an address', async () => {
    const fetch = siteverify(true)
    const res = await send(booking({ service: 'outside', postcode: '123' }))
    expect(res.status).toBe(400)
    const html = await res.text()
    expect(html).toContain('Please enter the event address.')
    expect(html).toContain('Please enter a 5-digit postcode.')
    expect(fetch).not.toHaveBeenCalled()
    expect(await listEnquiries(db)).toEqual([])
  })

  it('rejects more guests than the hall holds, and fewer than the package minimum', async () => {
    siteverify(true)
    for (const pax of ['150', '10']) {
      const res = await send(booking({ pax }))
      expect(res.status).toBe(400)
      expect(await res.text()).toContain('fits this package and venue')
    }
    expect(await listEnquiries(db)).toEqual([])
  })

  it('rejects a branch without a hall', async () => {
    siteverify(true)
    const noHall = await createBranch(db, { slug: 'b', name: 'B', name_bm: null, address: null, phone: null, maps_link: null, has_hall: false, hall_capacity: null, image_id: null, sort_order: 0, status: 'published' })
    const res = await send(booking({ branch_id: String(noHall) }))
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('Please choose a branch from the list.')
  })

  it('sends the visitor back to the menu step when choices are missing', async () => {
    siteverify(true)
    const res = await send(booking({ noChoice: '1' }))
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('Customise Your Menu')
    expect(await listEnquiries(db)).toEqual([])
  })

  it('does not save when Turnstile fails', async () => {
    siteverify(false)
    const res = await send(booking())
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('could not verify that you are human')
    expect(await listEnquiries(db)).toEqual([])
  })
})

describe('GET /packages?sent=1', () => {
  it('shows the estimate from the redirect', async () => {
    const html = await (await app.request('/packages?sent=1&service=outside&estimate=350000', {}, testEnv)).text()
    expect(html).toContain('RM 3,500')
    expect(html).toContain('delivery fee')
  })
})

describe('alert email', () => {
  const input: EnquiryInput = {
    name: 'Aisha', phone: '012', email: 'a@example.com', service_type: null, event_date: null, event_time: null, pax: null,
    branch_id: null, cuisine_id: null, package_id: null, menu_choices: null, address_line: null, postcode: null, city: null,
    state: null, setup_notes: null, message: null, estimate_sen: null,
  }
  const noOptions = {}

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
    const e = { ...input, email: null, service_type: 'outside' as const, pax: 80, postcode: '40150', city: 'Shah Alam', estimate_sen: 280000 }
    const m = enquiryAlert(7, e, { package: { name: 'Kabsa Feast', price_sen: 3500 }, dishes: ['Lamb Mandi'] })
    expect(m.subject).toBe('New enquiry #7 from Aisha')
    expect(m.text).toBe(
      'Name: Aisha\nPhone: 012\nWhere: At their place (outside catering)\nGuests: 80\nAddress: 40150 Shah Alam\n' +
        'Package: Kabsa Feast (RM 35 / pax)\nMenu choices: Lamb Mandi\nEstimate: RM 2,800 + delivery fee',
    )
  })

  it('marks a general message', () => {
    expect(enquiryAlert(1, input).text).toContain('Where: General message')
  })
})

describe('enquirySchema', () => {
  const parse = (v: Record<string, string>) => enquirySchema.safeParse({ ...valid, ...v })

  it('turns empty optional fields into null', () => {
    const r = parse({ email: '', pax: ' ', event_date: '', message: '' })
    expect(r.success && r.data).toMatchObject({ email: null, pax: null, event_date: null, message: null })
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
