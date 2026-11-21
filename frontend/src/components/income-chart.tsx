import { demoChartLabel } from '@/lib/demo-runtime'
import { incomeAxis } from '@/lib/income-dashboard'
import {
  isSimulatedInvestmentScenario,
  useDemoRuntime,
} from '@/lib/demo-runtime'
// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Wealthfolio 92b4647 pages/income/income-history-chart.tsx.
// Geometry is dimensionless; monetary labels retain exact API decimal strings.
import { useChartMotion } from '@/lib/motion'
import { useId, useState, useSyncExternalStore } from 'react'
import { t as tr, ui } from '@/lib/i18n'
import {
  Bar,
  ComposedChart,
  Area,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { decimalUnits, unitsToMoney, formatMoney } from '@/lib/money'
import { Money } from './primitives'
import { compositionColors } from '@/lib/composition'
import { useFinancialPrivacy } from '@/lib/financial-privacy'
import { getLocale } from '@/lib/preferences'

const mobileQuery = () => window.matchMedia('(max-width: 767px)')
const subscribeSize = (notify: () => void) => {
  const query = mobileQuery()
  query.addEventListener('change', notify)
  return () => query.removeEventListener('change', notify)
}
const mobileSnapshot = () => mobileQuery().matches

export default function IncomeChart({
  rows,
  currency,
  accounts = [],
  period = 'ALL',
}: {
  rows: {
    month: string
    net: string
    previous?: string | null
    accounts?: Record<string, string>
  }[]
  currency: string
  accounts?: { id: string; name: string }[]
  period?: string
}) {
  const demoLabel = demoChartLabel(useDemoRuntime().runtime?.scenario)
  const simulated = isSimulatedInvestmentScenario(
    useDemoRuntime().runtime?.scenario,
  )
  const gradient = useId().replaceAll(':', '')
  const mobile = useSyncExternalStore(
    subscribeSize,
    mobileSnapshot,
    () => false,
  )
  const [accountMode, setByAccount] = useState(false)
  const byAccount = accountMode && accounts.length > 1
  const chartMotion = useChartMotion()
  const { hidden } = useFinancialPrivacy()
  const maximum = rows.reduce((m, row) => {
    const v = decimalUnits(row.net)
    const magnitude = v < 0n ? -v : v
    const previous = decimalUnits(row.previous ?? '0')
    return [m, magnitude, previous < 0n ? -previous : previous].reduce(
      (a, b) => (a > b ? a : b),
    )
  }, 0n)
  const history = rows.reduce<
    ((typeof rows)[number] & { cumulative: string })[]
  >(
    (result, row) => [
      ...result,
      {
        ...row,
        cumulative: unitsToMoney(
          decimalUnits(result.at(-1)?.cumulative ?? '0') +
            decimalUnits(row.net),
        ),
      },
    ],
    [],
  )
  const cumulativeMax = history.reduce((max, row) => {
    const v = decimalUnits(row.cumulative)
    const a = v < 0n ? -v : v
    return a > max ? a : max
  }, 0n)
  const monthlyAxis = incomeAxis(maximum)
  const cumulativeAxis = incomeAxis(cumulativeMax, monthlyAxis.values.length)
  const axisLabel = (value: number, axis: ReturnType<typeof incomeAxis>) =>
    hidden
      ? '••••'
      : formatMoney(
          unitsToMoney(axis.values[axis.ticks.indexOf(value)] ?? 0n),
          currency,
        ).replaceAll(' ', '\u00a0')
  const data = history.map((row) => ({
    ...row,
    cumulativeCoordinate: cumulativeMax
      ? Number(
          (decimalUnits(row.cumulative) * 1_000_000n) / cumulativeAxis.top,
        ) / 10000
      : 0,
    coordinate: maximum
      ? Number((decimalUnits(row.net) * 1_000_000n) / monthlyAxis.top) / 10000
      : 0,
    previousCoordinate:
      row.previous == null
        ? null
        : maximum
          ? Number(
              (decimalUnits(row.previous) * 1_000_000n) / monthlyAxis.top,
            ) / 10000
          : 0,
    accountCoordinates: accounts.map((account) =>
      maximum
        ? Number(
            (decimalUnits(row.accounts?.[account.id] ?? '0') * 1_000_000n) /
              monthlyAxis.top,
          ) / 10000
        : 0,
    ),
  }))
  return (
    <figure
      aria-label={tr('messages:message_96db5b8236eb', { value0: currency })}
      className="income-history-chart"
    >
      <p className="metadata income-chart-period">
        {['ALL', 'YTD', 'LAST_YEAR'].includes(period)
          ? tr(`income_dashboard:period_${period}`)
          : ui(period)}
      </p>
      {accounts.length > 1 && (
        <nav
          className="income-chart-mode"
          aria-label={tr('income_dashboard:chart_view')}
        >
          <button aria-pressed={!byAccount} onClick={() => setByAccount(false)}>
            {tr('income_dashboard:combined')}
          </button>
          <button aria-pressed={byAccount} onClick={() => setByAccount(true)}>
            {tr('income_dashboard:by_account')}
          </button>
        </nav>
      )}
      <div className="income-plot">
        <ResponsiveContainer
          width="100%"
          height="100%"
          style={{ position: 'absolute', inset: 0 }}
          initialDimension={{ width: 800, height: 300 }}
        >
          <ComposedChart
            data={data}
            margin={{ top: 12, right: 8, bottom: 4, left: 0 }}
          >
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 3"
              stroke="var(--border)"
              opacity={0.3}
            />
            <XAxis
              dataKey="month"
              tickFormatter={(month) =>
                new Intl.DateTimeFormat(getLocale(), {
                  month: 'short',
                  year: '2-digit',
                  timeZone: 'UTC',
                }).format(new Date(`${month}-01T12:00:00Z`))
              }
              tickLine={false}
              axisLine={false}
              ticks={rows
                .filter(
                  (_, i) =>
                    i %
                      Math.max(1, Math.ceil(rows.length / (mobile ? 5 : 9))) ===
                    0,
                )
                .map((r) => r.month)}
              interval={0}
              tickMargin={8}
              tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
            />
            <YAxis
              yAxisId="monthly"
              tickLine={false}
              axisLine={false}
              width={mobile ? 82 : 92}
              tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
              ticks={monthlyAxis.ticks}
              tickFormatter={(v) => axisLabel(v, monthlyAxis)}
              domain={[data.some((r) => r.coordinate < 0) ? -100 : 0, 100]}
            />
            <YAxis
              yAxisId="cumulative"
              orientation="right"
              tickLine={false}
              axisLine={false}
              width={92}
              hide={byAccount || mobile}
              tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
              ticks={cumulativeAxis.ticks}
              tickFormatter={(v) => axisLabel(v, cumulativeAxis)}
              domain={[
                data.some((r) => r.cumulativeCoordinate < 0) ? -100 : 0,
                100,
              ]}
            />
            <Tooltip
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as
                  (typeof data)[number] | undefined
                return active && p ? (
                  <div className="chart-tooltip">
                    {simulated && <p>{tr(demoLabel)}</p>}
                    <p>{p.month}</p>
                    <Money value={p.net} currency={currency} />
                    {p.previous != null && (
                      <p>
                        {tr('income_dashboard:previous')}{' '}
                        <Money value={p.previous} currency={currency} />
                      </p>
                    )}
                    {byAccount &&
                      accounts.map((account) => (
                        <p key={account.id}>
                          {account.name}{' '}
                          <Money
                            value={p.accounts?.[account.id] ?? '0'}
                            currency={currency}
                          />
                        </p>
                      ))}
                    <p>{tr('parity:cumulative_income')}</p>
                    <Money value={p.cumulative} currency={currency} />
                  </div>
                ) : null
              }}
            />
            {!byAccount && (
              <>
                <defs>
                  <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="var(--chart-secondary)"
                      stopOpacity={0.18}
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--chart-secondary)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <Area
                  yAxisId="cumulative"
                  dataKey="cumulativeCoordinate"
                  type="monotoneX"
                  stroke="var(--chart-secondary)"
                  strokeWidth={2.25}
                  fill={`url(#${gradient})`}
                  dot={false}
                  connectNulls={false}
                  {...chartMotion}
                />
                <Bar
                  yAxisId="monthly"
                  dataKey="previousCoordinate"
                  fill="var(--muted-foreground)"
                  opacity={0.6}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={18}
                  {...chartMotion}
                />
                <Bar
                  yAxisId="monthly"
                  dataKey="coordinate"
                  fill="var(--income-chart)"
                  {...chartMotion}
                  maxBarSize={18}
                  radius={[4, 4, 0, 0]}
                />
              </>
            )}
            {byAccount &&
              accounts.map((account, index) => (
                <Bar
                  key={account.id}
                  yAxisId="monthly"
                  dataKey={`accountCoordinates.${index}`}
                  name={account.name}
                  stackId="accounts"
                  fill={compositionColors[index % compositionColors.length]}
                  maxBarSize={25}
                  radius={
                    index === accounts.length - 1 ? [4, 4, 0, 0] : undefined
                  }
                  {...chartMotion}
                />
              ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="metadata income-chart-legend">
        {(byAccount
          ? accounts.map((a, i) => ({
              name: a.name,
              color: compositionColors[i % compositionColors.length],
            }))
          : [
              {
                name: tr('parity:cumulative_income'),
                color: 'var(--chart-secondary)',
              },
              {
                name: tr('income_dashboard:monthly_income'),
                color: 'var(--income-chart)',
              },
              ...(rows.some((r) => r.previous != null)
                ? [
                    {
                      name: tr('income_dashboard:prior_income'),
                      color: 'var(--muted-foreground)',
                    },
                  ]
                : []),
            ]
        ).map((item) => (
          <span key={item.name}>
            <i style={{ background: item.color }} aria-hidden="true" />
            {item.name}
          </span>
        ))}
      </figcaption>
    </figure>
  )
}
