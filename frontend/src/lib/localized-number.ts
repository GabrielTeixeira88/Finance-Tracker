import { getLocale } from './preferences'

/** Parse UI text only. Never use for imported source data or API responses. */
export function parseLocalizedDecimal(
  text: string,
  locale: string = getLocale(),
): string {
  const parts = new Intl.NumberFormat(locale).formatToParts(12345.6)
  const decimal = parts.find((p) => p.type === 'decimal')?.value ?? '.'
  const group = parts.find((p) => p.type === 'group')?.value ?? ','
  const input = text.trim().replace(/^−/, '-')
  const negative = input.startsWith('-')
  const unsigned = input.replace(/^[+-]/, '')
  const chunks = unsigned.split(decimal)
  if (chunks.length > 2 || (chunks.length === 2 && !/^\d+$/.test(chunks[1])))
    throw new Error('Invalid localized number')
  const whole = chunks[0]
  const groups = whole.split(group)
  if (
    groups.length > 1 &&
    (!/^\d{1,3}$/.test(groups[0]) ||
      groups.slice(1).some((p) => !/^\d{3}$/.test(p)))
  )
    throw new Error('Invalid localized number')
  if (!groups.every((p) => /^\d+$/.test(p)))
    throw new Error('Invalid localized number')
  return `${negative ? '-' : ''}${groups.join('').replace(/^0+(?=\d)/, '')}${chunks.length === 2 ? `.${chunks[1]}` : ''}`
}

/** Decimal editing preserves all digits and uses no grouping. */
export function localizeDecimal(
  value: string,
  locale: string = getLocale(),
): string {
  const separator =
    new Intl.NumberFormat(locale)
      .formatToParts(1.1)
      .find((p) => p.type === 'decimal')?.value ?? '.'
  return value.replace('.', separator)
}

export function exactFormData(form: HTMLFormElement) {
  const data = new FormData(form)
  for (const input of form.querySelectorAll<HTMLInputElement>(
    'input[data-exact-decimal][name]',
  )) {
    if (!input.disabled) data.set(input.name, input.dataset.exactDecimal ?? '')
  }
  return data
}
