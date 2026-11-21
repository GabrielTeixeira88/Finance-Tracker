import { demoChartLabel } from '@/lib/demo-runtime'
import { isSimulatedInvestmentScenario } from '@/lib/demo-runtime'
// SPDX-License-Identifier: AGPL-3.0-only
// Presentation adapted from Wealthfolio 92b4647 history-chart.tsx; exact local data and gaps retained.
import {
  financialCurve,
  financialGradient,
  type FinancialChartMode,
} from '@/lib/chart-presentation'
import { useDemoRuntime } from '@/lib/demo-runtime'
import { useChartMotion } from '@/lib/motion'
import { t as tr } from '@/lib/i18n'
import { getLocale } from '@/lib/preferences'
import { useId } from 'react'
import {
  Area,
  AreaChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { chartCoordinates, formatDecimal } from '@/lib/money'
import type { MarketHistory } from '@/lib/market-data'
import { Money } from './primitives'

export function PortfolioValueChart({
  history,
  security = false,
  label,
  hero = false,
  mode = 'market',
}: {
  history: MarketHistory
  security?: boolean
  label?: string
  hero?: boolean
  mode?: FinancialChartMode
}) {
  const demoLabel = demoChartLabel(useDemoRuntime().runtime?.scenario)
  const chartMotion = useChartMotion()
  const fictional = isSimulatedInvestmentScenario(
    useDemoRuntime().runtime?.scenario,
  )
  const manual = mode === 'manual-observations'
  const id = useId().replaceAll(':', '')
  const valid = history.points.flatMap((p) =>
    p.value === null ? [] : [{ date: p.date, balance: p.value }],
  )
  const coordinates = new Map(
    chartCoordinates(valid).map((p) => [p.date, p.coordinate]),
  )
  const data = history.points.map((p) => ({
    ...p,
    time: Date.parse(`${p.date}T12:00:00Z`),
    coordinate: coordinates.get(p.date) ?? null,
  }))
  return (
    <figure
      className="balance-chart"
      aria-label={tr('messages:message_8d36ab5ecf0b', {
        value0: history.currency,
        value1: label ?? (security ? 'security price' : 'portfolio value'),
      })}
    >
      <ResponsiveContainer
        width="100%"
        height={hero ? 280 : 300}
        initialDimension={{ width: 800, height: 300 }}
      >
        <AreaChart
          data={data}
          margin={{ top: 14, right: 8, left: 8, bottom: 0 }}
        >
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              {financialGradient.map((s) => (
                <stop
                  key={s.offset}
                  offset={s.offset}
                  stopColor="var(--investment-chart)"
                  stopOpacity={s.opacity}
                />
              ))}
            </linearGradient>
          </defs>
          <XAxis
            hide={hero}
            dataKey="time"
            type="number"
            domain={['dataMin', 'dataMax']}
            scale="time"
            axisLine={false}
            tickLine={false}
            minTickGap={45}
            tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
            tickFormatter={(time: number) =>
              new Intl.DateTimeFormat(getLocale(), {
                month: 'short',
                day: 'numeric',
                timeZone: 'UTC',
              }).format(new Date(time))
            }
          />
          <YAxis hide domain={[-8, 108]} />
          <Tooltip
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as
                (typeof data)[number] | undefined
              return active && p ? (
                <div className="chart-tooltip">
                  <p className="metadata">{p.date}</p>
                  {fictional && <small>{tr(demoLabel)}</small>}
                  {manual && <small>{tr('charts:recorded')}</small>}
                  {p.value === null ? (
                    tr('dynamic:incomplete_valuation_6b0844')
                  ) : (
                    <Money value={p.value} currency={history.currency} />
                  )}
                  {history.purchase_markers
                    ?.filter((m) => m.date === p.date)
                    .map((m, index) => (
                      <p key={index} className="metadata">
                        {tr('real_market:purchase')}: {m.symbol} ·{' '}
                        {formatDecimal(m.quantity)}
                      </p>
                    ))}
                </div>
              ) : null
            }}
          />
          <Area
            type={financialCurve(mode)}
            dataKey="coordinate"
            connectNulls={false}
            stroke="var(--investment-chart)"
            strokeWidth={1.5}
            dot={manual || data.length === 1 ? { r: 2, strokeWidth: 1 } : false}
            activeDot={{ r: 4 }}
            fill={`url(#${id})`}
            {...chartMotion}
            name={label ?? 'Portfolio value'}
          />
          {[...new Set(history.purchase_markers?.map((m) => m.date))].map(
            (date) => {
              const point = data.find((p) => p.date === date)
              return point?.coordinate == null ? null : (
                <ReferenceDot
                  key={date}
                  x={point.time}
                  y={point.coordinate}
                  r={3}
                  fill="var(--background)"
                  stroke="var(--investment-chart)"
                  aria-label={`${tr('real_market:purchase')} ${date}`}
                />
              )
            },
          )}
        </AreaChart>
      </ResponsiveContainer>
      <figcaption className={hero ? 'sr-only' : 'metadata'}>
        {manual && <span>{tr('charts:manual_interpolation')} </span>}
        {fictional && <span>{tr(demoLabel)} </span>}
        {label ??
          (security
            ? tr('dynamic:eligible_security_prices_7853e0')
            : tr('dynamic:cash_plus_securities_040611'))}{' '}
        · {history.currency}{' '}
        {tr('portfolio_value_chart:_gaps_mean_missing_coverage__9602ec')}{' '}
        {label
          ? tr('dynamic:dated_records_no_projected_returns_ac3c2f')
          : security
            ? tr('dynamic:original_quote_currency_55eaa2')
            : history.fx_provider === 'SYNTHETIC'
              ? tr('dynamic:synthetic_demo_fx_897c81')
              : tr('dynamic:dated_ecb_fx_aa705b')}
      </figcaption>
      <details className={hero ? 'chart-data hero-chart-data' : 'chart-data'}>
        <summary>
          {label
            ? tr('messages:message_a7e0f12def92', {
                value0: label.toLowerCase(),
              })
            : security
              ? tr('dynamic:view_security_chart_data_153230')
              : tr('dynamic:view_portfolio_chart_data_d0470d')}
        </summary>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">
              {' '}
              {tr('portfolio_value_chart:exact_historical_2a09a9')}{' '}
              {label ?? tr('dynamic:portfolio_5f1a04')}{' '}
              {tr('portfolio_value_chart:values_048b0c')}{' '}
            </caption>
            <thead>
              <tr>
                <th scope="col">{tr('portfolio_value_chart:date_eb9a4b')}</th>
                <th scope="col" className="amount-cell">
                  {tr('portfolio_value_chart:value_8dce17')}
                </th>
                <th scope="col">
                  {tr('portfolio_value_chart:coverage_80e135')}
                </th>
              </tr>
            </thead>
            <tbody>
              {history.points.map((p) => (
                <tr key={p.date}>
                  <td>{p.date}</td>
                  <td className="amount-cell">
                    {p.value === null ? (
                      tr('dynamic:unavailable_2c9c1f')
                    ) : (
                      <Money value={p.value} currency={history.currency} />
                    )}
                  </td>
                  <td>
                    {label
                      ? p.value === null
                        ? tr('dynamic:unavailable_2c9c1f')
                        : tr('dynamic:available_7c62a1')
                      : p.missing_assets.length || p.missing_fx.length
                        ? tr('messages:message_9afeaf4d1eb8', {
                            value0: p.missing_assets.length,
                            value1: p.missing_fx.length,
                          })
                        : tr('dynamic:available_7c62a1')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}
