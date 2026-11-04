import assert from 'node:assert/strict'
import path from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'

export async function checkRealMarket(page, origin, output) {
  await mkdir(output, { recursive: true })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(origin)
  const initialRuntime = await (await fetch(`${origin}/api/runtime`)).json()
  const legacyFixture = initialRuntime.scenario === 'synthetic'
  if (legacyFixture) {
    await page.locator('.demo-menu > summary').click()
    await page.getByLabel('Demo scenario').selectOption('real-market-br')
  } else {
    assert.deepEqual(
      initialRuntime.scenarios.map((s) => s.id),
      ['real-market-br'],
    )
    assert.equal(await page.getByLabel('Demo scenario').count(), 0)
  }
  await page
    .getByText(/Historical simulation: actual market observations/)
    .waitFor()
  await page.getByText(/WRLD11 and IVVB11 are not purchased/).waitFor()
  const evidence = await (
    await fetch(`${origin}/api/demo-control/market-evidence`)
  ).json()
  assert.equal(evidence.etf_coverage, 'UNAVAILABLE')
  assert.equal(evidence.caixinha.gross_value, '3865.733100')
  const portfolio = await (
    await fetch(`${origin}/api/investments/portfolio?as_of=2026-09-30`)
  ).json()
  assert.equal(portfolio.totals[0].total_value, '14908.312300')
  const performance = await (
    await fetch(
      `${origin}/api/investments/analytics/performance?start=2024-10-01&end=2026-09-30&currency=BRL`,
    )
  ).json()
  assert.equal(performance.absolute_gain.value, '2613.222600')
  assert.equal(performance.twr.quality, 'COMPLETE')
  assert.equal(performance.xirr.quality, 'COMPLETE')
  assert.equal(portfolio.totals[0].cash, '0.000000')
  const accounts = await (await fetch(`${origin}/api/accounts`)).json()
  assert(accounts.every((a) => a.currency === 'BRL'))
  assert(!accounts.some((a) => /International|European/i.test(a.name)))
  const cash = await (
    await fetch(`${origin}/api/dashboard?month=2026-09`)
  ).json()
  assert.equal(cash.totals[0].income, '9800.000000')
  assert.equal(cash.totals[0].expenses, '4129.820000')
  const goals = await (
    await fetch(`${origin}/api/goals?as_of=2026-09-30`)
  ).json()
  assert.equal(goals.length, 5)
  assert.deepEqual(
    goals.map((g) => g.goal.name).sort(),
    [
      'Design course',
      'Emergency reserve',
      'Home studio',
      'Vacation',
      'Vehicle upgrade',
    ].sort(),
  )
  const errors = []
  const recordError = (error) => errors.push(error.message)
  page.on('pageerror', recordError)
  const views = [
    ['overview', 'spending', '.daily-bars'],
    [
      'investments?range=ALL',
      'investments',
      '.investment-hero .recharts-surface',
    ],
    ['performance?range=ALL', 'performance', '.recharts-surface'],
    ['investments?view=Allocation&range=ALL', 'insights', '.recharts-surface'],
    ['net-worth?range=ALL', 'net-worth', '.balance-chart .recharts-surface'],
    ['goals', 'goals', '.goal-visual'],
    [
      'investments?view=Fixed+Income',
      'fixed-income',
      '.fixed-income-workspace .investment-table',
    ],
  ]
  for (const [route, name, marker] of views) {
    await page.goto(`${origin}/#/${route}`)
    await page.waitForLoadState('networkidle')
    await page.locator(marker).first().waitFor()
    if (name === 'goals') {
      assert.equal(await page.locator('.goal-visual').count(), 5)
      await page.getByRole('button', { name: /Vehicle upgrade/ }).waitFor()
    }
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Overflow: ${route}`,
    )
    await page.screenshot({
      path: path.join(output, `${name}-1440.png`),
      fullPage: false,
    })
  }
  await page.goto(`${origin}/#/investments?range=ALL`)
  await page.locator('.investment-hero .recharts-surface').waitFor()
  assert(
    (await page.locator('.recharts-reference-dot').count()) >= 10,
    'Dated purchase markers missing',
  )
  const allParams = await page.evaluate(() => location.hash)
  assert(allParams.includes('ALL'))
  for (const range of ['1M', '3M', '6M', '1Y', 'ALL']) {
    await page
      .getByRole('navigation', { name: 'Portfolio history range' })
      .getByRole('button', { name: range, exact: true })
      .click()
    await page.waitForLoadState('networkidle')
    assert(
      (await page.evaluate(() => location.hash)).includes(`range=${range}`),
    )
    await page.locator('.investment-hero .recharts-surface').waitFor()
  }
  await page.goto(`${origin}/#/goals`)
  await page.getByRole('button', { name: /Emergency reserve/ }).click()
  await page.getByText(/This goal reserves the Caixinha/).waitFor()
  assert.equal(
    await page
      .getByRole('button', {
        name: 'Set dated account allocation',
        exact: true,
      })
      .count(),
    0,
  )
  await page.screenshot({ path: path.join(output, 'goal-detail-1440.png') })
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto(`${origin}/#/investments?range=ALL`)
  await page.locator('.investment-hero .recharts-surface').waitFor()
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: path.join(output, 'investments-1920.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('dialog', { name: 'Navigation' }).waitFor()
  await page.screenshot({ path: path.join(output, 'mobile-navigation.png') })
  await page.getByRole('button', { name: 'Close navigation' }).click()
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  )
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.locator('.demo-menu > summary').click()
  await page.getByRole('button', { name: 'Reset demo', exact: true }).click()
  await page
    .getByText(/Historical simulation: actual market observations/)
    .waitFor()
  await page.waitForLoadState('networkidle')
  assert.deepEqual(
    await (await fetch(`${origin}/api/demo-control/market-evidence`)).json(),
    evidence,
  )
  if (legacyFixture) {
    await page.locator('.demo-menu > summary').click()
    await page.getByLabel('Demo scenario').selectOption('synthetic')
    await page.waitForLoadState('networkidle')
    assert.equal(
      (await (await fetch(`${origin}/api/runtime`)).json()).scenario,
      'synthetic',
    )
  }
  assert.deepEqual(errors, [])
  page.off('pageerror', recordError)
  await writeFile(
    path.join(output, 'validated-results.json'),
    JSON.stringify(
      {
        reference_date: evidence.reference_date,
        etf_coverage: evidence.etf_coverage,
        caixinha: evidence.caixinha,
        household: {
          monthly_income: cash.totals[0].income,
          monthly_spending: cash.totals[0].expenses,
          goals: goals.map((g) => g.goal.name),
        },
        portfolio: portfolio.totals,
        performance: {
          start: performance.start,
          end: performance.end,
          twr: performance.twr,
          xirr: performance.xirr,
          absolute_gain: performance.absolute_gain,
        },
        browser_errors: errors,
        checked: [
          'scenario selection',
          'offline API data',
          'range controls',
          'purchase markers',
          'goal account funding',
          'reset',
          legacyFixture
            ? 'legacy fixture regression'
            : 'Brazil-only public demo',
          'mobile navigation',
        ],
      },
      null,
      2,
    ),
  )
}
