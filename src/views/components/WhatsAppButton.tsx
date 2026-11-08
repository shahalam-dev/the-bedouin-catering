import { useI18n } from '../../lib/i18n'
import { site } from '../../lib/site'

export const WhatsAppButton = () => {
  const { t } = useI18n()
  return (
    <a
      class="whatsapp-fab"
      href={`https://wa.me/${site.whatsappNumber}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t.whatsapp}
    >
      {/* Lucide message-circle */}
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      </svg>
    </a>
  )
}
