import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { createEnquiry } from '../../db/enquiries'
import { notifyEnquiry } from '../../lib/email'
import { getLang, withLang } from '../../lib/i18n'
import { verifyTurnstile } from '../../lib/turnstile'
import { enquirySchema, type EnquiryField } from '../../lib/validation'
import { loadContactOptions, renderContact } from '../public/contact'

// Public enquiry form POST: validate -> verify Turnstile -> save to D1 -> redirect -> email alert.

const stringValues = (body: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(body).filter((e): e is [string, string] => typeof e[1] === 'string'))

const enquiries = new Hono<{ Bindings: Env }>()

enquiries.post(
  '/',
  zValidator('form', enquirySchema, async (result, c) => {
    if (result.success) return
    const errors = [...new Set(result.error.issues.map((i) => String(i.path[0])))] as EnquiryField[]
    // The hook's context is not typed with our bindings.
    const env = c.env as Env
    c.status(400)
    return renderContact(c, env, {
      options: await loadContactOptions(env.DB),
      values: stringValues(result.data as Record<string, unknown>),
      errors,
      formError: 'form',
    })
  }),
  async (c) => {
    const data = c.req.valid('form')
    const options = await loadContactOptions(c.env.DB)
    const values = stringValues(await c.req.parseBody())

    // Only published branches, cuisines and packages can be chosen.
    const errors: EnquiryField[] = []
    if (data.branch_id && !options.branches.some((b) => b.id === data.branch_id)) errors.push('branch_id')
    if (data.cuisine_id && !options.cuisines.some((x) => x.id === data.cuisine_id)) errors.push('cuisine_id')
    if (data.package_id && !options.packages.some((p) => p.id === data.package_id)) errors.push('package_id')
    if (errors.length) {
      c.status(400)
      return renderContact(c, c.env, { options, values, errors, formError: 'form' })
    }

    const human = await verifyTurnstile(c.env.TURNSTILE_SECRET, data['cf-turnstile-response'], c.req.header('CF-Connecting-IP'))
    if (!human) {
      c.status(400)
      return renderContact(c, c.env, { options, values, formError: 'turnstile' })
    }

    const { 'cf-turnstile-response': _token, ...enquiry } = data
    const id = await createEnquiry(c.env.DB, enquiry)
    // Saved first; the alert runs after the redirect is sent and cannot lose the enquiry.
    c.executionCtx.waitUntil(notifyEnquiry(c.env, id, enquiry, options))

    return c.redirect(withLang('/contact?sent=1', getLang(c.req.query('lang'))), 303)
  },
)

export default enquiries
