import { activityPercent, formatMoney, subtractMoney } from './money'

it('formats currency symbols and separators for the requested locale', () => {
  expect(
    formatMoney('5265', 'BRL', { locale: 'pt-BR' }).replace(/\u00a0/g, ' '),
  ).toBe('R$ 5.265,00')
  expect(
    formatMoney('-1234.56', 'EUR', { locale: 'de-DE' }).replace(/\u00a0/g, ' '),
  ).toBe('-1.234,56 €')
  expect(formatMoney('15', 'JPY', { locale: 'en-US' })).toBe('¥15')
})

it('keeps large values and fractional digits exact', () => {
  expect(
    formatMoney('999999999999999999.999999', 'USD', { locale: 'en-US' }),
  ).toBe('$999,999,999,999,999,999.999999')
  expect(
    subtractMoney('9007199254740993.123456', '9007199254740993.123455'),
  ).toBe('0.000001')
  expect(subtractMoney('1000', '235')).toBe('765.000000')
  expect(subtractMoney('0', '1.01')).toBe('-1.010000')
})

it('provides compact sidebar values and bounded dimensionless activity proportions', () => {
  expect(
    formatMoney('56745747', 'BRL', { locale: 'en-US', compact: true }),
  ).toBe('R$56.7M')
  expect(activityPercent('200', '1000', '200')).toBe(16)
  expect(activityPercent('0', '0', '0')).toBe(0)
})
