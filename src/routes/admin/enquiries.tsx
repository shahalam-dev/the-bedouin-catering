import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { listBranches, type Branch } from '../../db/branches'
import { getCuisineById } from '../../db/cuisines'
import { getEnquiryById, listEnquiries, updateEnquiryAdmin, type Enquiry, type EnquiryStatus } from '../../db/enquiries'
import { getMenuItemById } from '../../db/menu_items'
import { getPackageById } from '../../db/packages'
import type { AdminEnv } from '../../lib/auth'
import { formatRM } from '../../lib/format'
import { adminT } from '../../lib/i18n'
import { enquiryUpdateSchema } from '../../lib/validation'
import { Button } from '../../views/components/Button'
import { fieldAria, FormField } from '../../views/components/FormField'
import { StatusPill } from '../../views/components/StatusPill'

const PAGE_SIZE = 50
const STATUSES = Object.keys(adminT.enquiries.statuses) as EnquiryStatus[]
const t = adminT.enquiries

const listQuery = z.object({
  status: z.enum(['new', 'quoted', 'confirmed', 'declined']).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
})

const received = (iso: string) =>
  new Date(iso).toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur', dateStyle: 'medium', timeStyle: 'short' })

const listUrl = (status: EnquiryStatus | undefined, page = 1) => {
  const q = new URLSearchParams()
  if (status) q.set('status', status)
  if (page > 1) q.set('page', String(page))
  const s = q.toString()
  return `/admin/enquiries${s ? `?${s}` : ''}`
}

type Props = { rows: Enquiry[]; status?: EnquiryStatus; page: number; hasMore: boolean }

const EnquiriesPage = ({ rows, status, page, hasMore }: Props) => (
  <>
    <title>{`${adminT.sections.enquiries} | ${adminT.title}`}</title>
    <div class="admin-head">
      <h1>{adminT.sections.enquiries}</h1>
    </div>
    <nav class="filters chips" aria-label={t.filterLabel}>
      {[undefined, ...STATUSES].map((s) => (
        <a class="chip chip--filter" href={listUrl(s)} aria-current={s === status ? 'page' : undefined}>
          {s ? t.statuses[s] : t.all}
        </a>
      ))}
    </nav>
    {rows.length === 0 ? (
      <p class="panel">{adminT.none}</p>
    ) : (
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th scope="col">{t.received}</th>
              <th scope="col">{adminT.name}</th>
              <th scope="col">{t.service}</th>
              <th scope="col">{t.contact}</th>
              <th scope="col">{t.eventDate}</th>
              <th scope="col">{adminT.status}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr>
                <td class="nowrap">{received(e.created_at)}</td>
                <td>
                  <a href={`/admin/enquiries/${e.id}`}>
                    <strong>{e.name}</strong>
                  </a>
                </td>
                <td class="nowrap">{t.services[e.service_type ?? 'general']}</td>
                <td class="nowrap">
                  <a href={tel(e.phone)}>{e.phone}</a>
                </td>
                <td class="nowrap">{e.event_date ?? '—'}</td>
                <td>
                  <StatusPill status={e.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
    <nav class="pager">
      {page > 1 ? <a href={listUrl(status, page - 1)}>{t.newer}</a> : <span />}
      {hasMore && <a href={listUrl(status, page + 1)}>{t.older}</a>}
    </nav>
  </>
)

const tel = (phone: string) => `tel:${phone.replace(/[\s-]/g, '')}`

type Detail = { e: Enquiry; branches: Branch[]; pkg: string; cuisine: string; dishes: string[] }
type FormState = { values: Record<string, string>; errors: Record<string, string>; saved: boolean }

const sen = (v: number | null) => (v == null ? '' : (v / 100).toFixed(2).replace(/\.00$/, ''))
const valuesOf = (e: Enquiry) => ({
  status: e.status,
  branch_id: e.branch_id == null ? '' : String(e.branch_id),
  delivery_fee_sen: sen(e.delivery_fee_sen),
  decline_reason: e.decline_reason ?? '',
  admin_notes: e.admin_notes ?? '',
})

const DetailPage = ({ e, branches, pkg, cuisine, dishes, values, errors, saved }: Detail & FormState) => {
  const outside = e.service_type === 'outside'
  const branch = branches.find((b) => b.id === e.branch_id)
  const address = [e.address_line, [e.postcode, e.city].filter(Boolean).join(' '), e.state].filter(Boolean).join(', ')
  const total = e.estimate_sen != null && e.delivery_fee_sen != null ? e.estimate_sen + e.delivery_fee_sen : null
  const err = (k: string) => errors[k]
  return (
    <>
      <title>{`${e.name} | ${adminT.sections.enquiries} | ${adminT.title}`}</title>
      <div class="admin-head">
        <h1>{e.name}</h1>
        <a href="/admin/enquiries">{t.backToList}</a>
      </div>
      {saved && (
        <p class="notice notice--success" role="status">
          {adminT.saved}
        </p>
      )}
      <div class="panel">
        <dl class="details">
          <dt>{t.received}</dt>
          <dd>{received(e.created_at)}</dd>
          <dt>{t.contact}</dt>
          <dd>
            <a href={tel(e.phone)}>{e.phone}</a>
            {e.email && (
              <div>
                <a href={`mailto:${e.email}`}>{e.email}</a>
              </div>
            )}
          </dd>
          <dt>{t.service}</dt>
          <dd>{t.services[e.service_type ?? 'general']}</dd>
          <dt>{t.event}</dt>
          <dd>{[e.event_date, e.event_time, e.pax && t.pax(e.pax)].filter(Boolean).join(' · ') || '—'}</dd>
          {e.service_type && (
            <>
              <dt>{t.venue}</dt>
              <dd>{(outside ? address : branch?.name) || '—'}</dd>
            </>
          )}
          <dt>{t.details}</dt>
          <dd>{[pkg, cuisine].filter(Boolean).join(' · ') || '—'}</dd>
          {dishes.length > 0 && (
            <>
              <dt>{t.menu}</dt>
              <dd>{dishes.join(', ')}</dd>
            </>
          )}
          {e.estimate_sen != null && (
            <>
              <dt>{t.estimate}</dt>
              <dd>
                {formatRM(e.estimate_sen)}
                {outside && (e.delivery_fee_sen == null ? ' + delivery fee (not set)' : ` + ${formatRM(e.delivery_fee_sen)} delivery = ${formatRM(total!)}`)}
              </dd>
            </>
          )}
          {e.setup_notes && (
            <>
              <dt>{t.setupNotes}</dt>
              <dd class="message">{e.setup_notes}</dd>
            </>
          )}
          <dt>{t.message}</dt>
          <dd class="message">{e.message || '—'}</dd>
        </dl>
      </div>
      <form method="post" action={`/admin/enquiries/${e.id}`} class="panel form" novalidate>
        {Object.keys(errors).length > 0 && (
          <p class="notice notice--error" role="alert">
            {adminT.formError}
          </p>
        )}
        <div class="form__grid">
          <FormField id="status" label={adminT.status}>
            <select id="status" name="status" class="input">
              {STATUSES.map((s) => (
                <option value={s} selected={s === values.status}>
                  {t.statuses[s]}
                </option>
              ))}
            </select>
          </FormField>
          {e.service_type && (
            <FormField id="branch_id" label={t.branch} error={err('branch_id')}>
              <select id="branch_id" name="branch_id" class="input" {...fieldAria('branch_id', err('branch_id'))}>
                <option value="">{adminT.noneOption}</option>
                {branches.map((b) => (
                  <option value={String(b.id)} selected={values.branch_id === String(b.id)}>
                    {b.name}
                  </option>
                ))}
              </select>
            </FormField>
          )}
          {outside && (
            <FormField id="delivery_fee_sen" label={t.deliveryFee} error={err('delivery_fee_sen')}>
              <input id="delivery_fee_sen" name="delivery_fee_sen" type="text" inputmode="decimal" class="input" value={values.delivery_fee_sen} {...fieldAria('delivery_fee_sen', err('delivery_fee_sen'))} />
            </FormField>
          )}
        </div>
        <FormField id="decline_reason" label={t.declineReason} error={err('decline_reason')}>
          <textarea id="decline_reason" name="decline_reason" rows={2} maxlength={500} class="input" {...fieldAria('decline_reason', err('decline_reason'))}>
            {values.decline_reason}
          </textarea>
        </FormField>
        <FormField id="admin_notes" label={t.adminNotes} error={err('admin_notes')}>
          <textarea id="admin_notes" name="admin_notes" rows={4} maxlength={2000} class="input" {...fieldAria('admin_notes', err('admin_notes'))}>
            {values.admin_notes}
          </textarea>
        </FormField>
        <div class="form__actions">
          <Button type="submit">{adminT.save}</Button>
        </div>
      </form>
    </>
  )
}

/** Looks up the names the enquiry points at. Deleted rows simply show as missing. */
async function loadDetail(db: D1Database, e: Enquiry): Promise<Detail> {
  const dishIds = Object.values(e.menu_choices ?? {}).flat()
  const [branches, pkg, cuisine, dishes] = await Promise.all([
    listBranches(db),
    e.package_id ? getPackageById(db, e.package_id) : null,
    e.cuisine_id ? getCuisineById(db, e.cuisine_id) : null,
    Promise.all(dishIds.map((id) => getMenuItemById(db, id))),
  ])
  return {
    e,
    branches,
    pkg: pkg ? `${pkg.name} (${formatRM(pkg.price_sen)} / pax)` : '',
    cuisine: cuisine?.name ?? '',
    dishes: dishes.flatMap((d) => (d ? [d.name] : [])),
  }
}

const enquiries = new Hono<AdminEnv>()

enquiries.get('/', zValidator('query', listQuery), async (c) => {
  const { status, page } = c.req.valid('query')
  // One extra row tells us whether there is an older page.
  const found = await listEnquiries(c.env.DB, { status, limit: PAGE_SIZE + 1, offset: (page - 1) * PAGE_SIZE })
  return c.render(<EnquiriesPage rows={found.slice(0, PAGE_SIZE)} status={status} page={page} hasMore={found.length > PAGE_SIZE} />)
})

enquiries.get('/:id{[0-9]+}', async (c) => {
  const e = await getEnquiryById(c.env.DB, Number(c.req.param('id')))
  if (!e) return c.notFound()
  return c.render(<DetailPage {...await loadDetail(c.env.DB, e)} values={valuesOf(e)} errors={{}} saved={c.req.query('saved') === '1'} />)
})

enquiries.post(
  '/:id{[0-9]+}',
  zValidator('form', enquiryUpdateSchema, async (result, c) => {
    if (result.success) return
    const db = (c.env as Env).DB
    const e = await getEnquiryById(db, Number(c.req.param('id')))
    if (!e) return c.notFound()
    const bad = new Set(result.error.issues.map((i) => String(i.path[0])))
    const errors = Object.fromEntries(
      (['decline_reason', 'delivery_fee_sen', 'branch_id'] as const).filter((k) => bad.has(k)).map((k) => [k, t.errors[k]]),
    )
    c.status(400)
    return c.render(<DetailPage {...await loadDetail(db, e)} values={result.data as unknown as Record<string, string>} errors={errors} saved={false} />)
  }),
  async (c) => {
    const id = Number(c.req.param('id'))
    const e = await getEnquiryById(c.env.DB, id)
    if (!e) return c.notFound()
    const v = c.req.valid('form')
    // A general message has no venue or fee; outside catering alone has a delivery fee.
    const ok = await updateEnquiryAdmin(c.env.DB, id, {
      ...v,
      branch_id: e.service_type ? v.branch_id : null,
      delivery_fee_sen: e.service_type === 'outside' ? v.delivery_fee_sen : null,
    })
    if (!ok) return c.notFound()
    return c.redirect(`/admin/enquiries/${id}?saved=1`, 303)
  },
)

export default enquiries
