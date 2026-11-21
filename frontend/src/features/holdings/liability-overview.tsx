// SPDX-License-Identifier: AGPL-3.0-only
// Wealthfolio 92b4647 liability-overview.tsx. Recorded balances replace the postponed amortization engine.
import { cn } from '@/lib/utils'
import { compareExact } from './compat'
import { formatExactPercent } from '@/lib/money'
import { useMemo, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from './local-link'
import {
  Card,
  Skeleton,
  useAmountFormatting,
  useDateFormatting,
  useNumberFormatting,
} from './ui'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/vendor/wealthfolio/ui/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/vendor/wealthfolio/ui/components/ui/dropdown-menu'
import { Icons, type Icon } from '@/vendor/wealthfolio/ui/components/ui/icons'
import { ProgressBar } from './progress-bar'
import { useBalancePrivacy } from './compat'
import type { ManualHolding } from './api'
import { useLoanToday } from './recorded-liabilities'
import {
  liabilityCardModel,
  liabilitySummary,
  type LiabilityCardModel,
  type LiabilityStatus,
} from './recorded-liabilities'

const TYPE_ICONS: Record<string, Icon> = {
  mortgage: Icons.House,
  heloc: Icons.HouseLineDuotone,
  auto_loan: Icons.VehicleDuotone,
  student_loan: Icons.GraduationCapDuotone,
  personal_loan: Icons.HandCoinsDuotone,
  credit_card: Icons.LiabilityDuotone,
}

const STATUS_STYLES: Record<LiabilityStatus, string> = {
  paid_off: 'bg-success text-success-foreground',
  renewal_due: 'bg-warning text-warning-foreground',
  renew_soon: 'bg-warning text-warning-foreground',
  update_balance: 'bg-warning text-warning-foreground',
}

interface LiabilityOverviewProps {
  holdings: ManualHolding[]
  isLoading: boolean
  onEdit: (holding: ManualHolding) => void
  onViewHistory: (holding: ManualHolding) => void
  onDelete: (holding: ManualHolding) => void
  isDeleting?: boolean
}

/** Liabilities as cards in the style of the goals dashboard, largest balance first. */
export function LiabilityOverview({
  holdings,
  isLoading,
  onEdit,
  onViewHistory,
  onDelete,
  isDeleting = false,
}: LiabilityOverviewProps) {
  const { t } = useTranslation()
  const [toDelete, setToDelete] = useState<ManualHolding | null>(null)
  const today = useLoanToday()
  const cards = useMemo(
    () =>
      holdings
        .map((holding) => ({
          holding,
          model: liabilityCardModel(holding, today),
        }))
        .sort((left, right) =>
          compareExact(right.model.balance, left.model.balance),
        ),
    [holdings, today],
  )

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-44 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <>
      <LiabilitySummaryStats cards={cards} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ holding, model }) => (
          <LiabilityCard
            key={holding.id}
            holding={holding}
            model={model}
            onEdit={onEdit}
            onViewHistory={onViewHistory}
            onDelete={setToDelete}
          />
        ))}
      </div>
      <AlertDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('holdingsMigration:closeRecord')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              <Trans
                i18nKey="holdingsMigration:closeDetails"
                values={{ name: toDelete?.name }}
                components={{ bold: <span className="font-semibold" /> }}
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t('wfCommon:cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (toDelete) onDelete(toDelete)
                setToDelete(null)
              }}
              disabled={isDeleting}
              variant="destructive"
            >
              {t('holdingsMigration:closeRecord')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2.5">
      <span className="text-muted-foreground text-2xs tracking-[0.15em] uppercase">
        {label}
      </span>
      <span className="text-foreground text-sm font-semibold tabular-nums">
        {value}
      </span>
    </div>
  )
}

/** Totals only when every liability shares a currency; they cannot be added up otherwise. */
function LiabilitySummaryStats({
  cards,
}: {
  cards: { holding: ManualHolding; model: LiabilityCardModel }[]
}) {
  const { t } = useTranslation()
  const amounts = useAmountFormatting()
  const numbers = useNumberFormatting()
  const { isBalanceHidden } = useBalancePrivacy()
  const currency = cards[0]?.holding.currency
  if (
    !currency ||
    cards.some(
      ({ holding, model }) =>
        holding.currency !== currency || !model.balanceAvailable,
    )
  )
    return null
  const summary = liabilitySummary(cards.map(({ model }) => model))
  const money = (value: string | null) =>
    isBalanceHidden ? '••••' : amounts.formatCompactAmount(value, currency)
  return (
    <div className="mb-6 flex flex-wrap items-baseline gap-x-8 gap-y-2">
      <StatBlock
        label={t('wfHoldings:liability_cards.owed')}
        value={money(summary.owed)}
      />
      <StatBlock
        label={t('holdingsMigration:recordedReduction')}
        value={money(summary.paidDown)}
      />
      {summary.overall != null && (
        <StatBlock
          label={t('wfHoldings:liability_cards.overall')}
          value={numbers.formatPercent(summary.overall)}
        />
      )}
      {summary.monthly !== null && (
        <StatBlock
          label={t('wfHoldings:liability_cards.monthly')}
          value={`≈ ${money(summary.monthly)}`}
        />
      )}
    </div>
  )
}

function LiabilityCard({
  holding,
  model,
  onEdit,
  onViewHistory,
  onDelete,
}: {
  holding: ManualHolding
  model: LiabilityCardModel
  onEdit: (holding: ManualHolding) => void
  onViewHistory: (holding: ManualHolding) => void
  onDelete: (holding: ManualHolding) => void
}) {
  const { t } = useTranslation()
  const amounts = useAmountFormatting()
  const numbers = useNumberFormatting()
  const dates = useDateFormatting()
  const { isBalanceHidden } = useBalancePrivacy()
  const payoff = model.payoffDate
  const money = (value: string | null) =>
    isBalanceHidden ? '••••' : amounts.formatAmount(value, holding.currency)
  const TypeIcon = TYPE_ICONS[model.type] ?? Icons.ReceiptDuotone
  const typeKey = `wfAsset:altContent.liabilityType.${model.type}`
  const meta = [
    t(typeKey, { defaultValue: t('wfAsset:altContent.liabilityType.other') }),
    model.rate != null ? formatExactPercent(model.rate, 2, true) : null,
    model.scheduled
      ? payoff &&
        t('wfHoldings:liability_cards.debt_free', {
          date: dates.formatCalendarDate(payoff, {
            month: 'short',
            year: 'numeric',
          }),
        })
      : !model.balanceAvailable
        ? t('wfAsset:loanOverview.unavailable')
        : t(
            holding.observations.length === 1
              ? 'wfHoldings:liability_cards.original_balance'
              : 'wfHoldings:liability_cards.updated',
            {
              date: dates.formatCalendarDate(
                holding.valuationDate?.slice(0, 10) ?? null,
                {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                },
              ),
            },
          ),
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Card className="relative overflow-hidden p-0 transition-shadow hover:shadow-md">
      <div className="px-4 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="bg-muted/60 flex size-10 items-center justify-center rounded-lg">
              <TypeIcon size={22} className="text-foreground/80" />
            </div>
            {model.status && (
              <span
                className={cn(
                  'text-2xs inline-flex h-5 items-center px-2 font-medium uppercase leading-none tracking-[0.14em]',
                  STATUS_STYLES[model.status],
                )}
              >
                {t(`wfHoldings:liability_cards.status_${model.status}`)}
              </span>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="hover:bg-muted text-muted-foreground relative z-10 inline-flex size-8 items-center justify-center rounded-md transition"
                  aria-label={t('wfHoldings:open_actions')}
                />
              }
            >
              <Icons.MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* Confirming on the loan page keeps its validation and balance provenance. */}
              <DropdownMenuItem
                render={
                  <Link
                    to={`/holdings/${encodeURIComponent(holding.id)}?action=confirm-balance`}
                  />
                }
              >
                <Icons.DollarSign className="me-2 size-4" />
                {t('wfHoldings:liability_cards.update_balance')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onViewHistory(holding)}>
                <Icons.History className="me-2 size-4" />
                {t('wfAsset:loanOverview.history')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(holding)}>
                <Icons.Pencil className="me-2 size-4" />
                {t('wfHoldings:edit_details')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(holding)}
              >
                <Icons.Trash className="me-2 size-4" />
                {t('holdingsMigration:closeRecord')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* The title's link covers the card; the actions button sits above it. */}
            <h3 className="truncate text-base leading-tight font-semibold">
              <Link
                to={`/holdings/${encodeURIComponent(holding.id)}`}
                className="focus-visible:ring-ring rounded-sm after:absolute after:inset-0 focus-visible:ring-2 focus-visible:outline-none"
              >
                {holding.name}
              </Link>
            </h3>
            <p className="text-muted-foreground text-2xs mt-0.5 truncate tracking-[0.15em] uppercase">
              {meta}
            </p>
          </div>
          {model.paidShare != null && (
            <div className="text-end">
              <div className="text-success text-lg leading-none font-semibold tabular-nums">
                {numbers.formatPercent(model.paidShare, { digits: 1 })}
              </div>
              <div className="text-muted-foreground text-2xs mt-0.5 tracking-[0.15em] uppercase">
                {t('holdingsMigration:recordedReduction')}
              </div>
            </div>
          )}
        </div>

        <div className="mt-2.5 flex items-end justify-between gap-3">
          <div>
            <div className="text-sm font-semibold tabular-nums">
              {model.balanceAvailable
                ? money(model.balance)
                : t('wfAsset:loanOverview.unavailable')}
            </div>
            <div className="text-muted-foreground text-2xs mt-0.5">
              {model.original != null
                ? t('holdingsMigration:firstRecordedBalance', {
                    amount: money(model.original),
                  })
                : t('wfHoldings:liability_cards.owed_now')}
            </div>
          </div>
          <div className="text-end">
            {model.payment != null && model.frequency ? (
              <>
                <div className="text-sm font-semibold tabular-nums">
                  {money(model.payment)}
                </div>
                <div className="text-muted-foreground text-2xs mt-0.5">
                  {t('holdingsMigration:recordedDebt')}
                </div>
              </>
            ) : (
              <>
                <div className="text-muted-foreground text-sm font-semibold">
                  {t('wfHoldings:liability_cards.manual')}
                </div>
                <div className="text-muted-foreground text-2xs mt-0.5">
                  {t('wfHoldings:liability_cards.manual_hint')}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="mt-2.5">
        <ProgressBar progress={model.paidShare ?? '0'} fillClass="bg-success" />
      </div>
    </Card>
  )
}
