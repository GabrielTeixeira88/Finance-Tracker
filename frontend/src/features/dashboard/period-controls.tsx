// SPDX-License-Identifier: AGPL-3.0-only
// Wealthfolio 92b4647 dashboard period composition / MIT IntervalSelector JSX.
// Controlled URL state replaces upstream persistent financial filters.
import { AnimatedToggleGroup } from '@/vendor/wealthfolio/ui/components/ui/animated-toggle-group'
import { SpendingDatePicker } from '@/features/spending/components/spending-date-picker'
import { netWorthStart } from '@/lib/net-worth-period'
import { formatDateISO } from '@/features/spending/lib/calendar-adapter'
import { t } from '@/lib/i18n'

export function PeriodControls({
  range,
  start,
  end,
  asOf,
  onChange,
}: {
  range: string
  start: string
  end: string
  asOf: string
  onChange: (period: { start: string; end: string; range: string }) => void
}) {
  return (
    <nav
      className="dashboard-period-controls"
      aria-label={t('networth:date_range')}
    >
      <div className="flex min-w-0 items-center justify-center">
        <AnimatedToggleGroup
          items={['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y', '5Y', 'ALL'].map(
            (value) => ({ value, label: value }),
          )}
          value={range === 'Custom' ? '' : range}
          onValueChange={(range) =>
            onChange({ range, end, start: netWorthStart(range, end, start) })
          }
          size="compact"
          variant="default"
          className="pointer-events-auto bg-transparent"
        />
      </div>
      <SpendingDatePicker
        customMonth={null}
        maxMonth={asOf.slice(0, 7)}
        customRange={
          range === 'Custom'
            ? {
                from: new Date(`${start}T12:00:00`),
                to: new Date(`${end}T12:00:00`),
              }
            : undefined
        }
        onCustomMonthChange={(month) => {
          if (!month) return
          const [year, index] = month.split('-').map(Number)
          const last = formatDateISO(new Date(year, index, 0, 12))
          onChange({
            range: 'Custom',
            start: `${month}-01`,
            end: last < asOf ? last : asOf,
          })
        }}
        onCustomRangeChange={(range) => {
          if (!range?.from || !range.to) return
          const from = formatDateISO(range.from),
            to = formatDateISO(range.to)
          if (from < to && to <= asOf)
            onChange({ range: 'Custom', start: from, end: to })
        }}
      />
    </nav>
  )
}
