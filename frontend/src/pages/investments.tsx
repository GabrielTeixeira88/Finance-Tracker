import { useState } from 'react'
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
  getActivities,
  getAssets,
  getPortfolio,
  quantityText,
  type Holding,
} from '@/lib/investments'
import { decimalUnits } from '@/lib/money'
import { useWrite } from '@/lib/use-write'
import { TransactionTable } from '@/components/transaction-table'
import { ActivityForm, AssetForm, PriceForm } from './investment-forms'
import BrokerageImports from './investment-imports'
import { PortfolioHistory, SecurityMarketData } from './market-data'
import './investments.css'

function Value({
  value,
  currency,
}: {
  value: string | null
  currency: string
}) {
  return value === null ? (
    <span className="metadata">Unavailable</span>
  ) : (
    <Money value={value} currency={currency} />
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
      sort === 'quantity'
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
        <Field label="Search holdings">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Symbol or security"
          />
        </Field>
        <Field label="Sort holdings">
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="symbol">Security A–Z</option>
            <option value="quantity">Quantity descending</option>
          </select>
        </Field>
      </div>
      {!filtered.length ? (
        <EmptyState
          title="No holdings yet"
          detail="Create a security, fund an investment account, then add a BUY activity."
        />
      ) : (
        <div className="table-scroll">
          <table className="investment-table">
            <caption className="sr-only">Investment holdings</caption>
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
                    {h}
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
                      {decimalUnits(r.quantity) === 0n ? ' · Closed' : ''}
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
                        {r.price_date} · {r.price_source ?? 'Unknown source'}
                        {r.price_freshness === 'STALE'
                          ? ' · Stale cache'
                          : r.price_stale
                            ? ' · Carried prior quote'
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

function Activities({
  accountId,
  assetId,
  accounts,
  assets,
}: {
  accountId: string
  assetId: string
  accounts: Account[]
  assets: Awaited<ReturnType<typeof getAssets>>
}) {
  const [offset, setOffset] = useState(0)
  const rows = useQuery({
    queryKey: ['investments', 'activity', accountId, assetId, offset],
    queryFn: ({ signal }) => getActivities(accountId, assetId, offset, signal),
  })
  const write = useWrite()
  if (rows.isPending)
    return <LoadingState text="Loading investment activities…" />
  if (rows.isError)
    return (
      <ErrorState text={rows.error.message} retry={() => void rows.refetch()} />
    )
  return (
    <>
      <SectionHeader
        title="Investment activity"
        detail="Investment cash postings are separate from personal income and consumption."
      />
      {write.isError && <ErrorState text={write.error.message} />}
      {rows.data.length === 0 ? (
        <EmptyState title="No activities on this page" />
      ) : (
        <div className="table-scroll">
          <table className="investment-table">
            <caption className="sr-only">Investment activities</caption>
            <thead>
              <tr>
                {[
                  'Date',
                  'Activity / security',
                  'Account',
                  'Quantity',
                  'Gross',
                  'Fees / taxes',
                  'Net cash',
                  'Correction',
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.data.map((r) => (
                <tr key={r.id}>
                  <td>{r.activity_date}</td>
                  <td>
                    {r.activity_type} ·{' '}
                    {assets.find((a) => a.id === r.asset_id)?.symbol ||
                      'Account cash'}
                    <small>{r.notes}</small>
                  </td>
                  <td>{accounts.find((a) => a.id === r.account_id)?.name}</td>
                  <td className="number">{quantityText(r.quantity)}</td>
                  <td className="number">
                    <Money value={r.gross_amount} currency={r.currency} />
                  </td>
                  <td className="number">
                    <Money value={r.fees} currency={r.currency} />
                    <small>
                      <Money value={r.taxes} currency={r.currency} />
                    </small>
                  </td>
                  <td className="number">
                    {r.direction === 'OUT' ? '−' : '+'}
                    <Money value={r.cash_amount} currency={r.currency} />
                  </td>
                  <td>
                    {r.voided_at ? (
                      <span>Voided</span>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={write.isPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              'Void this activity and recalculate all later positions? History and source identity are retained. Invalid corrections will be rejected.',
                            )
                          )
                            write.mutate({
                              path: `/investments/activities/${r.id}/void`,
                            })
                        }}
                      >
                        Void
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="investment-actions">
        <Button
          size="sm"
          disabled={!offset}
          onClick={() => setOffset(offset - 50)}
        >
          Previous activities
        </Button>
        <span className="metadata">Page {offset / 50 + 1}</span>
        <Button
          size="sm"
          disabled={rows.data.length < 50}
          onClick={() => setOffset(offset + 50)}
        >
          Next activities
        </Button>
      </div>
    </>
  )
}

export default function Investments({
  accounts,
  categories,
  initialAccount = '',
}: {
  accounts: Account[]
  categories: Category[]
  initialAccount?: string
}) {
  const demo = useQuery({
    queryKey: ['demo'],
    queryFn: ({ signal }) => getDemo(signal),
  })
  if (demo.isPending)
    return <LoadingState text="Loading investment workspace…" />
  if (demo.isError)
    return (
      <ErrorState text={demo.error.message} retry={() => void demo.refetch()} />
    )
  return (
    <InvestmentWorkspace
      accounts={accounts}
      categories={categories}
      initialAccount={initialAccount}
      initialDate={demo.data.enabled ? demo.data.end_date : ''}
    />
  )
}

export function InvestmentWorkspace({
  accounts,
  categories,
  initialAccount = '',
  initialDate = '',
}: {
  accounts: Account[]
  categories: Category[]
  initialAccount?: string
  initialDate?: string
}) {
  const [accountId, setAccountId] = useState(initialAccount)
  const [asOf, setAsOf] = useState(initialDate)
  const [tab, setTab] = useState('Overview')
  const [security, setSecurity] = useState('')
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
  const onOpen = (id: string) => {
    setSecurity(id)
    setEditor(null)
  }
  const close = () => setEditor(null)
  return (
    <div className="investment-workspace">
      <PageHeader
        title={
          selected
            ? selected.name
            : accountId
              ? accounts.find((a) => a.id === accountId)?.name ||
                'Investment account'
              : 'Investments'
        }
        description={
          selected
            ? `${selected.symbol} · ${selected.exchange} · ${selected.currency}`
            : 'Activity-derived positions · Weighted-average cost · Cached market prices'
        }
      >
        {(security || accountId) && (
          <Button
            variant="ghost"
            onClick={() => {
              setSecurity('')
              setAccountId('')
              setEditor(null)
            }}
          >
            All investments
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => setEditor(editor === 'asset' ? null : 'asset')}
        >
          Add security
        </Button>
        <Button
          onClick={() => setEditor(editor === 'activity' ? null : 'activity')}
        >
          Add activity
        </Button>
        {selected && (
          <Button
            variant="outline"
            onClick={() => setEditor(editor === 'price' ? null : 'price')}
          >
            Add manual price
          </Button>
        )}
      </PageHeader>
      <div className="investment-toolbar">
        <nav className="range-tabs" aria-label="Investment views">
          {['Overview', 'Holdings', 'Activity', 'Accounts', 'Imports'].map(
            (t) => (
              <button
                key={t}
                aria-pressed={tab === t}
                onClick={() => {
                  setTab(t)
                  setSecurity('')
                  setEditor(null)
                }}
              >
                {t}
              </button>
            ),
          )}
        </nav>
        <Field label="Portfolio account">
          <select
            value={accountId}
            onChange={(e) => {
              setAccountId(e.target.value)
              setEditor(null)
            }}
          >
            <option value="">All investment accounts</option>
            {accounts
              .filter((a) => a.type === 'INVESTMENT')
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Valuation as of">
          <input
            type="date"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
          />
        </Field>
      </div>
      {assets.isError || portfolio.isError ? (
        <ErrorState
          text={
            assets.error?.message ||
            portfolio.error?.message ||
            'Unable to load investments'
          }
          retry={() => {
            void assets.refetch()
            void portfolio.refetch()
          }}
        />
      ) : assets.isPending || portfolio.isPending ? (
        <LoadingState text="Reconstructing investment positions…" />
      ) : (
        <>
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
          {security && selected ? (
            <>
              <SecurityMarketData key={security} id={security} asOf={asOf} />
              <SectionHeader
                title="Position across accounts"
                detail="Missing market prices are never substituted with cost basis."
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
          ) : tab === 'Imports' ? (
            <BrokerageImports accounts={accounts} />
          ) : (
            <>
              {tab === 'Overview' && (
                <>
                  <PortfolioHistory accountId={accountId} asOf={asOf} />
                  {portfolio.data.totals.length === 0 && (
                    <EmptyState
                      title="No investment accounts yet"
                      detail="Create an Investment account under Accounts, then fund it using Add Transaction → Transfer."
                    />
                  )}
                  {portfolio.data.totals.map((total) => (
                    <section
                      className="investment-summary"
                      key={total.currency}
                    >
                      <div className="investment-primary">
                        <span className="metadata">
                          Total investment value · {total.currency}
                        </span>
                        <strong>
                          <Value
                            value={total.total_value}
                            currency={total.currency}
                          />
                        </strong>
                        <small>
                          {total.missing_prices
                            ? `${total.missing_prices} position(s) have no eligible price. Known values are partial.`
                            : `Cash plus holdings at cached prices as of ${portfolio.data.as_of}.`}
                        </small>
                      </div>
                      <div className="investment-metrics">
                        <div>
                          <span className="metadata">Unrealized P&amp;L</span>
                          <Value
                            value={total.unrealized ?? null}
                            currency={total.currency}
                          />
                        </div>
                        {[
                          ['Cash', total.cash],
                          ['Known holdings value', total.known_holdings_value],
                          ['Cost basis', total.cost_basis],
                          ['Realized P&L', total.realized],
                          ['Investment income', total.income],
                        ].map(([label, value]) => (
                          <div key={label}>
                            <span className="metadata">{label}</span>
                            <Money value={value} currency={total.currency} />
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </>
              )}
              {(tab === 'Overview' || tab === 'Holdings') && (
                <>
                  <SectionHeader
                    title="Holdings"
                    detail="Open a security for account-level positions and related activities."
                  />
                  <HoldingsTable
                    rows={portfolio.data.holdings}
                    onOpen={onOpen}
                  />
                  {assets.data.length > 0 && (
                    <details>
                      <summary>
                        Security directory · {assets.data.length}
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
              {(tab === 'Accounts' || tab === 'Overview') && (
                <>
                  <SectionHeader
                    title="Investment accounts"
                    detail="Cash is included once in total value. Incomplete prices leave totals unavailable."
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
                              {!a.active && <small>Inactive</small>}
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
                  <SectionHeader title="Recent cash transfers and ordinary transactions" />
                  {recent.isPending ? (
                    <LoadingState />
                  ) : recent.isError ? (
                    <ErrorState text={recent.error.message} />
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
