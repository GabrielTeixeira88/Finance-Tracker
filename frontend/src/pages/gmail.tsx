import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Field } from '@/components/forms'
import { Button } from '@/components/ui/button'
import {
  PageHeader,
  ErrorState,
  LoadingState,
  EmptyState,
  Money,
} from '@/components/primitives'
import { request, type Account, type Category } from '@/lib/api'
import {
  getGmail,
  getLabels,
  getQueue,
  getRuns,
  gmailRequest,
  type GmailConnection,
} from '@/lib/gmail'
import { type ImportBatch } from '@/lib/ingestion-api'
import { ImportReview } from './import-workspace'

function useGmailAction() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSettled: () => client.invalidateQueries(),
  })
}

export function GmailSettings({ accounts }: { accounts: Account[] }) {
  const status = useQuery({
    queryKey: ['gmail'],
    queryFn: getGmail,
    refetchInterval: 3000,
  })
  const runs = useQuery({
    queryKey: ['gmail-runs'],
    queryFn: getRuns,
    refetchInterval: 3000,
  })
  const action = useGmailAction()
  const [authorization, setAuthorization] = useState('')
  return (
    <>
      <PageHeader
        title="Gmail integration"
        description="Read selected notifications locally. Review before posting."
      />
      <p className="metadata">
        Google read-only permission covers your mailbox. The selected label is
        an application filter, not an OAuth permission boundary. Finance Tracker
        never modifies or sends mail.
      </p>
      {status.isPending ? (
        <LoadingState text="Loading Gmail settings…" />
      ) : status.isError ? (
        <ErrorState text={status.error.message} />
      ) : (
        <>
          <div className="section-header mt-4">
            <h2>{status.data.mailbox ?? 'No Gmail connection'}</h2>
            <span>{status.data.status.replaceAll('_', ' ')}</span>
          </div>
          <p className="metadata">
            Pending candidates: {status.data.pending} · Last attempt:{' '}
            {status.data.last_attempt ?? 'Never'} · Last success:{' '}
            {status.data.last_success ?? 'Never'}
          </p>
          {(action.isError || status.data.error) && (
            <ErrorState
              text={
                action.error?.message ?? status.data.error!.replaceAll('_', ' ')
              }
            />
          )}
          {!status.data.configured && (
            <p className="mt-3">
              Configure a Google Desktop OAuth client in the backend environment
              first. See the Gmail setup guide in docs/GMAIL.md. Credentials
              never belong in this form.
            </p>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            <Button
              disabled={
                !status.data.configured ||
                action.isPending ||
                !!status.data.active_run
              }
              onClick={() =>
                action.mutate(async () => {
                  const result = (await gmailRequest('/connect', {})) as {
                    authorization_url: string
                  }
                  if (
                    !result.authorization_url.startsWith(
                      'https://accounts.google.com/o/oauth2/v2/auth?',
                    )
                  )
                    throw new Error('Invalid authorization URL')
                  setAuthorization(result.authorization_url)
                })
              }
            >
              {status.data.status === 'DISCONNECTED'
                ? 'Connect Gmail'
                : 'Reconnect Gmail'}
            </Button>
            {authorization && (
              <a
                href={authorization}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Continue to Google authorization
              </a>
            )}
            <Button
              variant="outline"
              disabled={action.isPending || !!status.data.active_run}
              onClick={() =>
                action.mutate(async () => {
                  await gmailRequest('/disconnect', {})
                  setAuthorization('')
                })
              }
            >
              Disconnect
            </Button>
            {status.data.active_run && (
              <Button
                variant="outline"
                onClick={() => action.mutate(() => gmailRequest('/cancel', {}))}
              >
                Cancel synchronization
              </Button>
            )}
          </div>
          {status.data.status === 'CONNECTED' && (
            <GmailConfiguration
              key={`${status.data.mailbox}-${status.data.label_id}`}
              connection={status.data}
              accounts={accounts}
            />
          )}
          <p className="metadata mt-4">
            Parser: Synthetic Bank v1 (fictional notifications only). Real bank
            templates are not yet verified. Unsupported emails stay unposted.
            Automatic posting is disabled.
          </p>
          <p className="metadata">
            Polling runs only while this local backend is open. Disconnect
            removes local tokens and attempts revocation; imported history is
            retained.
          </p>
        </>
      )}
      <h2 className="mt-4">Sync history</h2>
      {runs.isError ? (
        <ErrorState text={runs.error.message} />
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Started</th>
                <th>Mode</th>
                <th>Status</th>
                <th>Recorded</th>
                <th>Already seen</th>
                <th>Diagnostic</th>
              </tr>
            </thead>
            <tbody>
              {runs.data?.map((r) => (
                <tr key={r.id}>
                  <td>{r.created_at}</td>
                  <td>{r.mode}</td>
                  <td>{r.status}</td>
                  <td>{r.processed}</td>
                  <td>{r.duplicates}</td>
                  <td>{r.error?.replaceAll('_', ' ') ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function GmailConfiguration({
  connection,
  accounts,
}: {
  connection: GmailConnection
  accounts: Account[]
}) {
  const labels = useQuery({
    queryKey: ['gmail-labels'],
    queryFn: getLabels,
    retry: false,
  })
  const [labelId, setLabelId] = useState(connection.label_id ?? '')
  const [accountId, setAccountId] = useState(connection.account_id ?? '')
  const [senders, setSenders] = useState(connection.senders.join(', '))
  const [interval, setInterval] = useState(String(connection.polling_minutes))
  const [today] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [start, setStart] = useState(
    () =>
      connection.backfill_start ??
      new Date(Date.now() - 30 * 86400000).toLocaleDateString('en-CA'),
  )
  const [end, setEnd] = useState(connection.backfill_end ?? today)
  const action = useGmailAction()
  return (
    <section className="mt-4">
      <h2>Label, account and bounded backfill</h2>
      {(labels.isError || action.isError) && (
        <ErrorState text={labels.error?.message ?? action.error!.message} />
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          action.mutate(() =>
            gmailRequest(
              '/configuration',
              {
                label_id: labelId,
                account_id: accountId,
                senders: senders
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
                polling_minutes: parseInt(interval),
                paused: true,
                start,
                end,
              },
              'PUT',
            ),
          )
        }}
      >
        <fieldset
          disabled={action.isPending || !!connection.active_run}
          className="filter-bar"
        >
          <Field label="Gmail label">
            <select
              required
              value={labelId}
              onChange={(e) => setLabelId(e.target.value)}
            >
              <option value="">Choose label</option>
              {labels.data?.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Default target account">
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
          <Field label="Sender allowlist (comma separated)">
            <input
              value={senders}
              onChange={(e) => setSenders(e.target.value)}
            />
          </Field>
          <Field label="Backfill from">
            <input
              type="date"
              required
              value={start}
              max={end}
              onChange={(e) => setStart(e.target.value)}
            />
          </Field>
          <Field label="Backfill through">
            <input
              type="date"
              required
              value={end}
              min={start}
              max={today}
              onChange={(e) => setEnd(e.target.value)}
            />
          </Field>
          <Field label="Polling interval">
            <select
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
            >
              {[
                ['0', 'Manual only'],
                ['1', 'Every minute'],
                ['5', 'Every 5 minutes'],
                ['15', 'Every 15 minutes'],
              ].map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Button type="submit">Save configuration</Button>
        </fieldset>
      </form>
      <p className="metadata">
        Maximum 90 days per backfill. Saving pauses polling; review the first
        sync before enabling it. History expiry triggers a bounded recovery and
        is recorded in sync history.
      </p>
      <div className="flex gap-2 mt-3">
        <Button
          disabled={
            action.isPending || !!connection.active_run || !connection.label_id
          }
          onClick={() => action.mutate(() => gmailRequest('/sync', {}))}
        >
          {connection.active_run
            ? 'Synchronizing…'
            : 'Sync now / initial backfill'}
        </Button>
        <Button
          variant="outline"
          disabled={
            action.isPending || !connection.label_id || interval === '0'
          }
          onClick={() =>
            action.mutate(() =>
              gmailRequest('/polling', { paused: !connection.paused }),
            )
          }
        >
          {connection.paused ? 'Enable polling' : 'Pause polling'}
        </Button>
      </div>
    </section>
  )
}

export function GmailQueue({
  accounts,
  categories,
}: {
  accounts: Account[]
  categories: Category[]
}) {
  const [offset, setOffset] = useState(0)
  const [completed, setCompleted] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [opened, setOpened] = useState<string | null>(null)
  const queue = useQuery({
    queryKey: ['gmail-queue', offset, completed],
    queryFn: () => getQueue(offset, completed),
  })
  const action = useGmailAction()
  const batch = queue.data?.find((b) => b.id === opened)
  const run = async (fn: () => Promise<unknown>) => {
    try {
      await action.mutateAsync(fn)
    } catch {
      /* mutation error rendered below */
    }
  }
  const approve = (batches: ImportBatch[]) =>
    gmailRequest('/approve', {
      items: batches.map((b) => ({
        batch_id: b.id,
        preview_token: b.preview_token,
      })),
    })
  return (
    <>
      <PageHeader
        title="Gmail review"
        description="Email candidates do not affect balances until you confirm. Configure the connection in Settings → Gmail."
      />
      {action.isError && <ErrorState text={action.error.message} />}
      {queue.isPending ? (
        <LoadingState text="Loading Gmail candidates…" />
      ) : queue.isError ? (
        <ErrorState text={queue.error.message} />
      ) : batch ? (
        <>
          {!completed &&
            batch.rows[0]?.candidate &&
            batch.rows[0].raw.link_only !== 'yes' && (
              <CandidateEditor
                batch={batch}
                accounts={accounts}
                onSave={(data) =>
                  run(() =>
                    gmailRequest(`/candidates/${batch.id}`, data, 'PUT'),
                  )
                }
                busy={action.isPending}
              />
            )}
          <ImportReview
            batch={batch}
            accounts={accounts}
            categories={categories}
            busy={action.isPending}
            onBack={() => setOpened(null)}
            onDecision={(row, decision) =>
              run(() =>
                request(`/imports/${batch.id}/rows/${row.id}`, {
                  method: 'PATCH',
                  body: JSON.stringify(decision),
                }),
              )
            }
            onConfirm={() =>
              run(async () => {
                await approve([batch])
                setOpened(null)
                setSelected([])
              })
            }
          />
        </>
      ) : (
        <>
          <div className="filter-bar">
            <label>
              <input
                type="checkbox"
                checked={completed}
                onChange={(e) => {
                  setCompleted(e.target.checked)
                  setOffset(0)
                  setSelected([])
                }}
              />{' '}
              Show completed
            </label>
            <Button variant="outline" onClick={() => void queue.refetch()}>
              Refresh queue
            </Button>
            <span>{selected.length} selected on this page</span>
            <Button
              disabled={!selected.length || action.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    `Approve ${selected.length} selected candidates into their shown accounts?`,
                  )
                )
                  void run(async () => {
                    await approve(
                      queue.data.filter((b) => selected.includes(b.id)),
                    )
                    setSelected([])
                  })
              }}
            >
              Approve selected
            </Button>
          </div>
          {!queue.data.length ? (
            <EmptyState
              title="No Gmail candidates"
              detail="Run synchronization from Settings, or switch between pending and completed records."
            />
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Select</th>
                    <th>Date</th>
                    <th>Description / parser</th>
                    <th>Account</th>
                    <th>Category</th>
                    <th className="text-right">Amount</th>
                    <th>Review status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.data.map((b) => {
                    const row = b.rows[0]
                    const eligible =
                      b.ready &&
                      row.status === 'NEW' &&
                      !row.candidate?.ambiguity &&
                      !row.schedules.length &&
                      !completed
                    return (
                      <tr key={b.id}>
                        <td>
                          <input
                            aria-label={`Select ${row.candidate?.description ?? 'notification'}`}
                            type="checkbox"
                            disabled={!eligible}
                            checked={selected.includes(b.id)}
                            onChange={(e) =>
                              setSelected(
                                e.target.checked
                                  ? [...selected, b.id]
                                  : selected.filter((id) => id !== b.id),
                              )
                            }
                          />
                        </td>
                        <td>{row.candidate?.transaction_date ?? '—'}</td>
                        <td>
                          {row.candidate?.description ??
                            'Unrecognized notification'}
                          <small className="block metadata">
                            {row.raw.parser ?? 'Parser unavailable'} ·{' '}
                            {row.raw.parser_version}
                          </small>
                        </td>
                        <td>
                          {accounts.find((a) => a.id === b.account_id)?.name}
                        </td>
                        <td>
                          {categories.find(
                            (c) => c.id === row.candidate?.category_id,
                          )?.name ?? 'Uncategorized'}
                        </td>
                        <td className="text-right">
                          {row.candidate && (
                            <Money
                              value={row.candidate.amount}
                              currency={row.candidate.currency}
                            />
                          )}
                        </td>
                        <td>
                          {row.status}
                          <small className="block metadata">
                            {row.errors.join(' · ') ||
                              row.candidate?.ambiguity ||
                              row.reason}
                          </small>
                        </td>
                        <td>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setOpened(b.id)}
                          >
                            Review notification
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex gap-2 mt-3">
            <Button
              variant="outline"
              disabled={!offset}
              onClick={() => {
                setOffset(offset - 25)
                setSelected([])
              }}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={queue.data.length < 25}
              onClick={() => {
                setOffset(offset + 25)
                setSelected([])
              }}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </>
  )
}

function CandidateEditor({
  batch,
  accounts,
  onSave,
  busy,
}: {
  batch: ImportBatch
  accounts: Account[]
  onSave: (data: unknown) => Promise<void>
  busy: boolean
}) {
  const original = batch.rows[0].candidate!
  const [accountId, setAccountId] = useState(batch.account_id)
  const [description, setDescription] = useState(original.description)
  const [day, setDay] = useState(original.transaction_date)
  const [amount, setAmount] = useState(original.amount)
  const [type, setType] = useState(original.transaction_type)
  return (
    <details className="mb-4">
      <summary>Edit proposed financial details</summary>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void onSave({
            account_id: accountId,
            candidate: {
              transaction_date: day,
              description,
              amount,
              currency: original.currency,
              transaction_type: type,
              category_id: original.category_id,
              payee_id: original.payee_id,
            },
          })
        }}
      >
        <fieldset disabled={busy} className="filter-bar">
          <Field label="Candidate account">
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              {accounts
                .filter((a) => a.active && a.currency === original.currency)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Candidate description">
            <input
              required
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <Field label="Candidate date">
            <input
              required
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </Field>
          <Field label="Candidate amount">
            <input
              required
              inputMode="decimal"
              pattern="[0-9]+([.][0-9]{1,6})?"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="Candidate type">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
            >
              <option value="EXPENSE">Expense</option>
              <option value="INCOME">Income</option>
            </select>
          </Field>
          <Button type="submit">Save proposed details</Button>
        </fieldset>
      </form>
      <p className="metadata">
        Original parsed fields remain in source provenance. Categories and
        payees are editable through Review row.
      </p>
    </details>
  )
}
