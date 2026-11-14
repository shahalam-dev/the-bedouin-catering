import type { MenuItem } from '../../db/menu_items'
import { inLang, type WithImage } from '../../db/shared'
import { useI18n } from '../../lib/i18n'
import { PdfLink } from './PdfLink'
import { Photo } from './Photo'

/** Poster, name, details PDF. */
export const MenuCard = ({ item: raw }: { item: MenuItem & WithImage }) => {
  const item = inLang(raw, useI18n().lang)
  return (
    <article class="card poster-card">
      <Photo image={item} class="card__photo" />
      <div class="card__body">
        <h4>{item.name}</h4>
        {item.pdf_key && <PdfLink pdfKey={item.pdf_key} name={item.name} />}
      </div>
    </article>
  )
}
