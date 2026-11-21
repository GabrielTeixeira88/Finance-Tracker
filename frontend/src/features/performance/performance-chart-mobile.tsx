// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Wealthfolio 92b4647 components/performance-chart-mobile.tsx; exact local series adapter.
import { PERFORMANCE_CHART_COLORS } from './performance-chart-colors'
import type { ReturnData } from './series'
import { prepareSeries, axisPercent, exactPercent } from './series'
import { useDateFormatting } from '@/features/holdings/number-formatters'
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/vendor/wealthfolio/ui/components/ui/chart'
import { differenceInDays, differenceInMonths, parseISO } from 'date-fns'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import type {
  NameType,
  ValueType,
} from 'recharts/types/component/DefaultTooltipContent'

// Recharts computes vertical grid positions even with `vertical={false}`. On a
// new chart's first render it does so with default axis settings, measuring one
// tick label per data point in the DOM (~0.7 s for 1,300 points in Chromium).
const noVerticalGridPoints = () => []

interface PerformanceChartMobileProps {
  data: {
    id: string
    name: string
    returns: ReturnData[]
    isReference?: boolean
  }[]
}

export function PerformanceChartMobile({ data }: PerformanceChartMobileProps) {
  const dateFormatting = useDateFormatting()

  const normalized = prepareSeries(data)
  const formattedData = normalized.rows
  // Calculate appropriate tick interval based on date range - more aggressive for mobile
  const getTickInterval = () => {
    if (!formattedData?.length) return 60

    const firstDate = parseISO(String(formattedData[0].date))
    const lastDate = parseISO(
      String(formattedData[formattedData.length - 1].date),
    )
    const monthsDiff = differenceInMonths(lastDate, firstDate)
    const daysDiff = differenceInDays(lastDate, firstDate)

    if (daysDiff <= 7) return 1 // Show every other day for 1 week
    if (daysDiff <= 31) return 10 // Show ~3 ticks for 1 month
    if (monthsDiff <= 3) return 30 // Monthly for 3 months
    if (monthsDiff <= 6) return 60 // Bi-monthly for 6 months
    if (monthsDiff <= 12) return 90 // Quarterly for 1 year
    if (monthsDiff <= 36) return 180 // Semi-annually for 3 years
    return 365 // Yearly for longer periods
  }

  // Format date based on range - more compact for mobile
  const formatXAxis = (dateStr: string) => {
    if (!formattedData?.length) return ''

    const firstDate = parseISO(String(formattedData[0].date))
    const lastDate = parseISO(
      String(formattedData[formattedData.length - 1].date),
    )
    const monthsDiff = differenceInMonths(lastDate, firstDate)
    const daysDiff = differenceInDays(lastDate, firstDate)

    if (daysDiff <= 7) {
      return dateFormatting.formatCalendarDate(dateStr, {
        month: 'short',
        day: 'numeric',
      })
    }
    if (daysDiff <= 31) {
      return dateFormatting.formatCalendarDate(dateStr, {
        month: 'short',
        day: 'numeric',
      })
    }
    if (monthsDiff <= 12) {
      return dateFormatting.formatCalendarDate(dateStr, { month: 'short' })
    }
    if (monthsDiff <= 36) {
      return dateFormatting.formatCalendarDate(dateStr, {
        month: 'short',
        year: '2-digit',
      })
    }
    return dateFormatting.formatCalendarDate(dateStr, { year: 'numeric' })
  }

  const chartConfig = data.reduce((config, series, index) => {
    config[normalized.keys[index]] = {
      label: series.name,
      color: PERFORMANCE_CHART_COLORS[index % PERFORMANCE_CHART_COLORS.length],
    }
    return config
  }, {} as ChartConfig)

  const tooltipFormatter = (
    _value: ValueType | undefined,
    name: NameType | undefined,
    item: {
      dataKey?: unknown
      payload?: { exact?: Record<string, string | null> }
    },
  ): [string, string] => {
    const raw = item.payload?.exact?.[String(item.dataKey)]
    return [exactPercent(raw) + ' - ', String(name ?? '')]
  }

  const tooltipLabelFormatter = (label: React.ReactNode) =>
    typeof label === 'string' ? dateFormatting.formatCalendarDate(label) : ''

  return (
    <div className="h-full w-full">
      <ChartContainer
        config={chartConfig}
        className="h-full w-full"
        data-no-swipe-drag
      >
        <ResponsiveContainer width="100%" height="100%" aspect={undefined}>
          <LineChart
            data={formattedData}
            margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
          >
            <CartesianGrid
              vertical={false}
              verticalCoordinatesGenerator={noVerticalGridPoints}
              strokeDasharray="3 3"
              opacity={0.3}
            />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={6}
              tickFormatter={formatXAxis}
              interval={getTickInterval()}
              tick={{ fontSize: '0.6875rem' }}
            />
            <YAxis
              tickFormatter={(value: number) =>
                axisPercent(value, normalized.minimum, normalized.maximum)
              }
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              domain={[-0.05, 1.05]}
              ticks={
                normalized.minimum === normalized.maximum ? [0.5] : undefined
              }
              tick={{ fontSize: '0.6875rem' }}
              width={50}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  formatter={tooltipFormatter}
                  labelFormatter={tooltipLabelFormatter}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent payload={[]} />} />
            {data.map((series, seriesIndex) => (
              <Line
                key={series.id}
                type="linear"
                connectNulls={false}
                dataKey={normalized.keys[seriesIndex]}
                stroke={
                  PERFORMANCE_CHART_COLORS[
                    seriesIndex % PERFORMANCE_CHART_COLORS.length
                  ]
                }
                strokeWidth={series.isReference ? 1.75 : 2}
                strokeDasharray={series.isReference ? '5 5' : undefined}
                dot={false}
                name={series.name}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  )
}
