import type { PropsWithChildren } from 'hono/jsx'

/** Signature card: rounded photo with a label tag overlapping its bottom edge. */
export const CategoryCard = ({ label, tone = 'crimson', children }: PropsWithChildren<{ label: string; tone?: 'crimson' | 'ink' }>) => (
  <article class="category-card">
    <div class="category-card__photo" aria-hidden="true" />
    <h3 class={`category-card__tag category-card__tag--${tone}`}>{label}</h3>
    {children && <div class="category-card__body">{children}</div>}
  </article>
)
