// SPDX-License-Identifier: AGPL-3.0-only
// Source ActivityTable/Mobile controls composed with Finance Tracker's exact posting API.
import '../holdings/i18n'
import '../holdings/migration.css'
import { useState, useImperativeHandle, type Ref } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import type { SortingState } from '@tanstack/react-table'
import { request, type Account } from '@/lib/api'
import { activitySchema, type Asset } from '@/lib/investments'
import { updateRouteParams, useRoute, navigateTo } from '@/lib/navigation'
import { useWrite } from '@/lib/use-write'
import { ErrorState } from '@/components/primitives'
import { ActivityForm } from '@/pages/investment-forms'
import { ActivityTable } from './activity-table'
import { ActivityTableMobile } from './activity-table-mobile'
import {
  ActivityActionsProvider,
  toActivity,
  type ActivityDetails,
} from './activity-compat'
import { ActivityPagination } from './activity-pagination'
import {
  AmountDisplay,
  Button,
  AnimatedToggleGroup,
  Input,
} from '../holdings/ui'
import { Icons } from '@/vendor/wealthfolio/ui/components/ui/icons'
import { useIsMobileViewport } from '../holdings/compat'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/vendor/wealthfolio/ui/components/ui/dialog'
import { FacetedFilter } from '@/vendor/wealthfolio/ui/components/ui/faceted-filter'
import { useBalancePrivacy } from '../holdings/compat'

const responseSchema = z.object({
  rows: z.array(activitySchema),
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
  fixed_income_asset_ids: z.array(z.string()).default([]),
})
export function InvestmentActivities({
  accountId,
  assetId,
  accounts,
  assets,
  embedded = false,
  workspaceRef,
  lockedScope = false,
}: {
  accountId: string
  assetId: string
  accounts: Account[]
  assets: Asset[]
  embedded?: boolean
  workspaceRef?: Ref<{ openAddForm: () => void }>
  lockedScope?: boolean
}) {
  const { t } = useTranslation()
  const route = useRoute()
  const mobile = useIsMobileViewport()
  const privacy = useBalancePrivacy()
  const write = useWrite()
  const [selected, setSelected] = useState<ActivityDetails | null>(null)
  const [draft, setDraft] = useState<ActivityDetails | 'new' | null>(() =>
    route.params.get('new') === 'true' ? 'new' : null,
  )
  useImperativeHandle(
    workspaceRef,
    () => ({ openAddForm: () => setDraft('new') }),
    [],
  )
  const [confirm, setConfirm] = useState<ActivityDetails | null>(null)
  const offset = Math.max(0, parseInt(route.params.get('a_offset') ?? '0') || 0)
  const kind = route.params.get('a_type') ?? ''
  const status = route.params.get('a_status') ?? 'all'
  const query = route.params.get('a_query') ?? ''
  const sort = route.params.get('a_sort') ?? 'date'
  const desc = route.params.get('a_asc') !== '1'
  const start = route.params.get('a_start') ?? ''
  const end = route.params.get('a_end') ?? route.params.get('end') ?? ''
  const mode = route.params.get('a_mode') ?? 'table'
  const params = new URLSearchParams({
    offset: String(offset),
    limit: '50',
    sort,
    descending: String(desc),
    status,
    ...(accountId ? { account_id: accountId } : {}),
    ...(assetId ? { asset_id: assetId } : {}),
    ...(kind ? { activity_type: kind } : {}),
    ...(query ? { query } : {}),
    ...(start ? { start } : {}),
    ...(end ? { end } : {}),
  })
  const rows = useQuery({
    queryKey: ['investments', 'activity-workspace', params.toString()],
    queryFn: async ({ signal }) =>
      responseSchema.parse(
        await request(`/investments/workspace/activities?${params}`, {
          signal,
        }),
      ),
  })
  const change = (values: Record<string, string>, replace = false) => {
    const next = new URLSearchParams(route.params)
    next.delete('a_offset')
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    updateRouteParams(next, replace)
  }
  const sorting: SortingState = [
    {
      id:
        sort === 'security'
          ? 'assetSymbol'
          : sort === 'type'
            ? 'activityType'
            : sort,
      desc,
    },
  ]
  const onSort = (values: SortingState) => {
    const value = values[0]
    change({
      a_sort:
        value?.id === 'assetSymbol'
          ? 'security'
          : value?.id === 'activityType'
            ? 'type'
            : 'date',
      a_asc: value?.desc === false ? '1' : '',
    })
  }
  const activities = (rows.data?.rows ?? []).map((row) =>
    toActivity(
      row,
      accounts,
      assets,
      rows.data?.fixed_income_asset_ids.includes(row.asset_id ?? '') ?? false,
    ),
  )
  const duplicate = async (row: ActivityDetails) => {
    if (row.fixedIncome) {
      navigateTo('Investments', row.accountId, {
        view: 'Fixed Income',
        asset: row.assetId,
        end: row.date,
      })
      return
    }
    setDraft(row)
  }
  const clear = () =>
    change(
      Object.fromEntries(
        [...route.params.keys()]
          .filter((key) => key.startsWith('a_') && key !== 'a_mode')
          .map((key) => [key, '']),
      ),
    )
  const filtersActive = !!(query || kind || start || end || status !== 'all')
  return (
    <ActivityActionsProvider value={duplicate}>
      <section
        className="wf-workspace wf-investment-activity"
        aria-label={t('investments:investment_activity_f52165')}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="h-8 w-48"
              aria-label={t('wfActivity:search_placeholder')}
              placeholder={t('wfActivity:search_placeholder')}
              value={query}
              onChange={(event) =>
                change({ a_query: event.target.value }, true)
              }
            />
            {!lockedScope && (
              <>
                <FacetedFilter
                  title={t('wfHoldings:account')}
                  options={accounts
                    .filter((account) => account.type === 'INVESTMENT')
                    .map((account) => ({
                      value: account.id,
                      label: account.name,
                    }))}
                  selectedValues={new Set(accountId ? [accountId] : [])}
                  onFilterChange={(values) =>
                    change({ account: [...values].at(-1) ?? '' })
                  }
                />
                <FacetedFilter
                  title={t('wfActivity:table_symbol')}
                  options={assets.map((asset) => ({
                    value: asset.id,
                    label: `${asset.symbol} · ${asset.name}`,
                  }))}
                  selectedValues={new Set(assetId ? [assetId] : [])}
                  onFilterChange={(values) =>
                    change({ asset: [...values].at(-1) ?? '' })
                  }
                />
              </>
            )}
            <FacetedFilter
              title={t('wfActivity:filter_type')}
              options={[
                'BUY',
                'SELL',
                'DIVIDEND',
                'INTEREST',
                'FEE',
                'TAX',
              ].map((value) => ({
                value,
                label: t(`wfActivity:type_${value.toLowerCase()}`, {
                  defaultValue: value,
                }),
              }))}
              selectedValues={new Set(kind ? [kind] : [])}
              onFilterChange={(values) =>
                change({ a_type: [...values].at(-1) ?? '' })
              }
            />
            <label className="text-muted-foreground text-xs">
              {t('holdingsMigration:postingStatus')}
              <select
                className="ms-2 h-8 rounded-lg border bg-background px-2"
                aria-label={t('holdingsMigration:postingStatus')}
                value={status}
                onChange={(event) => change({ a_status: event.target.value })}
              >
                <option value="all">{t('holdingsMigration:all')}</option>
                <option value="active">{t('holdingsMigration:posted')}</option>
                <option value="voided">{t('investments:voided_45aa9f')}</option>
              </select>
            </label>
            <label className="text-muted-foreground text-xs">
              {t('holdingsMigration:from')}
              <Input
                className="ms-2 inline-flex h-8 w-36"
                type="date"
                value={start}
                onChange={(event) => change({ a_start: event.target.value })}
              />
            </label>
            <label className="text-muted-foreground text-xs">
              {t('holdingsMigration:to')}
              <Input
                className="ms-2 inline-flex h-8 w-36"
                type="date"
                value={end}
                onChange={(event) => change({ a_end: event.target.value })}
              />
            </label>
            {filtersActive && (
              <Button variant="ghost" size="sm" onClick={clear}>
                {t('wfActivity:reset_filters')}
                <Icons.Close className="size-4" />
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {mobile && (
              <AnimatedToggleGroup
                value={mode}
                onValueChange={(value) => change({ a_mode: value })}
                size="sm"
                items={[
                  { value: 'table', label: t('holdingsMigration:compact') },
                  { value: 'details', label: t('holdingsMigration:detailed') },
                ]}
              />
            )}
            {!embedded && (
              <Button size="sm" onClick={() => setDraft('new')}>
                <Icons.Plus className="size-4" />
                {t('wfActivity:add_activity')}
              </Button>
            )}
          </div>
        </div>
        {rows.isError && (
          <ErrorState
            text={rows.error.message}
            retry={() => void rows.refetch()}
          />
        )}
        {write.isError && <ErrorState text={write.error.message} />}
        <div className="wf-activity-viewport flex min-h-0 flex-col">
          {mobile ? (
            <ActivityTableMobile
              activities={activities}
              isLoading={rows.isPending}
              isCompactView={mode === 'table'}
              groupByDay={sort === 'date'}
              handleEdit={(row) => setSelected(row ?? null)}
              handleDelete={setConfirm}
              onDuplicate={duplicate}
              onAdd={() => setDraft('new')}
              filtersActive={filtersActive}
              onClearFilters={clear}
            />
          ) : (
            <ActivityTable
              activities={activities}
              isLoading={rows.isPending}
              sorting={sorting}
              onSortingChange={onSort}
              groupByDay={sort === 'date'}
              handleEdit={(row) => setSelected(row ?? null)}
              handleDelete={setConfirm}
              onAdd={() => setDraft('new')}
              filtersActive={filtersActive}
              onClearFilters={clear}
            />
          )}
        </div>
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            disabled={!offset || rows.isFetching}
            onClick={() =>
              change({ a_offset: String(Math.max(0, offset - 50)) })
            }
          >
            {t('investments:previous_activities_c2781d')}
          </Button>
          <ActivityPagination
            isFetching={rows.isFetching}
            totalFetched={Math.min(offset + 50, rows.data?.total ?? 0)}
            totalCount={rows.data?.total ?? 0}
          />
          <Button
            variant="ghost"
            size="sm"
            disabled={rows.isFetching || offset + 50 >= (rows.data?.total ?? 0)}
            onClick={() => change({ a_offset: String(offset + 50) })}
          >
            {t('investments:next_activities_b038db')}
          </Button>
        </div>
        <Dialog
          open={selected !== null}
          onOpenChange={(open) => {
            if (!open) setSelected(null)
          }}
        >
          <DialogContent className="wf-workspace wf-editor">
            <DialogHeader>
              <DialogTitle>{t('holdingsMigration:inspect')}</DialogTitle>
            </DialogHeader>
            {selected && (
              <>
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  {[
                    [t('wfActivity:table_date'), selected.date],
                    [t('wfActivity:table_symbol'), selected.assetSymbol],
                    [t('wfActivity:table_account'), selected.accountName],
                    [t('wfActivity:table_type'), selected.activityType],
                    [
                      t('holdingsMigration:postingStatus'),
                      selected.original.voided_at
                        ? t('investments:voided_45aa9f')
                        : t('holdingsMigration:posted'),
                    ],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd>{value || '—'}</dd>
                    </div>
                  ))}
                  <div>
                    <dt>{t('holdingsMigration:cashPosting')}</dt>
                    <dd>
                      <AmountDisplay
                        value={selected.original.cash_amount}
                        currency={selected.currency}
                        isHidden={privacy.isBalanceHidden}
                      />
                    </dd>
                  </div>
                </dl>
                <p className="text-muted-foreground text-sm">
                  {selected.comment}
                </p>
                <p className="text-muted-foreground text-xs">
                  {t('holdingsMigration:immutableActivity')}
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      void duplicate(selected)
                      setSelected(null)
                    }}
                  >
                    {t(
                      selected.fixedIncome
                        ? 'fixed_income:title'
                        : 'holdingsMigration:duplicateDraft',
                    )}
                  </Button>
                  {!selected.fixedIncome && !selected.original.voided_at && (
                    <Button
                      variant="outline"
                      onClick={() => setConfirm(selected)}
                    >
                      {t('investments:void_207c7c')}
                    </Button>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
        <Dialog
          open={draft !== null}
          onOpenChange={(open) => {
            if (!open) setDraft(null)
          }}
        >
          <DialogContent className="wf-workspace wf-editor max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('wfActivity:add_activity')}</DialogTitle>
            </DialogHeader>
            <ActivityForm
              native
              blockedAssetIds={rows.data?.fixed_income_asset_ids ?? []}
              key={typeof draft === 'object' ? (draft?.id ?? 'new') : 'new'}
              accounts={accounts}
              assets={assets}
              initialAccount={
                draft && draft !== 'new' ? draft.accountId : accountId
              }
              initialAsset={draft && draft !== 'new' ? draft.assetId : assetId}
              draft={draft && draft !== 'new' ? draft.original : undefined}
              onSaved={() => setDraft(null)}
            />
          </DialogContent>
        </Dialog>
        <Dialog
          open={confirm !== null}
          onOpenChange={(open) => {
            if (!open) setConfirm(null)
          }}
        >
          <DialogContent className="wf-workspace wf-editor">
            <DialogHeader>
              <DialogTitle>{t('investments:void_207c7c')}</DialogTitle>
            </DialogHeader>
            <p>
              {t(
                'dynamic:void_this_activity_and_recalculate_all_later_pos_c5b606',
              )}
            </p>
            <Button
              variant="destructive"
              disabled={write.isPending}
              onClick={() => {
                if (confirm)
                  void write
                    .mutateAsync({
                      path: `/investments/activities/${confirm.id}/void`,
                    })
                    .then(() => {
                      setConfirm(null)
                      setSelected(null)
                    })
                    .catch(() => {})
              }}
            >
              {t('investments:void_207c7c')}
            </Button>
          </DialogContent>
        </Dialog>
      </section>
    </ActivityActionsProvider>
  )
}
