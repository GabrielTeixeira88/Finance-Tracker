import { selectDemoFixture } from './demo-fixture-selection.mjs'
import assert from 'node:assert/strict'
import path from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
export async function checkChartDemo(page, origin, root) {
  const stage = process.env.CHART_STAGE || 'after'
  const output = path.join(root, 'docs/screenshots/v014-charts')
  await mkdir(output, { recursive: true })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  const positions = await (
    await page.request.get(origin + '/api/manual-positions')
  ).json()
  const car = positions.find((p) => p.name === 'Car')
  assert(car, 'Owned Brazil demo contains Car')
  const values = await (
    await page.request.get(
      origin + `/api/manual-positions/${car.id}/observations`,
    )
  ).json()
  await page.goto(origin + `/#/net-worth?view=Assets&position=${car.id}`)
  await page.locator('.manual-position-history .recharts-surface').waitFor()
  await page.waitForLoadState('networkidle')
  await page.mouse.move(1400, 10)
  await page.screenshot({ path: path.join(output, `car-${stage}-1440.png`) })
  const line = await page
    .locator('.manual-position-history .recharts-area-curve')
    .getAttribute('d')
  const rows = Array.isArray(values) ? values : values.observations
  const latest = rows
    .filter((v) => !v.voided_at)
    .sort((a, b) => a.effective_date.localeCompare(b.effective_date))
    .at(-1)
  assert.equal(latest.amount, '38000.000000')
  if (stage === 'after')
    assert(
      /C/.test(line),
      'Sparse observations must not end in an artificial step edge',
    )
  await writeFile(
    path.join(output, `car-${stage}-diagnosis.json`),
    JSON.stringify({ latest, line }, null, 2),
  )
  if (stage === 'after') {
    const brazil = await (
      await page.request.get(origin + '/api/accounts')
    ).json()
    await selectDemoFixture(page, origin, 'etf-showcase')
    await page.goto(origin + '/#/investments?view=Overview')
    await page.locator('.recharts-area-curve').first().waitFor()
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: path.join(output, 'etf-overview-1440.png') })
    await page
      .locator('.balance-chart')
      .first()
      .hover({ position: { x: 450, y: 120 } })
    await page
      .locator('.chart-tooltip')
      .getByText('Fictional simulated prices - not exchange quotes', {
        exact: true,
      })
      .waitFor()
    await page.mouse.move(1400, 10)
    await page.getByRole('button', { name: 'ALL', exact: true }).click()
    await page.waitForLoadState('networkidle')
    await page.screenshot({
      path: path.join(output, 'etf-overview-all-1440.png'),
    })
    await page.goto(origin + '/#/investments?view=Holdings')
    await page.getByText('SIM-GLOBAL-ETF', { exact: true }).first().waitFor()
    await page.getByText('SIM-SP500-ETF', { exact: true }).first().waitFor()
    await page.screenshot({ path: path.join(output, 'etf-holdings-1440.png') })
    const portfolio = await (
      await page.request.get(
        origin + '/api/investments/portfolio?as_of=2026-09-30',
      )
    ).json()
    assert.deepEqual(
      portfolio.holdings.map((h) => h.quantity),
      ['230.000000', '110.000000'],
    )
    const global = (
      await (await page.request.get(origin + '/api/investments/assets')).json()
    ).find((a) => a.symbol === 'SIM-GLOBAL-ETF')
    await page.goto(origin + '/#/investments?view=Overview&asset=' + global.id)
    await page.locator('.recharts-area-curve').first().waitFor()
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: path.join(output, 'etf-detail-1440.png') })
    await page.goto(origin + '/#/performance')
    await page.locator('.recharts-surface').first().waitFor()
    await page.waitForLoadState('networkidle')
    await page.screenshot({
      path: path.join(output, 'etf-performance-1440.png'),
    })
    const performance = await (
      await page.request.get(
        origin +
          '/api/investments/analytics/performance?start=2024-10-01&end=2026-09-30&currency=BRL',
      )
    ).json()
    assert(performance.twr.value !== null && performance.xirr.value !== null)
    await writeFile(
      path.join(output, 'etf-performance-check.json'),
      JSON.stringify(performance, null, 2),
    )
    await page.goto(origin + '/#/net-worth?end=2026-09-30&range=1Y')
    await page.locator('.net-worth-source-grid').waitFor()
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: path.join(output, 'etf-net-worth-1440.png') })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({
      path: path.join(output, 'etf-mobile.png'),
      fullPage: true,
    })
    await page.setViewportSize({ width: 1440, height: 900 })
    const runtime = await (
      await page.request.get(origin + '/api/runtime')
    ).json()
    const response = await page.request.post(
      origin + '/api/demo-control/reset',
      {
        headers: {
          'x-finance-demo': '1',
          'x-demo-generation': runtime.generation,
          origin,
        },
        data: { confirmation: 'RESET FICTIONAL DEMO' },
      },
    )
    assert(response.ok())
    assert.deepEqual(
      await (
        await page.request.get(
          origin + '/api/investments/portfolio?as_of=2026-09-30',
        )
      ).json(),
      portfolio,
    )
    await page.reload()
    await selectDemoFixture(page, origin, 'real-market-br')
    await page.goto(origin + '/#/dashboard')
    await page.getByText('Where it went', { exact: true }).waitFor()
    await page.waitForLoadState('networkidle')
    assert(!/%\s+%\s+elapsed/.test(await page.locator('body').innerText()))
    await page.screenshot({
      path: path.join(output, 'household-spending-restored-1440.png'),
    })
    const spending = await (
      await page.request.get(
        origin +
          '/api/spending/summary?date_from=2026-09-01&date_to=2026-10-01&currency=BRL',
      )
    ).json()
    assert(
      !/^0(?:\.0+)?$/.test(spending.expenses) &&
        !spending.expenses.startsWith('-'),
    )
    assert.deepEqual(
      await (await page.request.get(origin + '/api/accounts')).json(),
      brazil,
    )
    await writeFile(
      path.join(output, 'etf-financial-check.json'),
      JSON.stringify(portfolio, null, 2),
    )
  }
  console.log(
    'Car chart endpoint: recorded BRL 38000, path captured; stage=' + stage,
  )
}
