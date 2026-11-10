import {
  activityPercent,
  formatMoney,
  formatDecimal,
  formatExactPercent,
  subtractMoney,
  formatRatioPercent,
} from './money'

it('labels actual goal ratios exactly and keeps unavailable progress distinct from zero', () => {
  expect(formatRatioPercent('0.48')).toBe('48,00%')
  expect(formatRatioPercent('0.000001')).toBe('0,00%')
  expect(formatRatioPercent('1.25')).toBe('125,00%')
  expect(formatRatioPercent('0')).toBe('0,00%')
  expect(formatRatioPercent(null)).toBe('Unavailable')
})

it('uses the fixed Brazilian currency display regardless of legacy locale options', () => {
  expect(
    formatMoney('5265', 'BRL', { locale: 'pt-BR' }).replace(/\u00a0/g, ' '),
  ).toBe('R$ 5.265,00')
  expect(
    formatMoney('-1234.56', 'EUR', { locale: 'de-DE' }).replace(/\u00a0/g, ' '),
  ).toBe('-\u20ac 1.234,56')
  expect(formatMoney('15', 'JPY', { locale: 'en-US' })).toBe('JP¥ 15,00')
})

it('keeps large values and fractional digits exact', () => {
  expect(
    formatMoney('999999999999999999.999999', 'USD', { locale: 'en-US' }),
  ).toBe('US$ 1.000.000.000.000.000.000,00')
  expect(
    subtractMoney('9007199254740993.123456', '9007199254740993.123455'),
  ).toBe('0.000001')
  expect(subtractMoney('1000', '235')).toBe('765.000000')
  expect(subtractMoney('0', '1.01')).toBe('-1.010000')
})

it('keeps full two-decimal amounts even for legacy compact requests and retains bounded proportions', () => {
  expect(
    formatMoney('56745747', 'BRL', { locale: 'en-US', compact: true }),
  ).toBe('R$ 56.745.747,00')
  expect(activityPercent('200', '1000', '200')).toBe(16)
  expect(activityPercent('0', '0', '0')).toBe(0)
})

it('applies two decimals globally while leaving canonical arithmetic untouched', () => {
  for (const locale of ['en-US', 'pt-BR', 'es-419']) {
    expect(
      formatMoney('57434.512488', 'BRL', {
        locale,
        compact: true,
        fractionDigits: 0,
      }),
    ).toBe('R$ 57.434,51')
    expect(formatMoney('0', 'JPY', { locale })).toBe('JP\u00a5 0,00')
  }
  expect(formatDecimal('1000.123456')).toBe('1.000,12')
  expect(formatDecimal('-0.125')).toBe('-0,13')
  expect(formatExactPercent('18.299425', 6)).toBe('18,30%')
  expect(formatExactPercent(null)).toBe('Unavailable')
  expect(subtractMoney('57434.512488', '57434.512487')).toBe('0.000001')
})
