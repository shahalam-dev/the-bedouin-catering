import { useI18n, withLang } from '../../lib/i18n'

const links = [
  { key: 'packages', path: '/packages' },
  { key: 'menu', path: '/menu' },
  { key: 'occasions', path: '/occasions' },
  { key: 'contact', path: '/contact' },
] as const

export const Footer = () => {
  const { lang, t } = useI18n()
  return (
    <footer class="site-footer on-dark">
      <div class="container">
        <a href={withLang('/', lang)} class="logo">{t.siteName}</a>
        <p class="site-footer__tagline">{t.footerTagline}</p>
        <nav aria-label={t.footerNav}>
          <ul class="footer-links">
            {links.map((l) => (
              <li>
                <a href={withLang(l.path, lang)}>{t.nav[l.key]}</a>
              </li>
            ))}
          </ul>
        </nav>
        <p class="site-footer__copy">
          © {new Date().getFullYear()} {t.siteName}. {t.rights}
        </p>
      </div>
    </footer>
  )
}
