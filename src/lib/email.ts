import { markEnquiryNotified, type EnquiryInput } from '../db/enquiries'
import type { ContactOptions } from '../routes/public/contact'
import { formatRM } from './format'

/** Staff alert for a new enquiry. English only: it goes to the client's staff, not the customer. */
export function enquiryAlert(id: number, e: EnquiryInput, o: ContactOptions) {
  const pkg = o.packages.find((p) => p.id === e.package_id)
  const rows: [string, string | number | null | undefined][] = [
    ['Name', e.name],
    ['Phone', e.phone],
    ['Email', e.email],
    ['Event date', e.event_date],
    ['Guests', e.pax],
    ['Branch', o.branches.find((b) => b.id === e.branch_id)?.name],
    ['Cuisine', o.cuisines.find((x) => x.id === e.cuisine_id)?.name],
    ['Package', pkg && `${pkg.name} (${formatRM(pkg.price_sen)} / pax)`],
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
export async function notifyEnquiry(env: Env, id: number, e: EnquiryInput, o: ContactOptions): Promise<void> {
  if (!env.NOTIFY_TO) {
    console.warn(`Enquiry #${id}: email not configured, skipping alert`)
    return
  }
  try {
    await env.EMAIL.send({
      from: { email: env.NOTIFY_FROM, name: 'The Bedouin Catering website' },
      to: env.NOTIFY_TO,
      ...enquiryAlert(id, e, o),
    })
    await markEnquiryNotified(env.DB, id)
  } catch (err) {
    console.error(`Enquiry #${id}: alert email failed`, err)
  }
}
