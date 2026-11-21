// SPDX-License-Identifier: AGPL-3.0-only
// Wealthfolio 92b4647 money-flow-section.tsx; source zoom/keyboard/chrome with exact local graph adapter.
import { dayAfter } from '@/lib/spending-period'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Category } from '@/lib/api'
import type { SpendingWorkspaceData } from '../../../api'
import type { BudgetSnapshot } from '../../../types/budget'
import { moneyFlowGraph, focusMoneyFlow } from '../../../lib/money-flow'
import { MoneyFlowChart } from './money-flow-chart'
import { Card } from '@/vendor/wealthfolio/ui/components/ui/card'
import { Button, Icons, Skeleton, useIsMobile } from '../../../ui'
export function MoneyFlowSection({
  report,
  budget,
  categories,
  onCategoryClick,
}: {
  report: SpendingWorkspaceData
  budget?: BudgetSnapshot
  categories: Category[]
  onCategoryClick: (id: string) => void
}) {
  const { t } = useTranslation(),
    isMobile = useIsMobile()
  const [path, setPath] = useState<string[]>([]),
    [returnFocusId, setReturnFocusId] = useState<string | null>(null)
  const focusId = path.at(-1) ?? null
  const graph = useMemo(
    () =>
      moneyFlowGraph(report, categories, budget, (key) =>
        key === 'uncategorized'
          ? t('wfSpending:insightsPage.uncategorized')
          : key === 'other'
            ? t('wfSpending:hero.other')
            : t('wfSpending:moneyFlow.node.' + key),
      ),
    [report, categories, budget, t],
  )
  const focusedGraph = focusId ? focusMoneyFlow(graph, focusId) : null
  const focusedNode = focusedGraph?.nodes.find((node) => node.id === focusId)
  const shownGraph = focusedGraph ?? graph,
    isEmpty = !graph.nodes.length,
    isLoading = false
  const previousName = undefined,
    transactionsCategoryId = focusedNode?.categoryId,
    currency = report.currency
  const subtitle = t('wfSpending:moneyFlow.subtitle', {
    period: report.start + ' — ' + dayAfter(report.end_exclusive, -1),
  })
  const leaveZoom = (depth: number, keyboard: boolean) => {
    if (keyboard) setReturnFocusId(path[depth])
    setPath(path.slice(0, depth))
  }
  if (isEmpty) return null
  return (
    // `#cashflow` is the dashboard's deep link into this section.
    <section
      id="cashflow"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && focusedNode)
          leaveZoom(path.length - 1, true)
      }}
    >
      <header className="mb-3 min-w-0">
        <h2 className="text-foreground truncate text-base font-semibold tracking-tight">
          {focusedNode ? focusedNode.name : t('wfSpending:moneyFlow.title')}
        </h2>
        <p className="text-muted-foreground text-xs">{subtitle}</p>
      </header>

      <Card className="px-2 py-3 md:px-4 md:py-4">
        {focusedNode && (
          // The zoomed node unmounts, so focus lands on the way back: keyed per
          // view so it lands there again one zoom deeper.
          <div
            key={`toolbar:${focusId}`}
            className="mb-2 flex min-w-0 items-center justify-between gap-2"
          >
            <div className="flex min-w-0 items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                autoFocus
                aria-label={
                  previousName
                    ? t('wfSpending:moneyFlow.backTo', { name: previousName })
                    : undefined
                }
                // `detail` is 0 when Enter or Space pressed the button.
                onClick={(event) =>
                  leaveZoom(path.length - 1, event.detail === 0)
                }
                // `Button` is `shrink-0` by default: let a long group name truncate.
                className="h-7 min-w-0 shrink gap-1 px-2.5 text-xs"
              >
                <Icons.ArrowLeft
                  className="size-3.5 shrink-0 rtl:rotate-180"
                  aria-hidden
                />
                <span className="truncate">
                  {previousName ?? t('wfSpending:moneyFlow.back')}
                </span>
              </Button>
              {previousName && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(event) => leaveZoom(0, event.detail === 0)}
                  className="text-muted-foreground h-7 shrink-0 px-2 text-xs"
                >
                  {t('wfSpending:moneyFlow.back')}
                </Button>
              )}
            </div>
            {transactionsCategoryId && onCategoryClick && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 shrink-0 gap-1.5 px-2.5 text-xs"
                onClick={() => onCategoryClick(transactionsCategoryId)}
              >
                <Icons.ReceiptText className="size-3.5" aria-hidden />
                {t('wfSpending:moneyFlow.action.transactions')}
              </Button>
            )}
          </div>
        )}
        {isLoading || !shownGraph ? (
          <MoneyFlowSkeleton />
        ) : (
          <MoneyFlowChart
            // Remount on zoom: replays the reveal and drops hover state.
            key={focusedGraph ? focusId : 'all'}
            graph={shownGraph}
            currency={currency}
            isMobile={isMobile}
            onCategoryClick={onCategoryClick}
            // From the overview a zoom starts afresh, even if a stale one never showed.
            onFocusNode={(id) => setPath(focusedGraph ? [...path, id] : [id])}
            autoFocusNodeId={returnFocusId}
            onAutoFocused={() => setReturnFocusId(null)}
          />
        )}
        {!isLoading &&
          !focusedGraph &&
          !isEmpty &&
          graph.totals.income === 0 && (
            <p className="text-muted-foreground/80 text-2xs px-2 pt-2">
              {t('wfSpending:whereIAm.noIncome')}
            </p>
          )}
      </Card>
    </section>
  )
}

function MoneyFlowSkeleton() {
  return (
    <div className="flex h-75 items-stretch gap-6 px-2 py-2">
      <div className="flex w-1/5 flex-col justify-center gap-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
      <Skeleton className="w-1/5" />
      <div className="flex w-1/5 flex-col justify-between gap-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
      <div className="flex flex-1 flex-col justify-between gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    </div>
  )
}
