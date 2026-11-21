import './i18n'
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { FinancialPrivacyContext } from '@/lib/financial-privacy'
import { AmountDisplay, QuantityDisplay } from './formatting'
import { compareExact, exactSubtract } from './compat'
import { formatMoney } from '@/lib/money'

it('retains precision above the Number integer range and rounds display only', () => {
  const value = '9007199254740993.123456'
  const { container } = render(<AmountDisplay value={value} currency="BRL" />)
  expect(container.querySelector('[data-exact]')).toHaveAttribute(
    'data-exact',
    value,
  )
  expect(container.textContent).toBe(formatMoney(value, 'BRL'))
  expect(compareExact(value, '9007199254740993.123455')).toBe(1)
  expect(exactSubtract(value, '9007199254740993.123455')).toBe('0.000001')
})

it('keeps unavailable values distinct from zero and masks exact HTML attributes', () => {
  const { rerender, container } = render(
    <>
      <AmountDisplay value={null} currency="BRL" />
      <QuantityDisplay value={null} />
    </>,
  )
  expect(screen.getAllByText('—')).toHaveLength(2)
  rerender(
    <FinancialPrivacyContext.Provider
      value={{ hidden: true, toggle: () => {} }}
    >
      <AmountDisplay value="12345.678900" currency="BRL" isHidden />
    </FinancialPrivacyContext.Provider>,
  )
  expect(container.textContent).not.toContain('12.345')
  expect(container.querySelector('[data-exact]')).toBeNull()
})
