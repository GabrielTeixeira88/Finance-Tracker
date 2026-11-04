import { lazy, Suspense, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { t } from '@/lib/i18n'
import { getLocale } from '@/lib/preferences'
import { navigateTo, useRoute } from '@/lib/navigation'
import { request, localDate, type Account } from '@/lib/api'
import { assetSchema } from '@/lib/investments'
import { exactFormData } from '@/lib/localized-number'
import {
  pluggyKinds,
  pluggyRequest,
  itemSchema,
  resourceSchema,
  statusSchema,
  adoptionSchema,
  discoverySchema,
  providerText,
  type PluggyKind,
  type PluggyResource,
} from '@/lib/pluggy'
import { Field } from '@/components/forms'
import {
  PageHeader,
  SectionHeader,
  Money,
  LoadingState,
  ErrorState,
  EmptyState,
  Badge,
} from '@/components/primitives'
import { DetailDrawer } from '@/components/detail-drawer'
import { Button } from '@/components/ui/button'
import './pluggy.css'

// No third-party connection UI is loaded until the user explicitly opens it.
const PluggyConnect = lazy(() =>
  import('react-pluggy-connect').then((m) => ({ default: m.PluggyConnect })),
)

export function PluggySettings({ accounts }: { accounts: Account[] }) {
  const route = useRoute(),
    client = useQueryClient()
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const [connect, setConnect] = useState<{
    token: string
    external?: string
  } | null>(null)
  const [sandbox, setSandbox] = useState(false)
  const [discovered, setDiscovered] = useState<z.infer<typeof discoverySchema>>(
    [],
  )
  const [focused, setFocused] = useState<PluggyResource | null>(null)
  const [mapping, setMapping] = useState<PluggyResource | null>(null)
  const [investReview, setInvestReview] = useState<PluggyResource | null>(null)
  const selected = route.params.get('item') || ''
  const kind = pluggyKinds.includes(route.params.get('kind') as PluggyKind)
    ? (route.params.get('kind') as PluggyKind)
    : 'ACCOUNT'
  const offsetText = route.params.get('offset') || '0'
  const offset = /^\d{1,6}$/.test(offsetText) ? parseInt(offsetText, 10) : 0
  const change = (values: Record<string, string>) =>
    navigateTo('Settings', undefined, {
      ...Object.fromEntries(route.params),
      view: 'pluggy',
      ...values,
    })
  const status = useQuery({
    queryKey: ['pluggy', 'status'],
    queryFn: async () => statusSchema.parse(await pluggyRequest('/status')),
  })
  const items = useQuery({
    queryKey: ['pluggy', 'items'],
    queryFn: async () =>
      z.array(itemSchema).parse(await pluggyRequest('/items')),
  })
  const item = items.data?.find((i) => i.id === selected)
  const resources = useQuery({
    queryKey: ['pluggy', selected, kind, offset],
    enabled: !!item,
    queryFn: async () =>
      z.array(resourceSchema).parse(
        await pluggyRequest(
          '/resources?' +
            new URLSearchParams({
              item_id: selected,
              kind,
              offset: String(offset),
            }),
        ),
      ),
  })
  const assets = useQuery({
    queryKey: ['investments', 'assets'],
    enabled: !!mapping && mapping.kind === 'INVESTMENT',
    queryFn: async () =>
      z.array(assetSchema).parse(await request('/investments/assets')),
  })
  const reviews = useQuery({
    queryKey: ['pluggy', 'reviews'],
    queryFn: async () =>
      z
        .array(
          z.object({
            id: z.string(),
            filename: z.string(),
            source_type: z.string(),
            status: z.string(),
          }),
        )
        .parse(await pluggyRequest('/reviews')),
  })
  async function perform(path: string, data?: unknown, method?: string) {
    setError('')
    setBusy(true)
    try {
      const result = await pluggyRequest(path, data, method)
      await client.invalidateQueries({ queryKey: ['pluggy'] })
      return result
    } catch (e) {
      setError(e instanceof Error ? e.message : t('pluggy:failed'))
      throw e
    } finally {
      setBusy(false)
    }
  }
  function action(path: string, data?: unknown, method?: string) {
    void perform(path, data, method).catch(() => undefined)
  }
  async function openConnection(reconnect = false) {
    try {
      const data = z
        .object({ access_token: z.string() })
        .parse(
          await perform(
            '/connect-token',
            reconnect && item ? { item_id: item.id } : {},
          ),
        )
      setConnect({
        token: data.access_token,
        external: reconnect ? item?.external_id : undefined,
      })
    } catch {
      /* Visible error, no token persistence. */
    }
  }
  function openReview(id: string, investment: boolean) {
    navigateTo(investment ? 'Investments' : 'Transactions', undefined, {
      view: investment ? 'Imports' : 'imports',
      batch: id,
    })
  }
  async function credentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget,
      fields = new FormData(form)
    try {
      await perform(
        '/credentials',
        {
          client_id: fields.get('client_id'),
          client_secret: fields.get('client_secret'),
          acknowledge_external_processing: fields.get('acknowledge') === 'on',
        },
        'PUT',
      )
    } catch {
      /* Do not retain secrets in React or mutation/query caches. */
    } finally {
      form.reset()
    }
  }
  return (
    <section className="pluggy-workspace">
      <PageHeader
        title={t('pluggy:title')}
        description={t('pluggy:description')}
      />
      <p className="integration-notice">{t('pluggy:privacy')}</p>
      {error && <ErrorState text={error} />}
      {status.isError && (
        <ErrorState
          text={status.error.message}
          retry={() => void status.refetch()}
        />
      )}
      {status.data?.error && (
        <p role="status" className="metadata">
          {status.data.error}
        </p>
      )}
      <details open={!status.data?.configured} className="pluggy-configuration">
        <summary>{t('pluggy:credentials')}</summary>
        <form onSubmit={credentials} autoComplete="off">
          <fieldset className="form-grid" disabled={busy}>
            <Field label={t('pluggy:client_id')}>
              <input
                name="client_id"
                required
                maxLength={256}
                autoComplete="off"
              />
            </Field>
            <Field label={t('pluggy:client_secret')}>
              <input
                type="password"
                name="client_secret"
                required
                maxLength={2048}
                autoComplete="new-password"
              />
            </Field>
            <label className="checkbox-label">
              <input type="checkbox" name="acknowledge" required />
              {t('pluggy:acknowledge')}
            </label>
            <Button type="submit">{t('pluggy:save_credentials')}</Button>
          </fieldset>
        </form>
        {status.data?.configured && (
          <Button
            disabled={busy}
            variant="outline"
            onClick={() => {
              if (window.confirm(t('pluggy:forget_confirm')))
                action('/credentials', undefined, 'DELETE')
            }}
          >
            {t('pluggy:forget')}
          </Button>
        )}
      </details>
      <div className="pluggy-actions">
        <Button
          disabled={busy || !status.data?.configured}
          onClick={() => void openConnection()}
        >
          {t('pluggy:connect')}
        </Button>
        <Button
          disabled={busy || !status.data?.configured}
          variant="outline"
          onClick={async () => {
            try {
              setDiscovered(
                discoverySchema.parse(await perform('/discover', {})),
              )
            } catch {
              /* Visible error. */
            }
          }}
        >
          {t('pluggy:discover')}
        </Button>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={sandbox}
            onChange={(e) => setSandbox(e.target.checked)}
          />
          {t('pluggy:sandbox')}
        </label>
      </div>
      <form
        className="pluggy-existing"
        onSubmit={async (e) => {
          e.preventDefault()
          const form = e.currentTarget
          try {
            const value = adoptionSchema.parse(
              await perform('/items', {
                external_id: new FormData(form).get('external_id'),
              }),
            )
            change({ item: value.id, offset: '0' })
            form.reset()
          } catch {
            /* Visible error. */
          }
        }}
      >
        <Field label={t('pluggy:existing_item')}>
          <input
            name="external_id"
            required
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
        </Field>
        <Button disabled={busy || !status.data?.configured} variant="outline">
          {t('pluggy:attach')}
        </Button>
      </form>
      {!!discovered.length && (
        <ul>
          {discovered.map((r) => (
            <li key={r.external_id}>
              <Button
                disabled={busy}
                variant="ghost"
                onClick={async () => {
                  try {
                    const result = adoptionSchema.parse(
                      await perform('/items', { external_id: r.external_id }),
                    )
                    change({ item: result.id, offset: '0' })
                  } catch {
                    /* Visible error. */
                  }
                }}
              >
                {r.name} / {r.status}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {items.isPending ? (
        <LoadingState />
      ) : items.isError ? (
        <ErrorState text={items.error.message} />
      ) : !items.data.length ? (
        <EmptyState title={t('pluggy:no_items')} />
      ) : (
        <>
          <Field label={t('pluggy:connection')}>
            <select
              value={selected}
              onChange={(e) => change({ item: e.target.value, offset: '0' })}
            >
              <option value="">{t('pluggy:choose_connection')}</option>
              {items.data.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} / {r.status}
                </option>
              ))}
            </select>
          </Field>
          {selected && !item && <EmptyState title={t('pluggy:missing_item')} />}
          {item && (
            <>
              <SectionHeader
                title={item.name}
                detail={item.last_sync || t('pluggy:never_synced')}
              >
                <Badge>
                  {item.status}
                  {item.paused ? ' / ' + t('pluggy:paused') : ''}
                </Badge>
              </SectionHeader>
              {item.error && <p role="status">{item.error}</p>}
              {!!item.warnings.length && (
                <ul className="metadata">
                  {item.warnings.map((w, i) => (
                    <li key={i}>
                      {w.product}: {w.code}
                    </li>
                  ))}
                </ul>
              )}
              <div className="pluggy-actions">
                <Button
                  disabled={busy || item.paused || !status.data?.configured}
                  onClick={() => action(`/items/${item.id}/sync`, {})}
                >
                  {t('pluggy:sync')}
                </Button>
                <Button
                  disabled={busy || !status.data?.configured}
                  variant="outline"
                  onClick={() => action(`/items/${item.id}/refresh`, {})}
                >
                  {t('pluggy:refresh_bank')}
                </Button>
                <Button
                  disabled={busy || !status.data?.configured}
                  variant="ghost"
                  onClick={() => void openConnection(true)}
                >
                  {t('pluggy:reconnect')}
                </Button>
                <Button
                  disabled={busy || item.status === 'REVOKED'}
                  variant="ghost"
                  onClick={() =>
                    action(
                      `/items/${item.id}`,
                      { paused: !item.paused },
                      'PATCH',
                    )
                  }
                >
                  {t(item.paused ? 'pluggy:resume' : 'pluggy:pause')}
                </Button>
                <Button
                  disabled={busy || item.status === 'REVOKED'}
                  variant="destructive"
                  onClick={() => {
                    if (
                      window.confirm(
                        t('pluggy:revoke_confirm', { name: item.name }),
                      )
                    )
                      action(`/items/${item.id}/revoke`, {
                        confirm_external_id: item.external_id,
                      })
                  }}
                >
                  {t('pluggy:revoke')}
                </Button>
              </div>
              <p className="metadata">{t('pluggy:refresh_explanation')}</p>
              <Field label={t('pluggy:product')}>
                <select
                  value={kind}
                  onChange={(e) =>
                    change({ kind: e.target.value, offset: '0' })
                  }
                >
                  {pluggyKinds.map((k) => (
                    <option key={k} value={k}>
                      {t(`pluggy:kind_${k}`)}
                    </option>
                  ))}
                </select>
              </Field>
              {resources.isPending ? (
                <LoadingState />
              ) : resources.isError ? (
                <ErrorState
                  text={resources.error.message}
                  retry={() => void resources.refetch()}
                />
              ) : !resources.data.length ? (
                <EmptyState title={t('pluggy:no_resources')} />
              ) : (
                <div className="table-scroll">
                  <table>
                    <caption className="sr-only">
                      {t(`pluggy:kind_${kind}`)}
                    </caption>
                    <thead>
                      <tr>
                        <th>{t('pluggy:record')}</th>
                        <th>{t('pluggy:date')}</th>
                        <th className="amount-cell">
                          {t('pluggy:provider_amount')}
                        </th>
                        <th>{t('pluggy:local_mapping')}</th>
                        <th>{t('pluggy:actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resources.data.map((r) => {
                        const amount =
                          providerText(r, 'balance') ||
                          providerText(r, 'amount') ||
                          providerText(r, 'totalAmount')
                        const currency =
                          providerText(r, 'currencyCode') ||
                          providerText(r, 'totalAmountCurrencyCode')
                        return (
                          <tr key={r.id}>
                            <td>
                              <button
                                className="text-action"
                                onClick={() => setFocused(r)}
                              >
                                {providerText(r, 'name') ||
                                  providerText(r, 'descriptionRaw') ||
                                  providerText(r, 'description') ||
                                  r.external_id}
                              </button>
                              <small className="metadata block">
                                {providerText(r, 'status') ||
                                  providerText(r, 'type')}
                              </small>
                            </td>
                            <td>
                              {(
                                providerText(r, 'date') ||
                                providerText(r, 'dueDate') ||
                                providerText(r, 'expiresAt')
                              ).slice(0, 10)}
                            </td>
                            <td className="amount-cell">
                              {amount &&
                              /^-?\d+(\.\d+)?$/.test(amount) &&
                              /^[A-Z]{3}$/.test(currency) ? (
                                <Money value={amount} currency={currency} />
                              ) : (
                                amount || '-'
                              )}
                            </td>
                            <td>
                              {accounts.find((a) => a.id === r.account_id)
                                ?.name || '-'}
                            </td>
                            <td>
                              {['ACCOUNT', 'INVESTMENT'].includes(r.kind) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setMapping(r)}
                                >
                                  {t('pluggy:map')}
                                </Button>
                              )}
                              {r.account_id && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    r.kind === 'ACCOUNT'
                                      ? setFocused(r)
                                      : setInvestReview(r)
                                  }
                                >
                                  {t('pluggy:prepare_review')}
                                </Button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="pagination">
                <Button
                  variant="ghost"
                  disabled={!offset}
                  onClick={() =>
                    change({ offset: String(Math.max(0, offset - 50)) })
                  }
                >
                  {t('pluggy:previous')}
                </Button>
                <Button
                  variant="ghost"
                  disabled={(resources.data?.length || 0) < 50}
                  onClick={() => change({ offset: String(offset + 50) })}
                >
                  {t('pluggy:next')}
                </Button>
              </div>
            </>
          )}
        </>
      )}
      {!!reviews.data?.length && (
        <section>
          <SectionHeader title={t('pluggy:reviews')} />
          <ul>
            {reviews.data.map((r) => (
              <li key={r.id}>
                <Button
                  variant="ghost"
                  onClick={() =>
                    openReview(r.id, r.source_type === 'PLUGGY_INVESTMENT')
                  }
                >
                  {r.filename} / {r.status}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {focused && (
        <DetailDrawer
          title={t('pluggy:evidence')}
          onClose={() => setFocused(null)}
        >
          <p className="metadata">{t('pluggy:observation_only')}</p>
          <pre className="pluggy-evidence">
            {JSON.stringify(focused.data, null, 2)}
          </pre>
          <ObservationHistory resource={focused} />
          {focused.kind === 'ACCOUNT' && focused.account_id && (
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                const fields = new FormData(e.currentTarget)
                try {
                  const result = adoptionSchema.parse(
                    await perform(`/resources/${focused.id}/review`, {
                      start: fields.get('start'),
                      end: fields.get('end'),
                    }),
                  )
                  openReview(result.id, false)
                } catch {
                  /* Visible error. */
                }
              }}
            >
              <fieldset disabled={busy} className="form-grid">
                <Field label={t('pluggy:from')}>
                  <input
                    type="date"
                    name="start"
                    required
                    max={localDate()}
                    defaultValue={localDate().slice(0, 7) + '-01'}
                  />
                </Field>
                <Field label={t('pluggy:to')}>
                  <input
                    type="date"
                    name="end"
                    required
                    max={localDate()}
                    defaultValue={localDate()}
                  />
                </Field>
                <Button>{t('pluggy:prepare_review')}</Button>
              </fieldset>
            </form>
          )}
        </DetailDrawer>
      )}
      {mapping && (
        <DetailDrawer
          title={t('pluggy:local_mapping')}
          onClose={() => setMapping(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              const fields = new FormData(e.currentTarget)
              try {
                await perform(
                  `/resources/${mapping.id}/mapping`,
                  {
                    account_id: fields.get('account_id'),
                    asset_id: fields.get('asset_id') || null,
                  },
                  'PUT',
                )
                setMapping(null)
              } catch {
                /* Visible error. */
              }
            }}
          >
            <p className="metadata">{t('pluggy:mapping_explanation')}</p>
            <fieldset disabled={busy} className="form-grid">
              <Field label={t('pluggy:local_account')}>
                <select
                  name="account_id"
                  defaultValue={mapping.account_id || ''}
                  required
                >
                  <option value="">{t('pluggy:choose_account')}</option>
                  {accounts
                    .filter(
                      (a) =>
                        a.active &&
                        a.currency === providerText(mapping, 'currencyCode') &&
                        (mapping.kind === 'INVESTMENT'
                          ? a.type === 'INVESTMENT'
                          : providerText(mapping, 'type') === 'CREDIT'
                            ? a.type === 'CREDIT_CARD'
                            : ['CHECKING', 'SAVINGS', 'CASH'].includes(a.type)),
                    )
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </select>
              </Field>
              {mapping.kind === 'INVESTMENT' && (
                <Field label={t('pluggy:local_asset')}>
                  <select
                    name="asset_id"
                    defaultValue={mapping.asset_id || ''}
                    required
                  >
                    <option value="">{t('pluggy:choose_asset')}</option>
                    {assets.data
                      ?.filter(
                        (a) =>
                          a.currency === providerText(mapping, 'currencyCode'),
                      )
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.symbol} / {a.name}
                        </option>
                      ))}
                  </select>
                </Field>
              )}
              <Button>{t('pluggy:save_mapping')}</Button>
            </fieldset>
          </form>
        </DetailDrawer>
      )}
      {investReview && (
        <DetailDrawer
          title={t('pluggy:investment_review')}
          onClose={() => setInvestReview(null)}
        >
          <InvestmentReview
            resource={investReview}
            submit={async (activities) => {
              const value = adoptionSchema.parse(
                await perform(
                  `/resources/${investReview.id}/investment-review`,
                  { activities },
                ),
              )
              openReview(value.id, true)
            }}
            busy={busy}
          />
        </DetailDrawer>
      )}
      {connect && (
        <Suspense fallback={<LoadingState />}>
          <PluggyConnect
            connectToken={connect.token}
            updateItem={connect.external}
            includeSandbox={sandbox}
            products={[
              'ACCOUNTS',
              'CREDIT_CARDS',
              'TRANSACTIONS',
              'INVESTMENTS',
              'INVESTMENTS_TRANSACTIONS',
              'IDENTITY',
              'LOANS',
              'PAYMENT_DATA',
            ]}
            language={getLocale().split('-')[0]}
            theme={
              document.documentElement.dataset.theme === 'light'
                ? 'light'
                : 'dark'
            }
            onClose={() => setConnect(null)}
            onError={() => {
              setConnect(null)
              setError(t('pluggy:connect_failed'))
            }}
            onLoadError={() => {
              setConnect(null)
              setError(t('pluggy:connect_failed'))
            }}
            onSuccess={async (value) => {
              setConnect(null)
              try {
                const event = z
                  .object({ item: z.object({ id: z.string().uuid() }) })
                  .parse(value)
                const result = adoptionSchema.parse(
                  await perform('/items', { external_id: event.item.id }),
                )
                change({ item: result.id, offset: '0' })
              } catch {
                setError(t('pluggy:connect_failed'))
              }
            }}
          />
        </Suspense>
      )}
    </section>
  )
}

function InvestmentReview({
  resource,
  submit,
  busy,
}: {
  resource: PluggyResource
  submit: (
    activities: { resource_id: string; fees: string; taxes: string }[],
  ) => Promise<void>
  busy: boolean
}) {
  const [error, setError] = useState('')
  const [offset, setOffset] = useState(0)
  const query = useQuery({
    queryKey: ['pluggy', 'investment-review', resource.id, offset],
    queryFn: async () =>
      z.array(resourceSchema).parse(
        await pluggyRequest(
          '/resources?' +
            new URLSearchParams({
              item_id: resource.item_id,
              kind: 'INVESTMENT_TRANSACTION',
              parent_id: resource.external_id,
              offset: String(offset),
              limit: '50',
            }),
        ),
      ),
  })
  if (query.isPending) return <LoadingState />
  if (query.isError) return <ErrorState text={query.error.message} />
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        setError('')
        const data = new FormData(e.currentTarget)
        const exact = exactFormData(e.currentTarget)
        const selected = query.data.filter(
          (r) => data.get('select-' + r.id) === 'on',
        )
        if (!selected.length) {
          setError(t('pluggy:select_activities'))
          return
        }
        try {
          await submit(
            selected.map((r) => ({
              resource_id: r.id,
              fees: String(exact.get('fees-' + r.id) || ''),
              taxes: String(exact.get('taxes-' + r.id) || ''),
            })),
          )
        } catch (e) {
          setError(e instanceof Error ? e.message : t('pluggy:failed'))
        }
      }}
    >
      <p className="metadata">{t('pluggy:charges_explanation')}</p>
      {error && <ErrorState text={error} />}
      <fieldset disabled={busy}>
        {query.data.map((r) => (
          <div className="pluggy-activity" key={r.id}>
            <label>
              <input type="checkbox" name={'select-' + r.id} />
              {(providerText(r, 'tradeDate') || providerText(r, 'date')).slice(
                0,
                10,
              )}{' '}
              / {providerText(r, 'type')} / {providerText(r, 'amount')}
            </label>
            <Field label={t('pluggy:fees')}>
              <input name={'fees-' + r.id} inputMode="decimal" />
            </Field>
            <Field label={t('pluggy:taxes')}>
              <input name={'taxes-' + r.id} inputMode="decimal" />
            </Field>
            <details className="pluggy-activity-evidence">
              <summary>{t('pluggy:evidence')}</summary>
              <pre className="pluggy-evidence">
                {JSON.stringify(r.data, null, 2)}
              </pre>
            </details>
          </div>
        ))}
        <label className="checkbox-label">
          <input type="checkbox" required />
          {t('pluggy:verify_charges')}
        </label>
        <Button>{t('pluggy:prepare_review')}</Button>
      </fieldset>
      <div className="pagination">
        <Button
          type="button"
          variant="ghost"
          disabled={!offset}
          onClick={() => setOffset(Math.max(0, offset - 50))}
        >
          {t('pluggy:previous')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={query.data.length < 50}
          onClick={() => setOffset(offset + 50)}
        >
          {t('pluggy:next')}
        </Button>
      </div>
    </form>
  )
}

function ObservationHistory({ resource }: { resource: PluggyResource }) {
  const [open, setOpen] = useState(false)
  const [offset, setOffset] = useState(0)
  const history = useQuery({
    queryKey: ['pluggy', 'observations', resource.id, offset],
    enabled: open,
    queryFn: async () =>
      z
        .array(
          z.object({
            id: z.string(),
            created_at: z.string(),
            data: z.record(z.string(), z.unknown()),
          }),
        )
        .parse(
          await pluggyRequest(
            `/resources/${resource.id}/observations?offset=${offset}`,
          ),
        ),
  })
  return (
    <details onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{t('pluggy:observation_history')}</summary>
      {open &&
        (history.isPending ? (
          <LoadingState />
        ) : history.isError ? (
          <ErrorState text={history.error.message} />
        ) : (
          <>
            {history.data.map((r) => (
              <details key={r.id}>
                <summary>{r.created_at}</summary>
                <pre className="pluggy-evidence">
                  {JSON.stringify(r.data, null, 2)}
                </pre>
              </details>
            ))}
            <div className="pagination">
              <Button
                type="button"
                variant="ghost"
                disabled={!offset}
                onClick={() => setOffset(Math.max(0, offset - 50))}
              >
                {t('pluggy:previous')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={history.data.length < 50}
                onClick={() => setOffset(offset + 50)}
              >
                {t('pluggy:next')}
              </Button>
            </div>
          </>
        ))}
    </details>
  )
}
