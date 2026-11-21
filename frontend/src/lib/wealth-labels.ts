import { t } from './i18n'

const knownLabels = new Set([
  'REAL_ESTATE',
  'VEHICLE',
  'COLLECTIBLE',
  'PRECIOUS_METALS',
  'PRIVATE_BUSINESS',
  'OTHER',
  'MORTGAGE',
  'LOAN',
  'CREDIT_CARD',
  'LIQUID',
  'MARKETABLE',
  'ILLIQUID',
  'UNKNOWN',
  'AT_MATURITY',
  'TESOURO_SELIC',
  'CDB',
  'RDB',
])

/** Only canonical application enums are localized; custom categories stay verbatim. */
export function formatWealthLabel(value: string): string {
  return knownLabels.has(value) ? t(`wealthLabels:${value}`) : value
}
