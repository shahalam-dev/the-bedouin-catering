import type { MenuItem } from '../../db/menu_items'
import { formatRM } from '../../lib/format'

export const MenuCard = ({ item }: { item: MenuItem }) => (
  <article class="card menu-card">
    {/* shortcut: placeholder until dish photos are served from R2 via /media/:key */}
    <div class="card__photo" aria-hidden="true" />
    <div class="card__body">
      <div class="menu-card__head">
        <h4>{item.name}</h4>
        {item.price_sen !== null && <p class="price price--small">{formatRM(item.price_sen)}</p>}
      </div>
      {item.description && <p class="caption menu-card__desc">{item.description}</p>}
    </div>
  </article>
)
