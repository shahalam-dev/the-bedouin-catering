import { Hono } from 'hono'
import { branchInLang, listPublishedBranches, type Branch } from '../../db/branches'
import { inLang, listCuisinesForBranch, type Cuisine } from '../../db/cuisines'
import { listPublishedPackages, type PackageWithNames } from '../../db/packages'
import type { WithImage } from '../../db/shared'
import { useI18n, withLang } from '../../lib/i18n'
import { Button } from '../../views/components/Button'
import { CheckIcon, XIcon } from '../../views/components/Icons'
import { PackageCard } from '../../views/components/PackageCard'
import { Photo } from '../../views/components/Photo'
import { SectionTitle } from '../../views/components/SectionTitle'
import { Stepper } from '../../views/components/Stepper'

// Package selector: branch -> cuisine -> packages, driven by ?branch=<slug>&cuisine=<slug>.
// Each step is a plain GET form, so it works without JavaScript.

type Option = WithImage & { slug: string; name: string; description?: string | null }

const OptionCards = ({ name, options }: { name: 'branch' | 'cuisine'; options: Option[] }) => (
  <div class="option-grid">
    {options.map((o) => (
      <label class="option-card">
        <input type="radio" name={name} value={o.slug} required checked={options.length === 1 || undefined} class="visually-hidden" />
        <Photo image={o} class="option-card__photo" />
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

type Props = {
  branches: (Branch & WithImage)[]
  branch?: Branch
  cuisines: (Cuisine & WithImage)[]
  cuisine?: Cuisine
  packages: PackageWithNames[]
}

const PackagesPage = ({ branches: rawBranches, branch: rawBranch, cuisines: rawCuisines, cuisine: rawCuisine, packages }: Props) => {
  const { lang, t } = useI18n()
  const branches = rawBranches.map((x) => branchInLang(x, lang))
  const branch = rawBranch && branchInLang(rawBranch, lang)
  const cuisines = rawCuisines.map((x) => inLang(x, lang))
  const cuisine = rawCuisine && inLang(rawCuisine, lang)
  const step = !branch ? 0 : !cuisine ? 1 : 2
  const branchHref = (slug: string) => withLang(`/packages?branch=${encodeURIComponent(slug)}`, lang)

  return (
    <section class="section">
      <title>{`${t.packages.title} | ${t.siteName}`}</title>
      <div class="container">
        <SectionTitle title={t.packages.title} lead={t.packages.lead} />
        <Stepper current={step} />

        {branch && (
          <ul class="chips selections" aria-label={t.packages.selections}>
            <Chip label={`${t.packages.steps.branch}: ${branch.name}`} href={withLang('/packages', lang)} />
            {cuisine && <Chip label={`${t.packages.steps.cuisine}: ${cuisine.name}`} href={branchHref(branch.slug)} />}
          </ul>
        )}

        {step < 2 ? (
          <form method="get" action="/packages" class="selector">
            {lang === 'bm' && <input type="hidden" name="lang" value="bm" />}
            {branch && <input type="hidden" name="branch" value={branch.slug} />}
            <fieldset>
              <legend>
                <h2>{step === 0 ? t.packages.chooseBranch : t.packages.chooseCuisine}</h2>
              </legend>
              {(step === 0 ? branches : cuisines).length === 0 ? (
                <p>{t.packages.none}</p>
              ) : (
                <OptionCards name={step === 0 ? 'branch' : 'cuisine'} options={step === 0 ? branches : cuisines} />
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
        ) : (
          <div class="selector">
            <h2>{t.packages.choosePackage}</h2>
            {packages.length === 0 ? (
              <p>{t.packages.none}</p>
            ) : (
              <div class="card-grid">
                {packages.map((p) => (
                  <PackageCard pkg={p} />
                ))}
              </div>
            )}
            <div class="selector__actions">
              <Button variant="outline" href={branchHref(branch!.slug)}>
                {t.back}
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

const packages = new Hono<{ Bindings: Env }>()

packages.get('/', async (c) => {
  const db = c.env.DB
  const branches = await listPublishedBranches(db)
  // Unknown or unpublished slugs fall back to the previous step.
  const branch = branches.find((b) => b.slug === c.req.query('branch'))
  const cuisines = branch ? await listCuisinesForBranch(db, branch.id) : []
  const cuisine = cuisines.find((x) => x.slug === c.req.query('cuisine'))
  const list = branch && cuisine ? await listPublishedPackages(db, { branchId: branch.id, cuisineId: cuisine.id }) : []

  return c.render(<PackagesPage branches={branches} branch={branch} cuisines={cuisines} cuisine={cuisine} packages={list} />)
})

export default packages
