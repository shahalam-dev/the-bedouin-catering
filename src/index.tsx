import { Hono } from 'hono'
import admin from './routes/admin'
import enquiries from './routes/api/enquiries'
import contact from './routes/public/contact'
import home from './routes/public/home'
import media from './routes/public/media'
import menu from './routes/public/menu'
import { NotFoundPage } from './routes/public/not-found'
import occasions from './routes/public/occasions'
import packages from './routes/public/packages'
import { PublicLayout } from './views/layouts/PublicLayout'

const app = new Hono<{ Bindings: Env }>()

app.use('*', PublicLayout)

app.route('/', home)
app.route('/packages', packages)
app.route('/menu', menu)
app.route('/occasions', occasions)
app.route('/contact', contact)
app.route('/api/enquiries', enquiries)
app.route('/media', media)
app.route('/admin', admin)

app.notFound((c) => {
  c.status(404)
  return c.render(<NotFoundPage />)
})

export default app
