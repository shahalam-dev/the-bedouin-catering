import { useI18n } from '../../lib/i18n'

/** Link to a package or menu item's details PDF, opened in the browser's viewer. */
export const PdfLink = ({ pdfKey, name }: { pdfKey: string; name: string }) => {
  const { t } = useI18n()
  return (
    <a class="pdf-link" href={`/media/${pdfKey}`} target="_blank" rel="noopener" type="application/pdf">
      {t.viewPdf}
      <span class="visually-hidden">
        {' '}
        {name} {t.opensNewTab}
      </span>
    </a>
  )
}
