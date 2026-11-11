import type { PackageWithNames } from '../../db/packages'
import { formatRM } from '../../lib/format'
import { useI18n, withLang } from '../../lib/i18n'
import { Button } from './Button'
import { CheckIcon } from './Icons'
import { Photo } from './Photo'

export const PackageCard = ({ pkg }: { pkg: PackageWithNames }) => {
  const { lang, t } = useI18n()
  return (
    <article class="card package-card">
      <Photo image={pkg} class="card__photo" />
      {pkg.is_popular && <span class="tag tag--popular">{t.popular}</span>}
      <div class="card__body">
        <h3>{pkg.name}</h3>
        <ul class="chips" aria-label={`${t.packages.steps.cuisine}, ${t.packages.steps.branch}`}>
          <li class="chip">{(lang === 'bm' && pkg.cuisine_name_bm) || pkg.cuisine_name}</li>
          <li class="chip">{pkg.branch_name}</li>
        </ul>
        <p class="price">
          {formatRM(pkg.price_sen)} <span class="price__unit">{t.perPax}</span>
        </p>
        <p class="caption">{t.minPax(pkg.min_pax)}</p>
        {pkg.inclusions.length > 0 && (
          <ul class="inclusions">
            {pkg.inclusions.slice(0, 5).map((item) => (
              <li>
                <CheckIcon />
                {item}
              </li>
            ))}
          </ul>
        )}
        <Button href={withLang(`/contact?package=${encodeURIComponent(pkg.slug)}`, lang)} class="card__action">
          {t.enquire}
          <span class="visually-hidden"> {pkg.name}</span>
        </Button>
      </div>
    </article>
  )
}
