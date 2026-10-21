import { useState } from 'react'
import { readRoute } from '@/lib/navigation'
import { WorkflowSteps } from '@/components/section-navigation'
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
}: {
  accounts: Account[]
  categories: Category[]
}) {
  const client = useQueryClient()
  const [batchId, setBatchId] = useState<string | null>(() =>
    readRoute().params.get('batch'),
  )
  const [file, setFile] = useState<File | null>(null)
  const [accountId, setAccountId] = useState(
    accounts.find((a) => a.active)?.id ?? '',
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
      throw new Error('Choose a file and target account.')
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
      <PageHeader
        title="Imports"
        description="Local CSV and OFX statements. Review first; nothing posts on upload."
      />
      <WorkflowSteps
        steps={['Choose file', 'Map columns', 'Review and resolve', 'Confirm']}
        current={
          batch.data?.status === 'COMPLETED'
            ? 3
            : batchId
              ? 2
              : headers.length
                ? 1
                : 0
        }
      />
      {(error || operation.isError) && (
        <ErrorState text={error || operation.error!.message} />
      )}
      {batchId ? (
        batch.isPending ? (
          <LoadingState text="Loading import…" />
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
              <h2>1. File and target account</h2>
              <div className="filter-bar">
                <Field label="Statement file">
                  <input
                    type="file"
                    accept=".csv,.ofx"
                    onChange={(e) => {
                      setFile(e.target.files?.[0] ?? null)
                      setHeaders([])
                      setSample([])
                    }}
                  />
                </Field>
                <Field label="Target account">
                  <select
                    required
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                  >
                    <option value="">Choose account</option>
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
                Maximum 2 MiB / 2,000 rows. Files stay on this machine. Bank
                identifiers are masked; you must confirm the destination.
              </p>
              {!file && (
                <p className="metadata">
                  Choose a statement to see its format and mapping options.
                </p>
              )}
              {file && csv && (
                <>
                  <h2 className="mt-4">2. CSV format and mapping</h2>
                  <div className="filter-bar">
                    <Field label="Saved profile">
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
                        <option value="">New mapping</option>
                        {profiles.data?.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Delimiter">
                      <select
                        value={config.delimiter}
                        onChange={(e) =>
                          configure('delimiter', e.target.value as ',' | ';')
                        }
                      >
                        <option value=",">Comma</option>
                        <option value=";">Semicolon</option>
                      </select>
                    </Field>
                    <Field label="Encoding">
                      <select
                        value={config.encoding}
                        onChange={(e) =>
                          configure(
                            'encoding',
                            e.target.value as CSVConfiguration['encoding'],
                          )
                        }
                      >
                        <option value="utf-8-sig">UTF-8 / BOM</option>
                        <option value="cp1252">Windows-1252</option>
                      </select>
                    </Field>
                    <Field label="Header row">
                      <select
                        value={String(config.has_header)}
                        onChange={(e) =>
                          configure('has_header', e.target.value === 'true')
                        }
                      >
                        <option value="true">First row contains headers</option>
                        <option value="false">No header</option>
                      </select>
                    </Field>
                    <Field label="Date format">
                      <select
                        value={config.date_format}
                        onChange={(e) =>
                          configure(
                            'date_format',
                            e.target.value as CSVConfiguration['date_format'],
                          )
                        }
                      >
                        <option value="%Y-%m-%d">YYYY-MM-DD</option>
                        <option value="%d/%m/%Y">DD/MM/YYYY</option>
                        <option value="%m/%d/%Y">MM/DD/YYYY</option>
                      </select>
                    </Field>
                    <Field label="Decimal separator">
                      <select
                        value={config.decimal_separator}
                        onChange={(e) =>
                          configure(
                            'decimal_separator',
                            e.target.value as '.' | ',',
                          )
                        }
                      >
                        <option value=".">Point (12.50)</option>
                        <option value=",">Comma (12,50)</option>
                      </select>
                    </Field>
                    <Field label="Thousands separator">
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
                        <option value="">None</option>
                        <option value=".">Point</option>
                        <option value=",">Comma</option>
                      </select>
                    </Field>
                    <Field label="Amount convention">
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
                        <option value="signed">Negative = outgoing</option>
                        <option value="reversed">Positive = outgoing</option>
                        <option value="type">
                          Positive amount + type column
                        </option>
                        <option value="debit_credit">
                          Separate debit and credit
                        </option>
                      </select>
                    </Field>
                    <Field label="Source namespace (for bank IDs)">
                      <input
                        maxLength={120}
                        placeholder="Stable bank/export identifier"
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
                    Inspect columns
                  </Button>
                  {headers.length > 0 && (
                    <>
                      <div className="table-scroll mt-3">
                        <table>
                          <caption className="sr-only">Source sample</caption>
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
                          <Field label={`Map ${label(field)}`} key={field}>
                            <select
                              value={config.columns[field] ?? ''}
                              onChange={(e) => {
                                const columns = { ...config.columns }
                                if (e.target.value === '') delete columns[field]
                                else columns[field] = Number(e.target.value)
                                setConfig({ ...config, columns })
                              }}
                            >
                              <option value="">Not mapped</option>
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
                    <Field label="Profile name">
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
                      {profileId ? 'Update profile' : 'Save profile'}
                    </Button>
                    {profileId && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (
                            window.confirm(
                              'Delete this mapping profile? Import history is retained.',
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
                        Delete profile
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
                Preview transactions
              </Button>
            </fieldset>
          </form>
        </>
      )}
      <section className="mt-6">
        <h2>Import history</h2>
        {history.isPending ? (
          <LoadingState text="Loading imports…" />
        ) : history.isError ? (
          <ErrorState
            text={history.error.message}
            retry={() => void history.refetch()}
          />
        ) : !history.data.length ? (
          <EmptyState
            title="No imports yet"
            detail="Choose a local statement to begin."
          />
        ) : (
          <div className="table-scroll">
            <table>
              <caption className="sr-only">Import history</caption>
              <thead>
                <tr>
                  <th>File</th>
                  <th>Account</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Imported / linked</th>
                  <th>Duplicates / errors</th>
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
                        Open import
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
            Previous imports
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={(history.data?.length ?? 0) < 50}
            onClick={() => setOffset(offset + 50)}
          >
            Next imports
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
    <section>
      <div className="section-header">
        <h2>
          {completed ? 'Import summary' : '3. Review and confirm'} ·{' '}
          {batch.filename}
        </h2>
        <Button variant="outline" disabled={busy} onClick={onBack}>
          {batch.source_type === 'GMAIL'
            ? 'Back to Gmail queue'
            : completed
              ? 'New import'
              : 'Back to file / mapping'}
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
          New income:{' '}
          <Money value={batch.incoming} currency={account?.currency ?? 'BRL'} />{' '}
          · New expenses:{' '}
          <Money value={batch.outgoing} currency={account?.currency ?? 'BRL'} />
          . Linking does not change balances. Confirmation does not mark
          transactions reviewed.
        </p>
      )}
      <div className="table-scroll mt-3">
        <table>
          <caption className="sr-only">Import preview rows</caption>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description / source</th>
              <th>Payee / category</th>
              <th className="text-right">Amount</th>
              <th>Status / decision</th>
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
                      'Invalid row'}
                  </span>
                  <details className="metadata">
                    <summary>Original source · row {row.row_number}</summary>
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
                      Rule: {r.rule_name} · {label(r.field)}
                    </small>
                  ))}
                </td>
                <td>
                  {payees.data?.find((p) => p.id === row.candidate?.payee_id)
                    ?.name ??
                    row.candidate?.payee_name ??
                    (row.candidate?.payee_id ? 'Assigned payee' : '—')}
                  <small className="block metadata">
                    {categories.find((c) => c.id === row.candidate?.category_id)
                      ?.name ?? 'Uncategorized'}
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
                      Schedule: {s.name} · {s.due_date} · {label(s.status)}
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
                      Review row {row.row_number}
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
          Previous rows
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
          Next rows
        </Button>
      </div>
      {editing && batch.rows.some((r) => r.id === editing) && (
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
      )}
      {!completed && (
        <div className="mt-4">
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I confirm this statement belongs to {account?.name} and have
            reviewed the import decisions.
          </label>
          {!batch.ready && (
            <p role="status" className="metadata">
              Resolve possible duplicates, schedules and ambiguous
              classifications; explicitly skip invalid rows.
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
            Confirm import
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
      <h3>Review row {row.row_number}</h3>
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
        {row.reason}. Metadata choices preserve the original source and never
        change amounts.
      </p>
      <fieldset disabled={busy} className="filter-bar">
        <Field label="Row action">
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
            <option value="SKIP">Skip row</option>
            {valid && (
              <option value="NEW">
                Import as new {row.candidate?.transaction_type.toLowerCase()}
              </option>
            )}
            {valid && row.status !== 'CONFLICT' && row.matches.length > 0 && (
              <option value="LINK">Link existing transaction</option>
            )}
          </select>
        </Field>
        {decision.action === 'LINK' && (
          <Field label="Existing transaction">
            <select
              required
              value={decision.transaction_id ?? ''}
              onChange={(e) =>
                setDecision({ ...decision, transaction_id: e.target.value })
              }
            >
              <option value="">Choose transaction</option>
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
            <Field label="Category">
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
                <option value="">Uncategorized</option>
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
            <Field label="Review status">
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
                <option value="NEEDS_REVIEW">Needs review</option>
                <option value="REVIEWED">Reviewed</option>
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
                />
                I confirm this is a new ordinary{' '}
                {row.candidate?.transaction_type.toLowerCase()}, not an already
                recorded payment or internal transfer.
              </label>
            )}
          </>
        )}
        {decision.action !== 'SKIP' &&
          row.schedules.some((s) => s.status === 'EXPECTED') && (
            <Field label="Optional schedule match">
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
                <option value="">Do not complete a schedule</option>
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
        <Button type="submit">Save row decision</Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Close review
        </Button>
      </fieldset>
    </form>
  )
}
