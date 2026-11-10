// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Wealthfolio 92b4647 apps/frontend/src/features/spending/components/amount-input.tsx; see THIRD_PARTY_NOTICES.md.
/**
 * Focus-aware decimal-amount input used across the budget editor. Defers commit
 * until blur (or Enter) and reconciles with externally-changed `value` only
 * while not focused, so a parent refetch doesn't clobber in-progress typing.
 */
import { useState } from 'react'
import { decimalUnits, formatDecimal } from '@/lib/money'
import { localizeDecimal, parseLocalizedDecimal } from '@/lib/localized-number'
import { openingInput } from '@/lib/api'

import { cn } from '@/lib/utils'

export interface AmountInputProps {
  value: string
  onCommit: (value: string) => void
  variant?: 'default' | 'dashed'
  disabled?: boolean
  label?: string
}

export function AmountInput({
  value,
  onCommit,
  variant = 'default',
  disabled = false,
  label,
}: AmountInputProps) {
  const formatDraft = (value: string) =>
    decimalUnits(value) === 0n ? '' : localizeDecimal(value)
  const parseDraft = (value: string): string | undefined => {
    try {
      const next = parseLocalizedDecimal(value || '0')
      return openingInput.safeParse(next).success ? next : undefined
    } catch {
      return undefined
    }
  }
  const [draft, setDraft] = useState(() => formatDraft(value))
  const [focused, setFocused] = useState(false)
  const [lastValue, setLastValue] = useState(value)
  const isEmpty =
    !focused &&
    (!draft ||
      (parseDraft(draft) !== undefined &&
        decimalUnits(parseDraft(draft)!) === 0n))

  // Adjust draft when the parent commits a new value externally — but only while
  // the user isn't actively editing. Done during render per React docs guidance
  // (avoids the extra mount-time render of an Effect).
  if (!focused && value !== lastValue) {
    setLastValue(value)
    setDraft(formatDraft(value))
  }

  return (
    <div
      className={cn(
        'bg-background focus-within:ring-ring/40 focus-within:border-ring hover:border-foreground/30 flex h-7 w-full items-center rounded-md border px-2 transition-shadow focus-within:ring-2',
        variant === 'dashed'
          ? 'border-muted-foreground/30 border-dashed'
          : isEmpty
            ? 'border-border/70 border-dashed'
            : 'border-input',
      )}
    >
      <input
        type="text"
        disabled={disabled}
        aria-label={label}
        inputMode="decimal"
        value={
          focused || parseDraft(draft) === undefined
            ? draft
            : formatDecimal(parseDraft(draft)!)
        }
        onChange={(event) => setDraft(event.target.value)}
        onFocus={(event) => {
          setFocused(true)
          event.currentTarget.select()
        }}
        onBlur={() => {
          setFocused(false)
          const next = parseDraft(draft || '0')
          if (
            next !== undefined &&
            decimalUnits(next) !== decimalUnits(value)
          ) {
            onCommit(String(next))
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
        aria-invalid={parseDraft(draft) === undefined}
        placeholder="0,00"
        className="text-foreground placeholder:text-muted-foreground/70 min-w-0 flex-1 bg-transparent text-end text-xs tabular-nums outline-none"
      />
    </div>
  )
}
