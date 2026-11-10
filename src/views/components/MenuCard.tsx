import type { MenuItem } from '../../db/menu_items'
import type { WithImage } from '../../db/shared'
import { formatRM } from '../../lib/format'
import { Photo } from './Photo'

export const MenuCard = ({ item }: { item: MenuItem & WithImage }) => (
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
