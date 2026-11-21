import { expect, it } from 'vitest'
import { transactionSchema } from '@/lib/api'
import { getTransactionDisplay, toSpendingRow } from './compat'

const row = transactionSchema.parse({
  id: 'fictional',
  account_id: 'account',
  transaction_type: 'EXPENSE',
  direction: 'OUT',
  amount: '9007199254740993.123456',
  currency: 'BRL',
  transaction_date: '2026-09-01',
  description: 'Original merchant line',
  merchant: null,
  category_id: 'category',
  transfer_id: null,
  deleted_at: null,
  payee_id: 'payee',
  payee: { id: 'payee', name: 'Normalized payee' },
  review_status: 'NEEDS_REVIEW',
})
it('keeps raw descriptions, normalized names and exact values separate', () => {
  const view = toSpendingRow(
    row,
    [{ id: 'category', name: 'User category' }],
    true,
  )
  expect(view.activity.notes).toBe('Normalized payee')
  expect(view.activity.rawDescription).toBe('Original merchant line')
  expect(view.needsReview).toBe(true)
  expect(view.category?.name).toBe('User category')
  expect(getTransactionDisplay(view.activity).safeAmount).toBe(
    '9007199254740993.123456',
  )
  expect(getTransactionDisplay(view.activity).sign).toBe('−')
  expect(view.canDuplicate).toBe(true)
})
it('keeps linked transfers neutral and prevents independent duplication/deletion', () => {
  const transfer = toSpendingRow(
    { ...row, transaction_type: 'TRANSFER', transfer_id: 'linked-pair' },
    [],
    true,
  )
  expect(getTransactionDisplay(transfer.activity)).toMatchObject({
    isNeutral: true,
    isIncome: false,
    isOutflow: false,
    sign: '',
  })
  expect(transfer.canDuplicate).toBe(false)
  expect(transfer.canDelete).toBe(false)
  const opening = toSpendingRow(
    { ...row, transaction_type: 'OPENING_BALANCE' },
    [],
    true,
  )
  expect(getTransactionDisplay(opening.activity)).toMatchObject({
    isNeutral: true,
    sign: '−',
  })
  expect(opening.canDuplicate).toBe(false)
})
it('inherits refund categories without displaying refunds as income', () => {
  const refund = toSpendingRow(
    {
      ...row,
      transaction_type: 'INCOME',
      direction: 'IN',
      refund_purchase_id: 'purchase',
      spending_category_id: 'inherited',
    },
    [{ id: 'inherited', name: 'Original purchase category' }],
    true,
  )
  expect(refund.category?.id).toBe('inherited')
  expect(getTransactionDisplay(refund.activity)).toMatchObject({
    isRefund: true,
    isIncome: false,
    sign: '+',
  })
  expect(refund.canDuplicate).toBe(false)
})
