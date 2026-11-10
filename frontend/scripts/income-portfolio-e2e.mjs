import { selectDemoFixture } from './demo-fixture-selection.mjs'
import assert from 'node:assert/strict'
import path from 'node:path'
import { writeFile } from 'node:fs/promises'

export async function checkIncomePortfolio(page, origin, output) {
  const get = async (url) => {
    const r = await page.request.get(origin + '/api' + url)
    assert(r.ok())
    return r.json()
  }
  const before = await get('/accounts')
  // Reproduce the reported order-dependent CSS leak.
  await page.goto(origin + '/#/net-worth')
  await page.locator('.net-worth-v014').waitFor()
  await page.waitForLoadState('networkidle')
  await page.goto(origin + '/#/insights?view=income')
  const runtime = await get('/runtime')
  if (runtime.scenario !== 'unified')
    await selectDemoFixture(page, origin, 'income-portfolio')
  await page.goto(origin + '/#/insights?view=income&range=ALL')
  await page.locator('.income-history-chart .recharts-area-curve').waitFor()
  await page.waitForLoadState('networkidle')
  const income = await get(
    '/investments/analytics/income?start=2024-10-01&end=2026-09-30&currency=BRL',
  )
  const accounts = await get('/accounts')
  assert.equal(income.events.length, 135)
  assert.equal(income.reporting.totals.net, '2564.587500')
  assert.equal(income.breakdowns.security.length, 10)
  assert.equal(await page.locator('.received-ranking li').count(), 10)
  const total = () => page.locator('.income-total-value > .money')
  assert.equal(await total().innerText(), 'R$ 2.564,59')
  const cardBodies = await page
    .locator('.income-summary-card > .dashboard-card-body')
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const css = getComputedStyle(node)
        return {
          padding: css.padding,
          border: css.borderTopWidth,
          background: css.backgroundColor,
        }
      }),
    )
  assert(
    cardBodies.every(
      (body) =>
        body.padding === '0px' &&
        body.border === '0px' &&
        body.background === 'rgba(0, 0, 0, 0)',
    ),
    JSON.stringify(cardBodies),
  )
  const geometry = []
  for (const mode of ['Light', 'Dark']) {
    await page.goto(origin + '/#/settings?view=appearance')
    await page.getByRole('button', { name: mode, exact: true }).click()
    await page.goto(origin + '/#/insights?view=income&range=ALL')
    await page.locator('.income-history-chart .recharts-area-curve').waitFor()
    for (const [width, height] of [
      [1440, 900],
      [1920, 1080],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height })
      await page.waitForTimeout(180)
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        'No horizontal page overflow',
      )
      if (width >= 900) {
        const chart = await page.locator('.income-history-card').boundingBox()
        const ranking = await page.locator('.income-sources-card').boundingBox()
        const plot = await page.locator('.income-plot').boundingBox()
        assert(
          Math.abs(chart.height - ranking.height) < 3,
          'History stretches to match the source ranking',
        )
        assert(plot.height >= 380, 'History plot is not collapsed')
        geometry.push({ mode, width, height, chart, ranking, plot })
      }
      await page.mouse.move(1, 1)
      await page.evaluate(() => {
        window.scrollTo(0, 0)
        document.querySelector('main')?.scrollTo(0, 0)
      })
      await page.screenshot({
        path: path.join(output, `rich-${mode.toLowerCase()}-${width}.png`),
      })
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('button', { name: 'By account', exact: true }).click()
  await page.evaluate(() => {
    window.scrollTo(0, 0)
    document.querySelector('main')?.scrollTo(0, 0)
  })
  assert.equal(await page.locator('.recharts-area-curve').count(), 0)
  await page.screenshot({
    path: path.join(output, 'rich-byaccount-dark-1440.png'),
  })
  await page.getByRole('button', { name: 'Combined', exact: true }).click()
  await page.locator('.income-plot').hover({ position: { x: 400, y: 150 } })
  await page.locator('.chart-tooltip .money').first().waitFor()
  await page.mouse.move(1, 1)
  await page.getByRole('button', { name: 'Year to Date', exact: true }).click()
  await page.waitForLoadState('networkidle')
  const scoped = await get(
    '/investments/analytics/income?start=2026-01-01&end=2026-09-30&currency=BRL',
  )
  assert(
    scoped.events.length < income.events.length && scoped.events.length > 0,
  )
  await page
    .getByLabel('Portfolio account', { exact: true })
    .selectOption(income.breakdowns.account[0].id)
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Portfolio account', { exact: true }).selectOption('')
  await page.getByRole('button', { name: 'All Time', exact: true }).click()
  await page.waitForLoadState('networkidle')
  assert.equal(await total().innerText(), 'R$ 2.564,59')
  assert.deepEqual(
    await get('/accounts'),
    accounts,
    'Display interactions never create cash credits',
  )
  await writeFile(
    path.join(output, 'rich-validation.json'),
    JSON.stringify(
      {
        payments: 135,
        sources: 10,
        total: income.reporting.totals.net,
        cardBodies,
        geometry,
        result: 'PASS',
      },
      null,
      2,
    ),
  )
  if (runtime.scenario !== 'unified')
    await selectDemoFixture(page, origin, 'real-market-br')
  assert.deepEqual(
    await get('/accounts'),
    before,
    'No household changes from reading income',
  )
}
