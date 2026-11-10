import { formatWealthLabel } from '@/lib/wealth-labels'
// SPDX-License-Identifier: AGPL-3.0-only
// Layout adapted from Wealthfolio 92b4647 pages/asset/asset-profile-page.tsx
// and asset-history-card.tsx. Rust/platform/data hooks are replaced by local exact adapters.
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { Account } from '@/lib/api'
import { getActivities, getPortfolio, type Asset } from '@/lib/investments'
import { getSecurityHistory } from '@/lib/market-data'
import { startDate } from '@/lib/investment-analytics'
import { useRoute, updateRouteParams, navigateTo } from '@/lib/navigation'
import { getFixedIncome, getFixedHistory } from '@/lib/fixed-income'
import { PortfolioValueChart } from '@/components/portfolio-value-chart'
import { ErrorState, LoadingState } from '@/components/primitives'
import { QuoteHistory } from './quote-history'
import { SecurityClassification } from '@/pages/investment-analytics'
import { Activities } from '@/pages/investments'
import { ActivityForm } from '@/pages/investment-forms'
import { useBalancePrivacy, exactSubtract } from './compat'
import { AmountDisplay, QuantityDisplay, TickerAvatar } from './formatting'
import type { Holding } from './types'
import AssetDetailCard from './asset-detail-card'
import {
  Page,
  PageHeader,
  PageContent,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  AnimatedToggleGroup,
} from './ui'
import { ActionPalette } from './action-palette'
import { Icons } from '@/vendor/wealthfolio/ui/components/ui/icons'
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

const intervals = ['1M', '3M', '6M', '1Y', 'ALL'] as const
export function AssetProfilePage({
  asset,
  holding,
  accounts,
  assets,
  accountId,
  asOf,
  onBack,
}: {
  asset: Asset
  holding?: Holding
  accounts: Account[]
  assets: Asset[]
  accountId: string
  asOf: string
  onBack: () => void
}) {
  const { t } = useTranslation()
  const route = useRoute()
  const { isBalanceHidden } = useBalancePrivacy()
  const [palette, setPalette] = useState(false)
  const [add, setAdd] = useState(false)
  const [markers, setMarkers] = useState(true)
  const contract = holding?.contract
  const tradable = !contract || contract.instrument_type === 'TESOURO_SELIC'
  const range =
    intervals.find((item) => item === route.params.get('range')) ?? '3M'
  const acquisitions = useQuery({
    queryKey: ['investments', 'acquisitions', accountId, asset.id],
    queryFn: async ({ signal }) => {
      const rows = []
      for (let offset = 0; ; offset += 50) {
        const page = await getActivities(accountId, asset.id, offset, signal)
        rows.push(...page)
        if (page.length < 50) return rows
      }
    },
  })
  const firstActivity = acquisitions.data
    ?.filter((row) => !row.voided_at && row.activity_date <= asOf)
    .map((row) => row.activity_date)
    .sort()[0]
  // ALL begins with this position's recorded activity, not ten years of artificial empty space.
  // Missing coverage from that date onward remains visible; no observations are synthesized.
  const start =
    range === 'ALL' && firstActivity
      ? firstActivity
      : startDate(range, asOf, '')
  const history = useQuery({
    queryKey: ['market-data', 'security-history', asset.id, asOf, start],
    queryFn: ({ signal }) => getSecurityHistory(asset.id, asOf, signal, start),
    enabled: tradable && (range !== 'ALL' || acquisitions.isSuccess),
  })
  const contracts = useQuery({
    queryKey: ['fixed-income', asOf, accountId],
    queryFn: ({ signal }) => getFixedIncome(asOf, accountId, signal),
    enabled: !!contract,
  })
  const position = contracts.data?.positions.find(
    (row) => row.contract.asset_id === asset.id,
  )
  const fixed = useQuery({
    queryKey: ['fixed-income', 'history', position?.contract.id, start, asOf],
    queryFn: ({ signal }) =>
      getFixedHistory(position!.contract.id, start, asOf, signal),
    enabled: !!position && !!contract,
  })
  const portfolio = useQuery({
    queryKey: ['investments', 'portfolio', accountId, asOf],
    queryFn: ({ signal }) => getPortfolio(accountId, asOf, signal),
  })
  const params = (changes: Record<string, string>) =>
    updateRouteParams(
      new URLSearchParams({ ...Object.fromEntries(route.params), ...changes }),
    )
  const tab = ['about', 'holdings', 'activities', 'quotes'].includes(
    route.params.get('detail') ?? '',
  )
    ? route.params.get('detail')!
    : 'about'
  const rows =
    acquisitions.data?.filter(
      (row) => !row.voided_at && row.activity_date <= asOf,
    ) ?? []
  const buys = rows.filter((row) => row.activity_type === 'BUY')
  const points = history.data?.points ?? []
  const first = points[0]?.value ?? null
  const last = points.at(-1)?.value ?? null
  const change = exactSubtract(last, first)
  const actions = [
    {
      items: [
        contract
          ? {
              icon: Icons.Briefcase,
              label: t('fixed_income:title'),
              onClick: () =>
                navigateTo('Investments', accountId, {
                  view: 'Fixed Income',
                  asset: asset.id,
                  end: asOf,
                }),
            }
          : {
              icon: Icons.Plus,
              label: t('investments:add_activity_63b759'),
              onClick: () => setAdd(true),
            },
        {
          icon: Icons.Pencil,
          label: t('wfHoldings:classify'),
          onClick: () => params({ detail: 'about' }),
        },
        {
          icon: Icons.History,
          label: t(
            contract ? 'wfAsset:profile.history' : 'wfAsset:profile.quotes',
          ),
          onClick: () => params({ detail: 'quotes' }),
        },
      ],
    },
  ]
  const tabs = ['about', 'holdings', 'activities', 'quotes'].map((value) => ({
    value,
    label: t(
      `wfAsset:profile.${contract && value === 'quotes' ? 'history' : value}`,
    ),
  }))
  const perAccount =
    portfolio.data?.positions.filter((row) => row.asset_id === asset.id) ?? []
  return (
    <Page>
      <PageHeader
        onBack={onBack}
        actions={
          <ActionPalette
            open={palette}
            onOpenChange={setPalette}
            groups={actions}
          />
        }
      >
        <div className="flex min-w-0 items-center gap-3">
          <TickerAvatar symbol={asset.symbol} className="h-10 w-10" />
          <div className="min-w-0">
            <h1 id="page-title" className="truncate text-xl font-semibold">
              {asset.symbol}
            </h1>
            <p className="text-muted-foreground truncate text-sm">
              {asset.name}
            </p>
          </div>
        </div>
      </PageHeader>
      <PageContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 pt-0 md:grid-cols-3">
            <Card
              className={`flex flex-col overflow-hidden ${holding ? 'md:col-span-2' : 'md:col-span-3'}`}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-md">
                  <p className="pt-3 text-xl font-bold">
                    <AmountDisplay
                      value={
                        tradable
                          ? (holding?.price ?? last)
                          : (holding?.marketValue.local ?? null)
                      }
                      currency={asset.currency}
                      isHidden={isBalanceHidden}
                    />
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {tradable
                      ? t('holdingsMigration:priceChange')
                      : t('holdingsMigration:contractValue')}{' '}
                    {tradable && (
                      <AmountDisplay
                        value={change}
                        currency={asset.currency}
                        isHidden={isBalanceHidden}
                      />
                    )}
                  </p>
                </CardTitle>
                <Button
                  variant={markers ? 'default' : 'secondary'}
                  size="icon-xs"
                  className="rounded-full"
                  aria-label={t(
                    `wfAsset:historyCard.${markers ? 'hide' : 'show'}_activity_markers`,
                  )}
                  onClick={() => setMarkers(!markers)}
                >
                  <Icons.History className="size-5" />
                </Button>
              </CardHeader>
              <CardContent className="relative flex-1 p-0">
                {!tradable ? (
                  contracts.isError || fixed.isError ? (
                    <ErrorState
                      text={
                        contracts.error?.message ?? fixed.error?.message ?? ''
                      }
                      retry={() => {
                        void contracts.refetch()
                        void fixed.refetch()
                      }}
                    />
                  ) : (fixed.data &&
                      !fixed.data.points.some(
                        (point) => point.value !== null,
                      )) ||
                    (contracts.isSuccess && !position) ? (
                    <p
                      role="status"
                      className="text-muted-foreground flex h-50 items-center justify-center text-sm"
                    >
                      {t('parity:history_unavailable')}
                    </p>
                  ) : fixed.data ? (
                    <PortfolioValueChart
                      history={{
                        currency: fixed.data.currency,
                        warning: fixed.data.source,
                        fx_provider: 'NONE',
                        points: fixed.data.points.map((point) => ({
                          date: point.date,
                          value: point.value,
                          known_value: point.value ?? '0',
                          missing_assets:
                            point.value === null ? [asset.id] : [],
                          missing_fx: [],
                        })),
                      }}
                      label={t('fixed_income:gross_value')}
                    />
                  ) : (
                    <LoadingState />
                  )
                ) : history.isPending ? (
                  <LoadingState />
                ) : history.isError ? (
                  <ErrorState
                    text={history.error.message}
                    retry={() => void history.refetch()}
                  />
                ) : history.data &&
                  !history.data.points.some((point) => point.value !== null) ? (
                  <p
                    role="status"
                    className="text-muted-foreground flex h-50 items-center justify-center text-sm"
                  >
                    {t('parity:history_unavailable')}
                  </p>
                ) : (
                  history.data && (
                    <PortfolioValueChart
                      history={{
                        ...history.data,
                        purchase_markers: markers
                          ? rows
                              .filter(
                                (row) =>
                                  row.activity_type === 'BUY' &&
                                  row.activity_date >= start,
                              )
                              .map((row) => ({
                                date: row.activity_date,
                                asset_id: asset.id,
                                symbol: asset.symbol,
                                quantity: row.quantity,
                                currency: row.currency,
                              }))
                          : [],
                      }}
                      security={tradable}
                      label={
                        tradable
                          ? t('holdingsMigration:price')
                          : t('holdingsMigration:contractUnit')
                      }
                      mode="market"
                    />
                  )
                )}
                <div className="flex justify-center pb-3">
                  <AnimatedToggleGroup
                    items={intervals.map((value) => ({ value, label: value }))}
                    value={range}
                    onValueChange={(value) => params({ range: value })}
                    size="sm"
                  />
                </div>
              </CardContent>
            </Card>
            {holding && (
              <AssetDetailCard
                className="md:col-span-1"
                assetData={{
                  numShares: holding.quantity,
                  quantityLabel: tradable
                    ? undefined
                    : t('holdingsMigration:principalUnits', {
                        currency: asset.currency,
                      }),
                  marketValue: holding.marketValue.local,
                  costBasis: holding.costBasis.local,
                  averagePrice: holding.averagePrice,
                  portfolioPercent: holding.weight,
                  todaysReturn: holding.dayChange.local,
                  todaysReturnPercent: holding.dayChangePct,
                  unrealizedPnl: holding.unrealizedGain.local,
                  unrealizedPnlPercent: holding.unrealizedGainPct,
                  realizedPnl: holding.realizedGain.local,
                  realizedPnlPercent: holding.realizedGainPct,
                  income: holding.income.local,
                  fxEffect: null,
                  priceReturnPercent: null,
                  totalPnl: holding.totalGain.local,
                  totalPnlPercent: holding.totalGainPct,
                  totalReturn: holding.totalReturn.local,
                  totalReturnPercent: holding.totalReturnPct,
                  currency: asset.currency,
                  baseCurrency: asset.currency,
                  quote: null,
                  bondSpec: contract
                    ? { maturityDate: contract.maturity_date }
                    : null,
                }}
              />
            )}
          </div>
          <AnimatedToggleGroup
            items={tabs}
            value={tab}
            onValueChange={(value) => params({ detail: value })}
            className="max-w-full min-w-0 text-sm"
          />
          {tab === 'about' && (
            <Card>
              <CardContent className="space-y-5 py-5">
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-muted-foreground">
                      {t('wfHoldings:position')}
                    </dt>
                    <dd>{asset.name}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      {t('wfHoldings:currency')}
                    </dt>
                    <dd>{asset.currency}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      {t('holdingsMigration:exchange')}
                    </dt>
                    <dd>{asset.exchange || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">ISIN</dt>
                    <dd>{asset.isin ?? '—'}</dd>
                  </div>
                </dl>
                {contract && (
                  <p className="text-muted-foreground text-sm">
                    {formatWealthLabel(contract.instrument_type)} ·{' '}
                    {formatWealthLabel(contract.liquidity)} ·{' '}
                    {contract.maturity_date}
                  </p>
                )}
                <SecurityClassification id={asset.id} />
              </CardContent>
            </Card>
          )}
          {tab === 'holdings' && (
            <div className="space-y-4">
              {portfolio.isError && (
                <ErrorState
                  text={portfolio.error.message}
                  retry={() => void portfolio.refetch()}
                />
              )}
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('wfHoldings:account')}</TableHead>
                        <TableHead className="text-end">
                          {t('wfHoldings:shares')}
                        </TableHead>
                        <TableHead className="text-end">
                          {t('wfAsset:detailCard.book_value')}
                        </TableHead>
                        <TableHead className="text-end">
                          {t('wfHoldings:total_value')}
                        </TableHead>
                        <TableHead className="text-end">
                          {t('wfHoldings:unrealized_pnl')}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {perAccount.map((row) => (
                        <TableRow key={row.account_id}>
                          <TableCell>
                            {
                              accounts.find((a) => a.id === row.account_id)
                                ?.name
                            }
                          </TableCell>
                          <TableCell className="text-end">
                            <QuantityDisplay
                              value={row.quantity}
                              isHidden={isBalanceHidden}
                            />
                          </TableCell>
                          <TableCell className="text-end">
                            <AmountDisplay
                              value={row.cost_basis}
                              currency={row.currency}
                              isHidden={isBalanceHidden}
                            />
                          </TableCell>
                          <TableCell className="text-end">
                            <AmountDisplay
                              value={row.market_value}
                              currency={row.currency}
                              isHidden={isBalanceHidden}
                            />
                          </TableCell>
                          <TableCell className="text-end">
                            <AmountDisplay
                              value={row.unrealized}
                              currency={row.currency}
                              isHidden={isBalanceHidden}
                              colorFormat
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-0">
                  <div className="border-b px-4 py-2.5">
                    <span className="text-sm font-medium">
                      {t('holdingsMigration:acquisitions')}
                    </span>
                    <p className="text-muted-foreground text-xs">
                      {t('holdingsMigration:notTaxLots')}
                    </p>
                  </div>
                  {acquisitions.isError ? (
                    <ErrorState
                      text={acquisitions.error.message}
                      retry={() => void acquisitions.refetch()}
                    />
                  ) : acquisitions.isPending ? (
                    <LoadingState />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('wfActivity:table_date')}</TableHead>
                          <TableHead>{t('wfHoldings:account')}</TableHead>
                          <TableHead className="text-end">
                            {t('wfHoldings:shares')}
                          </TableHead>
                          <TableHead className="text-end">
                            {t('holdingsMigration:executionPrice')}
                          </TableHead>
                          <TableHead className="text-end">
                            {t('holdingsMigration:cashPosting')}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {buys.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>{row.activity_date}</TableCell>
                            <TableCell>
                              {
                                accounts.find((a) => a.id === row.account_id)
                                  ?.name
                              }
                            </TableCell>
                            <TableCell className="text-end">
                              <QuantityDisplay
                                value={row.quantity}
                                isHidden={isBalanceHidden}
                              />
                            </TableCell>
                            <TableCell className="text-end">
                              <AmountDisplay
                                value={row.unit_price}
                                currency={row.currency}
                                isHidden={isBalanceHidden}
                              />
                            </TableCell>
                            <TableCell className="text-end">
                              <AmountDisplay
                                value={row.cash_amount}
                                currency={row.currency}
                                isHidden={isBalanceHidden}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
          {tab === 'activities' && (
            <Activities
              lockedScope
              accountId={accountId}
              assetId={asset.id}
              accounts={accounts}
              assets={assets}
            />
          )}
          {tab === 'quotes' &&
            (contract ? (
              <Card>
                <CardContent className="p-0">
                  {contracts.isSuccess && !position ? (
                    <p role="status">{t('common:unavailable')}</p>
                  ) : fixed.isPending ? (
                    <LoadingState />
                  ) : fixed.isError ? (
                    <ErrorState
                      text={fixed.error.message}
                      retry={() => void fixed.refetch()}
                    />
                  ) : fixed.data ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('wfActivity:table_date')}</TableHead>
                          <TableHead className="text-end">
                            {t('fixed_income:principal')}
                          </TableHead>
                          <TableHead className="text-end">
                            {t('fixed_income:gross_value')}
                          </TableHead>
                          <TableHead className="text-end">
                            {t('fixed_income:gross_interest')}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fixed.data.points.map((point) => (
                          <TableRow key={point.date}>
                            <TableCell>{point.date}</TableCell>
                            <TableCell className="text-end">
                              <AmountDisplay
                                value={point.principal}
                                currency={asset.currency}
                                isHidden={isBalanceHidden}
                              />
                            </TableCell>
                            <TableCell className="text-end">
                              <AmountDisplay
                                value={point.value}
                                currency={asset.currency}
                                isHidden={isBalanceHidden}
                              />
                            </TableCell>
                            <TableCell className="text-end">
                              <AmountDisplay
                                value={point.gross_interest}
                                currency={asset.currency}
                                isHidden={isBalanceHidden}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p role="status">{t('common:unavailable')}</p>
                  )}
                </CardContent>
              </Card>
            ) : (
              <QuoteHistory key={asset.id} asset={asset} asOf={asOf} />
            ))}
          <p className="text-muted-foreground text-xs">
            {t('holdingsMigration:coverage')}
          </p>
        </div>
      </PageContent>
      <Dialog open={add} onOpenChange={setAdd}>
        <DialogContent className="wf-workspace wf-editor max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('investments:add_activity_63b759')}</DialogTitle>
          </DialogHeader>
          <ActivityForm
            native
            accounts={accounts}
            assets={assets}
            initialAccount={accountId}
            initialAsset={asset.id}
            onSaved={() => setAdd(false)}
          />
        </DialogContent>
      </Dialog>
    </Page>
  )
}
