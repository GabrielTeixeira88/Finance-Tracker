export function SectionNavigation<T extends string>({
  label,
  items,
  value,
  onChange,
}: {
  label: string
  items: readonly (readonly [T, string])[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <nav className="section-navigation" aria-label={label}>
      {items.map(([key, title]) => (
        <button
          key={key}
          aria-current={value === key ? 'page' : undefined}
          aria-pressed={value === key}
          onClick={() => onChange(key)}
        >
          {title}
        </button>
      ))}
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
    <ol className="workflow-steps" aria-label="Workflow progress">
      {steps.map((step, index) => (
        <li key={step} aria-current={index === current ? 'step' : undefined}>
          <span aria-hidden="true">{index + 1}</span> {step}
        </li>
      ))}
    </ol>
  )
}
