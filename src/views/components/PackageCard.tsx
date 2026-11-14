import { inLang } from '../../db/shared'
import type { PackageWithNames } from '../../db/packages'
import { useI18n, withLang } from '../../lib/i18n'
import { Button } from './Button'
import { PdfLink } from './PdfLink'
import { Photo } from './Photo'

/** Poster, name, details PDF. `href` is the Enquire link; by default it starts the package selector with this package. */
export const PackageCard = ({ pkg: raw, href }: { pkg: PackageWithNames; href?: string }) => {
  const { lang, t } = useI18n()
  const pkg = inLang(raw, lang)
  return (
    <article class="card poster-card">
      <Photo image={pkg} class="card__photo" />
      <div class="card__body">
        <h3>{pkg.name}</h3>
        {pkg.pdf_key && <PdfLink pdfKey={pkg.pdf_key} name={pkg.name} />}
        <Button
          href={href ?? withLang(`/packages?${new URLSearchParams({ cuisine: pkg.cuisine_slug, package: pkg.slug })}`, lang)}
          class="card__action"
        >
          {t.enquire}
          <span class="visually-hidden"> {pkg.name}</span>
        </Button>
      </div>
    </article>
  )
}
