import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { listBranches } from '../../db/branches'
import { listCuisines } from '../../db/cuisines'
import { listEnquiries, setEnquiryStatus, type Enquiry, type EnquiryStatus } from '../../db/enquiries'
import { listPackages } from '../../db/packages'
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

type Props = { rows: Enquiry[]; names: Map<string, string>; status?: EnquiryStatus; page: number; hasMore: boolean }

const EnquiriesPage = ({ rows, names, status, page, hasMore }: Props) => (
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
              <th scope="col">{t.contact}</th>
              <th scope="col">{t.event}</th>
              <th scope="col">{t.details}</th>
              <th scope="col">{t.message}</th>
              <th scope="col">{adminT.status}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr>
                <td class="nowrap">{received(e.created_at)}</td>
                <td>
                  <strong>{e.name}</strong>
                  <div>
                    <a href={`tel:${e.phone.replace(/[\s-]/g, '')}`}>{e.phone}</a>
                  </div>
                  {e.email && (
                    <div>
                      <a href={`mailto:${e.email}`}>{e.email}</a>
                    </div>
                  )}
                </td>
                <td class="nowrap">
                  {e.event_date}
                  {e.pax && <div class="caption">{t.pax(e.pax)}</div>}
                </td>
                <td>
                  {[`p${e.package_id}`, `b${e.branch_id}`, `c${e.cuisine_id}`]
                    .map((k) => names.get(k))
                    .filter(Boolean)
                    .join(' · ')}
                </td>
                <td class="message">{e.message}</td>
                <td>
                  <StatusPill status={e.status} />
                  <form method="post" action={`/admin/enquiries/${e.id}/status`}>
                    <input type="hidden" name="filter" value={status ?? ''} />
                    <label class="visually-hidden" for={`status-${e.id}`}>
                      {t.statusFor(e.name)}
                    </label>
                    <select id={`status-${e.id}`} name="status" class="input">
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

const enquiries = new Hono<AdminEnv>()

enquiries.get('/', zValidator('query', listQuery), async (c) => {
  const { status, page } = c.req.valid('query')
  const db = c.env.DB
  const [found, packages, branches, cuisines] = await Promise.all([
    // One extra row tells us whether there is an older page.
    listEnquiries(db, { status, limit: PAGE_SIZE + 1, offset: (page - 1) * PAGE_SIZE }),
    listPackages(db),
    listBranches(db),
    listCuisines(db),
  ])
  const names = new Map([
    ...packages.map((p) => [`p${p.id}`, p.name] as const),
    ...branches.map((b) => [`b${b.id}`, b.name] as const),
    ...cuisines.map((x) => [`c${x.id}`, x.name] as const),
  ])
  return c.render(
    <EnquiriesPage rows={found.slice(0, PAGE_SIZE)} names={names} status={status} page={page} hasMore={found.length > PAGE_SIZE} />,
  )
})

enquiries.post('/:id{[0-9]+}/status', zValidator('form', enquiryStatusSchema), async (c) => {
  const { status, filter } = c.req.valid('form')
  if (!(await setEnquiryStatus(c.env.DB, Number(c.req.param('id')), status))) return c.notFound()
  return c.redirect(listUrl(filter ?? undefined), 303)
})

export default enquiries
