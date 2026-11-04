import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { z } from 'zod'
import { ptBR, es as spanishErrors, en as englishErrors } from 'zod/v4/locales'
import en from '../locales/en.json'
import pt from '../locales/pt-BR.json'
import es from '../locales/es-419.json'
import { getLocale, subscribePreferences } from './preferences'

void i18n.use(initReactI18next).init({
  resources: { en, 'pt-BR': pt, 'es-419': es },
  lng: getLocale(),
  fallbackLng: 'en',
  supportedLngs: ['en', 'pt-BR', 'es-419'],
  load: 'currentOnly',
  initAsync: false,
  ns: Object.keys(en),
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  returnNull: false,
})
function updateValidationLocale() {
  z.config(
    getLocale() === 'pt-BR'
      ? ptBR()
      : getLocale() === 'es-419'
        ? spanishErrors()
        : englishErrors(),
  )
}
updateValidationLocale()
subscribePreferences(() => {
  updateValidationLocale()
  if (i18n.language !== getLocale()) void i18n.changeLanguage(getLocale())
})
export function t(key: string, values: Record<string, unknown> = {}): string {
  return String(i18n.t(key, values))
}
/** Only for application-owned control/enum labels, never user content or error prose. */
export function ui(value: string): string {
  if (i18n.language === 'en') return value
  const key = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
  return Object.hasOwn(en.labels, key) ? t(`labels:${key}`) : value
}
export default i18n
