import { t as tr, ui } from '@/lib/i18n'
import { Suspense } from 'react'
import { useHistory } from '@/lib/use-history'
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

export type PreviewPage = 'Performance' | 'Net Worth' | 'Reports'

export default function Preview({
  page,
  navigate,
}: {
  page: PreviewPage
  navigate: Navigate
}) {
  const { demo, period, setPeriod, result, series } = useHistory('1Y')
  const illustrative = page === 'Performance'
  const fixture = demo.data?.enabled ? demo.data.preview : null
  return (
    <>
      <PageHeader
        title={ui(page)}
        description={
          illustrative
            ? tr(
                'dynamic:synthetic_design_preview_no_financial_engine_or__601f2f',
              )
            : tr(
                'dynamic:read_only_layout_preview_using_your_actual_ledge_4d34a8',
              )
        }
      >
        <Badge>{tr('previews:preview_f1fbb2')}</Badge>
      </PageHeader>
      <p className="demo-notice">
        {illustrative
          ? tr(
              'dynamic:fictional_illustration_only_budget_targets_and_p_723fc4',
            )
          : tr(
              'dynamic:ledger_balances_only_this_is_not_a_net_worth_val_5196a8',
            )}
      </p>
      {demo.isError || result.isError ? (
        <ErrorState
          text={tr('previews:unable_to_load_preview__779028')}
          retry={() => {
            void demo.refetch()
            void result.refetch()
          }}
        />
      ) : demo.isPending || result.isPending ? (
        <LoadingState />
      ) : illustrative && !fixture ? (
        <EmptyState
          title={tr('previews:demo_workspace_required_227025')}
          detail={tr(
            'previews:use_the_documented_historical_demo_command_with__20306a',
          )}
        />
      ) : (
        <>
          {!illustrative && (
            <div className="preview-controls">
              <DateRangeTabs value={period} onChange={setPeriod} />
            </div>
          )}
          {page === 'Performance' && fixture && (
            <>
              <section className="primary-value">
                <h2>{tr('previews:illustrative_balance_path_40f730')}</h2>
                <Money
                  value={fixture.performance.at(-1)?.balance ?? '0'}
                  currency={fixture.currency}
                />
                <p className="metadata">
                  {tr(
                    'previews:static_synthetic_scenario_no_live_prices_returns_a731f3',
                  )}
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
                    {tr(
                      'previews:these_fixture_points_illustrate_chart_compositio_891a97',
                    )}
                  </p>
                </>
              )}
            </>
          )}
          {(page === 'Net Worth' || page === 'Reports') &&
            (!series ? (
              <EmptyState title={tr('previews:no_ledger_history_yet_b93bd7')} />
            ) : (
              <>
                <section className="primary-value">
                  <h2>{tr('previews:total_balance_891433')}</h2>
                  <Money
                    value={series.total_balance}
                    currency={series.currency}
                  />
                  <p className="metadata">
                    {result.data.date_from} – {result.data.date_to} ·{' '}
                    {series.currency} {tr('previews:only_f8969a')}{' '}
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
                    title={tr('previews:account_breakdown_4149b3')}
                    detail={tr(
                      'previews:includes_credit_card_ledger_debt_and_investment__aa5921',
                    )}
                  >
                    <AccountRows
                      accounts={result.data.accounts.filter(
                        (a) => a.currency === series.currency,
                      )}
                      navigate={navigate}
                    />
                  </Panel>
                  {page === 'Reports' ? (
                    <Panel title={tr('previews:spending_by_category_d4aadf')}>
                      <SpendingList series={series} />
                    </Panel>
                  ) : (
                    <Panel title={tr('previews:what_this_includes_3ab7d7')}>
                      <p className="metadata">
                        {tr(
                          'previews:account_balances_reconstructed_from_opening_bala_4eb5ed',
                        )}
                      </p>
                    </Panel>
                  )}
                  {page === 'Reports' && (
                    <Panel
                      title={tr('previews:income_vs_expenses_8fc62b')}
                      detail={tr(
                        'previews:transfers_and_opening_balances_excluded_edc272',
                      )}
                    >
                      <div className="cash-flow-metrics">
                        <SummaryMetric
                          title={tr('previews:income_1c89b1')}
                          value={series.income}
                          currency={series.currency}
                          detail={tr('previews:selected_period_043cb5')}
                          tone="positive"
                        />
                        <SummaryMetric
                          title={tr('previews:expenses_8d437d')}
                          value={series.expenses}
                          currency={series.currency}
                          detail={tr('previews:selected_period_043cb5')}
                          tone="negative"
                        />
                        <SummaryMetric
                          title={tr('previews:net_cash_flow_d649f1')}
                          value={series.net_flow}
                          currency={series.currency}
                          detail={tr('previews:selected_period_043cb5')}
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
