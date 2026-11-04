// Isolated synthetic workspace; never attaches to a running user database.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { chromium } from 'playwright'
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
const output = path.join(root, 'docs/screenshots/ux-redesign-shell')
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
uvicorn.run(create_demo_app(get_settings().resolved_database_path, root, scenario="synthetic", legacy_fixture=True), host="127.0.0.1", port=${port}, access_log=False)
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

let browser
try {
  let ready = false
  for (let i = 0; i < 180; i++) {
    if (server.exitCode !== null) throw new Error(serverErrors)
    try {
      ready = (await fetch(origin + '/api/runtime')).ok
    } catch {}
    if (ready) break
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  assert(ready, 'Isolated demo startup timed out')
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
    colorScheme: 'dark',
  })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(origin)
  await page.getByRole('heading', { name: 'Where it went' }).waitFor()
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  assert.equal(
    await page
      .locator('.desktop-sidebar')
      .evaluate((el) => el.getBoundingClientRect().width),
    70,
  )
  const nav = page.locator('.desktop-sidebar nav')
  for (const name of [
    'Dashboard',
    'Accounts',
    'Activities',
    'Holdings',
    'Insights',
    'Goals',
    'Settings',
  ])
    assert.equal(
      await nav.getByRole('button', { name, exact: true }).count(),
      1,
    )
  assert.equal(
    await nav.getByRole('button', { name: 'Transfers', exact: true }).count(),
    0,
  )
  assert.equal(await page.locator('.daily-bars button').count(), 30)
  assert(
    await page
      .locator('.daily-bars button > span')
      .evaluateAll((nodes) =>
        nodes.some((el) => el.getBoundingClientRect().height > 10),
      ),
  )
  await page.screenshot({ path: path.join(output, 'spending-1440.png') })
  const measurements = await page
    .locator(
      '.desktop-sidebar,.spending-headline,.spending-hero,.spending-periods,.spending-columns',
    )
    .evaluateAll((nodes) =>
      nodes.map((el) => ({
        selector: el.className,
        x: el.getBoundingClientRect().x,
        y: el.getBoundingClientRect().y,
        width: el.getBoundingClientRect().width,
        height: el.getBoundingClientRect().height,
      })),
    )
  assert(await page.locator('.budget-actual-line').getAttribute('d'))
  const measureDetails = async (screen, selectors) => {
    const bounds = await page.locator(selectors).evaluateAll((nodes) =>
      nodes.map((el) => ({
        selector: el.className,
        x: el.getBoundingClientRect().x,
        y: el.getBoundingClientRect().y,
        width: el.getBoundingClientRect().width,
        height: el.getBoundingClientRect().height,
      })),
    )
    measurements.push(
      ...bounds.map((bound) => ({
        screen,
        viewport: page.viewportSize().width,
        ...bound,
      })),
    )
  }
  await page.locator('.daily-bars button').nth(4).focus()
  await page.getByRole('tooltip').waitFor()
  assert(
    (await page.getByRole('tooltip').innerText()).includes('Daily average'),
  )
  await page.screenshot({
    path: path.join(output, 'spending-tooltip-1440.png'),
  })
  await page.keyboard.press('Escape')
  assert.equal(await page.getByRole('tooltip').count(), 0)
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.screenshot({ path: path.join(output, 'spending-1920.png') })
  await page.getByRole('button', { name: 'Last month', exact: true }).click()
  await page.waitForLoadState('networkidle')
  assert(page.url().includes('start=2026-08-01'))
  await page.getByRole('button', { name: '3M', exact: true }).click()
  await page.waitForLoadState('networkidle')
  await page.waitForFunction(
    () => document.querySelectorAll('.daily-bars button').length === 92,
  )
  assert.equal(await page.locator('.daily-bars button').count(), 92)
  const periodUrl = page.url()
  await page
    .getByRole('button', { name: 'Previous month', exact: true })
    .click()
  await page.waitForLoadState('networkidle')
  assert.equal(
    new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('start'),
    new URLSearchParams(new URL(periodUrl).hash.split('?')[1]).get('start'),
  )
  await page.getByRole('heading', { name: 'Where it went' }).waitFor()
  await page.getByRole('button', { name: /Manage/ }).click()
  await page
    .getByRole('heading', { name: 'Spending & Budgets', exact: true })
    .waitFor()
  await page
    .getByRole('button', { name: 'Back to Spending', exact: true })
    .click()
  await page.setViewportSize({ width: 390, height: 844 })
  await page
    .getByRole('button', { name: 'Open navigation', exact: true })
    .click()
  await page
    .getByRole('dialog', { name: 'Navigation', exact: true })
    .getByRole('button', { name: 'Activities', exact: true })
    .click()
  await page
    .getByRole('heading', { name: 'Transactions', exact: true })
    .waitFor()
  await page
    .getByRole('button', { name: '+ Add Transaction', exact: true })
    .click()
  await page
    .getByLabel('Transaction type', { exact: true })
    .selectOption('TRANSFER')
  assert(await page.getByLabel('From account', { exact: true }).isVisible())
  page.once('dialog', (dialog) => dialog.accept())
  await page.keyboard.press('Escape')
  await page
    .getByRole('button', { name: 'Open navigation', exact: true })
    .click()
  await page
    .getByRole('dialog', { name: 'Navigation', exact: true })
    .getByRole('button', { name: 'Dashboard', exact: true })
    .click()
  await page.getByRole('heading', { name: 'Where it went' }).waitFor()
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: path.join(output, 'spending-390.png') })
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  )
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('button', { name: 'Map', exact: true }).click()
  await page
    .locator('.spending-columns .composition-visual .recharts-surface rect')
    .first()
    .waitFor()
  await page.screenshot({ path: path.join(output, 'spending-map-1440.png') })
  await page.getByRole('button', { name: 'List', exact: true }).click()
  await page.getByLabel('Group categories', { exact: true }).check()
  assert((await page.locator('.spending-category-list small').count()) > 0)
  await page.getByLabel('Group categories', { exact: true }).uncheck()
  await page.goto(
    `${origin}/#/dashboard?view=spending&detail=insights&stage=where&month=2026-09&currency=BRL`,
  )
  await page
    .getByRole('heading', { name: 'Spending plan', exact: true })
    .waitFor()
  await page.waitForLoadState('networkidle')
  measurements.push(
    ...(await page
      .locator(
        '.spending-insights-page .page-header,.spending-insights-page > .section-navigation,.spending-insight-summary,.income-flow-strip,.position-plan,.position-plan thead,.position-plan tbody tr,.plan-filters',
      )
      .evaluateAll((nodes) =>
        nodes.map((el) => ({
          selector: el.className,
          x: el.getBoundingClientRect().x,
          y: el.getBoundingClientRect().y,
          width: el.getBoundingClientRect().width,
          height: el.getBoundingClientRect().height,
        })),
      )),
  )
  await page.screenshot({ path: path.join(output, 'insights-1440.png') })
  await page.getByRole('button', { name: 'What changed', exact: true }).click()
  assert(page.url().includes('stage=changed'))
  await page.getByRole('heading', { name: 'Top payees', exact: true }).waitFor()
  await page.getByRole('button', { name: 'When & where', exact: true }).click()
  await page.locator('.event-desktop-lanes .event-band').first().click()
  await page.locator('.event-inline-detail').waitFor()
  assert.equal(await page.getByRole('dialog').count(), 0)
  assert(page.url().includes('event='))
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: path.join(output, 'events-1440.png') })
  await page
    .locator('.event-inline-detail')
    .getByRole('button', { name: 'Edit', exact: true })
    .click()
  await page.getByRole('dialog').waitFor()
  await page.keyboard.press('Escape')
  assert.equal(await page.getByRole('dialog').count(), 0)
  assert(await page.locator('.event-inline-detail').isVisible())
  await page.reload()
  await page.locator('.event-inline-detail').waitFor()
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.screenshot({ path: path.join(output, 'events-1920.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  assert(await page.locator('.event-calendar').isVisible())
  assert(!(await page.locator('.event-desktop-lanes').isVisible()))
  await page.screenshot({ path: path.join(output, 'events-390.png') })
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  )
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${origin}/#/dashboard?view=investments`)
  await page.waitForFunction(() =>
    document
      .querySelector('.investment-hero-value')
      ?.textContent?.includes('R$'),
  )
  await page.waitForLoadState('networkidle')
  assert((await page.locator('.investment-hero .recharts-area').count()) > 0)
  await page.screenshot({ path: path.join(output, 'investments-1440.png') })
  await page
    .locator('.investment-hero-ranges')
    .getByRole('button', { name: '1M', exact: true })
    .click()
  assert(page.url().includes('range=1M'))
  await page.waitForLoadState('networkidle')
  await page.reload()
  await page
    .locator('.investment-hero-ranges')
    .getByRole('button', { name: '1M', exact: true })
    .waitFor()
  assert.equal(
    await page
      .locator('.investment-hero-ranges')
      .getByRole('button', { name: '1M', exact: true })
      .getAttribute('aria-pressed'),
    'true',
  )
  await page
    .locator('.investment-hero-ranges')
    .getByRole('button', { name: '3M', exact: true })
    .click()
  await page.waitForLoadState('networkidle')
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.screenshot({ path: path.join(output, 'investments-1920.png') })
  assert.equal(await page.locator('.portfolio-holding-row').count(), 5)
  const scope = await page
    .getByLabel('Portfolio account', { exact: true })
    .locator('option')
    .nth(1)
    .getAttribute('value')
  await page
    .getByLabel('Portfolio account', { exact: true })
    .selectOption(scope)
  await page.getByLabel('Valuation as of', { exact: true }).fill('2026-08-31')
  await page.waitForLoadState('networkidle')
  assert(page.url().includes('end=2026-08-31'))
  await page.reload()
  await page.getByLabel('Portfolio account', { exact: true }).waitFor()
  assert.equal(
    await page.getByLabel('Portfolio account', { exact: true }).inputValue(),
    scope,
  )
  assert.equal(
    await page.getByLabel('Valuation as of', { exact: true }).inputValue(),
    '2026-08-31',
  )
  await page.waitForLoadState('networkidle')
  const holding = page.locator('.portfolio-holding-row').first()
  await holding.click()
  assert(page.url().includes('/holdings?'))
  assert(page.url().includes('asset='))
  await page.reload()
  await page
    .getByRole('heading', { name: 'Position across accounts', exact: true })
    .waitFor()
    .catch(async () => {
      // Fixed-income contracts have a specialized detail instead of equity position rows.
      assert((await page.locator('.fixed-income-workspace').count()) > 0)
    })
  for (const [name, route, selector] of [
    ['portfolio-insights', '/insights?view=overview', '.analytics-allocation'],
    ['performance', '/insights?view=performance', '.analytics-performance'],
    ['income', '/insights?view=income', '.income-summary-strip'],
    ['net-worth', '/dashboard?view=net-worth', '.overview-balance'],
    ['goals', '/goals', '.goal-visual-grid'],
    ['settings', '/settings?view=categories', '.settings-groups'],
    ['activities', '/activities?view=transactions', '.activity-navigation'],
    [
      'investment-activity',
      '/activities?view=investment-activity',
      '.activity-navigation',
    ],
  ]) {
    await page.goto(`${origin}/#${route}`)
    await page.locator(selector).waitFor()
    await page.waitForLoadState('networkidle')
    if (name === 'income') await page.locator('.recharts-bar').first().waitFor()
    if (name === 'performance')
      await page
        .locator('.analytics-performance .recharts-line')
        .first()
        .waitFor()
    if (name === 'performance') {
      const benchmark = await page
        .getByLabel('Benchmark', { exact: true })
        .locator('option')
        .filter({ hasText: 'DEMOBENCH' })
        .getAttribute('value')
      assert(benchmark, 'Synthetic benchmark must be available')
      await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().includes('/analytics/performance') &&
            response.url().includes('benchmark_id='),
        ),
        page.getByLabel('Benchmark', { exact: true }).selectOption(benchmark),
      ])
      await page.waitForLoadState('networkidle')
      await page.waitForFunction(
        () =>
          document.querySelectorAll('.performance-hero .recharts-line')
            .length === 2,
      )
      assert(page.url().includes('benchmark='))
    }
    if (name === 'portfolio-insights')
      await page.locator('.allocation-summary').waitFor()
    if (name === 'net-worth')
      await page.locator('.recharts-area').first().waitFor()
    // Pages retain semantic exact-data alternatives even if chart coverage is incomplete.
    assert(
      !(await page.locator('main').innerText()).includes('parity:'),
      `${name}: untranslated text`,
    )
    for (const [width, height] of [
      [1440, 900],
      [1920, 1080],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height })
      await page.screenshot({ path: path.join(output, `${name}-${width}.png`) })
      measurements.push(
        ...(await page
          .locator(
            '.desktop-sidebar, .income-summary-strip, .income-visual-grid, .allocation-summary, .exposure-grid, .allocation-composition, .overview-balance, .analytics-performance .balance-chart',
          )
          .evaluateAll(
            (els, context) =>
              els.map((el) => ({
                ...context,
                selector: el.className,
                x: el.getBoundingClientRect().x,
                y: el.getBoundingClientRect().y,
                width: el.getBoundingClientRect().width,
                height: el.getBoundingClientRect().height,
              })),
            { screen: name, viewport: width },
          )),
      )

      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${name}: horizontal overflow at ${width}`,
      )
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${origin}/#/goals`)
  const activeGoal = await page.evaluate(async () =>
    (await (await fetch('/api/goals')).json()).find(
      (g) => g.goal.status === 'ACTIVE',
    ),
  )
  assert(activeGoal, 'Synthetic demo must contain an active goal')
  await page
    .getByRole('button', { name: activeGoal.goal.name, exact: true })
    .first()
    .click()
  await page.locator('.goal-plan').waitFor()
  await page.waitForLoadState('networkidle')
  assert(page.url().includes('goal='))
  for (const [width, height] of [
    [1440, 900],
    [1920, 1080],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height })
    await measureDetails(
      'goal-detail',
      '.goal-detail-page .page-header,.goal-progress-panel,.goal-plan,.goal-plan > aside',
    )
    await page.screenshot({
      path: path.join(output, `goal-detail-${width}.png`),
    })
  }
  await page.reload()
  await page.locator('.goal-plan').waitFor()
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${origin}/#/dashboard?view=net-worth&detail=assets`)
  await page.locator('.finance-wealth-table tbody button').first().click()
  await page.getByRole('navigation', { name: 'Position views' }).waitFor()
  assert.equal(
    await page
      .getByRole('navigation', { name: 'Dashboard', exact: true })
      .count(),
    0,
  )
  await page.waitForLoadState('networkidle')
  assert(page.url().includes('position='))
  await measureDetails(
    'manual-position',
    '.manual-position-page > section > .section-header,.manual-position-overview,.manual-position-overview .balance-chart',
  )
  await page.screenshot({ path: path.join(output, 'manual-position-1440.png') })
  await page.getByRole('button', { name: 'Values', exact: true }).click()
  await page.locator('.finance-wealth-table').waitFor()
  await page.reload()
  await page.getByRole('button', { name: 'Values', exact: true }).waitFor()
  assert.equal(
    await page
      .getByRole('button', { name: 'Values', exact: true })
      .getAttribute('aria-pressed'),
    'true',
  )
  await page.goto(
    `${origin}/#/dashboard?view=spending&detail=insights&stage=changed&start=2026-07-01&end=2026-09-30&insight_range=period`,
  )
  await page.locator('.period-spending-insights').waitFor()
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: path.join(output, 'spending-period-1440.png') })
  await page.goto(`${origin}/#/accounts`)
  await page.getByRole('button', { name: 'Add account', exact: true }).click()
  await page.getByRole('dialog').waitFor()
  const firstInput = page.getByRole('dialog').locator('input').first()
  await firstInput.fill('Synthetic unsaved draft')
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.keyboard.press('Escape')
  assert.equal(await firstInput.inputValue(), 'Synthetic unsaved draft')
  page.once('dialog', (dialog) => dialog.accept())
  await page.keyboard.press('Escape')
  assert.equal(await page.getByRole('dialog').count(), 0)
  const assets = await page.evaluate(
    async () => await (await fetch('/api/investments/assets')).json(),
  )
  const security = assets.find((a) => a.symbol === 'DEMOUP')
  assert(security, 'Synthetic equity holding must exist')
  await page.goto(`${origin}/#/holdings?asset=${security.id}`)
  await page
    .getByRole('heading', { name: 'Position across accounts', exact: true })
    .waitFor()
  await page.waitForLoadState('networkidle')
  await page.locator('.recharts-area').first().waitFor()
  await page.screenshot({ path: path.join(output, 'holding-detail-1440.png') })
  await page.goto(`${origin}/#/holdings?type=fixed-income`)
  await page.locator('.fixed-income-workspace tbody button').first().click()
  await page.locator('.fixed-income-detail').waitFor()
  assert(page.url().includes('contract='))
  await page.reload()
  await page.locator('.fixed-income-detail').waitFor()
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: path.join(output, 'fixed-contract-1440.png') })
  await page
    .getByRole('button', { name: 'Record dated index', exact: true })
    .click()
  await page.getByLabel('Index', { exact: true }).waitFor()
  assert(page.url().includes('/settings?'))
  assert(page.url().includes('contract='))
  await page.goto(
    `${origin}/#/dashboard?view=spending&start=2023-09-01&end=2023-09-30&month=2023-09&currency=BRL`,
  )
  await page.getByText('No spending in this period', { exact: true }).waitFor()
  await page.screenshot({ path: path.join(output, 'spending-empty-1440.png') })
  await page.goto(`${origin}/#/account?account=missing-synthetic-account`)
  await page.getByRole('alert').waitFor()
  await page.screenshot({
    path: path.join(output, 'account-unavailable-1440.png'),
  })
  await page.goto(`${origin}/#/dashboard?view=net-worth&detail=assets`)
  await page.getByRole('button', { name: 'Add asset', exact: true }).click()
  await page
    .getByRole('dialog')
    .getByLabel('Name', { exact: true })
    .fill('Synthetic missing observation')
  await page
    .getByRole('dialog')
    .getByLabel('Category', { exact: true })
    .fill('OTHER')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Save', exact: true })
    .click()
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  await page.goto(`${origin}/#/dashboard?view=net-worth`)
  await page.locator('.coverage-attention').waitFor()
  await page.screenshot({
    path: path.join(output, 'net-worth-missing-1440.png'),
  })
  await page.goto(`${origin}/#/settings?view=appearance`)
  await page.getByRole('button', { name: 'Light', exact: true }).click()
  await page.goto(`${origin}/#/dashboard?view=spending`)
  await page
    .getByRole('heading', { name: 'Where it went', exact: true })
    .waitFor()
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light')
  await page.screenshot({ path: path.join(output, 'spending-light-1440.png') })
  if (process.argv.includes('--motion')) {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.locator('.application-shell[data-motion="full"]').waitFor()
    const sections = page.locator('main > .section-navigation')
    const samples = page.evaluate(
      () =>
        new Promise((resolve) => {
          const frames = []
          const start = performance.now()
          const sample = () => {
            const el = document.querySelector(
              'main > .section-navigation .motion-selection',
            )
            if (el)
              frames.push({
                time: performance.now() - start,
                x: el.getBoundingClientRect().x,
                transform: getComputedStyle(el).transform,
              })
            if (performance.now() - start < 700) requestAnimationFrame(sample)
            else resolve(frames)
          }
          requestAnimationFrame(sample)
        }),
    )
    await sections
      .getByRole('button', { name: 'Investments', exact: true })
      .click()
    const frames = await samples
    assert(
      new Set(frames.map((frame) => Math.round(frame.x))).size > 3,
      'Shared selection must travel through intermediate positions',
    )
    assert(
      frames.some((frame) => frame.transform !== 'none'),
      'Shared selection must use a transform',
    )
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.locator('.application-shell[data-motion="reduced"]').waitFor()
    await sections
      .getByRole('button', { name: 'Spending', exact: true })
      .click()
    await page
      .getByRole('heading', { name: 'Where it went', exact: true })
      .waitFor()
    const transform = await sections
      .locator('.motion-selection')
      .evaluate((el) => getComputedStyle(el).transform)
    assert(
      ['none', 'matrix(1, 0, 0, 1, 0, 0)'].includes(transform),
      'Reduced motion selection must be static',
    )
    await page.goto(`${origin}/#/accounts`)
    await page.getByRole('button', { name: 'Add account', exact: true }).click()
    const editor = page.getByRole('dialog')
    const field = editor.locator('input').first()
    await field.fill('Synthetic motion preference draft')
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.locator('.application-shell[data-motion="full"]').waitFor()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.locator('.application-shell[data-motion="reduced"]').waitFor()
    assert.equal(await field.inputValue(), 'Synthetic motion preference draft')
    page.once('dialog', (dialog) => dialog.accept())
    await page.keyboard.press('Escape')
    await editor.waitFor({ state: 'hidden' })
    await writeFile(
      path.join(root, '.tmp/motion-evidence.json'),
      JSON.stringify(
        { frames, reducedTransform: transform, draftPreserved: true },
        null,
        2,
      ),
    )
    console.log(
      'PASS: spring shared-selection intermediate frames, live reduced motion, static reduced selection and draft preservation.',
    )
  }
  assert.deepEqual(errors, [])
  await writeFile(
    path.join(output, 'measurements.json'),
    JSON.stringify(
      {
        reference:
          'approved official 1440x900 fallback; 1920 source-guided only',
        measurements,
      },
      null,
      2,
    ) + '\n',
  )
  console.log(
    'PASS: isolated demo shell, real charts/ranges, canonical details, grouping, benchmark, settings, draft guards, responsive/light mode and real empty/missing/error states.',
  )
} finally {
  await browser?.close()
  server.kill()
}
