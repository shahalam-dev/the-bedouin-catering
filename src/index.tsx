import { Hono } from 'hono'
import admin from './routes/admin'
import clients from './routes/public/clients'
import enquiries from './routes/api/enquiries'
import contact from './routes/public/contact'
import gallery from './routes/public/gallery'
import home from './routes/public/home'
import img from './routes/public/img'
import media from './routes/public/media'
import menu from './routes/public/menu'
import { NotFoundPage } from './routes/public/not-found'
import occasions from './routes/public/occasions'
import packages from './routes/public/packages'
import video from './routes/public/video'
import { PublicLayout } from './views/layouts/PublicLayout'

const app = new Hono<{ Bindings: Env }>()

// First: byte-range responses for hero videos (static assets can't do 206).
app.route('/video', video)

app.use('*', PublicLayout)

app.route('/', home)
app.route('/packages', packages)
app.route('/menu', menu)
app.route('/occasions', occasions)
app.route('/gallery', gallery)
app.route('/clients', clients)
app.route('/contact', contact)
app.route('/api/enquiries', enquiries)
app.route('/media', media)
app.route('/img', img)
app.route('/admin', admin)

app.notFound((c) => {
  c.status(404)
  return c.render(<NotFoundPage />)
})

export default app
