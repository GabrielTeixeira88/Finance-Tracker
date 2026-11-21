import { selectDemoFixture } from './demo-fixture-selection.mjs'
// Isolated demo runner hook: real APIs and owned temporary workspaces only.
import assert from 'node:assert/strict'
import path from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'

export async function checkPortfolioInsights(page, origin, root) {
  const output = path.join(root, '.tmp/v014-portfolio-insights-browser')
  await mkdir(output, { recursive: true })
  const findings = []
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  const api = async (url) => {
    const result = await page.request.get(origin + '/api' + url)
    assert(result.ok(), url)
    return result.json()
  }
  const scenarios = ['real-market-br', 'etf-showcase']
  for (const scenario of scenarios) {
    const runtime = await api('/runtime')
    if (runtime.scenario !== scenario) {
      await selectDemoFixture(page, origin, scenario)
    }
    await page.goto(origin + '/#/insights?view=overview')
    await page.getByRole('button', { name: 'Customize dashboard' }).waitFor()
    await page
      .locator('[data-widget-id=composition] .recharts-surface')
      .waitFor()
    await page.waitForLoadState('networkidle')
    const allocation = await api(
      '/investments/analytics/allocation?as_of=2026-09-30&currency=BRL',
    )
    assert.equal(allocation.quality, 'COMPLETE')
    const units = (value) => {
      const [whole, fraction = ''] = value.replace('-', '').split('.')
      return (
        (BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0'))) *
        (value.startsWith('-') ? -1n : 1n)
      )
    }
    assert.equal(
      units(allocation.total_value),
      units(allocation.summary.cash_value) +
        units(allocation.summary.invested_value),
    )
    const format = (value) =>
      new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
        .format(value)
        .replaceAll('\u00a0', ' ')
    assert.equal(
      await page.locator('[data-widget-id=value] .money').innerText(),
      format(allocation.total_value),
    )
    await page.screenshot({
      path: path.join(output, `${scenario}-dark-1440.png`),
    })
    await page.locator('[data-widget-id=composition] .insight-control').click()
    await page.getByRole('button', { name: 'Names', exact: true }).waitFor()
    await page.locator('.insight-treemap-tile').first().locator('..').click()
    await page.getByRole('dialog').waitFor()
    await page.keyboard.press('Escape')
    // Expand a real category and drill through all contributing identities.
    const explorer = page.locator('[data-widget-id=breakdown]')
    await explorer.getByRole('button', { name: 'Classes', exact: true }).click()
    const group = explorer.locator('.insight-breakdown-rows > details').first()
    await group.locator('summary').click()
    await group.locator('.insight-holding').first().waitFor()
    await explorer.scrollIntoViewIfNeeded()
    await page.screenshot({
      path: path.join(output, `${scenario}-breakdown-1440.png`),
    })
    await group.getByRole('button', { name: 'View details' }).click()
    await page.getByRole('dialog').waitFor()
    await page.screenshot({
      path: path.join(output, `${scenario}-details-1440.png`),
    })
    await page.keyboard.press('Escape')
    await group.getByRole('button', { name: 'View details' }).click()
    const holdingLink = page
      .getByRole('dialog')
      .locator('.insight-holding .investment-security')
      .first()
    await holdingLink.click()
    await page.waitForURL(/asset=/)
    await page.goto(origin + '/#/insights?view=overview')
    await page
      .locator('[data-widget-id=composition] .recharts-surface')
      .waitFor()
    const beforeScopeAccounts = await api('/accounts')
    // Root->real fixed-income contract children->leaf drawer, with a working breadcrumb.
    if (scenario === 'real-market-br') {
      const classes = page.locator('[data-widget-id=asset_class]')
      await classes.locator('.insight-arc-label').click()
      await classes.getByRole('button', { name: 'Back to classes' }).waitFor()
      await classes.locator('.insight-arc-label').click()
      await page.getByRole('dialog').waitFor()
      await page.keyboard.press('Escape')
      await classes.getByRole('button', { name: 'Back to classes' }).click()
    }
    await page.getByRole('button', { name: 'Customize dashboard' }).click()
    await page
      .getByRole('button', { name: 'Hide Sectors', exact: true })
      .click()
    const value = page.locator('[data-widget-id=value]')
    // Exercise real pointer-based resize and drag, not just preference setters.
    const resize = value.locator('.react-resizable-handle-e')
    await resize.scrollIntoViewIfNeeded()
    let box = await resize.boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 180, box.y + box.height / 2, {
      steps: 12,
    })
    await page.mouse.up()
    const handle = page.locator('[data-widget-id=cash] .insights-drag-handle')
    await handle.scrollIntoViewIfNeeded()
    box = await handle.boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(
      box.x + box.width / 2 - 200,
      box.y + box.height / 2 + 120,
      { steps: 12 },
    )
    await page.mouse.up()
    await page.getByRole('button', { name: 'Save layout' }).click()
    const saved = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('finance-tracker-preferences-demo'))
          .insightsLayout,
    )
    assert(saved.hidden.includes('sector'))
    assert(
      saved.layouts.desktop.find((item) => item.i === 'value').w !== 4,
      'Pointer resize persists a new width',
    )
    const movedCash = saved.layouts.desktop.find((item) => item.i === 'cash')
    assert(
      movedCash.x !== 4 || movedCash.y !== 0,
      'Pointer drag persists layout position',
    )
    await page.reload()
    await page.getByRole('button', { name: 'Customize dashboard' }).waitFor()
    assert.equal(await page.locator('[data-widget-id=sector]').count(), 0)
    await page.getByRole('button', { name: 'Customize dashboard' }).click()
    await page.getByRole('button', { name: 'Restore defaults' }).click()
    await page.getByRole('button', { name: 'Cancel' }).click()
    assert.equal(await page.locator('[data-widget-id=sector]').count(), 0)
    await page.getByRole('button', { name: 'Customize dashboard' }).click()
    await page.getByRole('button', { name: 'Restore defaults' }).click()
    await page.getByRole('button', { name: 'Save layout' }).click()
    await page.locator('[data-widget-id=sector]').waitFor()
    // Account scope applies to the same API used by every widget.
    const account = allocation.rows[0].account_id
    await page.goto(origin + `/#/insights?view=overview&account=${account}`)
    await page.getByRole('button', { name: 'Customize dashboard' }).waitFor()
    await page.waitForLoadState('networkidle')
    assert.equal(
      await page.getByLabel('Portfolio account', { exact: true }).inputValue(),
      account,
    )
    const scoped = await api(
      `/investments/analytics/allocation?as_of=2026-09-30&currency=BRL&account_ids=${account}`,
    )
    assert.equal(
      await page.locator('[data-widget-id=value] .money').innerText(),
      format(scoped.total_value),
    )
    await page.goto(origin + '/#/insights?view=overview')
    for (const theme of ['light', 'dark']) {
      await page.evaluate((theme) => {
        const key = 'finance-tracker-preferences-demo'
        const pref = JSON.parse(localStorage.getItem(key))
        pref.mode = theme
        localStorage.setItem(key, JSON.stringify(pref))
      }, theme)
      await page.reload()
      await page
        .locator('[data-widget-id=composition] .recharts-surface')
        .waitFor()
      for (const width of [1440, 1920]) {
        await page.setViewportSize({
          width,
          height: width === 1440 ? 900 : 1080,
        })
        await page.waitForTimeout(200)
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
          'No desktop horizontal overflow',
        )
        await page.screenshot({
          path: path.join(output, `${scenario}-${theme}-${width}.png`),
        })
      }
    }
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(200)
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      'No mobile horizontal overflow',
    )
    await page.screenshot({ path: path.join(output, `${scenario}-mobile.png`) })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(origin + '/#/insights?view=performance')
    await page.locator('.analytics-performance').waitFor()
    await page.goto(origin + '/#/insights?view=income')
    await page.locator('.analytics-income').waitFor()
    assert.deepEqual(
      await api('/accounts'),
      beforeScopeAccounts,
      'Read-only interactions do not mutate balances',
    )
    await page.goto(origin + '/#/insights?view=overview')
    findings.push({
      scenario,
      total: allocation.total_value,
      summary: allocation.summary,
      saved,
      result: 'PASS',
    })
  }
  // Empty and partial rendering fixtures intercept only this isolated browser's read response.
  // Backend tests independently exercise real missing-price/FX and empty databases.
  for (const state of ['partial', 'unavailable', 'empty']) {
    const empty = state === 'empty'
    await page.route(
      '**/api/investments/analytics/allocation?*',
      async (route) => {
        const response = await route.fetch()
        const data = await response.json()
        if (empty) {
          data.rows = []
          data.groups = {}
          data.total_value = '0'
          data.known_value = '0'
          data.quality = 'COMPLETE'
          data.summary = {
            cash_value: '0',
            invested_value: '0',
            cost_basis: '0',
            unrealized: '0',
            holdings_count: 0,
            accounts_count: 0,
            basis_fx_policy: '',
          }
        } else {
          data.quality = 'PARTIAL'
          data.total_value = null
          data.reasons = ['MISSING_PRICE_OR_FX']
          for (const groups of Object.values(data.groups))
            for (const group of groups) group.weight_percent = null
          if (state === 'unavailable') {
            data.known_value = '0'
            data.rows = data.rows.map((row) => ({
              ...row,
              value: null,
              original_value: null,
            }))
            for (const groups of Object.values(data.groups))
              for (const group of groups) group.value = null
            for (const field of [
              'cash_value',
              'invested_value',
              'cost_basis',
              'unrealized',
            ])
              data.summary[field] = null
          }
        }
        await route.fulfill({ response, json: data })
      },
    )
    await page.reload()
    await page.getByRole('button', { name: 'Customize dashboard' }).waitFor()
    await page
      .getByText(
        empty
          ? 'No holdings to display'
          : 'Composition unavailable — incomplete or negative values',
        { exact: true },
      )
      .first()
      .waitFor()
    assert.equal(
      await page.locator('.insight-composition .recharts-surface').count(),
      0,
    )
    await page.screenshot({
      path: path.join(output, `${state}.png`),
    })
    await page.unroute('**/api/investments/analytics/allocation?*')
  }
  await writeFile(
    path.join(output, 'validation.json'),
    JSON.stringify(findings, null, 2),
  )
  // Controlled failure/delay fixtures use a separate page, so the runner's normal
  // response-error assertions still reject unexpected failures on the real demo.
  const stateContext = await page
    .context()
    .browser()
    .newContext({
      viewport: { width: 1440, height: 900 },
      locale: 'en-US',
      colorScheme: 'dark',
    })
  const statePage = await stateContext.newPage()
  await statePage.route(
    '**/api/investments/analytics/allocation?*',
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200))
      await route.continue()
    },
  )
  await statePage.goto(origin + '/#/insights?view=overview')
  await statePage.locator('.analytics-allocation .state[role=status]').waitFor()
  await statePage.screenshot({ path: path.join(output, 'loading.png') })
  await statePage.locator('.insight-composition .recharts-surface').waitFor()
  await statePage.unroute('**/api/investments/analytics/allocation?*')
  await statePage.route('**/api/investments/analytics/allocation?*', (route) =>
    route.fulfill({
      status: 503,
      json: { detail: 'Synthetic controlled unavailable API fixture' },
    }),
  )
  await statePage.reload()
  await statePage.getByRole('alert').waitFor()
  await statePage.getByRole('button', { name: 'Retry', exact: true }).waitFor()
  await statePage.screenshot({ path: path.join(output, 'error.png') })
  await stateContext.close()
}
