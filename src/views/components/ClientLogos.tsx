import type { Client } from '../../db/clients'
import type { WithImage } from '../../db/shared'
import { imgUrl } from '../../lib/images'

/** Grid of client logos. Alt text comes from the media row (the admin form requires it). */
export const ClientLogos = ({ clients }: { clients: (Client & WithImage)[] }) => (
  <ul class="client-logos">
    {clients.map((c) => (
      <li>
        <img src={imgUrl(c.image_key!, 'thumb')} alt={c.image_alt ?? c.name} loading="lazy" decoding="async" />
      </li>
    ))}
  </ul>
)
