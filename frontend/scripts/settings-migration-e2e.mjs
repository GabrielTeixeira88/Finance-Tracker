// A fresh owned unified demo only. No normal database, token vault or network providers.
import assert from 'node:assert/strict'
import path from 'node:path'
import { mkdir, writeFile, copyFile } from 'node:fs/promises'

export async function checkSettingsMigration(page, origin, root) {
  const output = path.join(root, 'docs/screenshots/v014-settings')
  await mkdir(output, { recursive: true })
  const get = async (route) => {
    const response = await page.request.get(origin + '/api' + route)
    assert(response.ok(), `${route}: ${response.status()}`)
    return response.json()
  }
  const before = await get('/accounts')
  const runtime = await get('/runtime')
  const external = []
  page.on('request', (request) => {
    if (!request.url().startsWith(origin) && !request.url().startsWith('data:'))
      external.push(request.url())
  })
  const preferences = {
    language: 'en',
    font: 'inter',
    mode: 'light',
    palette: 'olive',
  }
  await page.addInitScript((value) => {
    localStorage.setItem(
      'finance-tracker-preferences-demo',
      JSON.stringify(value),
    )
  }, preferences)
  const visit = async (view, title) => {
    await page.goto(`${origin}/#/settings?view=${view}`)
    await page
      .getByRole('heading', { name: title, exact: true, level: 1 })
      .waitFor()
    await page.waitForTimeout(120)
    await page.waitForFunction(
      () =>
        Number(
          getComputedStyle(document.getElementById('main-content')).opacity,
        ) === 1,
    )
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await visit('general', 'General')
  assert.equal(
    await page
      .locator('.source-settings-sidebar')
      .evaluate((node) => Math.round(node.getBoundingClientRect().width)),
    240,
  )
  assert.equal(await page.locator('.source-settings-sidebar a').count(), 12)
  await page.screenshot({ path: path.join(output, 'general-light-1440.png') })
  await visit('appearance', 'Appearance')
  assert.equal(await page.locator('.theme-grid button').count(), 6)
  assert.equal(
    await page
      .getByLabel('Font family', { exact: true })
      .locator('option')
      .count(),
    10,
  )
  await page.getByLabel('Font family', { exact: true }).selectOption('serif')
  assert.equal(await page.locator('html').getAttribute('data-font'), 'serif')
  await page.getByLabel('Font family', { exact: true }).selectOption('inter')
  assert.equal(
    await page
      .locator('.appearance-settings>section')
      .last()
      .getByRole('heading')
      .innerText(),
    'Sidebar order',
  )
  await page.screenshot({
    path: path.join(output, 'appearance-light-1440.png'),
  })
  await visit('accounts', 'Accounts')
  await page
    .getByRole('searchbox', { name: 'Search accounts' })
    .fill('checking')
  await page.getByRole('button', { name: 'Add account', exact: true }).click()
  const accountDialog = page.getByRole('dialog')
  await accountDialog
    .getByLabel('Account name', { exact: true })
    .fill('Fictional Settings browser account')
  // Creation uses the existing form; zero initial history is not an invented opening posting.
  await accountDialog
    .getByRole('button', { name: /create account|save account|save/i })
    .click()
  await accountDialog.waitFor({ state: 'hidden' })
  const afterCreate = await get('/accounts')
  assert.equal(afterCreate.length, before.length + 1)
  const created = afterCreate.find(
    (account) => account.name === 'Fictional Settings browser account',
  )
  assert(created)
  assert.match(created.balance, /^0(?:\.0+)?$/)
  await visit('groups', 'Account groups')
  await page.getByText('Household', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Add account group' }).click()
  const groupDialog = page.getByRole('dialog')
  await groupDialog.getByLabel('Group name').fill('Browser household')
  await groupDialog
    .getByRole('checkbox', { name: /Fictional Settings browser account/ })
    .check()
  await groupDialog.getByRole('button', { name: 'Save', exact: true }).click()
  await groupDialog.waitFor({ state: 'hidden' })
  const groups = await get('/settings/account-groups')
  assert(
    groups.some(
      (group) =>
        group.name === 'Browser household' &&
        group.account_ids.includes(created.id),
    ),
  )
  await page.screenshot({ path: path.join(output, 'groups-light-1440.png') })
  await visit('spending', 'Spending')
  for (const heading of ['Categories', 'Budgets', 'Rules', 'Life Events'])
    assert(
      await page
        .getByRole('heading', { name: heading, exact: true })
        .isVisible(),
    )
  await page
    .getByRole('heading', { name: 'Categories', exact: true })
    .locator('..')
    .getByRole('button', { name: 'Manage' })
    .click()
  await page
    .getByRole('button', { name: 'Add category', exact: true })
    .waitFor()
  await visit('categories', 'Categories')
  await page.getByRole('button', { name: 'Add category', exact: true }).click()
  await page
    .getByLabel('Category name', { exact: true })
    .fill('Fictional browser category')
  await page
    .getByRole('button', { name: /create category|save category|save/i })
    .click()
  await page.getByText('Fictional browser category', { exact: true }).waitFor()
  await visit('payees', 'Payees')
  await page.getByRole('searchbox').fill('Uber')
  await visit('rules', 'Rules')
  await page.getByRole('heading', { name: 'Transaction rules' }).waitFor()
  await visit('securities', 'Securities')
  const assets = await get('/investments/assets')
  const security = assets.find((row) => row.symbol.startsWith('SIM-'))
  assert(security)
  await page.getByRole('searchbox').fill(security.symbol)
  await page
    .getByRole('row')
    .filter({ hasText: security.symbol })
    .first()
    .getByRole('button', { name: 'Edit' })
    .click()
  const securityDialog = page.getByRole('dialog')
  await securityDialog
    .getByLabel('Security name')
    .fill(security.name + ' reviewed')
  await securityDialog
    .getByRole('button', { name: 'Save', exact: true })
    .click()
  assert(
    (await get('/investments/assets')).some(
      (row) => row.id === security.id && row.name.endsWith('reviewed'),
    ),
  )
  await page.screenshot({ path: path.join(output, 'security-light-1440.png') })
  const fixed = await get('/investments/fixed-income?as_of=2026-09-30')
  const cdb = fixed.positions.find(
    (row) => row.contract.instrument_type === 'CDB_CDI',
  )
  assert(cdb)
  await page.goto(
    `${origin}/#/settings?view=securities&security=${cdb.contract.asset_id}`,
  )
  const contractDialog = page.getByRole('dialog')
  await contractDialog
    .getByRole('heading', { name: 'CDB_CDI', exact: true })
    .waitFor()
  assert.equal(
    await contractDialog
      .getByRole('button', { name: /add quote|record price/i })
      .count(),
    0,
  )
  await visit('classifications', 'Classifications')
  await page
    .getByRole('button', { name: 'Spending categories', exact: true })
    .waitFor()
  await visit('exports', 'Backup & export')
  const catalog = await get('/settings/exports')
  for (const dataset of catalog.datasets) {
    const response = await page.request.get(
      `${origin}/api/settings/exports/${dataset}?as_of=2026-09-30`,
    )
    assert(response.ok(), `Export ${dataset} failed: ${response.status()}`)
    const value = await response.json()
    assert(Array.isArray(value.records))
    assert(
      response
        .headers()
        ['cache-control'].split(',')
        .map((value) => value.trim())
        .includes('no-store'),
    )
  }
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download', exact: true }).click()
  const download = await downloadPromise
  assert.equal(
    download.suggestedFilename(),
    'finance-tracker-transactions.json',
  )
  await page.getByRole('tab', { name: 'Local backups' }).click()
  await page.getByRole('note').waitFor()
  await page.screenshot({
    path: path.join(output, 'backup-demo-light-1440.png'),
  })
  for (const view of ['gmail', 'pluggy', 'market']) {
    await visit(
      view,
      view === 'gmail' ? 'Gmail' : view === 'pluggy' ? 'Pluggy' : 'Market data',
    )
    await page.screenshot({ path: path.join(output, `${view}-light-1440.png`) })
  }
  await visit('about', 'About')
  await page.getByText('0.13.0', { exact: true }).waitFor()
  await page.getByRole('link', { name: 'Third-party licenses' }).waitFor()
  assert((await page.request.get(origin + '/licenses/')).ok())
  for (const [width, height] of [
    [1920, 1080],
    [834, 1112],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height })
    await page.goto(origin + '/#/settings?view=index')
    if (width < 1024) {
      await page.locator('.source-settings-sidebar').waitFor()
      assert.equal(await page.locator('.source-settings-content').count(), 0)
      await page.getByRole('link', { name: 'General', exact: true }).click()
      await page
        .getByRole('heading', { name: 'General', exact: true })
        .waitFor()
      await page.getByRole('button', { name: 'Back to Settings' }).click()
      await page.locator('.source-settings-sidebar').waitFor()
      await page.screenshot({
        path: path.join(output, `index-light-${width}.png`),
      })
    }
    await visit('general', 'General')
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    )
    await page.screenshot({
      path: path.join(output, `general-light-${width}.png`),
    })
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.evaluate(() => {
    const key = 'finance-tracker-preferences-demo'
    localStorage.setItem(
      key,
      JSON.stringify({
        ...JSON.parse(localStorage.getItem(key) || '{}'),
        mode: 'dark',
      }),
    )
  })
  // Init script explicitly keeps the requested source-comparison light mode; change it for this context via UI.
  await visit('appearance', 'Appearance')
  await page.getByRole('button', { name: 'Dark', exact: true }).click()
  await page.screenshot({ path: path.join(output, 'appearance-dark-1440.png') })
  await page.getByRole('link', { name: 'General', exact: true }).click()
  await page.getByRole('heading', { name: 'General', exact: true }).waitFor()
  assert.equal(await page.evaluate(() => window.scrollY), 0)
  await page.waitForFunction(
    () =>
      Number(
        getComputedStyle(document.getElementById('main-content')).opacity,
      ) === 1,
  )
  await page.screenshot({ path: path.join(output, 'general-dark-1440.png') })
  const final = await get('/accounts')
  assert.deepEqual(
    final.filter((row) => row.id !== created.id),
    before,
  )
  assert.equal(runtime.scenario, 'unified')
  assert.deepEqual(external, [])
  await copyFile(
    path.join(root, '.tmp/v014-settings-reference.png'),
    path.join(output, 'reference-settings-1440.png'),
  )
  await writeFile(
    path.join(output, 'validation.json'),
    JSON.stringify(
      {
        result: 'PASS',
        viewports: [1440, 1920, 834, 390],
        exportDatasets: catalog.datasets,
        originalBalancesUnchanged: true,
        noExternalRequests: true,
        accountGroups: groups.length,
      },
      null,
      2,
    ),
  )
  await writeFile(
    path.join(output, 'index.html'),
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Settings source comparison</title><style>body{font:14px system-ui;background:#151515;color:#eee;margin:20px}section{display:grid;grid-template-columns:1fr 1fr;gap:16px}img{width:100%;height:auto}a{color:#b8cdfa}</style><h1>Settings — source and local adaptation</h1><p>Official screenshot (may predate pinned source) and Finance Tracker, both 1440×900. Language remains first by user request. Unsupported source services are omitted. No upstream runtime is claimed.</p><section><figure><figcaption>Official reference</figcaption><img src="reference-settings-1440.png"></figure><figure><figcaption>Finance Tracker</figcaption><img src="general-light-1440.png"></figure></section><p><a href="appearance-light-1440.png">Appearance</a> · <a href="general-dark-1440.png">Dark</a> · <a href="index-light-390.png">Mobile index</a> · <a href="general-light-390.png">Mobile General</a> · <a href="validation.json">Validation</a></p></html>`,
  )
  console.log('Settings migration browser checks PASS')
}
