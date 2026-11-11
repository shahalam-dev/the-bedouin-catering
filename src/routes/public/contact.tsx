import { Hono, type Context } from 'hono'
import { listPublishedBranches, type Branch } from '../../db/branches'
import { inLang, listPublishedCuisines, type Cuisine } from '../../db/cuisines'
import { listPublishedPackages, type PackageWithNames } from '../../db/packages'
import { formatRM } from '../../lib/format'
import { useI18n, withLang } from '../../lib/i18n'
import { todayInMalaysia, type EnquiryField } from '../../lib/validation'
import { site } from '../../lib/site'
import { Button } from '../../views/components/Button'
import { fieldAria, FormField } from '../../views/components/FormField'
import { SectionTitle } from '../../views/components/SectionTitle'

export type ContactOptions = { branches: Branch[]; cuisines: Cuisine[]; packages: PackageWithNames[] }

export type ContactState = {
  options: ContactOptions
  /** Raw form values, to refill the form after an error. */
  values?: Record<string, string>
  errors?: EnquiryField[]
  formError?: 'form' | 'turnstile'
  sent?: boolean
}

export async function loadContactOptions(db: D1Database): Promise<ContactOptions> {
  const [branches, cuisines, packages] = await Promise.all([
    listPublishedBranches(db),
    listPublishedCuisines(db),
    listPublishedPackages(db),
  ])
  return { branches, cuisines, packages }
}

const ContactPage = ({ options, values = {}, errors = [], formError, sent, siteKey }: ContactState & { siteKey: string }) => {
  const { lang, t } = useI18n()
  const f = t.contact.fields
  const err = (k: EnquiryField) => (errors.includes(k) ? t.contact.errors[k] : undefined)

  const text = (k: EnquiryField, type: string, attrs: Record<string, string | number | boolean> = {}) => (
    <FormField id={k} label={f[k]} error={err(k)}>
      <input id={k} name={k} type={type} value={values[k] ?? ''} class="input" {...attrs} {...fieldAria(k, err(k))} />
    </FormField>
  )

  const select = (k: 'branch_id' | 'cuisine_id' | 'package_id', items: { id: number; label: string }[]) => (
    <FormField id={k} label={f[k]} error={err(k)}>
      <select id={k} name={k} class="input" {...fieldAria(k, err(k))}>
        <option value="">{t.contact.notSure}</option>
        {items.map((i) => (
          <option value={String(i.id)} selected={values[k] === String(i.id)}>
            {i.label}
          </option>
        ))}
      </select>
    </FormField>
  )

  return (
    <section class="section">
      <title>{`${t.contact.title} | ${t.siteName}`}</title>
      <div class="container contact">
        <SectionTitle title={t.contact.title} lead={t.contact.lead} />

        {sent ? (
          <p class="notice notice--success" role="status">
            {t.contact.sent}
          </p>
        ) : (
          <form method="post" action={withLang('/api/enquiries', lang)} class="form" novalidate>
            {formError && (
              <p class="notice notice--error" role="alert">
                {formError === 'turnstile' ? t.contact.turnstileError : t.contact.formError}
              </p>
            )}
            <div class="form__grid">
              {text('name', 'text', { required: true, autocomplete: 'name', maxlength: 100 })}
              {text('phone', 'tel', { required: true, autocomplete: 'tel', inputmode: 'tel' })}
              {text('email', 'email', { autocomplete: 'email' })}
              {text('event_date', 'date', { min: todayInMalaysia() })}
              {text('pax', 'number', { min: 1, max: 10000, inputmode: 'numeric' })}
              {select('branch_id', options.branches.map((b) => ({ id: b.id, label: b.name })))}
              {select('cuisine_id', options.cuisines.map((c) => ({ id: c.id, label: inLang(c, lang).name })))}
              {select(
                'package_id',
                options.packages.map((p) => ({
                  id: p.id,
                  label: `${p.name} (${p.branch_name}, ${(lang === 'bm' && p.cuisine_name_bm) || p.cuisine_name}) ${formatRM(p.price_sen)} ${t.perPax}`,
                })),
              )}
            </div>
            <FormField id="message" label={f.message} error={err('message')}>
              <textarea id="message" name="message" rows={5} maxlength={2000} class="input" {...fieldAria('message', err('message'))}>
                {values.message ?? ''}
              </textarea>
            </FormField>

            <div class="cf-turnstile" data-sitekey={siteKey} data-language={lang === 'bm' ? 'ms' : 'en'} />
            <noscript>
              <p class="notice">
                {t.contact.noScript}{' '}
                <a href={`https://wa.me/${site.whatsappNumber}`}>WhatsApp</a>
              </p>
            </noscript>
            <Button type="submit">{t.contact.submit}</Button>
          </form>
        )}
      </div>
      <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
    </section>
  )
}

/** Shared by GET /contact and the POST handler in routes/api/enquiries. */
export function renderContact(c: Context, env: Env, state: ContactState) {
  return c.render(<ContactPage {...state} siteKey={env.TURNSTILE_SITE_KEY} />)
}

const contact = new Hono<{ Bindings: Env }>()

contact.get('/', async (c) => {
  const options = await loadContactOptions(c.env.DB)
  // ?package=<slug> (from a package card) pre-selects that package, its branch and cuisine.
  const pkg = options.packages.find((p) => p.slug === c.req.query('package'))
  const values: Record<string, string> = pkg
    ? { package_id: String(pkg.id), branch_id: String(pkg.branch_id), cuisine_id: String(pkg.cuisine_id) }
    : {}
  return renderContact(c, c.env, { options, values, sent: c.req.query('sent') === '1' })
})

export default contact
