import { historyGeometry } from './history-geometry'
// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Wealthfolio 92b4647 components/history-chart.tsx.
// Source geometry/gradients/hover overlay; exact strings and visible gaps replace
// monetary numbers and connectNulls. Browser touch replaces native device haptics.
import { useId, useState } from 'react'
import { Area, AreaChart, XAxis, YAxis, Tooltip, ReferenceDot } from 'recharts'
import { ChartContainer } from '@/vendor/wealthfolio/ui/components/ui/chart'
import { formatDate } from '@/lib/money'
import { Money } from '@/components/primitives'
import { useChartMotion } from '@/lib/motion'
import { t } from '@/lib/i18n'
import { useFinancialPrivacy } from '@/lib/financial-privacy'
import { getAutomaticHistoryChartScale } from './history-chart-scale'

export type HistoryPoint = {
  date: string
  value: string | null
  net_contribution: string | null
}

export function HistoryChart({
  points,
  currency,
  period,
  label,
  markers = [],
  onMarkerClick,
}: {
  points: HistoryPoint[]
  currency: string
  period: string
  label: string
  markers?: { date: string; label: string }[]
  onMarkerClick?: (date: string) => void
}) {
  const id = useId().replaceAll(':', '')
  const [hovered, setHovered] = useState(false)
  const motion = useChartMotion()
  const { hidden } = useFinancialPrivacy()
  const data = historyGeometry(points)
  const available = data.filter((p) => p.totalValue !== null)
  if (!available.length)
    return (
      <div className="dashboard-chart-empty" role="status">
        {t('networth:history_unavailable')}
      </div>
    )
  const config = getAutomaticHistoryChartScale(
    data.map((p) => ({
      totalValue: p.totalValue ?? NaN,
      netContribution: p.netContribution ?? NaN,
    })),
    {
      mode: 'fit-visible',
      minDomainSpanRatio: ['1D', '1W'].includes(period)
        ? 0.035
        : ['1M', '3M'].includes(period)
          ? 0.08
          : ['5Y', 'ALL'].includes(period)
            ? 0.2
            : 0.16,
      netContributionMaxDomainSpanRatio: ['1M', '3M'].includes(period)
        ? 1.4
        : ['5Y', 'ALL'].includes(period)
          ? 2.8
          : 2.2,
    },
  )
  const min = Math.min(...available.map((p) => p.totalValue!)),
    max = Math.max(...available.map((p) => p.totalValue!))
  const zero =
    max <= 0 ? '0%' : min >= 0 ? '100%' : `${(max / (max - min)) * 100}%`
  const color = 'var(--investments, var(--positive))'
  const line = (value: number) => (value < 0 ? 'var(--negative)' : color)
  return (
    <figure aria-label={label} className="dashboard-history-chart">
      <ChartContainer
        config={{
          totalValue: { label, color },
          netContribution: { label: t('dashboard_v014:contributions') },
        }}
        className="h-full w-full"
        data-no-swipe-drag
      >
        <AreaChart
          data={data}
          stackOffset="sign"
          margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onTouchStart={() => setHovered(true)}
          onTouchEnd={() => setHovered(false)}
        >
          <defs>
            <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
              {min >= 0 || max <= 0 ? (
                <>
                  <stop offset="5%" stopColor={line(max)} stopOpacity={0.2} />
                  <stop offset="70%" stopColor={line(max)} stopOpacity={0.12} />
                  <stop offset="100%" stopColor={line(max)} stopOpacity={0} />
                </>
              ) : (
                <>
                  <stop offset="0%" stopColor={color} stopOpacity={0.2} />
                  <stop offset={zero} stopColor={color} stopOpacity={0.05} />
                  <stop
                    offset={zero}
                    stopColor="var(--negative)"
                    stopOpacity={0.05}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--negative)"
                    stopOpacity={0.2}
                  />
                </>
              )}
            </linearGradient>
            <linearGradient id={`${id}-stroke`} x1="0" y1="0" x2="0" y2="1">
              {min >= 0 || max <= 0 ? (
                <stop offset="0%" stopColor={line(max)} />
              ) : (
                <>
                  <stop offset={zero} stopColor={color} />
                  <stop offset={zero} stopColor="var(--negative)" />
                </>
              )}
            </linearGradient>
          </defs>
          <Tooltip
            position={{ y: -20 }}
            cursor={{
              stroke: 'var(--border)',
              strokeWidth: 1,
              pointerEvents: 'none',
            }}
            wrapperStyle={{ pointerEvents: 'none' }}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as
                (typeof data)[number] | undefined
              return active && point ? (
                <div className="chart-tooltip">
                  <p>{formatDate(point.date)}</p>
                  <div>
                    {label}:{' '}
                    {point.value === null ? (
                      t('common:unavailable')
                    ) : (
                      <Money value={point.value} currency={currency} />
                    )}
                  </div>
                  <div>
                    {t('dashboard_v014:contributions')}:{' '}
                    {point.net_contribution === null ? (
                      t('common:unavailable')
                    ) : (
                      <Money
                        value={point.net_contribution}
                        currency={currency}
                      />
                    )}
                  </div>
                  {markers
                    .filter((m) => m.date === point.date)
                    .map((m) => (
                      <small key={m.label}>{m.label}</small>
                    ))}
                </div>
              ) : null
            }}
          />
          <XAxis hide dataKey="date" type="category" />
          <YAxis
            hide
            type="number"
            scale={config.scale === 'log' ? 'log' : 'auto'}
            domain={config.domain}
          />
          <Area
            {...motion}
            connectNulls={false}
            type="monotone"
            dataKey="totalValue"
            stroke={`url(#${id}-stroke)`}
            strokeWidth={1}
            fillOpacity={1}
            fill={`url(#${id}-fill)`}
            dot={false}
            activeDot={{ r: 4, stroke: 'var(--background)', strokeWidth: 2 }}
          />
          {config.showNetContribution && (
            <Area
              {...motion}
              connectNulls={false}
              type="monotone"
              dataKey="netContribution"
              stroke="var(--muted-foreground)"
              activeDot={false}
              fill="transparent"
              strokeDasharray="5 5"
              strokeOpacity={hovered && !hidden ? 0.8 : 0}
            />
          )}
          {markers.map((marker, index) => {
            const point = data.find((p) => p.date === marker.date)
            return point?.totalValue != null ? (
              <ReferenceDot
                key={`${marker.date}-${index}`}
                x={point.date}
                y={point.totalValue}
                r={3}
                fill={color}
                stroke="var(--background)"
                onClick={() => onMarkerClick?.(marker.date)}
              />
            ) : null
          })}
          {available.length === 1 && (
            <ReferenceDot
              x={available[0].date}
              y={available[0].totalValue!}
              r={4}
              fill={line(available[0].totalValue!)}
              stroke="var(--background)"
              strokeWidth={2}
            />
          )}
        </AreaChart>
      </ChartContainer>
    </figure>
  )
}
