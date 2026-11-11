import { Hono } from 'hono'
import { listPublishedClients, type Client } from '../../db/clients'
import type { WithImage } from '../../db/shared'
import { useI18n } from '../../lib/i18n'
import { ClientLogos } from '../../views/components/ClientLogos'
import { SectionTitle } from '../../views/components/SectionTitle'

const ClientsPage = ({ clients }: { clients: (Client & WithImage)[] }) => {
  const { t } = useI18n()
  return (
    <section class="section">
      <title>{`${t.clients.title} | ${t.siteName}`}</title>
      <div class="container">
        <SectionTitle title={t.clients.title} lead={t.clients.lead} />
        {clients.length === 0 ? <p class="empty">{t.clients.none}</p> : <ClientLogos clients={clients} />}
      </div>
    </section>
  )
}

const clients = new Hono<{ Bindings: Env }>()

clients.get('/', async (c) => c.render(<ClientsPage clients={await listPublishedClients(c.env.DB)} />))

export default clients
