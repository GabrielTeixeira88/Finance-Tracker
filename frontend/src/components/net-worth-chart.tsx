import { demoChartLabel } from '@/lib/demo-runtime'
import { isSimulatedInvestmentScenario } from '@/lib/demo-runtime'
// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Wealthfolio 92b4647 pages/net-worth/net-worth-chart.tsx.
// Exact labels, dimensionless coordinates and gaps replace parseFloat/zero fallbacks.
import { useDemoRuntime } from '@/lib/demo-runtime'
import { useId } from 'react'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  YAxis,
  ReferenceLine,
} from 'recharts'
import { formatDate, decimalUnits, formatMoney } from '@/lib/money'
import { useFinancialPrivacy } from '@/lib/financial-privacy'
import { useChartMotion } from '@/lib/motion'
import { Money } from './primitives'
import { t } from '@/lib/i18n'
import { netWorthChartGeometry } from '@/lib/net-worth-view'
export function NetWorthChart({
  points,
  currency,
  label,
  small = false,
}: {
  points: {
    date: string
    value: string | null
    assets?: string | null
    liabilities?: string | null
  }[]
  currency: string
  label: string
  small?: boolean
}) {
  const demoLabel = demoChartLabel(useDemoRuntime().runtime?.scenario)
  const id = useId().replaceAll(':', '')
  const { hidden } = useFinancialPrivacy()
  const motion = useChartMotion()
  const simulated = isSimulatedInvestmentScenario(
    useDemoRuntime().runtime?.scenario,
  )
  const geometry = netWorthChartGeometry(points)
  const data = points.map((p, index) => ({
    ...p,
    coordinate: geometry.data[index].coordinate,
  }))
  if (!data.some((p) => p.value !== null))
    return (
      <figure
        className={`balance-chart net-worth-source-chart${small ? ' is-small' : ''}`}
        aria-label={label}
      >
        <div className="net-worth-no-history">
          {t('networth:history_unavailable')}
        </div>
      </figure>
    )
  return (
    <figure
      className={`balance-chart net-worth-source-chart${small ? ' is-small' : ''}`}
      aria-label={label}
    >
      <ResponsiveContainer
        width="100%"
        height={small ? 160 : 280}
        initialDimension={{ width: 800, height: 280 }}
      >
        <AreaChart
          data={data}
          margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor="var(--net-worth-chart)"
                stopOpacity={0.2}
              />
              <stop
                offset="70%"
                stopColor="var(--net-worth-chart)"
                stopOpacity={0.12}
              />
              <stop
                offset="100%"
                stopColor="var(--net-worth-chart)"
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <Tooltip
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as
                (typeof data)[number] | undefined
              return active && p ? (
                <div className="chart-tooltip net-worth-tooltip">
                  <p>{formatDate(p.date)}</p>
                  {simulated && <small>{t(demoLabel)}</small>}
                  {p.value === null ? (
                    <span>{t('common:unavailable')}</span>
                  ) : (
                    <Money value={p.value} currency={currency} minorUnits />
                  )}
                  {p.liabilities != null &&
                    decimalUnits(p.liabilities) > 0n && (
                      <>
                        <small>{t('networth:assets')}</small>
                        {p.assets != null && (
                          <Money
                            value={p.assets}
                            currency={currency}
                            minorUnits
                          />
                        )}
                        <small>{t('networth:liabilities')}</small>
                        <Money
                          value={p.liabilities}
                          currency={currency}
                          minorUnits
                        />
                      </>
                    )}
                </div>
              ) : null
            }}
          />
          <YAxis
            hide
            type="number"
            domain={
              geometry.flat
                ? [
                    geometry.min - geometry.padding,
                    geometry.max + geometry.padding,
                  ]
                : [(value: number) => value - Math.abs(value) * 0.02, 'auto']
            }
          />
          {geometry.crossesZero && (
            <ReferenceLine
              y={0}
              stroke="var(--muted-foreground)"
              strokeOpacity={0.4}
              strokeDasharray="4 4"
              label={{
                value: hidden ? '••••' : formatMoney('0', currency),
                position: 'insideTopLeft',
                fill: 'var(--muted-foreground)',
                fontSize: 11,
              }}
            />
          )}
          <Area
            {...motion}
            type="monotone"
            dataKey="coordinate"
            connectNulls={false}
            stroke="var(--net-worth-chart)"
            strokeWidth={1}
            fill={`url(#${id})`}
            baseValue="dataMin"
            dot={false}
            activeDot={{ r: 3 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </figure>
  )
}
