// SPDX-License-Identifier: AGPL-3.0-only
// Wealthfolio 92b4647 goals-dashboard-page.tsx; exact per-currency summary and local hooks.
import '../i18n'
import { useBalancePrivacy, Link, exactRatio } from '../compat'
import { ErrorState } from '@/components/primitives'
import { decimalUnits, sumMoney } from '@/lib/money'

import type { SourceGoal as Goal } from '../compat'
import {
  Button,
  Page,
  PageContent,
  PageHeader,
  Skeleton,
  useAmountFormatting,
  useNumberFormatting,
} from '@/features/spending/ui'
import { Icons } from '@/vendor/wealthfolio/ui/components/ui/icons'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { GoalCard } from '../components/goal-card'
import { useGoals } from '../hooks/use-goals'

function StatBlock({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-baseline gap-2.5">
      <span className="text-muted-foreground text-2xs tracking-[0.15em]">
        {label}
      </span>
      <span className="text-foreground font-serif text-base font-semibold tabular-nums">
        {value}
      </span>
    </div>
  )
}

function SummaryStats({ goals }: { goals: Goal[] }) {
  const amountFormatting = useAmountFormatting()
  const numberFormatting = useNumberFormatting()

  const { t } = useTranslation()
  const { isBalanceHidden } = useBalancePrivacy()
  const currency = goals[0]?.currency ?? 'BRL'
  const saved = goals.some((g) => g.summaryCurrentValue === null)
    ? null
    : sumMoney(goals.map((g) => g.summaryCurrentValue!))
  const target = sumMoney(goals.map((g) => g.summaryTargetAmount))
  const overall = saved === null ? null : exactRatio(saved, target)
  const onTrackCount = goals.filter(
    (g) =>
      ['on_track', 'achieved'].includes(g.statusHealth) ||
      g.statusLifecycle === 'achieved',
  ).length

  const savedDisplay = isBalanceHidden
    ? '••••'
    : amountFormatting.formatCompactAmount(saved, currency)
  const targetDisplay = isBalanceHidden
    ? '••••'
    : amountFormatting.formatCompactAmount(target, currency)

  return (
    <div className="mb-6 flex flex-wrap items-baseline gap-x-8 gap-y-2">
      <StatBlock
        label={t('wfGoals:dashboard.stat_saved')}
        value={savedDisplay}
      />
      <StatBlock
        label={t('wfGoals:dashboard.stat_target')}
        value={targetDisplay}
      />
      <StatBlock
        label={t('wfGoals:dashboard.stat_overall')}
        value={numberFormatting.formatPercent(overall)}
      />
      <StatBlock
        label={t('wfGoals:dashboard.stat_on_track')}
        value={`${onTrackCount}/${goals.length}`}
      />
    </div>
  )
}

function GoalGrid({ goals }: { goals: Goal[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {goals.map((goal) => (
        <GoalCard key={goal.id} goal={goal} />
      ))}
    </div>
  )
}

export default function GoalsDashboardPage() {
  const { t } = useTranslation()
  const {
    active,
    atRisk,
    achieved,
    archived,
    isLoading,
    isError,
    error,
    refetch,
  } = useGoals()
  const [archivedOpen, setArchivedOpen] = useState(false)
  if (isError)
    return <ErrorState text={error.message} retry={() => void refetch()} />

  if (isLoading) {
    return (
      <Page>
        <PageHeader
          heading={t('wfGoals:goals')}
          text={t('wfGoals:dashboard.subtitle')}
        />
        <PageContent>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64 w-full rounded-xl" />
            ))}
          </div>
        </PageContent>
      </Page>
    )
  }

  // Merge all non-archived goals into one flat list, sorted by target amount DESC.
  const allActive = [...atRisk, ...active, ...achieved].sort((a, b) => {
    const aTarget = a.summaryTargetAmount
    const bTarget = b.summaryTargetAmount
    if (decimalUnits(aTarget) !== decimalUnits(bTarget))
      return decimalUnits(bTarget) > decimalUnits(aTarget) ? 1 : -1
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })
  const hasGoals = allActive.length > 0 || archived.length > 0

  return (
    <Page>
      <PageHeader
        heading={t('wfGoals:goals')}
        text={t('wfGoals:dashboard.subtitle')}
        actions={
          <Link to="/goals/new">
            <Button size="sm">
              <Icons.Plus className="me-1 h-4 w-4" />
              {t('wfGoals:dashboard.new_goal')}
            </Button>
          </Link>
        }
      />
      <PageContent>
        {!hasGoals ? (
          <div className="flex flex-col items-center justify-center gap-5 py-28 text-center">
            <div className="bg-muted/60 flex h-16 w-16 items-center justify-center rounded-2xl">
              <Icons.Target className="text-muted-foreground h-8 w-8" />
            </div>
            <div className="space-y-2">
              <p className="text-lg font-semibold">
                {t('wfGoals:dashboard.empty_title')}
              </p>
              <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
                {t('wfGoals:dashboard.empty_description')}
              </p>
            </div>
            <Link to="/goals/new">
              <Button size="lg" className="mt-2">
                <Icons.Plus className="me-2 h-4 w-4" />
                {t('wfGoals:dashboard.create_first_goal')}
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {allActive.length > 0 && (
              <div>
                {[...new Set(allActive.map((g) => g.currency))].map(
                  (currency) => (
                    <SummaryStats
                      key={currency}
                      goals={allActive.filter((g) => g.currency === currency)}
                    />
                  ),
                )}
                <GoalGrid goals={allActive} />
              </div>
            )}

            {archived.length > 0 && (
              <section>
                <button
                  aria-expanded={archivedOpen}
                  aria-controls="archived-goals"
                  onClick={() => setArchivedOpen((o) => !o)}
                  className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-xs font-medium transition-colors"
                >
                  <Icons.ChevronRight
                    className={`h-3.5 w-3.5 transition-transform ${archivedOpen ? 'rotate-90' : 'rtl:rotate-180'}`}
                  />
                  {t('wfGoals:dashboard.archived_count', {
                    count: archived.length,
                  })}
                </button>
                {archivedOpen && (
                  <div className="mt-3" id="archived-goals">
                    <GoalGrid goals={archived} />
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </PageContent>
    </Page>
  )
}
