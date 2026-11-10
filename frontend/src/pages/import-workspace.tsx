import { CandidateInspector } from '@/components/candidate-inspector'
import { t as tr, ui } from '@/lib/i18n'
import { useState } from 'react'
import { readRoute } from '@/lib/navigation'
import { WizardStepIndicator } from '@/features/activities/import/wizard-step-indicator'
import { FileDropzone } from '@/features/activities/import/file-dropzone'
import '@/features/holdings/i18n'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { Field } from '@/components/forms'
import { PayeePicker } from '@/components/payee-picker'
import { Button } from '@/components/ui/button'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Money,
  PageHeader,
} from '@/components/primitives'
import {
  getPayees,
  label,
  request,
  type Account,
  type Category,
} from '@/lib/api'
import {
  batchSchema,
  defaultConfiguration,
  fileContent,
  getImport,
  getImports,
  getProfiles,
  type CSVConfiguration,
  type ImportBatch,
  type ImportDecision,
  type ImportRow,
} from '@/lib/ingestion-api'

export default function ImportWorkspace({
  accounts,
  categories,
  embedded = false,
  initialAccount,
}: {
  accounts: Account[]
  categories: Category[]
  embedded?: boolean
  initialAccount?: string
}) {
  const client = useQueryClient()
  const [batchId, setBatchId] = useState<string | null>(() =>
    readRoute().params.get('batch'),
  )
  const [file, setFile] = useState<File | null>(null)
  const [accountId, setAccountId] = useState(
    initialAccount ?? accounts.find((a) => a.active)?.id ?? '',
  )
  const [config, setConfig] = useState<CSVConfiguration>(defaultConfiguration)
  const [headers, setHeaders] = useState<string[]>([])
  const [sample, setSample] = useState<string[][]>([])
  const [profileId, setProfileId] = useState('')
  const [profileName, setProfileName] = useState('')
  const [offset, setOffset] = useState(0)
  const [error, setError] = useState('')
  const profiles = useQuery({
    queryKey: ['import-profiles'],
    queryFn: getProfiles,
  })
  const history = useQuery({
    queryKey: ['imports', offset],
    queryFn: () => getImports(offset),
  })
  const batch = useQuery({
    queryKey: ['import', batchId],
    queryFn: () => getImport(batchId!),
    enabled: !!batchId,
    retry: false,
  })
  const operation = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
    onSuccess: async () => {
      await client.invalidateQueries()
    },
    onError: async () => {
      await client.invalidateQueries({ queryKey: ['import', batchId] })
    },
  })
  const run = async (fn: () => Promise<unknown>) => {
    setError('')
    try {
      await operation.mutateAsync(fn)
    } catch (e) {
      setError((e as Error).message)
    }
  }
  const send = (path: string, data: unknown, method = 'POST') =>
    request(path, { method, body: JSON.stringify(data) })
  const payload = async () => {
    if (!file || !accountId)
      throw new Error(ui('Choose a file and target account.'))
    return {
      filename: file.name,
      content_base64: await fileContent(file),
      source_type: file.name.toLowerCase().endsWith('.ofx') ? 'OFX' : 'CSV',
      account_id: accountId,
      configuration: config,
    }
  }
  const csv = !file?.name.toLowerCase().endsWith('.ofx')
  const configure = <K extends keyof CSVConfiguration>(
    key: K,
    value: CSVConfiguration[K],
  ) => {
    setConfig({ ...config, [key]: value })
    setHeaders([])
    setSample([])
  }
  return (
    <>
      {!embedded && (
        <PageHeader
          title={tr('import_workspace:imports_e42328')}
          description={tr(
            'import_workspace:local_csv_and_ofx_statements_review_first_nothin_396f25',
          )}
        />
      )}
      <WizardStepIndicator
        steps={[
          'Choose file',
          'Map columns',
          'Review and resolve',
          'Confirm',
        ].map((name, index) => ({ id: String(index), label: ui(name) }))}
        currentStep={String(
          batch.data?.status === 'COMPLETED'
            ? 3
            : batchId
              ? 2
              : headers.length
                ? 1
                : 0,
        )}
      />
      {(error || operation.isError) && (
        <ErrorState text={error || operation.error!.message} />
      )}
      {batchId ? (
        batch.isPending ? (
          <LoadingState text={tr('import_workspace:loading_import__5976c1')} />
        ) : batch.isError ? (
          <ErrorState
            text={batch.error.message}
            retry={() => void batch.refetch()}
          />
        ) : (
          <ImportReview
            key={batchId}
            batch={batch.data!}
            accounts={accounts}
            categories={categories}
            busy={operation.isPending}
            onBack={() => setBatchId(null)}
            onDecision={(row, decision) =>
              run(() =>
                send(`/imports/${batchId}/rows/${row.id}`, decision, 'PATCH'),
              )
            }
            onConfirm={() =>
              run(async () => {
                const result = batchSchema.parse(
                  await send(`/imports/${batchId}/confirm`, {
                    preview_token: batch.data!.preview_token,
                    account_confirmed: true,
                  }),
                )
                client.setQueryData(['import', batchId], result)
              })
            }
          />
        )
      ) : (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void run(async () => {
                const result = batchSchema.parse(
                  await send('/imports', await payload()),
                )
                client.setQueryData(['import', result.id], result)
                setBatchId(result.id)
              })
            }}
          >
            <fieldset disabled={operation.isPending} className="editor-surface">
              <h2>{tr('import_workspace:1_file_and_target_account_ea258b')}</h2>
              <div className="filter-bar">
                <Field label={tr('import_workspace:statement_file_e29c9d')}>
                  <FileDropzone
                    file={file}
                    accept=".csv,.ofx"
                    acceptedLabel={tr('import_workspace:statement_file_e29c9d')}
                    isLoading={operation.isPending}
                    onFileChange={(file) => {
                      setFile(file)
                      setHeaders([])
                      setSample([])
                    }}
                  />
                </Field>
                <Field label={tr('import_workspace:target_account_17a8da')}>
                  <select
                    required
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                  >
                    <option value="">
                      {tr('import_workspace:choose_account_9ccef0')}
                    </option>
                    {accounts
                      .filter((a) => a.active)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} · {a.currency}
                        </option>
                      ))}
                  </select>
                </Field>
              </div>
              <p className="metadata">
                {tr(
                  'import_workspace:maximum_2_mib_2_000_rows_files_stay_on_this_mach_a9c126',
                )}
              </p>
              {!file && (
                <p className="metadata">
                  {tr(
                    'import_workspace:choose_a_statement_to_see_its_format_and_mapping_d70c03',
                  )}
                </p>
              )}
              {file && csv && (
                <>
                  <h2 className="mt-4">
                    {tr('import_workspace:2_csv_format_and_mapping_2a2da4')}
                  </h2>
                  <div className="filter-bar">
                    <Field label={tr('import_workspace:saved_profile_3c7f9c')}>
                      <select
                        value={profileId}
                        onChange={(e) => {
                          setProfileId(e.target.value)
                          const p = profiles.data?.find(
                            (p) => p.id === e.target.value,
                          )
                          if (p) {
                            setConfig(p.configuration)
                            setProfileName(p.name)
                            if (p.default_account_id)
                              setAccountId(p.default_account_id)
                          }
                          setHeaders([])
                          setSample([])
                        }}
                      >
                        <option value="">
                          {tr('import_workspace:new_mapping_8a1a5f')}
                        </option>
                        {profiles.data?.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={tr('import_workspace:delimiter_5e96ff')}>
                      <select
                        value={config.delimiter}
                        onChange={(e) =>
                          configure('delimiter', e.target.value as ',' | ';')
                        }
                      >
                        <option value=",">
                          {tr('import_workspace:comma_b9ee3d')}
                        </option>
                        <option value=";">
                          {tr('import_workspace:semicolon_727cec')}
                        </option>
                      </select>
                    </Field>
                    <Field label={tr('import_workspace:encoding_5821fe')}>
                      <select
                        value={config.encoding}
                        onChange={(e) =>
                          configure(
                            'encoding',
                            e.target.value as CSVConfiguration['encoding'],
                          )
                        }
                      >
                        <option value="utf-8-sig">
                          {tr('import_workspace:utf_8_bom_e9fefe')}
                        </option>
                        <option value="cp1252">
                          {tr('import_workspace:windows_1252_694498')}
                        </option>
                      </select>
                    </Field>
                    <Field label={tr('import_workspace:header_row_c27655')}>
                      <select
                        value={String(config.has_header)}
                        onChange={(e) =>
                          configure('has_header', e.target.value === 'true')
                        }
                      >
                        <option value="true">
                          {tr(
                            'import_workspace:first_row_contains_headers_33f8a8',
                          )}
                        </option>
                        <option value="false">
                          {tr('import_workspace:no_header_323b0a')}
                        </option>
                      </select>
                    </Field>
                    <Field label={tr('import_workspace:date_format_94ee88')}>
                      <select
                        value={config.date_format}
                        onChange={(e) =>
                          configure(
                            'date_format',
                            e.target.value as CSVConfiguration['date_format'],
                          )
                        }
                      >
                        <option value="%Y-%m-%d">
                          {tr('import_workspace:yyyy_mm_dd_d3f8f7')}
                        </option>
                        <option value="%d/%m/%Y">
                          {tr('import_workspace:dd_mm_yyyy_5d95ad')}
                        </option>
                        <option value="%m/%d/%Y">
                          {tr('import_workspace:mm_dd_yyyy_119c60')}
                        </option>
                      </select>
                    </Field>
                    <Field
                      label={tr('import_workspace:decimal_separator_f2ea84')}
                    >
                      <select
                        value={config.decimal_separator}
                        onChange={(e) =>
                          configure(
                            'decimal_separator',
                            e.target.value as '.' | ',',
                          )
                        }
                      >
                        <option value=".">
                          {tr('import_workspace:point_12_50__f3f5d2')}
                        </option>
                        <option value=",">
                          {tr('import_workspace:comma_12_50__c25862')}
                        </option>
                      </select>
                    </Field>
                    <Field
                      label={tr('import_workspace:thousands_separator_c8f9d9')}
                    >
                      <select
                        value={config.thousands_separator}
                        onChange={(e) =>
                          configure(
                            'thousands_separator',
                            e.target
                              .value as CSVConfiguration['thousands_separator'],
                          )
                        }
                      >
                        <option value="">
                          {tr('import_workspace:none_6eef66')}
                        </option>
                        <option value=".">
                          {tr('import_workspace:point_f79a28')}
                        </option>
                        <option value=",">
                          {tr('import_workspace:comma_b9ee3d')}
                        </option>
                      </select>
                    </Field>
                    <Field
                      label={tr('import_workspace:amount_convention_c9e19e')}
                    >
                      <select
                        value={config.amount_mode}
                        onChange={(e) => {
                          const mode = e.target
                            .value as CSVConfiguration['amount_mode']
                          const columns = { ...config.columns }
                          delete columns.amount
                          delete columns.debit
                          delete columns.credit
                          if (mode === 'debit_credit') {
                            columns.debit = 2
                            columns.credit = 3
                          } else columns.amount = 2
                          if (mode === 'type') columns.type = 3
                          configure('amount_mode', mode)
                          setConfig({ ...config, amount_mode: mode, columns })
                        }}
                      >
                        <option value="signed">
                          {tr('import_workspace:negative_outgoing_658efe')}
                        </option>
                        <option value="reversed">
                          {tr('import_workspace:positive_outgoing_fed0dd')}
                        </option>
                        <option value="type">
                          {tr(
                            'import_workspace:positive_amount_type_column_dcf26c',
                          )}
                        </option>
                        <option value="debit_credit">
                          {tr(
                            'import_workspace:separate_debit_and_credit_bb2c92',
                          )}
                        </option>
                      </select>
                    </Field>
                    <Field
                      label={tr(
                        'import_workspace:source_namespace_for_bank_ids__6e50e0',
                      )}
                    >
                      <input
                        maxLength={120}
                        placeholder={tr(
                          'import_workspace:stable_bank_export_identifier_9534bf',
                        )}
                        value={config.source_namespace}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            source_namespace: e.target.value,
                          })
                        }
                      />
                    </Field>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      void run(async () => {
                        const data = z
                          .object({
                            headers: z.array(z.string()),
                            sample: z.array(z.array(z.string())),
                          })
                          .parse(
                            await send('/imports/inspect', await payload()),
                          )
                        setHeaders(data.headers)
                        setSample(data.sample)
                      })
                    }
                  >
                    {tr('import_workspace:inspect_columns_f27872')}
                  </Button>
                  {headers.length > 0 && (
                    <>
                      <div className="table-scroll mt-3">
                        <table>
                          <caption className="sr-only">
                            {tr('import_workspace:source_sample_0c0a4f')}
                          </caption>
                          <thead>
                            <tr>
                              {headers.map((h, i) => (
                                <th key={i}>
                                  {i + 1}. {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sample.map((row, i) => (
                              <tr key={i}>
                                {row.map((v, j) => (
                                  <td key={j}>{v}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="filter-bar">
                        {[
                          'date',
                          'description',
                          ...(config.amount_mode === 'debit_credit'
                            ? ['debit', 'credit']
                            : ['amount']),
                          'currency',
                          'external_id',
                          'type',
                        ].map((field) => (
                          <Field
                            label={tr('messages:message_3410bc39c4fb', {
                              value0: label(field),
                            })}
                            key={field}
                          >
                            <select
                              value={config.columns[field] ?? ''}
                              onChange={(e) => {
                                const columns = { ...config.columns }
                                if (e.target.value === '') delete columns[field]
                                else columns[field] = Number(e.target.value)
                                setConfig({ ...config, columns })
                              }}
                            >
                              <option value="">
                                {tr('import_workspace:not_mapped_fe85da')}
                              </option>
                              {headers.map((h, i) => (
                                <option key={i} value={i}>
                                  {i + 1}. {h}
                                </option>
                              ))}
                            </select>
                          </Field>
                        ))}
                      </div>
                    </>
                  )}
                  <div className="filter-bar mt-3">
                    <Field label={tr('import_workspace:profile_name_775747')}>
                      <input
                        maxLength={120}
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                      />
                    </Field>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!profileName.trim()}
                      onClick={() =>
                        void run(() =>
                          send(
                            `/imports/profiles${profileId ? `/${profileId}` : ''}`,
                            {
                              name: profileName,
                              configuration: config,
                              default_account_id: accountId || null,
                            },
                            profileId ? 'PUT' : 'POST',
                          ),
                        )
                      }
                    >
                      {profileId
                        ? tr('dynamic:update_profile_837b6d')
                        : tr('dynamic:save_profile_f597c0')}
                    </Button>
                    {profileId && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (
                            window.confirm(
                              tr(
                                'dynamic:delete_this_mapping_profile_import_history_is_re_106ce9',
                              ),
                            )
                          )
                            void run(async () => {
                              await request(`/imports/profiles/${profileId}`, {
                                method: 'DELETE',
                              })
                              setProfileId('')
                              setProfileName('')
                            })
                        }}
                      >
                        {tr('import_workspace:delete_profile_7035d2')}
                      </Button>
                    )}
                  </div>
                </>
              )}
              <Button
                className="mt-4"
                type="submit"
                disabled={!file || !accountId || (csv && !headers.length)}
              >
                {tr('import_workspace:preview_transactions_72f34a')}
              </Button>
            </fieldset>
          </form>
        </>
      )}
      <section className="mt-6">
        <h2>{tr('import_workspace:import_history_e0d1de')}</h2>
        {history.isPending ? (
          <LoadingState text={tr('import_workspace:loading_imports__8028cb')} />
        ) : history.isError ? (
          <ErrorState
            text={history.error.message}
            retry={() => void history.refetch()}
          />
        ) : !history.data.length ? (
          <EmptyState
            title={tr('import_workspace:no_imports_yet_c2f9d8')}
            detail={tr(
              'import_workspace:choose_a_local_statement_to_begin__3363e1',
            )}
          />
        ) : (
          <div className="table-scroll">
            <table>
              <caption className="sr-only">
                {tr('import_workspace:import_history_e0d1de')}
              </caption>
              <thead>
                <tr>
                  <th>{tr('import_workspace:file_2c3caf')}</th>
                  <th>{tr('import_workspace:account_85dfa3')}</th>
                  <th>{tr('import_workspace:date_eb9a4b')}</th>
                  <th>{tr('import_workspace:status_bae7d5')}</th>
                  <th>{tr('import_workspace:imported_linked_e39b2f')}</th>
                  <th>{tr('import_workspace:duplicates_errors_170aa1')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {history.data.map((b) => (
                  <tr key={b.id}>
                    <td>
                      {b.filename}
                      <small className="block metadata">{b.source_type}</small>
                    </td>
                    <td>{accounts.find((a) => a.id === b.account_id)?.name}</td>
                    <td>{b.created_at.slice(0, 10)}</td>
                    <td>{label(b.status)}</td>
                    <td>
                      {b.counts.imported ?? 0} / {b.counts.linked ?? 0}
                    </td>
                    <td>
                      {b.counts.duplicate ?? 0} / {b.counts.error ?? 0}
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setBatchId(b.id)}
                      >
                        {tr('import_workspace:open_import_21904d')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex gap-2 mt-3">
          <Button
            size="sm"
            variant="outline"
            disabled={!offset}
            onClick={() => setOffset(Math.max(0, offset - 50))}
          >
            {tr('import_workspace:previous_imports_d460e8')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={(history.data?.length ?? 0) < 50}
            onClick={() => setOffset(offset + 50)}
          >
            {tr('import_workspace:next_imports_3a65c8')}
          </Button>
        </div>
      </section>
    </>
  )
}

export function ImportReview({
  batch,
  accounts,
  categories,
  busy,
  onBack,
  onDecision,
  onConfirm,
}: {
  batch: ImportBatch
  accounts: Account[]
  categories: Category[]
  busy: boolean
  onBack: () => void
  onDecision: (row: ImportRow, decision: ImportDecision) => Promise<void>
  onConfirm: () => Promise<void>
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [confirmed, setConfirmed] = useState(false)
  const payees = useQuery({
    queryKey: ['payees', ''],
    queryFn: () => getPayees(''),
  })
  const completed = batch.status === 'COMPLETED'
  const account = accounts.find((a) => a.id === batch.account_id)
  return (
    <section
      className={
        editing ? 'candidate-review has-inspector' : 'candidate-review'
      }
    >
      <div className="section-header">
        <h2>
          {completed
            ? tr('dynamic:import_summary_2f1bd4')
            : tr('dynamic:3_review_and_confirm_cae3e8')}{' '}
          · {batch.filename}
        </h2>
        <Button variant="outline" disabled={busy} onClick={onBack}>
          {batch.source_type === 'GMAIL'
            ? tr('dynamic:back_to_gmail_queue_7c9117')
            : completed
              ? tr('dynamic:new_import_36e5c0')
              : tr('dynamic:back_to_file_mapping_7a374c')}
        </Button>
      </div>
      <p>
        {account?.name} · {account?.currency}{' '}
        {batch.source_context.account_hint} {batch.source_context.institution}
      </p>
      {batch.source_context.warnings.map((w) => (
        <p key={w} className="metadata">
          {w}
        </p>
      ))}
      <p className="metadata mt-2">
        {Object.entries(batch.counts)
          .map(([key, value]) => `${label(key)}: ${value}`)
          .join(' · ')}
      </p>
      {!completed && (
        <p className="metadata">
          {' '}
          {tr('import_workspace:new_income__d36434')}{' '}
          <Money value={batch.incoming} currency={account?.currency ?? 'BRL'} />{' '}
          {tr('import_workspace:_new_expenses__80c78b')}{' '}
          <Money value={batch.outgoing} currency={account?.currency ?? 'BRL'} />{' '}
          {tr(
            'import_workspace:_linking_does_not_change_balances_confirmation_d_2871a7',
          )}{' '}
        </p>
      )}
      <div className="table-scroll mt-3">
        <table>
          <caption className="sr-only">
            {tr('import_workspace:import_preview_rows_f0cb91')}
          </caption>
          <thead>
            <tr>
              <th>{tr('import_workspace:date_eb9a4b')}</th>
              <th>{tr('import_workspace:description_source_a40fc7')}</th>
              <th>{tr('import_workspace:payee_category_f3b907')}</th>
              <th className="text-right">
                {tr('import_workspace:amount_43dc85')}
              </th>
              <th>{tr('import_workspace:status_decision_cc70cd')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {batch.rows.slice(page * 50, page * 50 + 50).map((row) => (
              <tr key={row.id}>
                <td>
                  {row.candidate?.transaction_date ?? row.raw.date ?? '—'}
                </td>
                <td>
                  <span>
                    {row.candidate?.description ??
                      row.raw.description ??
                      tr('dynamic:invalid_row_20400a')}
                  </span>
                  <details className="metadata">
                    <summary>
                      {' '}
                      {tr('import_workspace:original_source_row_65206e')}{' '}
                      {row.row_number}
                    </summary>
                    {Object.entries(row.raw)
                      .filter(([key]) => key !== 'external_id')
                      .map(([k, v]) => (
                        <div key={k}>
                          {label(k)}: {v}
                        </div>
                      ))}
                  </details>
                  {row.rules.map((r, i) => (
                    <small className="block metadata" key={i}>
                      {' '}
                      {tr('import_workspace:rule__90deab')} {r.rule_name} ·{' '}
                      {label(r.field)}
                    </small>
                  ))}
                </td>
                <td>
                  {payees.data?.find((p) => p.id === row.candidate?.payee_id)
                    ?.name ??
                    row.candidate?.payee_name ??
                    (row.candidate?.payee_id
                      ? tr('dynamic:assigned_payee_02110c')
                      : '—')}
                  <small className="block metadata">
                    {categories.find((c) => c.id === row.candidate?.category_id)
                      ?.name ?? tr('dynamic:uncategorized_4ef7d7')}
                  </small>
                </td>
                <td className="text-right tabular-nums">
                  {row.candidate && (
                    <>
                      <small className="block metadata">
                        {label(row.candidate.transaction_type)}
                      </small>
                      <Money
                        value={row.candidate.amount}
                        currency={row.candidate.currency}
                      />
                    </>
                  )}
                </td>
                <td>
                  <span>{label(row.status)}</span>
                  <small className="block metadata">
                    {row.decision.action
                      ? label(row.decision.action)
                      : row.reason}
                  </small>
                  {row.errors.map((e) => (
                    <p key={e} className="metadata">
                      {e}
                    </p>
                  ))}
                  {row.candidate?.ambiguity && (
                    <p className="metadata">{row.candidate.ambiguity}</p>
                  )}
                  {row.schedules.map((s) => (
                    <p
                      className="metadata"
                      key={`${s.schedule_id}${s.due_date}`}
                    >
                      {' '}
                      {tr('import_workspace:schedule__5810a8')} {s.name} ·{' '}
                      {s.due_date} · {label(s.status)}
                    </p>
                  ))}
                </td>
                <td>
                  {!completed && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => setEditing(row.id)}
                    >
                      {' '}
                      {tr('import_workspace:review_row_c75e99')}{' '}
                      {row.row_number}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2 mt-3">
        <Button
          size="sm"
          variant="outline"
          disabled={!page}
          onClick={() => setPage(page - 1)}
        >
          {tr('import_workspace:previous_rows_c99654')}
        </Button>
        <span className="metadata">
          {page + 1} / {Math.max(1, Math.ceil(batch.rows.length / 50))}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={(page + 1) * 50 >= batch.rows.length}
          onClick={() => setPage(page + 1)}
        >
          {tr('import_workspace:next_rows_c98c10')}
        </Button>
      </div>
      {editing && batch.rows.some((r) => r.id === editing) && (
        <CandidateInspector
          title={tr('import_workspace:review_row_c75e99')}
          onClose={() => setEditing(null)}
        >
          <dl className="source-evidence">
            {Object.entries(batch.rows.find((r) => r.id === editing)!.raw)
              .filter(([key]) => key !== 'external_id')
              .map(([key, value]) => (
                <div key={key}>
                  <dt>{label(key)}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
          </dl>
          <RowEditor
            key={editing}
            row={batch.rows.find((r) => r.id === editing)!}
            categories={categories}
            busy={busy}
            onClose={() => setEditing(null)}
            onSave={(d) =>
              onDecision(
                batch.rows.find((r) => r.id === editing)!,
                d,
              )
            }
          />
        </CandidateInspector>
      )}
      {!completed && (
        <div className="mt-4">
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />{' '}
            {tr('import_workspace:i_confirm_this_statement_belongs_to_956ece')}{' '}
            {account?.name}{' '}
            {tr(
              'import_workspace:and_have_reviewed_the_import_decisions__94fb0d',
            )}{' '}
          </label>
          {!batch.ready && (
            <p role="status" className="metadata">
              {tr(
                'import_workspace:resolve_possible_duplicates_schedules_and_ambigu_a01164',
              )}
            </p>
          )}
          <Button
            className="mt-3"
            disabled={busy || !batch.ready || !confirmed}
            onClick={() => {
              if (
                window.confirm(
                  `Confirm ${batch.counts.ready ?? 0} new transactions and ${batch.counts.linked ?? 0} links? This is one atomic operation.`,
                )
              )
                void onConfirm()
            }}
          >
            {tr('import_workspace:confirm_import_4c63db')}
          </Button>
        </div>
      )}
    </section>
  )
}

function RowEditor({
  row,
  categories,
  busy,
  onClose,
  onSave,
}: {
  row: ImportRow
  categories: Category[]
  busy: boolean
  onClose: () => void
  onSave: (decision: ImportDecision) => Promise<void>
}) {
  const [decision, setDecision] = useState<ImportDecision>({
    ...row.decision,
    action:
      row.decision.action ??
      (['INVALID', 'EXACT_DUPLICATE'].includes(row.status) ? 'SKIP' : 'NEW'),
  })
  const valid = !['INVALID', 'EXACT_DUPLICATE'].includes(row.status)
  return (
    <form
      className="editor-surface mt-4"
      onSubmit={(e) => {
        e.preventDefault()
        void onSave(decision)
      }}
    >
      <h3>
        {' '}
        {tr('import_workspace:review_row_c75e99')} {row.row_number}
      </h3>
      {row.matches
        .filter((match) => match.amount)
        .map((match) => (
          <div key={match.id} className="py-2 text-sm">
            <strong>{match.description}</strong> · {match.transaction_date}{' '}
            {match.amount && match.currency && (
              <Money value={match.amount} currency={match.currency} />
            )}
            <p className="metadata">{match.evidence?.join(' · ')}</p>
          </div>
        ))}
      <p className="metadata">
        {row.reason}{' '}
        {tr(
          'import_workspace:_metadata_choices_preserve_the_original_source_a_6c9ecb',
        )}{' '}
      </p>
      <fieldset disabled={busy} className="filter-bar">
        <Field label={tr('import_workspace:row_action_50dcf8')}>
          <select
            value={decision.action}
            onChange={(e) =>
              setDecision({
                ...decision,
                action: e.target.value as ImportDecision['action'],
                transaction_id:
                  e.target.value === 'LINK' ? row.matches[0]?.id : null,
                schedule_id: null,
                due_date: null,
              })
            }
          >
            <option value="SKIP">
              {tr('import_workspace:skip_row_42c65e')}
            </option>
            {valid && (
              <option value="NEW">
                {' '}
                {tr('import_workspace:import_as_new_1bb772')}{' '}
                {row.candidate?.transaction_type.toLowerCase()}
              </option>
            )}
            {valid && row.status !== 'CONFLICT' && row.matches.length > 0 && (
              <option value="LINK">
                {tr('import_workspace:link_existing_transaction_d8ce89')}
              </option>
            )}
          </select>
        </Field>
        {decision.action === 'LINK' && (
          <Field label={tr('import_workspace:existing_transaction_7774bf')}>
            <select
              required
              value={decision.transaction_id ?? ''}
              onChange={(e) =>
                setDecision({ ...decision, transaction_id: e.target.value })
              }
            >
              <option value="">
                {tr('import_workspace:choose_transaction_1ffa24')}
              </option>
              {row.matches.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.description} · {m.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </Field>
        )}
        {decision.action === 'NEW' && (
          <>
            <Field label={tr('import_workspace:category_a3c686')}>
              <select
                value={
                  decision.category_id === undefined
                    ? (row.candidate?.category_id ?? '')
                    : (decision.category_id ?? '')
                }
                onChange={(e) =>
                  setDecision({
                    ...decision,
                    category_id: e.target.value || null,
                  })
                }
              >
                <option value="">
                  {tr('import_workspace:uncategorized_4ef7d7')}
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <PayeePicker
              initial={
                row.candidate?.payee_id
                  ? {
                      id: row.candidate.payee_id,
                      name: row.candidate.payee_name ?? 'Assigned payee',
                    }
                  : null
              }
              onChange={(id) =>
                setDecision({ ...decision, payee_id: id || null })
              }
            />
            <Field label={tr('import_workspace:review_status_0fe6b8')}>
              <select
                value={
                  decision.review_status ??
                  row.candidate?.review_status ??
                  'NEEDS_REVIEW'
                }
                onChange={(e) =>
                  setDecision({ ...decision, review_status: e.target.value })
                }
              >
                <option value="NEEDS_REVIEW">
                  {tr('import_workspace:needs_review_33a506')}
                </option>
                <option value="REVIEWED">
                  {tr('import_workspace:reviewed_31ef85')}
                </option>
              </select>
            </Field>
            {(row.candidate?.ambiguity ||
              row.schedules.length > 0 ||
              row.status === 'CONFLICT') && (
              <label>
                <input
                  type="checkbox"
                  checked={decision.acknowledge_classification ?? false}
                  onChange={(e) =>
                    setDecision({
                      ...decision,
                      acknowledge_classification: e.target.checked,
                    })
                  }
                />{' '}
                {tr('import_workspace:i_confirm_this_is_a_new_ordinary_cece82')}{' '}
                {row.candidate?.transaction_type.toLowerCase()}{' '}
                {tr(
                  'import_workspace:_not_an_already_recorded_payment_or_internal_tra_d5a90c',
                )}{' '}
              </label>
            )}
          </>
        )}
        {decision.action !== 'SKIP' &&
          row.schedules.some((s) => s.status === 'EXPECTED') && (
            <Field
              label={tr('import_workspace:optional_schedule_match_5046d8')}
            >
              <select
                value={
                  decision.schedule_id
                    ? `${decision.schedule_id}|${decision.due_date}`
                    : ''
                }
                onChange={(e) => {
                  const [id, due] = e.target.value.split('|')
                  setDecision({
                    ...decision,
                    schedule_id: id || null,
                    due_date: due || null,
                  })
                }}
              >
                <option value="">
                  {tr('import_workspace:do_not_complete_a_schedule_aad361')}
                </option>
                {row.schedules
                  .filter((s) => s.status === 'EXPECTED')
                  .map((s) => (
                    <option
                      key={`${s.schedule_id}|${s.due_date}`}
                      value={`${s.schedule_id}|${s.due_date}`}
                    >
                      {s.name} · {s.due_date}
                    </option>
                  ))}
              </select>
            </Field>
          )}
        <Button type="submit">
          {tr('import_workspace:save_row_decision_486302')}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          {tr('import_workspace:close_review_8507ba')}
        </Button>
      </fieldset>
    </form>
  )
}
