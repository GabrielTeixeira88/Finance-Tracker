// SPDX-License-Identifier: AGPL-3.0-only
// Wealthfolio 92b4647 save-up-projection-card.tsx: source card/header/legend,
// 300px chart, date axes, nominal gradient, target guide and callout composition.
// Local exact labels/normalized coordinates and recorded actuals replace Number
// financial fields. Unapproved return-sensitive range bands are not fabricated.
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Area,
  AreaChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/vendor/wealthfolio/ui/components/ui/card'
import { useAmountFormatting, useDateFormatting } from '@/features/holdings/ui'
import { useMotionPolicy } from '@/lib/motion'
import { decimalUnits } from '@/lib/money'
import type { ProjectionPoint } from '../../lib/save-up-adapter'

const COLORS = {
  nominal: { fill: 'hsl(92, 24%, 70%)', stroke: 'var(--success)' },
  target: 'var(--muted-foreground)',
  actual: 'var(--chart-1)',
}
function normalize(data: ProjectionPoint[]) {
  const keys = ['actual', 'nominal', 'target'] as const
  const max = data.reduce(
    (max, row) =>
      keys.reduce(
        (max, key) =>
          row[key] !== null && decimalUnits(row[key]) > max
            ? decimalUnits(row[key])
            : max,
        max,
      ),
    0n,
  )
  return data.map((row) => ({
    ...row,
    time: Date.parse(row.date + 'T12:00:00Z'),
    actualCoordinate:
      row.actual === null
        ? null
        : max === 0n
          ? 0
          : Number((decimalUnits(row.actual) * 1000000n) / max) / 1000000,
    nominalCoordinate:
      row.nominal === null
        ? null
        : max === 0n
          ? 0
          : Number((decimalUnits(row.nominal) * 1000000n) / max) / 1000000,
    targetCoordinate:
      row.target === null
        ? null
        : max === 0n
          ? 0
          : Number((decimalUnits(row.target) * 1000000n) / max) / 1000000,
  }))
}
type ChartRow = ReturnType<typeof normalize>[number]
function ProjectionTooltip({
  active,
  point,
  currency,
  isHidden,
}: {
  active?: boolean
  point?: ChartRow
  currency: string
  isHidden: boolean
}) {
  const formatting = useAmountFormatting(),
    dates = useDateFormatting(),
    { t } = useTranslation()
  if (!active || !point) return null
  const rows = [
    {
      label: t('goalsMigration:actual'),
      value: point.actual,
      color: COLORS.actual,
      style: 'solid',
    },
    {
      label: t('wfGoals:projection.series_projected'),
      value: point.nominal,
      color: COLORS.nominal.stroke,
      style: 'solid',
    },
    {
      label: t('wfGoals:projection.series_target'),
      value: point.target,
      color: COLORS.target,
      style: 'dashed',
    },
  ]
  return (
    <div className="bg-popover grid grid-cols-1 gap-1.5 rounded-md border p-2 shadow-md">
      <p className="text-muted-foreground text-xs">
        {dates.formatCalendarDate(point.date, {
          calendar: 'gregory',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}
      </p>
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-center justify-between space-x-4"
        >
          <div className="flex items-center space-x-1.5">
            <span
              className="block w-3"
              style={
                row.style === 'dashed'
                  ? { borderTop: `1.5px dashed ${row.color}` }
                  : { height: '2px', backgroundColor: row.color }
              }
            />
            <span className="text-muted-foreground text-xs">{row.label}:</span>
          </div>
          <span className="text-xs font-semibold tabular-nums">
            {isHidden ? '••••' : formatting.formatAmount(row.value, currency)}
          </span>
        </div>
      ))}
    </div>
  )
}
export function SaveUpProjectionCard({
  data,
  currency,
  isHidden,
}: {
  data: ProjectionPoint[]
  currency: string
  isHidden: boolean
  annualReturn?: string
}) {
  const { t } = useTranslation(),
    formatting = useAmountFormatting(),
    dates = useDateFormatting(),
    reduced = useMotionPolicy(),
    uid = useId().replace(/:/g, '')
  const points = normalize(data),
    last = points.at(-1)
  const tickStep = Math.max(1, Math.floor(points.length / 7)) + 1,
    ticks = points
      .filter((_, i) => i % tickStep === 0)
      .map((point) => point.time)
  const fmt = (value: string | null) =>
    isHidden ? '••••' : formatting.formatAmount(value, currency)
  const dateLabel = (value: string) =>
    dates.formatCalendarDate(value, {
      calendar: 'gregory',
      month: 'short',
      year: '2-digit',
    })
  const hasTarget =
    last?.target !== null &&
    last?.target !== undefined &&
    decimalUnits(last.target) > 0n
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <div className="text-muted-foreground mb-1 text-xs font-medium tracking-[0.15em] uppercase">
            {t('wfGoals:projection.kicker')}
          </div>
          <CardTitle className="text-base leading-none tracking-tight">
            {t('wfGoals:projection.title')}
          </CardTitle>
        </div>
        <div className="text-muted-foreground flex flex-wrap justify-end gap-x-4 gap-y-1 text-xs">
          {[
            {
              label: t('goalsMigration:actual'),
              color: COLORS.actual,
              dashed: false,
            },
            {
              label: t('wfGoals:projection.legend_projected'),
              color: COLORS.nominal.stroke,
              dashed: false,
            },
            {
              label: t('wfGoals:projection.legend_target'),
              color: COLORS.target,
              dashed: true,
            },
          ].map((row) => (
            <span key={row.label} className="flex items-center gap-1.5">
              <span
                className="inline-block h-[2px] w-5"
                style={
                  row.dashed
                    ? { borderTop: `1px dashed ${row.color}` }
                    : { backgroundColor: row.color }
                }
              />
              {row.label}
            </span>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div role="img" aria-label={t('wfGoals:projection.title')}>
          <ResponsiveContainer
            width="100%"
            height={300}
            initialDimension={{ width: 800, height: 300 }}
          >
            <AreaChart
              data={points}
              margin={{ top: 10, right: 150, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient
                  id={'projNominal' + uid}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor={COLORS.nominal.fill}
                    stopOpacity={0.28}
                  />
                  <stop
                    offset="70%"
                    stopColor={COLORS.nominal.fill}
                    stopOpacity={0.14}
                  />
                  <stop
                    offset="100%"
                    stopColor={COLORS.nominal.fill}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                type="number"
                domain={['dataMin', 'dataMax']}
                ticks={ticks}
                tick={{ fontSize: '0.6875rem' }}
                tickFormatter={(time: number) =>
                  dateLabel(new Date(time).toISOString().slice(0, 10))
                }
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide domain={[0, 1.05]} />
              <Tooltip
                content={({ active, payload }) => (
                  <ProjectionTooltip
                    active={active}
                    point={payload?.[0]?.payload as ChartRow | undefined}
                    currency={currency}
                    isHidden={isHidden}
                  />
                )}
              />
              <Area
                type="linear"
                dataKey="nominalCoordinate"
                stroke={COLORS.nominal.stroke}
                strokeWidth={2.25}
                fill={'url(#projNominal' + uid + ')'}
                fillOpacity={1}
                isAnimationActive={!reduced}
                animationDuration={300}
                animationEasing="ease-out"
                connectNulls={false}
              />
              <Line
                type="stepAfter"
                dataKey="actualCoordinate"
                stroke={COLORS.actual}
                strokeWidth={2.25}
                dot={
                  points.filter((row) => row.actual !== null).length === 1
                    ? { r: 3 }
                    : false
                }
                connectNulls={false}
                isAnimationActive={!reduced}
                animationDuration={300}
              />
              {hasTarget && (
                <Line
                  type="linear"
                  dataKey="targetCoordinate"
                  stroke={COLORS.target}
                  strokeWidth={1.25}
                  strokeOpacity={0.6}
                  strokeDasharray="6 4"
                  dot={false}
                  activeDot={false}
                  isAnimationActive={!reduced}
                  animationDuration={300}
                  connectNulls={false}
                />
              )}
              {last && hasTarget && (
                <>
                  <ReferenceLine
                    x={last.time}
                    stroke={COLORS.target}
                    strokeWidth={1}
                    strokeDasharray="4 3"
                    strokeOpacity={0.5}
                  />
                  <ReferenceDot
                    x={last.time}
                    y={last.targetCoordinate ?? 0}
                    r={3}
                    fill={COLORS.target}
                    stroke="none"
                    label={{
                      value: fmt(last.target),
                      position: 'right',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      fill: 'var(--muted-foreground)',
                      dx: 6,
                    }}
                  />
                  {last.nominalCoordinate !== null && (
                    <ReferenceDot
                      x={last.time}
                      y={last.nominalCoordinate}
                      r={3}
                      fill={COLORS.nominal.stroke}
                      stroke="none"
                      label={{
                        value: fmt(last.nominal),
                        position: 'right',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        fill: 'var(--foreground)',
                        dx: 6,
                      }}
                    />
                  )}
                </>
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <details className="mt-3 text-xs">
          <summary>{t('goalsMigration:exactValues')}</summary>
          <div className="overflow-x-auto">
            <table className="w-full text-start">
              <caption className="sr-only">
                {t('wfGoals:projection.title')}
              </caption>
              <thead>
                <tr>
                  <th>{t('parity:date')}</th>
                  <th>{t('goalsMigration:actual')}</th>
                  <th>{t('wfGoals:projection.legend_projected')}</th>
                  <th>{t('wfGoals:projection.legend_target')}</th>
                </tr>
              </thead>
              <tbody>
                {points.map((row) => (
                  <tr key={row.date}>
                    <th scope="row">{dates.formatCalendarDate(row.date)}</th>
                    <td>{fmt(row.actual)}</td>
                    <td>{fmt(row.nominal)}</td>
                    <td>{fmt(row.target)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </CardContent>
    </Card>
  )
}
