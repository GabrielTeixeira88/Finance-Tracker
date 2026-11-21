// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Wealthfolio 92b4647 asset-detail-card.tsx; exact nullable local values.
import type React from 'react'
import { decimalUnits } from '@/lib/money'
import { useTranslation } from 'react-i18next'

import { useBalancePrivacy } from './compat'
import {
  AmountDisplay,
  GainPercent,
  PriceDisplay,
  QuantityDisplay,
  useDateFormatting,
  useNumberFormatting,
} from './ui'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/vendor/wealthfolio/ui/components/ui/card'
import { Separator } from '@/vendor/wealthfolio/ui/components/ui/separator'

interface AssetDetail {
  numShares: string | null
  quantityLabel?: string
  marketValue: string | null
  costBasis: string | null
  averagePrice: string | null
  portfolioPercent: string | null
  todaysReturn: string | null
  todaysReturnPercent: string | null
  unrealizedPnl: string | null
  unrealizedPnlPercent: string | null
  realizedPnl: string | null
  realizedPnlPercent: string | null
  income: string | null
  fxEffect: string | null
  priceReturnPercent: string | null
  totalPnl: string | null
  totalPnlPercent: string | null
  totalReturn: string | null
  totalReturnPercent: string | null
  currency: string
  baseCurrency: string
  quoteCurrency?: string | null
  quote?: {
    open: string | null
    high: string | null
    low: string | null
    volume: string | null
    close: string | null
    adjclose: string | null
  } | null
  bondSpec?: {
    maturityDate?: string | null
    couponRate?: string | null
    couponFrequency?: string | null
  } | null
  optionSpec?: {
    right?: string | null
    strike?: string | null
    expiration?: string | null
  } | null
  /** Multiplier configured on the asset. Independent of any holding. */
  contractMultiplier?: string | null
  className?: string
}

interface AssetDetailProps {
  assetData: AssetDetail
  className?: string
}

const SectionHeader: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <div className="text-muted-foreground mb-2 text-xs font-medium tracking-wider uppercase">
    {children}
  </div>
)

const AssetDetailCard: React.FC<AssetDetailProps> = ({
  assetData,
  className,
}) => {
  const numberFormatting = useNumberFormatting()
  const dateFormatting = useDateFormatting()

  const { t } = useTranslation()
  const { isBalanceHidden } = useBalancePrivacy()

  const {
    numShares,
    marketValue,
    costBasis,
    averagePrice,
    portfolioPercent,
    todaysReturn,
    todaysReturnPercent,
    unrealizedPnl,
    unrealizedPnlPercent,
    realizedPnl,
    realizedPnlPercent,
    income,
    fxEffect,
    priceReturnPercent,
    totalPnl,
    totalPnlPercent,
    totalReturn,
    totalReturnPercent,
    currency,
    baseCurrency,
    quoteCurrency,
    quote,
    bondSpec,
    optionSpec,
    contractMultiplier,
  } = assetData

  const isOption = optionSpec != null
  const quantityLabel =
    assetData.quantityLabel ??
    (isOption
      ? t('wfAsset:detailCard.contracts')
      : t('wfAsset:detailCard.shares'))
  const averageCostLabel = isOption
    ? t('wfAsset:detailCard.average_premium')
    : t('wfAsset:detailCard.average_cost')
  const hasFxEffect =
    fxEffect !== null &&
    currency.trim().toUpperCase() !== baseCurrency.trim().toUpperCase()

  const amountTone = (amount: string | null) => {
    if (amount == null || decimalUnits(amount) === 0n) return ''
    return decimalUnits(amount) < 0n ? 'text-loss' : 'text-gain'
  }

  const positionRows = [
    {
      label: t('wfAsset:detailCard.book_value'),
      value: (
        <AmountDisplay
          value={costBasis}
          currency={currency}
          isHidden={isBalanceHidden}
        />
      ),
    },
    {
      label: averageCostLabel,
      value: (
        <PriceDisplay
          value={averagePrice}
          currency={currency}
          isHidden={isBalanceHidden}
        />
      ),
    },
    {
      label: t('wfAsset:detailCard.percent_of_portfolio'),
      value: numberFormatting.formatPercent(portfolioPercent),
    },
  ]

  const performanceRows: {
    label: string
    amount: string | null
    currency: string
    percent: string | null
    color: string
  }[] = [
    ...(todaysReturn !== null && todaysReturnPercent !== null
      ? [
          {
            label: t('wfAsset:detailCard.todays_return'),
            amount: todaysReturn,
            currency,
            percent: todaysReturnPercent,
            color: amountTone(todaysReturn),
          },
        ]
      : []),
    {
      label: t('wfAsset:detailCard.unrealized_pnl'),
      amount: unrealizedPnl,
      currency,
      percent: unrealizedPnlPercent,
      color: amountTone(unrealizedPnl),
    },
    {
      label: t('wfAsset:detailCard.realized_pnl'),
      amount: realizedPnl,
      currency,
      percent: realizedPnlPercent,
      color: amountTone(realizedPnl),
    },
    {
      label: t('wfAsset:detailCard.income'),
      amount: income,
      currency,
      percent: null,
      color: amountTone(income),
    },
    ...(hasFxEffect
      ? [
          {
            label: t('wfAsset:detailCard.fx_effect'),
            amount: fxEffect,
            currency: baseCurrency,
            percent: null,
            color: amountTone(fxEffect),
          },
        ]
      : []),
    {
      label: t('wfAsset:detailCard.price_return'),
      amount: null,
      currency,
      percent: priceReturnPercent,
      color: amountTone(priceReturnPercent),
    },
    {
      label: t('wfAsset:detailCard.total_pnl'),
      amount: totalPnl,
      currency,
      percent: totalPnlPercent,
      color: amountTone(totalPnl),
    },
    {
      label: t('wfAsset:detailCard.total_return'),
      amount: totalReturn,
      currency,
      percent: totalReturnPercent,
      color: amountTone(totalReturn),
    },
  ]

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between pb-0">
        {/* When a long quantity and value don't fit side by side (larger text sizes), the
            value wraps under the quantity, still at the end, instead of running into it. */}
        <CardTitle className="flex w-full flex-wrap items-start justify-between gap-x-4 gap-y-2 text-lg font-bold">
          <div>
            <div>
              <QuantityDisplay value={numShares} isHidden={isBalanceHidden} />
            </div>
            <div className="text-muted-foreground text-sm font-normal">
              {quantityLabel}
            </div>
          </div>
          <div className="ms-auto text-end">
            <div className="text-xl font-extrabold">
              <AmountDisplay
                value={marketValue}
                currency={currency}
                isHidden={isBalanceHidden}
              />
            </div>
            <div className="text-muted-foreground text-end text-sm font-normal">
              {currency}
            </div>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent>
        <Separator className="my-3" />
        <div>
          <SectionHeader>{t('wfAsset:detailCard.position')}</SectionHeader>
          <div className="space-y-2 text-sm">
            {positionRows.map(({ label, value }, idx) => (
              <div key={idx} className="flex justify-between">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <Separator className="my-3" />
        <div>
          <SectionHeader>{t('wfAsset:detailCard.performance')}</SectionHeader>
          <div className="space-y-2 text-sm">
            {performanceRows.map(
              (
                { label, amount, currency: rowCurrency, percent, color },
                idx,
              ) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="text-muted-foreground">{label}</span>
                  <span className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
                    {amount == null && percent == null ? (
                      <span className="text-muted-foreground">
                        {t('wfAsset:detailCard.na')}
                      </span>
                    ) : (
                      <>
                        {amount != null && (
                          <span className={`font-medium ${color || ''}`}>
                            <AmountDisplay
                              value={amount}
                              currency={rowCurrency}
                              isHidden={isBalanceHidden}
                            />
                          </span>
                        )}
                        {percent != null && (
                          <GainPercent
                            variant="badge"
                            value={percent}
                            className="text-xs"
                          />
                        )}
                      </>
                    )}
                  </span>
                </div>
              ),
            )}
          </div>
        </div>

        {quote && (
          <>
            <Separator className="my-3" />
            <div>
              <SectionHeader>{t('wfAsset:detailCard.day_range')}</SectionHeader>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs">
                    {t('wfAsset:detailCard.open')}
                  </span>
                  <div className="text-sm font-medium">
                    <PriceDisplay
                      value={quote.open}
                      currency={quoteCurrency ?? currency}
                      isHidden={isBalanceHidden}
                    />
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-muted-foreground text-xs">
                    {t('wfAsset:detailCard.close')}
                  </span>
                  <div className="text-sm font-medium">
                    <PriceDisplay
                      value={quote.close}
                      currency={quoteCurrency ?? currency}
                      isHidden={isBalanceHidden}
                    />
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs">
                    {t('wfAsset:detailCard.high')}
                  </span>
                  <div className="text-gain text-sm font-medium">
                    <PriceDisplay
                      value={quote.high}
                      currency={quoteCurrency ?? currency}
                      isHidden={isBalanceHidden}
                    />
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-muted-foreground text-xs">
                    {t('wfAsset:detailCard.low')}
                  </span>
                  <div className="text-loss text-sm font-medium">
                    <PriceDisplay
                      value={quote.low}
                      currency={quoteCurrency ?? currency}
                      isHidden={isBalanceHidden}
                    />
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs">
                    {t('wfAsset:detailCard.adj_close')}
                  </span>
                  <div className="text-sm font-medium">
                    <PriceDisplay
                      value={quote.adjclose}
                      currency={quoteCurrency ?? currency}
                      isHidden={isBalanceHidden}
                    />
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-muted-foreground text-xs">
                    {t('wfAsset:detailCard.volume')}
                  </span>
                  <span className="text-sm font-medium">
                    {numberFormatting.formatDecimal(quote.volume)}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Shown outside the option block: futures and CFDs arrive as EQUITY and
            carry a multiplier too, and a scaled value is unexplainable without it. */}
        {contractMultiplier != null && contractMultiplier !== '1' && (
          <>
            <Separator className="my-3" />
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground text-xs">
                {t('wfAsset:detailCard.multiplier')}
              </span>
              <span className="text-sm font-medium">
                {numberFormatting.formatDecimal(contractMultiplier)}
              </span>
            </div>
          </>
        )}

        {bondSpec && (
          <>
            <Separator className="my-3" />
            <div className="grid grid-cols-2 gap-x-6">
              {bondSpec.couponRate != null && (
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs">
                    {t('wfAsset:detailCard.coupon')}
                  </span>
                  <span className="text-sm font-medium">
                    {bondSpec.couponFrequency === 'ZERO'
                      ? t('wfAsset:detailCard.zero_coupon')
                      : numberFormatting.formatPercent(bondSpec.couponRate, {
                          digits: 3,
                        })}
                    {bondSpec.couponFrequency &&
                      bondSpec.couponFrequency !== 'ZERO' &&
                      ` ${bondSpec.couponFrequency.replace('_', ' ').toLowerCase()}`}
                  </span>
                </div>
              )}
              {bondSpec.maturityDate && (
                <div className="flex flex-col items-end">
                  <span className="text-muted-foreground text-xs">
                    {t('wfAsset:detailCard.maturity')}
                  </span>
                  <span className="text-sm font-medium">
                    {dateFormatting.formatCalendarDate(bondSpec.maturityDate, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              )}
            </div>
          </>
        )}

        {optionSpec && (
          <>
            <Separator className="my-3" />
            <div className="grid grid-cols-3 gap-x-4">
              {optionSpec.right && (
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs">
                    {t('wfAsset:detailCard.type')}
                  </span>
                  <span className="text-sm font-medium">
                    {optionSpec.right}
                  </span>
                </div>
              )}
              {optionSpec.strike != null && (
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs">
                    {t('wfAsset:detailCard.strike')}
                  </span>
                  <div className="text-sm font-medium">
                    <PriceDisplay
                      value={optionSpec.strike}
                      currency={quoteCurrency ?? currency}
                      isHidden={isBalanceHidden}
                    />
                  </div>
                </div>
              )}
              {optionSpec.expiration && (
                <div className="flex flex-col items-end">
                  <span className="text-muted-foreground text-xs">
                    {t('wfAsset:detailCard.expiry')}
                  </span>
                  <span className="text-sm font-medium">
                    {dateFormatting.formatCalendarDate(optionSpec.expiration, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default AssetDetailCard
