import { markEnquiryNotified, type EnquiryInput } from '../db/enquiries'
import { formatRM } from './format'

/** Names the enquiry ids point at, looked up by the route that saved it. */
export type AlertNames = { package?: { name: string; price_sen: number }; branch?: string; cuisine?: string; dishes?: string[] }

const SERVICE = { in_house: 'At our branch (in-house)', outside: 'At their place (outside catering)' }

/** Staff alert for a new enquiry. English only: it goes to the client's staff, not the customer. */
export function enquiryAlert(id: number, e: EnquiryInput, n: AlertNames = {}) {
  const address = [e.address_line, [e.postcode, e.city].filter(Boolean).join(' '), e.state].filter(Boolean).join(', ')
  const rows: [string, string | number | null | undefined][] = [
    ['Name', e.name],
    ['Phone', e.phone],
    ['Email', e.email],
    ['Where', e.service_type ? SERVICE[e.service_type] : 'General message'],
    ['Event date', e.event_date],
    ['Event time', e.event_time],
    ['Guests', e.pax],
    ['Branch', n.branch],
    ['Address', address],
    ['Cuisine', n.cuisine],
    ['Package', n.package && `${n.package.name} (${formatRM(n.package.price_sen)} / pax)`],
    ['Menu choices', n.dishes?.join(', ')],
    ['Estimate', e.estimate_sen == null ? null : `${formatRM(e.estimate_sen)}${e.service_type === 'outside' ? ' + delivery fee' : ''}`],
    ['Setup notes', e.setup_notes],
    ['Message', e.message],
  ]
  const text = rows
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')
  return { subject: `New enquiry #${id} from ${e.name}`, text, replyTo: e.email ?? undefined }
}

/**
 * Runs after the enquiry is saved. Failure is logged, never thrown: the enquiry stays in D1
 * with notified_at NULL, so it shows up in listUnnotifiedEnquiries().
 */
export async function notifyEnquiry(env: Env, id: number, e: EnquiryInput, n: AlertNames = {}): Promise<void> {
  if (!env.NOTIFY_TO) {
    console.warn(`Enquiry #${id}: email not configured, skipping alert`)
    return
  }
  try {
    await env.EMAIL.send({
      from: { email: env.NOTIFY_FROM, name: 'Majlis Catering website' },
      to: env.NOTIFY_TO,
      ...enquiryAlert(id, e, n),
    })
    await markEnquiryNotified(env.DB, id)
  } catch (err) {
    console.error(`Enquiry #${id}: alert email failed`, err)
  }
}
