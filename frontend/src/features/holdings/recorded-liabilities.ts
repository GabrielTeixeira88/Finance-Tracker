import { getDemoDate, localDate } from '@/lib/api'
import { decimalUnits, sumMoney, unitsToMoney } from '@/lib/money'
import type { ManualHolding } from './api'
import type { Exact } from './types'
export type LiabilityStatus =
  'paid_off' | 'renewal_due' | 'renew_soon' | 'update_balance'
export type LiabilityCardModel = {
  type: string
  balance: Exact
  balanceAvailable: boolean
  original: Exact
  paidShare: Exact
  scheduled: false
  rate: Exact
  payment: null
  frequency: null
  payoffDate: string | null
  status: LiabilityStatus | null
  reduction: Exact
}
export const useLoanToday = () => getDemoDate() || localDate()
export function liabilityCardModel(
  holding: ManualHolding,
  today: string,
): LiabilityCardModel {
  const stale =
    holding.valuationDate === null ||
    (Date.parse(today) - Date.parse(holding.valuationDate)) / 86400000 > 180
  return {
    type:
      (
        {
          MORTGAGE: 'mortgage',
          VEHICLE_LOAN: 'auto_loan',
          STUDENT_LOAN: 'student_loan',
          PERSONAL_LOAN: 'personal_loan',
        } as Record<string, string>
      )[holding.position.category] ?? 'other',
    balance: holding.marketValue,
    balanceAvailable: holding.marketValue !== null,
    original: holding.recordedStartingBalance,
    paidShare: holding.paidShare,
    scheduled: false,
    rate: holding.position.interest_rate,
    payment: null,
    frequency: null,
    payoffDate: holding.position.expected_payoff_date,
    status:
      holding.marketValue !== null && decimalUnits(holding.marketValue) === 0n
        ? 'paid_off'
        : stale
          ? 'update_balance'
          : null,
    reduction: holding.recordedReduction,
  }
}
export function liabilitySummary(models: LiabilityCardModel[]) {
  const complete = models.every((m) => m.balance !== null)
  const amounts = models.filter(
    (m) => m.original !== null && m.reduction !== null,
  )
  const starting = sumMoney(amounts.map((m) => m.original!))
  const reduction = sumMoney(amounts.map((m) => m.reduction!))
  return {
    owed: complete ? sumMoney(models.map((m) => m.balance!)) : null,
    paidDown: amounts.length ? reduction : null,
    overall:
      decimalUnits(starting) > 0n
        ? unitsToMoney(
            (decimalUnits(reduction) * 1000000n) / decimalUnits(starting),
          )
        : null,
    monthly: null,
  }
}
