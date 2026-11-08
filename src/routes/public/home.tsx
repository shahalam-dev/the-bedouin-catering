import { Hono } from 'hono'
import { useI18n, withLang } from '../../lib/i18n'
import { Button } from '../../views/components/Button'

const HomePage = () => {
  const { lang, t } = useI18n()
  return (
    <section class="section">
      <title>{`${t.home.title} | ${t.siteName}`}</title>
      <div class="container">
        <h1 class="display">{t.home.heroTitle}</h1>
        <p class="lead">{t.home.heroLead}</p>
        <Button href={withLang('/packages', lang)}>{t.home.viewPackages}</Button>
      </div>
    </section>
  )
}

const home = new Hono<{ Bindings: Env }>()

home.get('/', (c) => c.render(<HomePage />))

export default home
