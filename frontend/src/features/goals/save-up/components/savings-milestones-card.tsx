// SPDX-License-Identifier: AGPL-3.0-only
// Wealthfolio 92b4647 savings-milestones-card.tsx: desktop/mobile milestone rail JSX.
// Exact decimal amounts and read-only history labels are provided by local adapters.
import '../../i18n'
import { useTranslation } from 'react-i18next'
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
} from '@/vendor/wealthfolio/ui/components/ui/card'
import { Icons } from '@/vendor/wealthfolio/ui/components/ui/icons'
import { AmountDisplay } from '@/features/holdings/formatting'
import { decimalUnits } from '@/lib/money'
export interface SavingsMilestone {
  ratio: number
  label: string
  amount: string
  dateLabel: string
  reached: boolean
  isFinal: boolean
}
export function SavingsMilestonesCard({
  milestones,
  currentValue,
  currency,
  isHidden,
}: {
  milestones: SavingsMilestone[]
  currentValue: string | null
  currency: string
  isHidden: boolean
}) {
  const { t } = useTranslation()
  const railPositions = milestones.map(
    (_, i) => (i / (milestones.length - 1)) * 100,
  )
  const railFillPct = computeRailFillPct(
    milestones,
    currentValue,
    railPositions,
  )

  return (
    <Card>
      <CardHeader>
        <div className="text-muted-foreground mb-1 text-xs font-medium tracking-[0.15em] uppercase">
          {t('wfGoals:milestones.kicker')}
        </div>
        <CardTitle className="text-md leading-none tracking-tight">
          {t('wfGoals:milestones.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-7">
        {/* ── Desktop: horizontal timeline ── */}
        <div className="hidden md:block">
          {/*
            Layout anchors — rail center and dot center share y=32px.
            Above y=32: % label.
            Below y=32: amount + date.
          */}
          <div className="relative mx-16 h-27">
            <div className="bg-muted absolute start-0 end-0 top-8 h-[3px] -translate-y-1/2 rounded-full" />
            <div
              className="bg-success absolute start-0 top-8 h-[3px] -translate-y-1/2 rounded-full transition-[width] duration-500 ease-out"
              style={{ width: `${railFillPct}%` }}
            />
            {milestones.map((m, i) => {
              const left = `${railPositions[i]}%`
              return (
                <div key={m.ratio}>
                  <div
                    className={`text-2xs absolute top-0 -translate-x-1/2 font-semibold tracking-wider whitespace-nowrap uppercase rtl:translate-x-1/2 ${
                      m.reached ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                    style={{ insetInlineStart: left }}
                  >
                    {m.label}
                  </div>
                  <div
                    className="absolute top-8 -translate-x-1/2 -translate-y-1/2 rtl:translate-x-1/2"
                    style={{ insetInlineStart: left }}
                  >
                    <MilestoneDot milestone={m} />
                  </div>
                  <div
                    className="absolute top-13 flex -translate-x-1/2 flex-col items-center whitespace-nowrap rtl:translate-x-1/2"
                    style={{ insetInlineStart: left }}
                  >
                    <span className="text-sm font-semibold tabular-nums">
                      <AmountDisplay
                        value={m.amount}
                        currency={currency}
                        isHidden={isHidden}
                      />
                    </span>
                    <span
                      className={`mt-0.5 text-xs ${
                        m.reached ? 'text-success' : 'text-muted-foreground'
                      }`}
                    >
                      {m.dateLabel}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Mobile: vertical timeline ── */}
        <div className="md:hidden">
          <ol className="relative space-y-4">
            <span className="bg-muted absolute start-[0.9375rem] top-2 bottom-2 w-[2px] -translate-x-1/2 rounded-full rtl:translate-x-1/2" />
            <span
              className="bg-success absolute start-[0.9375rem] top-2 w-[2px] -translate-x-1/2 rounded-full transition-[height] duration-500 ease-out rtl:translate-x-1/2"
              style={{ height: `calc((100% - 1rem) * ${railFillPct / 100})` }}
            />
            {milestones.map((m) => (
              <li key={m.ratio} className="relative flex items-start gap-4">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                  <MilestoneDot milestone={m} />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={`text-xs font-semibold tracking-wider uppercase ${
                        m.reached ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {m.label}
                    </span>
                    <span
                      className={`text-xs ${m.reached ? 'text-success' : 'text-muted-foreground'}`}
                    >
                      {m.dateLabel}
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-semibold tabular-nums">
                    <AmountDisplay
                      value={m.amount}
                      currency={currency}
                      isHidden={isHidden}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </CardContent>
    </Card>
  )
}

function MilestoneDot({ milestone }: { milestone: SavingsMilestone }) {
  const { reached, isFinal } = milestone

  if (isFinal) {
    return (
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
          reached
            ? 'border-success bg-success text-success-foreground'
            : 'border-muted-foreground/40 bg-background text-muted-foreground'
        }`}
        aria-hidden
      >
        <Icons.Target className="h-3 w-3" />
      </span>
    )
  }

  return (
    <span
      className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
        reached
          ? 'border-success bg-success text-success-foreground'
          : 'border-muted-foreground/30 bg-background'
      }`}
      aria-hidden
    >
      {reached ? (
        <Icons.Check className="h-3 w-3" strokeWidth={3} />
      ) : (
        <span className="bg-muted-foreground/40 h-1.5 w-1.5 rounded-full" />
      )}
    </span>
  )
}

function computeRailFillPct(
  milestones: SavingsMilestone[],
  currentValue: string | null,
  positions: number[],
) {
  if (!milestones.length || currentValue === null) return 0
  const current = decimalUnits(currentValue)
  if (current <= decimalUnits(milestones[0].amount)) return 0
  for (let i = 1; i < milestones.length; i++) {
    const lower = decimalUnits(milestones[i - 1].amount),
      upper = decimalUnits(milestones[i].amount)
    if (current < upper) {
      const ratio =
        upper === lower
          ? 0
          : Number(((current - lower) * 1000000n) / (upper - lower)) / 1000000
      return positions[i - 1] + ratio * (positions[i] - positions[i - 1])
    }
  }
  return 100
}
