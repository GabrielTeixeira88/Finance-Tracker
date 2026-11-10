import { selectDemoFixture } from './demo-fixture-selection.mjs'
// Owned migrated workspaces only. Scenario selection never changes the live user/demo DB.
import assert from 'node:assert/strict'
import path from 'node:path'
import { checkIncomePortfolio } from './income-portfolio-e2e.mjs'
import { mkdir, writeFile } from 'node:fs/promises'
export async function checkIncome(page, origin, root) {
  const output = path.join(root, 'docs/screenshots/v014-income')
  await mkdir(output, { recursive: true })
  const get = async (url) => {
    const response = await page.request.get(origin + '/api' + url)
    assert(response.ok())
    return response.json()
  }
  const before = await get('/accounts')
  const incomeBefore = await get(
    '/investments/analytics/income?start=2024-10-01&end=2026-09-30',
  )
  assert.equal(
    incomeBefore.events.length,
    0,
    'Historical baseline has no cash distributions',
  )
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(origin + '/#/insights?view=income')
  await page
    .getByText('No investment payments recorded', { exact: true })
    .waitFor()
  assert(
    await page.evaluate(() => {
      const workspace = document.querySelector('.investment-workspace')
      const footer = document.querySelector('.demo-market-footer')
      return (
        !!workspace &&
        !!footer &&
        !!(
          workspace.compareDocumentPosition(footer) &
          Node.DOCUMENT_POSITION_FOLLOWING
        )
      )
    }),
    'Historical disclosure follows the financial page',
  )
  assert.equal(
    await page.locator('.demo-experience .financial-disclosure').count(),
    0,
  )
  assert.equal(await page.locator('.income-history-chart').count(), 0)
  await page.screenshot({ path: path.join(output, 'received-empty-1440.png') })
  await page
    .getByRole('button', { name: 'Explore accrued earnings', exact: true })
    .click()
  await page
    .getByRole('heading', { name: 'Gross outstanding earnings', exact: true })
    .waitFor()
  await page.locator('.fixed-income-chart .recharts-surface').waitFor()
  const report = await get('/investments/fixed-income?as_of=2026-09-30')
  const rows = report.positions.filter(
    (row) => row.contract.instrument_type !== 'TESOURO_SELIC',
  )
  const units = (amount) => {
    const [whole, fraction = ''] = amount.replace('-', '').split('.')
    return (
      (BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0'))) *
      (amount.startsWith('-') ? -1n : 1n)
    )
  }
  const exact = (amount) =>
    `${amount < 0n ? '-' : ''}${(amount < 0n ? -amount : amount) / 1000000n}.${String((amount < 0n ? -amount : amount) % 1000000n).padStart(6, '0')}`
  const format = (amount) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
      .format(amount)
      .replaceAll('\u00a0', ' ')
  const gross = exact(
    rows.reduce((total, row) => total + units(row.gross_interest), 0n),
  )
  const net = exact(
    rows.reduce(
      (total, row) => total + units(row.estimated_net) - units(row.principal),
      0n,
    ),
  )
  assert.equal(
    await page
      .getByRole('heading', { name: 'Gross outstanding earnings', exact: true })
      .locator('..')
      .locator('..')
      .locator('..')
      .locator('.dashboard-card-body > .money, .income-total-value > .money')
      .innerText(),
    format(gross),
  )
  assert.equal(
    await page
      .getByRole('heading', { name: 'Estimated net earnings', exact: true })
      .locator('..')
      .locator('..')
      .locator('..')
      .locator('.dashboard-card-body > .money')
      .innerText(),
    format(net),
  )
  await page
    .getByRole('heading', { name: 'Tesouro — price-based result', exact: true })
    .waitFor()
  for (const [width, height] of [
    [1440, 900],
    [1920, 1080],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height })
    await page.waitForTimeout(150)
    await page.mouse.move(10, 3)
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      'No horizontal overflow',
    )
    await page.screenshot({ path: path.join(output, `accrued-${width}.png`) })
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/fixed-income?') &&
        response.url().includes('2025-12-31') &&
        response.ok(),
    ),
    page.getByRole('button', { name: 'Last Year', exact: true }).click(),
  ])
  const switchScenario = async (scenario) => {
    await selectDemoFixture(page, origin, scenario)
  }
  await switchScenario('etf-showcase')
  const originalEtf = await get('/accounts')
  await switchScenario('income-showcase')
  const showcase = await get(
    '/investments/analytics/income?start=2024-10-01&end=2026-09-30&currency=BRL',
  )
  assert.equal(showcase.events.length, 27)
  assert.equal(showcase.reporting.totals.net, '1200.000000')
  assert.equal(showcase.breakdowns.account.length, 2)
  const showcaseAccounts = await get('/accounts')
  await page.goto(origin + '/#/insights?view=income&range=ALL')
  await page.locator('.income-history-chart .recharts-area-curve').waitFor()
  const metric = (name) =>
    (name === 'Received income'
      ? page.locator('.income-summary-card').first()
      : page
          .getByRole('heading', { name, exact: true })
          .locator('xpath=ancestor::section[1]')
    ).locator('.dashboard-card-body > .money, .income-total-value > .money')
  assert.equal(await metric('Received income').innerText(), 'R$ 1.200,00')
  assert.equal(await metric('Monthly average').innerText(), 'R$ 60,00')
  await page.getByRole('button', { name: 'By account', exact: true }).click()
  assert.equal(
    await page.locator('.income-history-chart .recharts-area-curve').count(),
    0,
  )
  await page.screenshot({
    path: path.join(output, 'received-byaccount-1440.png'),
  })
  await page.getByRole('button', { name: 'Combined', exact: true }).click()
  await page
    .locator('.income-history-chart')
    .hover({ position: { x: 370, y: 130 } })
  await page
    .locator('.chart-tooltip')
    .getByText('Fictional simulated prices - not exchange quotes', {
      exact: true,
    })
    .waitFor()
  await page.mouse.move(10, 3)
  for (const [width, height] of [
    [1440, 900],
    [1920, 1080],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height })
    await page.waitForTimeout(150)
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      'No populated overflow',
    )
    await page.screenshot({
      path: path.join(output, `received-populated-${width}.png`),
    })
    if (width === 390) {
      await page
        .getByRole('button', { name: 'Open navigation', exact: true })
        .click()
      await page
        .getByRole('dialog', { name: 'Navigation', exact: true })
        .waitFor()
      await page.screenshot({
        path: path.join(output, 'income-mobile-navigation.png'),
      })
      await page.keyboard.press('Escape')
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(origin + '/#/settings?view=appearance')
  await page.getByRole('button', { name: 'Light', exact: true }).click()
  await page.goto(origin + '/#/insights?view=income&range=ALL')
  await page.locator('.income-history-chart .recharts-area-curve').waitFor()
  await page.waitForLoadState('networkidle')
  await page.screenshot({
    path: path.join(output, 'received-populated-light-1440.png'),
  })
  await page.goto(origin + '/#/settings?view=appearance')
  await page.getByRole('button', { name: 'Dark', exact: true }).click()
  await page.goto(origin + '/#/insights?view=income&range=ALL')
  await page.getByRole('button', { name: 'Year to Date', exact: true }).click()
  await page.waitForLoadState('networkidle')
  assert.equal(await metric('Received income').innerText(), 'R$ 585,75')
  await page.getByRole('button', { name: 'Last Year', exact: true }).click()
  await page.waitForLoadState('networkidle')
  assert.equal(await metric('Received income').innerText(), 'R$ 614,25')
  await page.getByLabel('More periods', { exact: true }).selectOption('Custom')
  await page
    .getByLabel('Period opening date', { exact: true })
    .fill('2026-06-01')
  await page.waitForLoadState('networkidle')
  assert.equal(await metric('Received income').innerText(), 'R$ 345,75')
  await page.getByRole('button', { name: 'All Time', exact: true }).click()
  await page.waitForLoadState('networkidle')
  const incomeAccount = showcaseAccounts.find(
    (a) => a.name === 'Simulated Income Brokerage',
  )
  await page
    .getByLabel('Portfolio account', { exact: true })
    .selectOption(incomeAccount.id)
  await page.waitForLoadState('networkidle')
  assert.equal(await metric('Received income').innerText(), 'R$ 697,50')
  await page.getByLabel('Portfolio account', { exact: true }).selectOption('')
  assert.equal(
    await page
      .getByRole('combobox', { name: /currency|amount display/i })
      .count(),
    0,
  )
  // Existing explicit currency bookmarks/API coverage remain supported without a picker.
  await page.goto(origin + '/#/insights?view=income&range=ALL&currency=USD')
  await page.getByText('Reporting total unavailable', { exact: true }).waitFor()
  assert.equal(await page.locator('.income-history-chart').count(), 0)
  await page.goto(
    origin +
      '/#/insights?view=income&range=ALL&currency=USD&income_basis=native&income_currency=BRL',
  )
  await metric('Received income').waitFor()
  assert.equal(await metric('Received income').innerText(), 'R$ 1.200,00')
  await page.goto(origin + '/#/insights?view=income&range=ALL')
  await page.waitForLoadState('networkidle')
  await page
    .getByRole('button', { name: 'SIM-DIVIDEND-ETF', exact: true })
    .first()
    .click()
  await page.waitForURL(/asset=/)
  assert((await page.url()).includes('asset='), 'Holding navigation preserved')
  assert.deepEqual(
    await get('/accounts'),
    showcaseAccounts,
    'Income reads do not post cash',
  )
  await switchScenario('etf-showcase')
  assert.deepEqual(
    await get('/accounts'),
    originalEtf,
    'Original ETF showcase intact',
  )
  await switchScenario('real-market-br')
  assert.deepEqual(await get('/accounts'), before)
  assert.deepEqual(
    await get('/investments/analytics/income?start=2024-10-01&end=2026-09-30'),
    incomeBefore,
  )
  for (const route of [
    'overview',
    'investments?view=Holdings',
    'insights?view=performance',
    'insights?view=overview',
    'net-worth',
    'spending',
    'spending?view=Budgets',
    'spending?view=Life%20Events',
    'goals',
  ]) {
    await page.goto(origin + '/#/' + route)
    await page.waitForLoadState('networkidle')
    assert.equal(
      await page
        .getByRole('combobox', { name: /currency|amount display/i })
        .count(),
      0,
      `No currency picker: ${route}`,
    )
  }
  await checkIncomePortfolio(page, origin, output)
  await writeFile(
    path.join(output, 'validation.json'),
    JSON.stringify(
      {
        mode: 'Approved versioned income showcase plus unchanged Brazil/original ETF',
        payments: 27,
        dividends: '697.500000',
        interest: '502.500000',
        total: '1200.000000',
        gross,
        net,
        result: 'PASS',
      },
      null,
      2,
    ),
  )
}
