import { jsxRenderer, useRequestContext } from 'hono/jsx-renderer'
import { Link, ViteClient } from 'vite-ssr-components/hono'
import { adminT } from '../../lib/i18n'

const sections = ['enquiries', 'packages', 'menu', 'occasions', 'branches', 'cuisines', 'media'] as const

const Sidebar = () => {
  const c = useRequestContext()
  const path = c.req.path
  return (
    <nav class="admin-sidebar" aria-label={adminT.nav}>
      <a class="admin-sidebar__brand" href="/admin">
        {adminT.title}
      </a>
      <ul>
        {sections.map((s) => {
          const href = `/admin/${s}`
          return (
            <li>
              <a href={href} aria-current={path === href || path.startsWith(`${href}/`) ? 'page' : undefined}>
                {adminT.sections[s]}
              </a>
            </li>
          )
        })}
      </ul>
      <p class="admin-sidebar__user">{adminT.signedInAs(c.get('adminEmail'))}</p>
      <a class="admin-sidebar__site" href="/">
        {adminT.viewSite}
      </a>
    </nav>
  )
}

// Replaces PublicLayout for /admin (it ignores the parent Layout prop). Pages set their own <title>.
export const AdminLayout = jsxRenderer(({ children }) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="robots" content="noindex" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@700&family=Montserrat:wght@400;500;600&display=swap"
      />
      <ViteClient />
      <Link href="/src/styles/tokens.css" rel="stylesheet" />
      <Link href="/src/styles/components.css" rel="stylesheet" />
      <Link href="/src/styles/admin.css" rel="stylesheet" />
    </head>
    <body class="admin">
      <Sidebar />
      <main id="main" class="admin-main">
        {children}
      </main>
    </body>
  </html>
))
