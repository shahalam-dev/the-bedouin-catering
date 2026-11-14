import { zValidator } from '@hono/zod-validator'
import { Hono, type Context } from 'hono'
import { listHallBranches } from '../../db/branches'
import { createEnquiry, type EnquiryInput } from '../../db/enquiries'
import { notifyEnquiry } from '../../lib/email'
import { getLang, withLang } from '../../lib/i18n'
import { verifyTurnstile } from '../../lib/turnstile'
import { bookingSchema, enquirySchema, type BookingField, type EnquiryField } from '../../lib/validation'
import { renderContact } from '../public/contact'
import { renderPackages, resolveSelection } from '../public/packages'

// Enquiry POSTs: validate -> verify Turnstile -> save to D1 -> redirect -> email alert.
//   /          general message from /contact
//   /booking   last step of the package selector

type Ctx = Context<{ Bindings: Env }>

const stringValues = (body: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(body).filter((e): e is [string, string] => typeof e[1] === 'string'))

/** Fields of a general message that only package bookings fill in. */
const NOT_BOOKING = {
  service_type: null, event_time: null, branch_id: null, cuisine_id: null, package_id: null, menu_choices: null,
  address_line: null, postcode: null, city: null, state: null, setup_notes: null, estimate_sen: null,
} satisfies Partial<EnquiryInput>

const BOOKING_FIELDS: BookingField[] = [
  'name', 'phone', 'email', 'event_date', 'event_time', 'pax', 'message', 'branch_id', 'address_line', 'postcode', 'city', 'state', 'setup_notes',
]

const enquiries = new Hono<{ Bindings: Env }>()

enquiries.post(
  '/',
  zValidator('form', enquirySchema, async (result, c) => {
    if (result.success) return
    const errors = [...new Set(result.error.issues.map((i) => String(i.path[0])))] as EnquiryField[]
    // The hook's context is not typed with our bindings.
    const env = c.env as Env
    c.status(400)
    return renderContact(c, env, { values: stringValues(result.data as Record<string, unknown>), errors, formError: 'form' })
  }),
  async (c) => {
    const data = c.req.valid('form')
    const values = stringValues(await c.req.parseBody())

    const human = await verifyTurnstile(c.env.TURNSTILE_SECRET, data['cf-turnstile-response'], c.req.header('CF-Connecting-IP'))
    if (!human) {
      c.status(400)
      return renderContact(c, c.env, { values, formError: 'turnstile' })
    }

    const { 'cf-turnstile-response': _token, ...message } = data
    const enquiry: EnquiryInput = { ...message, ...NOT_BOOKING }
    const id = await createEnquiry(c.env.DB, enquiry)
    // Saved first; the alert runs after the redirect is sent and cannot lose the enquiry.
    c.executionCtx.waitUntil(notifyEnquiry(c.env, id, enquiry))

    return c.redirect(withLang('/contact?sent=1', getLang(c.req.query('lang'))), 303)
  },
)

/** Re-reads the selection from the form body; the earlier steps are re-checked against the database. */
const selectionFrom = async (c: Ctx) => {
  const body = await c.req.parseBody({ all: true })
  return { body, sel: await resolveSelection(c.env.DB, body) }
}

enquiries.post(
  '/booking',
  zValidator('form', bookingSchema, async (result, c) => {
    if (result.success) return
    const ctx = c as unknown as Ctx
    const { body, sel } = await selectionFrom(ctx)
    const bad = new Set(result.error.issues.map((i) => String(i.path[0])))
    c.status(400)
    return renderPackages(ctx, sel, { values: stringValues(body), errors: BOOKING_FIELDS.filter((f) => bad.has(f)), formError: 'form' })
  }),
  async (c) => {
    const data = c.req.valid('form')
    const { body, sel } = await selectionFrom(c)
    const values = stringValues(body)
    const pkg = sel.pkg
    // The package, its cuisine or a dish was unpublished meanwhile, or the form was edited: back to that step.
    if (!pkg || sel.service !== data.service || sel.bad.length) {
      c.status(400)
      return renderPackages(c, sel)
    }

    const errors: BookingField[] = []
    if (data.pax < pkg.min_pax || (pkg.max_pax != null && data.pax > pkg.max_pax)) errors.push('pax')
    const branch = data.service === 'in_house' ? (await listHallBranches(c.env.DB)).find((b) => b.id === data.branch_id) : undefined
    if (data.service === 'in_house') {
      if (!branch) errors.push('branch_id')
      else if (branch.hall_capacity != null && data.pax > branch.hall_capacity && !errors.includes('pax')) errors.push('pax')
    }
    if (errors.length) {
      c.status(400)
      return renderPackages(c, sel, { values, errors, formError: 'form' })
    }

    const human = await verifyTurnstile(c.env.TURNSTILE_SECRET, data['cf-turnstile-response'], c.req.header('CF-Connecting-IP'))
    if (!human) {
      c.status(400)
      return renderPackages(c, sel, { values, formError: 'turnstile' })
    }

    const outside = data.service === 'outside' ? data : undefined
    const enquiry: EnquiryInput = {
      name: data.name,
      phone: data.phone,
      email: data.email,
      service_type: data.service,
      event_date: data.event_date,
      event_time: data.event_time,
      pax: data.pax,
      branch_id: branch?.id ?? null,
      cuisine_id: pkg.cuisine_id,
      package_id: pkg.id,
      menu_choices: sel.groups.length ? sel.choices : null,
      address_line: outside?.address_line ?? null,
      postcode: outside?.postcode ?? null,
      city: outside?.city ?? null,
      state: outside?.state ?? null,
      setup_notes: outside?.setup_notes ?? null,
      message: data.message,
      // Same price at every branch, so the estimate is price per pax x guests (outside: delivery fee added later).
      estimate_sen: pkg.price_sen * data.pax,
    }
    const id = await createEnquiry(c.env.DB, enquiry)
    const dishes = sel.groups.flatMap((g) => g.items.filter((i) => sel.choices[g.id]?.includes(i.id)).map((i) => i.name))
    // Saved first; the alert runs after the redirect is sent and cannot lose the enquiry.
    c.executionCtx.waitUntil(notifyEnquiry(c.env, id, enquiry, { package: pkg, branch: branch?.name, cuisine: pkg.cuisine_name, dishes }))

    const q = new URLSearchParams({ sent: '1', service: data.service, estimate: String(enquiry.estimate_sen) })
    return c.redirect(withLang(`/packages?${q}`, getLang(c.req.query('lang'))), 303)
  },
)

export default enquiries
