import { useRoute, navigateTo } from '@/lib/navigation'
import { useState } from 'react'
import { DetailDrawer } from '@/components/detail-drawer'
import { FixedSubscription } from '@/components/fixed-subscription'
import { useQuery } from '@tanstack/react-query'
import { Field } from '@/components/forms'
import { Button } from '@/components/ui/button'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Money,
  SectionHeader,
} from '@/components/primitives'
import { CompositionChart } from '@/components/composition-chart'
import { FixedIncomeChart } from '@/components/fixed-income-chart'
import { t } from '@/lib/i18n'
import {
  decimalUnits,
  formatDate,
  formatExactPercent,
  formatDecimal,
} from '@/lib/money'
import { exactFormData } from '@/lib/localized-number'
import {
  getFixedHistory,
  getFixedIncome,
  redemptionEstimate,
  type FixedPosition,
  type RedemptionEstimate,
} from '@/lib/fixed-income'
import { useWrite } from '@/lib/use-write'
import { request } from '@/lib/api'
import './fixed-income.css'

const amount = (value: string | null) =>
  value === null ? (
    t('common:unavailable')
  ) : (
    <Money value={value} currency="BRL" />
  )
function rate(p: FixedPosition) {
  const c = p.contract
  return ['CDB_CDI', 'RDB_CDI'].includes(c.instrument_type)
    ? `${formatExactPercent(c.cdi_percent)} CDI`
    : c.instrument_type === 'CDB_FIXED'
      ? `${formatExactPercent(c.annual_rate)} ${t('fixed_income:annual')}`
      : `Selic · ${formatExactPercent(c.spread_rate)} ${t('fixed_income:spread')}`
}
function state(value: string) {
  return t(`fixed_income:${value.toLowerCase()}`)
}

export default function FixedIncome({
  asOf,
  accountId,
  assetId,
}: {
  asOf: string
  accountId: string
  assetId?: string
}) {
  const query = useQuery({
    queryKey: ['fixed-income', asOf, accountId],
    queryFn: ({ signal }) => getFixedIncome(asOf, accountId, signal),
  })
  const route = useRoute()
  const selected = route.params.get('contract') || ''
  const setSelected = (contract: string) =>
    navigateTo('Investments', undefined, {
      ...Object.fromEntries(route.params),
      view: 'Fixed Income',
      contract,
      asset: '',
    })
  const [create, setCreate] = useState(false)
  if (query.isPending) return <LoadingState />
  if (query.isError)
    return (
      <ErrorState
        text={query.error.message}
        retry={() => void query.refetch()}
      />
    )
  const positions = query.data.positions
  const current =
    positions.find((p) => p.contract.id === selected) ??
    positions.find((p) => p.contract.asset_id === assetId)
  return (
    <div className="fixed-income-workspace">
      <SectionHeader
        title={t('fixed_income:title')}
        detail={t('fixed_income:intro')}
      >
        <Button onClick={() => setCreate(true)}>
          {t('parity:fixed_subscription')}
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            navigateTo('Settings', undefined, {
              view: 'market',
              action: 'record-index',
              contract: current?.contract.id ?? '',
              index: current?.contract.index_name ?? 'CDI',
              account: accountId,
              end: asOf,
            })
          }
        >
          {t('parity:fixed_index')}
        </Button>
      </SectionHeader>
      {create && (
        <DetailDrawer
          title={t('parity:fixed_subscription')}
          onClose={() => setCreate(false)}
        >
          <FixedSubscription asOf={asOf} onDone={() => setCreate(false)} />
        </DetailDrawer>
      )}
      {current ? (
        <>
          <Button variant="ghost" onClick={() => setSelected('')}>
            {t('fixed_income:title')}
          </Button>
          <FixedDetail
            key={`${current.contract.id}-${asOf}`}
            position={current}
            asOf={asOf}
          />
        </>
      ) : selected || assetId ? (
        <EmptyState title={t('common:unavailable')} />
      ) : !positions.length ? (
        <EmptyState
          title={t('fixed_income:empty')}
          detail={t('fixed_income:empty_detail')}
        />
      ) : (
        <>
          {positions.some((p) => p.contract.index_source === 'SYNTHETIC') && (
            <p className="workflow-context">
              {t('fixed_income:synthetic_notice')}
            </p>
          )}
          <div className="form-actions">
            <Button
              variant="outline"
              onClick={() =>
                setSelected(
                  positions.find((p) =>
                    ['CDB_CDI', 'RDB_CDI'].includes(p.contract.instrument_type),
                  )?.contract.id ?? '',
                )
              }
            >
              {t('fixed_income:compare_cdb')}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                setSelected(
                  positions.find(
                    (p) => p.contract.instrument_type === 'TESOURO_SELIC',
                  )?.contract.id ?? '',
                )
              }
            >
              {t('fixed_income:inspect_selic')}
            </Button>
          </div>
          <div className="table-scroll">
            <table className="investment-table">
              <caption className="sr-only">{t('fixed_income:title')}</caption>
              <thead>
                <tr>
                  {[
                    'instrument',
                    'principal',
                    'gross_value',
                    'gross_interest',
                    'rate',
                    'maturity',
                    'liquidity',
                    'estimated_net',
                  ].map((k) => (
                    <th key={k}>{t(`fixed_income:${k}`)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => (
                  <tr key={p.contract.id} aria-selected={false}>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => setSelected(p.contract.id)}
                      >
                        {p.name}
                      </button>
                      <small className="metadata">{state(p.status)}</small>
                    </td>
                    <td className="numeric">{amount(p.principal)}</td>
                    <td className="numeric">{amount(p.gross_value)}</td>
                    <td className="numeric">{amount(p.gross_interest)}</td>
                    <td>{rate(p)}</td>
                    <td>{formatDate(p.contract.maturity_date)}</td>
                    <td>{state(p.contract.liquidity)}</td>
                    <td className="numeric">{amount(p.estimated_net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <section aria-label={t('fixed_income:maturity_timeline')}>
            <SectionHeader title={t('fixed_income:maturity_timeline')} />
            <ol className="maturity-timeline">
              {[...positions]
                .sort((a, b) =>
                  a.contract.maturity_date.localeCompare(
                    b.contract.maturity_date,
                  ),
                )
                .map((p) => (
                  <li key={p.contract.id}>
                    <time dateTime={p.contract.maturity_date}>
                      {formatDate(p.contract.maturity_date)}
                    </time>
                    <button onClick={() => setSelected(p.contract.id)}>
                      {p.name}
                    </button>
                    <span>{amount(p.principal)}</span>
                  </li>
                ))}
            </ol>
          </section>
        </>
      )}
    </div>
  )
}

function FixedDetail({
  position: p,
  asOf,
}: {
  position: FixedPosition
  asOf: string
}) {
  const c = p.contract
  const history = useQuery({
    queryKey: ['fixed-income-history', c.id, asOf],
    queryFn: ({ signal }) =>
      getFixedHistory(c.id, c.settlement_date, asOf, signal),
  })
  const [redeeming, setRedeeming] = useState(false)
  return (
    <section aria-label={p.name} className="fixed-income-detail">
      <SectionHeader title={p.name} detail={rate(p)}>
        {decimalUnits(p.quantity) > 0n && (
          <Button variant="outline" onClick={() => setRedeeming(!redeeming)}>
            {t('fixed_income:record_redemption')}
          </Button>
        )}
      </SectionHeader>
      <p className="metadata">
        {c.instrument_type === 'TESOURO_SELIC'
          ? t('fixed_income:selic_notice')
          : t('fixed_income:cdb_notice')}
      </p>
      <details>
        <summary>{t('fixed_income:terms')}</summary>
        <dl className="fixed-income-terms">
          {[
            [t('fixed_income:issuer'), c.issuer],
            [t('fixed_income:settlement'), formatDate(c.settlement_date)],
            [t('fixed_income:maturity'), formatDate(c.maturity_date)],
            [t('fixed_income:redemption_from'), formatDate(c.redemption_from)],
            [
              t('fixed_income:index'),
              c.index_name ?? t('fixed_income:fixed_rate'),
            ],
            [t('fixed_income:source'), state(c.index_source)],
            [t('fixed_income:quantity'), formatDecimal(p.quantity)],
            [t('fixed_income:purchase_price'), amount(c.acquisition_price)],
            [
              t('fixed_income:fgc'),
              c.fgc_eligible
                ? t('fixed_income:fgc_limited')
                : t('fixed_income:no_fgc'),
            ],
            [
              t('fixed_income:valuation_date'),
              p.price_date ? formatDate(p.price_date) : t('common:unavailable'),
            ],
            [t('fixed_income:notes'), c.notes],
          ].map(([label, value], i) => (
            <div key={i}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </details>
      {redeeming && (
        <RedemptionForm
          position={p}
          asOf={asOf}
          done={() => setRedeeming(false)}
        />
      )}
      {history.isPending ? (
        <LoadingState />
      ) : history.isError ? (
        <ErrorState
          text={history.error.message}
          retry={() => void history.refetch()}
        />
      ) : (
        <>
          <FixedIncomeChart history={history.data} />
          <div className="visual-grid">
            <FixedIncomeChart history={history.data} returns />
            <CompositionChart
              title={t('fixed_income:principal_interest')}
              currency="BRL"
              items={[
                { name: t('fixed_income:principal'), value: p.principal },
                {
                  name: t('fixed_income:gross_interest'),
                  value: p.gross_interest,
                },
              ]}
            />
          </div>
        </>
      )}
      <section className="fixed-income-tax">
        <SectionHeader title={t('fixed_income:tax_estimate')} />
        <div className="financial-metrics">
          {[
            ['income_tax', p.income_tax],
            ['iof', p.iof],
            ['estimated_net', p.estimated_net],
            ['realized_net', p.realized_net],
          ].map(([label, value]) => (
            <div key={label!}>
              <span className="metadata">{t(`fixed_income:${label}`)}</span>
              <strong>{amount(value)}</strong>
            </div>
          ))}
        </div>
        <p className="metadata">{t('fixed_income:tax_notice')}</p>
      </section>
    </section>
  )
}

function RedemptionForm({
  position: p,
  asOf,
  done,
}: {
  position: FixedPosition
  asOf: string
  done: () => void
}) {
  const write = useWrite()
  const [preview, setPreview] = useState<RedemptionEstimate | null>(null)
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const path = `/investments/fixed-income/${p.contract.id}/redemptions`
  return (
    <form
      className="entry-form"
      onChange={() => {
        setPreview(null)
        setPayload(null)
      }}
      onSubmit={async (e) => {
        e.preventDefault()
        setError('')
        setBusy(true)
        const form = exactFormData(e.currentTarget)
        const data = {
          request_id: crypto.randomUUID(),
          settlement_date: form.get('settlement_date'),
          quantity: form.get('quantity'),
          fees: form.get('fees'),
          ...(p.contract.instrument_type === 'TESOURO_SELIC'
            ? { unit_price: form.get('unit_price') }
            : {}),
        }
        try {
          setPreview(
            redemptionEstimate.parse(
              await request(path + '/preview', {
                method: 'POST',
                body: JSON.stringify(data),
              }),
            ),
          )
          setPayload(data)
        } catch (e) {
          setError((e as Error).message)
        } finally {
          setBusy(false)
        }
      }}
    >
      <p>{t('fixed_income:redemption_notice')}</p>
      <div className="form-grid">
        <Field label={t('fixed_income:settlement')}>
          <input
            type="date"
            name="settlement_date"
            defaultValue={asOf}
            min={p.contract.redemption_from}
            required
          />
        </Field>
        <Field label={t('fixed_income:quantity')}>
          <input
            name="quantity"
            inputMode="decimal"
            defaultValue={p.quantity}
            required
          />
        </Field>
        {p.contract.instrument_type === 'TESOURO_SELIC' && (
          <Field label={t('fixed_income:executed_price')}>
            <input name="unit_price" inputMode="decimal" required />
          </Field>
        )}
        <Field label={t('fixed_income:fees')}>
          <input name="fees" inputMode="decimal" defaultValue="0" required />
        </Field>
      </div>
      <Button disabled={busy || write.isPending}>
        {t('fixed_income:preview_redemption')}
      </Button>
      {error && <ErrorState text={error} />}
      {write.isError && <ErrorState text={write.error.message} />}
      {preview && payload && (
        <div role="status">
          <p>
            {t('fixed_income:cash_proceeds')}: {amount(preview.cash_proceeds)} ·{' '}
            {t('fixed_income:income_tax')}: {amount(preview.income_tax)} · IOF:{' '}
            {amount(preview.iof)}
          </p>
          <Button
            type="button"
            disabled={write.isPending}
            onClick={() =>
              write.mutate({ path, data: payload }, { onSuccess: done })
            }
          >
            {t('fixed_income:confirm_redemption')}
          </Button>
        </div>
      )}
    </form>
  )
}
