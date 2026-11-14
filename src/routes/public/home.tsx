import { Hono } from 'hono'
import { listPublishedClients, type Client } from '../../db/clients'
import { listPublishedGallery, type GalleryItem } from '../../db/gallery'
import { listPublishedOccasions, type Occasion } from '../../db/occasions'
import { listPublishedPackages, type PackageWithNames } from '../../db/packages'
import { inLang, type WithImage } from '../../db/shared'
import { listRandomTestimonials, type Testimonial, type TestimonialStats } from '../../db/testimonials'
import { HERO_VIDEO } from '../../lib/hero'
import { imgUrl } from '../../lib/images'
import { useI18n, withLang } from '../../lib/i18n'
import { TEAM } from '../../lib/team'
import { WHY_US } from '../../lib/why-us'
import { Button } from '../../views/components/Button'
import { ClientLogos } from '../../views/components/ClientLogos'
import { EventGallery } from '../../views/components/EventGallery'
import { HeroVideo } from '../../views/components/HeroVideo'
import { BellIcon, CalendarCheckIcon, CheckIcon, ChefHatIcon, ChevronIcon, LeafIcon, StarIcon } from '../../views/components/Icons'
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

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

const Avatar = ({ item }: { item: Testimonial & WithImage }) =>
  item.image_key ? (
    <img class="t-avatar" src={imgUrl(item.image_key, 'thumb')} alt={item.image_alt ?? ''} width="56" height="56" loading="lazy" decoding="async" />
  ) : (
    <span class="t-avatar" aria-hidden="true">
      {initials(item.name)}
    </span>
  )

const Who = ({ item }: { item: Testimonial }) => {
  const sub = [item.role, item.location].filter(Boolean).join(' · ')
  return (
    <span class="testimonials__who">
      <span class="testimonials__name">{item.name}</span>
      {sub && <span class="testimonials__sub">{sub}</span>}
    </span>
  )
}

const pad = (n: number) => String(n).padStart(2, '0')

// Works without JS: list and arrows are links to ?t=<id>, which the server shows first.
// Index 0 is always the active one: the server puts the requested testimonial first. public/js/testimonials.js turns them into
// in-page switches and auto-advances.
const Testimonials = ({ items }: { items: (Testimonial & WithImage & TestimonialStats)[] }) => {
  const active = 0
  const { lang, t } = useI18n()
  const n = items.length
  const avg = Number(items[0].avg_rating.toFixed(1))
  const href = (i: number) => `${withLang(`/?t=${items[(i + n) % n].id}`, lang)}#testimonials`
  const [before, accent, after] = t.home.testimonialsTitle
  return (
    <section class="section testimonials" id="testimonials" data-testimonials>
      <div class="container testimonials__grid">
        <div class="testimonials__intro">
          <p class="testimonials__eyebrow">{t.home.testimonialsEyebrow}</p>
          <h2>
            {before}
            <span class="testimonials__accent">{accent}</span>
            {after}
          </h2>
          <p class="lead">{t.home.testimonialsLead}</p>
          <div class="card testimonials__score">
            <span class="testimonials__avg">{avg.toFixed(1)}</span>
            <span>
              <span class="testimonials__stars" role="img" aria-label={t.home.rating(avg)}>
                {Array.from({ length: Math.round(avg) }, () => (
                  <StarIcon />
                ))}
              </span>
              <span class="caption">{t.home.reviewCount(items[0].total)}</span>
            </span>
          </div>
          <ul class="testimonials__list">
            {items.map((item, i) => (
              <li>
                <a class="testimonials__item" href={href(i)} data-t-go={i} aria-current={i === active ? 'true' : undefined}>
                  <Avatar item={item} />
                  <Who item={item} />
                  {item.event_type && <span class="testimonials__pill">{item.event_type}</span>}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div class="testimonials__panel on-dark">
          {items.map((item, i) => (
            <figure class="testimonials__slide" hidden={i !== active}>
              {(item.event_type || item.event_detail) && (
                <p class="testimonials__event">
                  {item.event_type && <span class="testimonials__tag">{item.event_type}</span>}
                  {item.event_detail}
                </p>
              )}
              <blockquote>
                <p>“{item.quote}”</p>
              </blockquote>
              <div class="testimonials__foot">
                <figcaption>
                  <Avatar item={item} />
                  <Who item={item} />
                </figcaption>
                {n > 1 && (
                  <nav class="testimonials__nav" aria-label={t.home.testimonialsTitle.join('')}>
                    <span class="testimonials__count">
                      {pad(i + 1)} / {pad(n)}
                    </span>
                    <a class="testimonials__arrow" href={href(i - 1)} data-t-go="prev" aria-label={t.back}>
                      <ChevronIcon dir="left" />
                    </a>
                    <a class="testimonials__arrow" href={href(i + 1)} data-t-go="next" aria-label={t.next}>
                      <ChevronIcon dir="right" />
                    </a>
                  </nav>
                )}
              </div>
            </figure>
          ))}
        </div>
      </div>
      <script src="/js/testimonials.js" defer />
    </section>
  )
}

const WHY_ICONS = { chef: ChefHatIcon, bell: BellIcon, calendar: CalendarCheckIcon, leaf: LeafIcon }

const WhyUs = () => {
  const { lang, t } = useI18n()
  const [before, accent, after] = t.home.whyTitle
  return (
    <section class="section why" id="why-us">
      <div class="container">
        <header class="section-title">
          <p class="why__eyebrow">{t.home.whyEyebrow}</p>
          <h2>
            {before}
            <span class="why__accent">{accent}</span>
            {after}
          </h2>
          <p class="lead">{t.home.whyLead}</p>
        </header>
        <div class="why__grid">
          <figure class="why__visual">
            {/* Decorative: the same claims are in the checklist below. */}
            <svg class="why__ring" viewBox="0 0 400 400" aria-hidden="true">
              <path id="why-ring" d="M200 200m-180 0a180 180 0 1 1 360 0a180 180 0 1 1-360 0" fill="none" />
              <text>
                <textPath href="#why-ring" textLength="1125" lengthAdjust="spacing">
                  {WHY_US.ring[lang]}
                </textPath>
              </text>
            </svg>
            <div class="why__photos" data-why-photos>
              {WHY_US.images.map((img, i) => (
                <img
                  class="why__photo"
                  src={img.src}
                  alt={img.alt[lang]}
                  aria-hidden={i > 0 ? 'true' : undefined}
                  data-active={i === 0 ? '' : undefined}
                  width="600"
                  height="600"
                  loading="lazy"
                  decoding="async"
                />
              ))}
            </div>
            <figcaption class="why__badge">
              <span class="why__badge-stat">{WHY_US.badge.stat}</span>
              <span class="why__badge-label">{WHY_US.badge.label[lang]}</span>
            </figcaption>
          </figure>
          {WHY_US.features.map((f) => {
            const Icon = WHY_ICONS[f.icon]
            return (
              <div class="why__item">
                <span class="why__icon">
                  <Icon />
                </span>
                <div>
                  <h3>
                    <span class="why__stat">{f.stat}</span> {f.title[lang]}
                  </h3>
                  <p>{f.text[lang]}</p>
                </div>
              </div>
            )
          })}
        </div>
        <div class="why__bar">
          <ul>
            {WHY_US.checks.map((c) => (
              <li>
                <CheckIcon />
                {c[lang]}
              </li>
            ))}
          </ul>
          <Button href="#team">{t.home.teamTitle}</Button>
        </div>
      </div>
      <script src="/js/why-us.js" defer />
    </section>
  )
}

const TeamSection = () => {
  const { lang, t } = useI18n()
  return (
    <section class="section team" id="team">
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

// The rest are on /clients and /gallery.
const HOME_CLIENTS = 8
const HOME_GALLERY = 10
const HOME_TESTIMONIALS = 10

type Props = { clients: (Client & WithImage)[]; gallery: (GalleryItem & WithImage)[]; event?: string; occasions: Occasion[]; packages: PackageWithNames[]; testimonials: (Testimonial & WithImage & TestimonialStats)[] }

const HomePage = ({ clients, gallery, event, occasions, packages, testimonials }: Props) => {
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

      <WhyUs />

      {gallery.length > 0 && (
        <section class="section gallery" id="gallery">
          <div class="container">
            <SectionTitle as="h2" title={t.gallery.title} lead={t.gallery.lead} />
            <EventGallery items={gallery} path="/" event={event} limit={HOME_GALLERY} />
            <div class="section__more">
              <Button variant="outline" href={withLang('/gallery', lang)}>
                {t.gallery.viewAll}
              </Button>
            </div>
          </div>
        </section>
      )}

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

      <section class="section cta-band on-dark">
        <div class="container">
          <h2>{t.occasions.cta}</h2>
          <Button variant="inverse" href={withLang('/contact', lang)}>
            {t.getQuote}
          </Button>
        </div>
      </section>

      {testimonials.length > 0 && <Testimonials items={testimonials} />}

      <TeamSection />
    </>
  )
}

const home = new Hono<{ Bindings: Env }>()

home.get('/', async (c) => {
  const db = c.env.DB
  const [clients, gallery, occasions, packages, testimonials] = await Promise.all([
    listPublishedClients(db, HOME_CLIENTS),
    listPublishedGallery(db),
    listPublishedOccasions(db),
    listPublishedPackages(db), // already sorted popular first
    listRandomTestimonials(db, HOME_TESTIMONIALS, Number(c.req.query('t')) || 0),
  ])
  return c.render(
    <HomePage clients={clients} gallery={gallery} event={c.req.query('event')} occasions={occasions} packages={packages.slice(0, 3)} testimonials={testimonials} />,
  )
})

export default home
