import { getTopMovers } from './holdings-highlights'
// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Wealthfolio 92b4647 holdings-highlight-cards.tsx. Exact native-currency ranking.
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/vendor/wealthfolio/ui/components/ui/card'
import { Button } from '@/vendor/wealthfolio/ui/components/ui/button'
import { Skeleton } from '@/vendor/wealthfolio/ui/components/ui/skeleton'
import { Icons } from '@/vendor/wealthfolio/ui/components/ui/icons'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/vendor/wealthfolio/ui/components/ui/popover'
import { cn } from '@/vendor/wealthfolio/ui/lib/utils'
import { useBalancePrivacy } from '@/features/holdings/compat'
import { useNumberFormatting } from '@/features/holdings/number-formatters'
import type { Holding } from '@/features/holdings/types'
import { Money } from '@/components/primitives'
import { decimalUnits } from '@/lib/money'
interface HighlightProps {
  holdings: Holding[]
  currency: string
  isLoading: boolean
  onSecurity: (id: string) => void
}

function HoldingRow({
  holding,
  children,
  onSecurity,
}: {
  holding: Holding
  children: ReactNode
  onSecurity: (id: string) => void
}) {
  const instrument = holding.instrument
  const className =
    'border-border flex items-center justify-between gap-3 border-b py-3 transition-colors last:border-0'
  const content = (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-2xs">
          {instrument?.symbol.slice(0, 4)}
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold">
            {instrument?.symbol ?? holding.id}
          </span>
          <span className="text-muted-foreground truncate text-xs">
            {instrument?.name}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">{children}</div>
    </>
  )
  return instrument?.id ? (
    <button
      type="button"
      onClick={() => onSecurity(instrument.id)}
      className={cn(className, 'hover:bg-muted/30')}
    >
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  )
}

function HighlightTitle({
  title,
  description,
}: {
  title: string
  description: string
}) {
  const { t } = useTranslation('wfInsights')
  return (
    <div className="flex items-center gap-1.5">
      <CardTitle className="text-muted-foreground text-sm font-medium tracking-wider uppercase">
        {title}
      </CardTitle>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground/60 hover:text-foreground h-6 w-6 shrink-0 rounded-full p-0"
              aria-label={t('wfCommon:component.more_info_about', {
                label: title,
              })}
            />
          }
        >
          <Icons.Info className="h-3.5 w-3.5" aria-hidden="true" />
        </PopoverTrigger>
        <PopoverContent className="w-64 text-xs" side="top" align="start">
          {description}
        </PopoverContent>
      </Popover>
    </div>
  )
}

function LoadingRows() {
  return (
    <div className="space-y-4 py-3">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  )
}

export function TopMoversCard({
  holdings,
  currency,
  isLoading,
  onSecurity,
}: HighlightProps) {
  const { t } = useTranslation('wfInsights')
  const { isBalanceHidden } = useBalancePrivacy()
  const formatting = useNumberFormatting()
  const [mode, setMode] = useState<'amount' | 'percent'>('amount')
  const movers = useMemo(() => getTopMovers(holdings, mode), [holdings, mode])
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-3">
        <HighlightTitle
          title={t('wfInsights:highlights.movers')}
          description={t('wfInsights:highlights.daily')}
        />
        <div
          className="bg-muted/50 flex rounded-full p-1"
          role="group"
          aria-label={t('wfInsights:highlights.rank_by')}
        >
          {(['amount', 'percent'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
              className={cn(
                'rounded-full px-3 py-1 text-xs transition-colors',
                mode === value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {value === 'amount' ? currency : '%'}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingRows />
        ) : (
          (['gainers', 'losers'] as const).map((group) => (
            <div key={group} className="mt-3 first:mt-0">
              <h3 className="text-muted-foreground text-2xs font-medium tracking-wider uppercase">
                {t(`wfInsights:highlights.${group}`)}
              </h3>
              {movers[group].length === 0 ? (
                <p className="text-muted-foreground py-4 text-xs">
                  {t('wfInsights:highlights.no_moves')}
                </p>
              ) : (
                movers[group].map((holding) => (
                  <HoldingRow
                    key={holding.id}
                    holding={holding}
                    onSecurity={onSecurity}
                  >
                    {holding.dayChange?.local != null ? (
                      <span
                        className={`text-sm font-semibold ${decimalUnits(holding.dayChange.local!) < 0n ? 'expense' : 'income'}`}
                      >
                        {isBalanceHidden ? (
                          '••••'
                        ) : (
                          <Money
                            value={holding.dayChange.local!}
                            currency={currency}
                          />
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                    {isBalanceHidden ? (
                      <span className="text-muted-foreground text-xs">
                        ••••
                      </span>
                    ) : (
                      <span className="min-w-15 justify-center text-xs tabular-nums">
                        {holding.dayChangePct === null
                          ? '—'
                          : formatting.formatPercent(holding.dayChangePct)}
                      </span>
                    )}
                  </HoldingRow>
                ))
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
