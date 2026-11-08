import { Hono } from 'hono'
import { csrf } from 'hono/csrf'
import { requireAdmin, type AdminEnv } from '../../lib/auth'
import { AdminLayout } from '../../views/layouts/AdminLayout'
import { contentRoutes, resources } from './content'
import enquiries from './enquiries'
import media from './media'

const admin = new Hono<AdminEnv>()

// Never cache admin pages, including the 401/503 answers.
admin.use('*', async (c, next) => {
  await next()
  c.header('Cache-Control', 'no-store')
})
admin.use('*', requireAdmin, csrf(), AdminLayout)

admin.get('/', (c) => c.redirect('/admin/enquiries'))
admin.route('/enquiries', enquiries)
admin.route('/media', media)
for (const r of resources) admin.route(`/${r.key}`, contentRoutes(r))

export default admin
