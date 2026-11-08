import type { PropsWithChildren } from 'hono/jsx'

type Props = PropsWithChildren<{
  variant?: 'primary' | 'secondary' | 'inverse' | 'outline'
  /** Renders an <a> when set, otherwise a <button>. */
  href?: string
  type?: 'button' | 'submit' | 'reset'
  class?: string
}>

export const Button = ({ variant = 'primary', href, type = 'button', class: extra, children }: Props) => {
  const cls = `btn btn--${variant}${extra ? ` ${extra}` : ''}`
  return href ? (
    <a href={href} class={cls}>
      {children}
    </a>
  ) : (
    <button type={type} class={cls}>
      {children}
    </button>
  )
}
