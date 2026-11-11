import type { GalleryItem } from '../../db/gallery'
import type { WithImage } from '../../db/shared'
import { useI18n, withLang } from '../../lib/i18n'
import { Photo } from './Photo'

type Item = GalleryItem & WithImage

/**
 * Filter chips + photo grid. Chips are plain links (?event=...) so filtering works without JS.
 * `path` is the page the chips link back to; `limit` caps the cards shown (chip counts still use all items).
 */
export const EventGallery = ({ items, path, event, limit }: { items: Item[]; path: string; event?: string; limit?: number }) => {
  const { lang, t } = useI18n()
  const counts = new Map<string, number>()
  for (const i of items) counts.set(i.event_type, (counts.get(i.event_type) ?? 0) + 1)
  const current = event && counts.has(event) ? event : ''
  const shown = items.filter((i) => !current || i.event_type === current).slice(0, limit)
  const chips = [{ type: '', label: t.gallery.all, count: items.length }, ...[...counts].map(([type, count]) => ({ type, label: type, count }))]

  return (
    <>
      <nav aria-label={t.gallery.filterLabel}>
        <ul class="chips filters">
          {chips.map((c) => (
            <li>
              <a
                class="chip chip--filter"
                href={`${withLang(c.type ? `${path}?event=${encodeURIComponent(c.type)}` : path, lang)}#gallery`}
                aria-current={c.type === current ? 'page' : undefined}
              >
                {c.label} <span class="gallery-chip__count">({c.count})</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <ul class="gallery-grid">
        {shown.map((i, n) => (
          <li class={`gallery-card${i.is_tall ? ' gallery-card--tall' : ''}`}>
            <Photo image={i} class="gallery-card__photo" />
            <span class={`tag gallery-card__tag category-card__tag--${n % 2 ? 'ink' : 'crimson'}`}>{i.event_type}</span>
            <div class="gallery-card__body on-dark">
              <h3>{i.name}</h3>
              {i.caption && <p class="caption">{i.caption}</p>}
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
