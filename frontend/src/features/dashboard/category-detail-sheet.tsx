// SPDX-License-Identifier: AGPL-3.0-only
// Wealthfolio 92b4647 net-worth/components/{category-detail-sheet,category-trend-chart}.tsx.
import { useId } from 'react'
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/vendor/wealthfolio/ui/components/ui/sheet'
import { Icons } from '@/vendor/wealthfolio/ui/components/ui/icons'
import { Money } from '@/components/primitives'
import { NetWorthInvestments } from '@/components/net-worth-investments'
import { t } from '@/lib/i18n'
import { useFinancialPrivacy } from '@/lib/financial-privacy'
import { decimalUnits, formatRatioPercent } from '@/lib/money'
import {
  netWorthChartGeometry,
  percentOf,
  magnitude,
  type NetWorthGroup,
  type NetWorthView,
} from '@/lib/net-worth-view'
import { Gain } from './balance'

function CategoryAvatar({ group }: { group: NetWorthGroup }) {
  const Icon =
    group.kind === 'LIABILITY'
      ? Icons.LiabilityDuotone
      : group.label === 'properties'
        ? Icons.RealEstateDuotone
        : group.label === 'vehicles'
          ? Icons.VehicleDuotone
          : group.label === 'collectibles'
            ? Icons.CollectibleDuotone
            : group.label === 'cash'
              ? Icons.Wallet
              : Icons.OtherAssetDuotone
  return (
    <div
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
      style={{
        color: group.color,
        backgroundColor: `color-mix(in srgb, ${group.color} 14%, transparent)`,
      }}
    >
      <Icon className="h-4 w-4" />
    </div>
  )
}
function CategoryTrendChart({ group }: { group: NetWorthGroup }) {
  const id = useId().replaceAll(':', '')
  const geometry = netWorthChartGeometry(group.history)
  if (group.history.filter((p) => p.value !== null).length < 2)
    return (
      <div className="text-muted-foreground/60 flex h-32 items-center justify-center text-xs">
        {t('networth:insufficient_history')}
      </div>
    )
  return (
    <div
      className="h-32 w-full"
      role="img"
      aria-label={t('networth:category_history')}
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
        initialDimension={{ width: 400, height: 128 }}
      >
        <AreaChart
          data={geometry.data}
          margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={group.color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={group.color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis
            hide
            domain={
              geometry.flat
                ? [
                    geometry.min - geometry.padding,
                    geometry.max + geometry.padding,
                  ]
                : ['dataMin', 'dataMax']
            }
          />
          <Area
            connectNulls={false}
            type="monotone"
            dataKey="coordinate"
            stroke={group.color}
            strokeWidth={1.8}
            fill={`url(#${id})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
export function CategoryDetailSheet({
  group,
  label,
  report,
  onClose,
  onComponent,
}: {
  group: NetWorthGroup
  label: string
  report: NetWorthView
  onClose: () => void
  onComponent: (c: NetWorthView['components'][number]) => void
}) {
  const privacy = useFinancialPrivacy()
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent className="net-worth-category-drawer w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <CategoryAvatar group={group} />
            {label}
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-6 px-5 pb-6">
          <div>
            <div className="text-3xl font-semibold tracking-tight tabular-nums">
              {group.value === null ? (
                t('common:unavailable')
              ) : (
                <Money value={group.value} currency={report.currency} />
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-2 text-sm">
              <Gain value={group.change} currency={report.currency} />
              <span className="text-muted-foreground">
                {t('networth:change_over_period')}
              </span>
            </div>
          </div>
          <div>
            <p className="pb-2 text-xs uppercase tracking-wide text-muted-foreground">
              {t('networth:trend')}
            </p>
            <CategoryTrendChart group={group} />
          </div>
          {group.label === 'investments' && (
            <>
              <NetWorthInvestments
                asOf={report.end}
                currency={report.currency}
                expected={group.value}
              />
              <p className="metadata">
                {t('networth:brokerage_cash_included')}
              </p>
            </>
          )}
          {group.components.length > 0 && (
            <div>
              <p className="pb-1 text-xs uppercase tracking-wide text-muted-foreground">
                {t('networth:holdings')}
              </p>
              <div className="divide-border/40 divide-y">
                {group.components.map((child) => (
                  <button
                    key={child.id}
                    className="flex w-full items-center justify-between gap-3 py-2 text-start hover:bg-accent/50"
                    onClick={() => {
                      onClose()
                      onComponent(child)
                    }}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <CategoryAvatar group={group} />
                      <span className="text-foreground/90 min-w-0 truncate text-sm">
                        {child.name}
                        {!!child.missing.length && (
                          <small className="block">
                            {t('networth:incomplete')}
                          </small>
                        )}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2.5">
                      {group.value !== null &&
                        decimalUnits(group.value) > 0n &&
                        child.value !== null && (
                          <span className="text-muted-foreground/60 text-xs tabular-nums">
                            {privacy.hidden
                              ? '••••'
                              : formatRatioPercent(
                                  percentOf(
                                    magnitude(child.value),
                                    group.value,
                                  ),
                                  1,
                                )}
                          </span>
                        )}
                      <span className="text-foreground/90 text-sm tabular-nums">
                        {child.value === null ? (
                          t('common:unavailable')
                        ) : (
                          <Money
                            value={magnitude(child.value)}
                            currency={report.currency}
                          />
                        )}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          <details>
            <summary className="text-xs text-muted-foreground">
              {t('networth:details')}
            </summary>
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th>{t('networth:trend')}</th>
                  <th className="text-end">{report.currency}</th>
                </tr>
              </thead>
              <tbody>
                {group.history.map((point) => (
                  <tr key={point.date}>
                    <th className="text-start font-normal">{point.date}</th>
                    <td className="text-end">
                      {point.value === null ? (
                        t('common:unavailable')
                      ) : (
                        <Money value={point.value} currency={report.currency} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>
      </SheetContent>
    </Sheet>
  )
}
