import { useRequestContext } from 'hono/jsx-renderer'
import { useI18n, withLang, type Lang } from '../../lib/i18n'
import { Button } from './Button'

const links = [
  { key: 'home', path: '/' },
  { key: 'packages', path: '/packages' },
  { key: 'menu', path: '/menu' },
  { key: 'occasions', path: '/occasions' },
  { key: 'contact', path: '/contact' },
] as const

const NavLinks = ({ lang, current }: { lang: Lang; current: string }) => {
  const { t } = useI18n()
  return (
    <ul class="nav-links">
      {links.map((l) => (
        <li>
          <a href={withLang(l.path, lang)} aria-current={current === l.path ? 'page' : undefined}>
            {t.nav[l.key]}
          </a>
        </li>
      ))}
    </ul>
  )
}

const LangSwitch = ({ lang, current }: { lang: Lang; current: string }) => {
  const { t } = useI18n()
  return (
    <div class="lang-switch" role="group" aria-label={t.language}>
      <a href={withLang(current, 'en')} hreflang="en" lang="en" aria-current={lang === 'en' ? 'true' : undefined}>EN</a>
      <span aria-hidden="true">/</span>
      <a href={withLang(current, 'bm')} hreflang="ms" lang="ms" aria-current={lang === 'bm' ? 'true' : undefined}>BM</a>
    </div>
  )
}

export const Header = () => {
  const { lang, t } = useI18n()
  const current = useRequestContext().req.path
  const quote = withLang('/contact', lang)

  return (
    <header class="site-header on-dark">
      <div class="container site-header__bar">
        <a href={withLang('/', lang)} class="logo">{t.siteName}</a>

        <nav class="site-header__desktop" aria-label={t.mainNav}>
          <NavLinks lang={lang} current={current} />
          <div class="site-header__actions">
            <LangSwitch lang={lang} current={current} />
            <Button variant="inverse" href={quote}>{t.getQuote}</Button>
          </div>
        </nav>

        <details class="mobile-menu">
          <summary aria-label={t.menuToggle}>
            {/* Lucide menu / x */}
            <svg class="icon-open" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <svg class="icon-close" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </summary>
          <nav class="mobile-menu__panel" aria-label={t.mainNav}>
            <NavLinks lang={lang} current={current} />
            <LangSwitch lang={lang} current={current} />
            <Button variant="inverse" href={quote}>{t.getQuote}</Button>
          </nav>
        </details>
      </div>
    </header>
  )
}
