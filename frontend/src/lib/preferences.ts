import { useSyncExternalStore } from 'react'

export const fonts = {
  mono: 'JetBrains Mono',
  inter: 'Inter',
  geist: 'Geist',
  manrope: 'Manrope',
  plex: 'IBM Plex Sans',
  dm: 'DM Sans',
  source: 'Source Sans 3',
  outfit: 'Outfit',
  merriweather: 'Merriweather',
  serif: 'Source Serif 4',
} as const
export const palettes = [
  'olive',
  'graphite',
  'forest',
  'plum',
  'ocean',
  'indigo',
  'rose',
  'teal',
  'violet',
  'crimson',
  'midnight-cobalt',
  'carbon-amber',
  'amethyst-night',
  'porcelain-blue',
  'sandstone-copper',
] as const
export const chartPalettes = [
  'theme',
  'balanced',
  'cool',
  'warm',
  'muted',
] as const
export const financialColors = ['standard', 'reversed', 'neutral'] as const
export const themes = [
  'olive',
  'midnight-cobalt',
  'carbon-amber',
  'amethyst-night',
  'porcelain-blue',
  'sandstone-copper',
] as const
export const themeNames = {
  olive: 'Classic',
  'midnight-cobalt': 'Midnight Cobalt',
  'carbon-amber': 'Carbon Amber',
  'amethyst-night': 'Amethyst Night',
  'porcelain-blue': 'Porcelain Blue',
  'sandstone-copper': 'Sandstone Copper',
}
export const languages = ['en', 'pt-BR', 'es-419'] as const
export type Language = (typeof languages)[number]
export type Preferences = {
  font: keyof typeof fonts
  palette: (typeof palettes)[number]
  mode: 'light' | 'dark' | 'system'
  chartPalette: (typeof chartPalettes)[number]
  financialColors: (typeof financialColors)[number]
  language: Language
}
export const defaults: Preferences = {
  chartPalette: 'theme',
  financialColors: 'standard',
  font: 'mono',
  palette: 'olive',
  mode: 'dark',
  language: 'en',
}
let scope: 'normal' | 'demo' = 'normal'
try {
  if (sessionStorage.getItem('finance-tracker-appearance-scope') === 'demo')
    scope = 'demo'
} catch {
  /* Optional appearance hint. */
}
const listeners = new Set<() => void>()
const key = () => `finance-tracker-preferences-${scope}`
function browserLanguage(): Language {
  const locale = navigator.language.toLowerCase()
  return locale.startsWith('pt')
    ? 'pt-BR'
    : locale.startsWith('es')
      ? 'es-419'
      : 'en'
}
function read(): Preferences {
  try {
    const saved = JSON.parse(localStorage.getItem(key()) ?? '{}')
    const font = saved.font === 'public' ? 'inter' : saved.font
    const palette = ['slate', 'orange', 'sand'].includes(saved.palette)
      ? 'graphite'
      : saved.palette
    const legacy =
      scope === 'normal' ? localStorage.getItem('finance-tracker-theme') : null
    return {
      chartPalette: chartPalettes.includes(saved.chartPalette)
        ? saved.chartPalette
        : defaults.chartPalette,
      financialColors: financialColors.includes(saved.financialColors)
        ? saved.financialColors
        : defaults.financialColors,
      font: Object.hasOwn(fonts, font) ? font : defaults.font,
      palette: palettes.includes(palette) ? palette : defaults.palette,
      mode: ['light', 'dark', 'system'].includes(saved.mode)
        ? saved.mode
        : legacy === 'light'
          ? 'light'
          : 'dark',
      language: languages.includes(saved.language)
        ? saved.language
        : browserLanguage(),
    }
  } catch {
    return { ...defaults, language: browserLanguage() }
  }
}
let current = read()
const media = window.matchMedia?.('(prefers-color-scheme: dark)')
function apply() {
  const root = document.documentElement
  root.dataset.workspace = scope
  root.dataset.theme =
    current.mode === 'system'
      ? media?.matches
        ? 'dark'
        : 'light'
      : current.mode
  root.style.colorScheme = root.dataset.theme
  root.dataset.palette = current.palette
  root.dataset.font = current.font
  root.dataset.chartPalette = current.chartPalette
  root.dataset.financialColors = current.financialColors
  root.lang = current.language
  root.style.setProperty(
    '--app-font',
    `"${fonts[current.font]}", ${current.font === 'mono' ? 'monospace' : ['merriweather', 'serif'].includes(current.font) ? 'serif' : 'sans-serif'}`,
  )
}
function emit() {
  apply()
  listeners.forEach((listener) => listener())
}
media?.addEventListener('change', () => {
  current = { ...current }
  emit()
})
window.addEventListener('storage', (event) => {
  if (event.key === key() || event.key === null) {
    current = read()
    emit()
  }
})
apply()
export const getPreferences = () => current
export function subscribePreferences(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
export function setPreferences(patch: Partial<Preferences>) {
  current = { ...current, ...patch }
  try {
    localStorage.setItem(key(), JSON.stringify(current))
  } catch {
    /* Optional storage. */
  }
  emit()
}
export function setPreferenceWorkspace(demo: boolean) {
  scope = demo ? 'demo' : 'normal'
  try {
    sessionStorage.setItem('finance-tracker-appearance-scope', scope)
  } catch {
    /* Optional appearance hint. */
  }
  current = read()
  emit()
}
export function resetAppearance() {
  setPreferences({
    chartPalette: defaults.chartPalette,
    financialColors: defaults.financialColors,
    font: defaults.font,
    palette: defaults.palette,
    mode: defaults.mode,
  })
}
export function usePreferences() {
  return useSyncExternalStore(subscribePreferences, getPreferences)
}
export const getLocale = () => current.language
