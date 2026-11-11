import { Hono } from 'hono'
import { listPublishedClients, type Client } from '../../db/clients'
import { listPublishedOccasions, type Occasion } from '../../db/occasions'
import { listPublishedPackages, type PackageWithNames } from '../../db/packages'
import { inLang, type WithImage } from '../../db/shared'
import { listPublishedTestimonials, type Testimonial } from '../../db/testimonials'
import { HERO_VIDEO } from '../../lib/hero'
import { useI18n, withLang } from '../../lib/i18n'
import { TEAM } from '../../lib/team'
import { Button } from '../../views/components/Button'
import { ClientLogos } from '../../views/components/ClientLogos'
import { HeroVideo } from '../../views/components/HeroVideo'
import { StarIcon } from '../../views/components/Icons'
import { PackageCard } from '../../views/components/PackageCard'
import { SectionTitle } from '../../views/components/SectionTitle'

const OccasionStrip = ({ occasions }: { occasions: Occasion[] }) => {
  const { lang, t } = useI18n()
  const items = occasions.map((o) => <li>{inLang(o, lang).name}</li>)
  return (
    <section class="occasion-strip" aria-label={t.nav.occasions}>
      <div class="occasion-strip__track">
        <ul>{items}</ul>
        {/* Second copy makes the loop seamless; hidden from screen readers. */}
        <ul aria-hidden="true">{items}</ul>
      </div>
    </section>
  )
}

const TestimonialCard = ({ item }: { item: Testimonial }) => {
  const { t } = useI18n()
  return (
    <figure class="card testimonial-card">
      <p class="testimonial-card__stars" role="img" aria-label={t.home.rating(item.rating)}>
        {Array.from({ length: item.rating }, () => (
          <StarIcon />
        ))}
      </p>
      <blockquote>
        <p>{item.quote}</p>
      </blockquote>
      <figcaption>
        <span class="testimonial-card__name">{item.customer_name}</span>
        {item.event_type && <span class="caption">{item.event_type}</span>}
      </figcaption>
    </figure>
  )
}

const TeamSection = () => {
  const { lang, t } = useI18n()
  return (
    <section class="section team">
      <div class="container">
        <SectionTitle as="h2" title={t.home.teamTitle} lead={t.home.teamLead} />
        <ul class="card-grid team__list">
          {TEAM.map((m) => (
            <li class="card team-card">
              <img
                class="team-card__photo"
                src={m.image}
                alt={t.home.teamPhotoAlt(m.name)}
                width="1333"
                height="2000"
                loading="lazy"
                decoding="async"
              />
              <div class="card__body">
                <h3>{m.name}</h3>
                <p class="caption team-card__role">{m.role[lang]}</p>
                <p>{m.bio[lang]}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

// The rest are on /clients.
const HOME_CLIENTS = 8

type Props = { clients: (Client & WithImage)[]; occasions: Occasion[]; packages: PackageWithNames[]; testimonials: Testimonial[] }

const HomePage = ({ clients, occasions, packages, testimonials }: Props) => {
  const { lang, t } = useI18n()
  return (
    <>
      <title>{`${t.home.title} | ${t.siteName}`}</title>
      <link rel="preload" as="image" href={HERO_VIDEO.poster} />
      <section class="hero on-dark" style={`--hero-poster: url("${HERO_VIDEO.poster}")`}>
        <HeroVideo />
        <div class="container hero__inner">
          <h1 class="display">{t.home.heroTitle}</h1>
          <p class="lead">{t.home.heroLead}</p>
          <div class="hero__actions">
            <Button href={withLang('/packages', lang)}>{t.home.viewPackages}</Button>
            <Button variant="inverse" href={withLang('/contact', lang)}>
              {t.getQuote}
            </Button>
          </div>
        </div>
      </section>

      {occasions.length > 0 && <OccasionStrip occasions={occasions} />}

      {clients.length > 0 && (
        <section class="section clients">
          <div class="container">
            <SectionTitle as="h2" title={t.clients.title} lead={t.clients.lead} />
            <ClientLogos clients={clients} />
            <div class="section__more">
              <Button variant="outline" href={withLang('/clients', lang)}>
                {t.clients.all}
              </Button>
            </div>
          </div>
        </section>
      )}

      {packages.length > 0 && (
        <section class="section">
          <div class="container">
            <SectionTitle as="h2" title={t.home.popularTitle} lead={t.home.popularLead} />
            <div class="card-grid">
              {packages.map((p) => (
                <PackageCard pkg={p} />
              ))}
            </div>
            <div class="section__more">
              <Button variant="outline" href={withLang('/packages', lang)}>
                {t.home.allPackages}
              </Button>
            </div>
          </div>
        </section>
      )}

      {testimonials.length > 0 && (
        <section class="section testimonials">
          <div class="container">
            <SectionTitle as="h2" title={t.home.testimonialsTitle} />
            <div class="card-grid">
              {testimonials.map((item) => (
                <TestimonialCard item={item} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section class="section cta-band on-dark">
        <div class="container">
          <h2>{t.occasions.cta}</h2>
          <Button variant="inverse" href={withLang('/contact', lang)}>
            {t.getQuote}
          </Button>
        </div>
      </section>

      <TeamSection />
    </>
  )
}

const home = new Hono<{ Bindings: Env }>()

home.get('/', async (c) => {
  const db = c.env.DB
  const [clients, occasions, packages, testimonials] = await Promise.all([
    listPublishedClients(db, HOME_CLIENTS),
    listPublishedOccasions(db),
    listPublishedPackages(db), // already sorted popular first
    listPublishedTestimonials(db),
  ])
  return c.render(
    <HomePage clients={clients} occasions={occasions} packages={packages.slice(0, 3)} testimonials={testimonials.slice(0, 3)} />,
  )
})

export default home
