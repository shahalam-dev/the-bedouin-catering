import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { getBranchById } from '../../db/branches'
import { getCuisineById } from '../../db/cuisines'
import { getEnquiryById, listEnquiries, setEnquiryStatus, type Enquiry, type EnquiryStatus } from '../../db/enquiries'
import { getPackageById } from '../../db/packages'
import type { AdminEnv } from '../../lib/auth'
import { adminT } from '../../lib/i18n'
import { enquiryStatusSchema } from '../../lib/validation'
import { Button } from '../../views/components/Button'
import { StatusPill } from '../../views/components/StatusPill'

const PAGE_SIZE = 50
const STATUSES = Object.keys(adminT.enquiries.statuses) as EnquiryStatus[]
const t = adminT.enquiries

const listQuery = z.object({
  status: z.enum(['new', 'contacted', 'closed']).optional(),
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
              <th scope="col">{t.contact}</th>
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
                <td class="nowrap">
                  <a href={tel(e.phone)}>{e.phone}</a>
                </td>
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

const DetailPage = ({ e, interest, saved }: { e: Enquiry; interest: string; saved: boolean }) => (
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
        <dt>{t.event}</dt>
        <dd>{[e.event_date, e.pax && t.pax(e.pax)].filter(Boolean).join(' · ') || '—'}</dd>
        <dt>{t.details}</dt>
        <dd>{interest || '—'}</dd>
        <dt>{t.message}</dt>
        <dd class="message">{e.message || '—'}</dd>
      </dl>
    </div>
    <form method="post" action={`/admin/enquiries/${e.id}/status`} class="panel status-form">
      <label for="status">{adminT.status}</label>
      <select id="status" name="status" class="input">
        {STATUSES.map((s) => (
          <option value={s} selected={s === e.status}>
            {t.statuses[s]}
          </option>
        ))}
      </select>
      <Button type="submit" variant="outline">
        {t.update}
      </Button>
    </form>
  </>
)

const enquiries = new Hono<AdminEnv>()

enquiries.get('/', zValidator('query', listQuery), async (c) => {
  const { status, page } = c.req.valid('query')
  // One extra row tells us whether there is an older page.
  const found = await listEnquiries(c.env.DB, { status, limit: PAGE_SIZE + 1, offset: (page - 1) * PAGE_SIZE })
  return c.render(<EnquiriesPage rows={found.slice(0, PAGE_SIZE)} status={status} page={page} hasMore={found.length > PAGE_SIZE} />)
})

enquiries.get('/:id{[0-9]+}', async (c) => {
  const db = c.env.DB
  const e = await getEnquiryById(db, Number(c.req.param('id')))
  if (!e) return c.notFound()
  const [pkg, branch, cuisine] = await Promise.all([
    e.package_id ? getPackageById(db, e.package_id) : null,
    e.branch_id ? getBranchById(db, e.branch_id) : null,
    e.cuisine_id ? getCuisineById(db, e.cuisine_id) : null,
  ])
  const interest = [pkg?.name, branch?.name, cuisine?.name].filter(Boolean).join(' · ')
  return c.render(<DetailPage e={e} interest={interest} saved={c.req.query('saved') === '1'} />)
})

enquiries.post('/:id{[0-9]+}/status', zValidator('form', enquiryStatusSchema), async (c) => {
  const id = Number(c.req.param('id'))
  if (!(await setEnquiryStatus(c.env.DB, id, c.req.valid('form').status))) return c.notFound()
  return c.redirect(`/admin/enquiries/${id}?saved=1`, 303)
})

export default enquiries
