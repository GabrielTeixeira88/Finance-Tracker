import { Suspense } from 'react'
import { useHistory } from '@/lib/use-history'
import { activityPercent, subtractMoney, sumMoney } from '@/lib/money'
import {
  AccountRows,
  DateRangeTabs,
  SpendingList,
} from '@/components/financial'
import {
  Badge,
  EmptyState,
  ErrorState,
  LoadingState,
  Money,
  PageHeader,
  Panel,
  SummaryMetric,
} from '@/components/primitives'
import type { Navigate } from '@/components/app-shell'
import { BalanceChart } from './dashboard'

export type PreviewPage =
  'Budget' | 'Investments' | 'Performance' | 'Net Worth' | 'Reports'

export default function Preview({
  page,
  navigate,
}: {
  page: PreviewPage
  navigate: Navigate
}) {
  const { demo, period, setPeriod, result, series, setCurrency } = useHistory(
    page === 'Budget' ? '1M' : '1Y',
  )
  const illustrative =
    page === 'Budget' || page === 'Investments' || page === 'Performance'
  const fixture = demo.data?.enabled ? demo.data.preview : null
  const investmentTotal = fixture
    ? sumMoney(fixture.holdings.map((h) => h.value))
    : '0'
  const budgetSeries = result.data?.series.find(
    (s) => s.currency === fixture?.currency,
  )
  return (
    <>
      <PageHeader
        title={page}
        description={
          illustrative
            ? 'Synthetic design preview. No financial engine or editing tools.'
            : 'Read-only layout preview using your actual ledger history.'
        }
      >
        <Badge>Preview</Badge>
      </PageHeader>
      <p className="demo-notice">
        {illustrative
          ? 'Fictional illustration only. Budget targets and portfolio examples are separate from your ledger and never affect account balances.'
          : 'Ledger balances only. This is not a net-worth valuation or a full reporting engine.'}
      </p>
      {demo.isError || result.isError ? (
        <ErrorState
          text="Unable to load preview."
          retry={() => {
            void demo.refetch()
            void result.refetch()
          }}
        />
      ) : demo.isPending || result.isPending ? (
        <LoadingState />
      ) : illustrative && !fixture ? (
        <EmptyState
          title="Demo workspace required"
          detail="Use the documented historical demo command with a separate empty database to explore these fictional layouts."
        />
      ) : (
        <>
          {!illustrative && (
            <div className="preview-controls">
              <DateRangeTabs value={period} onChange={setPeriod} />
              {series && result.data.series.length > 1 && (
                <label className="field">
                  Currency
                  <select
                    value={series.currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    {result.data.series.map((s) => (
                      <option key={s.currency}>{s.currency}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}
          {page === 'Budget' && fixture && (
            <Panel
              title="Monthly plan"
              detail={`${result.data.date_to.slice(0, 7)} · Fictional targets, actual ledger spending · ${fixture.currency}`}
            >
              <div className="table-scroll">
                <table>
                  <caption className="sr-only">
                    Synthetic budget preview
                  </caption>
                  <thead>
                    <tr>
                      {['Category', 'Demo target', 'Spent', 'Remaining'].map(
                        (h, i) => (
                          <th
                            scope="col"
                            key={h}
                            className={i ? 'amount-cell' : ''}
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {fixture.budgets.map((b) => {
                      const spent =
                        budgetSeries?.spending.find(
                          (s) => s.category_id === b.category_id,
                        )?.amount ?? '0'
                      const remaining = subtractMoney(b.target, spent)
                      return (
                        <tr key={b.category_id}>
                          <th scope="row">{b.name}</th>
                          <td className="amount-cell">
                            <Money
                              value={b.target}
                              currency={fixture.currency}
                            />
                          </td>
                          <td className="amount-cell">
                            <Money value={spent} currency={fixture.currency} />
                          </td>
                          <td className="amount-cell">
                            <Money
                              value={remaining}
                              currency={fixture.currency}
                              tone={
                                remaining.startsWith('-')
                                  ? 'negative'
                                  : 'neutral'
                              }
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
          {(page === 'Investments' || page === 'Performance') && fixture && (
            <>
              <section className="primary-value">
                <h2>
                  {page === 'Investments'
                    ? 'Illustrative portfolio value'
                    : 'Illustrative balance path'}
                </h2>
                <Money
                  value={
                    page === 'Investments'
                      ? investmentTotal
                      : (fixture.performance.at(-1)?.balance ?? '0')
                  }
                  currency={fixture.currency}
                />
                <p className="metadata">
                  Static synthetic scenario · No live prices, returns, or
                  benchmark calculations
                </p>
              </section>
              {page === 'Performance' && (
                <>
                  <Suspense fallback={<LoadingState />}>
                    <BalanceChart
                      points={fixture.performance}
                      currency={fixture.currency}
                      illustrative
                    />
                  </Suspense>
                  <p className="metadata">
                    These fixture points illustrate chart composition only.
                    Contributions and market movements are not separated; do not
                    interpret this path as investment performance.
                  </p>
                </>
              )}
              {page === 'Investments' && (
                <div className="dashboard-grid">
                  <Panel
                    title="Holdings illustration"
                    detail="Not reconciled to investment-account cash"
                  >
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th scope="col">Asset</th>
                            <th scope="col" className="amount-cell">
                              Value
                            </th>
                            <th scope="col" className="amount-cell">
                              Allocation
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {fixture.holdings.map((h) => (
                            <tr key={h.symbol}>
                              <th scope="row">
                                <strong>{h.symbol}</strong>
                                <p className="metadata">{h.name}</p>
                              </th>
                              <td className="amount-cell">
                                <Money
                                  value={h.value}
                                  currency={fixture.currency}
                                />
                              </td>
                              <td className="amount-cell">
                                {activityPercent(h.value, investmentTotal, '0')}
                                %
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Panel>
                  <Panel
                    title="Allocation"
                    detail="Fictional portfolio composition"
                  >
                    {fixture.holdings.map((h) => (
                      <div className="spending-row" key={h.symbol}>
                        <div>
                          <span>{h.symbol}</span>
                          <span>
                            {activityPercent(h.value, investmentTotal, '0')}%
                          </span>
                        </div>
                        <div className="spending-track">
                          <span
                            style={{
                              width: `${activityPercent(h.value, investmentTotal, '0')}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </Panel>
                  <Panel
                    title="Illustrative activity"
                    detail="Preview fixture, not investment transactions"
                  >
                    <ul className="activity-list">
                      {fixture.activity.map((a) => (
                        <li key={a.description}>
                          <div>
                            <strong>{a.description}</strong>
                            <p className="metadata">{a.date}</p>
                          </div>
                          <Money value={a.amount} currency={fixture.currency} />
                        </li>
                      ))}
                    </ul>
                  </Panel>
                  <Panel title="Performance context">
                    <p className="metadata">
                      Explore the Performance preview for a synthetic balance
                      path. Cost basis, returns, dividends, and live valuation
                      are intentionally deferred.
                    </p>
                    <button
                      className="text-action mt-3"
                      onClick={() => navigate('Performance')}
                    >
                      View Performance preview
                    </button>
                  </Panel>
                </div>
              )}
            </>
          )}
          {(page === 'Net Worth' || page === 'Reports') &&
            (!series ? (
              <EmptyState title="No ledger history yet" />
            ) : (
              <>
                <section className="primary-value">
                  <h2>Total balance</h2>
                  <Money
                    value={series.total_balance}
                    currency={series.currency}
                  />
                  <p className="metadata">
                    {result.data.date_from} – {result.data.date_to} ·{' '}
                    {series.currency} only
                  </p>
                </section>
                {page === 'Net Worth' && (
                  <Suspense fallback={<LoadingState />}>
                    <BalanceChart
                      points={series.points}
                      currency={series.currency}
                    />
                  </Suspense>
                )}
                <div className="dashboard-grid">
                  <Panel
                    title="Account breakdown"
                    detail="Includes credit-card ledger debt and investment cash"
                  >
                    <AccountRows
                      accounts={result.data.accounts.filter(
                        (a) => a.currency === series.currency,
                      )}
                      navigate={navigate}
                    />
                  </Panel>
                  {page === 'Reports' ? (
                    <Panel title="Spending by category">
                      <SpendingList series={series} />
                    </Panel>
                  ) : (
                    <Panel title="What this includes">
                      <p className="metadata">
                        Account balances reconstructed from opening balances and
                        all non-deleted transactions through the selected date.
                        No external assets, market valuations, or net-worth
                        snapshots are added.
                      </p>
                    </Panel>
                  )}
                  {page === 'Reports' && (
                    <Panel
                      title="Income vs expenses"
                      detail="Transfers and opening balances excluded"
                    >
                      <div className="cash-flow-metrics">
                        <SummaryMetric
                          title="Income"
                          value={series.income}
                          currency={series.currency}
                          detail="Selected period"
                          tone="positive"
                        />
                        <SummaryMetric
                          title="Expenses"
                          value={series.expenses}
                          currency={series.currency}
                          detail="Selected period"
                          tone="negative"
                        />
                        <SummaryMetric
                          title="Net cash flow"
                          value={series.net_flow}
                          currency={series.currency}
                          detail="Selected period"
                        />
                      </div>
                    </Panel>
                  )}
                </div>
              </>
            ))}
        </>
      )}
    </>
  )
}
