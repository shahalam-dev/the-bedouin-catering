import { Hono } from 'hono'
import { listPublishedOccasions, type Occasion } from '../../db/occasions'
import type { WithImage } from '../../db/shared'
import { useI18n, withLang } from '../../lib/i18n'
import { Button } from '../../views/components/Button'
import { CategoryCard } from '../../views/components/CategoryCard'
import { SectionTitle } from '../../views/components/SectionTitle'

const OccasionsPage = ({ occasions }: { occasions: (Occasion & WithImage)[] }) => {
  const { lang, t } = useI18n()
  return (
    <>
      <section class="section">
        <title>{`${t.occasions.title} | ${t.siteName}`}</title>
        <div class="container">
          <SectionTitle title={t.occasions.title} lead={t.occasions.lead} />
          {occasions.length === 0 ? (
            <p class="empty">{t.occasions.none}</p>
          ) : (
            <div class="card-grid">
              {occasions.map((o, i) => (
                <CategoryCard label={o.name} image={o} tone={i % 2 ? 'ink' : 'crimson'}>
                  {o.description && <p>{o.description}</p>}
                </CategoryCard>
              ))}
            </div>
          )}
        </div>
      </section>
      <section class="section cta-band on-dark">
        <div class="container">
          <h2>{t.occasions.cta}</h2>
          <Button variant="inverse" href={withLang('/contact', lang)}>
            {t.getQuote}
          </Button>
        </div>
      </section>
    </>
  )
}

const occasions = new Hono<{ Bindings: Env }>()

occasions.get('/', async (c) => c.render(<OccasionsPage occasions={await listPublishedOccasions(c.env.DB)} />))

export default occasions
