import '@/features/spending/i18n'
import '@/features/goals/i18n'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import appearanceBootstrap from '../../public/appearance-init.js?raw'
import { request, moneyInput } from './api'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { DecimalInput } from '@/components/decimal-input'
import { exactFormData } from '@/lib/localized-number'
import { compositionData } from '@/lib/composition'
import { parseLocalizedDecimal } from './localized-number'
import { formatDate, formatMoney, formatRatioPercent } from './money'
import {
  defaults,
  fonts,
  getPreferences,
  palettes,
  chartPalettes,
  financialColors,
  resetAppearance,
  setPreferences,
  setPreferenceWorkspace,
} from './preferences'
import { t, ui } from './i18n'
import i18n from './i18n'
import '@/features/holdings/i18n'
import en from '../locales/en.json'
import pt from '../locales/pt-BR.json'
import es from '../locales/es-419.json'

beforeEach(() => {
  localStorage.clear()
  setPreferenceWorkspace(false)
  setPreferences(defaults)
})

it('restores independent chart and gain/loss choices in the prepaint bootstrap', () => {
  const execute = new Function(
    'document',
    'localStorage',
    'sessionStorage',
    'matchMedia',
    appearanceBootstrap,
  )
  for (const chartPalette of chartPalettes)
    for (const convention of financialColors) {
      localStorage.setItem(
        'finance-tracker-preferences-normal',
        JSON.stringify({
          ...defaults,
          chartPalette,
          financialColors: convention,
        }),
      )
      const dataset: Record<string, string> = {}
      execute(
        { documentElement: { dataset, style: { setProperty: vi.fn() } } },
        localStorage,
        sessionStorage,
        window.matchMedia,
      )
      setPreferenceWorkspace(false)
      expect(dataset.chartPalette).toBe(chartPalette)
      expect(dataset.financialColors).toBe(convention)
      expect(getPreferences()).toMatchObject({
        chartPalette,
        financialColors: convention,
      })
    }
})
afterEach(() => {
  act(() => {
    setPreferenceWorkspace(false)
    setPreferences(defaults)
  })
  localStorage.clear()
})

describe('exact localized financial input', () => {
  it.each([
    ['1,50', 'pt-BR', '1.50'],
    ['1.50', 'en', '1.50'],
    ['1.50', 'es-419', '1.50'],
    ['1.234.567,123456', 'pt-BR', '1234567.123456'],
    ['1,234,567.123456', 'en', '1234567.123456'],
    ['-1.234,50', 'pt-BR', '-1234.50'],
    ['−1,234.50', 'es-419', '-1234.50'],
    ['999.999.999.999.999.999,999999', 'pt-BR', '999999999999999999.999999'],
    ['  +12,50  ', 'pt-BR', '12.50'],
    ['0,000001', 'pt-BR', '0.000001'],
  ])('parses %s in %s without binary float', (text, locale, exact) => {
    expect(parseLocalizedDecimal(text, locale)).toBe(exact)
  })
  it.each([
    '1.50',
    '1,2,3',
    '1.23,45',
    '1e3',
    'R$ 10',
    'NaN',
    'Infinity',
    '--1',
    '',
  ])('rejects ambiguous/invalid pt input %s', (text) => {
    expect(() => parseLocalizedDecimal(text, 'pt-BR')).toThrow()
  })
  it('submits exact pasted values, validates and resets an uncontrolled amount', () => {
    setPreferences({ language: 'pt-BR' })
    render(
      <form aria-label="form">
        <DecimalInput aria-label="amount" name="amount" defaultValue="2.50" />
        <button type="reset">reset</button>
      </form>,
    )
    const input = screen.getByLabelText('amount') as HTMLInputElement
    expect(input.value).toBe('2,50')
    fireEvent.change(input, { target: { value: '1.234,56' } })
    expect(exactFormData(input.form!).get('amount')).toBe('1234.56')
    fireEvent.change(input, { target: { value: '1.50' } })
    expect(input.checkValidity()).toBe(false)
    expect(input.validationMessage).toBe('Número inválido para este idioma')
    fireEvent.click(screen.getByText('reset'))
    expect(input.value).toBe('2,50')
    expect(input.checkValidity()).toBe(true)
    expect(exactFormData(input.form!).get('amount')).toBe('2.50')
  })
  it('changes display locale without changing canonical controlled percent/money', () => {
    render(<DecimalInput aria-label="rate" value="12.345678" readOnly />)
    act(() => setPreferences({ language: 'pt-BR' }))
    expect(screen.getByLabelText('rate')).toHaveValue('12,345678')
    expect(screen.getByLabelText('rate')).toHaveAttribute(
      'data-exact-decimal',
      '12.345678',
    )
  })
})

it('has matching nonempty namespace keys and interpolation tokens in all languages', () => {
  const flat = (resource: typeof en) =>
    Object.entries(resource)
      .flatMap(([ns, values]) =>
        Object.keys(values).map((key) => `${ns}:${key}`),
      )
      .sort()
  expect(flat(pt)).toEqual(flat(en))
  expect(flat(es)).toEqual(flat(en))
  for (const [ns, values] of Object.entries(en))
    for (const [key, original] of Object.entries(values)) {
      for (const resource of [pt, es]) {
        const value = (resource as Record<string, Record<string, string>>)[ns][
          key
        ]
        expect(value.trim(), `${ns}:${key}`).not.toBe('')
        expect(value.match(/\{\{.*?\}\}/g) ?? []).toEqual(
          original.match(/\{\{.*?\}\}/g) ?? [],
        )
      }
    }
})

it('resolves literal translation keys referenced by every application module', () => {
  const files = import.meta.glob<string>(
    ['../**/*.ts', '../**/*.tsx', '!../**/*.test.ts', '!../**/*.test.tsx'],
    { query: '?raw', import: 'default', eager: true },
  )
  const missing: string[] = []
  for (const [file, source] of Object.entries(files)) {
    for (const match of source.matchAll(
      /\b(?:tr|t)\(\s*['"]([\w]+:[\w]+)['"]/g,
    )) {
      const [namespace, key] = match[1].split(':')
      if (!i18n.getResource('en', namespace, key))
        missing.push(`${file}: ${match[1]}`)
    }
  }
  expect(missing).toEqual([])
})

it('localizes validation and API errors using codes, not English-message matching', async () => {
  setPreferences({ language: 'pt-BR' })
  expect(moneyInput.safeParse('0').error?.issues[0].message).toBe(
    'O valor deve ser maior que zero.',
  )
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({ detail: 'Synthetic diagnostic remains original' }),
          { status: 409, headers: { 'X-Error-Code': 'HTTP_409' } },
        ),
    ),
  )
  await expect(request('/synthetic')).rejects.toMatchObject({
    code: 'HTTP_409',
    message: t('errors:HTTP_409'),
    diagnostic: 'Synthetic diagnostic remains original',
  })
  vi.unstubAllGlobals()
})

it('persists all appearance options and isolates demo preferences/reset', () => {
  for (const palette of palettes) {
    setPreferences({ palette })
    expect(document.documentElement.dataset.palette).toBe(palette)
  }
  for (const font of Object.keys(fonts) as (keyof typeof fonts)[]) {
    setPreferences({ font })
    expect(
      document.documentElement.style.getPropertyValue('--app-font'),
    ).toContain(fonts[font])
  }
  setPreferences({
    language: 'pt-BR',
    mode: 'light',
    palette: 'plum',
    font: 'inter',
  })
  setPreferenceWorkspace(true)
  expect(getPreferences()).toEqual(defaults)
  setPreferences({ language: 'es-419', mode: 'system', palette: 'forest' })
  resetAppearance()
  expect(getPreferences()).toEqual({ ...defaults, language: 'es-419' })
  setPreferenceWorkspace(false)
  expect(getPreferences()).toEqual({
    ...defaults,
    language: 'pt-BR',
    mode: 'light',
    palette: 'plum',
    font: 'inter',
  })
  expect(Object.keys(localStorage).sort()).toEqual([
    'finance-tracker-preferences-demo',
    'finance-tracker-preferences-normal',
  ])
})

it('restores every font and palette before first paint using the same validated catalog', () => {
  // Execute only our bundled startup script against an isolated appearance DOM.
  const execute = new Function(
    'document',
    'localStorage',
    'sessionStorage',
    'matchMedia',
    appearanceBootstrap,
  )
  for (const [font, family] of Object.entries(fonts)) {
    for (const palette of palettes) {
      localStorage.setItem(
        'finance-tracker-preferences-normal',
        JSON.stringify({ ...defaults, font, palette }),
      )
      const dataset: Record<string, string> = {}
      const setProperty = vi.fn()
      const root = { dataset, style: { setProperty, colorScheme: '' } }
      execute(
        { documentElement: root },
        localStorage,
        sessionStorage,
        window.matchMedia,
      )
      expect(dataset.palette).toBe(palette)
      expect(dataset.font).toBe(font)
      expect(setProperty).toHaveBeenCalledWith(
        '--app-font',
        `"${family}", ${font === 'mono' ? 'monospace' : ['merriweather', 'serif'].includes(font) ? 'serif' : 'sans-serif'}`,
      )
    }
  }
})

it.each(['public'])(
  'resolves removed %s fonts consistently before paint and at runtime',
  (font) => {
    for (const palette of ['slate', 'sand', 'orange']) {
      const saved = { font, palette, mode: 'light', language: 'pt-BR' }
      localStorage.setItem(
        'finance-tracker-preferences-normal',
        JSON.stringify(saved),
      )
      const dataset: Record<string, string> = {}
      const execute = new Function(
        'document',
        'localStorage',
        'sessionStorage',
        'matchMedia',
        appearanceBootstrap,
      )
      execute(
        { documentElement: { dataset, style: { setProperty: vi.fn() } } },
        localStorage,
        sessionStorage,
        window.matchMedia,
      )
      setPreferenceWorkspace(false)
      expect(dataset).toMatchObject({
        font: 'inter',
        palette: 'graphite',
        theme: 'light',
      })
      expect(getPreferences()).toMatchObject({
        font: 'inter',
        palette: 'graphite',
        mode: 'light',
        language: 'pt-BR',
      })
    }
  },
)

it('localizes labels and dates while financial displays retain the fixed Brazilian convention', () => {
  setPreferences({ language: 'pt-BR' })
  expect(ui('Overview')).toBe('Visão geral')
  expect(formatMoney('1234.56', 'USD')).toContain('1.234,56')
  expect(formatRatioPercent('0.125')).toBe('12,50%')
  expect(formatDate('2026-09-30')).toContain('set.')
  setPreferences({ language: 'es-419' })
  expect(ui('Settings')).toBe('Configuración')
  expect(formatMoney('1234.56', 'BRL')).toContain('1.234,56')
  expect(t('common:unavailable')).not.toBe('common:unavailable')
})

it('computes proportional chart geometry from exact amounts and never inflates missing coverage', () => {
  const data = compositionData(
    [
      { name: 'A', value: '999999999999999999.999999' },
      { name: 'B', value: '999999999999999999.999999' },
    ],
    true,
  )
  expect(data?.map((row) => row.coordinate)).toEqual([50, 50])
  expect(data?.map((row) => row.exactValue)).toEqual([
    '999999999999999999.999999',
    '999999999999999999.999999',
  ])
  expect(compositionData([{ name: 'A', value: '1' }], false)).toBeNull()
  expect(compositionData([{ name: 'A', value: null }], true)).toBeNull()
  expect(compositionData([{ name: 'A', value: '-1' }], true)).toBeNull()
  expect(compositionData([{ name: 'A', value: '0' }], true)).toEqual([])
})
