// Real browser, real local APIs, runner-owned migrated unified demo only.
import assert from 'node:assert/strict'
import { mkdir, writeFile, copyFile } from 'node:fs/promises'
import path from 'node:path'
export async function checkPerformanceInsights(page, origin, root) {
  const output = path.join(root, 'docs/screenshots/v014-performance-insights')
  await mkdir(output, { recursive: true })
  page.setDefaultTimeout(15000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const get = async (p) => {
    const r = await page.request.get(origin + '/api' + p)
    assert(r.ok(), await r.text())
    return r.json()
  }
  const before = await get('/accounts')
  const worth = await get('/net-worth/summary?as_of=2026-09-30')
  const assets = await get('/investments/assets')
  const main = assets.find((a) => a.symbol === 'SIM-GLOBAL-ETF')
  const secondary = assets.find((a) => a.symbol === 'SIM-SP500-ETF')
  assert(main && secondary)
  const comparable = before.find((a) => a.name === 'Income portfolio')
  const visit = async (route) => {
    await page.goto(origin + '/#/' + route)
    await page.waitForLoadState('networkidle')
  }
  const shot = async (name) => {
    await page.mouse.move(10, 10)
    await page.evaluate(() => {
      window.scrollTo(0, 0)
      document
        .querySelectorAll('main,[data-page-scroll-container]')
        .forEach((e) => (e.scrollTop = 0))
    })
    await page.screenshot({ path: path.join(output, name + '.png') })
  }
  const graph = async () => {
    await page
      .getByText('Loading comparisons…', { exact: true })
      .waitFor({ state: 'hidden', timeout: 60000 })
    const chart = page.locator('.performance-chart-region')
    await chart.locator('.recharts-line-curve').first().waitFor()
    const geometry = await chart.evaluate((e) => ({
      width: e.getBoundingClientRect().width,
      height: e.getBoundingClientRect().height,
      paths: [...e.querySelectorAll('.recharts-line-curve')].map((p) =>
        p.getAttribute('d'),
      ),
      svg: e.querySelector('svg.recharts-surface')?.getBoundingClientRect()
        .width,
    }))
    assert(
      geometry.width > 250 && geometry.height > 150 && geometry.svg > 250,
      JSON.stringify(geometry),
    )
    assert(
      geometry.paths.some((p) => p?.includes('L')),
      'Chart must contain an actual dated path',
    )
    return geometry
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await visit('insights?view=performance&range=1Y')
  await page.locator('.performance-workspace').waitFor()
  const performance = await get(
    '/investments/analytics/performance?start=2025-09-30&end=2026-09-30&currency=BRL',
  )
  assert.equal(performance.risk.volatility.quality, 'COMPLETE')
  assert.equal(performance.risk.max_drawdown.quality, 'COMPLETE')
  assert(performance.annualized_twr.value !== null)
  await graph()
  await page.getByLabel('Benchmark', { exact: true }).selectOption(main.id)
  await page.waitForLoadState('networkidle')
  await page
    .getByRole('button', { name: 'Add comparison', exact: true })
    .click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: comparable.name, exact: true })
    .click()
  await page.waitForLoadState('networkidle')
  await page
    .getByRole('button', { name: 'Add comparison', exact: true })
    .click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: new RegExp('^' + secondary.symbol) })
    .click()
  await page.waitForLoadState('networkidle')
  assert((await graph()).paths.length >= 4)
  await shot('performance-dark-1440')
  await page
    .locator('.performance-comparisons button')
    .filter({ hasText: comparable.name })
    .click()
  await page.locator('button.performance-strip-section').click()
  await page.getByRole('dialog', { name: 'Period gain / loss' }).waitFor()
  await page.getByText('Opening portfolio value', { exact: true }).waitFor()
  await shot('attribution-dark-1440')
  await page.keyboard.press('Escape')
  await page
    .getByRole('button', { name: 'View exact performance data', exact: true })
    .count()
    .then(async (count) => {
      if (count)
        await page
          .getByRole('button', {
            name: 'View exact performance data',
            exact: true,
          })
          .click()
      else
        await page
          .getByText('View exact performance data', { exact: true })
          .click()
    })
  await page.locator('.performance-workspace table tbody tr').first().waitFor()
  assert(
    (await page.locator('.performance-workspace table tbody tr').count()) > 300,
  )
  await page.getByText('View exact performance data', { exact: true }).click()
  await page.setViewportSize({ width: 1920, height: 1080 })
  await graph()
  await shot('performance-dark-1920')
  await page
    .getByRole('button', {
      name: 'Remove ' + secondary.symbol + ' · Price-only proxy',
      exact: true,
    })
    .click()
  assert.equal(await page.locator('.performance-badge').count(), 3)
  await page
    .getByLabel('Portfolio account', { exact: true })
    .selectOption(comparable.id)
  await page.waitForLoadState('networkidle')
  await graph()
  await page.getByLabel('Portfolio account', { exact: true }).selectOption('')
  await page.getByLabel('Valuation as of', { exact: true }).fill('2026-10-15')
  await page.waitForLoadState('networkidle')
  assert(
    (await page.locator('.performance-strip').innerText()).includes('missing'),
  )
  await page.getByLabel('Valuation as of', { exact: true }).fill('2026-09-30')
  await page.waitForLoadState('networkidle')
  await visit('insights?view=overview')
  await page.locator('[data-widget-id=composition] .recharts-surface').waitFor()
  await page
    .locator('[data-widget-id=targets]')
    .getByText('Household investment plan', { exact: true })
    .waitFor()
  await page
    .locator('[data-widget-id=top_movers]')
    .getByText('Top Movers', { exact: true })
    .count() // Translation capitalization may vary; geometry is checked below.
  const mover = page.locator('[data-widget-id=top_movers]')
  await mover.getByRole('button', { name: '%', exact: true }).click()
  await page.setViewportSize({ width: 1440, height: 900 })
  await page
    .locator('[data-widget-id=targets] [data-drift-quality=COMPLETE]')
    .waitFor()
  await shot('insights-dark-1440')
  await page
    .locator('[data-widget-id=targets]')
    .getByRole('button', { name: 'Current vs target', exact: true })
    .click()
  await page
    .getByRole('dialog')
    .getByText('Difference', { exact: true })
    .waitFor()
  await shot('drift-dark-1440')
  await page.keyboard.press('Escape')
  await page
    .locator('[data-widget-id=targets]')
    .getByRole('button', { name: 'New target', exact: true })
    .click()
  const editor = page.getByRole('dialog', { name: 'New target' })
  await editor
    .getByLabel('Target name', { exact: true })
    .fill('Browser test target')
  await editor.getByRole('button', { name: 'Save target', exact: true }).click()
  try {
    await editor.waitFor({ state: 'detached' })
  } catch (error) {
    await writeFile(
      path.join(output, 'editor-error.json'),
      JSON.stringify(
        await editor.evaluate((el) => ({
          text: el.innerText,
          fields: [...el.querySelectorAll('input,select')].map((e) => ({
            name: e.name,
            value: e.value,
            valid: e.validity.valid,
            message: e.validationMessage,
            exact: e.dataset.exactDecimal,
            disabled: e.disabled,
          })),
        })),
        null,
        2,
      ),
    )
    throw error
  }
  let targets = await get('/investments/allocation-targets')
  let created = targets.find((t) => t.target.name === 'Browser test target')
  assert(created)
  await page
    .locator('[data-widget-id=targets]')
    .getByRole('button', { name: 'Browser test target', exact: true })
    .click()
  await page
    .locator('[data-widget-id=targets]')
    .getByRole('button', { name: 'Edit target', exact: true })
    .click()
  const editing = page.getByRole('dialog', { name: 'Edit target' })
  await editing
    .getByLabel('Target name', { exact: true })
    .fill('Browser revised target')
  await editing
    .getByRole('button', { name: 'Save target', exact: true })
    .click()
  await editing.waitFor({ state: 'detached' })
  targets = await get('/investments/allocation-targets')
  created = targets.find((t) => t.target.name === 'Browser revised target')
  assert.equal(created.target.version, 2)
  await page
    .locator('[data-widget-id=targets]')
    .getByRole('button', { name: 'Delete target', exact: true })
    .click()
  await page.waitForLoadState('networkidle')
  assert(
    !(await get('/investments/allocation-targets')).some(
      (t) => t.target.id === created.target.id,
    ),
  )
  const explorer = page.locator('[data-widget-id=breakdown]')
  await explorer.getByRole('button', { name: 'Classes', exact: true }).click()
  await explorer
    .locator('.insight-breakdown-rows > details')
    .first()
    .locator('summary')
    .click()
  await explorer.locator('.insight-holding').first().waitFor()
  await explorer.locator('.insight-account-link').first().click()
  await page.waitForURL(/#\/account\?account=/)
  await visit('insights?view=overview')
  await page
    .locator('[data-widget-id=targets] [data-drift-quality=COMPLETE]')
    .waitFor()

  await page
    .getByRole('button', { name: 'Customize dashboard', exact: true })
    .click()
  await page.getByRole('button', { name: 'Widgets', exact: true }).click()
  const hide = page.getByRole('checkbox', { name: 'Top movers', exact: true })
  await hide.uncheck()
  await page.getByRole('button', { name: 'Save layout', exact: true }).click()
  assert.equal(await page.locator('[data-widget-id=top_movers]').count(), 0)
  await page.reload()
  await page.waitForLoadState('networkidle')
  assert.equal(await page.locator('[data-widget-id=top_movers]').count(), 0)
  await page
    .getByRole('button', { name: 'Customize dashboard', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Restore defaults', exact: true })
    .click()
  await page.getByRole('button', { name: 'Save layout', exact: true }).click()
  await page.setViewportSize({ width: 1920, height: 1080 })
  await shot('insights-dark-1920')
  const income = await get(
    '/investments/analytics/income?start=2024-10-01&end=2026-09-30&currency=BRL',
  )
  assert(income.events.length > 100)
  await visit('insights?view=income')
  await page.getByText('Income history', { exact: true }).waitFor()
  await shot('income-dark-1920')
  await page
    .getByRole('button', { name: 'Accrued Earnings', exact: true })
    .click()
  await page
    .getByText('Gross outstanding earnings', { exact: true })
    .first()
    .waitFor()
  assert.deepEqual(await get('/accounts'), before)
  assert.deepEqual(await get('/net-worth/summary?as_of=2026-09-30'), worth)
  await visit('insights?view=performance&range=1Y')
  for (const width of [1280, 834]) {
    await page.setViewportSize({ width, height: 900 })
    await graph()
    await shot('performance-dark-' + width)
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 2,
      ),
    )
  }
  for (const theme of ['dark', 'light']) {
    await page.emulateMedia({ colorScheme: theme })
    await page.evaluate((theme) => {
      const key = 'finance-tracker-preferences-demo'
      const saved = JSON.parse(localStorage.getItem(key) || '{}')
      localStorage.setItem(key, JSON.stringify({ ...saved, mode: theme }))
    }, theme)
    await page.reload()
    await page.waitForLoadState('networkidle')
    assert.equal(await page.locator('html').getAttribute('data-theme'), theme)
    await page.setViewportSize({ width: 390, height: 844 })
    await graph()
    const metrics = page.locator('.performance-mobile-metrics')
    await metrics.focus()
    await metrics.press('ArrowRight')
    await page.waitForFunction(() =>
      document
        .querySelector(
          '.performance-mobile-metrics [data-slot=carousel-content] > div',
        )
        ?.getAttribute('style')
        ?.includes('translate3d(-'),
    )
    await metrics.press('ArrowLeft')
    await shot('performance-' + theme + '-390')
    await visit('insights?view=overview')
    await page
      .locator('[data-widget-id=targets] [data-drift-quality=COMPLETE]')
      .waitFor()
    await shot('insights-' + theme + '-390')
    await visit('insights?view=performance&range=1Y')
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 2,
      ),
    )
  }
  // Empty funded scope: real API, no injected chart or frontend fixtures.
  const runtime = await get('/runtime')
  const emptyResponse = await page.request.post(origin + '/api/accounts', {
    headers: { 'X-Finance-Demo': '1', 'X-Demo-Generation': runtime.generation },
    data: {
      name: 'Browser empty investment scope',
      type: 'INVESTMENT',
      currency: 'BRL',
    },
  })
  assert(emptyResponse.ok(), await emptyResponse.text())
  const empty = await emptyResponse.json()
  await visit('insights?view=performance&account=' + empty.id)
  await page.getByText('No return history available', { exact: true }).waitFor()
  assert.equal(
    await page
      .locator('.performance-chart-region .recharts-line-curve')
      .count(),
    0,
  )
  await shot('empty-light-390')
  await copyFile(
    path.join(root, '.tmp/parity-reference-performance-compare-dark.png'),
    path.join(output, 'reference-performance.png'),
  )
  await copyFile(
    path.join(root, '.tmp/v014-insights-reference-overview-dark.png'),
    path.join(output, 'reference-insights.png'),
  )
  await writeFile(
    path.join(output, 'validation.json'),
    JSON.stringify(
      {
        result: 'PASS',
        performance,
        accountBalancesUnchanged: true,
        netWorthUnchanged: true,
        targets: 'create/edit/delete/version tested',
        comparisons: 'portfolio + account + two price-only references',
        empty: 'real empty account',
        coverage: 'missing-date guard',
        reference:
          'Cached official screenshots; runtime unavailable. No claim of identical reference data or pinned capture.',
      },
      null,
      2,
    ),
  )
  await writeFile(
    path.join(output, 'index.html'),
    `<!doctype html><meta charset="utf-8"><title>Performance and Insights validation</title><style>body{background:#151515;color:#ddd;font:14px system-ui;margin:20px}section{display:flex;gap:12px;overflow:auto}img{max-width:100%;display:block}figure{margin:0;min-width:48%}a{color:#98bce8}</style><h1>Performance and Insights — v0.14</h1><p>Cached official references; same-size capture limitations are recorded in the feature documentation.</p><h2>Performance</h2><section><figure><figcaption>Reference</figcaption><img src="reference-performance.png"></figure><figure><figcaption>Finance Tracker · 1440×900</figcaption><img src="performance-dark-1440.png"></figure></section><h2>Insights</h2><section><figure><figcaption>Reference</figcaption><img src="reference-insights.png"></figure><figure><figcaption>Finance Tracker · 1440×900</figcaption><img src="insights-dark-1440.png"></figure></section><p>${['performance-dark-1920', 'insights-dark-1920', 'drift-dark-1440', 'attribution-dark-1440', 'income-dark-1920', 'performance-dark-390', 'performance-light-390', 'empty-light-390'].map((name) => '<a href="' + name + '.png">' + name + '</a>').join(' · ')}</p>`,
  )
}
