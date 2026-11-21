// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Wealthfolio 92b4647 income-page.tsx currency breakdown.
// Slice geometry uses converted payment-date amounts; labels retain original money.
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { compositionData } from '@/lib/composition'
import { sumMoney } from '@/lib/money'
import { t } from '@/lib/i18n'
import { useChartMotion } from '@/lib/motion'
import type { IncomeReporting } from '@/lib/investment-analytics'
import { Money } from './primitives'

export function IncomeCurrencyMix({ report }: { report: IncomeReporting }) {
  const motion = useChartMotion()
  if (report.quality !== 'COMPLETE') return null
  const currencies = [...new Set(report.events.map((e) => e.original.currency))]
  if (!currencies.length) return null
  const rows = currencies.map((currency) => ({
    name: currency,
    value: sumMoney(
      report.events
        .filter((e) => e.original.currency === currency)
        .map((e) => e.net!),
    ),
    original: sumMoney(
      report.events
        .filter((e) => e.original.currency === currency)
        .map((e) => e.original.net),
    ),
  }))
  const data = compositionData(rows, true)
  if (!data) return null
  return (
    <figure
      className="income-currency-mix"
      aria-label={t('income_dashboard:currency_mix')}
    >
      <ResponsiveContainer
        width={64}
        height={64}
        initialDimension={{ width: 64, height: 64 }}
      >
        <PieChart>
          <Pie
            data={data}
            dataKey="coordinate"
            nameKey="name"
            innerRadius={0}
            outerRadius={24}
            stroke="none"
            {...motion}
          >
            {data.map((row) => (
              <Cell key={row.name} fill={row.color} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              const row = active
                ? (payload?.[0]?.payload as (typeof rows)[number] | undefined)
                : undefined
              const original = rows.find((r) => r.name === row?.name)
              return original ? (
                <div className="chart-tooltip">
                  <strong>{original.name}</strong>
                  <p>
                    <Money value={original.original} currency={original.name} />
                  </p>
                  <p>
                    <Money value={original.value} currency={report.currency} />
                  </p>
                </div>
              ) : null
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <figcaption className="sr-only">
        {t('income_dashboard:currency_mix')}
      </figcaption>
    </figure>
  )
}
