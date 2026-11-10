// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Wealthfolio 92b4647 settings/asset/assets-page.tsx; existing local security editors are reused.
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getAssets, type Asset } from '@/lib/investments'
import { getDemoDate, localDate } from '@/lib/api'
import { useRoute, updateRouteParams, navigateTo } from '@/lib/navigation'
import { useWrite } from '@/lib/use-write'
import { AssetForm } from '@/pages/investment-forms'
import { SecurityClassification } from '@/pages/investment-analytics'
import { QuoteHistory } from '@/features/holdings/quote-history'
import { getFixedIncome } from '@/lib/fixed-income'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/forms'
import { EmptyState, LoadingState, ErrorState } from '@/components/primitives'
import { DetailDrawer } from '@/components/detail-drawer'
import { SettingsHeader } from './settings-layout'

export function SecuritiesSettings({
  classifications = false,
}: {
  classifications?: boolean
}) {
  const { t } = useTranslation('settings_v014')
  const route = useRoute()
  const query = useQuery({ queryKey: ['assets'], queryFn: getAssets })
  const [search, setSearch] = useState(route.params.get('search') ?? '')
  const [type, setType] = useState('')
  const [adding, setAdding] = useState(false)
  const selected = query.data?.find(
    (asset) => asset.id === route.params.get('security'),
  )
  const write = useWrite()
  const open = (asset?: Asset) => {
    const params = new URLSearchParams(route.params)
    if (asset) params.set('security', asset.id)
    else params.delete('security')
    updateRouteParams(params)
  }
  const filtered =
    query.data?.filter(
      (asset) =>
        (!type || asset.asset_type === type) &&
        `${asset.symbol} ${asset.name} ${asset.exchange}`
          .toLocaleLowerCase()
          .includes(search.toLocaleLowerCase()),
    ) ?? []
  return (
    <>
      <SettingsHeader
        title={t(classifications ? 'security_config' : 'securities')}
        description={t('security_help')}
      >
        {!classifications && (
          <Button onClick={() => setAdding(true)}>{t('manage')}</Button>
        )}
      </SettingsHeader>
      <div className="settings-filter-row">
        <Field label={t('search')}>
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              const params = new URLSearchParams(route.params)
              if (event.target.value) params.set('search', event.target.value)
              else params.delete('search')
              updateRouteParams(params, true)
            }}
          />
        </Field>
        <Field label={t('type')}>
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="">{t('all')}</option>
            {[...new Set(query.data?.map((asset) => asset.asset_type))].map(
              (value) => (
                <option key={value}>{value}</option>
              ),
            )}
          </select>
        </Field>
      </div>
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState
          text={query.error.message}
          retry={() => void query.refetch()}
        />
      ) : !filtered.length ? (
        <EmptyState title={t('empty')} />
      ) : (
        <div className="settings-table-scroll">
          <table>
            <thead>
              <tr>
                {['symbol', 'name', 'type', 'currency', 'details'].map(
                  (key) => (
                    <th scope="col" key={key}>
                      {t(key)}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((asset) => (
                <tr key={asset.id}>
                  <td>
                    <strong>{asset.symbol}</strong>
                    <small>{asset.exchange}</small>
                  </td>
                  <td>{asset.name}</td>
                  <td>{asset.asset_type}</td>
                  <td>{asset.currency}</td>
                  <td>
                    <Button variant="ghost" onClick={() => open(asset)}>
                      {t('edit')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {adding && (
        <DetailDrawer title={t('securities')} onClose={() => setAdding(false)}>
          <AssetForm onSaved={() => setAdding(false)} />
        </DetailDrawer>
      )}
      {selected && (
        <DetailDrawer
          title={`${selected.symbol} · ${selected.name}`}
          onClose={() => open()}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault()
              write.mutate({
                path: `/settings/securities/${selected.id}`,
                method: 'PATCH',
                data: { name: new FormData(event.currentTarget).get('name') },
              })
            }}
          >
            <Field label={t('security_name')}>
              <input
                name="name"
                defaultValue={selected.name}
                maxLength={120}
                required
              />
            </Field>
            <Button disabled={write.isPending}>{t('save')}</Button>
            {write.isError && <ErrorState text={write.error.message} />}
          </form>
          <SecurityClassification id={selected.id} />
          {!classifications && (
            <SecurityQuotes
              asset={selected}
              asOf={getDemoDate() || localDate()}
            />
          )}
        </DetailDrawer>
      )}
    </>
  )
}

function SecurityQuotes({ asset, asOf }: { asset: Asset; asOf: string }) {
  const { t } = useTranslation('settings_v014')
  const fixed = useQuery({
    queryKey: ['fixed-income', asOf, ''],
    queryFn: ({ signal }) => getFixedIncome(asOf, '', signal),
    enabled: asset.asset_type === 'BOND',
  })
  if (asset.asset_type === 'BOND' && fixed.isPending) return <LoadingState />
  if (asset.asset_type === 'BOND' && fixed.isError)
    return (
      <ErrorState
        text={fixed.error.message}
        retry={() => void fixed.refetch()}
      />
    )
  const contract = fixed.data?.positions.find(
    (row) => row.contract.asset_id === asset.id,
  )?.contract
  if (contract && contract.instrument_type !== 'TESOURO_SELIC')
    return (
      <section className="source-settings-card">
        <h2>{contract.instrument_type}</h2>
        <p>{t('security_help')}</p>
        <dl className="settings-information">
          <div>
            <dt>{t('source')}</dt>
            <dd>{contract.issuer}</dd>
          </div>
          <div>
            <dt>{t('date')}</dt>
            <dd>
              {contract.settlement_date} → {contract.maturity_date}
            </dd>
          </div>
        </dl>
        <Button
          variant="outline"
          onClick={() =>
            navigateTo('Investments', undefined, {
              view: 'Fixed Income',
              contract: contract.id,
              account: contract.account_id,
              end: asOf,
            })
          }
        >
          {t('details')}
        </Button>
      </section>
    )
  return <QuoteHistory asset={asset} asOf={asOf} />
}
