// SPDX-License-Identifier: AGPL-3.0-only
// Wealthfolio 92b4647 features/goals/components/goal-lever-row.tsx:
// original label/input/slider layout and commit/cancel interaction. Exact local
// drafts and bounded dimensionless coordinates replace monetary Number math.
import type { ReactNode } from 'react'
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import '../i18n'
import { decimalUnits, formatDecimal } from '@/lib/money'
import { localizeDecimal, parseLocalizedDecimal } from '@/lib/localized-number'
import { sliderAmount, sliderPosition } from '../lib/exact-slider'

export function GoalLeverRow({
  label,
  hint,
  value,
  onChange,
  min = '0',
  max,
  inputMax = '999999999999999999.999999',
  step = '1',
  prefix,
  suffix,
  format = formatDecimal,
  warning,
  inputWidthClassName,
  disabled = false,
}: {
  label: ReactNode
  hint?: string
  value: string
  onChange: (value: string) => void
  min?: string
  max: string
  inputMax?: string
  step?: string
  prefix?: string
  suffix?: string
  format?: (value: string) => string
  warning?: ReactNode
  inputWidthClassName?: string
  disabled?: boolean
}) {
  const labelId = useId()
  const { t } = useTranslation()
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState(() => localizeDecimal(value))
  const [invalid, setInvalid] = useState(false)
  const skipCommit = useRef(false)
  const parse = () => {
    try {
      const parsed = parseLocalizedDecimal(draft || '0')
      const units = decimalUnits(parsed)
      return units >= decimalUnits(min) && units <= decimalUnits(inputMax)
        ? parsed
        : null
    } catch {
      return null
    }
  }
  const parsed = parse()
  const effectiveMax =
    decimalUnits(max) > decimalUnits(inputMax) ? inputMax : max
  const coordinate = sliderPosition(value, min, effectiveMax)
  return (
    <div className="py-4 first:pt-1 last:pb-1">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            id={labelId}
            className="text-foreground text-sm leading-tight font-semibold"
          >
            {label}
          </div>
          {hint && (
            <div className="text-muted-foreground mt-1 text-xs leading-tight">
              {hint}
            </div>
          )}
        </div>
        <div
          className={`bg-muted/70 flex h-8 items-center gap-1 rounded-md border px-2.5 ${inputWidthClassName ?? 'w-44'}`}
        >
          {prefix && (
            <span className="text-muted-foreground text-xs tabular-nums">
              {prefix}
            </span>
          )}
          <input
            type="text"
            aria-labelledby={labelId}
            inputMode="decimal"
            disabled={disabled}
            value={focused ? draft : format(value)}
            aria-invalid={invalid || (focused && parsed === null)}
            onFocus={(event) => {
              event.currentTarget.setCustomValidity('')
              setInvalid(false)
              setDraft(localizeDecimal(value))
              setFocused(true)
              event.currentTarget.select()
            }}
            onChange={(event) => {
              event.currentTarget.setCustomValidity('')
              setDraft(event.target.value)
            }}
            onBlur={(event) => {
              setFocused(false)
              if (skipCommit.current) {
                skipCommit.current = false
                return
              }
              setInvalid(parsed === null)
              event.currentTarget.setCustomValidity(
                parsed === null ? t('goalsMigration:invalidAmount') : '',
              )
              if (
                parsed !== null &&
                decimalUnits(parsed) !== decimalUnits(value)
              )
                onChange(parsed)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
              if (event.key === 'Escape') {
                skipCommit.current = true
                setDraft(localizeDecimal(value))
                event.currentTarget.blur()
              }
            }}
            className="text-foreground dark:bg-input/0 h-auto min-w-0 flex-1 rounded-none border-0 bg-transparent p-0 text-end text-sm tabular-nums shadow-none ring-0 outline-none focus-visible:outline-none"
          />
          {suffix && (
            <span className="text-muted-foreground text-xs tabular-nums">
              {suffix}
            </span>
          )}
        </div>
      </div>
      <input
        type="range"
        aria-labelledby={labelId}
        aria-valuetext={format(value)}
        disabled={disabled}
        value={coordinate}
        min={0}
        max={10_000}
        step={1}
        onChange={(event) =>
          onChange(sliderAmount(event.target.value, min, effectiveMax, step))
        }
        className="lever-slider mt-3 w-full"
        style={{ ['--lever-pct' as string]: `${coordinate / 100}%` }}
      />
      {warning && (
        <p className="bg-warning-subtle text-warning-subtle-foreground mt-2 rounded-md px-2.5 py-1.5 text-xs leading-snug">
          {warning}
        </p>
      )}
      {invalid && (
        <p role="alert" className="text-destructive mt-2 text-xs">
          {t('goalsMigration:invalidAmount')}
        </p>
      )}
    </div>
  )
}
