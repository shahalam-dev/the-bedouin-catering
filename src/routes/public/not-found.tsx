import { useI18n, withLang } from '../../lib/i18n'
import { Button } from '../../views/components/Button'

export const NotFoundPage = () => {
  const { lang, t } = useI18n()
  return (
    <section class="section">
      <title>{`${t.notFound.title} | ${t.siteName}`}</title>
      <div class="container">
        <h1>{t.notFound.title}</h1>
        <p class="lead">{t.notFound.lead}</p>
        <Button href={withLang('/', lang)}>{t.notFound.backHome}</Button>
      </div>
    </section>
  )
}
