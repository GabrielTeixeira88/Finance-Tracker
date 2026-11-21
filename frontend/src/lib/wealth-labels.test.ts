import i18n from './i18n'
import { formatWealthLabel } from './wealth-labels'

it('localizes canonical wealth labels without changing user categories or API codes', async () => {
  for (const [language, property, illiquid] of [
    ['en', 'Real estate', 'Illiquid'],
    ['pt-BR', 'Imóveis', 'Sem liquidez imediata'],
    ['es-419', 'Bienes inmuebles', 'Sin liquidez inmediata'],
  ]) {
    await i18n.changeLanguage(language)
    expect(formatWealthLabel('REAL_ESTATE')).toBe(property)
    expect(formatWealthLabel('ILLIQUID')).toBe(illiquid)
    expect(formatWealthLabel('Family collection')).toBe('Family collection')
  }
  await i18n.changeLanguage('en')
})
