import { backToDashboard } from '@/features/dashboard/period'
// SPDX-License-Identifier: AGPL-3.0-only
// HoldingsPage composition adapted from Wealthfolio 92b4647 holdings-page.tsx.
// Source component hierarchy is retained; exact local queries/actions replace upstream hooks.
import './i18n'
import './migration.css'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useRoute, updateRouteParams, navigateTo } from '@/lib/navigation'
import { getDemoDate, localDate, type Account } from '@/lib/api'
import { ErrorState } from '@/components/primitives'
import { AssetForm, ActivityForm } from '@/pages/investment-forms'
import { PositionEditor } from '@/pages/wealth'
import { ManualAssetProfile } from './manual-asset-profile'
import { SecurityClassification } from '@/pages/investment-analytics'
import { getAssets } from '@/lib/investments'
import { useWrite } from '@/lib/use-write'
import { SwipablePage, type SwipablePageView } from './swipable-page'
import { AccountScopeSelector } from './account-filter-selector'
import { ActionPalette } from './action-palette'
import { HoldingsTable } from './holdings-table'
import { HoldingsTableMobile } from './holdings-table-mobile'
import { AlternativeHoldingsTable } from './alternative-holdings-table'
import { AlternativeHoldingsListMobile } from './alternative-holdings-list-mobile'
import { LiabilityOverview } from './liability-overview'
import { filterHoldingsByVisibility } from './holdings-visibility'
import { AssetProfilePage } from './asset-profile-page'
import type { HoldingsVisibilityFilter } from './holdings-visibility'
import { getHoldingsWorkspace, getManualHoldings } from './api'
import type { AccountScope } from './types'
import { Icons } from '@/vendor/wealthfolio/ui/components/ui/icons'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/vendor/wealthfolio/ui/components/ui/dialog'
import { PortalScope } from '@/vendor/wealthfolio/ui/components/ui/portal-scope'
import { Button } from '@/vendor/wealthfolio/ui/components/ui/button'
import { Input } from '@/vendor/wealthfolio/ui/components/ui/input'
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from './ui'

type Editor = {
  kind: 'activity' | 'security' | 'date' | 'classify' | 'manual'
  id?: string
  manualKind?: 'ASSET' | 'LIABILITY'
} | null
export default function HoldingsPage({ accounts }: { accounts: Account[] }) {
  const { t } = useTranslation()
  const route = useRoute()
  const asOf = route.params.get('end') || getDemoDate() || localDate()
  const accountId = route.accountId ?? ''
  const [editor, setEditor] = useState<Editor>(null)
  const [palette, setPalette] = useState(false)
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const data = useQuery({
    queryKey: ['holdings-workspace', accountId, asOf],
    queryFn: ({ signal }) => getHoldingsWorkspace(accountId, asOf, signal),
  })
  const manual = useQuery({
    queryKey: ['manual-holdings', asOf],
    queryFn: ({ signal }) => getManualHoldings(asOf, signal),
  })
  const assets = useQuery({
    queryKey: ['investments', 'assets'],
    queryFn: getAssets,
  })
  const write = useWrite()
  const accountFilter: AccountScope = accountId
    ? { type: 'account', accountId }
    : { type: 'all' }
  const visibility: HoldingsVisibilityFilter[] = [
    route.params.get('visibility') === 'closed' ? 'closed' : 'open',
  ]
  const visible = filterHoldingsByVisibility(data.data?.rows ?? [], visibility)
  const params = (changes: Record<string, string>) => {
    const next = new URLSearchParams(route.params)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    updateRouteParams(next)
  }
  const setAccountScope = (scope: AccountScope) =>
    params({ account: scope.type === 'account' ? scope.accountId : '' })
  const setVisibility = (values: HoldingsVisibilityFilter[]) =>
    params({ visibility: values[0] === 'closed' ? 'closed' : '' })
  const onViewHistory = (holding: { id: string }) =>
    params({ position: holding.id, position_view: 'Values', action: '' })
  const onViewManual = (holding: { id: string }) =>
    params({ position: holding.id, position_view: 'Overview', action: '' })
  const onUpdateValue = (holding: { id: string }) =>
    params({ position: holding.id, position_view: 'Overview', action: 'value' })
  const onEdit = (holding: { id: string }) =>
    setEditor({ kind: 'manual', id: holding.id })
  const onDelete = (holding: { id: string }) =>
    params({ position: holding.id, action: 'close' }) // Closing/disposal retains history.
  const edited = manual.data?.rows.find((row) => row.id === editor?.id)
  const selected = manual.data?.rows.find(
    (row) => row.id === route.params.get('position'),
  )
  const classification = assets.data?.find((asset) => asset.id === editor?.id)
  const security = assets.data?.find(
    (asset) => asset.id === route.params.get('asset'),
  )
  const currentTab = route.params.get('tab') ?? 'investments'
  const primaryActions = useMemo(
    () => [
      {
        items: [
          {
            icon: Icons.Plus,
            label: t('investments:add_activity_63b759'),
            onClick: () => setEditor({ kind: 'activity' }),
          },
          {
            icon: Icons.TrendingUp,
            label: t('investments:add_security_1b9631'),
            onClick: () => setEditor({ kind: 'security' }),
          },
          {
            icon: Icons.House,
            label: t('wfHoldings:add_asset', { defaultValue: 'Add asset' }),
            onClick: () => setEditor({ kind: 'manual', manualKind: 'ASSET' }),
          },
          {
            icon: Icons.CreditCard,
            label: t('wfHoldings:add_liability'),
            onClick: () =>
              setEditor({ kind: 'manual', manualKind: 'LIABILITY' }),
          },
          {
            icon: Icons.Calendar,
            label: t('investments:valuation_as_of_58c88f'),
            onClick: () => setEditor({ kind: 'date' }),
          },
          {
            icon: Icons.Import,
            label: t('wfCommon:import'),
            onClick: () =>
              navigateTo('Investments', accountId, { view: 'Imports' }),
          },
          {
            icon: Icons.Briefcase,
            label: t('fixed_income:title'),
            onClick: () =>
              navigateTo('Investments', accountId, { view: 'Fixed Income' }),
          },
        ],
      },
    ],
    [t, accountId],
  )
  const actions = (
    <>
      {currentTab === 'investments' && (
        <AccountScopeSelector
          value={accountFilter}
          onChange={setAccountScope}
          allowMultiAccount={false}
        />
      )}
      <ActionPalette
        open={palette}
        onOpenChange={setPalette}
        groups={primaryActions}
      />
    </>
  )
  const status =
    data.isError || manual.isError ? (
      <ErrorState
        text={data.error?.message || manual.error?.message || ''}
        retry={() => {
          void data.refetch()
          void manual.refetch()
        }}
      />
    ) : null
  const investmentsContent = (
    <>
      {status}
      <div className="hidden md:block">
        <HoldingsTable
          holdings={visible}
          isLoading={data.isPending}
          visibilityFilters={visibility}
          setVisibilityFilters={setVisibility}
          onClassify={(holding) =>
            setEditor({ kind: 'classify', id: holding.instrument?.id })
          }
        />
      </div>
      <div className="block md:hidden">
        <HoldingsTableMobile
          holdings={visible}
          isLoading={data.isPending}
          selectedTypes={selectedTypes}
          setSelectedTypes={setSelectedTypes}
          accountFilter={accountFilter}
          onAccountScopeChange={setAccountScope}
          accounts={accounts}
          portfolios={[]}
          visibilityFilters={visibility}
          setVisibilityFilters={setVisibility}
        />
      </div>
      <p className="metadata mt-3 text-xs">{t('holdingsMigration:coverage')}</p>
    </>
  )
  const manualContent = (kind: 'assets' | 'liabilities') => {
    const rows = (manual.data?.rows ?? []).filter(
      (row) => (row.kind === 'liability') === (kind === 'liabilities'),
    )
    if (manual.isPending)
      return <AlternativeHoldingsTable holdings={[]} isLoading />
    if (!rows.length)
      return (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Icons.Wallet />
            </EmptyMedia>
            <EmptyTitle>
              {t(
                kind === 'assets'
                  ? 'wfHoldings:empty_no_assets'
                  : 'wfHoldings:empty_no_liabilities_yet',
              )}
            </EmptyTitle>
            <EmptyDescription>
              {t(
                kind === 'assets'
                  ? 'wfHoldings:empty_add_first_asset'
                  : 'wfHoldings:empty_track_debts',
              )}
            </EmptyDescription>
          </EmptyHeader>
          <Button
            onClick={() =>
              setEditor({
                kind: 'manual',
                manualKind: kind === 'assets' ? 'ASSET' : 'LIABILITY',
              })
            }
          >
            {t(
              kind === 'assets'
                ? 'wfHoldings:add_asset'
                : 'wfHoldings:add_liability',
            )}
          </Button>
        </Empty>
      )
    return (
      <>
        {status}
        {kind === 'liabilities' ? (
          <>
            <p className="metadata mb-5">
              {t('holdingsMigration:recordedDebt')}
            </p>
            <LiabilityOverview
              holdings={rows}
              isLoading={false}
              onEdit={onEdit}
              onViewHistory={onViewHistory}
              onDelete={onDelete}
              isDeleting={write.isPending}
            />
          </>
        ) : (
          <>
            <div className="hidden md:block">
              <AlternativeHoldingsTable
                holdings={rows}
                isLoading={false}
                onEdit={onEdit}
                onUpdateValue={onUpdateValue}
                onViewHistory={onViewHistory}
                onDelete={onDelete}
                onRowClick={onViewManual}
                isDeleting={write.isPending}
              />
            </div>
            <div className="block md:hidden">
              <AlternativeHoldingsListMobile
                holdings={rows}
                isLoading={false}
                onRowClick={onViewManual}
              />
            </div>
          </>
        )}
      </>
    )
  }
  const views: SwipablePageView[] = [
    {
      value: 'investments',
      label: t('wfHoldings:investments'),
      icon: Icons.TrendingUp,
      content: investmentsContent,
      actions,
    },
    {
      value: 'assets',
      label: t('wfHoldings:assets'),
      icon: Icons.Wallet,
      content: manualContent('assets'),
      actions,
    },
    {
      value: 'liabilities',
      label: t('wfHoldings:liabilities'),
      icon: Icons.CreditCard,
      content: manualContent('liabilities'),
      actions,
    },
  ]
  return (
    <PortalScope name="holdings-migration">
      <section className="wf-workspace" aria-label={t('wfCommon:holdings')}>
        <h1 id="page-title" className="sr-only">
          {t('wfCommon:holdings')}
        </h1>
        {write.isError && <ErrorState text={write.error.message} />}
        {security ? (
          <AssetProfilePage
            asset={security}
            holding={data.data?.rows.find(
              (row) => row.instrument?.id === security.id,
            )}
            accounts={accounts}
            assets={assets.data ?? []}
            accountId={accountId}
            asOf={asOf}
            onBack={() =>
              backToDashboard(route.params, route.accountId) ||
              params({ asset: '', detail: '' })
            }
          />
        ) : selected ? (
          <ManualAssetProfile
            key={selected.id}
            holding={selected}
            holdings={manual.data?.rows ?? []}
            asOf={asOf}
            onBack={() =>
              params({ position: '', position_view: '', action: '' })
            }
          />
        ) : (
          <SwipablePage views={views} defaultView="investments" />
        )}
        <Dialog
          open={editor !== null}
          onOpenChange={(open) => {
            if (!open) setEditor(null)
          }}
        >
          <DialogContent className="wf-workspace wf-editor max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editor?.kind === 'date'
                  ? t('investments:valuation_as_of_58c88f')
                  : editor?.kind === 'security'
                    ? t('investments:add_security_1b9631')
                    : editor?.kind === 'activity'
                      ? t('investments:add_activity_63b759')
                      : editor?.kind === 'classify'
                        ? t('wfHoldings:classify')
                        : t('wfHoldings:holding_details')}
              </DialogTitle>
            </DialogHeader>
            {editor?.kind === 'activity' && (
              <ActivityForm
                native
                accounts={accounts}
                assets={assets.data ?? []}
                initialAccount={accountId}
                blockedAssetIds={(data.data?.rows ?? [])
                  .filter((row) => row.contract)
                  .map((row) => row.instrument?.id ?? '')}
                onSaved={() => setEditor(null)}
              />
            )}
            {editor?.kind === 'security' && (
              <AssetForm onSaved={() => setEditor(null)} />
            )}
            {editor?.kind === 'manual' && (
              <PositionEditor
                kind={edited?.position.kind ?? editor.manualKind ?? 'ASSET'}
                position={edited?.position}
                positions={(manual.data?.rows ?? []).map((row) => row.position)}
                onDone={() => setEditor(null)}
              />
            )}
            {editor?.kind === 'classify' && classification && (
              <SecurityClassification id={classification.id} />
            )}
            {editor?.kind === 'date' && (
              <label className="field">
                {t('investments:valuation_as_of_58c88f')}
                <Input
                  type="date"
                  value={asOf}
                  max={localDate()}
                  onChange={(event) => params({ end: event.target.value })}
                />
              </label>
            )}
          </DialogContent>
        </Dialog>
      </section>
    </PortalScope>
  )
}
