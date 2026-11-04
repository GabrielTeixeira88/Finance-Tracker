import { CandidateInspector } from '@/components/candidate-inspector'
import { t as tr, ui } from '@/lib/i18n'
import { useDemoRuntime } from '@/lib/demo-runtime'
import { useState } from 'react'
import { navigateTo } from '@/lib/navigation'
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
        title={tr('gmail:gmail_integration_838691')}
        description={tr(
          'gmail:read_selected_notifications_locally_review_befor_7b151a',
        )}
      >
        <Button
          variant="outline"
          onClick={() =>
            navigateTo('Transactions', undefined, { view: 'gmail' })
          }
        >
          {tr('gmail:open_review_queue_38b8f4')}
        </Button>
      </PageHeader>
      <p className="metadata">
        {tr('gmail:google_read_only_permission_covers_your_mailbox__e5833c')}
      </p>
      {status.isPending ? (
        <LoadingState text={tr('gmail:loading_gmail_settings__0cb396')} />
      ) : status.isError ? (
        <ErrorState
          text={status.error.message}
          retry={() => void status.refetch()}
        />
      ) : (
        <>
          <div className="section-header mt-4">
            <h2>
              {status.data.mailbox ?? tr('dynamic:no_gmail_connection_f24a7a')}
            </h2>
            <span>{status.data.status.replaceAll('_', ' ')}</span>
          </div>
          <p className="metadata">
            {' '}
            {tr('gmail:pending_candidates__179f26')} {status.data.pending}{' '}
            {tr('gmail:_last_attempt__031cd3')}{' '}
            {status.data.last_attempt ?? tr('dynamic:never_80c305')}{' '}
            {tr('gmail:_last_success__d22124')}{' '}
            {status.data.last_success ?? tr('dynamic:never_80c305')}
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
              {tr(
                'gmail:configure_a_google_desktop_oauth_client_in_the_b_5b980f',
              )}
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
                    throw new Error(ui('Invalid authorization URL'))
                  setAuthorization(result.authorization_url)
                })
              }
            >
              {status.data.status === 'DISCONNECTED'
                ? tr('dynamic:connect_gmail_aa27af')
                : tr('dynamic:reconnect_gmail_d89d2e')}
            </Button>
            {authorization && (
              <a
                href={authorization}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {tr('gmail:continue_to_google_authorization_3c46d5')}
              </a>
            )}
            <Button
              variant="destructive"
              disabled={action.isPending || !!status.data.active_run}
              onClick={() => {
                if (
                  !window.confirm(
                    tr(
                      'dynamic:disconnect_gmail_and_remove_its_local_vault_toke_0b29f0',
                    ),
                  )
                )
                  return
                action.mutate(async () => {
                  await gmailRequest('/disconnect', {})
                  setAuthorization('')
                })
              }}
            >
              {tr('gmail:disconnect_ed28e0')}
            </Button>
            {status.data.active_run && (
              <Button
                variant="outline"
                onClick={() => action.mutate(() => gmailRequest('/cancel', {}))}
              >
                {tr('gmail:cancel_synchronization_fa4824')}
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
            {tr(
              'gmail:parser_synthetic_bank_v1_fictional_notifications_4f956a',
            )}
          </p>
          <p className="metadata">
            {tr(
              'gmail:polling_runs_only_while_this_local_backend_is_op_9c4508',
            )}
          </p>
        </>
      )}
      <h2 className="mt-4">{tr('gmail:sync_history_32ccc9')}</h2>
      {runs.isError ? (
        <ErrorState text={runs.error.message} />
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{tr('gmail:started_faa9e7')}</th>
                <th>{tr('gmail:mode_a7b93d')}</th>
                <th>{tr('gmail:status_bae7d5')}</th>
                <th>{tr('gmail:recorded_d5383e')}</th>
                <th>{tr('gmail:already_seen_7705fb')}</th>
                <th>{tr('gmail:diagnostic_852a16')}</th>
              </tr>
            </thead>
            <tbody>
              {runs.data?.map((r) => (
                <tr key={r.id}>
                  <td>{r.created_at}</td>
                  <td>{ui(r.mode)}</td>
                  <td>{ui(r.status)}</td>
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
      <h2>{tr('gmail:label_account_and_bounded_backfill_8c6a77')}</h2>
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
          <Field label={tr('gmail:gmail_label_46963a')}>
            <select
              required
              value={labelId}
              onChange={(e) => setLabelId(e.target.value)}
            >
              <option value="">{tr('gmail:choose_label_e9f241')}</option>
              {labels.data?.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={tr('gmail:default_target_account_3e05cf')}>
            <select
              required
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">{tr('gmail:choose_account_9ccef0')}</option>
              {accounts
                .filter((a) => a.active)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {a.currency}
                  </option>
                ))}
            </select>
          </Field>
          <Field label={tr('gmail:sender_allowlist_comma_separated__b1e2ff')}>
            <input
              value={senders}
              onChange={(e) => setSenders(e.target.value)}
            />
          </Field>
          <Field label={tr('gmail:backfill_from_33c216')}>
            <input
              type="date"
              required
              value={start}
              max={end}
              onChange={(e) => setStart(e.target.value)}
            />
          </Field>
          <Field label={tr('gmail:backfill_through_9169ef')}>
            <input
              type="date"
              required
              value={end}
              min={start}
              max={today}
              onChange={(e) => setEnd(e.target.value)}
            />
          </Field>
          <Field label={tr('gmail:polling_interval_5dc046')}>
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
          <Button type="submit">{tr('gmail:save_configuration_33e5a5')}</Button>
        </fieldset>
      </form>
      <p className="metadata">
        {tr('gmail:maximum_90_days_per_backfill_saving_pauses_polli_4fa58d')}
      </p>
      <div className="flex gap-2 mt-3">
        <Button
          disabled={
            action.isPending || !!connection.active_run || !connection.label_id
          }
          onClick={() => action.mutate(() => gmailRequest('/sync', {}))}
        >
          {connection.active_run
            ? tr('dynamic:synchronizing__72da46')
            : tr('dynamic:sync_now_initial_backfill_fccf10')}
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
          {connection.paused
            ? tr('dynamic:enable_polling_0516d4')
            : tr('dynamic:pause_polling_f60f45')}
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
  const { runtime } = useDemoRuntime()
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
    <div
      className={batch ? 'candidate-review has-inspector' : 'candidate-review'}
    >
      <PageHeader
        title={
          runtime
            ? tr('dynamic:gmail_notification_simulation_cf5d19')
            : tr('dynamic:gmail_review_cfafdb')
        }
        description={
          runtime
            ? tr(
                'dynamic:fictional_parser_candidates_gmail_is_not_connect_b957c9',
              )
            : tr(
                'dynamic:email_candidates_do_not_affect_balances_until_yo_e34440',
              )
        }
      >
        <Button
          variant="outline"
          onClick={() => navigateTo('Settings', undefined, { view: 'gmail' })}
        >
          {runtime
            ? tr('dynamic:simulation_examples_dc34e5')
            : tr('dynamic:connection_settings_618aac')}
        </Button>
      </PageHeader>
      {action.isError && <ErrorState text={action.error.message} />}
      {queue.isPending ? (
        <LoadingState text={tr('gmail:loading_gmail_candidates__abdac8')} />
      ) : queue.isError ? (
        <ErrorState
          text={queue.error.message}
          retry={() => void queue.refetch()}
        />
      ) : (
        <>
          {batch && (
            <CandidateInspector
              title={tr('gmail:review_status_0fe6b8')}
              onClose={() => setOpened(null)}
            >
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
            </CandidateInspector>
          )}
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
              {tr('gmail:show_completed_200034')}{' '}
            </label>
            <Button variant="outline" onClick={() => void queue.refetch()}>
              {tr('gmail:refresh_queue_50c3cf')}
            </Button>
            <span>
              {selected.length} {tr('gmail:selected_on_this_page_66d6f6')}{' '}
            </span>
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
              {tr('gmail:approve_selected_de38bf')}
            </Button>
          </div>
          {!queue.data.length ? (
            <EmptyState
              title={tr('gmail:no_gmail_candidates_dad629')}
              detail={tr(
                'gmail:run_synchronization_from_settings_or_switch_betw_7f4521',
              )}
            />
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{tr('gmail:select_859822')}</th>
                    <th>{tr('gmail:date_eb9a4b')}</th>
                    <th>{tr('gmail:description_parser_ccd1c0')}</th>
                    <th>{tr('gmail:account_85dfa3')}</th>
                    <th>{tr('gmail:category_a3c686')}</th>
                    <th className="text-right">{tr('gmail:amount_43dc85')}</th>
                    <th>{tr('gmail:review_status_0fe6b8')}</th>
                    <th>{tr('gmail:action_97c89a')}</th>
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
                            aria-label={tr('messages:message_4626e95dd5b8', {
                              value0:
                                row.candidate?.description ?? 'notification',
                            })}
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
                            tr('dynamic:unrecognized_notification_2f3135')}
                          <small className="block metadata">
                            {row.raw.parser ??
                              tr('dynamic:parser_unavailable_be5400')}{' '}
                            · {row.raw.parser_version}
                          </small>
                        </td>
                        <td>
                          {accounts.find((a) => a.id === b.account_id)?.name}
                        </td>
                        <td>
                          {categories.find(
                            (c) => c.id === row.candidate?.category_id,
                          )?.name ?? tr('dynamic:uncategorized_4ef7d7')}
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
                          {ui(row.status)}
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
                            {tr('gmail:review_notification_7e9b02')}
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
              {tr('gmail:previous_50f942')}
            </Button>
            <Button
              variant="outline"
              disabled={queue.data.length < 25}
              onClick={() => {
                setOffset(offset + 25)
                setSelected([])
              }}
            >
              {tr('gmail:next_bc9819')}
            </Button>
          </div>
        </>
      )}
    </div>
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
      <summary>{tr('gmail:edit_proposed_financial_details_ae26fc')}</summary>
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
          <Field label={tr('gmail:candidate_account_d233ee')}>
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
          <Field label={tr('gmail:candidate_description_e4925a')}>
            <input
              required
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <Field label={tr('gmail:candidate_date_c88f6c')}>
            <input
              required
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </Field>
          <Field label={tr('gmail:candidate_amount_c657ad')}>
            <input
              required
              inputMode="decimal"
              pattern="[0-9]+([.][0-9]{1,6})?"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label={tr('gmail:candidate_type_5b4c73')}>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
            >
              <option value="EXPENSE">{tr('gmail:expense_a0db8e')}</option>
              <option value="INCOME">{tr('gmail:income_1c89b1')}</option>
            </select>
          </Field>
          <Button type="submit">
            {tr('gmail:save_proposed_details_3ff8d2')}
          </Button>
        </fieldset>
      </form>
      <p className="metadata">
        {tr('gmail:original_parsed_fields_remain_in_source_provenan_59e08e')}
      </p>
    </details>
  )
}
