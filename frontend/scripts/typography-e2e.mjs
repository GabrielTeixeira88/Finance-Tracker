import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'

// Uses only the migrated synthetic workspace owned by demo-e2e.mjs.
export async function checkTypography(page, origin, output) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  const settings = async () => {
    await page.goto(origin + '/#/settings?view=appearance')
    await page.locator('.appearance-settings').waitFor()
    await page.locator('.appearance-settings details > summary').click()
  }
  await settings()
  const palettes = page.locator('.theme-choice')
  assert.equal(await palettes.count(), 6)
  const contrasts = []
  for (let i = 0; i < (await palettes.count()); i++) {
    await palettes.nth(i).click()
    const palette = await page.locator('html').getAttribute('data-palette')
    for (const mode of ['Dark', 'Light']) {
      await page.getByRole('button', { name: mode, exact: true }).click()
      const ratios = await page.evaluate(() => {
        const probe = document.createElement('span'),
          canvas = document.createElement('canvas')
        canvas.width = canvas.height = 1
        const context = canvas.getContext('2d')
        document.body.append(probe)
        function luminance(token) {
          probe.style.color = `var(--${token})`
          context.fillStyle = getComputedStyle(probe).color
          context.fillRect(0, 0, 1, 1)
          const channels = [...context.getImageData(0, 0, 1, 1).data]
            .slice(0, 3)
            .map((x) => x / 255)
            .map((x) =>
              x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4,
            )
          return (
            channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
          )
        }
        const background = luminance('background')
        const result = [
          'foreground',
          'muted-foreground',
          'positive',
          'negative',
        ].map((token) => {
          const foreground = luminance(token)
          return (
            (Math.max(background, foreground) + 0.05) /
            (Math.min(background, foreground) + 0.05)
          )
        })
        probe.remove()
        return result
      })
      assert(
        ratios.every((x) => x >= 4.5),
        `${palette}/${mode}: ${ratios}`,
      )
      const healthColors = await page.evaluate(() => {
        const probe = document.createElement('span')
        document.body.append(probe)
        probe.style.color = 'var(--positive)'
        const positive = getComputedStyle(probe).color
        probe.style.color = 'var(--negative)'
        const negative = getComputedStyle(probe).color
        probe.style.color = ''
        probe.className = 'goal-card-completion is-positive'
        const onTrack = getComputedStyle(probe).color
        probe.className = 'goal-card-completion negative'
        const offTrack = getComputedStyle(probe).color
        probe.remove()
        return { positive, negative, onTrack, offTrack }
      })
      assert.equal(
        healthColors.onTrack,
        healthColors.positive,
        `${palette}/${mode}: goal health cannot inherit the accent hue`,
      )
      assert.equal(healthColors.offTrack, healthColors.negative)
      contrasts.push({ palette, mode, ratios })
    }
  }
  const fontNames = [
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
  ]
  const loadedFonts = []
  for (const name of fontNames) {
    await page.getByRole('button', { name: new RegExp(name) }).click()
    const loaded = await page.evaluate(async (name) => {
      const result = await document.fonts.load(
        `700 14px "${name}"`,
        'Savings R$ 0123',
      )
      await document.fonts.load(`400 14px "${name}"`, '111111 888888')
      const probe = document.createElement('span')
      probe.style.cssText = `position:absolute;white-space:nowrap;font:400 14px "${name}";font-variant-numeric:tabular-nums;letter-spacing:0`
      document.body.append(probe)
      probe.textContent = '111111'
      const ones = probe.getBoundingClientRect().width
      probe.textContent = '888888'
      const eights = probe.getBoundingClientRect().width
      probe.className = 'money'
      probe.style.fontFamily = ''
      probe.textContent = '111111'
      const financialOnes = probe.getBoundingClientRect().width
      probe.textContent = '888888'
      const financialEights = probe.getBoundingClientRect().width
      const numericFamily = getComputedStyle(probe).fontFamily
      probe.remove()
      return {
        financialDigitWidthDifference: Math.abs(
          financialOnes - financialEights,
        ),
        numericFamily,
        digitWidthDifference: Math.abs(ones - eights),
        family: getComputedStyle(document.querySelector('main')).fontFamily,
        faces: result.map((face) => ({
          family: face.family,
          weight: face.weight,
          status: face.status,
        })),
      }
    }, name)
    assert(loaded.family.includes(name))
    assert(
      loaded.financialDigitWidthDifference < 0.1,
      `Financial tabular digits missing: ${name}`,
    )
    assert(
      loaded.faces.some(
        (face) => face.weight === '700' && face.status === 'loaded',
      ),
      `Real bold font missing: ${name}`,
    )
    loadedFonts.push({ name, ...loaded })
    for (const [route, marker] of [
      ['goals', '.goal-visual'],
      ['transactions', 'table'],
    ]) {
      await page.goto(origin + '/#/' + route)
      await page.locator(marker).first().waitFor()
      await page.evaluate(() => document.fonts.ready)
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `Page overflow with ${name}: ${route}`,
      )
    }
    await settings()
  }
  await page.getByRole('button', { name: /Source Serif 4/ }).click()
  await page.getByRole('button', { name: 'ocean', exact: true }).click()
  await page.getByRole('button', { name: 'Dark', exact: true }).click()
  await page.reload()
  await page.locator('.appearance-settings').waitFor()
  assert.equal(await page.locator('html').getAttribute('data-font'), 'serif')
  assert.equal(await page.locator('html').getAttribute('data-palette'), 'ocean')
  const buttonWeight = await page
    .getByRole('button', { name: 'Reset appearance', exact: true })
    .evaluate((el) => getComputedStyle(el).fontWeight)
  assert.equal(
    buttonWeight,
    '500',
    'Shared action buttons use actual medium weight',
  )
  await page.screenshot({
    path: path.join(output, 'options-dark.png'),
    fullPage: true,
  })
  const audit = []
  const routes = {
    overview: '.spending-headline',
    accounts: '.accounts-list',
    transactions: 'table',
    investments: '.portfolio-overview-rows',
    performance: '.performance-hero',
    'net-worth': '.balance-chart',
    goals: '.goal-visual',
  }
  const collapse = page.getByRole('button', {
    name: 'Collapse sidebar',
    exact: true,
  })
  if (await collapse.count()) await collapse.click()
  for (const [route, marker] of Object.entries(routes)) {
    await page.goto(origin + '/#/' + route)
    await page.locator(marker).first().waitFor()
    await page.evaluate(() => document.fonts.ready)
    const small = await page.locator('main').evaluate((main) =>
      [...main.querySelectorAll('*')]
        .filter(
          (el) =>
            el.childElementCount === 0 &&
            el.textContent.trim() &&
            el.getBoundingClientRect().width > 0 &&
            el.getBoundingClientRect().height > 0 &&
            getComputedStyle(el).visibility !== 'hidden' &&
            parseFloat(getComputedStyle(el).fontSize) < 10.99,
        )
        .map((el) => ({
          text: el.textContent.slice(0, 60),
          size: getComputedStyle(el).fontSize,
        })),
    )
    assert.deepEqual(small, [], `Text below the reference 11px floor: ${route}`)
    const heading = page.locator('.page-header h1')
    if (await heading.count()) {
      const style = await heading.first().evaluate((el) => ({
        size: getComputedStyle(el).fontSize,
        weight: getComputedStyle(el).fontWeight,
      }))
      assert.deepEqual(style, { size: '20px', weight: '600' })
      audit.push({ route, heading: style })
    }
    await page.mouse.move(70, 0)
    await page.screenshot({
      path: path.join(output, `${route}-ocean-serif.png`),
    })
  }
  await settings()
  await page.getByRole('button', { name: 'Light', exact: true }).click()
  await page.getByRole('button', { name: 'violet', exact: true }).click()
  await page.getByRole('button', { name: /Outfit/ }).click()
  await page.goto(origin + '/#/goals')
  await page.locator('.goal-visual').first().waitFor()
  await page.screenshot({ path: path.join(output, 'goals-violet-outfit.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  )
  await page.screenshot({
    path: path.join(output, 'goals-violet-outfit-mobile.png'),
  })
  await writeFile(
    path.join(output, 'typography-audit.json'),
    JSON.stringify({ contrasts, loadedFonts, audit }, null, 2),
  )
}
