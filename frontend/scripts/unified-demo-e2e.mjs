// One public demo, one real ledger. The outer runner owns a temporary migrated workspace.
import assert from 'node:assert/strict'
import path from 'node:path'
import { writeFile } from 'node:fs/promises'
import { checkIncomePortfolio } from './income-portfolio-e2e.mjs'

export async function checkUnifiedDemo(page, origin, output) {
  const api = async (url) => {
    const r = await page.request.get(origin + '/api' + url)
    assert(r.ok(), url)
    return r.json()
  }
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  const runtime = await api('/runtime')
  assert.equal(runtime.scenario, 'unified')
  assert.deepEqual(
    runtime.scenarios.map((s) => s.id),
    ['unified'],
  )
  const accounts = await api('/accounts')
  const dashboard = await api('/dashboard?month=2026-09')
  assert.equal(dashboard.totals[0].income, '9800.000000')
  assert.equal(dashboard.totals[0].expenses, '4184.820000')
  const goals = await api('/goals?as_of=2026-09-30')
  assert.equal(goals.length, 7)
  const visibleGoals = goals.filter(
    ({ goal }) => goal.status !== 'ARCHIVED',
  ).length
  assert.equal(visibleGoals, 6)
  const portfolio = await api('/investments/portfolio?as_of=2026-09-30')
  assert(portfolio.holdings.some((h) => h.symbol === 'SIM-GLOBAL-ETF'))
  assert(portfolio.holdings.some((h) => h.symbol === 'SIM-SP500-ETF'))
  const fixed = await api('/investments/fixed-income?as_of=2026-09-30')
  assert.equal(fixed.positions.length, 12)
  const income = await api(
    '/investments/analytics/income?start=2024-10-01&end=2026-09-30&currency=BRL',
  )
  assert.equal(income.events.length, 135)
  const findings = []
  const views = [
    ['dashboard', 'spending', '.wf-spending .recharts-bar-rectangle'],
    ['goals', 'goals', '.goals-workspace a[href*="goal="]'],
    [
      'investments?range=ALL',
      'investments',
      '.investment-source-dashboard .recharts-surface',
    ],
    ['investments?view=Holdings', 'holdings', '.wf-workspace table'],
    ['performance?range=ALL', 'performance', '.recharts-surface'],
    [
      'insights?view=overview',
      'insights',
      '[data-widget-id=composition] .recharts-surface',
    ],
    ['net-worth?range=ALL', 'net-worth', '.net-worth-v014 .recharts-surface'],
  ]
  for (const [route, name, marker] of views) {
    await page.goto(`${origin}/#/${route}`)
    await page.locator(marker).first().waitFor()
    await page.waitForLoadState('networkidle')
    assert.equal(await page.getByLabel('Demo scenario').count(), 0)
    assert.equal(
      await page
        .getByRole('button', {
          name: /Open income demo|Return to household demo/,
        })
        .count(),
      0,
    )
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      name + ' fits',
    )
    if (name === 'goals')
      assert.equal(
        await page.locator('.goals-workspace a[href*="goal="]').count(),
        visibleGoals,
      )
    await page.screenshot({ path: path.join(output, `${name}-1440.png`) })
    findings.push(name)
  }
  // Chart, source ranking, both themes, desktop/mobile, time/account selection and CSS isolation.
  await checkIncomePortfolio(page, origin, output)
  await page.goto(origin + '/#/insights?view=income&mode=accrued')
  // Use the actual control; query routing remains authoritative.
  await page
    .getByRole('button', { name: 'Accrued Earnings', exact: true })
    .click()
  await page.locator('.fixed-income-chart .recharts-surface').first().waitFor()
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: path.join(output, 'accrued-1440.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  const security = (await api('/investments/assets')).find(
    (asset) => asset.symbol === 'SIM-GLOBAL-ETF',
  )
  await page.goto(origin + '/#/holdings?asset=' + security.id)
  await page.locator('.demo-market-footer details').first().waitFor()
  await page.locator('.demo-market-footer details > summary').first().click()
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    'Full source hashes must wrap within the phone viewport',
  )
  const sources = await api('/demo-control/market-evidence')
  for (const source of Object.values(sources.sources))
    assert(
      await page
        .locator('.demo-market-footer code')
        .filter({ hasText: source.sha256 })
        .count(),
    )
  await page.screenshot({
    path: path.join(output, 'source-evidence-mobile.png'),
  })
  await page
    .getByRole('button', { name: 'Open navigation', exact: true })
    .click()
  await page
    .getByRole('dialog', { name: 'Navigation' })
    .getByRole('button', { name: 'Goals', exact: true })
    .click()
  await page.locator('.goals-workspace a[href*="goal="]').first().waitFor()
  assert.equal(
    await page.locator('.goals-workspace a[href*="goal="]').count(),
    visibleGoals,
  )
  await page.screenshot({ path: path.join(output, 'goals-mobile.png') })
  assert.deepEqual(
    await api('/accounts'),
    accounts,
    'Every section shares unchanged financial data',
  )
  // Reset only this runner-owned workspace and reject stale generation writes.
  const headers = {
    'X-Finance-Demo': '1',
    'X-Demo-Generation': runtime.generation,
  }
  const reset = await page.request.post(origin + '/api/demo-control/reset', {
    headers,
    data: { confirmation: 'RESET FICTIONAL DEMO' },
  })
  assert(reset.ok())
  assert.equal((await reset.json()).scenario, 'unified')
  assert.deepEqual(await api('/accounts'), accounts)
  assert.equal((await api('/goals?as_of=2026-09-30')).length, 7)
  assert.equal(
    (
      await api(
        '/investments/analytics/income?start=2024-10-01&end=2026-09-30&currency=BRL',
      )
    ).events.length,
    135,
  )
  await writeFile(
    path.join(output, 'validation.json'),
    JSON.stringify(
      {
        result: 'PASS',
        views: findings,
        household: dashboard.totals,
        goals: 7,
        incomePayments: 135,
        income: income.reporting.totals.net,
        positions: portfolio.holdings.length,
        fixedIncome: 12,
      },
      null,
      2,
    ),
  )
  console.log(
    'Unified demo: spending, goals, fixed income, ETFs, income, charts, responsive navigation and reset PASS',
  )
}
