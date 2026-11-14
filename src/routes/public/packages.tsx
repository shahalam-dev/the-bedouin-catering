import { Hono, type Context } from 'hono'
import { branchInLang, listHallBranches, type Branch } from '../../db/branches'
import { listCuisinesForService, type Cuisine } from '../../db/cuisines'
import type { MenuChoices } from '../../db/enquiries'
import { listGroups, type GroupWithItems } from '../../db/package_groups'
import { getPublishedPackageBySlug, listPublishedPackages, packageInLang, type PackageWithNames } from '../../db/packages'
import { inLang, type WithImage } from '../../db/shared'
import { formatRM } from '../../lib/format'
import { useI18n, withLang, type Lang } from '../../lib/i18n'
import { site } from '../../lib/site'
import { checkMenuChoices, todayInMalaysia, type BookingField } from '../../lib/validation'
import { Button } from '../../views/components/Button'
import { CheckIcon, XIcon } from '../../views/components/Icons'
import { fieldAria, FormField } from '../../views/components/FormField'
import { PackageCard } from '../../views/components/PackageCard'
import { Photo } from '../../views/components/Photo'
import { SectionTitle } from '../../views/components/SectionTitle'
import { Stepper } from '../../views/components/Stepper'

// Package selector: event location -> cuisine -> package -> (menu choices) -> event details.
// State lives in ?service=<in_house|outside>&cuisine=<slug>&package=<slug>&g<groupId>=<itemId>.
// Steps 1-4 are plain GET forms and step 5 POSTs to /api/enquiries/booking, so it works without JavaScript.

export type Service = 'in_house' | 'outside'
const SERVICES: Service[] = ['in_house', 'outside']

export type Selection = {
  service?: Service
  cuisines: (Cuisine & WithImage)[]
  cuisine?: Cuisine & WithImage
  packages: PackageWithNames[]
  pkg?: PackageWithNames
  groups: GroupWithItems[]
  /** Raw picks per group id, to keep boxes ticked after an error. */
  picked: Record<number, number[]>
  /** Valid choices; complete only when `bad` is empty. */
  choices: MenuChoices
  bad: number[]
  /** The menu step was submitted (shows choice errors). */
  menuSent: boolean
  /** Cuisine and package from a package card, carried through the location step. */
  carry: [string, string][]
}

/** "RM 3,500 for 100 pax"; client.ts builds the same text from data-template. */
export const estimateText = (template: string, priceSen: number, pax: number) =>
  template.replace('{total}', formatRM(priceSen * pax)).replace('{n}', String(pax))

const str = (v: unknown) => (typeof v === 'string' ? v : undefined)

/**
 * Works out how far the visitor got from the query (GET) or the form body (POST).
 * Unknown, unpublished or mismatched values fall back to their step.
 */
export async function resolveSelection(db: D1Database, q: Record<string, unknown>): Promise<Selection> {
  let service = SERVICES.find((s) => s === str(q.service))
  // From a package card: a package offered only one way decides the location.
  if (!service && str(q.package)) {
    const p = await getPublishedPackageBySlug(db, str(q.package)!)
    if (p && p.service_type !== 'both') service = p.service_type
  }
  const cuisines = service ? await listCuisinesForService(db, service) : []
  const cuisine = cuisines.find((x) => x.slug === str(q.cuisine))
  const packages = service && cuisine ? await listPublishedPackages(db, { serviceType: service, cuisineId: cuisine.id }) : []
  const pkg = packages.find((p) => p.slug === str(q.package))
  const groups = pkg ? await listGroups(db, pkg.id, { publishedOnly: true }) : []
  const { choices, bad } = checkMenuChoices(groups, q)
  const picked = Object.fromEntries(
    groups.map((g) => {
      const v = q[`g${g.id}`]
      return [g.id, (Array.isArray(v) ? v : v == null ? [] : [v]).map(Number)]
    }),
  )
  const carry = (['cuisine', 'package'] as const).flatMap((k): [string, string][] => (str(q[k]) ? [[k, str(q[k])!]] : []))
  return { service, cuisines, cuisine, packages, pkg, groups, picked, choices, bad, menuSent: q.menu === '1', carry }
}

/** Query pairs for the selection so far, up to and including `upto`. */
function pairs(sel: Selection, upto: 'service' | 'cuisine' | 'package' | 'choices'): [string, string][] {
  const out: [string, string][] = []
  if (sel.service) out.push(['service', sel.service])
  if (upto === 'service') return out
  if (sel.cuisine) out.push(['cuisine', sel.cuisine.slug])
  if (upto === 'cuisine') return out
  if (sel.pkg) out.push(['package', sel.pkg.slug])
  if (upto === 'package') return out
  for (const [gid, ids] of Object.entries(sel.choices)) for (const i of ids) out.push([`g${gid}`, String(i)])
  return out
}

const href = (p: [string, string][], lang: Lang) => withLang(p.length ? `/packages?${new URLSearchParams(p)}` : '/packages', lang)

const Hidden = ({ p }: { p: [string, string][] }) => (
  <>
    {p.map(([name, value]) => (
      <input type="hidden" name={name} value={value} />
    ))}
  </>
)

type Option = Partial<WithImage> & { slug: string; name: string; description?: string | null }

const OptionCards = ({ name, options }: { name: string; options: Option[] }) => (
  <div class="option-grid">
    {options.map((o) => (
      <label class="option-card">
        <input type="radio" name={name} value={o.slug} required checked={options.length === 1 || undefined} class="visually-hidden" />
        {o.image_key !== undefined && <Photo image={o as WithImage} class="option-card__photo" />}
        <span class="option-card__name">{o.name}</span>
        {o.description && <span class="caption">{o.description}</span>}
        <span class="option-card__check" aria-hidden="true">
          <CheckIcon />
        </span>
      </label>
    ))}
  </div>
)

const Chip = ({ label, href }: { label: string; href: string }) => {
  const { t } = useI18n()
  return (
    <li>
      <a class="chip chip--removable" href={href} aria-label={t.remove(label)}>
        {label} <XIcon />
      </a>
    </li>
  )
}

/** Step 4: one fieldset per group. A group of one is a radio list. */
const MenuStep = ({ sel }: { sel: Selection }) => {
  const { lang, t } = useI18n()
  return (
    <form method="get" action="/packages" class="selector">
      {lang === 'bm' && <input type="hidden" name="lang" value="bm" />}
      <Hidden p={pairs(sel, 'package')} />
      <input type="hidden" name="menu" value="1" />
      <h2>{t.packages.customise}</h2>
      {sel.groups.map((g) => {
        const error = sel.menuSent && sel.bad.includes(g.id) ? t.packages.choiceError(g.choose_count) : undefined
        const errId = `g${g.id}-error`
        return (
          <fieldset class="field" aria-describedby={error ? errId : undefined}>
            <legend>
              <h3>
                {(lang === 'bm' && g.name_bm) || g.name} <span class="caption">({t.packages.chooseN(g.choose_count)})</span>
              </h3>
            </legend>
            {error && (
              <p id={errId} class="field__error">
                {error}
              </p>
            )}
            <div class="option-grid">
              {g.items.map((i) => (
                <label class="option-card">
                  <input
                    type={g.choose_count === 1 ? 'radio' : 'checkbox'}
                    name={`g${g.id}`}
                    value={String(i.id)}
                    checked={sel.picked[g.id]?.includes(i.id) || undefined}
                    class="visually-hidden"
                  />
                  <span class="option-card__name">{(lang === 'bm' && i.name_bm) || i.name}</span>
                  <span class="option-card__check" aria-hidden="true">
                    <CheckIcon />
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )
      })}
      <div class="selector__actions">
        <Button variant="outline" href={href(pairs(sel, 'cuisine'), lang)}>
          {t.back}
        </Button>
        <Button type="submit">{t.next}</Button>
      </div>
    </form>
  )
}

export type DetailsState = {
  values?: Record<string, string>
  errors?: BookingField[]
  formError?: 'form' | 'turnstile'
}

/** Step 5: event details and the estimate, then POST. */
const DetailsStep = ({ sel, branches, siteKey, values = {}, errors = [], formError }: { sel: Selection; branches: Branch[]; siteKey: string } & DetailsState) => {
  const { lang, t } = useI18n()
  const f = t.packages.fields
  const pkg = packageInLang(sel.pkg!, lang)
  const outside = sel.service === 'outside'
  const err = (k: BookingField) => (errors.includes(k) ? t.packages.errors[k] : undefined)
  const pax = Number(values.pax)

  const input = (k: BookingField, type: string, attrs: Record<string, string | number | boolean> = {}) => (
    <FormField id={k} label={f[k]} error={err(k)}>
      <input id={k} name={k} type={type} value={values[k] ?? ''} class="input" {...attrs} {...fieldAria(k, err(k))} />
    </FormField>
  )

  const chosen = sel.groups.flatMap((g) => g.items.filter((i) => sel.choices[g.id]?.includes(i.id)).map((i) => (lang === 'bm' && i.name_bm) || i.name))

  if (!outside && branches.length === 0) return <p class="notice">{t.packages.noHall}</p>

  return (
    <form method="post" action={withLang('/api/enquiries/booking', lang)} class="selector form" novalidate>
      <Hidden p={pairs(sel, 'choices')} />
      <h2>{t.packages.details}</h2>
      {formError && (
        <p class="notice notice--error" role="alert">
          {formError === 'turnstile' ? t.contact.turnstileError : t.contact.formError}
        </p>
      )}
      <div class="notice">
        <strong>{pkg.name}</strong> · {formatRM(pkg.price_sen)} {t.perPax} · {t.packages.paxRange(pkg.min_pax, pkg.max_pax)}
        {chosen.length > 0 && <div class="caption">{chosen.join(', ')}</div>}
      </div>

      <div class="form__grid">
        {!outside && (
          <FormField id="branch_id" label={f.branch_id} error={err('branch_id')}>
            <select id="branch_id" name="branch_id" class="input" required {...fieldAria('branch_id', err('branch_id'))}>
              {branches.length > 1 && <option value="">{t.packages.pickBranch}</option>}
              {branches.map((b) => (
                <option value={String(b.id)} selected={values.branch_id === String(b.id)}>
                  {`${branchInLang(b, lang).name} (${t.packages.hall(b.hall_capacity)})`}
                </option>
              ))}
            </select>
          </FormField>
        )}
        {input('event_date', 'date', { required: true, min: todayInMalaysia() })}
        {input('event_time', 'time', { required: true })}
        {input('pax', 'number', { required: true, min: pkg.min_pax, max: pkg.max_pax ?? 10000, inputmode: 'numeric' })}
        {outside && input('address_line', 'text', { required: true, autocomplete: 'street-address', maxlength: 300 })}
        {outside && input('postcode', 'text', { required: true, autocomplete: 'postal-code', inputmode: 'numeric', maxlength: 5 })}
        {outside && input('city', 'text', { required: true, autocomplete: 'address-level2', maxlength: 80 })}
        {outside && input('state', 'text', { required: true, autocomplete: 'address-level1', maxlength: 60 })}
        {input('name', 'text', { required: true, autocomplete: 'name', maxlength: 100 })}
        {input('phone', 'tel', { required: true, autocomplete: 'tel', inputmode: 'tel' })}
        {input('email', 'email', { autocomplete: 'email' })}
      </div>
      {outside && (
        <FormField id="setup_notes" label={f.setup_notes} error={err('setup_notes')}>
          <textarea id="setup_notes" name="setup_notes" rows={3} maxlength={1000} class="input" {...fieldAria('setup_notes', err('setup_notes'))}>
            {values.setup_notes ?? ''}
          </textarea>
        </FormField>
      )}
      <FormField id="message" label={f.message} error={err('message')}>
        <textarea id="message" name="message" rows={3} maxlength={2000} class="input" {...fieldAria('message', err('message'))}>
          {values.message ?? ''}
        </textarea>
      </FormField>

      {/* client.ts updates this as pax changes; the server works out the saved estimate. */}
      <p class="notice" aria-live="polite" data-estimate={pkg.price_sen} data-template={t.packages.estimateFor} data-hint={t.packages.estimateHint}>
        <strong>{t.packages.estimate}: </strong>
        <span data-estimate-value>{pax > 0 ? estimateText(t.packages.estimateFor, pkg.price_sen, pax) : t.packages.estimateHint}</span>
        {outside && <span> {t.packages.deliveryNote}</span>}
        <span class="caption"> {t.packages.estimateNote}</span>
      </p>

      <div class="cf-turnstile" data-sitekey={siteKey} data-language={lang === 'bm' ? 'ms' : 'en'} />
      <noscript>
        <p class="notice">
          {t.contact.noScript} <a href={`https://wa.me/${site.whatsappNumber}`}>WhatsApp</a>
        </p>
      </noscript>
      <div class="selector__actions">
        <Button variant="outline" href={href(pairs(sel, sel.groups.length ? 'package' : 'cuisine'), lang)}>
          {t.back}
        </Button>
        <Button type="submit">{t.packages.submit}</Button>
      </div>
      <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
    </form>
  )
}

const SentPage = ({ estimate, outside }: { estimate?: number; outside: boolean }) => {
  const { lang, t } = useI18n()
  return (
    <div class="selector">
      <p class="notice notice--success" role="status">
        {t.packages.sent}
      </p>
      {estimate != null && (
        <p class="notice">
          <strong>{t.packages.sentEstimate}: </strong>
          {formatRM(estimate)}
          {outside && ` ${t.packages.deliveryNote}`}
        </p>
      )}
      <div class="selector__actions">
        <Button variant="outline" href={withLang('/packages', lang)}>
          {t.packages.startAgain}
        </Button>
      </div>
    </div>
  )
}

type Props = { sel: Selection; branches: Branch[]; siteKey: string; details?: DetailsState; sent?: { estimate?: number; outside: boolean } }

const PackagesPage = ({ sel, branches, siteKey, details, sent }: Props) => {
  const { lang, t } = useI18n()
  const cuisines = sel.cuisines.map((x) => inLang(x, lang))
  const cuisine = sel.cuisine && inLang(sel.cuisine, lang)
  const hasMenu = sel.groups.length > 0
  const labels = [t.packages.steps.service, t.packages.steps.cuisine, t.packages.steps.package, ...(hasMenu ? [t.packages.steps.customise] : []), t.packages.steps.details]
  const stage = !sel.service ? 'service' : !cuisine ? 'cuisine' : !sel.pkg ? 'package' : hasMenu && sel.bad.length ? 'menu' : 'details'
  const step = stage === 'details' ? labels.length - 1 : ['service', 'cuisine', 'package', 'menu'].indexOf(stage)
  const services = SERVICES.map((s) => ({ slug: s, ...t.packages.services[s] }))

  return (
    <section class="section">
      <title>{`${t.packages.title} | ${t.siteName}`}</title>
      <div class="container">
        <SectionTitle title={t.packages.title} lead={t.packages.lead} />
        {sent ? (
          <SentPage {...sent} />
        ) : (
          <>
            <Stepper labels={labels} current={step} />

            {sel.service && (
              <ul class="chips selections" aria-label={t.packages.selections}>
                <Chip label={`${t.packages.steps.service}: ${t.packages.services[sel.service].name}`} href={withLang('/packages', lang)} />
                {cuisine && <Chip label={`${t.packages.steps.cuisine}: ${cuisine.name}`} href={href(pairs(sel, 'service'), lang)} />}
                {sel.pkg && <Chip label={`${t.packages.steps.package}: ${packageInLang(sel.pkg, lang).name}`} href={href(pairs(sel, 'cuisine'), lang)} />}
              </ul>
            )}

            {step < 2 ? (
              <form method="get" action="/packages" class="selector">
                {lang === 'bm' && <input type="hidden" name="lang" value="bm" />}
                {/* Step 1 keeps a package picked from a card, so the visitor lands straight on it. */}
                <Hidden p={step === 0 ? sel.carry : [...pairs(sel, 'service'), ...sel.carry.filter(([k]) => k === 'package')]} />
                <fieldset>
                  <legend>
                    <h2>{step === 0 ? t.packages.chooseService : t.packages.chooseCuisine}</h2>
                  </legend>
                  {step === 0 ? (
                    <OptionCards name="service" options={services} />
                  ) : cuisines.length === 0 ? (
                    <p>{t.packages.none}</p>
                  ) : (
                    <OptionCards name="cuisine" options={cuisines} />
                  )}
                </fieldset>
                <div class="selector__actions">
                  {step > 0 && (
                    <Button variant="outline" href={withLang('/packages', lang)}>
                      {t.back}
                    </Button>
                  )}
                  <Button type="submit">{t.next}</Button>
                </div>
              </form>
            ) : step === 2 ? (
              <div class="selector">
                <h2>{t.packages.choosePackage}</h2>
                {sel.packages.length === 0 ? (
                  <p>{t.packages.none}</p>
                ) : (
                  <div class="card-grid">
                    {sel.packages.map((p) => (
                      <PackageCard pkg={p} href={href([...pairs(sel, 'cuisine'), ['package', p.slug]], lang)} />
                    ))}
                  </div>
                )}
                <div class="selector__actions">
                  <Button variant="outline" href={href(pairs(sel, 'service'), lang)}>
                    {t.back}
                  </Button>
                </div>
              </div>
            ) : stage === 'menu' ? (
              <MenuStep sel={sel} />
            ) : (
              <DetailsStep sel={sel} branches={branches} siteKey={siteKey} {...details} />
            )}
          </>
        )}
      </div>
    </section>
  )
}

/** Shared by GET /packages and the booking POST in routes/api/enquiries. */
export async function renderPackages(c: Context<{ Bindings: Env }>, sel: Selection, details?: DetailsState) {
  const branches = sel.service === 'in_house' && sel.pkg ? await listHallBranches(c.env.DB) : []
  return c.render(<PackagesPage sel={sel} branches={branches} siteKey={c.env.TURNSTILE_SITE_KEY} details={details} />)
}

const packages = new Hono<{ Bindings: Env }>()

packages.get('/', async (c) => {
  if (c.req.query('sent') === '1') {
    // Estimate and type come back in the redirect URL; they are only displayed, never trusted.
    const est = Number(c.req.query('estimate'))
    const sent = { estimate: Number.isSafeInteger(est) && est >= 0 ? est : undefined, outside: c.req.query('service') === 'outside' }
    return c.render(<PackagesPage sel={await resolveSelection(c.env.DB, {})} branches={[]} siteKey="" sent={sent} />)
  }
  // Repeated keys (several dishes in one group) stay arrays; single values become strings.
  const q = Object.fromEntries(Object.entries(c.req.queries()).map(([k, v]) => [k, v.length === 1 ? v[0] : v]))
  return renderPackages(c, await resolveSelection(c.env.DB, q))
})

export default packages
