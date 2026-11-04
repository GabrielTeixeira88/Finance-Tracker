import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

// Called only inside demo-e2e's owned, isolated Brazil workspace.
export async function checkThemes(page, origin, root) {
  const output = path.join(root, 'docs/screenshots/themes')
  await mkdir(output, { recursive: true })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const themes = [
    'Classic',
    'Midnight Cobalt',
    'Carbon Amber',
    'Amethyst Night',
    'Porcelain Blue',
    'Sandstone Copper',
  ]
  const tokens = [
    'background',
    'foreground',
    'card',
    'card-foreground',
    'popover',
    'popover-foreground',
    'sidebar',
    'sidebar-foreground',
    'muted',
    'muted-foreground',
    'border',
    'input',
    'ring',
    'primary',
    'primary-foreground',
    'secondary',
    'secondary-foreground',
    'accent',
    'accent-foreground',
    'positive',
    'negative',
    'warning',
    'info',
    'success',
    'destructive',
    ...Array.from({ length: 8 }, (_, i) => `chart-${i + 1}`),
    'chart-grid',
    'chart-axis',
    'chart-tooltip',
    'chart-cursor',
    'investment-chart',
    'spending-chart',
    'net-worth-chart',
    'income-chart',
    'goal-progress',
  ]
  const settings = async () => {
    await page.goto(origin + '/#/settings?view=appearance')
    await page.locator('.appearance-settings').waitFor()
  }
  await settings()
  await page
    .getByRole('button', { name: 'Midnight Cobalt', exact: true })
    .focus()
  await page.keyboard.press('Space')
  assert.equal(
    await page.locator('html').getAttribute('data-palette'),
    'midnight-cobalt',
  )
  const before = await (await page.request.get(origin + '/api/accounts')).json()
  const audit = []
  for (const theme of themes) {
    await settings()
    await page.getByRole('button', { name: theme, exact: true }).click()
    for (const mode of ['Dark', 'Light']) {
      await page.getByRole('button', { name: mode, exact: true }).click()
      assert.equal(
        await page
          .getByRole('button', { name: theme, exact: true })
          .locator('.theme-preview')
          .evaluate((node) => getComputedStyle(node).backgroundColor),
        await page
          .locator('body')
          .evaluate((node) => getComputedStyle(node).backgroundColor),
        'The selected preview must use the same background tokens as the application',
      )
      const result = await page.evaluate((tokens) => {
        const probe = document.createElement('span')
        document.body.append(probe)
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 1
        const ctx = canvas.getContext('2d')
        const color = (token) => {
          probe.style.color = `var(--${token})`
          return getComputedStyle(probe).color
        }
        const lum = (token) => {
          ctx.fillStyle = color(token)
          ctx.fillRect(0, 0, 1, 1)
          const c = [...ctx.getImageData(0, 0, 1, 1).data]
            .slice(0, 3)
            .map((x) => x / 255)
            .map((x) =>
              x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4,
            )
          return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722
        }
        const contrast = (a, b) => {
          const x = lum(a),
            y = lum(b)
          return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
        }
        const missing = tokens.filter(
          (t) =>
            !getComputedStyle(document.documentElement)
              .getPropertyValue('--' + t)
              .trim(),
        )
        const ratios = ['background', 'card'].flatMap((bg) =>
          [
            'foreground',
            'muted-foreground',
            'positive',
            'negative',
            'success',
            'destructive',
          ].map((fg) => [fg, bg, contrast(fg, bg)]),
        )
        probe.remove()
        return { missing, ratios }
      }, tokens)
      assert.deepEqual(result.missing, [])
      // Classic retains the approved original contrast; new themes meet AA on both surfaces.
      if (theme !== 'Classic')
        assert(
          result.ratios.every((x) => x[2] >= 4.5),
          JSON.stringify({ theme, mode, ...result }),
        )
      audit.push({ theme, mode, ...result })
      await page.goto(origin + '/#/goals')
      await page.locator('.goal-visual').first().waitFor()
      await page.waitForTimeout(120)
      await page.screenshot({
        path: path.join(
          output,
          `${theme.toLowerCase().replaceAll(' ', '-')}-${mode.toLowerCase()}.png`,
        ),
      })
      await settings()
    }
  }
  await page.getByRole('button', { name: 'Carbon Amber', exact: true }).click()
  await page.getByRole('button', { name: 'Cool', exact: true }).click()
  const color = async (token) =>
    page.evaluate((token) => {
      const p = document.createElement('span')
      p.style.color = `var(--${token})`
      document.body.append(p)
      const c = getComputedStyle(p).color
      p.remove()
      return c
    }, token)
  const destructive = await color('destructive'),
    gain = await color('positive')
  await page
    .getByRole('button', { name: 'Red gains / green losses', exact: true })
    .click()
  assert.equal(await color('destructive'), destructive)
  assert.equal(await color('positive'), destructive)
  assert.notEqual(await color('positive'), gain)
  await page
    .getByRole('button', { name: 'Neutral gains / blue losses', exact: true })
    .click()
  assert.equal(await color('negative'), await color('info'))
  await page.getByRole('button', { name: /Geist/ }).click()
  await page.reload()
  await page.locator('.appearance-settings').waitFor()
  assert.equal(
    await page.locator('html').getAttribute('data-chart-palette'),
    'cool',
  )
  assert.equal(await page.locator('html').getAttribute('data-font'), 'geist')
  await page.getByRole('button', { name: 'System', exact: true }).click()
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === 'dark',
  )
  await page.emulateMedia({ colorScheme: 'light' })
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === 'light',
  )
  for (const palette of ['Balanced', 'Cool', 'Warm', 'Muted']) {
    await page.getByRole('button', { name: palette, exact: true }).click()
    assert(await color('chart-8'))
  }
  for (const route of [
    'overview',
    'transactions',
    'spending?view=budget',
    'investments',
    'performance',
    'net-worth',
    'goals',
    'settings?view=appearance',
  ]) {
    await page.goto(origin + '/#/' + route)
    await page.waitForLoadState('networkidle')
    assert(
      !(await page.getByText('Something went wrong', { exact: true }).count()),
    )
    await page.screenshot({
      path: path.join(output, `screen-${route.split('?')[0]}.png`),
    })
  }
  await settings()
  await page.setViewportSize({ width: 390, height: 844 })
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  )
  await page.screenshot({
    path: path.join(output, 'settings-mobile.png'),
    fullPage: true,
  })
  const after = await (await page.request.get(origin + '/api/accounts')).json()
  assert.deepEqual(after, before)
  await writeFile(
    path.join(output, 'validation.json'),
    JSON.stringify(audit, null, 2),
  )
  console.log(
    'Theme browser validation PASS: 12 modes, tokens, AA, persistence, system changes, gain conventions, 8 routes and unchanged accounts',
  )
}
