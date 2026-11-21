import assert from 'node:assert/strict'
import { mkdir, writeFile, copyFile } from 'node:fs/promises'
import path from 'node:path'
export async function checkHoldingsActivities(page, origin, root) {
  const output = path.join(root, 'docs/screenshots/v014-holdings-activities')
  await mkdir(output, { recursive: true })
  const errors = [],
    requests = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('response', (response) => {
    if (response.url().includes('/api/') && response.status() >= 400)
      requests.push([response.status(), new URL(response.url()).pathname])
  })
  const runtime = await (await page.request.get(origin + '/api/runtime')).json()
  assert.equal(runtime.scenario, 'unified')
  const accounts = await (
    await page.request.get(origin + '/api/accounts')
  ).json()
  const before = accounts.map((a) => [a.id, a.balance])
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(origin + '/#/holdings')
  await page
    .locator('.wf-workspace table tbody')
    .first()
    .waitFor({ timeout: 60000 })
  await page.waitForFunction(() =>
    document.querySelector('.wf-workspace')?.textContent.includes('SIM-GLOBAL'),
  )
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(output, 'holdings-dark-1440.png') })
  await page.getByRole('button', { name: 'Closed', exact: true }).click()
  await page.getByText('SIM-CLOSED-GAIN', { exact: true }).first().waitFor()
  await page.getByText('SIM-CLOSED-LOSS', { exact: true }).first().waitFor()
  await page.screenshot({
    path: path.join(output, 'closed-holdings-dark-1440.png'),
  })
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Assets', exact: true }).click()
  await page.waitForFunction(() =>
    document.querySelector('.wf-workspace')?.textContent.includes('House'),
  )
  await page.screenshot({ path: path.join(output, 'assets-dark-1440.png') })
  await page.getByText('House', { exact: true }).first().click()
  await page.getByRole('heading', { name: 'House', exact: true }).waitFor()
  await page.locator('.wf-workspace .recharts-area').first().waitFor()
  await page.screenshot({
    path: path.join(output, 'house-detail-dark-1440.png'),
  })
  await page.getByRole('button', { name: 'Values', exact: true }).click()
  await page.locator('.wf-workspace table tbody tr').first().waitFor()
  await page.screenshot({
    path: path.join(output, 'house-history-dark-1440.png'),
  })
  await page.goto(origin + '/#/holdings?tab=assets')
  await page.getByText('House', { exact: true }).first().waitFor()
  await page.getByRole('button', { name: 'Liabilities', exact: true }).click()
  await page.getByText('Home mortgage', { exact: true }).first().waitFor()
  await page.screenshot({
    path: path.join(output, 'liabilities-dark-1440.png'),
  })
  await page.getByRole('button', { name: 'Investments', exact: true }).click()
  await page.getByRole('button', { name: 'Columns', exact: true }).click()
  await page.screenshot({ path: path.join(output, 'columns-dark-1440.png') })
  await page.keyboard.press('Escape')
  const securityLink = page
    .locator('.wf-workspace [role="button"]')
    .filter({ hasText: 'SIM-GLOBAL-ETF' })
    .first()
  await securityLink.click()
  await page
    .getByRole('heading', { name: 'SIM-GLOBAL-ETF', exact: true })
    .waitFor()
  await page
    .getByRole('region', { name: 'Holdings', exact: true })
    .getByRole('button', { name: 'Holdings', exact: true })
    .click()
  await page.getByText('Acquisition history', { exact: true }).waitFor()
  await page.waitForFunction(
    () =>
      document.querySelectorAll('.wf-workspace .balance-chart .recharts-area')
        .length > 0 &&
      document.querySelectorAll('.wf-workspace table tbody tr').length >= 4,
  )
  await page
    .locator('.wf-workspace table[data-slot="table"]')
    .first()
    .getByText('Equity brokerage', { exact: true })
    .waitFor()
  await page.screenshot({
    path: path.join(output, 'security-acquisitions-dark-1440.png'),
  })
  await page
    .getByRole('region', { name: 'Holdings', exact: true })
    .getByRole('button', { name: 'Price History', exact: true })
    .click()
  await page.getByRole('table', { name: 'Cached security prices' }).waitFor()
  await page.screenshot({
    path: path.join(output, 'security-quotes-dark-1440.png'),
  })
  await page
    .getByRole('region', { name: 'Holdings', exact: true })
    .getByRole('button', { name: 'Activities', exact: true })
    .click()
  await page.waitForFunction(() =>
    document
      .querySelector('.wf-investment-activity table tbody')
      ?.textContent.includes('SIM-GLOBAL'),
  )
  await page.screenshot({
    path: path.join(output, 'security-activities-dark-1440.png'),
  })
  const search = page.getByRole('textbox', { name: 'Search...', exact: true })
  await search.fill('NO-FICTIONAL-MATCH-123')
  await page.getByText('No activities', { exact: true }).waitFor()
  await search.fill('')
  await page.waitForFunction(() =>
    document
      .querySelector('.wf-investment-activity table tbody')
      ?.textContent.includes('SIM-GLOBAL'),
  )
  const equity = accounts.find((account) => account.name === 'Equity brokerage')
  await page.goto(origin + `/#/account?account=${equity.id}`)
  await page
    .getByRole('heading', { name: 'Equity brokerage', exact: true })
    .waitFor()
  await page
    .locator('.wf-workspace table[data-slot="table"] tbody')
    .first()
    .getByText('SIM-GLOBAL-ETF', { exact: true })
    .waitFor()
  await page.locator('.balance-chart .recharts-area').first().waitFor()
  await page.screenshot({
    path: path.join(output, 'account-detail-dark-1440.png'),
  })
  const transactions = await (
    await page.request.get(origin + '/api/transactions?limit=50')
  ).json()
  const firstExpense = transactions.find(
    (row) => row.transaction_type === 'EXPENSE',
  )
  assert(firstExpense)
  await page.goto(origin + '/#/activities?view=transactions&tab=spending')
  await page
    .locator('.wf-spending-table tbody tr.group\\/row')
    .first()
    .waitFor()
  await page.screenshot({
    path: path.join(output, 'spending-activities-dark-1440.png'),
  })
  const bankSearch = page.getByRole('searchbox', {
    name: 'Search transactions',
  })
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/transactions?') &&
        response.url().includes('search=') &&
        response.status() === 200,
    ),
    bankSearch.fill(firstExpense.description),
  ])
  await page
    .getByText(firstExpense.payee?.name ?? firstExpense.description, {
      exact: true,
    })
    .first()
    .waitFor()
  await bankSearch.fill('NO-FICTIONAL-MATCH-123')
  await page
    .getByText('No transactions match this view.', { exact: true })
    .waitFor()
  await bankSearch.fill('')
  await page
    .locator('.wf-spending-table tbody tr.group\\/row')
    .first()
    .waitFor()
  await page.getByRole('button', { name: 'Investments', exact: true }).click()
  await page.locator('.wf-investment-activity table tbody tr').first().waitFor()
  await page.screenshot({
    path: path.join(output, 'investment-activities-dark-1440.png'),
  })
  await page.getByRole('button', { name: 'Spending', exact: true }).click()
  await page.locator('.wf-spending-table tbody').first().waitFor()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(300)
  await page.screenshot({
    path: path.join(output, 'spending-activities-mobile-390.png'),
  })
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    'Spending mobile fits viewport',
  )
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(origin + '/#/holdings')
  await page.locator('.wf-workspace table tbody').first().waitFor()
  const response = await page.request.get(
    origin + `/api/investments/workspace/holdings?as_of=${runtime.end_date}`,
  )
  assert(response.ok())
  const report = await response.json()
  assert(report.rows.filter((r) => r.holdingType === 'SECURITY').length > 10)
  const contract =
    report.rows.find((row) => row.contract?.instrument_type === 'CDB_CDI') ??
    report.rows.find(
      (row) => row.contract && row.instrument?.symbol === 'CDB-A',
    )
  assert(contract, 'Seeded CDB contract is available to inspect')
  await page.goto(origin + `/#/holdings?asset=${contract.instrument.id}`)
  await page
    .getByRole('heading', { name: contract.instrument.symbol, exact: true })
    .waitFor()
  await page
    .locator('.wf-workspace .balance-chart .recharts-area')
    .first()
    .waitFor()
  await page
    .getByRole('region', { name: 'Holdings', exact: true })
    .getByRole('button', { name: 'Values', exact: true })
    .click()
  await page
    .locator('.wf-workspace table[data-slot="table"] tbody tr')
    .first()
    .waitFor()
  assert.equal(
    await page.getByRole('button', { name: 'Add Quote', exact: true }).count(),
    0,
    'Contract values must not expose an equity quote-entry workflow',
  )
  await page.screenshot({
    path: path.join(output, 'contract-values-dark-1440.png'),
  })
  await page.goto(origin + '/#/holdings?tab=liabilities')
  await page.getByText('Home mortgage', { exact: true }).first().click()
  await page
    .getByRole('heading', { name: 'Home mortgage', exact: true })
    .waitFor()
  await page.locator('.wf-workspace .recharts-area').first().waitFor()
  await page.screenshot({
    path: path.join(output, 'liability-detail-dark-1440.png'),
  })
  await page.goto(origin + '/#/holdings')
  await page.locator('.wf-workspace table tbody').first().waitFor()
  const cash = report.rows.find((r) => r.holdingType === 'CASH')
  assert(cash)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: path.join(output, 'holdings-mobile-390.png') })
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    'No document overflow',
  )
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.screenshot({ path: path.join(output, 'holdings-dark-1920.png') })
  await page.setViewportSize({ width: 1440, height: 900 })
  const financialFlow = await checkPostingFlow(page, origin, output)
  const manualFlow = await checkManualFlow(page, origin, output)
  const after = (
    await (await page.request.get(origin + '/api/accounts')).json()
  )
    .filter((account) =>
      accounts.some((original) => original.id === account.id),
    )
    .map((a) => [a.id, a.balance])
  assert.deepEqual(after, before)
  assert.deepEqual(errors, [])
  assert.deepEqual(requests, [])
  try {
    await copyFile(
      path.join(root, '.tmp/parity-reference-investments-holdings-dark.png'),
      path.join(output, 'reference-holdings-dark-1440.png'),
    )
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  await writeFile(
    path.join(output, 'results.json'),
    JSON.stringify(
      {
        result: 'PASS',
        holdings: report.rows.length,
        balancesUnchanged: true,
        financialFlow,
        manualFlow,
        errors,
        requests,
      },
      null,
      2,
    ),
  )
  console.log(
    'Holdings source UI smoke PASS; full migration acceptance remains pending.',
  )
}

async function checkManualFlow(page, origin, output) {
  const name = 'Browser recorded asset'
  await page.goto(origin + '/#/holdings?tab=assets')
  await page.getByRole('button', { name: 'More options', exact: true }).click()
  await page.getByRole('button', { name: 'Add Asset', exact: true }).click()
  const dialog = page.getByRole('dialog').last()
  await dialog.getByLabel('Name', { exact: true }).fill(name)
  await dialog.getByLabel('Category', { exact: true }).fill('OTHER')
  await dialog.getByLabel('Ownership start', { exact: true }).fill('2026-09-01')
  await dialog
    .getByLabel('Acquisition cost (optional)', { exact: true })
    .fill('1000')
  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal(
    await dialog.getByLabel('Name', { exact: true }).inputValue(),
    name,
    'Responsive modal must retain the unsaved asset draft',
  )
  await page.screenshot({
    path: path.join(output, 'asset-form-mobile-390.png'),
  })
  const bounds = await dialog.boundingBox()
  assert(
    bounds && bounds.width <= 390,
    'Manual asset form fits the mobile viewport',
  )
  const created = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/manual-positions') &&
      response.request().method() === 'POST',
  )
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  const creation = await created
  assert.equal(creation.status(), 201)
  const position = await creation.json()
  await dialog.waitFor({ state: 'detached' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByText(name, { exact: true }).first().click()
  await page.getByRole('heading', { name, exact: true }).waitFor()
  await page.getByRole('button', { name: 'Values', exact: true }).click()
  await page.getByRole('button', { name: 'Add Value', exact: true }).click()
  await page.getByLabel('Effective date', { exact: true }).fill('2026-09-30')
  await page.getByLabel('Value', { exact: true }).fill('980')
  await page
    .getByLabel('Observation notes', { exact: true })
    .fill('Fictional browser valuation')
  const added = page.waitForResponse(
    (response) =>
      response
        .url()
        .endsWith(`/manual-positions/${position.id}/observations`) &&
      response.request().method() === 'POST',
  )
  await page
    .getByRole('dialog')
    .last()
    .getByRole('button', { name: 'Save', exact: true })
    .click()
  assert.equal((await added).status(), 201)
  await page.getByRole('dialog').waitFor({ state: 'detached' })
  await page
    .getByRole('button', { name: 'Correct observation', exact: true })
    .click()
  await page.getByLabel('Corrected value', { exact: true }).fill('970')
  await page
    .getByLabel('Correction reason', { exact: true })
    .fill('Fictional browser correction')
  const corrected = page.waitForResponse(
    (response) =>
      response.url().endsWith('/correct') &&
      response.request().method() === 'POST',
  )
  await page
    .getByRole('dialog')
    .last()
    .getByRole('button', { name: 'Save', exact: true })
    .click()
  assert((await corrected).ok())
  await page.getByRole('dialog').waitFor({ state: 'detached' })
  await page
    .getByText('Fictional browser correction', { exact: true })
    .first()
    .waitFor()
  const observations = await (
    await page.request.get(
      origin + `/api/manual-positions/${position.id}/observations`,
    )
  ).json()
  assert.equal(
    observations.length,
    2,
    'Correction retains original observation',
  )
  assert.equal(observations.filter((row) => !row.voided_at).length, 1)
  assert.equal(observations.find((row) => !row.voided_at).amount, '970.000000')
  await page.screenshot({
    path: path.join(output, 'asset-correction-dark-1440.png'),
  })
  await page.getByRole('button', { name: 'More options', exact: true }).click()
  await page.getByRole('button', { name: 'Close record', exact: true }).click()
  await page.getByLabel('End date', { exact: true }).fill('2026-09-30')
  const closing = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/manual-positions/${position.id}/close`) &&
      response.request().method() === 'POST',
  )
  await page.screenshot({
    path: path.join(output, 'asset-close-dark-1440.png'),
  })
  await page
    .getByRole('dialog')
    .last()
    .getByRole('button', { name: 'Save', exact: true })
    .click()
  const closed = await closing
  assert(closed.ok())
  assert.equal((await closed.json()).end_date, '2026-09-30')
  assert.equal(
    (
      await (
        await page.request.get(
          origin + `/api/manual-positions/${position.id}/observations`,
        )
      ).json()
    ).length,
    2,
    'Closing a manual asset must preserve its valuation audit',
  )
  return {
    created: true,
    correctedValue: '970.000000',
    originalRetained: true,
    mobileFormFits: true,
    closedWithoutDeletingHistory: true,
  }
}

async function checkPostingFlow(page, origin, output) {
  const create = async (name, balance, type = 'CHECKING') => {
    await page.goto(origin + '/#/accounts')
    await page.getByRole('button', { name: 'Add account', exact: true }).click()
    await page.getByLabel('Account name', { exact: true }).fill(name)
    await page.getByLabel('Account type', { exact: true }).selectOption(type)
    await page.getByLabel('Currency', { exact: true }).fill('BRL')
    await page.getByLabel('Opening balance', { exact: true }).fill(balance)
    await page.getByLabel('Opening date', { exact: true }).fill('2026-09-01')
    const pending = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/accounts') &&
        response.request().method() === 'POST',
    )
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    const response = await pending
    assert.equal(response.status(), 201, await response.text())
    await page
      .getByRole('button', { name: 'Save', exact: true })
      .waitFor({ state: 'detached' })
    return response.json()
  }
  const summaryUrl =
    origin +
    '/api/spending/summary?date_from=2026-09-01&date_to=2026-10-01&currency=BRL'
  const prior = await (await page.request.get(summaryUrl)).json()
  const checking = await create('Browser validation checking', '5000')
  const savings = await create('Browser validation savings', '2000', 'SAVINGS')
  await page.goto(origin + '/#/activities?view=transactions&tab=spending')
  const open = async (kind) => {
    await page
      .getByRole('button', { name: 'Add Activities', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Add Transaction', exact: true })
      .click()
    await page.getByTestId('activity-type-' + kind).click()
  }
  const save = async (path) => {
    const response = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/' + path) &&
        response.request().method() === 'POST',
    )
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    assert.equal((await response).status(), 201)
    await page
      .getByRole('button', { name: 'Save', exact: true })
      .waitFor({ state: 'detached' })
  }
  await open('withdrawal')
  await page.getByLabel('Account', { exact: true }).selectOption(checking.id)
  await page.getByLabel('Amount', { exact: true }).fill('200')
  await page
    .getByLabel('Description', { exact: true })
    .fill('Browser validation expense')
  await save('transactions')
  await open('deposit')
  await page.getByLabel('Account', { exact: true }).selectOption(checking.id)
  await page.getByLabel('Amount', { exact: true }).fill('1000')
  await page
    .getByLabel('Description', { exact: true })
    .fill('Browser validation income')
  await save('transactions')
  await open('transfer')
  await page
    .getByLabel('From account', { exact: true })
    .selectOption(checking.id)
  await page.getByLabel('To account', { exact: true }).selectOption(savings.id)
  await page.getByLabel('Amount', { exact: true }).fill('500')
  await page
    .getByLabel('Description (optional)', { exact: true })
    .fill('Browser validation internal transfer')
  await page.screenshot({
    path: path.join(output, 'transfer-form-dark-1440.png'),
  })
  await save('transfers')
  const all = await (await page.request.get(origin + '/api/accounts')).json()
  const cash = (id) => all.find((account) => account.id === id).balance
  assert.equal(cash(checking.id), '5300.000000')
  assert.equal(cash(savings.id), '2500.000000')
  const current = await (await page.request.get(summaryUrl)).json()
  const units = (value) => {
    const [whole, fraction = ''] = String(value).split('.')
    return BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0'))
  }
  assert.equal(units(current.income) - units(prior.income), 1000000000n)
  assert.equal(units(current.expenses) - units(prior.expenses), 200000000n)
  const search = page.getByRole('searchbox', { name: 'Search transactions' })
  const filtered = page.waitForResponse(
    (response) =>
      response.url().includes('/api/transactions') &&
      new URL(response.url()).searchParams.get('search') ===
        'Browser validation expense',
  )
  await search.fill('Browser validation expense')
  await filtered
  await page
    .getByText('Loading transactions…', { exact: true })
    .waitFor({ state: 'hidden' })
  await page
    .getByRole('checkbox', { name: /Browser validation expense/ })
    .check()
  await page.screenshot({
    path: path.join(output, 'bulk-selection-dark-1440.png'),
  })
  await page.getByRole('button', { name: 'Mark reviewed', exact: true }).click()
  const bulkResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/transactions/bulk') &&
      response.request().method() === 'PATCH',
  )
  await page
    .getByRole('button', { name: 'Apply to selected', exact: true })
    .click()
  const bulk = await bulkResponse
  assert(bulk.ok())
  assert.equal(bulk.request().postDataJSON().transaction_ids.length, 1)
  assert.deepEqual(bulk.request().postDataJSON().changes, {
    review_status: 'REVIEWED',
  })
  await page
    .getByRole('button', { name: 'Apply to selected', exact: true })
    .waitFor({ state: 'detached' })
  const afterReview = await (
    await page.request.get(origin + '/api/accounts')
  ).json()
  assert.equal(
    afterReview.find((account) => account.id === checking.id).balance,
    '5300.000000',
  )
  assert.equal(
    afterReview.find((account) => account.id === savings.id).balance,
    '2500.000000',
  )
  const imported = await create('Browser import checking', '100')
  await page.goto(origin + '/#/activities?view=transactions&tab=spending')
  await page
    .getByRole('button', { name: 'Add Activities', exact: true })
    .click()
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await page
    .getByLabel('Target account', { exact: true })
    .selectOption(imported.id)
  await page.getByLabel('Statement file', { exact: true }).setInputFiles({
    name: 'synthetic-browser.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'date,description,amount\n2026-09-29,Browser fictional import purchase,-32.50\n',
    ),
  })
  await page
    .getByRole('button', { name: 'Inspect columns', exact: true })
    .click()
  await page.getByLabel('Map date', { exact: true }).waitFor()
  await page
    .getByRole('button', { name: 'Preview transactions', exact: true })
    .click()
  const confirm = page.getByRole('button', {
    name: 'Confirm import',
    exact: true,
  })
  await confirm.waitFor()
  assert(
    await confirm.isDisabled(),
    'Import requires explicit account confirmation',
  )
  let importedCash = (
    await (await page.request.get(origin + '/api/accounts')).json()
  ).find((account) => account.id === imported.id).balance
  assert.equal(
    importedCash,
    '100.000000',
    'Preview must not post financial data',
  )
  await page.screenshot({
    path: path.join(output, 'import-preview-dark-1440.png'),
  })
  await page.getByRole('checkbox', { name: /I confirm this statement/ }).check()
  const confirmation = page.waitForResponse(
    (response) =>
      response.url().includes('/api/imports/') &&
      response.url().endsWith('/confirm') &&
      response.request().method() === 'POST',
  )
  await confirm.click()
  const confirmationResponse = await confirmation
  assert(
    confirmationResponse.ok(),
    `Import confirmation HTTP ${confirmationResponse.status()}`,
  )
  await page.getByRole('heading', { name: /^Import summary/ }).waitFor()
  importedCash = (
    await (await page.request.get(origin + '/api/accounts')).json()
  ).find((account) => account.id === imported.id).balance
  assert.equal(importedCash, '67.500000', 'Only confirmed purchase posts once')
  await page.screenshot({
    path: path.join(output, 'import-confirmed-dark-1440.png'),
  })
  const brokerage = await create(
    'Browser investment account',
    '100',
    'INVESTMENT',
  )
  const assets = await (
    await page.request.get(origin + '/api/investments/assets')
  ).json()
  const security = assets.find((asset) => asset.symbol === 'SIM-GLOBAL-ETF')
  assert(security)
  await page.goto(
    origin + '/#/activities?view=investment-activity&tab=investments',
  )
  await page
    .getByRole('button', { name: 'Add Activities', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Add Transaction', exact: true })
    .click()
  await page
    .getByLabel('Investment account', { exact: true })
    .selectOption(brokerage.id)
  await page
    .getByLabel('Activity security', { exact: true })
    .selectOption(security.id)
  await page.getByLabel('Quantity', { exact: true }).fill('2')
  await page.getByLabel('Unit price', { exact: true }).fill('25')
  await page.getByLabel('Activity fees', { exact: true }).fill('1')
  await page
    .getByLabel('Activity notes', { exact: true })
    .fill('Browser validation investment buy')
  await page
    .getByRole('button', { name: 'Preview activity', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Confirm activity', exact: true })
    .waitFor()
  let investmentCash = (
    await (await page.request.get(origin + '/api/accounts')).json()
  ).find((account) => account.id === brokerage.id).balance
  assert.equal(investmentCash, '100.000000', 'Investment preview must not post')
  await page.screenshot({
    path: path.join(output, 'investment-form-dark-1440.png'),
  })
  const posted = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/investments/activities') &&
      response.request().method() === 'POST',
  )
  await page
    .getByRole('button', { name: 'Confirm activity', exact: true })
    .click()
  assert.equal((await posted).status(), 201)
  await page
    .getByRole('button', { name: 'Confirm activity', exact: true })
    .waitFor({ state: 'detached' })
  investmentCash = (
    await (await page.request.get(origin + '/api/accounts')).json()
  ).find((account) => account.id === brokerage.id).balance
  assert.equal(
    investmentCash,
    '49.000000',
    'Buy includes its only cash posting and fee',
  )
  await page
    .getByRole('textbox', { name: 'Search...', exact: true })
    .fill('Browser validation investment buy')
  await page
    .locator('.wf-investment-activity table tbody tr')
    .filter({ hasText: 'SIM-GLOBAL-ETF' })
    .first()
    .waitFor()
  await page
    .locator('.wf-investment-activity table tbody tr')
    .filter({ hasText: 'SIM-GLOBAL-ETF' })
    .getByRole('button', { name: 'Actions', exact: true })
    .click()
  await page.getByRole('menuitem', { name: 'Void', exact: true }).click()
  const voided = page.waitForResponse(
    (response) =>
      response.url().endsWith('/void') &&
      response.request().method() === 'POST',
  )
  await page
    .getByRole('dialog')
    .last()
    .getByRole('button', { name: 'Void', exact: true })
    .click()
  assert((await voided).ok())
  investmentCash = (
    await (await page.request.get(origin + '/api/accounts')).json()
  ).find((account) => account.id === brokerage.id).balance
  assert.equal(
    investmentCash,
    '100.000000',
    'Guarded void reconstructs cash without deleting history',
  )
  await page
    .getByRole('button', { name: 'Add Activities', exact: true })
    .click()
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await page
    .getByLabel('Brokerage target account', { exact: true })
    .selectOption(brokerage.id)
  await page
    .getByLabel('Broker source namespace', { exact: true })
    .fill('fictional-browser-broker')
  await page.getByLabel('Brokerage CSV file', { exact: true }).setInputFiles({
    name: 'synthetic-browser-brokerage.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      `date,type,symbol,exchange,quantity,price,gross,fees,taxes,currency,id\n2026-09-30,BUY,${security.symbol},${security.exchange},1,25,25,0,0,BRL,FICTIONAL-BROWSER-BUY-1\n`,
    ),
  })
  const previewed = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/investments/imports/preview') &&
      response.request().method() === 'POST',
  )
  await page
    .getByRole('button', { name: 'Preview brokerage CSV', exact: true })
    .click()
  const brokerPreview = await previewed
  assert(brokerPreview.ok(), `Brokerage preview HTTP ${brokerPreview.status()}`)
  const brokerBatch = await brokerPreview.json()
  assert(
    brokerBatch.ready,
    'Known fictional security is ready for explicit confirmation',
  )
  const brokerConfirm = page.getByRole('button', {
    name: 'Confirm brokerage import',
    exact: true,
  })
  await brokerConfirm.waitFor()
  assert(
    await brokerConfirm.isDisabled(),
    'Brokerage account confirmation is explicit',
  )
  const unpostedCash = (
    await (await page.request.get(origin + '/api/accounts')).json()
  ).find((account) => account.id === brokerage.id).balance
  assert.equal(
    unpostedCash,
    '100.000000',
    'Brokerage import preview has no cash posting',
  )
  await page.screenshot({
    path: path.join(output, 'brokerage-preview-dark-1440.png'),
  })
  await page
    .getByRole('checkbox', {
      name: 'I confirm this brokerage account and reviewed activities',
      exact: true,
    })
    .check()
  const brokerConfirmed = page.waitForResponse(
    (response) =>
      response
        .url()
        .endsWith(`/investments/imports/${brokerBatch.id}/confirm`) &&
      response.request().method() === 'POST',
  )
  await brokerConfirm.click()
  assert((await brokerConfirmed).ok())
  await brokerConfirm.waitFor({ state: 'detached' })
  const confirmedBrokerageCash = (
    await (await page.request.get(origin + '/api/accounts')).json()
  ).find((account) => account.id === brokerage.id).balance
  assert.equal(
    confirmedBrokerageCash,
    '75.000000',
    'One confirmed imported purchase has one cash posting',
  )
  await page.screenshot({
    path: path.join(output, 'brokerage-confirmed-dark-1440.png'),
  })
  return {
    checking: cash(checking.id),
    savings: cash(savings.id),
    incomeDelta: '1000.000000',
    expenseDelta: '200.000000',
    transfersExcluded: true,
    selectedReviewPreservedBalances: true,
    importPreviewUnposted: true,
    confirmedImportCash: importedCash,
    investmentBuyCash: '49.000000',
    investmentVoidCash: investmentCash,
    brokeragePreviewUnposted: true,
    confirmedBrokerageCash,
  }
}
