import { useI18n } from '../../lib/i18n'
import { CheckIcon } from './Icons'

/** Package selector steps. `current` is 0, 1 or 2. */
export const Stepper = ({ current }: { current: number }) => {
  const { t } = useI18n()
  const labels = [t.packages.steps.branch, t.packages.steps.cuisine, t.packages.steps.package]
  return (
    <ol class="stepper" aria-label={t.packages.stepsLabel}>
      {labels.map((label, i) => {
        const state = i < current ? 'done' : i === current ? 'active' : 'upcoming'
        return (
          <li class={`stepper__step stepper__step--${state}`} aria-current={state === 'active' ? 'step' : undefined}>
            <span class="stepper__dot">{state === 'done' ? <CheckIcon /> : i + 1}</span>
            <span class="stepper__label">
              {label}
              {state === 'done' && <span class="visually-hidden"> ({t.packages.stepDone})</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
