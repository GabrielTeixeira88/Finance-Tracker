// SPDX-License-Identifier: AGPL-3.0-only
// Adapted layout: Wealthfolio 92b4647 asset-profile-page.tsx and alternative-asset-content.tsx.
// Recorded observations and history-safe local mutations replace quotes and the postponed loan engine.
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { request, localDate } from '@/lib/api'
import { formatWealthLabel } from '@/lib/wealth-labels'
import { observationSchema } from '@/lib/wealth-api'
import { useRoute, updateRouteParams } from '@/lib/navigation'
import { startDate } from '@/lib/investment-analytics'
import { PositionEditor, WealthForm } from '@/pages/wealth'
import { Field } from '@/components/forms'
import { PortfolioValueChart } from '@/components/portfolio-value-chart'
import { ErrorState, LoadingState } from '@/components/primitives'
import type { ManualHolding } from './api'
import { AlternativeAssetDetailCard } from './alternative-asset-detail-card'
import { ActionPalette } from './action-palette'
import { useBalancePrivacy } from './compat'
import {
  AmountDisplay,
  Page,
  PageHeader,
  PageContent,
  AnimatedToggleGroup,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
} from './ui'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/vendor/wealthfolio/ui/components/ui/dialog'
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/vendor/wealthfolio/ui/components/ui/table'
import { Icons } from '@/vendor/wealthfolio/ui/components/ui/icons'

const ranges = ['1M', '3M', '6M', '1Y', 'ALL']
export function ManualAssetProfile({
  holding,
  holdings,
  asOf,
  onBack,
}: {
  holding: ManualHolding
  holdings: ManualHolding[]
  asOf: string
  onBack: () => void
}) {
  const { t } = useTranslation()
  const route = useRoute()
  const privacy = useBalancePrivacy()
  const [palette, setPalette] = useState(false)
  const [editor, setEditor] = useState<
    'edit' | 'value' | 'close' | { correct: string } | { void: string } | null
  >(() =>
    route.params.get('action') === 'value'
      ? 'value'
      : route.params.get('action') === 'close'
        ? 'close'
        : null,
  )
  const query = useQuery({
    queryKey: ['observations', holding.id],
    queryFn: async () =>
      z
        .array(observationSchema)
        .parse(await request(`/manual-positions/${holding.id}/observations`)),
  })
  const position = holding.position
  const linked = holdings.filter((row) => row.linkedAssetId === holding.id)
  const isLiability = position.kind === 'LIABILITY'
  const tab =
    route.params.get('position_view') === 'Values' ? 'Values' : 'Overview'
  const range = ranges.includes(route.params.get('range') ?? '')
    ? route.params.get('range')!
    : 'ALL'
  const start = startDate(range, asOf, '')
  const all = query.data ?? [] // The audit tab retains future and voided records.
  const eligible = all.filter(
    (row) => !row.voided_at && row.effective_date <= asOf,
  )
  const unique = new Map(eligible.map((row) => [row.effective_date, row]))
  const points = [...unique.values()].filter(
    (row) => range === 'ALL' || row.effective_date >= start,
  )
  const change = (values: Record<string, string>) =>
    updateRouteParams(
      new URLSearchParams({ ...Object.fromEntries(route.params), ...values }),
    )
  const groups = [
    {
      items: [
        {
          icon: Icons.DollarSign,
          label: t(
            isLiability
              ? 'wfAsset:valueToolbar.add_balance'
              : 'wfAsset:valueToolbar.add_value',
          ),
          onClick: () => setEditor('value'),
        },
        {
          icon: Icons.Pencil,
          label: t('wfHoldings:edit_details'),
          onClick: () => setEditor('edit'),
        },
        {
          icon: Icons.History,
          label: t('wfAsset:profile.history'),
          onClick: () => change({ position_view: 'Values' }),
        },
        {
          icon: Icons.Lock,
          label: t('holdingsMigration:closeRecord'),
          onClick: () => setEditor('close'),
        },
      ],
    },
  ]
  const target =
    typeof editor === 'object' && editor
      ? all.find(
          (row) =>
            row.id === ('correct' in editor ? editor.correct : editor.void),
        )
      : undefined
  return (
    <Page>
      <PageHeader
        onBack={onBack}
        actions={
          <div className="flex items-center gap-3">
            <AnimatedToggleGroup
              items={[
                { value: 'Overview', label: t('wfAsset:profile.overview') },
                { value: 'Values', label: t('wfAsset:profile.history') },
              ]}
              value={tab}
              onValueChange={(value) => change({ position_view: value })}
            />
            <ActionPalette
              open={palette}
              onOpenChange={setPalette}
              groups={groups}
            />
          </div>
        }
      >
        <h1 id="page-title" className="text-xl font-semibold">
          {holding.name}
        </h1>
      </PageHeader>
      <PageContent>
        <div className="space-y-4">
          {isLiability && (
            <p className="text-muted-foreground text-xs">
              {t('holdingsMigration:recordedDebt')}
            </p>
          )}
          {query.isError && (
            <ErrorState
              text={query.error.message}
              retry={() => void query.refetch()}
            />
          )}
          {tab === 'Overview' ? (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card className="col-span-1 overflow-hidden md:col-span-2">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-md">
                      <p className="pt-3 text-xl font-bold">
                        <AmountDisplay
                          value={holding.marketValue}
                          currency={holding.currency}
                          isHidden={privacy.isBalanceHidden}
                        />
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {holding.valuationDate ?? t('common:unavailable')}
                      </p>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="relative p-0">
                    {query.isPending ? (
                      <LoadingState />
                    ) : points.length ? (
                      <PortfolioValueChart
                        mode="manual-observations"
                        history={{
                          currency: holding.currency,
                          fx_provider: 'NONE',
                          warning: t('charts:recorded'),
                          points: points.map((row) => ({
                            date: row.effective_date,
                            value: row.amount,
                            known_value: row.amount,
                            missing_assets: [],
                            missing_fx: [],
                          })),
                        }}
                        label={t('wfAsset:profile.history')}
                      />
                    ) : (
                      <p
                        role="status"
                        className="text-muted-foreground flex h-50 items-center justify-center text-sm"
                      >
                        {t('wfAsset:altContent.no_valuation_data')}
                      </p>
                    )}
                    <div className="flex justify-center pb-3">
                      <AnimatedToggleGroup
                        items={ranges.map((value) => ({ value, label: value }))}
                        value={range}
                        onValueChange={(value) => change({ range: value })}
                        size="sm"
                      />
                    </div>
                  </CardContent>
                </Card>
                <AlternativeAssetDetailCard
                  className="col-span-1"
                  holding={holding}
                  netEquity={holding.netEquity}
                  linkedLiabilities={linked}
                  hasLinkedLiabilities={linked.length > 0}
                />
              </div>
              <div className="space-y-4">
                <h3 className="text-lg font-bold">
                  {t('wfAsset:altContent.about')}
                </h3>
                <Badge variant="secondary">
                  {formatWealthLabel(position.category)}
                </Badge>
                <p className="text-muted-foreground text-sm">
                  {position.notes || t('wfAsset:altContent.no_notes')}
                </p>
                {position.terms && (
                  <p className="text-muted-foreground text-sm">
                    {position.terms}
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium">
                  {t('wfAsset:profile.history')}
                </h2>
                <Button size="sm" onClick={() => setEditor('value')}>
                  <Icons.Plus className="size-4" />
                  {t(
                    isLiability
                      ? 'wfAsset:valueToolbar.add_balance'
                      : 'wfAsset:valueToolbar.add_value',
                  )}
                </Button>
              </div>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          {t('wealth:effective_date_153c9b')}
                        </TableHead>
                        <TableHead className="text-end">
                          {t('wealth:value_8dce17')}
                        </TableHead>
                        <TableHead>
                          {t('wealth:observation_notes_397886')}
                        </TableHead>
                        <TableHead>{t('wfCommon:actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {all.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            {row.effective_date}
                            {row.voided_at && (
                              <small className="text-muted-foreground block">
                                {row.void_reason}
                              </small>
                            )}
                          </TableCell>
                          <TableCell className="text-end">
                            <AmountDisplay
                              value={row.amount}
                              currency={holding.currency}
                              isHidden={privacy.isBalanceHidden}
                            />
                          </TableCell>
                          <TableCell>{row.notes}</TableCell>
                          <TableCell>
                            {row.voided_at ? (
                              <Badge variant="secondary">
                                {t('investments:voided_45aa9f')}
                              </Badge>
                            ) : (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditor({ correct: row.id })}
                                >
                                  {t('wealth:correct_observation_7cc30c')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditor({ void: row.id })}
                                >
                                  {t('wealth:remove_observation_a76286')}
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </PageContent>
      <Dialog
        open={editor !== null}
        onOpenChange={(open) => {
          if (!open) setEditor(null)
        }}
      >
        <DialogContent className="wf-workspace wf-editor max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editor === 'edit'
                ? t('wfHoldings:edit_details')
                : editor === 'close'
                  ? t('holdingsMigration:closeRecord')
                  : t('wfAsset:profile.history')}
            </DialogTitle>
          </DialogHeader>
          {editor === 'edit' && (
            <PositionEditor
              kind={position.kind}
              position={position}
              positions={holdings.map((row) => row.position)}
              onDone={() => setEditor(null)}
            />
          )}
          {editor === 'value' && (
            <WealthForm
              title={t(
                isLiability
                  ? 'wfAsset:valueToolbar.add_balance'
                  : 'wfAsset:valueToolbar.add_value',
              )}
              path={`/manual-positions/${holding.id}/observations`}
              onDone={() => setEditor(null)}
            >
              <Field label={t('wealth:effective_date_153c9b')}>
                <input
                  name="effective_date"
                  type="date"
                  min={position.start_date}
                  max={localDate()}
                  required
                  defaultValue={asOf}
                />
              </Field>
              <Field label={t('wealth:value_8dce17')}>
                <input name="amount" inputMode="decimal" required />
              </Field>
              <Field label={t('wealth:observation_notes_397886')}>
                <input name="notes" />
              </Field>
            </WealthForm>
          )}
          {editor === 'close' && (
            <>
              <p className="text-muted-foreground text-sm">
                {t(
                  'wealth:removes_this_item_from_net_worth_from_the_chosen_6c37dc',
                )}
              </p>
              <WealthForm
                title={t('holdingsMigration:closeRecord')}
                path={`/manual-positions/${holding.id}/close`}
                transform={(data) => ({
                  ...data,
                  disposal_proceeds: data.disposal_proceeds || null,
                })}
                onDone={onBack}
              >
                <Field label={t('wealth:end_date_89d10c')}>
                  <input
                    name="end_date"
                    type="date"
                    min={position.start_date}
                    max={localDate()}
                    defaultValue={asOf}
                    required
                  />
                </Field>
                {!isLiability && (
                  <Field label={t('wealth:disposal_proceeds_optional__b930b1')}>
                    <input name="disposal_proceeds" inputMode="decimal" />
                  </Field>
                )}
              </WealthForm>
            </>
          )}
          {target && (
            <>
              <p className="text-muted-foreground text-sm">
                {t(
                  'wealth:corrections_preserve_the_original_and_replace_it_2d40c5',
                )}
              </p>
              <WealthForm
                title={
                  typeof editor === 'object' && editor && 'correct' in editor
                    ? t('wealth:correct_observation_7cc30c')
                    : t('wealth:remove_observation_a76286')
                }
                path={`/manual-observations/${target.id}/${typeof editor === 'object' && editor && 'correct' in editor ? 'correct' : 'void'}`}
                onDone={() => setEditor(null)}
              >
                {typeof editor === 'object' &&
                  editor &&
                  'correct' in editor && (
                    <>
                      <Field label={t('wealth:corrected_date_5d9a0e')}>
                        <input
                          name="effective_date"
                          type="date"
                          required
                          defaultValue={target.effective_date}
                        />
                      </Field>
                      <Field label={t('wealth:corrected_value_7a2b3c')}>
                        <input
                          name="amount"
                          inputMode="decimal"
                          required
                          defaultValue={target.amount}
                        />
                      </Field>
                    </>
                  )}
                <Field label={t('wealth:correction_reason_a09190')}>
                  <input name="reason" required />
                </Field>
              </WealthForm>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Page>
  )
}
