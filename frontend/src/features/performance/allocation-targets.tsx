import { bpsPercent, bpsPoints, inputBps } from './target-math'
// SPDX-License-Identifier: AGPL-3.0-only
// Source adaptation: 92b4647 insights/overview/target-rails-card.tsx rails/header
// and allocation-targets targets-tab. Exact flat-classification API adapter.
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Plus, X } from 'lucide-react'
import { getAccounts, request } from '@/lib/api'
import { decimalUnits, unitsToMoney } from '@/lib/money'
import { exactFormData } from '@/lib/localized-number'
import { Field } from '@/components/forms'
import {
  Money,
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/primitives'
import { DetailDrawer } from '@/components/detail-drawer'
import { Card } from '@/vendor/wealthfolio/ui/components/ui/card'
import { compositionColors } from '@/lib/composition'
import type { Allocation } from '@/lib/investment-analytics'
import {
  getDrift,
  listTargets,
  writeTarget,
  type AllocationTarget,
  type Drift,
} from './allocation-api'
import '@/features/holdings/i18n'

const dimensions = [
  'asset_class',
  'instrument_type',
  'sector',
  'geography',
  'currency',
  'issuer',
] as const
function Editor({
  value,
  data,
  accountId,
  onClose,
}: {
  value?: AllocationTarget
  data: Allocation
  accountId: string
  onClose: () => void
}) {
  const { t } = useTranslation('allocationMigration')
  const client = useQueryClient()
  const [dimension, setDimension] = useState(
    value?.target.dimension ?? 'asset_class',
  )
  const [scope, setScope] = useState(
    value?.target.scope ?? (accountId ? 'accounts' : 'all'),
  )
  const [ids, setIds] = useState(
    value?.account_ids ?? (accountId ? [accountId] : []),
  )
  const [rows, setRows] = useState(
    value?.weights.map((w, index) => ({
      rowKey: 'initial-' + index,
      ...w,
      percent: unitsToMoney(BigInt(w.target_bps) * 10000n),
    })) ?? [
      {
        rowKey: 'initial-0',
        category: 'ETF',
        target_bps: 6000,
        required: true,
        percent: '60',
      },
      {
        rowKey: 'initial-1',
        category: 'CASH',
        target_bps: 4000,
        required: true,
        percent: '40',
      },
    ],
  )
  const accounts = useQuery({
    queryKey: ['accounts'],
    queryFn: ({ signal }) => getAccounts(signal),
  })
  const [error, setError] = useState('')
  const save = useMutation({
    mutationFn: (fields: FormData) => {
      return writeTarget(
        {
          name: fields.get('name'),
          dimension,
          currency: value?.target.currency ?? data.currency,
          scope,
          account_ids: scope === 'accounts' ? ids : [],
          band_type: fields.get('band_type'),
          band_bps: inputBps(String(fields.get('band'))),
          relative_factor_bps: inputBps(String(fields.get('relative'))),
          weights: rows.map((row, i) => ({
            category: String(fields.get(`category-${i}`)).trim(),
            target_bps: inputBps(String(fields.get(`weight-${i}`))),
            required: row.required,
          })),
          expected_version: value?.target.version,
        },
        value?.target.id,
      )
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['allocation-targets'] })
      await client.invalidateQueries({ queryKey: ['allocation-drift'] })
      onClose()
    },
    onError: (e) => setError(e.message),
  })
  return (
    <DetailDrawer title={value ? t('edit') : t('create')} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setError('')
          save.mutate(exactFormData(e.currentTarget))
        }}
        className="investment-editor allocation-target-editor"
      >
        <fieldset disabled={save.isPending}>
          <Field label={t('name')}>
            <input
              name="name"
              required
              maxLength={100}
              defaultValue={value?.target.name ?? ''}
            />
          </Field>
          <Field label={t('dimension')}>
            <select
              value={dimension}
              onChange={(e) => setDimension(e.target.value)}
            >
              {dimensions.map((d) => (
                <option value={d} key={d}>
                  {t(`dimension_${d}`)}
                </option>
              ))}
            </select>
          </Field>
          <p className="metadata">
            {t('currency', {
              currency: value?.target.currency ?? data.currency,
            })}
          </p>
          <Field label={t('scope')}>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as 'all' | 'accounts')}
            >
              <option value="all">{t('all')}</option>
              <option value="accounts">{t('selectedAccounts')}</option>
            </select>
          </Field>
          {scope === 'accounts' && (
            <div>
              {accounts.data
                ?.filter((a) => a.type === 'INVESTMENT')
                .map((a) => (
                  <label className="performance-picker-row" key={a.id}>
                    <span>{a.name}</span>
                    <input
                      type="checkbox"
                      checked={ids.includes(a.id)}
                      onChange={(e) =>
                        setIds(
                          e.target.checked
                            ? [...ids, a.id]
                            : ids.filter((id) => id !== a.id),
                        )
                      }
                    />
                  </label>
                ))}
            </div>
          )}
          <Field label={t('bandType')}>
            <select
              name="band_type"
              defaultValue={value?.target.band_type ?? 'absolute'}
            >
              <option value="absolute">{t('absolute')}</option>
              <option value="hybrid">{t('hybrid')}</option>
            </select>
          </Field>
          <Field label={t('tolerance')}>
            <input
              name="band"
              data-number-input
              inputMode="decimal"
              required
              defaultValue={unitsToMoney(
                BigInt(value?.target.band_bps ?? 500) * 10000n,
              )}
            />
          </Field>
          <Field label={t('relative')}>
            <input
              name="relative"
              data-number-input
              inputMode="decimal"
              required
              defaultValue={unitsToMoney(
                BigInt(value?.target.relative_factor_bps ?? 2000) * 10000n,
              )}
            />
          </Field>
          <p className="metadata">{t('bandNote')}</p>
          <datalist id="target-classifications">
            {(data.groups[dimension] ?? []).map((g) => (
              <option key={g.name} value={g.name} />
            ))}
          </datalist>
          {rows.map((row, i) => (
            <div className="allocation-weight-row" key={row.rowKey}>
              <Field label={t('category', { number: i + 1 })}>
                <input
                  name={`category-${i}`}
                  required
                  maxLength={100}
                  list="target-classifications"
                  defaultValue={row.category}
                />
              </Field>
              <Field label={t('weight')}>
                <input
                  name={`weight-${i}`}
                  data-number-input
                  inputMode="decimal"
                  required
                  defaultValue={row.percent}
                />
              </Field>
              <label>
                <input
                  type="checkbox"
                  checked={row.required}
                  onChange={(e) =>
                    setRows(
                      rows.map((r, j) =>
                        j === i ? { ...r, required: e.target.checked } : r,
                      ),
                    )
                  }
                />
                {t('required')}
              </label>
              <button
                type="button"
                aria-label={t('removeRow', { number: i + 1 })}
                onClick={() => setRows(rows.filter((_, j) => i !== j))}
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setRows([
                ...rows,
                {
                  rowKey: crypto.randomUUID(),
                  category: '',
                  percent: '0',
                  target_bps: 0,
                  required: true,
                },
              ])
            }
          >
            <Plus size={14} />
            {t('addRow')}
          </button>
          <p className="metadata">{t('sumNote')}</p>
          <button type="submit" disabled={!rows.length}>
            {save.isPending ? t('saving') : t('save')}
          </button>
        </fieldset>
        {error && <p role="alert">{error}</p>}
      </form>
    </DetailDrawer>
  )
}
function DriftDetails({
  drift,
  onSecurity,
}: {
  drift: Drift
  onSecurity: (id: string) => void
}) {
  const { t } = useTranslation('allocationMigration')
  return (
    <>
      <p className="metadata">
        {t('asOf', { date: drift.as_of })} · {drift.currency} ·{' '}
        {t(drift.scope === 'all' ? 'all' : 'selectedAccounts')}
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {[
                'classification',
                'current',
                'target',
                'difference',
                'status',
              ].map((k) => (
                <th key={k}>{t(k)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {drift.rows.map((row) => (
              <tr key={row.category}>
                <th scope="row">{row.category}</th>
                <td className="number">
                  {bpsPercent(row.current_bps)}
                  <br />
                  {row.current_value === null ? (
                    '—'
                  ) : (
                    <Money
                      value={row.current_value}
                      currency={drift.currency}
                    />
                  )}
                </td>
                <td className="number">
                  {bpsPercent(row.target_bps)}
                  <br />
                  {row.target_value === null ? (
                    '—'
                  ) : (
                    <Money value={row.target_value} currency={drift.currency} />
                  )}
                </td>
                <td className="number">
                  {bpsPoints(row.drift_bps)}
                  <br />
                  {row.value_delta === null ? (
                    '—'
                  ) : (
                    <Money value={row.value_delta} currency={drift.currency} />
                  )}
                </td>
                <td>
                  {t(`status_${row.status}`)}
                  <details>
                    <summary>{t('holdings')}</summary>
                    {row.members.map((m) =>
                      m.asset_id ? (
                        <button
                          key={`${m.account_id}-${m.asset_id}`}
                          onClick={() => onSecurity(m.asset_id!)}
                        >
                          {t('openHolding')}
                        </button>
                      ) : (
                        <span key={m.account_id}>{t('cash')}</span>
                      ),
                    )}
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="metadata">{t('planningOnly')}</p>
    </>
  )
}
export function AllocationTargets({
  data,
  asOf,
  accountId,
  onSecurity,
}: {
  data: Allocation
  asOf: string
  accountId: string
  onSecurity: (id: string) => void
}) {
  const { t } = useTranslation(['allocationMigration', 'wfInsights'])
  const targets = useQuery({
    queryKey: ['allocation-targets'],
    queryFn: ({ signal }) => listTargets(signal),
  })
  const [selected, setSelected] = useState('')
  const [editor, setEditor] = useState<'new' | 'edit' | null>(null)
  const [details, setDetails] = useState(false)
  const client = useQueryClient()
  const selectedTarget =
    targets.data?.find((v) => v.target.id === selected) ?? targets.data?.[0]
  const drift = useQuery({
    queryKey: [
      'allocation-drift',
      selectedTarget?.target.id,
      selectedTarget?.target.version,
      asOf,
    ],
    queryFn: ({ signal }) => getDrift(selectedTarget!.target.id, asOf, signal),
    enabled: !!selectedTarget,
  })
  const remove = useMutation({
    mutationFn: () =>
      request(
        `/investments/allocation-targets/${selectedTarget!.target.id}?expected_version=${selectedTarget!.target.version}`,
        { method: 'DELETE' },
      ),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ['allocation-targets'] }),
  })
  if (targets.isPending)
    return <LoadingState text={t('allocationMigration:loading')} />
  if (targets.isError)
    return (
      <ErrorState
        text={targets.error.message}
        retry={() => void targets.refetch()}
      />
    )
  const rows = drift.data?.rows ?? []
  const bands = rows
    .filter((row) => row.required && row.target_bps > 0)
    .map((row) => row.effective_band_bps)
  const minBand = bands.length
    ? Math.min(...bands)
    : (selectedTarget?.target.band_bps ?? 0)
  const maxBand = bands.length ? Math.max(...bands) : minBand
  // Coordinates are bounded dimensionless BPS ratios; money never enters Number.
  const maxBps = rows.reduce((max, row) => {
    const current =
      row.current_bps === null ? 0n : decimalUnits(row.current_bps)
    const target = BigInt(row.target_bps) * 1000000n
    return [max, current, target].reduce((a, b) => (a > b ? a : b))
  }, 1000000n)
  const width = (value: string | number) =>
    Number((decimalUnits(String(value)) * 10000n) / maxBps) / 108
  return (
    <Card
      className="flex flex-col gap-4 p-5 xl:h-full allocation-targets-card"
      data-drift-quality={drift.data?.quality ?? 'LOADING'}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">
          {t('wfInsights:insights.rails.target_allocation')}
        </h2>
        <button className="text-xs" onClick={() => setEditor('new')}>
          <Plus size={14} />
          {t('allocationMigration:create')}
        </button>
      </div>
      <div
        role="group"
        aria-label={t('allocationMigration:selectTarget')}
        className="flex gap-1.5 overflow-x-auto"
      >
        {targets.data?.map((v) => (
          <button
            key={v.target.id}
            className={`rounded-full px-3 py-1 text-xs ${v === selectedTarget ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}
            aria-pressed={v === selectedTarget}
            onClick={() => setSelected(v.target.id)}
          >
            {v.target.name}
          </button>
        ))}
      </div>
      {!selectedTarget ? (
        <EmptyState
          title={t('allocationMigration:noTargets')}
          detail={t('allocationMigration:planningOnly')}
        />
      ) : (
        <>
          <p className="metadata">
            {selectedTarget.target.currency} ·{' '}
            {t(
              `allocationMigration:dimension_${selectedTarget.target.dimension}`,
            )}{' '}
            ·{' '}
            {t(
              selectedTarget.target.scope === 'all'
                ? 'allocationMigration:all'
                : 'allocationMigration:selectedAccounts',
            )}
          </p>
          {drift.isPending ? (
            <LoadingState text={t('allocationMigration:loading')} />
          ) : drift.isError ? (
            <ErrorState
              text={drift.error.message}
              retry={() => void drift.refetch()}
            />
          ) : drift.data && drift.data.quality !== 'COMPLETE' ? (
            <p role="status">
              {t('allocationMigration:unavailable')} ·{' '}
              {drift.data.reasons.join(' · ')}
            </p>
          ) : (
            <div>
              {rows.map((row, index) => (
                <div
                  key={row.category}
                  className="grid grid-cols-[6.875rem_1fr_4.5rem] items-center gap-2.5 border-t py-3 first:border-t-0"
                >
                  <span className="flex items-center gap-2 overflow-hidden text-xs font-semibold">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ background: compositionColors[index % 8] }}
                    />
                    <span className="truncate">{row.category}</span>
                  </span>
                  <span className="bg-muted relative h-2 rounded-full">
                    <span
                      className="absolute top-0 h-full rounded-full opacity-60"
                      style={{
                        width: `${width(row.current_bps ?? '0')}%`,
                        background: compositionColors[index % 8],
                      }}
                    />
                    <span
                      className="bg-foreground absolute -top-1 h-4 w-[2.5px] rounded-sm"
                      style={{
                        insetInlineStart: `calc(${width(row.target_bps)}% - 1px)`,
                      }}
                    />
                  </span>
                  <span
                    className="text-2xs text-end font-bold tabular-nums"
                    data-status={row.status}
                  >
                    {bpsPoints(row.drift_bps)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-3 text-xs">
            <button onClick={() => setDetails(true)}>
              {t('allocationMigration:details')} <ArrowRight size={12} />
            </button>
            <button onClick={() => setEditor('edit')}>
              {t('allocationMigration:edit')}
            </button>
            <button
              disabled={remove.isPending}
              onClick={() => {
                if (window.confirm(t('allocationMigration:deleteConfirm')))
                  remove.mutate()
              }}
            >
              {t('allocationMigration:delete')}
            </button>
          </div>
          {remove.isError && <p role="alert">{remove.error.message}</p>}
          {drift.data?.quality === 'COMPLETE' && (
            <p className="metadata">
              {t('allocationMigration:outside', {
                count: drift.data.out_of_band_count ?? 0,
              })}{' '}
              · {t('allocationMigration:tolerance')}: {bpsPoints(minBand)}
              {maxBand !== minBand ? ` – ${bpsPoints(maxBand)}` : null}
            </p>
          )}
        </>
      )}
      <p className="metadata">{t('allocationMigration:planningOnly')}</p>
      {editor && (
        <Editor
          key={editor === 'new' ? 'new' : selectedTarget?.target.id}
          value={editor === 'edit' ? selectedTarget : undefined}
          data={data}
          accountId={accountId}
          onClose={() => setEditor(null)}
        />
      )}
      {details && drift.data && (
        <DetailDrawer
          title={t('allocationMigration:details')}
          onClose={() => setDetails(false)}
        >
          <DriftDetails drift={drift.data} onSecurity={onSecurity} />
        </DetailDrawer>
      )}
    </Card>
  )
}
