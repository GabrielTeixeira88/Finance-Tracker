import { t as tr, ui } from '@/lib/i18n'
import { useId, type ReactNode } from 'react'
import { SelectionIndicator } from './selection-indicator'
export function SectionNavigation<T extends string>({
  label,
  items,
  value,
  onChange,
  icons,
}: {
  label: string
  items: readonly (readonly [T, string])[]
  value: T
  onChange: (value: T) => void
  icons?: Partial<Record<T, ReactNode>>
}) {
  const indicatorId = useId()
  return (
    <nav className="section-navigation" aria-label={label}>
      {items.map(([key, title]) => {
        const icon = icons?.[key]
        return (
          <button
            key={key}
            aria-current={value === key ? 'page' : undefined}
            aria-pressed={value === key}
            onClick={() => onChange(key)}
          >
            {value === key && (
              <SelectionIndicator id={`section-${indicatorId}`} />
            )}
            <span className="motion-choice-label inline-flex items-center gap-1.5">
              {icon}
              {ui(title)}
            </span>
          </button>
        )
      })}
    </nav>
  )
}

export function WorkflowSteps({
  steps,
  current,
}: {
  steps: readonly string[]
  current: number
}) {
  return (
    <ol
      className="workflow-steps"
      aria-label={tr('section_navigation:workflow_progress_aa9110')}
    >
      {steps.map((step, index) => (
        <li
          key={ui(step)}
          aria-current={index === current ? 'step' : undefined}
        >
          <span aria-hidden="true">{index + 1}</span> {ui(step)}
        </li>
      ))}
    </ol>
  )
}
