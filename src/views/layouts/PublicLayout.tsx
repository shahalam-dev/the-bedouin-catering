import { jsxRenderer } from 'hono/jsx-renderer'
import { Link, Script, ViteClient } from 'vite-ssr-components/hono'
import { htmlLang, useI18n } from '../../lib/i18n'
import { Footer } from '../components/Footer'
import { Header } from '../components/Header'
import { WhatsAppButton } from '../components/WhatsAppButton'

// Pages set their own <title> (hoisted into <head> by hono/jsx).
const Document = ({ children }: { children?: unknown }) => {
  const { lang, t } = useI18n()
  return (
    <html lang={htmlLang[lang]}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@700&family=Montserrat:wght@400;500;600&display=swap"
        />
        <ViteClient />
        <Link href="/src/styles/tokens.css" rel="stylesheet" />
        <Link href="/src/styles/components.css" rel="stylesheet" />
        <Script src="/src/client.ts" />
      </head>
      <body>
        <a class="skip-link" href="#main">{t.skipToContent}</a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
        <WhatsAppButton />
      </body>
    </html>
  )
}

export const PublicLayout = jsxRenderer(({ children }) => <Document>{children}</Document>)
