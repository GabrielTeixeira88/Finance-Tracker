import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

export async function checkAppearance(page, origin, output, root) {
  // Stable screenshots must not capture a palette halfway through its transition.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const resources = {}
  for (const locale of ['en', 'pt-BR', 'es-419'])
    resources[locale] = JSON.parse(
      await readFile(
        path.join(root, `frontend/src/locales/${locale}.json`),
        'utf8',
      ),
    )
  const text = (english, locale = 'pt-BR') => {
    for (const [ns, values] of Object.entries(resources.en)) {
      const key = Object.keys(values).find((key) => values[key] === english)
      if (key) return resources[locale][ns][key]
    }
    throw new Error(`Missing test translation: ${english}`)
  }
  async function loaded(route) {
    const selectors = {
      overview: '.overview-chart .recharts-surface',
      accounts: '.accounts-list',
      spending: '.spending-headline',
      investments: '.portfolio-overview-rows',
      performance: '.performance-hero',
      'net-worth': '.balance-chart',
      goals: '.goal-visual',
      transactions: 'table',
    }
    const title = {
      accounts: 'Accounts',
      spending: 'Spending & Budgets',
      investments: 'Investments',
      performance: 'Performance',
      'net-worth': 'Net Worth',
      goals: 'Goals',
      transactions: 'Transactions',
    }[route]
    const locale = await page.locator('html').getAttribute('lang')
    if (title)
      await page
        .getByRole('heading', {
          name: locale === 'en' ? title : text(title, locale),
          exact: true,
        })
        .first()
        .waitFor()
    await page.locator(selectors[route]).first().waitFor()
    await page.waitForFunction(
      () =>
        !/\b(Loading|Calculating|Reconstructing|Carregando|Calculando|Reconstruindo|Cargando|Reconstruyendo)\b/.test(
          document.body.innerText,
        ),
    )
    await page.evaluate(() => document.fonts.ready)
    await page.waitForLoadState('networkidle')
  }
  async function localizedDetails(locale) {
    await page.goto(`${origin}/#/spending?view=Life+Events`)
    await page
      .getByRole('heading', {
        name: resources[locale].parity.life_events,
        exact: true,
      })
      .waitFor()
    await page.locator('.event-band').first().click()
    const drawer = page.getByRole('dialog')
    await drawer.locator('.recharts-surface').first().waitFor()
    await drawer
      .getByRole('button', {
        name: resources[locale].parity.link_transactions,
        exact: true,
      })
      .waitFor()
    await page.screenshot({
      path: path.join(output, `life-event-${locale}.jpg`),
      quality: 85,
    })
    await page.keyboard.press('Tab')
    assert(
      await drawer.evaluate((element) =>
        element.contains(document.activeElement),
      ),
      'Drawer must retain keyboard focus',
    )
    await page.keyboard.press('Escape')
    assert(
      await page
        .locator('.event-band')
        .first()
        .evaluate((element) => element === document.activeElement),
      'Closing the drawer restores its trigger focus',
    )
    await page.goto(`${origin}/#/goals`)
    await page
      .getByRole('button', {
        name: 'International vacation',
        exact: true,
      })
      .click()
    await drawer
      .getByLabel(text('Assumed monthly contribution', locale))
      .fill(locale === 'pt-BR' ? '600,00' : '600.00')
    await drawer
      .getByText(resources[locale].parity.on_track, { exact: true })
      .waitFor()
    await page.waitForLoadState('networkidle')
    await page.screenshot({
      path: path.join(output, `goal-trajectory-${locale}.jpg`),
      quality: 85,
    })
    await page.keyboard.press('Escape')
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${origin}/#/settings?view=appearance`)
  await page.getByRole('heading', { name: 'Appearance & Language' }).waitFor()
  await page.evaluate(() =>
    localStorage.setItem(
      'finance-tracker-preferences-normal',
      JSON.stringify({
        font: 'mono',
        palette: 'graphite',
        mode: 'dark',
        language: 'en',
      }),
    ),
  )
  const preservedNormal = await page.evaluate(() =>
    localStorage.getItem('finance-tracker-preferences-normal'),
  )
  await page.locator('.appearance-settings details > summary').click()
  for (const palette of [
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
  ]) {
    await page
      .getByRole('button', {
        name: palette === 'olive' ? 'Classic' : palette,
        exact: true,
      })
      .click()
    assert.equal(
      await page.locator('html').getAttribute('data-palette'),
      palette,
    )
    for (const mode of ['Light', 'Dark']) {
      await page.getByRole('button', { name: mode, exact: true }).click()
      const ratios = await page.evaluate(() => {
        const luminance = (color) => {
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')
          context.fillStyle = color
          context.fillRect(0, 0, 1, 1)
          const channels = [...context.getImageData(0, 0, 1, 1).data]
            .slice(0, 3)
            .map((n) => n / 255)
            .map((n) =>
              n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4,
            )
          return (
            channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
          )
        }
        const probe = document.createElement('span')
        document.body.append(probe)
        const color = (token) => {
          probe.style.color = `var(--${token})`
          return luminance(getComputedStyle(probe).color)
        }
        const background = color('background')
        const result = [
          'foreground',
          'muted-foreground',
          'positive',
          'negative',
        ].map((token) => {
          const foreground = color(token)
          return (
            (Math.max(background, foreground) + 0.05) /
            (Math.min(background, foreground) + 0.05)
          )
        })
        probe.remove()
        return result
      })
      assert(
        ratios.every((ratio) => ratio >= 4.5),
        `${palette}/${mode} text contrast: ${ratios}`,
      )
      await page.evaluate(() =>
        Promise.all(
          document.getAnimations().map((animation) => animation.finished),
        ),
      )
      assert(
        await page
          .getByRole('button', { name: 'Guided tour', exact: true })
          .evaluate((button) => {
            const probe = document.createElement('span')
            probe.style.color = 'var(--foreground)'
            document.body.append(probe)
            const matches =
              getComputedStyle(button).color === getComputedStyle(probe).color
            probe.remove()
            return matches
          }),
        `${palette}/${mode}: ghost control must use the foreground token`,
      )
    }
  }
  for (const font of [
    'JetBrains Mono',
    'Inter',
    'Geist',
    'Manrope',
    'IBM Plex Sans',
    'DM Sans',
    'Source Sans 3',
    'Outfit',
    'Merriweather',
    'Source Serif 4',
  ]) {
    await page.getByRole('button', { name: new RegExp(font) }).click()
    await page.evaluate(() => document.fonts.ready)
    assert(
      (
        await page
          .locator('main')
          .evaluate((node) => getComputedStyle(node).fontFamily)
      ).includes(font),
    )
  }
  await page.getByRole('button', { name: 'Light', exact: true }).click()
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light')
  await page.screenshot({
    path: path.join(output, 'appearance-light-plum-dm.jpg'),
    quality: 85,
  })
  await page.getByRole('button', { name: 'System', exact: true }).click()
  await page.emulateMedia({ colorScheme: 'dark' })
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark')
  await page.emulateMedia({ colorScheme: 'light' })
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === 'light',
  )
  await page.getByRole('button', { name: 'Dark', exact: true }).click()
  await page.getByRole('button', { name: 'teal', exact: true }).click()
  await page.getByRole('button', { name: /Inter/ }).click()
  await page.getByLabel('Interface language').selectOption('pt-BR')
  await page
    .getByRole('heading', { name: text('Appearance & Language') })
    .waitFor()
  await page.screenshot({
    path: path.join(output, 'appearance-pt-BR.jpg'),
    quality: 85,
  })
  await page.reload()
  await page
    .getByRole('heading', { name: text('Appearance & Language') })
    .waitFor()
  assert.equal(await page.locator('html').getAttribute('data-font'), 'inter')
  assert.equal(await page.locator('html').getAttribute('data-palette'), 'teal')
  for (const route of [
    'overview',
    'accounts',
    'spending',
    'investments',
    'performance',
    'net-worth',
    'goals',
    'transactions',
  ]) {
    await page.goto(`${origin}/#/${route}`)
    await loaded(route)
    const tour = page.getByRole('button', { name: text('Skip tour') })
    if (await tour.count()) await tour.click()
    assert(
      !(await page.locator('body').innerText()).match(
        /\b(?:dynamic|labels|messages|appearance|tour):[a-z_]+/,
      ),
      `Leaked key: ${route}`,
    )
    await page.screenshot({
      path: path.join(output, `${route}-pt-BR.jpg`),
      quality: 85,
    })
  }
  await localizedDetails('pt-BR')
  await page.goto(`${origin}/#/transactions`)
  await loaded('transactions')
  await page.getByRole('button', { name: text('+ Add Transaction') }).click()
  await page
    .getByLabel(text('Account'), { exact: true })
    .selectOption({ label: 'Checking (BRL)' })
  await page.getByLabel(text('Amount'), { exact: true }).fill('1,50')
  await page
    .getByLabel(text('Description'), { exact: true })
    .fill('Synthetic localized E2E')
  await page.getByRole('button', { name: text('Save'), exact: true }).click()
  await page.getByRole('button', { name: text('+ Add Transaction') }).waitFor()
  const created = await (
    await fetch(`${origin}/api/transactions?search=Synthetic%20localized%20E2E`)
  ).json()
  assert.equal(created.length, 1)
  assert.match(created[0].amount, /^1\.50*$/)
  assert.equal(created[0].transaction_type, 'EXPENSE')
  await page.goto(`${origin}/#/settings?view=appearance`)
  await page.getByLabel(text('Interface language')).selectOption('es-419')
  await page
    .getByRole('heading', { name: text('Appearance & Language', 'es-419') })
    .waitFor()
  await page.screenshot({
    path: path.join(output, 'appearance-es-419.jpg'),
    quality: 85,
  })
  await localizedDetails('es-419')
  await page.goto(`${origin}/#/overview`)
  await page.locator('.recharts-surface').first().waitFor()
  await page.waitForLoadState('networkidle')
  await page.screenshot({
    path: path.join(output, 'overview-es-419.jpg'),
    quality: 85,
  })
  await page.goto(`${origin}/#/settings?view=appearance`)
  await page.getByLabel(text('Interface language', 'es-419')).selectOption('en')
  await page.getByRole('heading', { name: 'Appearance & Language' }).waitFor()
  await page.getByRole('button', { name: 'Reset demo', exact: true }).click()
  await page.getByRole('button', { name: 'Skip tour' }).waitFor()
  const reset = await (
    await fetch(`${origin}/api/transactions?search=Synthetic%20localized%20E2E`)
  ).json()
  assert.equal(reset.length, 0)
  assert.equal(await page.locator('html').getAttribute('data-font'), 'inter')
  assert.equal(await page.locator('html').getAttribute('data-palette'), 'teal')
  assert.equal(
    await page.evaluate(() =>
      localStorage.getItem('finance-tracker-preferences-normal'),
    ),
    preservedNormal,
  )
  await page.goto(`${origin}/#/settings?view=appearance`)
  await page
    .getByRole('button', { name: 'Reset appearance', exact: true })
    .click()
  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    for (const route of [
      'overview',
      'spending',
      'investments',
      'performance',
      'net-worth',
      'goals',
      'transactions',
    ]) {
      await page.goto(`${origin}/#/${route}`)
      await loaded(route)
      const skip = page.getByRole('button', { name: 'Skip tour' })
      if (await skip.count()) await skip.click()
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `Overflow: ${route} at ${viewport.width}`,
      )
      await page.screenshot({
        path: path.join(
          output,
          `${route}-${viewport.width}x${viewport.height}.jpg`,
        ),
        quality: 85,
      })
      if (route === 'investments' && viewport.width === 1440) {
        const allocation = page.waitForResponse(
          (response) =>
            response.url().includes('/analytics/allocation?') &&
            response.url().includes('currency=USD'),
        )
        await page.goto(origin + '/#/investments?currency=USD')
        const usdAllocation = await (await allocation).json()
        assert.equal(usdAllocation.currency, 'USD')
        await loaded(route)
        const composition = page.getByRole('region', {
          name: 'Holdings composition · Including cash',
        })
        await page.locator('.advanced-evidence > summary').click()
        await composition.scrollIntoViewIfNeeded()
        await composition.locator('.recharts-surface').waitFor()
        await page.screenshot({
          path: path.join(output, 'holdings-composition-USD.jpg'),
          quality: 85,
        })
        const rectangle = composition
          .locator('svg rect')
          .filter({ visible: true })
          .first()
        await rectangle.hover({ position: { x: 12, y: 12 } })
        await composition.locator('.chart-tooltip .money').waitFor()
        const exactCash = usdAllocation.groups.security.find(
          (item) => item.name === 'Cash',
        ).value
        const expectedMoney = new Intl.NumberFormat('en', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 6,
        }).format(exactCash)
        assert.equal(
          await composition
            .locator('.chart-tooltip .money')
            .getAttribute('aria-label'),
          `${expectedMoney} USD`,
          'Treemap tooltip must display the exact API amount, never its geometry weight',
        )
        await page.screenshot({
          path: path.join(output, 'holdings-tooltip.jpg'),
          quality: 85,
        })
        await page.mouse.move(0, 0)
        await page.goto(origin + '/#/investments')
      }
    }
  }
}
