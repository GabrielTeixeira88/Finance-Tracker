import { InvestmentActivities as Activities } from '@/features/activities/investment-activities'
import { DetailDrawer } from '@/components/detail-drawer'
import { analyticsPeriods } from '@/lib/investment-analytics'
import { ActivityNavigation } from '@/components/activity-navigation'
import { InvestmentHero } from '@/components/investment-hero'
import { t as tr, ui } from '@/lib/i18n'
import { InvestmentOverviewRows } from '@/components/investment-overview-rows'
import { useSection, useRoute, navigateTo } from '@/lib/navigation'
import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Field } from '@/components/forms'
import { Button } from '@/components/ui/button'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Money,
  PageHeader,
  SectionHeader,
} from '@/components/primitives'
import {
  getDemo,
  getTransactions,
  type Account,
  type Category,
} from '@/lib/api'
import {
  getAssets,
  getPortfolio,
  quantityText,
  type Holding,
} from '@/lib/investments'
import { decimalUnits } from '@/lib/money'
import { TransactionTable } from '@/components/transaction-table'
import { ActivityForm, AssetForm, PriceForm } from './investment-forms'
import BrokerageImports from './investment-imports'
import FixedIncome from './fixed-income'
import { SecurityMarketData } from './market-data'
import InvestmentAnalytics, {
  SecurityClassification,
  SecurityResults,
} from './investment-analytics'
import './investments.css'

function Value({
  value,
  currency,
}: {
  value: string | null
  currency: string
}) {
  return value === null ? (
    <span className="metadata">{tr('investments:unavailable_2c9c1f')}</span>
  ) : (
    <Money value={value} currency={currency} />
  )
}

function DetailValues({
  currency,
  rows,
}: {
  currency: string
  rows: [string, string | null][]
}) {
  return (
    <aside className="investment-detail-values">
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{ui(label)}</dt>
            <dd>
              <Value value={value} currency={currency} />
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  )
}
export function HoldingsTable({
  rows,
  onOpen,
  accounts,
}: {
  rows: Holding[]
  onOpen: (id: string) => void
  accounts?: Account[]
}) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('symbol')
  const filtered = rows
    .filter((r) =>
      `${r.symbol} ${r.name} ${r.exchange}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === 'value'
        ? a.currency.localeCompare(b.currency) ||
          (a.market_value === null
            ? b.market_value === null
              ? a.symbol.localeCompare(b.symbol)
              : 1
            : b.market_value === null
              ? -1
              : decimalUnits(a.market_value) === decimalUnits(b.market_value)
                ? a.symbol.localeCompare(b.symbol)
                : decimalUnits(a.market_value) > decimalUnits(b.market_value)
                  ? -1
                  : 1)
        : sort === 'quantity'
          ? decimalUnits(a.quantity) > decimalUnits(b.quantity)
            ? -1
            : decimalUnits(a.quantity) < decimalUnits(b.quantity)
              ? 1
              : 0
          : a.symbol.localeCompare(b.symbol),
    )
  return (
    <>
      <div className="investment-toolbar">
        <Field label={tr('investments:search_holdings_5feeb3')}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr('investments:symbol_or_security_ceb6f4')}
          />
        </Field>
        <Field label={tr('investments:sort_holdings_08672e')}>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="symbol">
              {tr('investments:security_a_z_1eb636')}
            </option>
            <option value="quantity">
              {tr('investments:quantity_descending_d3beb1')}
            </option>
            <option value="value">{tr('parity:market_value_sort')}</option>
          </select>
        </Field>
      </div>
      {!filtered.length ? (
        <EmptyState
          title={
            rows.length
              ? tr('dynamic:no_matching_holdings_77d59c')
              : tr('dynamic:no_holdings_yet_b35017')
          }
          detail={
            rows.length
              ? tr(
                  'dynamic:change_the_security_search_or_currency_filter__f55800',
                )
              : tr(
                  'dynamic:create_a_security_fund_an_investment_account_the_c0e384',
                )
          }
        />
      ) : (
        <div className="table-scroll">
          <table className="investment-table">
            <caption className="sr-only">
              {tr('investments:investment_holdings_7b4b4d')}
            </caption>
            <thead>
              <tr>
                {[
                  'Security',
                  ...(accounts ? ['Account'] : []),
                  'Quantity',
                  'Average cost',
                  'Cost basis',
                  'Last price',
                  'Market value',
                  'Unrealized P&L',
                  'Realized P&L',
                ].map((h) => (
                  <th scope="col" key={h}>
                    {ui(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={`${r.asset_id}-${r.account_id}`}>
                  <td>
                    <button
                      className="investment-security"
                      onClick={() => onOpen(r.asset_id)}
                    >
                      {r.symbol}
                    </button>
                    <small>{r.name}</small>
                    <small>
                      {r.exchange} · {r.currency}
                      {decimalUnits(r.quantity) === 0n
                        ? tr('dynamic:_closed_14cd2b')
                        : ''}
                    </small>
                  </td>
                  {accounts && (
                    <td>{accounts.find((a) => a.id === r.account_id)?.name}</td>
                  )}
                  <td className="number">{quantityText(r.quantity)}</td>
                  <td className="number">
                    <Value value={r.average_cost} currency={r.currency} />
                  </td>
                  <td className="number">
                    <Value value={r.cost_basis} currency={r.currency} />
                  </td>
                  <td className="number">
                    <Value value={r.last_price} currency={r.currency} />
                    {r.price_date && (
                      <small>
                        {r.price_date} ·{' '}
                        {r.price_source ?? tr('dynamic:unknown_source_09d244')}
                        {r.price_freshness === 'STALE'
                          ? tr('dynamic:_stale_cache_45929e')
                          : r.price_stale
                            ? tr('dynamic:_carried_prior_quote_a876e0')
                            : ''}
                      </small>
                    )}
                  </td>
                  <td className="number">
                    <Value value={r.market_value} currency={r.currency} />
                  </td>
                  <td className="number">
                    <Value value={r.unrealized} currency={r.currency} />
                  </td>
                  <td className="number">
                    <Value value={r.realized} currency={r.currency} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

export { InvestmentActivities as Activities } from '@/features/activities/investment-activities'

export default function Investments({
  accounts,
  categories,
  initialAccount = '',
  initialView = 'Overview',
}: {
  accounts: Account[]
  categories: Category[]
  initialAccount?: string
  initialView?: string
}) {
  const demo = useQuery({
    queryKey: ['demo'],
    queryFn: ({ signal }) => getDemo(signal),
  })
  if (demo.isPending)
    return (
      <LoadingState
        text={tr('investments:loading_investment_workspace__6ffc67')}
      />
    )
  if (demo.isError)
    return (
      <ErrorState text={demo.error.message} retry={() => void demo.refetch()} />
    )
  return (
    <InvestmentWorkspace
      accounts={accounts}
      categories={categories}
      initialAccount={initialAccount}
      initialView={initialView}
      initialDate={demo.data.enabled ? demo.data.end_date : ''}
    />
  )
}

export function InvestmentWorkspace({
  accounts,
  categories,
  initialAccount = '',
  initialDate = '',
  initialView = 'Overview',
}: {
  accounts: Account[]
  categories: Category[]
  initialAccount?: string
  initialDate?: string
  initialView?: string
}) {
  const [insightsAction, setInsightsAction] = useState<ReactNode | null>(null)
  const route = useRoute()
  const accountId = route.params.get('account') ?? initialAccount
  const asOf =
    route.params.get('end') ||
    initialDate ||
    new Date().toLocaleDateString('en-CA')
  const setContext = (values: Record<string, string>) =>
    navigateTo('Investments', undefined, {
      ...Object.fromEntries(route.params),
      ...values,
    })
  const setAccountId = (account: string) => setContext({ account })
  const setAsOf = (end: string) => {
    if (end) setContext({ end })
  }
  const [tab, setTab] = useSection(
    [
      'Overview',
      'Performance',
      'Allocation',
      'Fixed Income',
      'Income',
      'Holdings',
      'Activity',
      'Accounts',
      'Imports',
    ],
    initialView,
  )
  const security = route.params.get('asset') ?? ''
  const setSecurity = (asset: string) => setContext({ asset })
  const [editor, setEditor] = useState<'activity' | 'asset' | 'price' | null>(
    null,
  )
  const assets = useQuery({
    queryKey: ['investments', 'assets'],
    queryFn: getAssets,
  })
  const portfolio = useQuery({
    queryKey: ['investments', 'portfolio', accountId, asOf],
    queryFn: ({ signal }) => getPortfolio(accountId, asOf, signal),
  })
  const recent = useQuery({
    queryKey: ['investments', 'account-ledger', accountId],
    queryFn: ({ signal }) =>
      getTransactions(
        new URLSearchParams({ account_id: accountId, limit: '8' }),
        signal,
      ),
    enabled: !!accountId,
  })
  const selected = assets.data?.find((a) => a.id === security)
  const holding = portfolio.data?.holdings.find((h) => h.asset_id === security)
  const account = portfolio.data?.accounts.find((a) => a.id === accountId)
  const onOpen = (id: string) => {
    setSecurity(id)
    setEditor(null)
  }
  const close = () => setEditor(null)
  const isInsights = ['Allocation', 'Performance', 'Income'].includes(tab)
  return (
    <div
      className={`investment-workspace ${isInsights ? 'insights-workspace' : ''} ${tab === 'Income' ? 'income-workspace' : ''} ${tab === 'Overview' && !security ? 'investment-dashboard' : ''}`}
    >
      {isInsights && <h1 className="sr-only">{ui(tab)}</h1>}
      {!isInsights && (
        <PageHeader
          title={
            selected
              ? selected.name
              : accountId
                ? accounts.find((a) => a.id === accountId)?.name ||
                  tr('dynamic:investment_account_f3d13a')
                : tr('dynamic:investments_5de64a')
          }
          description={
            selected
              ? `${selected.symbol} · ${selected.exchange} · ${selected.currency}`
              : tr(
                  'dynamic:activity_derived_positions_weighted_average_cost_9cf21c',
                )
          }
        >
          {(security || accountId) && (
            <Button
              variant="ghost"
              onClick={() => {
                setContext({ view: 'Overview', asset: '', account: '' })
                setEditor(null)
              }}
            >
              {tr('investments:all_investments_294ede')}
            </Button>
          )}
          {tab !== 'Fixed Income' && selected?.asset_type !== 'BOND' && (
            <>
              <Button
                variant="outline"
                onClick={() => setEditor(editor === 'asset' ? null : 'asset')}
              >
                {tr('investments:add_security_1b9631')}
              </Button>
              <Button
                onClick={() =>
                  setEditor(editor === 'activity' ? null : 'activity')
                }
              >
                {tr('investments:add_activity_63b759')}
              </Button>
            </>
          )}
          {selected && selected.asset_type !== 'BOND' && (
            <Button
              variant="outline"
              onClick={() => setEditor(editor === 'price' ? null : 'price')}
            >
              {tr('investments:add_manual_price_fa0895')}
            </Button>
          )}
        </PageHeader>
      )}
      {['Activity', 'Imports'].includes(tab) && (
        <ActivityNavigation
          investment
          tool={tab === 'Imports' ? 'imports' : ''}
          onTool={() => setContext({ view: 'Imports', asset: '' })}
        />
      )}
      <div
        className={`investment-toolbar ${tab === 'Allocation' ? 'insights-overview-toolbar' : ''}`}
      >
        {!['Activity', 'Imports'].includes(tab) && tab !== 'Overview' && (
          <nav
            className="range-tabs"
            aria-label={tr('investments:investment_views_008588')}
          >
            {(['Performance', 'Allocation', 'Income'].includes(tab)
              ? ['Allocation', 'Performance', 'Income']
              : ['Holdings', 'Fixed Income'].includes(tab)
                ? ['Overview', 'Holdings', 'Fixed Income']
                : ['Overview', 'Activity', 'Imports']
            ).map((t) => (
              <button
                key={ui(t)}
                aria-pressed={tab === t}
                onClick={() => {
                  setContext({ view: t, asset: '' })
                  setEditor(null)
                }}
              >
                {t === 'Fixed Income'
                  ? tr('fixed_income:title')
                  : t === 'Allocation'
                    ? ui('Overview')
                    : ui(t)}
              </button>
            ))}
          </nav>
        )}
        {isInsights && tab !== 'Allocation' && (
          <nav
            className="range-tabs analytics-period-tabs"
            aria-label={tr('investment_analytics:analytics_period_2d5f60')}
          >
            {(tab === 'Income'
              ? ['YTD', 'LAST_YEAR', 'ALL']
              : analyticsPeriods
            ).map((range) => (
              <button
                key={range}
                aria-pressed={
                  (route.params.get('range') ||
                    (tab === 'Income' ? 'ALL' : '3M')) === range
                }
                onClick={() => setContext({ range })}
              >
                {tab === 'Income'
                  ? tr(`income_dashboard:period_${range}`)
                  : ui(range)}
              </button>
            ))}
            {tab === 'Income' && (
              <select
                aria-label={tr('income_dashboard:more_periods')}
                value={
                  ['YTD', 'LAST_YEAR', 'ALL'].includes(
                    route.params.get('range') || 'ALL',
                  )
                    ? ''
                    : route.params.get('range')!
                }
                onChange={(event) =>
                  event.target.value &&
                  setContext({ range: event.target.value })
                }
              >
                <option value="" disabled>
                  {tr('income_dashboard:more_periods')}
                </option>
                {analyticsPeriods
                  .filter((range) => !['YTD', 'ALL'].includes(range))
                  .map((range) => (
                    <option key={range} value={range}>
                      {ui(range)}
                    </option>
                  ))}
              </select>
            )}
          </nav>
        )}

        <Field label={tr('investments:portfolio_account_cf6a1f')}>
          <select
            value={accountId}
            onChange={(e) => {
              setAccountId(e.target.value)
              setEditor(null)
            }}
          >
            <option value="">
              {tr('investments:all_investment_accounts_031796')}
            </option>
            {accounts
              .filter((a) => a.type === 'INVESTMENT')
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label={tr('investments:valuation_as_of_58c88f')}>
          <input
            type="date"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
          />
        </Field>
        {tab === 'Allocation' && insightsAction}
      </div>
      {assets.isError || portfolio.isError ? (
        <ErrorState
          text={
            assets.error?.message ||
            portfolio.error?.message ||
            tr('dynamic:unable_to_load_investments_25cef5')
          }
          retry={() => {
            void assets.refetch()
            void portfolio.refetch()
          }}
        />
      ) : assets.isPending || portfolio.isPending ? (
        <LoadingState
          text={tr('investments:reconstructing_investment_positions__51ffea')}
        />
      ) : (
        <>
          {editor && (
            <DetailDrawer
              title={
                editor === 'asset'
                  ? tr('investments:add_security_1b9631')
                  : editor === 'price'
                    ? tr('investments:add_manual_price_fa0895')
                    : tr('investments:add_activity_63b759')
              }
              onClose={close}
            >
              {editor === 'asset' && <AssetForm onSaved={close} />}
              {editor === 'activity' && (
                <ActivityForm
                  accounts={accounts}
                  assets={assets.data}
                  initialAccount={accountId}
                  onSaved={close}
                />
              )}
              {editor === 'price' && selected && (
                <PriceForm asset={selected} onSaved={close} />
              )}
            </DetailDrawer>
          )}
          {security && selected ? (
            <>
              {selected.asset_type === 'BOND' ? (
                <FixedIncome
                  asOf={asOf}
                  accountId={accountId}
                  assetId={security}
                />
              ) : (
                <div className="investment-detail-grid">
                  <SecurityMarketData
                    key={security}
                    id={security}
                    asOf={asOf}
                  />
                  {holding && (
                    <DetailValues
                      currency={holding.currency}
                      rows={[
                        ['Market value', holding.market_value],
                        ['Cost basis', holding.cost_basis],
                        ['Average cost', holding.average_cost],
                        ['Unrealized P&L', holding.unrealized],
                        ['Realized P&L', holding.realized],
                        ['Investment income', holding.income],
                      ]}
                    />
                  )}
                </div>
              )}
              <details>
                <summary>{tr('investment_analytics:exposure_862ee3')}</summary>
                <SecurityClassification id={security} />
              </details>
              <SecurityResults
                id={security}
                accountId={accountId}
                asOf={asOf}
                onSecurity={onOpen}
              />
              <SectionHeader
                title={tr('investments:position_across_accounts_93070c')}
                detail={tr(
                  'investments:missing_market_prices_are_never_substituted_with_70ecaf',
                )}
              />
              <HoldingsTable
                rows={portfolio.data.positions.filter(
                  (p) => p.asset_id === security,
                )}
                accounts={accounts}
                onOpen={onOpen}
              />
              <Activities
                key={`${accountId}-${security}`}
                accountId={accountId}
                assetId={security}
                accounts={accounts}
                assets={assets.data}
              />
            </>
          ) : tab === 'Fixed Income' ? (
            <FixedIncome asOf={asOf} accountId={accountId} />
          ) : tab === 'Imports' ? (
            <BrokerageImports accounts={accounts} />
          ) : ['Performance', 'Allocation', 'Income'].includes(tab) ? (
            <InvestmentAnalytics
              externalRangeControls
              onCustomizeActionChange={setInsightsAction}
              view={tab}
              accountId={accountId}
              asOf={asOf}
              onSecurity={onOpen}
            />
          ) : (
            <>
              {tab === 'Overview' && (
                <>
                  <div
                    className={account ? 'investment-detail-grid' : undefined}
                  >
                    <InvestmentHero accountId={accountId} asOf={asOf} />
                    {account && (
                      <DetailValues
                        currency={account.currency}
                        rows={[
                          ['Cash', account.cash],
                          ['Market value', account.market_value],
                          ['Cost basis', account.cost_basis],
                          ['Unrealized P&L', account.unrealized ?? null],
                          ['Realized P&L', account.realized],
                          ['Investment income', account.income],
                        ]}
                      />
                    )}
                  </div>
                  <InvestmentOverviewRows
                    assets={assets.data}
                    accountId={accountId}
                    asOf={asOf}
                    currency={route.params.get('currency') || 'BRL'}
                    onAccount={(id) => navigateTo('Account', id, { end: asOf })}
                    onSecurity={(id) => {
                      setEditor(null)
                      setContext({ view: 'Holdings', asset: id })
                    }}
                    onHoldings={() => setTab('Holdings')}
                  />
                  {portfolio.data.totals.length === 0 && (
                    <EmptyState
                      title={tr(
                        'investments:no_investment_accounts_yet_2bf6c8',
                      )}
                      detail={tr(
                        'investments:create_an_investment_account_under_accounts_then_d1c43b',
                      )}
                    />
                  )}
                  <details className="chart-data">
                    <summary>
                      {tr('investments:total_investment_value__835b3e')}
                    </summary>
                    {portfolio.data.totals.map((total) => (
                      <section
                        className="investment-summary"
                        key={total.currency}
                      >
                        <div className="investment-primary">
                          <span className="metadata">
                            {' '}
                            {tr(
                              'investments:total_investment_value__835b3e',
                            )}{' '}
                            {total.currency}
                          </span>
                          <strong>
                            <Value
                              value={total.total_value}
                              currency={total.currency}
                            />
                          </strong>
                          <small>
                            {total.missing_prices
                              ? tr('messages:message_7080704e3821', {
                                  value0: total.missing_prices,
                                })
                              : tr('messages:message_e513f021946d', {
                                  value0: portfolio.data.as_of,
                                })}
                          </small>
                        </div>
                        <div className="investment-metrics">
                          <div>
                            <span className="metadata">
                              {tr('investments:unrealized_p_l_73c67e')}
                            </span>
                            <Value
                              value={total.unrealized ?? null}
                              currency={total.currency}
                            />
                          </div>
                          {[
                            ['Cash', total.cash],
                            [
                              'Known holdings value',
                              total.known_holdings_value,
                            ],
                            ['Cost basis', total.cost_basis],
                            ['Realized P&L', total.realized],
                            ['Investment income', total.income],
                          ].map(([label, value]) => (
                            <div key={label}>
                              <span className="metadata">{ui(label)}</span>
                              <Money value={value} currency={total.currency} />
                            </div>
                          ))}
                        </div>
                      </section>
                    ))}
                  </details>
                </>
              )}
              {tab === 'Holdings' && (
                <>
                  <SectionHeader
                    title={tr('investments:holdings_72f9d3')}
                    detail={tr(
                      'investments:open_a_security_for_account_level_positions_and__138912',
                    )}
                  />
                  <HoldingsTable
                    rows={portfolio.data.holdings}
                    onOpen={onOpen}
                  />
                  {assets.data.length > 0 && (
                    <details>
                      <summary>
                        {' '}
                        {tr('investments:security_directory__a9cfe1')}{' '}
                        {assets.data.length}
                      </summary>
                      <div className="investment-actions">
                        {assets.data.map((a) => (
                          <Button
                            key={a.id}
                            variant="ghost"
                            onClick={() => onOpen(a.id)}
                          >
                            {a.symbol} · {a.exchange} · {a.currency}
                          </Button>
                        ))}
                      </div>
                    </details>
                  )}
                </>
              )}
              {tab === 'Activity' && (
                <Activities
                  key={accountId}
                  accountId={accountId}
                  assetId=""
                  accounts={accounts}
                  assets={assets.data}
                />
              )}
              {tab === 'Accounts' && (
                <>
                  <SectionHeader
                    title={tr('investments:investment_accounts_b56bf3')}
                    detail={tr(
                      'investments:cash_is_included_once_in_total_value_incomplete__90c80b',
                    )}
                  />
                  <div className="table-scroll">
                    <table className="investment-table">
                      <thead>
                        <tr>
                          {[
                            'Account',
                            'Currency',
                            'Cash',
                            'Known holdings',
                            'Cost basis',
                            'Total value',
                          ].map((h) => (
                            <th key={h}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {portfolio.data.accounts.map((a) => (
                          <tr key={a.id}>
                            <td>
                              <button
                                className="investment-security"
                                onClick={() => {
                                  setAccountId(a.id)
                                  setTab('Overview')
                                }}
                              >
                                {a.name}
                              </button>
                              {!a.active && (
                                <small>
                                  {tr('investments:inactive_09af57')}
                                </small>
                              )}
                            </td>
                            <td>{a.currency}</td>
                            {[
                              a.cash,
                              a.known_holdings_value,
                              a.cost_basis,
                              a.total_value,
                            ].map((v, i) => (
                              <td className="number" key={i}>
                                <Value value={v} currency={a.currency} />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {accountId && tab === 'Overview' && (
                <>
                  <Activities
                    key={accountId}
                    accountId={accountId}
                    assetId=""
                    accounts={accounts}
                    assets={assets.data}
                  />
                  <SectionHeader
                    title={tr(
                      'investments:recent_cash_transfers_and_ordinary_transactions_cf685a',
                    )}
                  />
                  {recent.isPending ? (
                    <LoadingState />
                  ) : recent.isError ? (
                    <ErrorState
                      text={recent.error.message}
                      retry={() => void recent.refetch()}
                    />
                  ) : (
                    <TransactionTable
                      rows={recent.data}
                      accounts={accounts}
                      categories={categories}
                    />
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
