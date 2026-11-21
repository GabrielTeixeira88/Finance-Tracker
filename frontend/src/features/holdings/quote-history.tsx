// SPDX-License-Identifier: AGPL-3.0-only
// Presentation adapted from Wealthfolio 92b4647 asset/quote-history-{toolbar,data-grid}.tsx.
// The local contract stores exact dated close observations, not invented OHLC/volume fields.
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getAssetMarket } from '@/lib/market-data'
import type { Asset } from '@/lib/investments'
import { ErrorState, LoadingState, EmptyState } from '@/components/primitives'
import { PriceForm } from '@/pages/investment-forms'
import { PricingForm, RefreshMarket } from '@/pages/market-data'
import { useBalancePrivacy } from './compat'
import {
  Button,
  Card,
  CardContent,
  AmountDisplay,
  Icons,
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from './ui'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/vendor/wealthfolio/ui/components/ui/dialog'

export function QuoteHistory({ asset, asOf }: { asset: Asset; asOf: string }) {
  const { t } = useTranslation()
  const [offset, setOffset] = useState(0)
  const [adding, setAdding] = useState(false)
  const { isBalanceHidden } = useBalancePrivacy()
  const query = useQuery({
    queryKey: ['market-data', 'security', asset.id, offset, asOf],
    queryFn: () => getAssetMarket(asset.id, offset, asOf),
  })
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setAdding(true)}>
            <Icons.Plus className="me-1.5 size-4" />
            {t('wfAsset:quoteToolbar.add')}
          </Button>
          <span className="text-muted-foreground text-xs">
            {asset.currency}
          </span>
        </div>
        <span className="text-muted-foreground text-xs">
          {query.data?.pricing.mode === 'MANUAL'
            ? t('wfAsset:quoteToolbar.manual')
            : (query.data?.mapping?.provider ??
              query.data?.pricing.provider ??
              '—')}
        </span>
      </div>
      <p className="text-muted-foreground text-xs">
        {t(
          'market_data:adjusted_series_are_excluded_from_valuation_manu_f3a6bc',
        )}
      </p>
      {query.isError ? (
        <ErrorState
          text={query.error.message}
          retry={() => void query.refetch()}
        />
      ) : query.isPending ? (
        <LoadingState />
      ) : !query.data.observations.length ? (
        <EmptyState
          title={t('market_data:no_cached_prices_8074fa')}
          detail={t(
            'market_data:add_a_manual_observation_or_refresh_a_supported__cfcd16',
          )}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table aria-label={t('market_data:cached_security_prices_c536ec')}>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('wfActivity:table_date')}</TableHead>
                  <TableHead className="text-end">
                    {t('market_data:price_3e8248')}
                  </TableHead>
                  <TableHead>{t('market_data:source_6da13a')}</TableHead>
                  <TableHead>{t('market_data:convention_fa84f1')}</TableHead>
                  <TableHead className="hidden md:table-cell">
                    {t('market_data:retrieved_5538ff')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.observations.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.price_date}</TableCell>
                    <TableCell className="text-end">
                      <AmountDisplay
                        value={row.price}
                        currency={row.currency}
                        isHidden={isBalanceHidden}
                      />
                    </TableCell>
                    <TableCell>{row.source}</TableCell>
                    <TableCell>
                      {row.price_type === 'ADJUSTED'
                        ? t('dynamic:adjusted_not_eligible_734a85')
                        : row.price_type}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-xs md:table-cell">
                      {row.fetched_at?.slice(0, 16) ??
                        t('dynamic:manual_entry_0ba9f7')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={!offset || query.isFetching}
          onClick={() => setOffset(Math.max(0, offset - 200))}
        >
          {t('market_data:previous_prices_497281')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={
            query.isFetching || (query.data?.observations.length ?? 0) < 200
          }
          onClick={() => setOffset(offset + 200)}
        >
          {t('market_data:next_prices_b281bb')}
        </Button>
      </div>
      <details className="text-sm">
        <summary className="text-muted-foreground cursor-pointer">
          {t('market_data:pricing_preferences_and_coverage_87fd5e')}
        </summary>
        <div className="space-y-3 pt-3">
          {query.data && (
            <PricingForm
              key={JSON.stringify(query.data.pricing)}
              id={asset.id}
              initial={query.data.pricing}
            />
          )}
          <RefreshMarket assetId={asset.id} backfill />
          <p className="text-muted-foreground text-xs">
            {query.data?.mapping_error ?? query.data?.sync?.error}
          </p>
        </div>
      </details>
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="wf-workspace wf-editor max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('wfAsset:quoteToolbar.add')}</DialogTitle>
          </DialogHeader>
          <PriceForm
            asset={asset}
            onSaved={() => {
              setAdding(false)
              setOffset(0)
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
