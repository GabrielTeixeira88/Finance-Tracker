// SPDX-License-Identifier: AGPL-3.0-only
// Wealthfolio 92b4647 what-changed-stage.tsx: source structured headline and summary renderers.
import type { FC, ReactNode } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { decimalUnits, formatExactPercent } from '@/lib/money'
import { exactAbs, useBalancePrivacy } from '../../../compat'
import {
  PrivacyAmount,
  Skeleton,
  useNumberFormatting,
  useAmountFormatting,
} from '../../../ui'
import { Card } from '@/vendor/wealthfolio/ui/components/ui/card'
import type { FormattingApi } from '@/features/holdings/number-formatters'
import type { HeadlineModel, HeadlineFragment } from '../../../lib/headline'
import type { ChangeDescriptor } from '../../../lib/headline-descriptors'
const CARD_CLASS = 'p-5',
  LABEL_CLASS =
    'text-muted-foreground/70 text-2xs font-semibold uppercase tracking-[0.12em]'
interface HeadlineCardProps {
  headline: HeadlineModel
  currency: string
  isLoading: boolean
}

export const HeadlineCard: FC<HeadlineCardProps> = ({
  headline,
  currency,
  isLoading,
}) => {
  const amountFormatting = useAmountFormatting()
  const numberFormatting = useNumberFormatting()

  const formatting = { ...amountFormatting, ...numberFormatting }

  const { t } = useTranslation()
  const { isBalanceHidden } = useBalancePrivacy()
  if (isLoading) {
    return (
      <Card className={CARD_CLASS}>
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-3 h-16 w-full" />
        <Skeleton className="mt-4 h-4 w-2/3" />
      </Card>
    )
  }

  return (
    <Card className={CARD_CLASS}>
      {headline.metaLabel && (
        <div className={LABEL_CLASS}>{headline.metaLabel}</div>
      )}
      <p
        className={cn(
          'text-foreground max-w-[95%] text-base font-normal leading-snug tracking-tight md:text-lg',
          headline.metaLabel && 'mt-3',
        )}
      >
        {renderHeadlineFragments(
          headline.fragments,
          currency,
          isBalanceHidden,
          t,
          formatting,
        )}
      </p>
      {headline.summary && (
        <HeadlineSummaryLine
          summary={headline.summary}
          currency={currency}
          isBalanceHidden={isBalanceHidden}
        />
      )}
    </Card>
  )
}

function renderHeadlineFragments(
  fragments: HeadlineFragment[],
  currency: string,
  isBalanceHidden: boolean,
  t: TFunction,
  formatting: Pick<FormattingApi, 'formatAmount' | 'formatPercent'>,
): ReactNode {
  return fragments.map((f, i) => {
    switch (f.type) {
      case 'text':
        return <span key={i}>{f.text}</span>
      case 'amount':
        return (
          <span
            key={i}
            className={cn(
              'whitespace-nowrap font-serif font-medium',
              toneClass(f.tone),
            )}
          >
            <PrivacyAmount value={f.value} currency={currency} />
          </span>
        )
      case 'mover': {
        const d = f.descriptor.descriptor
        const phrase = describeMoverPhrase(
          d,
          currency,
          isBalanceHidden,
          t,
          formatting,
        )
        return (
          <span
            key={i}
            className={cn(
              'whitespace-nowrap font-serif font-medium',
              toneClass(f.tone),
            )}
          >
            {f.descriptor.name} {phrase}
          </span>
        )
      }
    }
  })
}

function describeMoverPhrase(
  d: ChangeDescriptor,
  currency: string,
  isBalanceHidden: boolean,
  t: TFunction,
  formatting: Pick<FormattingApi, 'formatAmount' | 'formatPercent'>,
): string {
  const amt = (v: string) =>
    isBalanceHidden ? '••••' : formatting.formatAmount(v, currency)
  switch (d.kind) {
    case 'no_activity':
      return ''
    case 'new':
      return t('wfSpending:whatChanged.phraseAppeared', {
        amount: amt(d.absDelta),
      })
    case 'ended':
      return t('wfSpending:whatChanged.phraseDroppedToZero', {
        amount: amt(d.prior),
      })
    case 'valid': {
      const verb =
        decimalUnits(d.delta) >= 0n
          ? t('wfSpending:whatChanged.up')
          : t('wfSpending:whatChanged.down')
      if (d.showPct && d.pct != null) {
        return `${verb} ${formatExactPercent(exactAbs(d.pct))}`
      }
      return `${verb} ${amt(d.absDelta)}`
    }
  }
}

function toneClass(tone: 'up' | 'down' | 'neutral'): string {
  if (tone === 'up') return 'text-destructive'
  if (tone === 'down') return 'text-success'
  return 'text-foreground'
}

function HeadlineSummaryLine({
  summary,
  currency,
  isBalanceHidden,
}: {
  summary: NonNullable<HeadlineModel['summary']>
  currency: string
  isBalanceHidden: boolean
}) {
  const { t } = useTranslation()
  const renderAmt = (value: string) =>
    isBalanceHidden ? (
      <>••••</>
    ) : (
      <PrivacyAmount value={value} currency={currency} />
    )
  const parts: ReactNode[] = [
    <span key="cur" className="tabular-nums">
      <span className={LABEL_CLASS}>
        {t('wfSpending:whatChanged.thisLabel')}{' '}
      </span>
      {renderAmt(summary.current)}
    </span>,
  ]
  if (summary.prior != null) {
    parts.push(
      <span key="prior" className="text-muted-foreground/80 tabular-nums">
        <span className={LABEL_CLASS}>
          {t('wfSpending:whatChanged.priorLabel')}{' '}
        </span>
        {renderAmt(summary.prior)}
      </span>,
    )
  }
  if (summary.delta != null) {
    const sign = decimalUnits(summary.delta) >= 0n ? '+' : '−'
    const tone =
      decimalUnits(summary.delta) === 0n
        ? 'neutral'
        : decimalUnits(summary.delta) > 0n
          ? 'up'
          : 'down'
    parts.push(
      <span
        key="delta"
        className={cn('font-medium tabular-nums', toneClass(tone))}
      >
        {sign}
        {renderAmt(exactAbs(summary.delta))}
      </span>,
    )
  }
  if (summary.showPct && summary.pct != null) {
    const tone =
      decimalUnits(summary.pct) === 0n
        ? 'neutral'
        : decimalUnits(summary.pct) > 0n
          ? 'up'
          : 'down'
    parts.push(
      <span
        key="pct"
        className={cn('font-medium tabular-nums', toneClass(tone))}
      >
        {formatExactPercent(summary.pct)}
      </span>,
    )
  }
  return (
    <div className="border-border/40 mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 text-sm">
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-3">
          {i > 0 && <span className="text-muted-foreground/40">·</span>}
          {p}
        </span>
      ))}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// Movers — descriptor-backed comparison rows shared by every surface
// ═════════════════════════════════════════════════════════════════════════
