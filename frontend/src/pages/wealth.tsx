import './wealth.css'
import { lazy, Suspense, useState, type ReactNode, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
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
const PortfolioValueChart = lazy(() =>
  import('@/components/portfolio-value-chart').then((m) => ({
    default: m.PortfolioValueChart,
  })),
)
import { getDemo, localDate, request, type Account } from '@/lib/api'
import {
  getPositions,
  observationSchema,
  wealthSchema,
  type Position,
} from '@/lib/wealth-api'
import { useWrite } from '@/lib/use-write'
import type { Navigate } from '@/components/app-shell'
import { decimalUnits, unitsToMoney } from '@/lib/money'

function percent(value: string | null) {
  return value === null
    ? 'Unavailable'
    : `${unitsToMoney(decimalUnits(value) * 100n).replace(/\.?0+$/, '')}%`
}

export function WealthForm({
  title,
  path,
  method = 'POST',
  children,
  transform,
  onDone,
}: {
  title: string
  path: string
  method?: string
  children: ReactNode
  transform?: (data: Record<string, unknown>) => unknown
  onDone?: () => void
}) {
  const write = useWrite()
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data: Record<string, unknown> = Object.fromEntries(
      new FormData(event.currentTarget),
    )
    write.mutate(
      { path, method, data: transform ? transform(data) : data },
      { onSuccess: onDone },
    )
  }
  return (
    <form onSubmit={submit} className="editor-surface">
      <SectionHeader title={title} />
      <div className="form-grid">{children}</div>
      {write.isError && <ErrorState text={write.error.message} />}
      {write.isSuccess && (
        <p role="status" className="metadata">
          Saved.
        </p>
      )}
      <Button disabled={write.isPending} type="submit">
        {write.isPending ? 'Saving…' : 'Save'}
      </Button>
    </form>
  )
}

export function NullableMoney({
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

export function WealthChart({
  points,
  currency,
  label,
}: {
  points: { date: string; value: string | null }[]
  currency: string
  label: string
}) {
  return (
    <Suspense fallback={<LoadingState text="Loading chart?" />}>
      <PortfolioValueChart
        label={label}
        history={{
          currency,
          fx_provider: '',
          warning: '',
          points: points.map((p) => ({
            ...p,
            known_value: p.value ?? '0',
            missing_assets: p.value === null ? ['incomplete'] : [],
            missing_fx: [],
          })),
        }}
      />
    </Suspense>
  )
}

export default function NetWorth({
  navigate,
}: {
  accounts: Account[]
  navigate: Navigate
}) {
  const demo = useQuery({
    queryKey: ['demo'],
    queryFn: ({ signal }) => getDemo(signal),
  })
  if (demo.isPending) return <LoadingState text="Loading net worth…" />
  if (demo.isError) return <ErrorState text={demo.error.message} />
  return (
    <NetWorthWorkspace
      navigate={navigate}
      initialEnd={demo.data.enabled ? demo.data.end_date : localDate()}
    />
  )
}

export function NetWorthWorkspace({
  navigate,
  initialEnd,
}: {
  navigate: Navigate
  initialEnd: string
}) {
  const [end, setEnd] = useState(initialEnd)
  const [period, setPeriod] = useState('1Y')
  const [custom, setCustom] = useState(localDate())
  const [currency, setCurrency] = useState('BRL')
  const [tab, setTab] = useState('Overview')
  const [chartSeries, setChartSeries] = useState<
    'value' | 'assets' | 'liabilities'
  >('value')
  const [selected, setSelected] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const positions = useQuery({
    queryKey: ['manual-positions'],
    queryFn: getPositions,
  })
  const date = new Date(`${end}T12:00:00`)
  const months =
    (
      { '1M': 1, '3M': 3, '6M': 6, '1Y': 12, '3Y': 36, ALL: 120 } as Record<
        string,
        number
      >
    )[period] ?? 0
  const beginning =
    period === 'YTD'
      ? new Date(date.getFullYear(), 0, 1)
      : new Date(date.getFullYear(), date.getMonth() - months + 1, 1)
  const start =
    period === 'Custom'
      ? custom
      : `${beginning.getFullYear()}-${String(beginning.getMonth() + 1).padStart(2, '0')}-01`
  const history = useQuery({
    queryKey: ['wealth', start, end, currency],
    queryFn: async ({ signal }) =>
      wealthSchema.parse(
        await request(
          `/net-worth/history?${new URLSearchParams({ start, end, currency })}`,
          { signal },
        ),
      ),
    enabled: !!start && !!end && /^[A-Z]{3}$/.test(currency),
  })
  const record = positions.data?.find((p) => p.id === selected)
  return (
    <>
      <PageHeader
        title="Net Worth"
        description="Assets less liabilities. Goals are allocations, never additional assets."
      />
      <div
        className="page-actions"
        role="tablist"
        aria-label="Net worth sections"
      >
        {['Overview', 'Assets', 'Liabilities'].map((t) => (
          <Button
            role="tab"
            aria-selected={tab === t}
            variant={tab === t ? 'outline' : 'ghost'}
            key={t}
            onClick={() => {
              setTab(t)
              setSelected(null)
              setCreating(false)
            }}
          >
            {t}
          </Button>
        ))}
      </div>
      {tab === 'Overview' ? (
        <>
          <div className="filter-bar">
            <Field label="Reporting currency">
              <input
                value={currency}
                maxLength={3}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              />
            </Field>
            <Field label="As of">
              <input
                type="date"
                max={localDate()}
                required
                value={end}
                onChange={(e) => e.target.value && setEnd(e.target.value)}
              />
            </Field>
            <Field label="Period">
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              >
                {['1M', '3M', '6M', 'YTD', '1Y', '3Y', 'ALL', 'Custom'].map(
                  (p) => (
                    <option key={p}>{p}</option>
                  ),
                )}
              </select>
            </Field>
            {period === 'Custom' && (
              <Field label="Start date">
                <input
                  type="date"
                  max={end}
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                />
              </Field>
            )}
          </div>
          {history.isPending ? (
            <LoadingState text="Reconstructing net worth…" />
          ) : history.isError ? (
            <ErrorState text={history.error.message} />
          ) : (
            <>
              <div className="overview-balance">
                <p className="metadata">Net worth · {end}</p>
                <h2 className="text-4xl tracking-tight tabular-nums">
                  <NullableMoney
                    value={history.data.value}
                    currency={currency}
                  />
                </h2>
              </div>
              {!history.data.complete && (
                <ErrorState text="Incomplete valuation. Missing values are not zero; inspect the breakdown below." />
              )}
              <div className="wealth-metrics">
                <div>
                  Assets{' '}
                  <NullableMoney
                    value={history.data.assets}
                    currency={currency}
                  />
                </div>
                <div>
                  Liabilities{' '}
                  <NullableMoney
                    value={history.data.liabilities}
                    currency={currency}
                  />
                </div>
                <div>
                  Period change{' '}
                  <NullableMoney
                    value={history.data.change}
                    currency={currency}
                  />
                  {history.data.change_ratio !== null && (
                    <span>{percent(history.data.change_ratio)}</span>
                  )}
                </div>
                <div>Debt / assets {percent(history.data.debt_to_assets)}</div>
                <div>Liquid share {percent(history.data.liquid_share)}</div>
              </div>
              <Field label="Chart series">
                <select
                  value={chartSeries}
                  onChange={(e) =>
                    setChartSeries(
                      e.target.value as 'value' | 'assets' | 'liabilities',
                    )
                  }
                >
                  <option value="value">Net worth</option>
                  <option value="assets">Assets</option>
                  <option value="liabilities">Liabilities</option>
                </select>
              </Field>
              <WealthChart
                points={history.data.points.map((p) => ({
                  date: p.date,
                  value: p[chartSeries],
                }))}
                currency={currency}
                label={
                  chartSeries === 'value'
                    ? 'Net worth'
                    : chartSeries === 'assets'
                      ? 'Assets'
                      : 'Liabilities'
                }
              />
              <div className="wealth-metrics">
                <div>
                  Asset change{' '}
                  <NullableMoney
                    value={history.data.assets_change}
                    currency={currency}
                  />
                </div>
                <div>
                  Liability change{' '}
                  <NullableMoney
                    value={history.data.liabilities_change}
                    currency={currency}
                  />
                </div>
              </div>
              <p className="metadata">
                {history.data.method} Period change is not investment
                performance. ALL shows up to ten years.
              </p>
              <SectionHeader
                title="Asset and liability breakdown"
                detail="Native amounts remain visible; negative balances are liabilities."
              />
              <div className="table-scroll">
                <table className="finance-wealth-table">
                  <thead>
                    <tr>
                      <th scope="col">Category</th>
                      <th scope="col">Side</th>
                      <th scope="col" className="amount-cell">
                        {currency}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.data.categories.map((c) => (
                      <tr key={`${c.kind}-${c.category}`}>
                        <td>{c.category}</td>
                        <td>{c.kind}</td>
                        <td className="amount-cell">
                          <NullableMoney value={c.value} currency={currency} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="table-scroll">
                <table className="finance-wealth-table">
                  <thead>
                    <tr>
                      <th scope="col">Component</th>
                      <th scope="col">Classification</th>
                      <th scope="col">Liquidity</th>
                      <th scope="col" className="amount-cell">
                        Native value
                      </th>
                      <th scope="col" className="amount-cell">
                        {currency}
                      </th>
                      <th scope="col">Coverage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.data.components.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <button
                            className="text-left"
                            onClick={() =>
                              c.source === 'ACCOUNT'
                                ? navigate('Account', c.id)
                                : (setTab(
                                    c.source === 'ASSET'
                                      ? 'Assets'
                                      : 'Liabilities',
                                  ),
                                  setSelected(c.id))
                            }
                          >
                            {c.name}
                          </button>
                        </td>
                        <td>{c.category}</td>
                        <td>{c.liquidity}</td>
                        <td className="amount-cell">
                          <NullableMoney
                            value={c.native_value}
                            currency={c.currency}
                          />
                        </td>
                        <td className="amount-cell">
                          <NullableMoney value={c.value} currency={currency} />
                        </td>
                        <td>
                          {c.missing.join('; ') ||
                            c.observation_date ||
                            'Available'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!history.data.components.length && (
                <EmptyState
                  title="No financial records yet"
                  detail="Add an account or a dated manual asset to begin."
                />
              )}
            </>
          )}
        </>
      ) : (
        <>
          <SectionHeader
            title={tab}
            detail="Manual records only. Account and security balances already appear in Overview."
          >
            <Button
              onClick={() => {
                setCreating(!creating)
                setSelected(null)
              }}
            >
              Add {tab === 'Assets' ? 'asset' : 'liability'}
            </Button>
          </SectionHeader>
          {positions.isPending ? (
            <LoadingState />
          ) : positions.isError ? (
            <ErrorState text={positions.error.message} />
          ) : (
            <>
              {creating && (
                <PositionEditor
                  kind={tab === 'Assets' ? 'ASSET' : 'LIABILITY'}
                  positions={positions.data}
                  onDone={() => setCreating(false)}
                />
              )}
              <div className="table-scroll">
                <table className="finance-wealth-table">
                  <thead>
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">Category</th>
                      <th scope="col">Currency</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.data
                      .filter(
                        (p) =>
                          p.kind === (tab === 'Assets' ? 'ASSET' : 'LIABILITY'),
                      )
                      .map((p) => (
                        <tr key={p.id}>
                          <td>
                            <button onClick={() => setSelected(p.id)}>
                              {p.name}
                            </button>
                          </td>
                          <td>{p.category}</td>
                          <td>{p.currency}</td>
                          <td>
                            {p.end_date ? `Closed ${p.end_date}` : 'Active'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {record && (
                <PositionDetail
                  key={record.id}
                  position={record}
                  positions={positions.data}
                />
              )}
            </>
          )}
        </>
      )}
    </>
  )
}

function PositionEditor({
  kind,
  position,
  positions,
  onDone,
}: {
  kind: 'ASSET' | 'LIABILITY'
  position?: Position
  positions: Position[]
  onDone?: () => void
}) {
  return (
    <WealthForm
      title={
        position
          ? 'Edit details'
          : `New ${kind === 'ASSET' ? 'asset' : 'liability'}`
      }
      path={`/manual-positions${position ? `/${position.id}` : ''}`}
      method={position ? 'PATCH' : 'POST'}
      onDone={onDone}
      transform={(d) => ({
        ...d,
        kind,
        associated_asset_id: d.associated_asset_id || null,
        acquisition_cost: d.acquisition_cost || null,
        interest_rate: d.interest_rate || null,
        minimum_payment: d.minimum_payment || null,
        payment_frequency: d.payment_frequency || null,
        expected_payoff_date: d.expected_payoff_date || null,
      })}
    >
      <Field label="Name">
        <input
          name="name"
          required
          maxLength={120}
          defaultValue={position?.name}
        />
      </Field>
      <Field label="Category">
        <input
          name="category"
          required
          defaultValue={
            position?.category ?? (kind === 'ASSET' ? 'VEHICLE' : 'LOAN')
          }
          list="wealth-categories"
        />
      </Field>
      <datalist id="wealth-categories">
        {[
          'REAL_ESTATE',
          'VEHICLE',
          'COLLECTIBLE',
          'PRECIOUS_METALS',
          'PRIVATE_BUSINESS',
          'OTHER',
          'MORTGAGE',
          'PERSONAL_LOAN',
          'STUDENT_LOAN',
        ].map((x) => (
          <option key={x}>{x}</option>
        ))}
      </datalist>
      <Field label="Currency">
        <input
          name="currency"
          required
          pattern="[A-Z]{3}"
          readOnly={!!position}
          defaultValue={position?.currency ?? 'BRL'}
        />
      </Field>
      <Field label="Ownership start">
        <input
          name="start_date"
          type="date"
          required
          readOnly={!!position}
          max={localDate()}
          defaultValue={position?.start_date ?? localDate()}
        />
      </Field>
      <Field label="Liquidity">
        <select
          name="liquidity"
          defaultValue={position?.liquidity ?? 'ILLIQUID'}
        >
          {['LIQUID', 'MARKETABLE', 'ILLIQUID', 'UNKNOWN'].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </Field>
      <Field
        label={
          kind === 'ASSET'
            ? 'Acquisition cost (optional)'
            : 'Original amount (optional)'
        }
      >
        <input
          name="acquisition_cost"
          inputMode="decimal"
          defaultValue={position?.acquisition_cost ?? ''}
        />
      </Field>
      {kind === 'LIABILITY' && (
        <Field label="Associated asset">
          <select
            name="associated_asset_id"
            defaultValue={position?.associated_asset_id ?? ''}
          >
            <option value="">None</option>
            {positions
              .filter((p) => p.kind === 'ASSET')
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </Field>
      )}
      <Field label="Notes">
        <textarea name="notes" defaultValue={position?.notes} />
      </Field>
      <Field label="Terms / payment details (optional)">
        <textarea name="terms" defaultValue={position?.terms} />
      </Field>
      {kind === 'LIABILITY' && (
        <>
          <Field label="Annual interest rate % (optional)">
            <input
              name="interest_rate"
              inputMode="decimal"
              defaultValue={position?.interest_rate ?? ''}
            />
          </Field>
          <Field label="Minimum payment (optional)">
            <input
              name="minimum_payment"
              inputMode="decimal"
              defaultValue={position?.minimum_payment ?? ''}
            />
          </Field>
          <Field label="Payment frequency">
            <select
              name="payment_frequency"
              defaultValue={position?.payment_frequency ?? ''}
            >
              <option value="">Not specified</option>
              {['WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL', 'OTHER'].map(
                (f) => (
                  <option key={f}>{f}</option>
                ),
              )}
            </select>
          </Field>
          <Field label="Expected payoff date (optional)">
            <input
              name="expected_payoff_date"
              type="date"
              defaultValue={position?.expected_payoff_date ?? ''}
            />
          </Field>
        </>
      )}
    </WealthForm>
  )
}

function PositionDetail({
  position: p,
  positions,
}: {
  position: Position
  positions: Position[]
}) {
  const [edit, setEdit] = useState(false)
  const observations = useQuery({
    queryKey: ['observations', p.id],
    queryFn: async () =>
      z
        .array(observationSchema)
        .parse(await request(`/manual-positions/${p.id}/observations`)),
  })
  return (
    <section>
      <SectionHeader title={p.name} detail={p.notes}>
        <Button variant="ghost" onClick={() => setEdit(!edit)}>
          Edit details
        </Button>
      </SectionHeader>
      {edit && (
        <PositionEditor
          kind={p.kind}
          position={p}
          positions={positions}
          onDone={() => setEdit(false)}
        />
      )}
      {p.kind === 'LIABILITY' && (
        <p className="metadata">
          Update outstanding principal manually. This does not post a bank
          payment or classify principal as spending. Interest and fees remain
          separate ledger expenses; no amortization is inferred.
        </p>
      )}
      <p className="metadata">{p.terms}</p>
      {!p.end_date && (
        <WealthForm
          title={
            p.kind === 'ASSET' ? 'Add valuation' : 'Update outstanding balance'
          }
          path={`/manual-positions/${p.id}/observations`}
        >
          <Field label="Effective date">
            <input
              name="effective_date"
              type="date"
              min={p.start_date}
              max={localDate()}
              required
              defaultValue={localDate()}
            />
          </Field>
          <Field label={`Amount (${p.currency})`}>
            <input name="amount" inputMode="decimal" required />
          </Field>
          <Field label="Observation notes">
            <input name="notes" />
          </Field>
        </WealthForm>
      )}
      {observations.isPending ? (
        <LoadingState />
      ) : observations.isError ? (
        <ErrorState text={observations.error.message} />
      ) : (
        <div className="table-scroll">
          <table className="finance-wealth-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col" className="amount-cell">
                  Value
                </th>
                <th scope="col">Audit</th>
              </tr>
            </thead>
            <tbody>
              {observations.data.map((o) => (
                <tr key={o.id}>
                  <td>{o.effective_date}</td>
                  <td className="amount-cell">
                    <Money value={o.amount} currency={p.currency} />
                  </td>
                  <td>
                    {o.voided_at ? (
                      `Voided: ${o.void_reason}`
                    ) : (
                      <details>
                        <summary>Correct / remove</summary>
                        <p className="metadata">
                          Corrections preserve the original and replace it
                          atomically.
                        </p>
                        <WealthForm
                          title="Correct observation"
                          path={`/manual-observations/${o.id}/correct`}
                        >
                          <Field label="Corrected date">
                            <input
                              name="effective_date"
                              type="date"
                              required
                              defaultValue={o.effective_date}
                            />
                          </Field>
                          <Field label="Corrected value">
                            <input
                              name="amount"
                              inputMode="decimal"
                              required
                              defaultValue={o.amount}
                            />
                          </Field>
                          <Field label="Correction reason">
                            <input name="reason" required />
                          </Field>
                        </WealthForm>
                        <WealthForm
                          title="Remove observation"
                          path={`/manual-observations/${o.id}/void`}
                        >
                          <Field label="Removal reason">
                            <input name="reason" required />
                          </Field>
                        </WealthForm>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!p.end_date && (
        <details>
          <summary>
            {p.kind === 'ASSET' ? 'Mark disposed' : 'Mark paid off'}
          </summary>
          <p className="metadata">
            Removes this item from net worth from the chosen date. No cash
            movement is created.
          </p>
          <WealthForm
            title="Close record"
            path={`/manual-positions/${p.id}/close`}
            transform={(d) => ({
              ...d,
              disposal_proceeds: d.disposal_proceeds || null,
            })}
          >
            <Field label="End date">
              <input
                name="end_date"
                type="date"
                required
                min={p.start_date}
                max={localDate()}
                defaultValue={localDate()}
              />
            </Field>
            {p.kind === 'ASSET' && (
              <Field label="Disposal proceeds (optional)">
                <input name="disposal_proceeds" inputMode="decimal" />
              </Field>
            )}
          </WealthForm>
        </details>
      )}
    </section>
  )
}
