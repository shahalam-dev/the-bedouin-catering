import { Hono } from 'hono'
import enquiries from './routes/api/enquiries'
import contact from './routes/public/contact'
import home from './routes/public/home'
import menu from './routes/public/menu'
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

export default app
