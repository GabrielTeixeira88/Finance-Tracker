import { CandidateInspector } from '@/components/candidate-inspector'
import { t as tr, ui } from '@/lib/i18n'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { Field } from '@/components/forms'
import { Button } from '@/components/ui/button'
import {
  ErrorState,
  LoadingState,
  Money,
  SectionHeader,
} from '@/components/primitives'
import { request, type Account } from '@/lib/api'
import { useWrite } from '@/lib/use-write'
import { useRoute } from '@/lib/navigation'

const candidateSchema = z
  .object({
    activity_date: z.string(),
    activity_type: z.string(),
    symbol: z.string().optional(),
    quantity: z.string(),
    unit_price: z.string(),
    fees: z.string(),
    taxes: z.string(),
    gross_amount: z.string(),
    cash_amount: z.string().optional(),
    currency: z.string(),
  })
  .passthrough()
const batchSchema = z.object({
  id: z.string(),
  source_type: z.string().optional(),
  account_id: z.string().optional(),
  status: z.string(),
  filename: z.string(),
  ready: z.boolean(),
  preview_token: z.string().nullable(),
  counts: z.record(z.string(), z.number()),
  rows: z.array(
    z.object({
      id: z.string(),
      row_number: z.number(),
      status: z.string(),
      errors: z.array(z.string()),
      candidate: candidateSchema.nullable(),
      decision: z.object({ action: z.string().optional() }),
    }),
  ),
})
type Batch = z.infer<typeof batchSchema>
const initialColumns = {
  date: 0,
  type: 1,
  symbol: 2,
  exchange: 3,
  quantity: 4,
  unit_price: 5,
  gross_amount: 6,
  fees: 7,
  taxes: 8,
  currency: 9,
  external_id: 10,
}
const mappingSchema = z.object({
  kind: z.literal('BROKERAGE').default('BROKERAGE'),
  columns: z.record(z.string(), z.number()),
  delimiter: z.enum([',', ';']).default(','),
  date_format: z.enum(['%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y']).default('%Y-%m-%d'),
  decimal_separator: z.enum(['.', ',']).default('.'),
  thousands_separator: z.enum(['', '.', ',']).default(''),
  encoding: z.enum(['utf-8-sig', 'cp1252']).default('utf-8-sig'),
  has_header: z.boolean().default(true),
  source_namespace: z.string().default(''),
})
type Mapping = z.infer<typeof mappingSchema>
const profileSchema = z.object({
  id: z.string(),
  name: z.string(),
  configuration: mappingSchema,
})
export default function BrokerageImports({
  accounts,
}: {
  accounts: Account[]
}) {
  const [account, setAccount] = useState(
    accounts.find((a) => a.type === 'INVESTMENT' && a.active)?.id || '',
  )
  const [mapping, setMapping] = useState<Mapping>(() =>
    mappingSchema.parse({ columns: initialColumns }),
  )
  const [file, setFile] = useState<File | null>(null)
  const [localBatch, setBatch] = useState<Batch | null>(null)
  const linkedBatchId = useRoute().params.get('batch')
  const linkedBatch = useQuery({
    queryKey: ['investments', 'import', linkedBatchId],
    enabled: !!linkedBatchId,
    queryFn: async () =>
      batchSchema.parse(await request('/investments/imports/' + linkedBatchId)),
  })
  const batch = localBatch ?? linkedBatch.data ?? null
  const [focused, setFocused] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')
  const [profileName, setProfileName] = useState('')
  const write = useWrite()
  const profiles = useQuery({
    queryKey: ['investments', 'import-profiles'],
    queryFn: async () =>
      z
        .array(profileSchema)
        .parse(await request('/investments/imports/profiles')),
  })
  const history = useQuery({
    queryKey: ['investments', 'import-history'],
    queryFn: async () =>
      z
        .array(
          z.object({
            id: z.string(),
            filename: z.string(),
            status: z.string(),
          }),
        )
        .parse(await request('/investments/imports')),
  })
  async function update(path: string, method = 'POST', data?: unknown) {
    setError('')
    try {
      const result = await write.mutateAsync({
        path: '/investments/imports' + path,
        method,
        data,
      })
      setBatch(batchSchema.parse(result))
      setConfirmed(false)
    } catch (e) {
      setError(
        e instanceof Error ? e.message : tr('dynamic:import_failed_fbae89'),
      )
    }
  }
  async function preview() {
    setError('')
    try {
      if (!file || file.size > 2 * 1024 * 1024 || file.size === 0)
        throw new Error(ui('Choose a nonempty CSV of at most 2 MiB'))
      const bytes = new Uint8Array(await file.arrayBuffer())
      let binary = ''
      for (const byte of bytes) binary += String.fromCharCode(byte)
      await update('/preview', 'POST', {
        filename: file.name,
        account_id: account,
        content_base64: btoa(binary),
        configuration: mapping,
      })
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : tr('dynamic:unable_to_read_file_73df89'),
      )
    }
  }
  if (linkedBatchId && !batch && linkedBatch.isPending) return <LoadingState />
  if (linkedBatchId && !batch && linkedBatch.isError)
    return (
      <ErrorState
        text={linkedBatch.error.message}
        retry={() => void linkedBatch.refetch()}
      />
    )
  return (
    <section className={`candidate-review ${focused ? 'has-inspector' : ''}`}>
      <SectionHeader
        title={tr(
          batch?.source_type === 'PLUGGY_INVESTMENT'
            ? 'pluggy:investment_review'
            : 'investment_imports:brokerage_csv_imports_e1171b',
        )}
        detail={tr(
          batch?.source_type === 'PLUGGY_INVESTMENT'
            ? 'pluggy:investment_review_scope'
            : 'investment_imports:local_files_explicit_review_no_activities_or_cas_eeeda2',
        )}
      />
      {(error || profiles.isError || history.isError) && (
        <ErrorState
          text={
            error ||
            profiles.error?.message ||
            history.error?.message ||
            tr('dynamic:unable_to_load_import_data_fc5c4e')
          }
        />
      )}
      {!batch ? (
        <>
          <div className="form-grid investment-editor">
            <Field label={tr('investment_imports:brokerage_csv_file_9a461b')}>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </Field>
            <Field
              label={tr('investment_imports:brokerage_target_account_02c1ce')}
            >
              <select
                value={account}
                onChange={(e) => setAccount(e.target.value)}
              >
                <option value="">
                  {tr('investment_imports:choose_account_9ccef0')}
                </option>
                {accounts
                  .filter((a) => a.type === 'INVESTMENT' && a.active)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {a.currency}
                    </option>
                  ))}
              </select>
            </Field>
            <Field
              label={tr('investment_imports:brokerage_mapping_profile_421893')}
            >
              <select
                defaultValue=""
                onChange={(e) => {
                  const p = profiles.data?.find((p) => p.id === e.target.value)
                  if (p) setMapping(p.configuration)
                }}
              >
                <option value="">
                  {tr('investment_imports:custom_mapping_0ab83e')}
                </option>
                {profiles.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label={tr('investment_imports:broker_source_namespace_62eb0f')}
            >
              <input
                value={mapping.source_namespace}
                onChange={(e) =>
                  setMapping({ ...mapping, source_namespace: e.target.value })
                }
                placeholder={tr(
                  'investment_imports:stable_broker_export_identity_6b5f91',
                )}
              />
            </Field>
            <Field label={tr('investment_imports:csv_delimiter_2b8868')}>
              <select
                value={mapping.delimiter}
                onChange={(e) =>
                  setMapping({
                    ...mapping,
                    delimiter: e.target.value as ',' | ';',
                  })
                }
              >
                <option value=",">
                  {tr('investment_imports:comma_b9ee3d')}
                </option>
                <option value=";">
                  {tr('investment_imports:semicolon_727cec')}
                </option>
              </select>
            </Field>
            <Field label={tr('investment_imports:csv_date_format_2eee79')}>
              <select
                value={mapping.date_format}
                onChange={(e) =>
                  setMapping({
                    ...mapping,
                    date_format: e.target.value as Mapping['date_format'],
                  })
                }
              >
                {['%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y'].map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </Field>
            <Field
              label={tr('investment_imports:csv_decimal_separator_b0bc6e')}
            >
              <select
                value={mapping.decimal_separator}
                onChange={(e) =>
                  setMapping({
                    ...mapping,
                    decimal_separator: e.target.value as '.' | ',',
                  })
                }
              >
                <option value=".">{tr('investment_imports:dot_46856b')}</option>
                <option value=",">
                  {tr('investment_imports:comma_b9ee3d')}
                </option>
              </select>
            </Field>
            <Field
              label={tr('investment_imports:csv_thousands_separator_ead4ff')}
            >
              <select
                value={mapping.thousands_separator}
                onChange={(e) =>
                  setMapping({
                    ...mapping,
                    thousands_separator: e.target
                      .value as Mapping['thousands_separator'],
                  })
                }
              >
                <option value="">{tr('investment_imports:none_6eef66')}</option>
                <option value=".">{tr('investment_imports:dot_46856b')}</option>
                <option value=",">
                  {tr('investment_imports:comma_b9ee3d')}
                </option>
              </select>
            </Field>
            <Field label={tr('investment_imports:csv_encoding_1d2ef1')}>
              <select
                value={mapping.encoding}
                onChange={(e) =>
                  setMapping({
                    ...mapping,
                    encoding: e.target.value as Mapping['encoding'],
                  })
                }
              >
                <option value="utf-8-sig">
                  {tr('investment_imports:utf_8_663b90')}
                </option>
                <option value="cp1252">
                  {tr('investment_imports:windows_1252_694498')}
                </option>
              </select>
            </Field>
            <label>
              <input
                type="checkbox"
                checked={mapping.has_header}
                onChange={(e) =>
                  setMapping({ ...mapping, has_header: e.target.checked })
                }
              />{' '}
              {tr('investment_imports:first_row_is_a_header_2f0a21')}{' '}
            </label>
          </div>
          <details>
            <summary>
              {tr(
                'investment_imports:column_mapping_zero_based_indexes__299a26',
              )}
            </summary>
            <div className="form-grid investment-editor">
              {[...Object.keys(initialColumns), 'notes'].map((key) => (
                <Field
                  label={tr('messages:message_3410bc39c4fb', { value0: key })}
                  key={key}
                >
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={mapping.columns[key] ?? ''}
                    onChange={(e) => {
                      const columns = { ...mapping.columns }
                      if (e.target.value === '') delete columns[key]
                      else columns[key] = Number(e.target.value)
                      setMapping({ ...mapping, columns })
                    }}
                  />
                </Field>
              ))}
            </div>
          </details>
          <div className="investment-actions">
            <Field
              label={tr('investment_imports:save_brokerage_profile_as_c15a3f')}
            >
              <input
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                maxLength={120}
              />
            </Field>
            <Button
              variant="outline"
              disabled={!profileName.trim() || write.isPending}
              onClick={() =>
                void write
                  .mutateAsync({
                    path: '/investments/imports/profiles',
                    data: {
                      name: profileName,
                      configuration: mapping,
                      default_account_id: account || null,
                    },
                  })
                  .then(() => setProfileName(''))
                  .catch((e) => setError(e.message))
              }
            >
              {tr('investment_imports:save_brokerage_profile_3f8f62')}
            </Button>
            <Button
              disabled={!file || !account || write.isPending}
              onClick={() => void preview()}
            >
              {tr('investment_imports:preview_brokerage_csv_a777ae')}
            </Button>
          </div>
          <p className="metadata">
            {tr(
              'investment_imports:create_assets_first_using_exact_symbol_exchange__44a62c',
            )}
          </p>
        </>
      ) : (
        <>
          {batch.account_id && (
            <p className="metadata">
              {tr('pluggy:local_account')}:{' '}
              {accounts.find((a) => a.id === batch.account_id)?.name ??
                batch.account_id}
            </p>
          )}
          <div className="investment-actions">
            <strong>
              {batch.filename} · {ui(batch.status)}
            </strong>
            <Button
              variant="outline"
              onClick={() => {
                setBatch(null)
                setConfirmed(false)
              }}
            >
              {tr('investment_imports:new_brokerage_import_67a355')}
            </Button>
            <Button
              variant="outline"
              onClick={() => void update('/' + batch.id, 'GET')}
            >
              {tr('investment_imports:refresh_brokerage_preview_280d39')}
            </Button>
          </div>
          <div className="table-scroll">
            <table className="investment-table">
              <caption className="sr-only">
                {tr('investment_imports:brokerage_import_preview_9756cc')}
              </caption>
              <thead>
                <tr>
                  {[
                    'Row / date',
                    'Activity / security',
                    'Quantity',
                    'Price',
                    'Fees / taxes',
                    'Gross / net cash',
                    'Status / decision',
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {batch.rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.row_number}
                      <small>{r.candidate?.activity_date}</small>
                    </td>
                    <td>
                      {r.candidate?.activity_type} {r.candidate?.symbol}
                    </td>
                    <td className="number">{r.candidate?.quantity}</td>
                    <td className="number">
                      {r.candidate && (
                        <Money
                          value={r.candidate.unit_price}
                          currency={r.candidate.currency}
                        />
                      )}
                    </td>
                    <td className="number">
                      {r.candidate && (
                        <>
                          <Money
                            value={r.candidate.fees}
                            currency={r.candidate.currency}
                          />
                          <small>
                            <Money
                              value={r.candidate.taxes}
                              currency={r.candidate.currency}
                            />
                          </small>
                        </>
                      )}
                    </td>
                    <td className="number">
                      {r.candidate && (
                        <>
                          <Money
                            value={r.candidate.gross_amount}
                            currency={r.candidate.currency}
                          />
                          <small>
                            <Money
                              value={
                                r.candidate.cash_amount ||
                                r.candidate.gross_amount
                              }
                              currency={r.candidate.currency}
                            />
                          </small>
                        </>
                      )}
                    </td>
                    <td>
                      {ui(r.status)}
                      <small>{r.errors.join(' · ')}</small>
                      <Button variant="ghost" onClick={() => setFocused(r.id)}>
                        {tr('parity:inspect')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {batch.rows
            .filter((r) => r.id === focused)
            .map((r) => (
              <CandidateInspector
                key={r.id}
                title={tr('investment_imports:brokerage_import_preview_9756cc')}
                onClose={() => setFocused(null)}
              >
                <p>{ui(r.status)}</p>
                <p role="status">{r.errors.join(' / ')}</p>
                <dl className="source-evidence">
                  {Object.entries(r.candidate ?? {}).map(([key, value]) => (
                    <div key={key}>
                      <dt>{key}</dt>
                      <dd>{String(value ?? '')}</dd>
                    </div>
                  ))}
                </dl>
                {batch.status === 'DRAFT' && (
                  <select
                    aria-label={tr('messages:message_26a598364645', {
                      value0: r.row_number,
                    })}
                    value={r.decision.action || ''}
                    disabled={write.isPending}
                    onChange={(e) =>
                      void update(`/${batch.id}/rows/${r.id}`, 'PATCH', {
                        action: e.target.value,
                      })
                    }
                  >
                    <option value="" disabled>
                      {tr('investment_imports:choose_decision_b0982e')}
                    </option>
                    <option value="SKIP">
                      {tr('investment_imports:skip_this_row_87e0bd')}
                    </option>
                    {r.status !== 'INVALID' &&
                      r.status !== 'EXACT_DUPLICATE' && (
                        <option value="NEW">
                          {tr(
                            'investment_imports:confirmed_separate_activity_3fcd64',
                          )}
                        </option>
                      )}
                  </select>
                )}
              </CandidateInspector>
            ))}
          {batch.status === 'DRAFT' ? (
            <div className="investment-actions">
              <label>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />{' '}
                {tr(
                  'investment_imports:i_confirm_this_brokerage_account_and_reviewed_ac_74dedc',
                )}{' '}
              </label>
              <Button
                disabled={!confirmed || !batch.ready || write.isPending}
                onClick={() =>
                  void update(`/${batch.id}/confirm`, 'POST', {
                    preview_token: batch.preview_token,
                    account_confirmed: true,
                  })
                }
              >
                {tr('investment_imports:confirm_brokerage_import_99188e')}
              </Button>
            </div>
          ) : (
            <p role="status">
              {' '}
              {tr('investment_imports:imported__55e557')}{' '}
              {batch.counts.imported}{' '}
              {tr('investment_imports:_duplicates__e9325e')}{' '}
              {batch.counts.duplicate}{' '}
              {tr('investment_imports:_skipped__fcd5d9')} {batch.counts.skipped}
            </p>
          )}
        </>
      )}
      <SectionHeader
        title={tr('investment_imports:brokerage_import_history_1fe8e7')}
      />
      {history.data?.map((b) => (
        <div className="investment-actions" key={b.id}>
          <button onClick={() => void update('/' + b.id, 'GET')}>
            {b.filename}
          </button>
          <span className="metadata">{ui(b.status)}</span>
        </div>
      ))}
    </section>
  )
}
