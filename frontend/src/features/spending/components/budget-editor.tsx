import { getDemoDate, localDate } from '@/lib/api'
import { shiftMonth } from '@/lib/budget-api'
// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Wealthfolio 92b4647 apps/frontend/src/features/spending/components/budget-editor.tsx; see THIRD_PARTY_NOTICES.md.
import { decimalUnits, subtractMoney, sumMoney } from '@/lib/money'
import { positiveMoney, safePercent, exactRatio } from '../compat'
import { getCategoryLabel } from '../labels'
import { getBudgetGroupLabel } from '../labels'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from '../compat'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Icons,
  isKeyboardEventComposing,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  PrivacyAmount,
  useIsMobile,
  useNumberFormatting,
} from '../ui'

import { cardSurfaceClassName } from '@/vendor/wealthfolio/ui/components/ui/card'

import { cn } from '@/lib/utils'

import type { BudgetActions } from '../budget-adapter'
import { SPENDING_THEME, tint } from '../lib/theme'
import type {
  BudgetCategoryRow,
  BudgetGroup,
  BudgetGroupRow,
  BudgetSnapshot,
  BudgetTarget,
} from '../types/budget'

import { AmountInput } from './amount-input'
import { CategoryIcon } from './category-chips'
import { EXTENDED_PALETTE } from '../lib/color-palette'
import { IconPicker } from './icon-picker'
import { badgeVariants } from '../ui'

export type BudgetEditorMode = 'setup' | 'monthly'

interface BudgetEditorProps {
  mode: BudgetEditorMode
  periodKey: string
  budget: BudgetSnapshot
  actions: BudgetActions
}

export function BudgetEditor({
  budget,
  mode,
  periodKey,
  actions,
}: BudgetEditorProps) {
  const { t } = useTranslation()
  const currency = budget.computed.currency
  const groups = budget.state.groups
  const monthMode = mode === 'monthly'
  const targets = budget.state.targets
  const allCategoryPool: CategoryPoolEntry[] =
    budget.computed.groupRows.flatMap((group) =>
      group.categories.map((category) => ({
        category,
        fromGroupId: category.groupId,
        fromGroupName: category.groupId ? group.group.name : null,
      })),
    )
  const groupSection = (
    <div className="space-y-2">
      {budget.computed.groupRows.map((row) => (
        <GroupBudgetSection
          key={row.group.id}
          row={row}
          groups={groups}
          targets={targets}
          currency={currency}
          periodKey={periodKey}
          monthMode={monthMode}
          mode={mode}
          categoryPool={allCategoryPool}
          onSaveCategoryTarget={actions.saveCategory}
          onDeleteOverride={actions.removeOverride}
          onMoveCategory={actions.moveCategory}
          onUpdateGroup={(patch) => actions.updateGroup(row.group.id, patch)}
          onDeleteGroup={() => actions.removeGroup(row.group.id)}
          canDelete={!row.group.isSystem}
          deletePending={actions.pending}
          onToggleCategoryRollover={actions.rollover}
          onToggleActive={actions.toggleActive}
          onEditDetails={actions.editDetails}
        />
      ))}
    </div>
  )
  const incomePanel = (
    <section className={cn(cardSurfaceClassName, 'p-3 sm:p-4')}>
      <PanelHeader
        title={t('wfSpending:cashFlow.income')}
        icon={<Icons.Wallet className="h-3.5 w-3.5" />}
      />
      <div className="mt-3 space-y-2">
        {budget.incomeSources.map((row) => (
          <div
            key={row.name}
            className="flex items-center justify-between gap-3 text-xs"
          >
            <span>{row.name}</span>
            <PrivacyAmount value={row.amount} currency={currency} />
          </div>
        ))}
      </div>
      <p className="text-muted-foreground mt-3 text-xs">
        {t('spendingMigration:recordedIncome')}
      </p>
    </section>
  )
  return (
    <div
      className={
        mode === 'monthly'
          ? 'grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]'
          : 'max-w-2xl space-y-4'
      }
    >
      <div className="space-y-4">
        {allCategoryPool.length === 0 && (
          <p role="status" className="text-muted-foreground text-sm">
            {t('spendingMigration:noTargets')}
          </p>
        )}
        <BudgetSummary budget={budget} currency={currency} mode={mode} />
        {groupSection}
        <Button variant="ghost" size="sm" onClick={actions.addGroup}>
          <Icons.Plus className="h-3.5 w-3.5" />
          {t('wfSpending:budgetEditor.addGroup')}
        </Button>
      </div>
      <div className="space-y-4">
        {incomePanel}
        {monthMode && (
          <CopyFromMonthRow
            currentPeriodKey={periodKey}
            onCopy={actions.copyPrevious}
            pending={actions.pending}
          />
        )}
        <OverridesSummary
          budget={budget}
          periodKey={periodKey}
          currency={currency}
          onRevert={actions.removeOverride}
        />
      </div>
    </div>
  )
}

function BudgetSummary({
  budget,
  currency,
  mode,
}: {
  budget: BudgetSnapshot
  currency: string
  mode: BudgetEditorMode
}) {
  const totals = budget.computed.totals
  const groupRows = budget.computed.groupRows
  const planned = totals.spendingPlanned
  const income = totals.incomeActual
  const denominator = decimalUnits(income) > 0n ? income : planned
  const allocatedPct = exactRatio(planned, denominator)
  const hasPlan = decimalUnits(planned) > 0n
  const { t } = useTranslation()
  const numberFormatting = useNumberFormatting()
  const headingLabel =
    mode === 'setup'
      ? t('wfSpending:budgetEditor.defaultMonthlyPlan')
      : t('wfSpending:budgetEditor.monthlyPlan')

  return (
    <section className={cn(cardSurfaceClassName, 'overflow-hidden p-3 sm:p-4')}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-muted-foreground text-2xs font-semibold tracking-[0.08em] uppercase">
            {headingLabel}
          </div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="text-foreground truncate text-lg font-semibold tracking-tight tabular-nums sm:text-xl">
              <PrivacyAmount value={planned} currency={currency} />
            </span>
            {decimalUnits(income) > 0n && (
              <span className="text-muted-foreground text-2xs truncate">
                / <PrivacyAmount value={income} currency={currency} />
              </span>
            )}
          </div>
        </div>
        <div
          className={cn(
            badgeVariants({ variant: 'secondary' }),
            'text-2xs bg-muted/60 text-muted-foreground',
          )}
        >
          <span className="tabular-nums">
            {numberFormatting.formatPercent(allocatedPct, { digits: 0 })}
          </span>
        </div>
      </div>

      <p className="text-muted-foreground mt-2 text-2xs">
        {t('spendingMigration:incomeReference')}
      </p>
      <SegmentedGroupBar
        groupRows={groupRows}
        total={planned}
        hasPlan={hasPlan}
      />

      {/* Up to three columns on large screens, but none under 10rem, so larger
          text drops to two before the amounts are cut. */}
      <div className="mt-2.5 grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(max(14rem,calc((100%-2rem)/3)),1fr))]">
        {groupRows.map((row) => (
          <GroupSummaryCell
            key={row.group.id}
            row={row}
            currency={currency}
            denominator={denominator}
          />
        ))}
      </div>
    </section>
  )
}

function SegmentedGroupBar({
  groupRows,
  total,
  hasPlan,
}: {
  groupRows: BudgetGroupRow[]
  total: string
  hasPlan: boolean
}) {
  const { t } = useTranslation()
  if (groupRows.some((row) => decimalUnits(row.plannedTotal) < 0n))
    return (
      <p className="text-muted-foreground mt-2 text-2xs">
        {t('spendingMigration:negativeCarryComposition')}
      </p>
    )
  if (!hasPlan) {
    return (
      <div className="bg-muted/40 mt-3 h-1.5 rounded-full">
        <div className="sr-only">
          {t('wfSpending:budgetEditor.noBudgetAllocated')}
        </div>
      </div>
    )
  }

  const visibleRows = groupRows.filter(
    (row) => decimalUnits(row.plannedTotal) > 0n,
  )

  return (
    <div className="bg-muted/40 mt-3 flex h-1.5 overflow-hidden rounded-full">
      {visibleRows.map((row) => (
        <div
          key={row.group.id}
          className="min-w-[3px] transition-all"
          style={{
            width: `${Math.max(1, safePercent(row.plannedTotal, total) * 100)}%`,
            backgroundColor: row.group.color ?? SPENDING_THEME.deep,
          }}
        />
      ))}
    </div>
  )
}

function GroupSummaryCell({
  row,
  currency,
  denominator,
}: {
  row: BudgetGroupRow
  currency: string
  denominator: string
}) {
  const numberFormatting = useNumberFormatting()
  const { t } = useTranslation()
  const accent = row.group.color ?? SPENDING_THEME.deep
  const pct = exactRatio(row.plannedTotal, denominator)
  return (
    <div className="flex min-w-0 items-center gap-2 py-0.5">
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: accent }}
        aria-hidden
      />
      <span className="text-foreground min-w-0 flex-1 truncate text-xs">
        {getBudgetGroupLabel(t, row.group.id, row.group.name)}
      </span>
      <span className="text-muted-foreground text-2xs w-14 shrink-0 text-end tabular-nums">
        {numberFormatting.formatPercent(pct, { digits: 0 })}
      </span>
      <span className="text-foreground shrink-0 text-xs font-medium tabular-nums">
        <PrivacyAmount value={row.plannedTotal} currency={currency} />
      </span>
    </div>
  )
}

interface CategoryPoolEntry {
  category: BudgetCategoryRow
  fromGroupId: string | null
  fromGroupName: string | null
}

function GroupBudgetSection({
  row,
  groups,
  targets,
  currency,
  periodKey,
  monthMode,
  mode,
  categoryPool,
  canDelete,
  deletePending,
  onSaveCategoryTarget,
  onDeleteOverride,
  onMoveCategory,
  onUpdateGroup,
  onDeleteGroup,
  onToggleCategoryRollover,
  onEditDetails,
  onToggleActive,
}: {
  row: BudgetGroupRow
  groups: BudgetGroup[]
  targets: BudgetTarget[]
  currency: string
  periodKey: string
  monthMode: boolean
  mode: BudgetEditorMode
  categoryPool: CategoryPoolEntry[]
  canDelete: boolean
  deletePending: boolean
  onSaveCategoryTarget: (row: BudgetCategoryRow, amount: string) => void
  onDeleteOverride: (target: BudgetTarget | undefined) => void
  onMoveCategory: (categoryId: string, groupId: string) => void
  onUpdateGroup: (patch: {
    sort_order?: number
    name?: string
    color?: string | null
    icon?: string | null
  }) => void
  onDeleteGroup: () => void
  onToggleCategoryRollover: (row: BudgetCategoryRow, enabled: boolean) => void
  onEditDetails: (row: BudgetCategoryRow) => void
  onToggleActive: (row: BudgetCategoryRow) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const accent = row.group.color ?? SPENDING_THEME.deep
  const spentPct = safePercent(positiveMoney(row.actual), row.plannedTotal)
  const totalSuffix =
    mode === 'setup' && !row.group.isSystem
      ? t('wfSpending:budgetEditor.perDefaultMonth')
      : t('wfSpending:budgetEditor.perMonth')

  return (
    <section className={cn(cardSurfaceClassName, 'overflow-hidden')}>
      <div className="flex items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-muted-foreground hover:text-foreground -ms-1 flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors"
          aria-label={
            open
              ? t('wfSpending:budgetEditor.collapseGroup')
              : t('wfSpending:budgetEditor.expandGroup')
          }
          aria-expanded={open}
        >
          <Icons.ChevronRight
            className={cn(
              'h-3.5 w-3.5 transition-transform',
              open ? 'rotate-90' : 'rtl:rotate-180',
            )}
          />
        </button>

        <button
          type="button"
          onClick={() =>
            mode === 'setup' && !row.group.isSystem && setEditOpen(true)
          }
          disabled={mode !== 'setup'}
          className="ring-offset-background focus-visible:ring-ring flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-transform focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none enabled:hover:scale-105 disabled:cursor-default disabled:hover:scale-100"
          style={{ backgroundColor: tint(accent, 0.12), color: accent }}
          aria-label={
            mode === 'setup' && !row.group.isSystem
              ? t('wfSpending:budgetEditor.editGroupName', {
                  name: getBudgetGroupLabel(t, row.group.id, row.group.name),
                })
              : getBudgetGroupLabel(t, row.group.id, row.group.name)
          }
        >
          <CategoryIcon icon={row.group.icon ?? null} className="h-3.5 w-3.5" />
        </button>

        {mode === 'setup' && !row.group.isSystem && (
          <GroupEditDialog
            group={row.group}
            color={accent}
            open={editOpen}
            onOpenChange={setEditOpen}
            onUpdate={onUpdateGroup}
          />
        )}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="min-w-0 flex-1 text-start"
        >
          <div className="text-foreground truncate text-sm font-semibold">
            {getBudgetGroupLabel(t, row.group.id, row.group.name)}
          </div>
          {/* Spent of planned wraps under the bar rather than ending in an ellipsis. */}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <div className="bg-muted/40 h-1 w-16 shrink-0 overflow-hidden rounded-full sm:w-20">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, spentPct * 100)}%`,
                  backgroundColor: accent,
                }}
              />
            </div>
            <span className="text-muted-foreground text-2xs tabular-nums">
              <PrivacyAmount value={row.actual} currency={currency} /> /{' '}
              <PrivacyAmount value={row.plannedTotal} currency={currency} />
            </span>
          </div>
        </button>

        <div className="text-end">
          <div className="text-sm font-semibold tabular-nums">
            <PrivacyAmount value={row.plannedTotal} currency={currency} />
          </div>
          <div className="text-muted-foreground text-2xs tracking-wide uppercase">
            {totalSuffix}
          </div>
        </div>

        {mode === 'setup' && !row.group.isSystem && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground h-7 w-7 shrink-0 p-0"
                  aria-label={t('wfSpending:budgetEditor.groupActions')}
                />
              }
            >
              <Icons.MoreVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-muted-foreground/70 text-2xs font-normal tracking-wide uppercase">
                  {t('wfSpending:budgetEditor.categoryCount', {
                    count: row.categories.length,
                  })}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  closeOnClick={false}
                  onClick={() => {
                    setEditOpen(true)
                  }}
                  className="text-xs"
                >
                  <Icons.Pencil className="me-2 h-3.5 w-3.5" />
                  {t('wfCommon:edit')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={!canDelete}
                  closeOnClick={false}
                  onClick={() => {
                    if (canDelete) setConfirmDeleteOpen(true)
                  }}
                  className="text-destructive focus:text-destructive text-xs"
                >
                  <Icons.Trash className="me-2 h-3.5 w-3.5" />
                  {t('wfSpending:budgetEditor.deleteGroup')}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {mode === 'setup' && !row.group.isSystem && (
        <AlertDialog
          open={confirmDeleteOpen}
          onOpenChange={setConfirmDeleteOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t('wfSpending:budgetEditor.deleteGroupTitle', {
                  name: getBudgetGroupLabel(t, row.group.id, row.group.name),
                })}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {row.categories.length > 0
                  ? t('spendingMigration:safeGroupDeletion', {
                      count: row.categories.length,
                    })
                  : t('wfSpending:budgetEditor.cannotUndo')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('wfCommon:cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => {
                  event.preventBaseUIHandler()
                  onDeleteGroup()
                  setConfirmDeleteOpen(false)
                }}
                disabled={deletePending}
                variant="destructive"
              >
                {deletePending
                  ? t('wfSpending:budgetEditor.deleting')
                  : t('wfCommon:delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {open && (
        <div className="border-border/30 border-t">
          {row.categories.map((category) => (
            <BudgetCategoryLine
              key={category.categoryId}
              row={category}
              groups={groups}
              target={findCategoryTarget(
                targets,
                periodKey,
                category.taxonomyId,
                category.categoryId,
              )}
              currency={currency}
              groupTotal={row.plannedTotal}
              monthMode={monthMode}
              mode={mode}
              groupRolloverEnabled={false}
              onSaveTarget={onSaveCategoryTarget}
              onDeleteOverride={onDeleteOverride}
              onMoveCategory={onMoveCategory}
              onToggleRollover={onToggleCategoryRollover}
              onToggleActive={onToggleActive}
              onEditDetails={onEditDetails}
              periodKey={periodKey}
            />
          ))}
          {mode === 'setup' && !row.group.isSystem && (
            <AddCategoryRow
              groupId={row.group.id}
              groupName={row.group.name}
              pool={categoryPool.filter(
                (entry) => entry.fromGroupId !== row.group.id,
              )}
              onMoveCategory={onMoveCategory}
            />
          )}
        </div>
      )}
    </section>
  )
}

function AddCategoryRow({
  groupId,
  groupName,
  pool,
  onMoveCategory,
}: {
  groupId: string
  groupName: string
  pool: CategoryPoolEntry[]
  onMoveCategory: (categoryId: string, groupId: string) => void
}) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [pendingMove, setPendingMove] = useState<CategoryPoolEntry | null>(null)
  const groupLabel = getBudgetGroupLabel(t, groupId, groupName)
  const pendingCategoryLabel = pendingMove
    ? getCategoryLabel(
        t,
        pendingMove.category.taxonomyId,
        pendingMove.category.categoryId,
        pendingMove.category.name,
      )
    : undefined
  const pendingFromGroupLabel = pendingMove?.fromGroupName
    ? getBudgetGroupLabel(
        t,
        pendingMove.fromGroupId ?? '',
        pendingMove.fromGroupName,
      )
    : undefined

  const handlePick = (entry: CategoryPoolEntry) => {
    if (entry.fromGroupName) {
      // Always confirm when moving from another group — the source group
      // loses the category, which can shift its allocation surface area.
      setPendingMove(entry)
      setOpen(false)
    } else {
      onMoveCategory(entry.category.categoryId, groupId)
      setOpen(false)
    }
  }

  const trigger = (
    <button
      type="button"
      className="text-muted-foreground hover:text-foreground hover:bg-muted/40 border-border/40 group flex w-full items-center gap-2 border-t border-dashed px-3 py-2 text-start transition-colors sm:px-4"
    >
      <span className="border-border/50 group-hover:border-foreground/30 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-dashed">
        <Icons.Plus className="h-3 w-3" />
      </span>
      <span className="text-xs">
        {t('wfSpending:budgetEditor.addCategory')}
      </span>
    </button>
  )

  const emptyState = (
    <div className="text-muted-foreground p-4 text-xs">
      {t('wfSpending:budgetEditor.noOtherCategories')}{' '}
      <Link
        to="/settings/spending/categories?tab=expense"
        className="text-foreground underline-offset-2 hover:underline"
      >
        {t('wfSpending:budgetEditor.manageCategories')}
      </Link>
      .
    </div>
  )

  const list = (
    <div
      className={cn('overflow-y-auto', isMobile ? 'max-h-[55vh]' : 'max-h-72')}
    >
      {pool.map((entry, idx) => {
        const accent = entry.category.color ?? SPENDING_THEME.deep
        return (
          <button
            key={entry.category.categoryId}
            type="button"
            onClick={() => handlePick(entry)}
            className={cn(
              'active:bg-muted/80 hover:bg-muted/50 flex w-full items-center gap-3 text-start transition-colors',
              isMobile ? 'px-4 py-3' : 'px-3 py-2',
              idx > 0 && 'border-border/40 border-t',
            )}
          >
            <span
              className={cn(
                'flex shrink-0 items-center justify-center rounded-md',
                isMobile ? 'h-8 w-8' : 'h-6 w-6',
              )}
              style={{ backgroundColor: tint(accent, 0.12), color: accent }}
              aria-hidden
            >
              <CategoryIcon
                icon={entry.category.icon ?? null}
                className={isMobile ? 'h-4 w-4' : 'h-3.5 w-3.5'}
              />
            </span>
            <div className="min-w-0 flex-1">
              <div
                className={cn(
                  'text-foreground truncate',
                  isMobile ? 'text-base' : 'text-sm',
                )}
              >
                {getCategoryLabel(
                  t,
                  entry.category.taxonomyId,
                  entry.category.categoryId,
                  entry.category.name,
                )}
              </div>
              {entry.fromGroupName && (
                <div className="text-muted-foreground truncate text-xs">
                  {t('wfSpending:budgetEditor.fromGroup', {
                    name: getBudgetGroupLabel(
                      t,
                      entry.fromGroupId ?? '',
                      entry.fromGroupName,
                    ),
                  })}
                </div>
              )}
            </div>
            <Icons.ChevronRight className="text-muted-foreground/60 h-4 w-4 shrink-0 rtl:rotate-180" />
          </button>
        )
      })}
    </div>
  )

  const footer = (
    <Link
      to="/settings/spending/categories?tab=expense"
      className={cn(
        'text-foreground hover:bg-muted/40 active:bg-muted/60 border-border/60 flex w-full items-center gap-3 border-t transition-colors',
        isMobile ? 'px-4 py-4' : 'px-3 py-2.5 text-sm',
      )}
    >
      <span
        className={cn(
          'border-border bg-muted/40 flex shrink-0 items-center justify-center rounded-md border border-dashed',
          isMobile ? 'h-8 w-8' : 'h-6 w-6',
        )}
        aria-hidden
      >
        <Icons.Plus className={isMobile ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
      </span>
      <span className={cn('font-medium', isMobile ? 'text-base' : 'text-sm')}>
        {t('wfSpending:budgetEditor.createNewCategory')}
      </span>
    </Link>
  )

  return (
    <>
      {isMobile ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={trigger} />
          <SheetContent
            side="bottom"
            showCloseButton={false}
            className="pb-safe rounded-t-2xl p-0"
          >
            {/* iOS-style drag indicator — backdrop tap and swipe-down dismiss the sheet */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="bg-muted-foreground/30 h-1 w-10 rounded-full" />
            </div>
            <SheetHeader className="px-4 pt-1 pb-3 text-start">
              <SheetTitle className="text-base">
                {t('wfSpending:budgetEditor.addCategoryTo', {
                  name: groupLabel,
                })}
              </SheetTitle>
            </SheetHeader>
            {pool.length === 0 ? (
              emptyState
            ) : (
              <div className="border-border/60 border-t">{list}</div>
            )}
            {pool.length > 0 && footer}
          </SheetContent>
        </Sheet>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger render={trigger} />
          <PopoverContent className="w-72 p-0" align="start">
            {pool.length === 0 ? (
              emptyState
            ) : (
              <>
                <div className="text-muted-foreground border-border/60 text-2xs border-b px-3 py-2 font-medium tracking-widest uppercase">
                  {t('wfSpending:budgetEditor.moveExistingCategory')}
                </div>
                {list}
                {footer}
              </>
            )}
          </PopoverContent>
        </Popover>
      )}

      <AlertDialog
        open={pendingMove !== null}
        onOpenChange={(o) => {
          if (!o) setPendingMove(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('wfSpending:budgetEditor.moveCategoryTitle', {
                name: pendingCategoryLabel,
                group: groupLabel,
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('wfSpending:budgetEditor.moveCategoryBody', {
                name: pendingCategoryLabel,
                from: pendingFromGroupLabel,
                group: groupLabel,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('wfCommon:cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingMove) {
                  onMoveCategory(pendingMove.category.categoryId, groupId)
                  setPendingMove(null)
                }
              }}
            >
              {t('wfSpending:budgetEditor.moveCategory')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

interface GroupEditDialogProps {
  group: BudgetGroup
  color: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: (patch: {
    sort_order?: number
    name?: string
    color?: string | null
    icon?: string | null
  }) => void
}

function GroupEditDialog(props: GroupEditDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Mount the body only when open so its useState initializes from the
            current props each time — kills the prop-to-state mirror effect. */}
        {props.open && <GroupEditDialogBody {...props} />}
      </DialogContent>
    </Dialog>
  )
}

function GroupEditDialogBody({
  group,
  color,
  onOpenChange,
  onUpdate,
}: GroupEditDialogProps) {
  const { t } = useTranslation()
  const [draftOrder, setDraftOrder] = useState(group.sortOrder)
  const [draftName, setDraftName] = useState(group.name)
  const [draftColor, setDraftColor] = useState(color)
  const [draftIcon, setDraftIcon] = useState<string | null>(group.icon ?? null)

  const handleSave = () => {
    const patch: {
      sort_order?: number
      name?: string
      color?: string | null
      icon?: string | null
    } = {}
    const trimmedName = draftName.trim()
    if (draftOrder !== group.sortOrder) patch.sort_order = draftOrder
    if (trimmedName && trimmedName !== group.name) patch.name = trimmedName
    if (draftColor !== color) patch.color = draftColor
    if ((draftIcon ?? null) !== (group.icon ?? null)) patch.icon = draftIcon
    if (Object.keys(patch).length > 0) onUpdate(patch)

    onOpenChange(false)
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-base">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-md"
            style={{
              backgroundColor: tint(draftColor, 0.12),
              color: draftColor,
            }}
          >
            <CategoryIcon icon={draftIcon} className="h-4 w-4" />
          </span>
          {t('wfSpending:budgetEditor.editGroup')}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4 py-2">
        <div className="space-y-1.5">
          <label className="text-muted-foreground text-2xs font-semibold tracking-wide uppercase">
            {t('wfCommon:name')}
          </label>
          <div className="bg-muted/60 border-border/60 focus-within:ring-ring/50 flex h-9 items-center rounded-md border px-3 transition-shadow focus-within:ring-2">
            <input
              type="text"
              aria-label={t('wfCommon:name')}
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => {
                if (isKeyboardEventComposing(event.nativeEvent)) return

                if (event.key === 'Enter') handleSave()
              }}
              className="text-foreground placeholder:text-muted-foreground/50 w-full bg-transparent text-sm outline-none"
              autoFocus
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-muted-foreground text-2xs font-semibold tracking-wide uppercase">
            {t('wfSpending:category.color')}
          </label>
          <GroupColorSwatchGrid value={draftColor} onChange={setDraftColor} />
        </div>

        <div className="space-y-1.5">
          <label className="text-muted-foreground text-2xs font-semibold tracking-wide uppercase">
            {t('wfSpending:category.icon')}
          </label>
          <IconPicker
            value={draftIcon}
            accent={draftColor}
            onChange={setDraftIcon}
          />
        </div>
      </div>

      <label className="text-muted-foreground text-xs">
        {t('spendingMigration:groupOrder')}
        <input
          aria-label={t('spendingMigration:groupOrder')}
          type="number"
          min="0"
          max="100000"
          value={draftOrder}
          onChange={(event) => setDraftOrder(Number(event.target.value))}
          className="ms-2 w-20 rounded border p-1"
        />
      </label>
      <DialogFooter className="gap-2">
        <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
          {t('wfCommon:cancel')}
        </Button>
        <Button size="sm" onClick={handleSave} disabled={!draftName.trim()}>
          {t('wfCommon:save')}
        </Button>
      </DialogFooter>
    </>
  )
}

function BudgetCategoryLine({
  row,
  periodKey,
  groups,
  target,
  currency,
  groupTotal,
  monthMode,
  mode,
  groupRolloverEnabled,
  onSaveTarget,
  onDeleteOverride,
  onMoveCategory,
  onToggleRollover,
  onEditDetails,
  onToggleActive,
}: {
  row: BudgetCategoryRow
  periodKey: string
  groups: BudgetGroup[]
  target: BudgetTarget | undefined
  currency: string
  groupTotal: string
  monthMode: boolean
  mode: BudgetEditorMode
  groupRolloverEnabled: boolean
  onSaveTarget: (row: BudgetCategoryRow, amount: string) => void
  onDeleteOverride: (target: BudgetTarget | undefined) => void
  onMoveCategory: (categoryId: string, groupId: string) => void
  onToggleRollover: (row: BudgetCategoryRow, enabled: boolean) => void
  onEditDetails: (row: BudgetCategoryRow) => void
  onToggleActive: (row: BudgetCategoryRow) => void
}) {
  const { t } = useTranslation()
  const numberFormatting = useNumberFormatting()
  const month = periodKey
  const asOf = getDemoDate() || localDate()
  const end = new Date(shiftMonth(month, 1) + '-01T12:00:00')
  end.setDate(end.getDate() - 1)
  const lastDay =
    end.toISOString().slice(0, 10) < asOf
      ? end.toISOString().slice(0, 10)
      : asOf
  const accent = row.color ?? SPENDING_THEME.deep
  const hasOverride = monthMode && !!target
  const available = sumMoney([row.target, row.rolloverIn])
  const overBudget =
    row.active && decimalUnits(row.actual) > decimalUnits(available)
  const sharePct = exactRatio(row.target, groupTotal)
  const usagePct = Math.min(1, safePercent(row.actual, available))

  return (
    <div className="group/row hover:bg-muted/15 flex items-center gap-2 px-3 py-1.5 text-xs transition-colors sm:gap-3 sm:px-4">
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: tint(accent, 0.12), color: accent }}
        aria-hidden
      >
        <CategoryIcon icon={row.icon ?? null} className="h-3 w-3" />
      </span>
      <div className="min-w-0 flex-1">
        <Link
          aria-disabled={month > asOf.slice(0, 7)}
          onClick={(event) => {
            if (month > asOf.slice(0, 7)) event.preventDefault()
          }}
          to={
            '/activities?tab=spending&category_id=' +
            row.categoryId +
            '&date_from=' +
            month +
            '-01&date_to=' +
            lastDay +
            '&spending_only=true'
          }
          className="text-foreground block truncate hover:underline"
        >
          {getCategoryLabel(t, row.taxonomyId, row.categoryId, row.name)}
        </Link>
        {monthMode && decimalUnits(row.rolloverIn) !== 0n && (
          <span className="text-muted-foreground text-2xs">
            {t('spendingMigration:carryover')}:{' '}
            <PrivacyAmount value={row.rolloverIn} currency={currency} />
          </span>
        )}
      </div>

      <div className="relative w-20 shrink-0">
        <AmountInput
          value={row.target}
          disabled={!row.active}
          label={row.name}
          onCommit={(value) => onSaveTarget(row, value)}
        />
        {hasOverride && (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={() => onDeleteOverride(target)}
                  className="bg-warning-subtle text-warning-subtle-foreground hover:bg-warning-subtle/70 border-background absolute -end-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border transition-colors"
                  aria-label={t('wfSpending:budgetEditor.revertOverride')}
                />
              }
            >
              <Icons.X className="h-2 w-2" />
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4} className="text-xs">
              {t('wfSpending:budgetEditor.monthOverrideRevert')}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <span className="text-muted-foreground text-2xs hidden w-12 shrink-0 text-end tabular-nums sm:inline">
        {numberFormatting.formatPercent(sharePct, { digits: 0 })}
      </span>

      <Tooltip>
        <TooltipTrigger
          render={
            <div className="bg-muted/50 hidden h-1 w-14 shrink-0 overflow-hidden rounded-full sm:block" />
          }
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${usagePct * 100}%`,
              backgroundColor: overBudget ? 'var(--destructive)' : accent,
            }}
          />
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4} className="text-xs">
          <PrivacyAmount value={row.actual} currency={currency} />{' '}
          {t('wfSpending:budgetEditor.spentOf')}{' '}
          <PrivacyAmount value={available} currency={currency} />{' '}
          {t('wfSpending:budgetEditor.ofGroup', {
            pct: numberFormatting.formatPercent(sharePct, { digits: 0 }),
          })}
        </TooltipContent>
      </Tooltip>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground h-6 w-6 shrink-0 p-0"
              aria-label={t('wfSpending:budgetEditor.rowOptions')}
            />
          }
        >
          <Icons.MoreHorizontal className="h-3.5 w-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => onEditDetails(row)}>
            {t('spendingMigration:targetDetails')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onToggleActive(row)}>
            {t(
              row.active
                ? 'spendingMigration:disableTarget'
                : 'spendingMigration:enableTarget',
            )}
          </DropdownMenuItem>
          {(mode === 'setup' || monthMode) && (
            <>
              <DropdownMenuRadioGroup
                value={row.groupId ?? ''}
                onValueChange={(value) => onMoveCategory(row.categoryId, value)}
              >
                <DropdownMenuLabel className="text-2xs font-semibold tracking-wide uppercase">
                  {t('wfSpending:budgetEditor.moveToGroup')}
                </DropdownMenuLabel>
                {groups.map((group) => (
                  <DropdownMenuRadioItem
                    key={group.id}
                    value={group.id}
                    className="text-xs"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{
                          backgroundColor: group.color ?? SPENDING_THEME.deep,
                        }}
                      />
                      {getBudgetGroupLabel(t, group.id, group.name)}
                    </span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={groupRolloverEnabled}
                closeOnClick={false}
                onClick={() => {
                  onToggleRollover(row, !row.rolloverEnabled)
                }}
                className="text-xs"
              >
                <Icons.Refresh className="me-2 h-3.5 w-3.5" />
                <span className="flex-1">
                  {t('wfSpending:budgetEditor.rollover')}
                </span>
                <span className="text-muted-foreground text-2xs">
                  {groupRolloverEnabled
                    ? t('wfSpending:budgetEditor.groupWide')
                    : row.rolloverEnabled
                      ? t('wfSpending:budgetEditor.on')
                      : t('wfSpending:budgetEditor.off')}
                </span>
              </DropdownMenuItem>
            </>
          )}
          {hasOverride && (
            <>
              {mode === 'setup' && <DropdownMenuSeparator />}
              <DropdownMenuItem
                onClick={() => onDeleteOverride(target)}
                className="text-warning text-xs"
              >
                <Icons.X className="me-2 h-3.5 w-3.5" />
                {t('wfSpending:budgetEditor.revertMonthOverride')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function GroupColorSwatchGrid({
  value,
  onChange,
}: {
  value: string
  onChange: (color: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {EXTENDED_PALETTE.map((color) => {
        const isActive = value.toLowerCase() === color.toLowerCase()
        return (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={cn(
              'h-7 w-7 rounded-full border-2 transition-transform hover:scale-110',
              isActive ? 'border-foreground' : 'border-transparent',
            )}
            style={{ backgroundColor: color }}
            aria-label={t('wfSpending:category.useColor', { color })}
          />
        )
      })}
    </div>
  )
}

function OverridesSummary({
  budget,
  periodKey,
  currency,
  onRevert,
}: {
  budget: BudgetSnapshot
  periodKey: string
  currency: string
  onRevert: (target: BudgetTarget) => void
}) {
  const { t: tr } = useTranslation()
  // Memoize the two-map build + flatMap so we don't redo the O(n*m) walks on
  // every parent re-render of the budget editor.
  const overrides = useMemo(() => {
    const targets = budget.state.targets
    const monthTargets = targets.filter((t) => t.periodKey === periodKey)
    if (monthTargets.length === 0) return []

    const categoryRowByKey = new Map<string, BudgetCategoryRow>()
    for (const row of budget.computed.groupRows) {
      for (const cat of row.categories) {
        categoryRowByKey.set(`${cat.taxonomyId}:${cat.categoryId}`, cat)
      }
    }
    for (const row of budget.computed.incomeRows) {
      categoryRowByKey.set(`${row.taxonomyId}:${row.categoryId}`, row)
    }
    const groupById = new Map(
      budget.state.groups.map((g) => [g.id, g] as const),
    )

    return monthTargets.flatMap((target) => {
      if (
        target.targetType === 'category' &&
        target.taxonomyId &&
        target.categoryId
      ) {
        const row = categoryRowByKey.get(
          `${target.taxonomyId}:${target.categoryId}`,
        )
        if (!row) return []
        const defaultTarget = targets.find(
          (t) =>
            t.periodKey === 'default' &&
            t.targetType === 'category' &&
            t.taxonomyId === target.taxonomyId &&
            t.categoryId === target.categoryId,
        )
        const defaultAmount = defaultTarget ? defaultTarget.amount : '0'
        const monthAmount = target.amount
        return [
          {
            target,
            name: getCategoryLabel(
              tr,
              row.taxonomyId,
              row.categoryId,
              row.name,
            ),
            color: row.color,
            monthAmount,
            defaultAmount,
          },
        ]
      }
      if (target.targetType === 'group_buffer' && target.groupId) {
        const group = groupById.get(target.groupId)
        if (!group) return []
        const defaultTarget = targets.find(
          (t) =>
            t.periodKey === 'default' &&
            t.targetType === 'group_buffer' &&
            t.groupId === target.groupId,
        )
        const defaultAmount = defaultTarget ? defaultTarget.amount : '0'
        const monthAmount = target.amount
        return [
          {
            target,
            name: tr('wfSpending:budgetEditor.groupBufferName', {
              name: getBudgetGroupLabel(tr, group.id, group.name),
            }),
            color: group.color,
            monthAmount,
            defaultAmount,
          },
        ]
      }
      return []
    })
  }, [budget, periodKey, tr])

  if (overrides.length === 0) return null

  return (
    <section className={cn(cardSurfaceClassName, 'p-3 sm:p-4')}>
      <div className="flex items-center justify-between gap-2">
        <PanelHeader
          title={tr('wfSpending:budgetEditor.overridesTitle', {
            count: overrides.length,
          })}
          icon={<Icons.Pencil className="h-3.5 w-3.5" />}
        />
      </div>
      <div className="mt-2 space-y-2">
        {overrides.map((o) => {
          const delta = subtractMoney(o.monthAmount, o.defaultAmount)
          const positive = decimalUnits(delta) > 0n
          return (
            <div key={o.target.id} className="group/override min-w-0">
              <div className="flex items-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor: o.color ?? 'var(--muted-foreground)',
                  }}
                  aria-hidden
                />
                <span className="text-foreground min-w-0 flex-1 truncate text-xs">
                  {o.name}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground h-5 w-5 shrink-0 p-0 opacity-0 transition-opacity group-hover/override:opacity-100"
                  aria-label={tr('wfSpending:budgetEditor.revertThisOverride')}
                  onClick={() => onRevert(o.target)}
                >
                  <Icons.X className="h-3 w-3" />
                </Button>
              </div>
              <div className="text-2xs mt-0.5 flex items-baseline gap-1.5 ps-3 tabular-nums">
                <span className="text-foreground font-medium">
                  <PrivacyAmount value={o.monthAmount} currency={currency} />
                </span>
                <span className="text-muted-foreground/70">
                  {tr('wfSpending:budgetEditor.vs')}{' '}
                  <PrivacyAmount value={o.defaultAmount} currency={currency} />
                </span>
                <span
                  className={cn(
                    'ms-auto font-medium',
                    decimalUnits(delta) === 0n
                      ? 'text-muted-foreground'
                      : positive
                        ? 'text-destructive'
                        : 'text-success',
                  )}
                >
                  {decimalUnits(delta) === 0n ? (
                    '—'
                  ) : (
                    <>
                      {positive ? '+' : ''}
                      <PrivacyAmount value={delta} currency={currency} />
                    </>
                  )}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function CopyFromMonthRow({
  currentPeriodKey,
  onCopy,
  pending,
}: {
  currentPeriodKey: string
  onCopy: (sourcePeriodKey: string, overwrite: boolean) => void
  pending: boolean
}) {
  const previousMonth = useMemo(() => {
    const [year, month] = currentPeriodKey.split('-').map(Number)
    if (!Number.isFinite(year) || !Number.isFinite(month))
      return currentPeriodKey
    const date = new Date(year, (month ?? 1) - 2, 1)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  }, [currentPeriodKey])
  const { t } = useTranslation()
  const [sourceMonth, setSourceMonth] = useState(previousMonth)
  const [overwrite, setOverwrite] = useState(false)

  return (
    <section className={cn(cardSurfaceClassName, 'p-3 sm:p-4')}>
      <PanelHeader
        title={t('wfSpending:budgetEditor.copyPlanTitle')}
        icon={<Icons.Copy className="h-3.5 w-3.5" />}
      />
      <p className="text-muted-foreground text-2xs mt-1">
        {t('wfSpending:budgetEditor.copyPlanDesc')}{' '}
        {overwrite
          ? t('wfSpending:budgetEditor.copyOverwrite')
          : t('wfSpending:budgetEditor.copyPreserve')}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="bg-background border-input flex items-center rounded-md border px-2">
          <Icons.Calendar className="text-muted-foreground h-3.5 w-3.5" />
          <input
            type="month"
            value={sourceMonth}
            readOnly
            max={currentPeriodKey}
            aria-label={t('wfSpending:budgetEditor.sourceMonth')}
            onChange={(event) =>
              setSourceMonth(event.target.value || previousMonth)
            }
            className="text-foreground h-7 w-30 bg-transparent px-2 text-xs outline-none"
          />
        </div>
        <label className="text-muted-foreground text-2xs inline-flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={overwrite}
            onChange={(event) => setOverwrite(event.target.checked)}
            className="accent-foreground h-3 w-3"
          />
          {t('wfSpending:budgetEditor.replaceExisting')}
        </label>
        <Button
          size="sm"
          variant="outline"
          disabled={!sourceMonth || sourceMonth === currentPeriodKey || pending}
          onClick={() => {
            if (
              !overwrite ||
              window.confirm(t('spendingMigration:confirmCopy'))
            )
              onCopy(sourceMonth, overwrite)
          }}
          className="ms-auto h-7 px-3 text-xs"
        >
          {pending
            ? t('wfSpending:budgetEditor.copying')
            : t('wfSpending:budgetEditor.copyPlan')}
        </Button>
      </div>
    </section>
  )
}

function PanelHeader({ title, icon }: { title: string; icon: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{icon}</span>
      <h2 className="text-muted-foreground text-2xs font-semibold tracking-[0.08em] uppercase">
        {title}
      </h2>
    </div>
  )
}

function findCategoryTarget(
  targets: BudgetTarget[],
  periodKey: string,
  taxonomyId: string,
  categoryId: string,
) {
  return targets.find(
    (target) =>
      target.targetType === 'category' &&
      target.periodKey === periodKey &&
      target.taxonomyId === taxonomyId &&
      target.categoryId === categoryId,
  )
}
