// Real browser + API + migrated SQLite. Never runs against an existing server/workspace.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { chromium } from 'playwright'
import { checkAppearance } from './appearance-e2e.mjs'
import { checkFixedIncome } from './fixed-income-e2e.mjs'
import { checkParity } from './parity-e2e.mjs'
import { checkGoals } from './goals-e2e.mjs'
import { checkTypography } from './typography-e2e.mjs'
import { checkRealMarket } from './real-market-e2e.mjs'
import { checkThemes } from './themes-e2e.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const port = process.env.DEMO_E2E_PORT || '8001'
assert(
  ['8001', '5174'].includes(port),
  'Use an approved local demo port: 8001 or 5174',
)
const origin = `http://127.0.0.1:${port}`
try {
  await fetch(`${origin}/api/health`)
  throw new Error(
    `Port ${port} is in use. Choose a free approved port before running isolated E2E.`,
  )
} catch (error) {
  if (!error.cause) throw error
}
await mkdir(path.join(root, '.tmp'), { recursive: true })
const media = process.argv.includes('--screenshots')
const output = path.join(
  root,
  process.argv.includes('--real-market')
    ? '.tmp/real-market-regression-results'
    : process.argv.includes('--typography')
      ? 'docs/screenshots/appearance-options'
      : process.argv.includes('--goals')
        ? 'docs/screenshots/goals-refinement'
        : process.argv.includes('--parity')
          ? 'docs/screenshots/parity-v013'
          : process.argv.includes('--fixed-income')
            ? 'docs/screenshots/fixed-income'
            : process.argv.includes('--appearance')
              ? 'docs/screenshots/v013/after'
              : media
                ? 'docs/screenshots/v012'
                : '.tmp/demo-e2e-results',
)
await mkdir(output, { recursive: true })
const python = path.join(
  root,
  'backend/.venv',
  process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
)
const source = `from pathlib import Path
import tempfile, uvicorn
from app.config import PROJECT_ROOT, get_settings
from app.demo.app import create_demo_app
root = Path(tempfile.mkdtemp(prefix="demo-e2e-", dir=PROJECT_ROOT / ".tmp"))
${
  process.argv.includes('--real-market')
    ? `import app.demo.real_market as market
import app.demo.real_market_snapshot as snapshot
market.load_etfs = lambda: None
snapshot.LOCAL_ETF = root / "no-authorized-export.json"`
    : ''
}
uvicorn.run(create_demo_app(get_settings().resolved_database_path, root, scenario="${process.argv.includes('--real-market-only') ? 'real-market-br' : 'synthetic'}", legacy_fixture=${process.argv.includes('--real-market-only') ? 'False' : 'True'}), host="127.0.0.1", port=${port}, access_log=False)
`
const server = spawn(python, ['-c', source], {
  cwd: path.join(root, 'backend'),
  windowsHide: true,
  stdio: ['ignore', 'ignore', 'pipe'],
})
let serverErrors = ''
server.stderr.on('data', (value) => {
  serverErrors += value.toString()
})
const started = performance.now()
let browser
let page
const timings = {}
try {
  let ready = false
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null) throw new Error(serverErrors)
    try {
      ready = (await fetch(`${origin}/api/runtime`)).ok
    } catch {
      /* Startup in progress. */
    }
    if (ready) break
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  assert(ready, 'Demo startup timed out')
  timings.initialization_ms = Math.round(performance.now() - started)
  browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL || 'msedge',
    headless: true,
  })
  page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    colorScheme: 'dark',
    locale: 'en-US',
  })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('response', (response) => {
    if (response.url().includes('/api/') && response.status() >= 400)
      errors.push(`${response.status()} ${new URL(response.url()).pathname}`)
  })
  page.on('dialog', (dialog) => dialog.accept())
  if (!process.argv.includes('--real-market-only')) {
    await page.goto(origin)
    await page.locator('.demo-menu > summary').click()
    await page.getByRole('button', { name: 'Guided tour', exact: true }).click()
    await page.locator('.demo-menu > summary').click()
    await page.getByRole('button', { name: 'Skip tour' }).click()
    await page.getByRole('button', { name: 'Expand sidebar' }).click()
    async function visit(route, marker) {
      const start = performance.now()
      await page.goto(`${origin}/#/${route}`)
      if (await page.getByRole('button', { name: 'Skip tour' }).count())
        await page.getByRole('button', { name: 'Skip tour' }).click()
      await page
        .getByText(marker, { exact: false })
        .filter({ visible: true })
        .first()
        .waitFor()
      await page.waitForLoadState('networkidle')
      await page.waitForFunction(
        () =>
          !/\b(Loading|Calculating|Reconstructing)\b/.test(
            document.body.innerText,
          ),
      )
      if (['investments', 'performance', 'net-worth'].includes(route))
        await page.locator('.recharts-surface').first().waitFor()
      timings[route] = Math.round(performance.now() - start)
    }
    const views = [
      ['overview', 'Where it went', 'overview'],
      ['accounts', 'Checking', 'accounts'],
      ['transactions', 'Search transactions', 'transactions'],
      ['spending', 'Where it went', 'spending'],
      ['investments', 'Portfolio value', 'investments'],
      ['performance', 'Time-weighted', 'performance'],
      ['investments?view=Allocation', 'Portfolio value', 'allocation'],
      ['net-worth', 'Net Worth', 'net-worth'],
      ['goals', 'Emergency', 'goals'],
      [
        'transactions?view=reconciliation&reconcile=statements',
        'Statements',
        'reconciliation',
      ],
    ]
    for (const [route, marker, filename] of views) {
      await visit(route, marker)
      if (filename === 'reconciliation') {
        await page
          .getByRole('button', { name: /2024-10-31.*completed/i })
          .click()
        await page.getByText(/Exact difference: 0/).waitFor()
      }
      if (route === 'performance') {
        const benchmark = await page
          .getByLabel('Benchmark')
          .locator('option')
          .filter({ hasText: 'DEMOBENCH' })
          .getAttribute('value')
        await page.getByLabel('Benchmark').selectOption(benchmark)
        await page.getByText(/Benchmark return:/).waitFor()
        await page.locator('.recharts-surface').first().waitFor()
      }
      await page.screenshot({
        path: path.join(output, `${filename}.jpg`),
        type: 'jpeg',
        quality: 85,
        fullPage: false,
      })
    }
    await visit('overview', 'Where it went')
    await page.getByRole('button', { name: '1Y', exact: true }).click()
    await page.waitForLoadState('networkidle')
    await page.locator('.daily-bars').waitFor()
    await visit('transactions', 'Search transactions')
    const accountsBefore = await (await fetch(`${origin}/api/accounts`)).json()
    const units = (value) => {
      const [whole, fraction = ''] = value.split('.')
      return BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0'))
    }
    await page.getByRole('button', { name: '+ Add Transaction' }).click()
    await page
      .getByLabel('Account', { exact: true })
      .selectOption({ label: 'Checking (BRL)' })
    await page.getByLabel('Amount', { exact: true }).fill('12.34')
    await page
      .getByLabel('Description', { exact: true })
      .fill('Synthetic E2E purchase')
    await page
      .getByLabel('Category', { exact: true })
      .selectOption({ label: 'Shopping' })
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.getByLabel('Search transactions').fill('Synthetic E2E purchase')
    await page.getByRole('cell', { name: /Synthetic E2E purchase/ }).waitFor()
    const accountsAfterExpense = await (
      await fetch(`${origin}/api/accounts`)
    ).json()
    assert.equal(
      units(accountsBefore.find((a) => a.name === 'Checking').balance) -
        units(accountsAfterExpense.find((a) => a.name === 'Checking').balance),
      12340000n,
    )
    await page
      .getByRole('row')
      .filter({ hasText: 'Synthetic E2E purchase' })
      .getByRole('button', { name: 'Edit', exact: true })
      .click()
    await page
      .getByLabel('Description', { exact: true })
      .fill('Synthetic E2E purchase edited')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page
      .getByRole('cell', { name: /Synthetic E2E purchase edited/ })
      .waitFor()
    const accountsAfterEdit = await (
      await fetch(`${origin}/api/accounts`)
    ).json()
    assert.equal(
      accountsAfterEdit.find((a) => a.name === 'Checking').balance,
      accountsAfterExpense.find((a) => a.name === 'Checking').balance,
    )
    await page.getByLabel('Search transactions').fill('')
    const runtime = await (await fetch(`${origin}/api/runtime`)).json()
    const reporting = async () =>
      (
        await (
          await fetch(
            `${origin}/api/dashboard?month=${runtime.end_date.slice(0, 7)}`,
          )
        ).json()
      ).totals.find((row) => row.currency === 'BRL')
    const beforeTransfer = await reporting()
    await page.getByRole('button', { name: '+ Add Transaction' }).click()
    await page
      .getByLabel('Transaction type', { exact: true })
      .selectOption('TRANSFER')
    await page
      .getByLabel('From account', { exact: true })
      .selectOption({ label: 'Checking (BRL)' })
    await page
      .getByLabel('To account', { exact: true })
      .selectOption({ label: 'Savings (BRL)' })
    await page.getByLabel('Amount', { exact: true }).fill('25')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.getByRole('button', { name: '+ Add Transaction' }).waitFor()
    const accountsAfterTransfer = await (
      await fetch(`${origin}/api/accounts`)
    ).json()
    assert.equal(
      units(accountsAfterTransfer.find((a) => a.name === 'Savings').balance) -
        units(accountsBefore.find((a) => a.name === 'Savings').balance),
      25000000n,
    )
    const afterTransfer = await reporting()
    assert.equal(
      units(afterTransfer.income),
      units(beforeTransfer.income),
      'Transfers must not count as income',
    )
    assert.equal(
      units(afterTransfer.expenses),
      units(beforeTransfer.expenses),
      'Transfers must not count as spending',
    )
    await page
      .getByRole('button', { name: '+ Add Transaction', exact: true })
      .click()
    await page
      .getByLabel('Transaction type', { exact: true })
      .selectOption('INCOME')
    await page
      .getByLabel('Account', { exact: true })
      .selectOption({ label: 'Checking (BRL)' })
    await page.getByLabel('Amount', { exact: true }).fill('50')
    await page
      .getByLabel('Description', { exact: true })
      .fill('Synthetic E2E income')
    await page
      .getByLabel('Category', { exact: true })
      .selectOption({ label: 'Salary' })
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page
      .getByRole('button', { name: '+ Add Transaction', exact: true })
      .waitFor()
    const afterIncome = await reporting()
    assert.equal(
      units(afterIncome.income) - units(afterTransfer.income),
      50000000n,
    )
    assert.equal(units(afterIncome.expenses), units(afterTransfer.expenses))
    const accountsAfterIncome = await (
      await fetch(`${origin}/api/accounts`)
    ).json()
    assert.equal(
      units(accountsAfterIncome.find((a) => a.name === 'Checking').balance) -
        units(accountsAfterTransfer.find((a) => a.name === 'Checking').balance),
      50000000n,
    )
    await visit('settings?view=gmail', 'Gmail Notification Simulation')
    await page
      .getByRole('button', { name: 'Simulate Gmail notification' })
      .click()
    await page.getByRole('button', { name: 'Review notification' }).click()
    await page.getByLabel(/I confirm this statement/).check()
    await page.getByRole('button', { name: 'Confirm import' }).click()
    await page.waitForLoadState('networkidle')
    await visit('settings?view=gmail', 'Gmail Notification Simulation')
    await page
      .getByRole('button', { name: 'Preview demo-checking.ofx' })
      .click()
    await page
      .getByText(/EXACT_DUPLICATE|Exact duplicate|exact duplicate/)
      .first()
      .waitFor()
    await visit('settings?view=gmail', 'Gmail Notification Simulation')
    await page
      .getByRole('button', { name: 'Preview demo-checking.csv' })
      .click()
    for (const row of [1, 3]) {
      await page
        .getByRole('button', { name: `Review row ${row}`, exact: true })
        .click()
      await page.getByLabel('Row action').selectOption('LINK')
      if (row === 1) {
        const target = await page
          .getByLabel('Existing transaction', { exact: true })
          .inputValue()
        await page.screenshot({
          path: path.join(output, 'import-inspector-desktop.jpg'),
          quality: 85,
        })
        await page.setViewportSize({ width: 390, height: 844 })
        assert.equal(await page.getByLabel('Row action').inputValue(), 'LINK')
        assert.equal(
          await page
            .getByLabel('Existing transaction', { exact: true })
            .inputValue(),
          target,
        )
        await page.screenshot({
          path: path.join(output, 'import-inspector-mobile.jpg'),
          quality: 85,
        })
        await page.setViewportSize({ width: 1440, height: 1000 })
      }
      await page
        .getByRole('button', { name: 'Save row decision', exact: true })
        .click()
      await page
        .getByRole('button', { name: 'Close review', exact: true })
        .click()
      await page.getByLabel('Row action').waitFor({ state: 'hidden' })
    }
    await page.getByLabel(/I confirm this statement/).check()
    await page.getByRole('button', { name: 'Confirm import' }).click()
    await page.getByText(/Import summary/).waitFor()
    await visit('settings?view=rules', 'Rules')
    await page.getByRole('button', { name: 'Preview history' }).first().click()
    await page.getByText(/Rule preview . no changes saved/).waitFor()
    await visit('spending?view=Budgets', 'Spending')
    await page
      .getByRole('button', { name: 'Edit target Groceries', exact: true })
      .click()
    await page.getByLabel('Target amount (BRL)').fill('1050')
    await page.getByRole('button', { name: 'Save target', exact: true }).click()
    await page.getByLabel('Target amount (BRL)').waitFor({ state: 'hidden' })
    await visit('goals', 'Emergency')
    await page.getByRole('button', { name: /Emergency/ }).click()
    await page.getByRole('button', { name: 'Edit goal', exact: true }).click()
    await page.getByLabel('Goal name').fill('Synthetic E2E emergency goal')
    await page
      .locator('form')
      .filter({ has: page.getByLabel('Goal name') })
      .getByRole('button', { name: 'Save', exact: true })
      .click()
    await page.getByLabel('Goal name').waitFor({ state: 'hidden' })
    await visit('settings?view=categories', 'Categories')
    await page
      .getByRole('button', { name: 'Add category', exact: true })
      .click()
    await page.getByLabel('Category name').fill('Synthetic E2E category')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.getByText('Synthetic E2E category', { exact: true }).waitFor()
    const startReset = performance.now()
    await page.locator('.demo-menu > summary').click()
    await page.getByRole('button', { name: 'Reset demo', exact: true }).click()
    await page
      .getByRole('heading', { name: 'Where it went', exact: true })
      .waitFor()
    timings.reset_ms = Math.round(performance.now() - startReset)
    const categories = await (await fetch(`${origin}/api/categories`)).json()
    assert(!categories.some((row) => row.name === 'Synthetic E2E category'))
    const rows = await (
      await fetch(
        `${origin}/api/transactions?search=Synthetic%20E2E%20purchase`,
      )
    ).json()
    assert.equal(rows.length, 0)
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.locator('.daily-bars').waitFor()
    await page.screenshot({
      path: path.join(output, 'overview-wide.jpg'),
      quality: 85,
    })
    await page.setViewportSize({ width: 1280, height: 900 })
    for (const [route, marker, filename] of views) {
      await visit(route, marker)
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `Unexpected page overflow at 1280px: ${route}`,
      )
      if (route === 'transactions') {
        const table = page.locator('.table-scroll').first()
        assert(
          await table.evaluate((element) => {
            element.scrollLeft = element.scrollWidth
            return (
              element.scrollWidth <= element.clientWidth ||
              element.scrollLeft > 0
            )
          }),
          'Wide ledger must scroll within its container',
        )
        await table.evaluate((element) => {
          element.scrollLeft = 0
        })
      }
      await page.screenshot({
        path: path.join(output, `${filename}-1280.jpg`),
        quality: 85,
      })
    }
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('button', { name: 'Open navigation' }).click()
    await page
      .getByRole('dialog', { name: 'Navigation' })
      .getByRole('button', { name: 'Activities', exact: true })
      .click()
    await page.getByLabel('Search transactions').waitFor()
    await page.screenshot({
      path: path.join(output, 'mobile.jpg'),
      quality: 85,
    })
  }
  if (process.argv.includes('--themes')) await checkThemes(page, origin, root)
  if (process.argv.includes('--appearance'))
    await checkAppearance(page, origin, output, root)
  if (process.argv.includes('--fixed-income'))
    await checkFixedIncome(page, origin, output)
  if (process.argv.includes('--parity')) await checkParity(page, origin, output)
  if (process.argv.includes('--goals')) await checkGoals(page, origin, output)
  if (process.argv.includes('--typography'))
    await checkTypography(page, origin, output)
  if (process.argv.includes('--real-market'))
    await checkRealMarket(
      page,
      origin,
      path.join(root, 'docs/screenshots/real-market-demo'),
    )
  assert.deepEqual(errors, [])
  await writeFile(
    path.join(root, '.tmp/demo-e2e-results.json'),
    JSON.stringify(timings, null, 2),
  )
  console.log(
    JSON.stringify({ result: 'PASS', timings, screenshots: output }, null, 2),
  )
} catch (error) {
  // This runner owns a synthetic workspace; never attach saved demo databases.
  await writeFile(
    path.join(output, 'failure.json'),
    JSON.stringify({ error: String(error), timings }, null, 2),
  )
  await page
    ?.screenshot({ path: path.join(output, 'failure.jpg'), quality: 85 })
    .catch(() => {})
  throw error
} finally {
  try {
    await writeFile(path.join(output, 'server.log'), serverErrors)
    await browser?.close()
  } finally {
    server.kill()
  }
}
