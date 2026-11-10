// SPDX-License-Identifier: AGPL-3.0-only
// Wealthfolio 92b4647 save-up-detail.tsx: retained workspace, hero, callouts,
// sidebar and input JSX. Exact local preview/save hooks replace upstream math.
import '../../i18n'
import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { GoalDetail } from '@/lib/wealth-api'
import {
  AmountDisplay,
  useNumberFormatting,
  useDateFormatting,
} from '@/features/holdings/ui'
import { Button, Icons } from '@/features/spending/ui'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/vendor/wealthfolio/ui/components/ui/card'
import { DatePickerInput } from '@/vendor/wealthfolio/ui/components/ui/date-picker-input'
import { ErrorState } from '@/components/primitives'
import { decimalUnits, subtractMoney, formatMoneyParts } from '@/lib/money'
import { formatDateISO } from '@/features/spending/lib/calendar-adapter'
import {
  useBalancePrivacy,
  sourceGoal,
  safePercent,
  exactAbs,
} from '../../compat'
import { useGoalWrite, getPreview, planDraft, type PlanDraft } from '../../api'
import { GoalLeverRow as LeverRow } from '../../components/goal-lever-row'
import { sliderMaxFor } from '../../lib/exact-slider'
import {
  sourceProjection,
  buildSavingsMilestones,
  saveUpStatus,
} from '../../lib/save-up-adapter'
import { SaveUpProjectionCard } from './save-up-projection-card'
import { SavingsMilestonesCard } from './savings-milestones-card'
import { GoalFundingEditor } from '../../components/goal-funding-editor'
import { useDraftGuard } from '../../hooks/use-draft-guard'
const SAVE_UP_MAX_TARGET_AMOUNT = '999999999999999999.999999'
const SAVE_UP_MAX_MONTHLY_CONTRIBUTION = SAVE_UP_MAX_TARGET_AMOUNT
function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
export default function SaveUpDetailPage({
  overview,
}: {
  overview: GoalDetail
}) {
  const { t } = useTranslation(),
    { isBalanceHidden } = useBalancePrivacy(),
    numberFormatting = useNumberFormatting(),
    dateFormatting = useDateFormatting()
  const goal = sourceGoal(overview),
    plan = overview.plan,
    currency = goal.currency,
    currentValue = overview.saved,
    annualReturn = '0'
  const initial = planDraft(overview)
  const [targetAmount, setTargetAmount] = useState(initial.target),
    [targetDate, setTargetDate] = useState(initial.deadline ?? ''),
    [monthlyContribution, setMonthlyContribution] = useState(initial.monthly),
    [isEditingPlan, setIsEditingPlan] = useState(false)
  const key = JSON.stringify(initial),
    [lastKey, setLastKey] = useState(key)
  if (!isEditingPlan && key !== lastKey) {
    setLastKey(key)
    setTargetAmount(initial.target)
    setTargetDate(initial.deadline ?? '')
    setMonthlyContribution(initial.monthly)
  }
  const draft = useMemo<PlanDraft>(
    () => ({
      target: targetAmount,
      deadline: targetDate || null,
      monthly: monthlyContribution,
      goal_type: initial.goal_type,
    }),
    [targetAmount, targetDate, monthlyContribution, initial.goal_type],
  )
  const debounced = useDebouncedValue(draft, 250)
  const previewQuery = useQuery({
    queryKey: ['goal-preview', goal.id, debounced],
    queryFn: ({ signal }) => getPreview(goal.id, debounced, signal),
    enabled: isEditingPlan,
    retry: false,
  })
  const previewPending =
      isEditingPlan && (draft !== debounced || previewQuery.isFetching),
    previewUnavailable = isEditingPlan && previewQuery.isError
  const shown = isEditingPlan ? previewQuery.data : overview
  const projection = shown ? sourceProjection(shown) : null
  const chartData = projection?.trajectory ?? []
  const savingsMilestones = shown ? buildSavingsMilestones(shown, t) : []
  const isPlanDirty =
    decimalUnits(targetAmount) !== decimalUnits(initial.target) ||
    (targetDate || null) !== initial.deadline ||
    decimalUnits(monthlyContribution) !== decimalUnits(initial.monthly)
  const savePlanMutation = useGoalWrite(),
    actionPending =
      savePlanMutation.isPending || previewPending || previewUnavailable
  const actionPendingLabel = previewUnavailable
    ? t('wfGoals:save_up.preview_failed')
    : previewPending
      ? t('wfGoals:save_up.previewing')
      : t('wfGoals:save_up.saving')
  const handleSave = () => {
    if (
      actionPending ||
      document.querySelector('.goals-workspace [aria-invalid="true"]')
    )
      return
    savePlanMutation.mutate(
      { path: '/goals/' + goal.id + '/plan', method: 'PUT', data: draft },
      { onSuccess: () => setIsEditingPlan(false) },
    )
  }
  const handleCancelEdit = () => {
    savePlanMutation.reset()
    setTargetAmount(initial.target)
    setTargetDate(initial.deadline ?? '')
    setMonthlyContribution(initial.monthly)
    setIsEditingPlan(false)
  }
  useDraftGuard(isEditingPlan && isPlanDirty, handleCancelEdit)
  const displayProgress =
    currentValue === null
      ? 0
      : decimalUnits(targetAmount) === 0n
        ? 1
        : safePercent(currentValue, targetAmount)
  const remainingNow =
    currentValue === null
      ? null
      : decimalUnits(targetAmount) > decimalUnits(currentValue)
        ? subtractMoney(targetAmount, currentValue)
        : '0'
  const { targetDateLabel, finishLabel } = formatGoalDates(
    targetDate,
    projection?.projectedCompletionDate,
    dateFormatting,
  )
  const status = saveUpStatus(
    {
      title: goal.title,
      saved: currentValue,
      target: targetAmount,
      deadline: targetDate,
      dateLabel: targetDateLabel,
      health: projection?.health ?? 'unavailable',
      lifecycle: overview.goal.status,
    },
    t,
  )
  const projectedGap =
    projection?.projectedValueAtTargetDate === null || !projection
      ? null
      : subtractMoney(projection.projectedValueAtTargetDate, targetAmount)
  const monthlyDifference =
    projection?.requiredMonthlyContribution === null || !projection
      ? null
      : subtractMoney(
          projection.requiredMonthlyContribution,
          monthlyContribution,
        )
  const monthlyDifferenceLabel = t(
    'wfGoals:save_up.' +
      (monthlyDifference === null || decimalUnits(monthlyDifference) === 0n
        ? 'monthly_difference'
        : decimalUnits(monthlyDifference) > 0n
          ? 'monthly_gap'
          : 'monthly_cushion'),
  )
  const monthlyDifferenceClass =
    monthlyDifference === null || decimalUnits(monthlyDifference) === 0n
      ? 'text-foreground font-semibold'
      : decimalUnits(monthlyDifference) > 0n
        ? 'text-destructive font-semibold'
        : 'text-success font-semibold'
  const gapMetricLabel = t(
    'wfGoals:save_up.' +
      (projectedGap === null
        ? 'remaining'
        : decimalUnits(projectedGap) >= 0n
          ? 'surplus'
          : 'gap'),
  )
  const gapMetricValue =
    projectedGap === null ? remainingNow : exactAbs(projectedGap)
  const moneyPrefix = formatMoneyParts('0', currency).find(
    (part) => part.type === 'currency',
  )?.value
  return (
    <div
      className="grid grid-cols-1 gap-6 lg:grid-cols-3"
      aria-busy={previewPending}
    >
      {/* ── Main column ── */}
      <div className="space-y-6 lg:col-span-2">
        {/* Hero card */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="p-6">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.badgeClass}`}
                  >
                    {status.label}
                  </span>
                  <span className="text-muted-foreground text-xs font-medium tracking-[0.15em] uppercase">
                    {t('wfGoals:save_up.savings_plan')}
                  </span>
                </div>
                <h2 className="font-serif text-2xl leading-tight tracking-tight">
                  {status.headlinePrefix}{' '}
                  <span className={status.textClass}>
                    {status.headlineEmphasis}
                  </span>
                  {status.headlineSuffix}
                </h2>
                <p className="text-muted-foreground mt-4 max-w-3xl text-sm leading-6">
                  {t('wfGoals:save_up.summary_prefix')}{' '}
                  <AmountDisplay
                    value={monthlyContribution}
                    currency={currency}
                    isHidden={isBalanceHidden}
                    className="text-foreground font-semibold"
                  />
                  {t('wfGoals:save_up.summary_per_month')}{' '}
                  {projection && targetDateLabel && projectedGap !== null ? (
                    decimalUnits(projectedGap) >= 0n ? (
                      <>
                        {t('wfGoals:save_up.summary_projected_prefix')}{' '}
                        <AmountDisplay
                          value={projectedGap}
                          currency={currency}
                          isHidden={isBalanceHidden}
                          className="text-success font-semibold"
                        />{' '}
                        {t('wfGoals:save_up.summary_above_target', {
                          date: targetDateLabel,
                        })}
                      </>
                    ) : (
                      <>
                        {t('wfGoals:save_up.summary_projected_prefix')}{' '}
                        <AmountDisplay
                          value={exactAbs(projectedGap)}
                          currency={currency}
                          isHidden={isBalanceHidden}
                          className="text-destructive font-semibold"
                        />{' '}
                        {t('wfGoals:save_up.summary_short_by', {
                          date: targetDateLabel,
                        })}
                      </>
                    )
                  ) : (
                    t('wfGoals:save_up.summary_set_target')
                  )}
                </p>
                <div
                  className="bg-muted mt-5 h-2 overflow-hidden rounded-full"
                  role="progressbar"
                  aria-label={t('wfGoals:save_up.saved')}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={
                    currentValue === null ? undefined : displayProgress * 100
                  }
                >
                  <div
                    className={`h-full rounded-full ${status.progressClass}`}
                    style={{ width: `${displayProgress * 100}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="border-border grid grid-cols-2 divide-x divide-y border-t md:grid-cols-4 md:divide-y-0">
              <HeroMetric label={t('wfGoals:save_up.saved')}>
                <AmountDisplay
                  value={currentValue}
                  currency={currency}
                  isHidden={isBalanceHidden}
                />
              </HeroMetric>
              <HeroMetric label={t('wfGoals:save_up.target')}>
                {decimalUnits(targetAmount) > 0n ? (
                  <AmountDisplay
                    value={targetAmount}
                    currency={currency}
                    isHidden={isBalanceHidden}
                  />
                ) : (
                  t('wfGoals:save_up.not_set')
                )}
              </HeroMetric>
              <HeroMetric label={gapMetricLabel}>
                <AmountDisplay
                  value={gapMetricValue}
                  currency={currency}
                  isHidden={isBalanceHidden}
                />
              </HeroMetric>
              <HeroMetric label={t('wfGoals:save_up.target_date')}>
                {targetDateLabel ?? t('wfGoals:save_up.not_set')}
              </HeroMetric>
            </div>
          </CardContent>
        </Card>

        {projection && monthlyDifference !== null && (
          <MonthlyPlanCallout
            currentMonthly={monthlyContribution}
            neededMonthly={projection.requiredMonthlyContribution}
            monthlyDifference={monthlyDifference}
            monthlyDifferenceLabel={monthlyDifferenceLabel}
            monthlyDifferenceClass={monthlyDifferenceClass}
            finishLabel={finishLabel}
            currency={currency}
            isHidden={isBalanceHidden}
          />
        )}

        {/* Projection chart */}
        {chartData.length > 0 && (
          <SaveUpProjectionCard
            data={chartData}
            currency={currency}
            isHidden={isBalanceHidden}
            annualReturn={annualReturn}
          />
        )}

        {savingsMilestones.length > 0 && (
          <SavingsMilestonesCard
            milestones={savingsMilestones}
            currentValue={currentValue}
            currency={currency}
            isHidden={isBalanceHidden}
          />
        )}

        {!plan && !projection && (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-muted-foreground text-sm">
                {t('wfGoals:save_up.configure_plan')}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Sidebar ── */}
      <div className="space-y-6 lg:sticky lg:top-6 lg:col-span-1 lg:self-start">
        <SidebarCard
          kicker={t('wfGoals:save_up.plan_kicker')}
          title={t('wfGoals:save_up.savings_inputs')}
          editing={isEditingPlan}
          onEdit={() => setIsEditingPlan(true)}
          onSave={handleSave}
          onCancel={handleCancelEdit}
          dirty={isPlanDirty}
          pending={actionPending}
          pendingLabel={actionPendingLabel}
          readContent={
            <div className="divide-border divide-y">
              <SidebarRow label={t('wfGoals:save_up.field_target_amount')}>
                <AmountDisplay
                  value={targetAmount}
                  currency={currency}
                  isHidden={isBalanceHidden}
                />
              </SidebarRow>
              <SidebarRow label={t('wfGoals:save_up.field_target_date')}>
                {targetDateLabel ?? t('wfGoals:save_up.not_set')}
              </SidebarRow>
              <SidebarRow
                label={t('wfGoals:save_up.field_monthly_contribution')}
              >
                <AmountDisplay
                  value={monthlyContribution}
                  currency={currency}
                  isHidden={isBalanceHidden}
                />
                <span className="text-muted-foreground font-normal">
                  {t('wfGoals:save_up.per_month_suffix')}
                </span>
              </SidebarRow>
              <SidebarRow label={t('wfGoals:save_up.field_expected_return')}>
                {numberFormatting.formatPercent(annualReturn, { digits: 1 })}
              </SidebarRow>
            </div>
          }
          editContent={
            <>
              <LeverRow
                label={t('wfGoals:save_up.field_target_amount')}
                hint={t('wfGoals:save_up.hint_target_amount')}

                value={targetAmount}
                onChange={setTargetAmount}
                min="0"
                max={sliderMaxFor(
                  decimalUnits(targetAmount) > decimalUnits(currentValue ?? '0')
                    ? targetAmount
                    : (currentValue ?? targetAmount),
                  '100000',
                  '25000',
                )}
                inputMax={SAVE_UP_MAX_TARGET_AMOUNT}
                step="100"
                prefix={moneyPrefix}
                format={(v) => numberFormatting.formatDecimal(v)}
              />
              <DateRow
                label={t('wfGoals:save_up.field_target_date')}
                hint={t('wfGoals:save_up.hint_target_date')}
                value={targetDate}
                onChange={setTargetDate}
              />
              <LeverRow
                label={t('wfGoals:save_up.field_monthly_contribution')}
                hint={t('wfGoals:save_up.hint_monthly_contribution')}

                value={monthlyContribution}
                onChange={setMonthlyContribution}
                min="0"
                max={sliderMaxFor(monthlyContribution, '5000', '500')}
                inputMax={SAVE_UP_MAX_MONTHLY_CONTRIBUTION}
                step="25"
                prefix={moneyPrefix}
                format={(v) => numberFormatting.formatDecimal(v)}
              />
              <LeverRow
                label={t('wfGoals:save_up.field_expected_annual_return')}
                hint={t('goalsMigration:returnsDeferred')}
                value="0"
                onChange={() => {}}
                min="0"
                max="0"
                suffix="%"
                disabled
              />
            </>
          }
        />

        {/* Funding */}
        <GoalFundingEditor goalId={goal.id} />
      </div>
      <div className="text-muted-foreground text-xs lg:col-span-3">
        {t('goalsMigration:scenario')}
        {previewUnavailable && (
          <ErrorState
            text={previewQuery.error.message}
            retry={() => void previewQuery.refetch()}
          />
        )}
        {savePlanMutation.isError && (
          <ErrorState text={savePlanMutation.error.message} />
        )}
      </div>
    </div>
  )
}

function HeroMetric({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0 px-5 py-4">
      <div className="text-muted-foreground text-2xs font-semibold tracking-wider uppercase">
        {label}
      </div>
      <div className="mt-2 truncate text-lg font-semibold tabular-nums">
        {children}
      </div>
    </div>
  )
}

function MonthlyPlanCallout({
  currentMonthly,
  neededMonthly,
  monthlyDifference,
  monthlyDifferenceLabel,
  monthlyDifferenceClass,
  finishLabel,
  currency,
  isHidden,
}: {
  currentMonthly: string
  neededMonthly: string | null
  monthlyDifference: string
  monthlyDifferenceLabel: string
  monthlyDifferenceClass: string
  finishLabel: string | null
  currency: string
  isHidden: boolean
}) {
  const { t } = useTranslation()
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="text-muted-foreground mb-1 text-xs font-medium tracking-[0.15em] uppercase">
              {t('wfGoals:save_up.action')}
            </div>
            <h3 className="text-md leading-none font-semibold tracking-tight">
              {t('wfGoals:save_up.monthly_plan')}
            </h3>
          </div>

          <div className="grid flex-1 grid-cols-2 gap-3 md:max-w-3xl md:grid-cols-4">
            <CalloutMetric label={t('wfGoals:save_up.current')}>
              <AmountDisplay
                value={currentMonthly}
                currency={currency}
                isHidden={isHidden}
              />
              <span className="text-muted-foreground font-normal">
                {t('wfGoals:save_up.per_month_suffix')}
              </span>
            </CalloutMetric>
            <CalloutMetric label={t('wfGoals:save_up.needed')}>
              <AmountDisplay
                value={neededMonthly}
                currency={currency}
                isHidden={isHidden}
              />
              <span className="text-muted-foreground font-normal">
                {t('wfGoals:save_up.per_month_suffix')}
              </span>
            </CalloutMetric>
            <CalloutMetric label={monthlyDifferenceLabel}>
              <AmountDisplay
                value={exactAbs(monthlyDifference)}
                currency={currency}
                isHidden={isHidden}
                className={monthlyDifferenceClass}
              />
              <span className="text-muted-foreground font-normal">
                {t('wfGoals:save_up.per_month_suffix')}
              </span>
            </CalloutMetric>
            <CalloutMetric label={t('wfGoals:save_up.finish')}>
              {finishLabel ?? t('wfGoals:save_up.not_reached')}
            </CalloutMetric>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function CalloutMetric({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="border-border/70 bg-muted/20 rounded-lg border px-3 py-2.5">
      <div className="text-muted-foreground text-2xs">{label}</div>
      <div className="mt-1 text-sm font-semibold tabular-nums">{children}</div>
    </div>
  )
}

function SidebarRow({
  label,
  children,
}: {
  label: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{children}</span>
    </div>
  )
}

function SidebarCard({
  kicker,
  title,
  editing,
  onEdit,
  onSave,
  onCancel,
  dirty,
  pending,
  pendingLabel,
  readContent,
  editContent,
}: {
  kicker: string
  title: string
  editing: boolean
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  dirty: boolean
  pending: boolean
  pendingLabel?: string
  readContent: React.ReactNode
  editContent: React.ReactNode
}) {
  const { t } = useTranslation()
  const renderEditActions = () => (
    <div className="flex items-center justify-end gap-1.5">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs"
        onClick={onCancel}
      >
        {t('wfCommon:cancel')}
      </Button>
      <Button
        size="sm"
        className="h-7 text-xs"
        onClick={onSave}
        disabled={!dirty || pending}
      >
        {pending
          ? (pendingLabel ?? t('wfGoals:save_up.saving'))
          : t('wfCommon:save')}
      </Button>
    </div>
  )

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between pb-4">
        <div className="min-w-0">
          <div className="text-muted-foreground mb-1 text-xs font-medium tracking-[0.15em] uppercase">
            {kicker}
          </div>
          <CardTitle className="text-md leading-none tracking-tight">
            {title}
          </CardTitle>
        </div>
        {editing ? (
          renderEditActions()
        ) : (
          <button
            type="button"
            onClick={onEdit}
            aria-label={t('wfGoals:save_up.edit_aria', { title })}
            className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1.5 text-sm transition-colors"
          >
            <Icons.Pencil className="h-3.5 w-3.5" />
            {t('wfCommon:edit')}
          </button>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-3">
            <div className="divide-border divide-y">{editContent}</div>
            <div className="border-border flex justify-end border-t pt-3">
              {renderEditActions()}
            </div>
          </div>
        ) : (
          readContent
        )}
      </CardContent>
    </Card>
  )
}

function DateRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="py-4 first:pt-1 last:pb-1">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <div className="text-foreground text-sm leading-tight font-semibold">
            {label}
          </div>
          <div className="text-muted-foreground mt-1 text-xs leading-tight">
            {hint}
          </div>
        </div>
      </div>
      <DatePickerInput
        aria-label={label}
        value={value || undefined}
        onChange={(date) => onChange(date ? formatDateISO(date) : '')}
      />
    </div>
  )
}

function formatGoalDates(
  targetDate: string | null | undefined,
  completionDate: string | null | undefined,
  formatting: ReturnType<typeof useDateFormatting>,
) {
  const sameMonth = Boolean(
    targetDate &&
    completionDate &&
    targetDate.slice(0, 7) === completionDate.slice(0, 7),
  )
  const format = (date: string | null | undefined) =>
    date
      ? formatting.formatCalendarDate(date, {
          year: 'numeric',
          month: 'short',
          day: sameMonth ? 'numeric' : undefined,
        })
      : null
  return {
    targetDateLabel: format(targetDate),
    finishLabel: format(completionDate),
  }
}
