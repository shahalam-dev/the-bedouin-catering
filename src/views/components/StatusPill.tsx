import type { EnquiryStatus } from '../../db/enquiries'
import type { Status } from '../../db/shared'
import { adminT } from '../../lib/i18n'

/** Coloured dot + ink text. Colour comes from the status via CSS. */
export const StatusPill = ({ status }: { status: Status | EnquiryStatus }) => (
  <span class={`status-pill status-pill--${status}`}>
    {status in adminT.statuses
      ? adminT.statuses[status as Status]
      : adminT.enquiries.statuses[status as EnquiryStatus]}
  </span>
)
