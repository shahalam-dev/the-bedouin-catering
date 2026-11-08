import type { PropsWithChildren } from 'hono/jsx'

/** Label above, control, then the error message linked via aria-describedby. */
export const FormField = ({ id, label, error, children }: PropsWithChildren<{ id: string; label: string; error?: string }>) => (
  <div class={`field${error ? ' field--error' : ''}`}>
    <label for={id}>{label}</label>
    {children}
    {error && (
      <p id={`${id}-error`} class="field__error">
        {error}
      </p>
    )}
  </div>
)

/** Attributes every control needs for its error state. */
export const fieldAria = (id: string, error?: string) =>
  error ? { 'aria-invalid': 'true' as const, 'aria-describedby': `${id}-error` } : {}
