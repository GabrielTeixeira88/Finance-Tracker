// Runs before styles/application modules. Appearance only; no financial state.
;(function () {
  try {
    const scope =
      sessionStorage.getItem('finance-tracker-appearance-scope') === 'demo'
        ? 'demo'
        : 'normal'
    const saved = JSON.parse(
      localStorage.getItem('finance-tracker-preferences-' + scope) || '{}',
    )
    const mode = ['light', 'dark', 'system'].includes(saved.mode)
      ? saved.mode
      : scope === 'normal' &&
          localStorage.getItem('finance-tracker-theme') === 'light'
        ? 'light'
        : 'dark'
    const root = document.documentElement
    const palette = ['slate', 'orange', 'sand'].includes(saved.palette)
      ? 'graphite'
      : saved.palette
    root.dataset.theme =
      mode === 'system'
        ? matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : mode
    root.dataset.palette = [
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
    ].includes(palette)
      ? palette
      : 'olive'
    const fonts = {
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
    }
    const savedFont = saved.font === 'public' ? 'inter' : saved.font
    const font = Object.hasOwn(fonts, savedFont) ? savedFont : 'mono'
    root.dataset.font = font
    root.dataset.chartPalette = [
      'theme',
      'balanced',
      'cool',
      'warm',
      'muted',
    ].includes(saved.chartPalette)
      ? saved.chartPalette
      : 'theme'
    root.dataset.financialColors = ['standard', 'reversed', 'neutral'].includes(
      saved.financialColors,
    )
      ? saved.financialColors
      : 'standard'
    root.style.setProperty(
      '--app-font',
      '"' +
        fonts[font] +
        '", ' +
        (font === 'mono'
          ? 'monospace'
          : ['merriweather', 'serif'].includes(font)
            ? 'serif'
            : 'sans-serif'),
    )
    root.style.colorScheme = root.dataset.theme
  } catch {
    document.documentElement.dataset.theme = 'dark'
  }
})()
