import type { MenuItem } from '../../db/menu_items'
import { inLang, type WithImage } from '../../db/shared'
import { formatRM } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { Photo } from './Photo'

export const MenuCard = ({ item: raw }: { item: MenuItem & WithImage }) => {
  const item = inLang(raw, useI18n().lang)
  return (
    <article class="card menu-card">
      <Photo image={item} class="card__photo" />
      <div class="card__body">
        <div class="menu-card__head">
          <h4>{item.name}</h4>
          {item.price_sen !== null && <p class="price price--small">{formatRM(item.price_sen)}</p>}
        </div>
        {item.description && <p class="caption menu-card__desc">{item.description}</p>}
      </div>
    </article>
  )
}
