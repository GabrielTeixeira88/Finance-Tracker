// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Wealthfolio 92b4647 alternative-asset-content.tsx, AlternativeAssetDetailCard.
import { useMemo, type FC, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { Position } from '@/lib/wealth-api'
import { decimalUnits } from '@/lib/money'
import { formatWealthLabel } from '@/lib/wealth-labels'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Separator,
  useDateFormatting,
  AmountDisplay,
} from './ui'
import { useBalancePrivacy } from './compat'
import type { ManualHolding } from './api'
import { Link } from './local-link'
type AlternativeAssetDetailCardProps = {
  holding: ManualHolding
  netEquity: string | null
  hasLinkedLiabilities: boolean
  linkedLiabilities: ManualHolding[]
  className?: string
}
function getDetailRows(
  _kind: string,
  position: Position,
  _holding: ManualHolding,
  hidden: boolean,
  t: TFunction,
): { label: string; value: ReactNode }[] {
  void _kind
  void _holding
  return [
    {
      label: t('wealth:category_a3c686'),
      value: formatWealthLabel(position.category),
    },
    { label: t('wealth:currency_e070de'), value: position.currency },
    {
      label: t('wealth:liquidity_76a3e6'),
      value: formatWealthLabel(position.liquidity),
    },
    ...(position.minimum_payment === null
      ? []
      : [
          {
            label: t('wealth:minimum_payment_optional__7bd477', {
              defaultValue: 'Recorded minimum payment',
            }),
            value: (
              <AmountDisplay
                value={position.minimum_payment}
                currency={position.currency}
                isHidden={hidden}
              />
            ),
          },
        ]),
  ]
}
function LinkedLiabilitiesSection({
  liabilities,
}: {
  liabilities: ManualHolding[]
}) {
  const { t } = useTranslation()
  const { isBalanceHidden } = useBalancePrivacy()
  return (
    <div className="space-y-3">
      <h3 className="text-muted-foreground text-xs font-medium uppercase">
        {t('wealth:liabilities_556a42')}
      </h3>
      {liabilities.map((row) => (
        <Link
          key={row.id}
          to={`/holdings/${row.id}`}
          className="flex items-center justify-between gap-3 text-sm"
        >
          <span>{row.name}</span>
          <AmountDisplay
            value={row.marketValue}
            currency={row.currency}
            isHidden={isBalanceHidden}
          />
        </Link>
      ))}
    </div>
  )
}
export const AlternativeAssetDetailCard: FC<
  AlternativeAssetDetailCardProps
> = ({
  holding,
  netEquity,
  hasLinkedLiabilities,
  linkedLiabilities,
  className,
}) => {
  const dateFormatting = useDateFormatting()

  const { t } = useTranslation()
  const { isBalanceHidden } = useBalancePrivacy()

  const metadata = holding.position
  const kind = holding.kind.toLowerCase()

  // Build detail rows based on asset type
  const detailRows = useMemo(
    () => getDetailRows(kind, metadata, holding, isBalanceHidden, t),
    [kind, metadata, holding, isBalanceHidden, t],
  )

  // Determine if we should show a header with value info
  const showNetEquityHeader = netEquity !== null

  return (
    <Card className={className}>
      {/* Header: Net Equity for property/vehicle */}
      {showNetEquityHeader && (
        <CardHeader className="flex flex-row items-center justify-between pb-0">
          <CardTitle className="flex w-full justify-between text-lg font-bold">
            <div>
              <div className="text-muted-foreground text-sm font-normal">
                {t('wfAsset:altContent.net_equity')}
              </div>
              {!hasLinkedLiabilities && (
                <div className="text-muted-foreground text-xs font-normal">
                  {t('wfAsset:altContent.no_liabilities')}
                </div>
              )}
            </div>
            <div>
              <div
                className={`text-xl font-extrabold ${decimalUnits(netEquity!) >= 0n ? 'text-gain' : 'text-loss'}`}
              >
                <AmountDisplay
                  value={netEquity}
                  currency={holding.currency}
                  isHidden={isBalanceHidden}
                />
              </div>
              <div className="text-muted-foreground text-end text-sm font-normal">
                {holding.currency}
              </div>
            </div>
          </CardTitle>
        </CardHeader>
      )}

      {/* Fallback header for assets without special headers */}
      {!showNetEquityHeader && (
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            {t('wfAsset:altContent.details')}
          </CardTitle>
        </CardHeader>
      )}

      <CardContent>
        {showNetEquityHeader && <Separator className="my-3" />}
        {/* Summary rows */}
        <div className="space-y-4 text-sm">
          {holding.position.acquisition_cost && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t('wfAsset:altContent.purchase_price')}
              </span>
              <span className="font-medium">
                <AmountDisplay
                  value={holding.position.acquisition_cost}
                  currency={holding.currency}
                  isHidden={isBalanceHidden}
                />
              </span>
            </div>
          )}

          {holding.position.start_date && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t('wealth:start_date_ff99f5')}
              </span>
              <span className="font-medium">
                {dateFormatting.formatCalendarDate(holding.position.start_date)}
              </span>
            </div>
          )}

          {holding.valuationDate && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t('wfAsset:altContent.last_updated')}
              </span>
              <span className="font-medium">
                {dateFormatting.formatCalendarDate(
                  holding.valuationDate.split('T')[0],
                )}
              </span>
            </div>
          )}
        </div>

        {/* Type-specific details (continued without separator) */}
        {detailRows.length > 0 && (
          <div className="mt-4 space-y-4 text-sm">
            {detailRows.map((row, idx) => (
              <div key={idx} className="flex justify-between">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="text-end font-medium">{row.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Linked Liabilities (for property/vehicle) */}
        {linkedLiabilities.length > 0 && (
          <>
            <Separator className="my-4" />
            <LinkedLiabilitiesSection liabilities={linkedLiabilities} />
          </>
        )}
      </CardContent>
    </Card>
  )
}
