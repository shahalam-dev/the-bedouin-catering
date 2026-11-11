import { Hono } from 'hono'
import { listPublishedGallery, type GalleryItem } from '../../db/gallery'
import type { WithImage } from '../../db/shared'
import { useI18n } from '../../lib/i18n'
import { EventGallery } from '../../views/components/EventGallery'
import { SectionTitle } from '../../views/components/SectionTitle'

const GalleryPage = ({ items, event }: { items: (GalleryItem & WithImage)[]; event?: string }) => {
  const { t } = useI18n()
  return (
    <section class="section" id="gallery">
      <title>{`${t.gallery.title} | ${t.siteName}`}</title>
      <div class="container">
        <SectionTitle title={t.gallery.title} lead={t.gallery.lead} />
        {items.length === 0 ? <p class="empty">{t.gallery.none}</p> : <EventGallery items={items} path="/gallery" event={event} />}
      </div>
    </section>
  )
}

const gallery = new Hono<{ Bindings: Env }>()

gallery.get('/', async (c) => c.render(<GalleryPage items={await listPublishedGallery(c.env.DB)} event={c.req.query('event')} />))

export default gallery
