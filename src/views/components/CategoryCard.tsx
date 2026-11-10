import type { PropsWithChildren } from 'hono/jsx'
import type { WithImage } from '../../db/shared'
import { Photo } from './Photo'

/** Signature card: rounded photo with a label tag overlapping its bottom edge. */
export const CategoryCard = ({
  label,
  image,
  tone = 'crimson',
  children,
}: PropsWithChildren<{ label: string; image: WithImage; tone?: 'crimson' | 'ink' }>) => (
  <article class="category-card">
    <Photo image={image} class="category-card__photo" />
    <h3 class={`category-card__tag category-card__tag--${tone}`}>{label}</h3>
    {children && <div class="category-card__body">{children}</div>}
  </article>
)
