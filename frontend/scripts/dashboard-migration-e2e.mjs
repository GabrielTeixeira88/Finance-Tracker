// Real browser and API; called only by demo-e2e's runner-owned temporary database.
import assert from 'node:assert/strict'
import { mkdir, writeFile, copyFile } from 'node:fs/promises'
import path from 'node:path'
import { checkIncomePortfolio } from './income-portfolio-e2e.mjs'

export async function checkDashboardMigration(page, origin, root) {
  const output = path.join(root, 'docs/screenshots/v014-dashboards')
  await mkdir(output, { recursive: true })
  page.setDefaultTimeout(20000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const get = async (p) => {
    const response = await page.request.get(origin + '/api' + p)
    assert(response.ok(), await response.text())
    return response.json()
  }
  const accountsBefore = await get('/accounts')
  const runtime = await get('/runtime')
  assert.equal(runtime.scenario, 'unified')
  const end = runtime.end_date
  const units = (value) => {
    const negative = value.startsWith('-'),
      [whole, fraction = ''] = value.replace(/^-/, '').split('.')
    return (
      (negative ? -1n : 1n) *
      (BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0')))
    )
  }
  const visit = async (route) => {
    await page.goto(origin + '/#/' + route)
    await page.waitForLoadState('networkidle')
  }
  const settle = async () => {
    await page.waitForLoadState('networkidle')
    await page.locator('.recharts-area-curve').first().waitFor()
    if (await page.locator('.investment-source-dashboard').count()) {
      await page
        .getByRole('heading', { name: 'Holdings', exact: true })
        .waitFor()
      await page.getByRole('heading', { name: 'Goals', exact: true }).waitFor()
    }
  }
  const shot = async (name) => {
    await page.mouse.move(3, 3)
    await page.evaluate(() => {
      window.scrollTo(0, 0)
      document
        .querySelectorAll('main,[data-page-scroll-container]')
        .forEach((e) => {
          e.scrollTop = 0
        })
    })
    await page.screenshot({ path: path.join(output, name + '.png') })
  }
  await visit('settings?view=appearance')
  await page.getByRole('button', { name: 'Dark', exact: true }).click()
  await page.getByRole('button', { name: 'Classic', exact: true }).click()
  await page.getByLabel('Font family', { exact: true }).selectOption('mono')
  const collapse = page.getByRole('button', {
    name: 'Collapse sidebar',
    exact: true,
  })
  if (await collapse.isVisible()) await collapse.click()
  await page.setViewportSize({ width: 1440, height: 900 })
  await visit('dashboard')
  await page.getByText('Where it went', { exact: true }).waitFor()
  const tabs = page.getByRole('navigation', { name: 'Dashboard', exact: true })
  await tabs.getByRole('button', { name: 'Investments', exact: true }).click()
  await page.getByTestId('portfolio-balance').waitFor()
  await settle()
  assert(
    (
      await page
        .locator('.dashboard-history-chart .recharts-area-curve')
        .first()
        .getAttribute('d')
    ).length > 100,
  )
  const chart = await page.locator('.dashboard-history-chart').boundingBox()
  assert(chart.width > 1000 && chart.height === 280)
  await shot('investments-dark-1440')
  await page.getByRole('button', { name: '3M', exact: true }).click()
  await settle()
  await page.locator('.dashboard-balance-trigger').click()
  await page.getByText(/Historical values include holdings/).waitFor()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Holding display options' }).click()
  await page.getByRole('radio', { name: 'Name', exact: true }).check()
  await page.getByRole('radio', { name: 'Daily change', exact: true }).check()
  await page.getByRole('radio', { name: 'Gain', exact: true }).check()
  await shot('holding-options-dark-1440')
  await page.getByRole('radio', { name: 'Symbol', exact: true }).check()
  await page.getByRole('radio', { name: 'Market value', exact: true }).check()
  await page
    .getByRole('radio', { name: 'Unrealized gain', exact: true })
    .check()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Select dates' }).click()
  await page.getByRole('button', { name: 'Choose custom dates' }).click()
  await page.getByLabel('Start date').fill('2026-08-01')
  await page.getByLabel('End date').fill('2026-08-31')
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  await settle()
  assert.equal(
    new URLSearchParams(page.url().split('?')[1]).get('start'),
    '2026-08-01',
  )
  assert.equal(
    new URLSearchParams(page.url().split('?')[1]).get('end'),
    '2026-08-31',
  )
  await visit(`dashboard?view=investments&end=${end}&range=3M`)
  await settle()
  await page.getByRole('button', { name: '3M', exact: true }).click()
  await settle()
  const context = new URLSearchParams(page.url().split('?')[1])
  assert.equal(context.get('range'), '3M')
  const start = context.get('start')
  const data = await get(
    `/investments/analytics/dashboard?start=${start}&end=${end}`,
  )
  assert.equal(
    data.accounts.reduce((sum, a) => sum + units(a.value), 0n),
    units(data.performance.ending_value),
  )
  const wealth = await get(
    `/net-worth/history?start=${start}&end=${end}&details=true`,
  )
  assert.equal(
    units(wealth.assets) - units(wealth.liabilities),
    units(wealth.value),
  )
  assert.equal(
    wealth.insights.velocity.drivers.reduce(
      (sum, d) => sum + units(d.value),
      0n,
    ),
    units(wealth.change),
  )
  await page.getByRole('button', { name: 'Hide balances', exact: true }).click()
  assert(
    !(await page.getByTestId('portfolio-balance').innerText()).includes('R$'),
  )
  await tabs.getByRole('button', { name: 'Net Worth', exact: true }).click()
  await settle()
  assert.equal(
    new URLSearchParams(page.url().split('?')[1]).get('start'),
    start,
  )
  assert(
    !(await page.locator('.net-worth-primary-line').innerText()).includes('R$'),
  )
  await page.getByRole('button', { name: 'Show balances', exact: true }).click()
  await page.getByText('Momentum', { exact: true }).waitFor()
  await page.getByRole('button', { name: /Vintage audio collection/ }).waitFor()
  await shot('net-worth-dark-1440')
  const property = page.getByRole('button', { name: 'Properties', exact: true })
  await property.click()
  await page.getByRole('dialog').waitFor()
  await shot('net-worth-category-dark-1440')
  const house = wealth.components.find(
    (c) => c.source === 'ASSET' && c.category === 'REAL_ESTATE',
  )
  await page
    .getByRole('dialog')
    .getByRole('button', { name: new RegExp('^' + house.name) })
    .click()
  await page.getByRole('heading', { name: house.name, exact: true }).waitFor()
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await page.getByText('Momentum', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Cash', exact: true }).click()
  const checking = accountsBefore.find((a) => a.type === 'CHECKING')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: new RegExp('^' + checking.name) })
    .click()
  await page
    .getByRole('heading', { name: checking.name, exact: true })
    .waitFor()
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await page.getByText('Momentum', { exact: true }).waitFor()
  await tabs.getByRole('button', { name: 'Spending', exact: true }).click()
  await page.getByText('Where it went', { exact: true }).waitFor()
  assert.equal(
    new URLSearchParams(page.url().split('?')[1]).get('start'),
    start,
  )
  await page.goBack()
  await page.getByText('Momentum', { exact: true }).waitFor()
  await page.goForward()
  await page.getByText('Where it went', { exact: true }).waitFor()
  // Scope a real account; household Net Worth must still include all components.
  await visit(`dashboard?view=investments&end=${end}&range=3M`)
  await settle()
  const firstAccount =
    data.accounts.find((a) => a.name === 'Income portfolio') || data.accounts[0]
  await page
    .locator('.dashboard-account-row')
    .filter({ hasText: firstAccount.name })
    .click()
  await page
    .getByRole('heading', { name: firstAccount.name, exact: true })
    .waitFor()
  const back = page.getByRole('button', { name: 'Back', exact: true })
  await back.click()
  await page.getByTestId('portfolio-balance').waitFor()
  assert.equal(
    new URLSearchParams(page.url().split('?')[1]).get('account'),
    null,
  )
  await visit(
    `dashboard?view=investments&end=${end}&range=3M&account=${firstAccount.id}`,
  )
  await settle()
  assert.equal(await page.locator('.dashboard-account-row').count(), 1)
  await tabs.getByRole('button', { name: 'Net Worth', exact: true }).click()
  await settle()
  assert.equal(
    new URLSearchParams(page.url().split('?')[1]).get('account'),
    null,
  )
  await page.getByRole('button', { name: 'Cash', exact: true }).waitFor()
  // Actual source holding navigation, retaining date/scope on return.
  await visit(`dashboard?view=investments&end=${end}&range=3M`)
  await settle()
  await page
    .getByRole('button', { name: /SIM-GLOBAL-ETF/ })
    .first()
    .click()
  await page
    .getByRole('heading', { name: 'SIM-GLOBAL-ETF', exact: true })
    .first()
    .waitFor()
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await page.getByTestId('portfolio-balance').waitFor()
  // Desktop/tablet/phone, both themes, no horizontal document overflow.
  for (const theme of ['Dark', 'Light']) {
    await visit('settings?view=appearance')
    await page.getByRole('button', { name: theme, exact: true }).click()
    await page
      .getByLabel('Font family', { exact: true })
      .selectOption(theme === 'Light' ? 'inter' : 'mono')
    for (const width of [1440, 1920, 1280, 834, 390]) {
      await page.setViewportSize({ width, height: width === 1920 ? 1080 : 900 })
      for (const view of ['investments', 'net-worth']) {
        await visit(`dashboard?view=${view}&end=${end}&range=YTD`)
        await settle()
        if (width === 390) {
          const nav = await tabs.boundingBox()
          for (const name of ['Spending', 'Investments', 'Net Worth']) {
            const button = await tabs
              .getByRole('button', { name, exact: true })
              .boundingBox()
            assert(
              button.x >= nav.x - 1 &&
                button.x + button.width <= nav.x + nav.width + 1,
              `${name} must remain visible in the phone dashboard tabs`,
            )
          }
        }
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          `${view} overflow at ${width}`,
        )
        await shot(`${view}-${theme.toLowerCase()}-${width}`)
      }
    }
  }
  await checkIncomePortfolio(page, origin, output)
  assert.deepEqual(
    await get('/accounts'),
    accountsBefore,
    'Read-only dashboard must not post money',
  )
  await writeFile(
    path.join(output, 'financial-check.json'),
    JSON.stringify(
      {
        ending_value: data.performance.ending_value,
        account_values: data.accounts.map((a) => ({
          id: a.id,
          value: a.value,
          gain: a.gain,
          twr: a.twr,
        })),
        net_worth: wealth.value,
        assets: wealth.assets,
        liabilities: wealth.liabilities,
        drivers: wealth.insights.velocity.drivers,
        momentum: wealth.insights.momentum,
        normal_database_accessed: false,
      },
      null,
      2,
    ),
  )
  for (const [source, target] of [
    [
      'parity-reference-investments-dashboard-dark.png',
      'reference-investments-dark-1440.png',
    ],
    [
      'parity-reference-networth-dashboard-dark.png',
      'reference-net-worth-dark-1440.png',
    ],
    ['v014-networth-reference.png', 'reference-net-worth-light-1440.png'],
  ])
    await copyFile(path.join(root, '.tmp', source), path.join(output, target))
  await writeFile(
    path.join(output, 'index.html'),
    `<!doctype html><meta charset="utf-8"><title>Dashboard source comparison</title><style>body{background:#151515;color:#eee;font:14px system-ui;margin:24px}section{display:grid;grid-template-columns:1fr 1fr;gap:16px}img{width:100%}p{max-width:1000px}</style><h1>Dashboard source migration</h1><p>Official cached references at native 1440×900; application adapted from pinned source 92b4647. Public reference screenshots may represent an earlier revision. Financial amounts, exact two-decimal formatting, Spending-first order and available account scopes differ intentionally. Wider/narrower captures are source-guided layout checks, not matched runtime references.</p>${['investments', 'net-worth'].map((view) => `<h2>${view}</h2><section><figure><figcaption>Official visual fallback · 1440×900</figcaption><img src="reference-${view}-dark-1440.png"></figure><figure><figcaption>Finance Tracker · 1440×900</figcaption><img src="${view}-dark-1440.png"></figure></section>`).join('')}<h2>Net Worth - light</h2><section><figure><figcaption>Official light reference - 1440x900</figcaption><img src="reference-net-worth-light-1440.png"></figure><figure><figcaption>Finance Tracker light - 1440x900</figcaption><img src="net-worth-light-1440.png"></figure></section>`,
  )
}
