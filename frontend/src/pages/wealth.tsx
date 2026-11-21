import { formatWealthLabel } from '@/lib/wealth-labels'
import { useReportingCurrency } from '@/features/settings/reporting-currency'
import {
  backToDashboard,
  dashboardDetailContext,
} from '@/features/dashboard/period'
// SPDX-License-Identifier: AGPL-3.0-only
// Net Worth composition adapted from Wealthfolio 92b4647; local posting/detail workflows retained.
import {
  ArrowLeft,
  EllipsisVertical,
  Plus,
  CreditCard,
  List,
} from 'lucide-react'
import { ActionPalette } from '@/features/holdings/action-palette'
import { getManualHoldings } from '@/features/holdings/api'
import { ManualAssetProfile } from '@/features/holdings/manual-asset-profile'
import { PortalScope } from '@/vendor/wealthfolio/ui/components/ui/portal-scope'
import '@/features/holdings/i18n'
import '@/features/holdings/migration.css'
import { t as tr, ui } from '@/lib/i18n'
import { exactFormData } from '@/lib/localized-number'
import { DetailDrawer } from '@/components/detail-drawer'
import { useSection, useRoute, navigateTo } from '@/lib/navigation'
import './wealth.css'
import { NetWorthOverview } from '@/components/net-worth-overview'
import { FinancialPrivacy } from '@/components/financial-privacy'
import { useFinancialPrivacy } from '@/lib/financial-privacy'
import { netWorthStart } from '@/lib/net-worth-period'
import { PeriodControls } from '@/features/dashboard/period-controls'
import { netWorthViewSchema } from '@/lib/net-worth-view'
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
import {
  getDemo,
  getDemoDate,
  localDate,
  request,
  type Account,
} from '@/lib/api'
import {
  getPositions,
  observationSchema,
  type Position,
} from '@/lib/wealth-api'
import { useWrite } from '@/lib/use-write'
import type { Navigate } from '@/components/app-shell'
import { formatRatioPercent as percent } from '@/lib/money'

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
      exactFormData(event.currentTarget),
    )
    write.mutate(
      { path, method, data: transform ? transform(data) : data },
      { onSuccess: onDone },
    )
  }
  return (
    <form onSubmit={submit} className="editor-surface">
      <SectionHeader title={title} />
      <fieldset disabled={write.isPending} className="form-grid">
        {children}
      </fieldset>
      {write.isError && <ErrorState text={write.error.message} />}
      {write.isSuccess && (
        <p role="status" className="metadata">
          {tr('wealth:saved__9d4af6')}
        </p>
      )}
      <div className="form-actions">
        <Button disabled={write.isPending} type="submit">
          {write.isPending
            ? tr('dynamic:saving__56a228')
            : tr('dynamic:save_efc007')}
        </Button>
        {onDone && (
          <Button
            disabled={write.isPending}
            type="button"
            variant="outline"
            onClick={onDone}
          >
            {tr('wealth:cancel_77dfd2')}
          </Button>
        )}
      </div>
    </form>
  )
}

export function NullableMoney({
  value,
  currency,
  minorUnits = false,
}: {
  minorUnits?: boolean
  value: string | null
  currency: string
}) {
  return value === null ? (
    <span className="metadata">{tr('wealth:unavailable_2c9c1f')}</span>
  ) : (
    <Money value={value} currency={currency} minorUnits={minorUnits} />
  )
}

export function WealthChart({
  points,
  currency,
  label,
  hero = false,
  mode = 'ledger',
}: {
  hero?: boolean
  mode?: import('@/lib/chart-presentation').FinancialChartMode
  points: { date: string; value: string | null }[]
  currency: string
  label: string
}) {
  return (
    <Suspense
      fallback={<LoadingState text={tr('wealth:loading_chart__ec093e')} />}
    >
      <PortfolioValueChart
        mode={mode}
        hero={hero}
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
  if (demo.isPending)
    return <LoadingState text={tr('wealth:loading_net_worth__c2b66d')} />
  if (demo.isError)
    return (
      <ErrorState text={demo.error.message} retry={() => void demo.refetch()} />
    )
  return (
    <NetWorthWorkspace
      navigate={navigate}
      initialEnd={demo.data.enabled ? demo.data.end_date : localDate()}
    />
  )
}

export function NetWorthWorkspace(props: {
  navigate: Navigate
  initialEnd: string
}) {
  return (
    <FinancialPrivacy>
      <NetWorthContent {...props} />
    </FinancialPrivacy>
  )
}

function NetWorthContent({
  initialEnd,
}: {
  navigate: Navigate
  initialEnd: string
}) {
  const { hidden } = useFinancialPrivacy()
  const route = useRoute()
  const context = (values: Record<string, string>) => {
    const next = new URLSearchParams(route.params)
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    navigateTo('Net Worth', undefined, Object.fromEntries(next))
  }
  const end = route.params.get('end') || initialEnd
  const period = route.params.get('range') || '1Y'
  const setPeriod = (range: string) =>
    context({ range, start: netWorthStart(range, end, custom) })
  const custom = route.params.get('start') || localDate()
  const reportingCurrency = useReportingCurrency()
  const currency = route.params.get('currency') || reportingCurrency
  const [tab, setTab] = useSection(
    ['Overview', 'Assets', 'Liabilities'],
    'Overview',
  )
  const [chartSeries, setChartSeries] = useState<
    'value' | 'assets' | 'liabilities'
  >('value')
  const selected = route.params.get('position')
  const setSelected = (position: string | null) => {
    if (!position && backToDashboard(route.params)) return
    context({
      ...(position
        ? dashboardDetailContext('net-worth', { start, end, range: period })
        : {}),
      position: position ?? '',
    })
  }
  const [creating, setCreating] = useState(false)
  const [palette, setPalette] = useState(false)
  const [recordedSince, setRecordedSince] = useState<string | null>(null)
  const positions = useQuery({
    queryKey: ['manual-positions'],
    queryFn: getPositions,
  })
  const manual = useQuery({
    queryKey: ['manual-holdings', end],
    queryFn: ({ signal }) => getManualHoldings(end, signal),
    enabled: !!selected,
  })
  const boundedStart =
    route.params.get('start') || netWorthStart(period, end, custom)
  const start =
    period === 'ALL' &&
    recordedSince &&
    recordedSince <= end &&
    recordedSince > boundedStart
      ? recordedSince
      : boundedStart
  const history = useQuery({
    queryKey: ['wealth', start, end, currency],
    queryFn: async ({ signal }) =>
      netWorthViewSchema.parse(
        await request(
          `/net-worth/history?${new URLSearchParams({ start, end, currency, details: 'true' })}`,
          { signal },
        ),
      ),
    enabled: !!start && !!end && /^[A-Z]{3}$/.test(currency),
  })
  const record = positions.data?.find((p) => p.id === selected)
  const earliest = history.data?.insights?.tracked_since
  if (earliest !== undefined && earliest !== recordedSince)
    setRecordedSince(earliest)
  if (selected)
    return (
      <div className="manual-position-page">
        {!manual.data?.rows.some((row) => row.id === selected) && (
          <Button
            className="entity-back"
            variant="ghost"
            aria-label={tr('wealth:net_worth_329352')}
            onClick={() => setSelected(null)}
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </Button>
        )}
        {positions.isPending || manual.isPending ? (
          <LoadingState />
        ) : positions.isError || manual.isError ? (
          <ErrorState
            text={positions.error?.message || manual.error?.message || ''}
            retry={() => {
              void positions.refetch()
              void manual.refetch()
            }}
          />
        ) : record && manual.data?.rows.find((r) => r.id === selected) ? (
          <PortalScope name="net-worth-detail">
            <div className="wf-workspace">
              <ManualAssetProfile
                key={record.id}
                holding={manual.data.rows.find((r) => r.id === selected)!}
                holdings={manual.data.rows}
                asOf={end}
                onBack={() => setSelected(null)}
              />
            </div>
          </PortalScope>
        ) : (
          <EmptyState title={tr('common:unavailable')} />
        )}
      </div>
    )
  return (
    <div className="net-worth-workspace net-worth-v014">
      {tab !== 'Overview' && (
        <PageHeader
          title={tr('wealth:net_worth_329352')}
          description={tr(
            'wealth:assets_less_liabilities_goals_are_allocations_ne_c61c78',
          )}
        />
      )}
      {tab !== 'Overview' && (
        <details className="net-worth-manage">
          <summary aria-label={tr('networth:actions')}>
            <EllipsisVertical size={18} />
          </summary>
          <div
            className="page-actions"
            role="tablist"
            aria-label={tr('wealth:net_worth_sections_fa1b57')}
          >
            {(['Overview', 'Assets', 'Liabilities'] as const).map((t) => (
              <Button
                role="tab"
                aria-selected={tab === t}
                variant={tab === t ? 'outline' : 'ghost'}
                key={ui(t)}
                onClick={() => {
                  setTab(t)
                  setCreating(false)
                }}
              >
                {ui(t)}
              </Button>
            ))}
          </div>
        </details>
      )}
      {tab === 'Overview' ? (
        <>
          <div className="net-worth-quick-actions">
            <ActionPalette
              open={palette}
              onOpenChange={setPalette}
              groups={[
                {
                  items: [
                    {
                      icon: Plus,
                      label: tr('dashboard_v014:add_asset'),
                      onClick: () => {
                        setTab('Assets')
                        setCreating(true)
                      },
                    },
                    {
                      icon: CreditCard,
                      label: tr('dashboard_v014:add_liability'),
                      onClick: () => {
                        setTab('Liabilities')
                        setCreating(true)
                      },
                    },
                    {
                      icon: List,
                      label: tr('dashboard_v014:manage_assets'),
                      onClick: () => setTab('Assets'),
                    },
                  ],
                },
              ]}
            />
          </div>

          {history.isPending ? (
            <LoadingState
              text={tr('wealth:reconstructing_net_worth__724d41')}
            />
          ) : history.isError ? (
            <>
              <ErrorState
                text={history.error.message}
                retry={() => void history.refetch()}
              />
              <PeriodControls
                range={period}
                start={start}
                end={end}
                asOf={initialEnd}
                onChange={(period) => context(period)}
              />
            </>
          ) : (
            <NetWorthOverview
              report={history.data}
              positions={positions.data ?? []}
              period={period}
              setPeriod={setPeriod}
              asOf={initialEnd}
              onDateRange={(period) => context(period)}
              chartSeries={chartSeries}
              onPosition={setSelected}
              onComponent={(c) =>
                c.source === 'ACCOUNT'
                  ? navigateTo(
                      'Account',
                      c.id,
                      dashboardDetailContext('net-worth', {
                        start,
                        end,
                        range: period,
                      }),
                    )
                  : setSelected(c.id)
              }
              seriesControl={
                <Field label={tr('wealth:chart_series_95c009')}>
                  <select
                    value={chartSeries}
                    onChange={(e) =>
                      setChartSeries(e.target.value as typeof chartSeries)
                    }
                  >
                    <option value="value">
                      {tr('wealth:net_worth_0ec2a7')}
                    </option>
                    <option value="assets">{tr('wealth:assets_20e338')}</option>
                  </select>
                </Field>
              }
              methods={
                <div className="wealth-metrics">
                  <div>
                    {tr('wealth:assets_20e338')}
                    <NullableMoney
                      value={history.data.assets}
                      currency={currency}
                    />
                  </div>
                  <div>
                    {tr('wealth:liabilities_556a42')}
                    <NullableMoney
                      value={history.data.liabilities}
                      currency={currency}
                    />
                  </div>
                  <div>
                    {tr('networth:debt_to_assets')}
                    <span>
                      {hidden
                        ? '\u2022\u2022\u2022\u2022'
                        : percent(history.data.debt_to_assets, 2)}
                    </span>
                  </div>
                </div>
              }
            />
          )}
        </>
      ) : (
        <>
          <SectionHeader
            title={ui(tab)}
            detail={tr(
              'wealth:manual_records_only_account_and_security_balance_cda706',
            )}
          >
            <Button
              onClick={() => {
                setCreating(!creating)
                setSelected(null)
              }}
            >
              {' '}
              {tr('wealth:add_61cc55')}{' '}
              {tab === 'Assets'
                ? tr('dynamic:asset_05fac9')
                : tr('dynamic:liability_cf7a5b')}
            </Button>
          </SectionHeader>
          {positions.isPending ? (
            <LoadingState />
          ) : positions.isError ? (
            <ErrorState
              text={positions.error.message}
              retry={() => void positions.refetch()}
            />
          ) : (
            <>
              {creating && (
                <DetailDrawer
                  title={ui(tab)}
                  onClose={() => setCreating(false)}
                >
                  <PositionEditor
                    kind={tab === 'Assets' ? 'ASSET' : 'LIABILITY'}
                    positions={positions.data}
                    onDone={() => setCreating(false)}
                  />
                </DetailDrawer>
              )}
              <div className="table-scroll">
                <table className="finance-wealth-table">
                  <thead>
                    <tr>
                      <th scope="col">{tr('wealth:name_709a23')}</th>
                      <th scope="col">{tr('wealth:category_a3c686')}</th>
                      <th scope="col">{tr('wealth:currency_e070de')}</th>
                      <th scope="col">{tr('wealth:status_bae7d5')}</th>
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
                            {p.end_date
                              ? tr('messages:message_b88be0e0e46b', {
                                  value0: p.end_date,
                                })
                              : tr('dynamic:active_a733b8')}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

export function PositionEditor({
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
          ? tr('dynamic:edit_details_4173a9')
          : tr('messages:message_023adc72a366', {
              value0: kind === 'ASSET' ? 'asset' : 'liability',
            })
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
      <Field label={tr('wealth:name_709a23')}>
        <input
          name="name"
          required
          maxLength={120}
          defaultValue={position?.name}
        />
      </Field>
      <Field label={tr('wealth:category_a3c686')}>
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
          <option key={x} value={x}>
            {formatWealthLabel(x)}
          </option>
        ))}
      </datalist>
      <Field label={tr('wealth:currency_e070de')}>
        <input
          name="currency"
          required
          pattern="[A-Z]{3}"
          readOnly={!!position}
          defaultValue={position?.currency ?? 'BRL'}
        />
      </Field>
      <Field label={tr('wealth:ownership_start_581737')}>
        <input
          name="start_date"
          type="date"
          required
          readOnly={!!position}
          max={localDate()}
          defaultValue={position?.start_date ?? localDate()}
        />
      </Field>
      <Field label={tr('wealth:liquidity_76a3e6')}>
        <select
          name="liquidity"
          defaultValue={position?.liquidity ?? 'ILLIQUID'}
        >
          {['LIQUID', 'MARKETABLE', 'ILLIQUID', 'UNKNOWN'].map((x) => (
            <option key={x} value={x}>
              {formatWealthLabel(x)}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label={
          kind === 'ASSET'
            ? tr('dynamic:acquisition_cost_optional__9d0f5b')
            : tr('dynamic:original_amount_optional__b2bfcd')
        }
      >
        <input
          name="acquisition_cost"
          inputMode="decimal"
          defaultValue={position?.acquisition_cost ?? ''}
        />
      </Field>
      {kind === 'LIABILITY' && (
        <Field label={tr('wealth:associated_asset_82c0d7')}>
          <select
            name="associated_asset_id"
            defaultValue={position?.associated_asset_id ?? ''}
          >
            <option value="">{tr('wealth:none_6eef66')}</option>
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
      <Field label={tr('wealth:notes_704400')}>
        <textarea name="notes" defaultValue={position?.notes} />
      </Field>
      <Field label={tr('wealth:terms_payment_details_optional__890332')}>
        <textarea name="terms" defaultValue={position?.terms} />
      </Field>
      {kind === 'LIABILITY' && (
        <>
          <Field label={tr('wealth:annual_interest_rate_optional__fe7e4b')}>
            <input
              name="interest_rate"
              inputMode="decimal"
              defaultValue={position?.interest_rate ?? ''}
            />
          </Field>
          <Field label={tr('wealth:minimum_payment_optional__7bd477')}>
            <input
              name="minimum_payment"
              inputMode="decimal"
              defaultValue={position?.minimum_payment ?? ''}
            />
          </Field>
          <Field label={tr('wealth:payment_frequency_c38d25')}>
            <select
              name="payment_frequency"
              defaultValue={position?.payment_frequency ?? ''}
            >
              <option value="">{tr('wealth:not_specified_60f1e9')}</option>
              {['WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL', 'OTHER'].map(
                (f) => (
                  <option key={f}>{f}</option>
                ),
              )}
            </select>
          </Field>
          <Field label={tr('wealth:expected_payoff_date_optional__013ca7')}>
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

export function PositionDetail({
  position: p,
  positions,
}: {
  position: Position
  positions: Position[]
}) {
  const route = useRoute()
  const asOf = route.params.get('end') || getDemoDate() || localDate()
  const [edit, setEdit] = useState(false)
  const [addingValue, setAddingValue] = useState(false)
  const [detailTab, setDetailTab] = useSection(
    ['Overview', 'Values'],
    'Overview',
    'position_view',
  )
  const observations = useQuery({
    queryKey: ['observations', p.id],
    queryFn: async () =>
      z
        .array(observationSchema)
        .parse(await request(`/manual-positions/${p.id}/observations`)),
  })
  // The API orders observations by effective date, creation time and identity.
  const eligible =
    observations.data?.filter(
      (o) => !o.voided_at && o.effective_date <= asOf,
    ) ?? []
  const last = eligible.at(-1)
  return (
    <section>
      <SectionHeader title={p.name} detail={formatWealthLabel(p.category)}>
        <div className="entity-actions">
          <nav className="range-tabs" aria-label={tr('parity:position_views')}>
            {(['Overview', 'Values'] as const).map((v) => (
              <button
                key={v}
                aria-pressed={detailTab === v}
                onClick={() => setDetailTab(v)}
              >
                {ui(v)}
              </button>
            ))}
          </nav>
          {!p.end_date && (
            <Button variant="outline" onClick={() => setAddingValue(true)}>
              {p.kind === 'ASSET'
                ? tr('dynamic:add_valuation_2cd0a4')
                : tr('dynamic:update_outstanding_balance_95f145')}
            </Button>
          )}
          <Button variant="ghost" onClick={() => setEdit(!edit)}>
            {tr('wealth:edit_details_4173a9')}
          </Button>
        </div>
      </SectionHeader>
      {edit && (
        <DetailDrawer
          title={tr('wealth:edit_details_4173a9')}
          onClose={() => setEdit(false)}
        >
          <PositionEditor
            kind={p.kind}
            position={p}
            positions={positions}
            onDone={() => setEdit(false)}
          />
        </DetailDrawer>
      )}
      {addingValue && (
        <DetailDrawer
          title={tr('dynamic:add_valuation_2cd0a4')}
          onClose={() => setAddingValue(false)}
        >
          <WealthForm
            title={
              p.kind === 'ASSET'
                ? tr('dynamic:add_valuation_2cd0a4')
                : tr('dynamic:update_outstanding_balance_95f145')
            }
            onDone={() => setAddingValue(false)}
            path={`/manual-positions/${p.id}/observations`}
          >
            <Field label={tr('wealth:effective_date_153c9b')}>
              <input
                name="effective_date"
                type="date"
                min={p.start_date}
                max={localDate()}
                required
                defaultValue={localDate()}
              />
            </Field>
            <Field
              label={tr('messages:message_a0f5fc76ee1e', {
                value0: p.currency,
              })}
            >
              <input name="amount" inputMode="decimal" required />
            </Field>
            <Field label={tr('wealth:observation_notes_397886')}>
              <input name="notes" />
            </Field>
          </WealthForm>
        </DetailDrawer>
      )}
      {observations.isPending ? (
        <LoadingState />
      ) : observations.isError ? (
        <ErrorState
          text={observations.error.message}
          retry={() => void observations.refetch()}
        />
      ) : (
        <>
          {detailTab === 'Overview' && (
            <div className="manual-position-overview">
              <div className="manual-position-history">
                <span className="metadata">
                  {tr('parity:last_recorded_value')}
                </span>
                <strong className="manual-position-value">
                  <NullableMoney
                    value={last?.amount ?? null}
                    currency={p.currency}
                    minorUnits
                  />
                </strong>
                <p className="metadata">
                  {last?.effective_date ?? tr('common:unavailable')} -{' '}
                  {p.currency}
                </p>
                {eligible.length > 0 ? (
                  <WealthChart
                    mode="manual-observations"
                    label={tr('wealth:value_8dce17')}
                    currency={p.currency}
                    points={eligible.map((o) => ({
                      date: o.effective_date,
                      value: o.amount,
                    }))}
                  />
                ) : (
                  <EmptyState
                    title={tr('parity:observation_history_unavailable')}
                  />
                )}
              </div>
              <aside>
                <SectionHeader title={tr('wealth:edit_details_4173a9')} />
                {p.kind === 'LIABILITY' && (
                  <p className="metadata">
                    {tr(
                      'wealth:update_outstanding_principal_manually_this_does__88c7af',
                    )}
                  </p>
                )}
                {p.terms && <p className="metadata">{p.terms}</p>}
                <dl className="position-metadata">
                  <div>
                    <dt>{tr('wealth:category_a3c686')}</dt>
                    <dd>{formatWealthLabel(p.category)}</dd>
                  </div>
                  <div>
                    <dt>{tr('wealth:currency_e070de')}</dt>
                    <dd>{p.currency}</dd>
                  </div>
                  <div>
                    <dt>{tr('wealth:liquidity_76a3e6')}</dt>
                    <dd>{formatWealthLabel(p.liquidity)}</dd>
                  </div>
                  <div>
                    <dt>{tr('wealth:ownership_start_581737')}</dt>
                    <dd>{p.start_date}</dd>
                  </div>
                  <div>
                    <dt>{tr('wealth:notes_704400')}</dt>
                    <dd>{p.notes || '—'}</dd>
                  </div>
                </dl>
                {positions
                  .filter((row) => row.associated_asset_id === p.id)
                  .map((row) => (
                    <p key={row.id} className="metadata">
                      {ui(row.kind)}: {row.name}
                    </p>
                  ))}
              </aside>
            </div>
          )}
          {detailTab === 'Values' && (
            <>
              <div className="table-scroll">
                <table className="finance-wealth-table">
                  <thead>
                    <tr>
                      <th scope="col">{tr('wealth:date_eb9a4b')}</th>
                      <th scope="col" className="amount-cell">
                        {tr('wealth:value_8dce17')}
                      </th>
                      <th scope="col">{tr('wealth:audit_fa1703')}</th>
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
                              <summary>
                                {tr('wealth:correct_remove_907d8a')}
                              </summary>
                              <p className="metadata">
                                {tr(
                                  'wealth:corrections_preserve_the_original_and_replace_it_2d40c5',
                                )}
                              </p>
                              <WealthForm
                                title={tr('wealth:correct_observation_7cc30c')}
                                path={`/manual-observations/${o.id}/correct`}
                              >
                                <Field
                                  label={tr('wealth:corrected_date_5d9a0e')}
                                >
                                  <input
                                    name="effective_date"
                                    type="date"
                                    required
                                    defaultValue={o.effective_date}
                                  />
                                </Field>
                                <Field
                                  label={tr('wealth:corrected_value_7a2b3c')}
                                >
                                  <input
                                    name="amount"
                                    inputMode="decimal"
                                    required
                                    defaultValue={o.amount}
                                  />
                                </Field>
                                <Field
                                  label={tr('wealth:correction_reason_a09190')}
                                >
                                  <input name="reason" required />
                                </Field>
                              </WealthForm>
                              <WealthForm
                                title={tr('wealth:remove_observation_a76286')}
                                path={`/manual-observations/${o.id}/void`}
                              >
                                <Field
                                  label={tr('wealth:removal_reason_5cbc37')}
                                >
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
            </>
          )}
        </>
      )}
      {!p.end_date && (
        <details>
          <summary>
            {p.kind === 'ASSET'
              ? tr('dynamic:mark_disposed_8dec27')
              : tr('dynamic:mark_paid_off_c64ab9')}
          </summary>
          <p className="metadata">
            {tr(
              'wealth:removes_this_item_from_net_worth_from_the_chosen_6c37dc',
            )}
          </p>
          <WealthForm
            title={tr('wealth:close_record_36e53a')}
            path={`/manual-positions/${p.id}/close`}
            transform={(d) => ({
              ...d,
              disposal_proceeds: d.disposal_proceeds || null,
            })}
          >
            <Field label={tr('wealth:end_date_89d10c')}>
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
              <Field label={tr('wealth:disposal_proceeds_optional__b930b1')}>
                <input name="disposal_proceeds" inputMode="decimal" />
              </Field>
            )}
          </WealthForm>
        </details>
      )}
    </section>
  )
}
