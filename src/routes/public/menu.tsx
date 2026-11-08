import { Hono } from 'hono'
import { listPublishedCuisines, type Cuisine } from '../../db/cuisines'
import { listPublishedMenuItems, type MenuItem } from '../../db/menu_items'
import { useI18n, withLang } from '../../lib/i18n'
import { MenuCard } from '../../views/components/MenuCard'
import { SectionTitle } from '../../views/components/SectionTitle'

const MenuPage = ({ cuisines, current, items }: { cuisines: Cuisine[]; current?: Cuisine; items: MenuItem[] }) => {
  const { lang, t } = useI18n()
  const filters = [{ slug: '', name: t.menu.all }, ...cuisines]
  return (
    <section class="section">
      <title>{`${t.menu.title} | ${t.siteName}`}</title>
      <div class="container">
        <SectionTitle title={t.menu.title} lead={t.menu.lead} />
        {cuisines.length > 0 && (
          <nav aria-label={t.menu.filterLabel}>
            <ul class="chips filters">
              {filters.map((f) => (
                <li>
                  <a
                    class="chip chip--filter"
                    href={withLang(f.slug ? `/menu?cuisine=${encodeURIComponent(f.slug)}` : '/menu', lang)}
                    aria-current={(current?.slug ?? '') === f.slug ? 'page' : undefined}
                  >
                    {f.name}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
        {items.length === 0 ? (
          <p class="empty">{t.menu.none}</p>
        ) : (
          <div class="card-grid">
            {items.map((item) => (
              <MenuCard item={item} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

const menu = new Hono<{ Bindings: Env }>()

menu.get('/', async (c) => {
  const cuisines = await listPublishedCuisines(c.env.DB)
  const current = cuisines.find((x) => x.slug === c.req.query('cuisine'))
  const items = await listPublishedMenuItems(c.env.DB, { cuisineId: current?.id })
  return c.render(<MenuPage cuisines={cuisines} current={current} items={items} />)
})

export default menu
