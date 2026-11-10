import assert from 'node:assert/strict'
import { mkdir, writeFile, copyFile } from 'node:fs/promises'
import path from 'node:path'
export async function checkSpendingMigration(page, origin, root) {
  page.on('pageerror', (error) =>
    console.error('Spending browser error:', error.message),
  )
  const output = path.join(root, 'docs/screenshots/v014-spending-budgets')
  await mkdir(output, { recursive: true })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const before = await (await page.request.get(origin + '/api/accounts')).json()
  const balances = before.map((row) => [row.id, row.balance])
  const reports = await (
    await page.request.get(
      origin +
        '/api/spending/workspace?date_from=2026-09-01&date_to=2026-10-01&as_of=2026-09-30&currency=BRL',
    )
  ).json()
  assert.notEqual(reports.current.expenses, '0.000000')
  assert.notEqual(reports.current.income, '0.000000')
  const visit = async (route, marker) => {
    await page.goto(origin + '/#/' + route)
    await page
      .getByText(marker, { exact: true })
      .filter({ visible: true })
      .first()
      .waitFor({ timeout: 60000 })
    await page.evaluate(() => {
      window.scrollTo(0, 0)
      document
        .querySelectorAll('[data-page-scroll-container], main')
        .forEach((element) => {
          element.scrollTop = 0
        })
    })
    await page.waitForTimeout(350)
  }
  const shot = async (name) =>
    page.screenshot({ path: path.join(output, name + '.png') })
  await page.setViewportSize({ width: 1440, height: 900 })
  await visit(
    'dashboard?view=spending&start=2026-09-01&end=2026-09-30',
    'Where it went',
  )
  await page.locator('.wf-spending .recharts-bar-rectangle').first().waitFor()
  await shot('overview-dark-1440')
  await page.getByRole('checkbox', { name: 'Group categories' }).uncheck()
  const category = page.getByRole('link', { name: /Groceries/ }).first()
  await category.click()
  await page.getByLabel('Search transactions').waitFor()
  assert(
    new URL('http://local/' + page.url().split('#')[1]).searchParams.has(
      'category_id',
    ),
  )
  await visit(
    'dashboard?view=spending&start=2026-09-01&end=2026-09-30',
    'Where it went',
  )
  await page.getByRole('button', { name: 'Map', exact: true }).click()
  await page.locator('.wf-spending svg g[role=button]').first().waitFor()
  await shot('map-dark-1440')
  await page.getByRole('button', { name: 'Select dates' }).click()
  await page.locator('[data-slot=popover-content]').first().waitFor()
  await shot('date-picker-dark-1440')
  await page.keyboard.press('Escape')
  await visit('dashboard?view=spending&detail=budget&month=2026-09', 'Budget')
  await page.getByRole('button', { name: 'Expand group' }).first().click()
  await page.getByRole('button', { name: 'Row options' }).first().click()
  await page
    .getByRole('menuitem', { name: 'Target details & appearance' })
    .click()
  await page.getByRole('dialog').waitFor()
  await shot('target-detail-dark-1440')
  await page.getByLabel('Target amount (BRL)').fill('987.123456')
  await page.getByRole('button', { name: 'Save target', exact: true }).click()
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  const editor = await (
    await page.request.get(
      origin +
        '/api/budgets/workspace?month=2026-09&as_of=2026-09-30&currency=BRL',
    )
  ).json()
  assert(editor.overrides.some((row) => row.amount === '987.123456'))
  await shot('budget-dark-1440')
  await page.getByRole('button', { name: 'Defaults', exact: true }).click()
  await page
    .getByText('Default monthly plan', { exact: true })
    .first()
    .waitFor()
  await shot('defaults-dark-1440')
  for (const stage of ['where', 'changed', 'when']) {
    await visit(
      'dashboard?view=spending&detail=insights&stage=' +
        stage +
        '&start=2026-09-01&end=2026-09-30',
      'Spending Insight',
    )
    if (stage === 'where') {
      const flow = page.locator('.wf-spending .recharts-sankey-nodes')
      await flow.waitFor()
      const labels = await flow.evaluate((element) => {
        const svg = element.closest('svg')
        const bounds = svg.getBoundingClientRect()
        const texts = [...svg.querySelectorAll('text')]
        return {
          count: texts.length,
          fontSize: getComputedStyle(texts[0]).fontSize,
          clipped: texts.filter((text) => {
            const box = text.getBoundingClientRect()
            return box.left < bounds.left - 2 || box.right > bounds.right + 2
          }).length,
        }
      })
      assert(labels.count > 0)
      assert.equal(
        labels.fontSize,
        '11px',
        'Source metadata typography must be generated',
      )
      assert.equal(
        labels.clipped,
        0,
        'Sankey names and exact values must fit chart gutters',
      )
    }
    await shot(stage + '-dark-1440')
  }
  await page.getByRole('button', { name: 'Add event', exact: true }).click()
  await page.getByRole('dialog').waitFor()
  await page.getByLabel('Event name').fill('Browser course')
  // The seeded unclassified bicycle repair on September 8 is not already
  // associated with another event. Exercise linking rather than an empty range.
  await page.getByLabel('Start date').fill('2026-09-08')
  await page.getByLabel('End date').fill('2026-09-10')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  const events = await (
    await page.request.get(origin + '/api/life-events?as_of=2026-09-30')
  ).json()
  assert(events.some((row) => row.event.name === 'Browser course'))
  await page
    .getByRole('button', { name: 'Browser course', exact: true })
    .click()
  await page
    .getByRole('button', {
      name: 'Tag transactions in this period',
      exact: true,
    })
    .click()
  const candidate = page
    .locator('.event-linker input[type=checkbox]:not(:disabled)')
    .first()
  await candidate.check()
  await page.getByRole('button', { name: /Link selected/ }).click()
  await page.waitForFunction(() =>
    document.querySelector('.event-inline-detail table tbody tr'),
  )
  await page
    .locator('.event-inline-detail')
    .evaluate((element) => element.scrollIntoView({ block: 'start' }))
  await shot('event-detail-dark-1440')
  const linkedEvents = await (
    await page.request.get(origin + '/api/life-events?as_of=2026-09-30')
  ).json()
  assert(
    linkedEvents.find((row) => row.event.name === 'Browser course').linked_ids
      .length === 1,
  )
  await page
    .locator('.event-inline-detail')
    .getByRole('button', { name: 'Remove association', exact: true })
    .click()
  await page.waitForFunction(
    () => !document.querySelector('.event-inline-detail table tbody tr'),
  )
  await page.getByRole('button', { name: 'Edit event', exact: true }).click()
  const edit = page.getByRole('dialog')
  await edit.getByLabel('Event name').fill('Browser course updated')
  await edit.getByRole('button', { name: 'Save', exact: true }).click()
  await edit.waitFor({ state: 'hidden' })
  await page.getByRole('button', { name: 'Delete event', exact: true }).click()
  await page.locator('.event-inline-detail').waitFor({ state: 'hidden' })
  const remainingEvents = await (
    await page.request.get(origin + '/api/life-events?as_of=2026-09-30')
  ).json()
  assert(
    !remainingEvents.some(
      (row) =>
        row.event.id ===
        events.find((row) => row.event.name === 'Browser course').event.id,
    ),
  )
  for (const width of [1920, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: width === 1920 ? 1080 : 900 })
    for (const [route, name, marker] of [
      ['dashboard?view=spending', 'overview', 'Where it went'],
      [
        'dashboard?view=spending&detail=budget&month=2026-09',
        'budget',
        'Budget',
      ],
      [
        'dashboard?view=spending&detail=insights&stage=when',
        'events',
        'Spending Insight',
      ],
    ]) {
      await visit(route, marker)
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        'Page overflow at ' + width + ': ' + name,
      )
      await shot(name + '-dark-' + width)
    }
  }
  await page
    .getByRole('button', { name: 'Open navigation', exact: true })
    .click()
  const navigation = page.locator('#mobile-navigation')
  await navigation.waitFor({ state: 'visible' })
  await shot('navigation-dark-390')
  await navigation
    .getByRole('button', { name: 'Dashboard', exact: true })
    .click()
  await navigation.waitFor({ state: 'hidden' })
  await page.getByText('Where it went', { exact: true }).waitFor()
  await page.setViewportSize({ width: 1440, height: 900 })
  // Existing appearance UI is the only persisted preference surface.
  await page.goto(origin + '/#/settings?view=appearance')
  await page.locator('.appearance-settings').waitFor()
  const light = page.getByRole('button', { name: /^Light$/ })
  await light.click()
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === 'light',
  )
  await visit('dashboard?view=spending', 'Where it went')
  await shot('overview-light-1440')
  await visit('dashboard?view=spending&detail=budget&month=2026-09', 'Budget')
  await shot('budget-light-1440')
  const after = await (await page.request.get(origin + '/api/accounts')).json()
  assert.deepEqual(
    after.map((row) => [row.id, row.balance]),
    balances,
    'Metadata/target/event edits must not change ledger balances',
  )
  for (const [file, dest] of [
    [
      '.tmp/parity-reference-spending-spending-overview-dark.png',
      'reference-overview-dark-1440.png',
    ],
    [
      '.tmp/parity-reference-spending-spending-insights-dark.png',
      'reference-insights-dark-1440.png',
    ],
    [
      '.tmp/v014-reference-spending-budget.png',
      'reference-budget-light-1440.png',
    ],
  ])
    await copyFile(path.join(root, file), path.join(output, dest))
  await writeFile(
    path.join(output, 'validation.json'),
    JSON.stringify(
      {
        status: 'PASS',
        viewport: '1440x900 paired; 1920/1024/768/390 layout checks',
        reports,
        balancesUnchanged: true,
        checks: [
          'category drilldown',
          'map',
          'custom picker',
          'exact target override',
          'default setup',
          'three insight stages',
          'event create',
          'event edit/link/unlink/delete',
          'Sankey exact labels and font/gutter bounds',
          'responsive overflow',
          'mobile drawer navigation',
          'light/dark',
        ],
      },
      null,
      2,
    ),
  )
  await writeFile(
    path.join(output, 'index.html'),
    `<!doctype html><html lang="en"><meta charset="utf-8"><title>Spending migration comparison</title><style>body{background:#181818;color:#ddd;font:15px system-ui}section{display:grid;grid-template-columns:1fr 1fr;gap:16px}img{width:100%}h1,h2{font-weight:500}</style><h1>Spending v0.14</h1><p>Cached official screenshots (may predate pinned source) alongside Finance Tracker at 1440×900. This does not claim a running upstream runtime. Different data and approved feature boundaries are expected.</p><h2>Overview dark</h2><section><img src="reference-overview-dark-1440.png"><img src="overview-dark-1440.png"></section><h2>Budget light</h2><section><img src="reference-budget-light-1440.png"><img src="budget-light-1440.png"></section><h2>Insights dark</h2><section><img src="reference-insights-dark-1440.png"><img src="where-dark-1440.png"></section></html>`,
  )
}
