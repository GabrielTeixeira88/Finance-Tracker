// SPDX-License-Identifier: AGPL-3.0-only
// Wealthfolio 92b4647 net-worth/components/momentum-card.tsx.
// Source two-zone bars and composition; exact server windows replace numeric math.
import { DashboardCard } from '@/components/dashboard-card'
import { decimalUnits, formatDate, formatMoney } from '@/lib/money'
import { useFinancialPrivacy } from '@/lib/financial-privacy'
import type { NetWorthView } from '@/lib/net-worth-view'
import { t } from '@/lib/i18n'
import { Gain } from './balance'

export function MomentumCard({
  report,
  period,
}: {
  report: NetWorthView
  period: string
}) {
  const privacy = useFinancialPrivacy()
  const momentum = report.insights?.momentum
  if (!momentum) return null
  const { current_change: currentChange, beat_by: beatBy, bars } = momentum
  const positive = bars.reduce(
    (max, b) =>
      b.value !== null && decimalUnits(b.value) > max
        ? decimalUnits(b.value)
        : max,
    0n,
  )
  const negative = bars.reduce(
    (max, b) =>
      b.value !== null && -decimalUnits(b.value) > max
        ? -decimalUnits(b.value)
        : max,
    0n,
  )
  const total = positive + negative || 1n
  const posZone = Number((positive * 10000n) / total) / 100
  const negZone = Number((negative * 10000n) / total) / 100
  return (
    <DashboardCard
      title={t('dashboard_v014:momentum')}
      meta={t('dashboard_v014:versus_prior', { period })}
    >
      <div className="text-2xl font-bold tabular-nums">
        <Gain value={currentChange} currency={report.currency} />
      </div>
      {beatBy !== null ? (
        <p className="text-muted-foreground mt-0.5 text-xs">
          {t(
            decimalUnits(beatBy) >= 0n
              ? 'dashboard_v014:beat_prior'
              : 'dashboard_v014:behind_prior',
          )}{' '}
          <Gain value={beatBy} currency={report.currency} />
        </p>
      ) : (
        <p className="text-muted-foreground mt-0.5 text-xs">
          {t('networth:insufficient_history')}
        </p>
      )}
      {bars.length > 1 && (
        <>
          <div
            className="relative mt-4 h-16"
            role="img"
            aria-label={t('dashboard_v014:monthly_changes')}
          >
            {negZone > 0.5 && (
              <div
                className="bg-border/50 absolute inset-x-0 h-px"
                style={{ top: `${posZone}%` }}
              />
            )}
            <div className="flex h-full items-stretch gap-1">
              {bars.map((bar) => {
                const value =
                  bar.value === null ? null : decimalUnits(bar.value)
                const backgroundColor = !bar.current
                  ? 'color-mix(in srgb, var(--muted-foreground) 35%, transparent)'
                  : value !== null && value < 0n
                    ? 'var(--negative)'
                    : 'var(--positive)'
                const title = `${formatDate(bar.month + '-01')}: ${privacy.hidden ? '••••' : bar.value === null ? t('common:unavailable') : formatMoney(bar.value, report.currency)}`
                return (
                  <div
                    key={bar.month}
                    className="flex flex-1 flex-col"
                    title={title}
                  >
                    <div
                      className="flex items-end"
                      style={{ height: `${posZone}%` }}
                    >
                      {value !== null && value > 0n && positive > 0n && (
                        <div
                          className="w-full rounded-t-sm"
                          style={{
                            height: `${Math.max(8, Number((value * 10000n) / positive) / 100)}%`,
                            backgroundColor,
                          }}
                        />
                      )}
                    </div>
                    <div
                      className="flex items-start"
                      style={{ height: `${negZone}%` }}
                    >
                      {value !== null && value < 0n && negative > 0n && (
                        <div
                          className="w-full rounded-b-sm"
                          style={{
                            height: `${Math.max(8, Number((-value * 10000n) / negative) / 100)}%`,
                            backgroundColor,
                          }}
                        />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="text-muted-foreground/60 mt-1.5 flex justify-between text-xs">
            <span>{formatDate(bars[0].month + '-01')}</span>
            <span>{t('dashboard_v014:now')}</span>
          </div>
        </>
      )}
      <details className="net-worth-method-disclosure">
        <summary>{t('networth:method')}</summary>
        <p className="metadata">{t('networth:not_performance')}</p>
        <p className="metadata">{momentum.method}</p>
      </details>
    </DashboardCard>
  )
}
