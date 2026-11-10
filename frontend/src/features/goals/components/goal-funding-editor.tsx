// SPDX-License-Identifier: AGPL-3.0-only
// Wealthfolio 92b4647 goal-funding-editor.tsx: source card/edit/read layout,
// account list, available-account picker and details sheet. Fixed dated amounts
// and manual progress retain Finance Tracker's established funding authority.
import '../i18n'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getAccounts } from '@/lib/api'
import { getAllocations } from '@/lib/wealth-api'
import {
  Button,
  Icons,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/features/spending/ui'
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
} from '@/vendor/wealthfolio/ui/components/ui/card'
import { AmountDisplay } from '@/features/holdings/formatting'
import { getSavedGoal, useGoalWrite, goalDate } from '../api'
import { useBalancePrivacy } from '../compat'
import { GoalLeverRow } from './goal-lever-row'
import { Field } from '@/components/forms'
import { ErrorState, LoadingState } from '@/components/primitives'
import { decimalUnits, sumMoney, formatDate } from '@/lib/money'

export function GoalFundingEditor({ goalId }: { goalId: string }) {
  const { t } = useTranslation(),
    { isBalanceHidden } = useBalancePrivacy(),
    write = useGoalWrite()
  const goal = useQuery({
    queryKey: ['goal', goalId],
    queryFn: ({ signal }) => getSavedGoal(goalId, signal),
  })
  const accounts = useQuery({
      queryKey: ['accounts'],
      queryFn: ({ signal }) => getAccounts(signal),
    }),
    allocations = useQuery({
      queryKey: ['goal-allocations'],
      queryFn: getAllocations,
    })
  const [isEditing, setEditing] = useState(false),
    [detailsOpen, setDetailsOpen] = useState(false),
    [amounts, setAmounts] = useState<Record<string, string>>({}),
    [investment, setInvestment] = useState(''),
    [day, setDay] = useState(goalDate()),
    [manualAmount, setManualAmount] = useState('0'),
    [direction, setDirection] = useState('IN')
  if (goal.isPending || accounts.isPending || allocations.isPending)
    return <LoadingState />
  if (goal.isError || accounts.isError || allocations.isError)
    return (
      <ErrorState
        text={
          (goal.error ?? accounts.error ?? allocations.error)?.message ??
          t('common:unavailable')
        }
      />
    )
  const detail = goal.data,
    g = detail.goal,
    currency = g.currency
  const own = new Map(
    detail.allocations.map((row) => [row.account_id, row.amount]),
  )
  const currentAccount = accounts.data.find(
    (row) => row.id === detail.funding_account_id,
  )
  const cash = accounts.data.filter(
    (row) =>
      ['CHECKING', 'SAVINGS', 'CASH'].includes(row.type) &&
      row.currency === currency,
  )
  const eligible = accounts.data.filter(
    (row) =>
      row.active && row.type === 'INVESTMENT' && row.currency === currency,
  )
  const currentAmount = (id: string) => own.get(id) ?? '0'
  const available = (id: string) => {
    const row = allocations.data.find((row) => row.account_id === id)
    return row?.unallocated === null || row?.unallocated === undefined
      ? null
      : sumMoney([row.unallocated, currentAmount(id)])
  }
  const invalid = Object.entries(amounts).some(([id, value]) => {
    const free = available(id)
    return (
      decimalUnits(value) < 0n ||
      free === null ||
      decimalUnits(value) > decimalUnits(free)
    )
  })
  const canEdit =
    !detail.deleted && !['ARCHIVED', 'COMPLETED'].includes(g.status)
  const begin = () => {
    setAmounts(
      Object.fromEntries(
        detail.allocations.map((row) => [row.account_id, row.amount]),
      ),
    )
    setInvestment('')
    setDay(goalDate())
    setEditing(true)
    write.reset()
  }
  const save = () => {
    if (
      write.isPending ||
      invalid ||
      document.querySelector('.goal-funding-card [aria-invalid="true"]')
    )
      return
    const path =
      g.mode === 'MANUAL'
        ? `/goals/${goalId}/entries`
        : `/goals/${goalId}/funding`
    const data =
      g.mode === 'MANUAL'
        ? { effective_date: day, amount: manualAmount, direction, notes: '' }
        : {
            effective_date: day,
            allocations: investment
              ? []
              : Object.entries(amounts).map(([account_id, amount]) => ({
                  account_id,
                  amount,
                })),
            investment_account_id: investment || null,
          }
    write.mutate(
      { path, method: g.mode === 'MANUAL' ? 'POST' : 'PUT', data },
      { onSuccess: () => setEditing(false) },
    )
  }
  return (
    <>
      <Card className="goal-funding-card">
        <CardHeader className="flex-row items-start justify-between pb-4">
          <CardTitle className="text-base leading-none tracking-tight">
            {g.mode === 'MANUAL'
              ? t('goalsMigration:manualFunding')
              : t('goalsMigration:fixedFunding')}
          </CardTitle>
          {isEditing ? (
            <div className="flex gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setDetailsOpen(true)}
              >
                {t('wfCommon:details')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setEditing(false)}
                disabled={write.isPending}
              >
                {t('wfCommon:cancel')}
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={save}
                disabled={
                  write.isPending ||
                  invalid ||
                  Boolean(currentAccount) ||
                  (g.mode === 'ACCOUNT' &&
                    !investment &&
                    !Object.keys(amounts).length)
                }
              >
                {write.isPending
                  ? t('wfGoals:funding.saving')
                  : t('wfCommon:save')}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setDetailsOpen(true)}
                className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-4 transition-colors"
              >
                {t('wfCommon:details')}
              </button>
              {canEdit && !currentAccount && (
                <button
                  type="button"
                  onClick={begin}
                  aria-label={t('goalsMigration:editFunding')}
                  className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1.5 text-sm transition-colors"
                >
                  <Icons.Pencil className="h-3.5 w-3.5" />
                  {t('wfCommon:edit')}
                </button>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <div className="space-y-3">
              <p className="text-muted-foreground text-xs">
                {t('goalsMigration:fundingNote')}
              </p>
              <Field label={t('goalsMigration:effectiveDate')}>
                <input
                  type="date"
                  value={day}
                  min={g.start_date}
                  max={goalDate()}
                  onChange={(event) => setDay(event.target.value)}
                  required
                />
              </Field>
              {g.mode === 'MANUAL' ? (
                <>
                  <GoalLeverRow
                    label={t('goalsMigration:amount')}
                    value={manualAmount}
                    onChange={setManualAmount}
                    max="10000"
                    step="25"
                  />
                  <Field label={t('goalsMigration:direction')}>
                    <select
                      value={direction}
                      onChange={(event) => setDirection(event.target.value)}
                    >
                      <option value="IN">
                        {t('goalsMigration:contribution')}
                      </option>
                      <option value="OUT">
                        {t('goalsMigration:withdrawal')}
                      </option>
                    </select>
                  </Field>
                </>
              ) : (
                <>
                  {!investment &&
                    Object.entries(amounts).map(([id, amount]) => {
                      const row = cash.find((row) => row.id === id)
                      return (
                        <div
                          key={id}
                          className="border-border/60 rounded-lg border p-2.5"
                        >
                          <GoalLeverRow
                            label={row?.name ?? id}
                            value={amount}
                            onChange={(value) =>
                              setAmounts({ ...amounts, [id]: value })
                            }
                            max={available(id) ?? '0'}
                            step="1"
                          />
                          <div className="text-muted-foreground flex items-center justify-between text-xs">
                            <span>
                              {t('goalsMigration:available')}{' '}
                              <AmountDisplay
                                value={available(id)}
                                currency={currency}
                                isHidden={isBalanceHidden}
                              />
                            </span>
                            <button
                              className="hover:text-foreground"
                              onClick={() =>
                                setAmounts({ ...amounts, [id]: '0' })
                              }
                            >
                              {t('goalsMigration:releaseAmount')}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  {!investment &&
                    cash
                      .filter((row) => row.active && !(row.id in amounts))
                      .map((row) => (
                        <button
                          key={row.id}
                          onClick={() =>
                            setAmounts({ ...amounts, [row.id]: '0' })
                          }
                          className="hover:bg-muted/50 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-start transition-colors"
                        >
                          <Icons.Plus className="text-muted-foreground h-3 w-3 shrink-0" />
                          <span className="min-w-0 flex-1 truncate text-xs">
                            {row.name}
                          </span>
                          <span className="text-muted-foreground text-2xs">
                            {row.type}
                          </span>
                        </button>
                      ))}
                  {detail.can_assign_investment && (
                    <Field label={t('goalsMigration:wholeAccount')}>
                      <select
                        value={investment}
                        onChange={(event) => {
                          setInvestment(event.target.value)
                          if (event.target.value) setAmounts({})
                        }}
                      >
                        <option value="">
                          {t('goalsMigration:fixedFunding')}
                        </option>
                        {eligible.map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}
                </>
              )}
              {invalid && (
                <p role="alert" className="text-destructive text-xs">
                  {t('goalsMigration:allocationLimit')}
                </p>
              )}
            </div>
          ) : (
            <div>
              {currentAccount ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span>{currentAccount.name}</span>
                    <AmountDisplay
                      value={detail.saved}
                      currency={currency}
                      isHidden={isBalanceHidden}
                    />
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {t('goalsMigration:exclusiveFunding')}
                  </p>
                </div>
              ) : g.mode === 'MANUAL' ? (
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span>{t('goalsMigration:manualFunding')}</span>
                  <AmountDisplay
                    value={detail.saved}
                    currency={currency}
                    isHidden={isBalanceHidden}
                  />
                </div>
              ) : detail.allocations.length ? (
                detail.allocations.map((row) => (
                  <div
                    className="flex items-center gap-2 py-2 text-sm"
                    key={row.account_id}
                  >
                    <span className="bg-chart-1 h-2.5 w-2.5 shrink-0 rounded-sm" />
                    <span className="min-w-0 flex-1 truncate">
                      {
                        accounts.data.find(
                          (account) => account.id === row.account_id,
                        )?.name
                      }
                    </span>
                    <AmountDisplay
                      value={row.amount}
                      currency={currency}
                      isHidden={isBalanceHidden}
                    />
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground py-2 text-xs">
                  {t('wfGoals:funding.no_accounts_assigned')}
                  {canEdit && (
                    <button
                      className="text-foreground ms-1 underline underline-offset-2"
                      onClick={begin}
                    >
                      {t('wfGoals:funding.add_accounts_action')}
                    </button>
                  )}
                </p>
              )}
            </div>
          )}
          {write.isError && <ErrorState text={write.error.message} />}
        </CardContent>
      </Card>
      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{t('goalsMigration:fundingDetails')}</SheetTitle>
            <SheetDescription>
              {t('goalsMigration:fundingNote')}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-5 p-5">
            <h3 className="font-medium">{t('goalsMigration:sharedSavings')}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  {t('goalsMigration:sharedSavings')}
                </caption>
                <thead>
                  <tr>
                    <th>{t('goalsMigration:account')}</th>
                    <th>{t('goalsMigration:balance')}</th>
                    <th>{t('goalsMigration:allocated')}</th>
                    <th>{t('goalsMigration:available')}</th>
                  </tr>
                </thead>
                <tbody>
                  {allocations.data
                    .filter((row) => row.currency === currency)
                    .map((row) => (
                      <tr key={row.account_id}>
                        <th scope="row">{row.name}</th>
                        <td>
                          <AmountDisplay
                            value={row.balance}
                            currency={currency}
                            isHidden={isBalanceHidden}
                          />
                        </td>
                        <td>
                          <AmountDisplay
                            value={row.allocated}
                            currency={currency}
                            isHidden={isBalanceHidden}
                          />
                        </td>
                        <td>
                          <AmountDisplay
                            value={row.unallocated}
                            currency={currency}
                            isHidden={isBalanceHidden}
                          />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <h3 className="font-medium">{t('goalsMigration:history')}</h3>
            {detail.entries.map((entry) => (
              <div
                className="border-border/50 flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm"
                key={entry.id}
              >
                <span>
                  {formatDate(entry.effective_date)} ·{' '}
                  {entry.direction === 'OUT' ? '−' : '+'}
                </span>
                <AmountDisplay
                  value={entry.amount}
                  currency={currency}
                  isHidden={isBalanceHidden}
                />
                <span className="text-muted-foreground text-xs">
                  {entry.voided_at ? t('goalsMigration:voided') : entry.notes}
                </span>
                {!entry.voided_at && canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={write.isPending}
                    onClick={() => {
                      const reason = window.prompt(
                        t('goalsMigration:voidReason'),
                      )
                      if (reason?.trim())
                        write.mutate({
                          path: '/goal-entries/' + entry.id + '/void',
                          data: { reason: reason.trim() },
                        })
                    }}
                  >
                    {t('goalsMigration:voidEntry')}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
