import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { PortfolioValueChart } from './portfolio-value-chart'
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AreaChart: ({
    children,
    data,
  }: {
    children: React.ReactNode
    data: unknown
  }) => (
    <svg data-testid="chart" data-points={JSON.stringify(data)}>
      {children}
    </svg>
  ),
  Area: ({
    type,
    connectNulls,
    dot,
  }: {
    type: string
    connectNulls: boolean
    dot: unknown
  }) => (
    <g
      data-testid="curve"
      data-curve={type}
      data-connect={String(connectNulls)}
      data-dot={String(!!dot)}
    />
  ),
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  ReferenceDot: () => null,
}))
it('smooths only recorded manual observations, preserving exact values and explicit gaps', () => {
  const values = ['45000.123456', null, '38000.654321']
  render(
    <PortfolioValueChart
      mode="manual-observations"
      history={{
        currency: 'BRL',
        fx_provider: '',
        warning: '',
        points: values.map((value, i) => ({
          date: `202${4 + i}-01-01`,
          value,
          known_value: value ?? '0',
          missing_assets: value === null ? ['missing'] : [],
          missing_fx: [],
        })),
      }}
    />,
  )
  expect(screen.getByTestId('curve')).toHaveAttribute('data-curve', 'monotoneX')
  expect(screen.getByTestId('curve')).toHaveAttribute('data-connect', 'false')
  const points = JSON.parse(
    screen.getByTestId('chart').getAttribute('data-points')!,
  )
  expect(points.map((p: { value: string | null }) => p.value)).toEqual(values)
  expect(points[1].coordinate).toBeNull()
  expect(screen.getByText(/Curves between observations/)).toBeVisible()
})
it('renders a single observation as a point and never fabricates a second date', () => {
  render(
    <PortfolioValueChart
      mode="manual-observations"
      history={{
        currency: 'BRL',
        fx_provider: '',
        warning: '',
        points: [
          {
            date: '2026-01-01',
            value: '38000',
            known_value: '38000',
            missing_assets: [],
            missing_fx: [],
          },
        ],
      }}
    />,
  )
  expect(screen.getByTestId('curve')).toHaveAttribute('data-dot', 'true')
  expect(
    JSON.parse(screen.getByTestId('chart').getAttribute('data-points')!),
  ).toHaveLength(1)
})
