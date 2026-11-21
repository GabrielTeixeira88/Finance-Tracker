// SPDX-License-Identifier: AGPL-3.0-only
// Wealthfolio 92b4647 what-changed-stage.tsx: source sparklines and comparison table; exact local descriptor adapter.
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'
import { Card } from '@/vendor/wealthfolio/ui/components/ui/card'
import { CategoryIcon } from '../../category-chips'
import { cn } from '@/lib/utils'
import { decimalUnits, formatExactPercent } from '@/lib/money'
import { exactAbs, useBalancePrivacy } from '../../../compat'
import { PrivacyAmount, useAmountFormatting, badgeVariants } from '../../../ui'
const SPARK_MARGIN = { top: 2, right: 0, left: 0, bottom: 0 }
export interface MoverDescriptor {
  id: string
  name: string
  color: string | null
  icon: string | null
  current: string
  prior: string
  delta: string
  pct: string | null
  showPct: boolean
  shareOfMovement: number | null
}
export interface SparkRow {
  id: string
  name: string
  color: string | null
  icon: string | null
  total: string
  delta: string
  percent: string | null
  series: { value: number }[]
}
interface ComparisonTableProps {
  movers: MoverDescriptor[]
  labels: { current: string; prior: string }
  periodState: { kind: string }
  currency: string
  onCategoryClick?: (id: string) => void
}
export const SparklineRow = memo(function SparklineRow({
  row,
  currency,
  showPill,
  onCategoryClick,
}: {
  row: SparkRow
  currency: string
  showPill: boolean
  onCategoryClick?: (categoryId: string) => void
}) {
  const formatting = useAmountFormatting()
  const { isBalanceHidden } = useBalancePrivacy()
  const color = row.color ?? 'var(--muted-foreground)'
  const tintBg = row.color ? `${row.color}14` : 'var(--muted)'
  const gradId = `wc-spark-${row.id.replace(/[^a-z0-9]/gi, '_')}`
  const pill =
    showPill && decimalUnits(row.delta) !== 0n
      ? {
          tone: decimalUnits(row.delta) > 0n ? 'up' : 'down',
          label:
            row.percent === null
              ? formatting.formatAmount(row.delta, currency)
              : formatExactPercent(row.percent),
        }
      : null
  const clickable = !!onCategoryClick
  return (
    <Card
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? () => onCategoryClick?.(row.id) : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onCategoryClick?.(row.id)
              }
            }
          : undefined
      }
      className={cn(
        'flex flex-col gap-1.5 px-4 pb-4 pt-3',
        clickable && 'hover:bg-muted/40 cursor-pointer transition-colors',
      )}
      style={{
        backgroundImage: `linear-gradient(to bottom, ${tintBg}, transparent 70%)`,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: color }}
          />
          <CategoryIcon
            icon={row.icon}
            fallback={row.name}
            className="text-foreground/70 h-3.5 w-3.5"
          />
          <span className="text-foreground truncate text-sm font-medium">
            {row.name}
          </span>
        </div>
        {pill && (
          <span
            className={cn(
              badgeVariants({
                variant:
                  pill.tone === 'up'
                    ? 'destructive-subtle'
                    : pill.tone === 'down'
                      ? 'success-subtle'
                      : 'secondary',
              }),
              'text-2xs tabular-nums',
              pill.tone === 'neutral' && 'text-muted-foreground/80 bg-muted/40',
            )}
          >
            {pill.label}
          </span>
        )}
      </div>
      <div className="-mx-1 mt-1 h-9">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={row.series} margin={SPARK_MARGIN}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.45} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={1.5}
              fill={`url(#${gradId})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="text-muted-foreground/80 text-xs tabular-nums">
        {isBalanceHidden
          ? '••••'
          : formatting.formatCompactAmount(row.total, currency)}
      </div>
    </Card>
  )
})

export function ComparisonTable({
  movers,
  labels,
  periodState,
  currency,
  onCategoryClick,
}: ComparisonTableProps) {
  const { t } = useTranslation()
  const hidePct = periodState.kind === 'no_prior_period'

  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-border/40 text-muted-foreground/70 text-2xs border-b font-semibold tracking-[0.12em] uppercase">
            <th className="px-3 py-3 text-start md:px-4">
              {t('wfSpending:filters.category')}
            </th>
            <th className="px-2 py-3 text-end md:px-3">{labels.current}</th>
            <th className="px-2 py-3 text-end md:px-3">{labels.prior}</th>
            <th className="px-2 py-3 text-end md:px-3">
              {t('wfSpending:whatChanged.deltaDollar')}
            </th>
            <th className="hidden px-3 py-3 text-end md:table-cell">
              {t('wfSpending:whatChanged.impact')}
            </th>
            {!hidePct && (
              <th className="hidden px-4 py-3 text-end md:table-cell">
                {t('wfSpending:whatChanged.deltaPct')}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {movers.map((row) => (
            <ComparisonRow
              key={row.id}
              row={row}
              currency={currency}
              hidePct={hidePct}
              onCategoryClick={onCategoryClick}
            />
          ))}
        </tbody>
      </table>
    </Card>
  )
}

const ComparisonRow = memo(function ComparisonRow({
  row,
  currency,
  hidePct,
  onCategoryClick,
}: {
  row: MoverDescriptor
  currency: string
  hidePct: boolean
  onCategoryClick?: (categoryId: string) => void
}) {
  const color = row.color ?? 'var(--muted-foreground)'
  const isUp = decimalUnits(row.delta) > 0n
  const clickable = !!onCategoryClick
  const impactPct =
    row.shareOfMovement != null ? Math.round(row.shareOfMovement * 100) : null
  return (
    <tr
      className={cn(
        'border-border/30 hover:bg-muted/20 border-b last:border-b-0',
        clickable && 'cursor-pointer',
      )}
      onClick={clickable ? () => onCategoryClick?.(row.id) : undefined}
    >
      <td className="px-3 py-2.5 md:px-4">
        <div className="flex items-center gap-2">
          <span
            className="block h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="text-foreground text-xs md:text-sm">{row.name}</span>
        </div>
      </td>
      <td className="text-foreground/90 text-2xs px-2 py-2.5 text-end tabular-nums md:px-3 md:text-xs">
        {decimalUnits(row.current) === 0n ? (
          <span className="text-muted-foreground/60">—</span>
        ) : (
          <PrivacyAmount value={row.current} currency={currency} />
        )}
      </td>
      <td className="text-muted-foreground/80 text-2xs px-2 py-2.5 text-end tabular-nums md:px-3 md:text-xs">
        {decimalUnits(row.prior) === 0n ? (
          <span className="text-muted-foreground/60">—</span>
        ) : (
          <PrivacyAmount value={row.prior} currency={currency} />
        )}
      </td>
      <td
        className={cn(
          'text-2xs px-2 py-2.5 text-end font-medium tabular-nums md:px-3 md:text-xs',
          decimalUnits(row.delta) === 0n
            ? 'text-muted-foreground/70'
            : isUp
              ? 'text-destructive'
              : 'text-success',
        )}
      >
        {decimalUnits(row.delta) === 0n ? (
          '—'
        ) : (
          <>
            {isUp ? '+' : '−'}
            <PrivacyAmount value={exactAbs(row.delta)} currency={currency} />
          </>
        )}
      </td>
      <td className="text-muted-foreground/90 hidden px-3 py-2.5 text-end text-xs tabular-nums md:table-cell">
        {impactPct == null || impactPct === 0
          ? '—'
          : formatExactPercent(impactPct.toFixed(2))}
      </td>
      {!hidePct && (
        <td
          className={cn(
            'hidden px-4 py-2.5 text-end text-xs font-medium tabular-nums md:table-cell',
            !row.showPct || row.pct == null
              ? 'text-muted-foreground/70'
              : decimalUnits(row.pct) >= 0n
                ? 'text-destructive'
                : 'text-success',
          )}
        >
          {!row.showPct || row.pct == null ? '—' : formatExactPercent(row.pct)}
        </td>
      )}
    </tr>
  )
})
