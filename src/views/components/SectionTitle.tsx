/** Centred page/section title with an optional lead paragraph. */
export const SectionTitle = ({ title, lead, as: Tag = 'h1' }: { title: string; lead?: string; as?: 'h1' | 'h2' }) => (
  <header class="section-title">
    <Tag>{title}</Tag>
    {lead && <p class="lead">{lead}</p>}
  </header>
)
