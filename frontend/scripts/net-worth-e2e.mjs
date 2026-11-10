import assert from 'node:assert/strict'
import path from 'node:path'
import { mkdir, copyFile, writeFile } from 'node:fs/promises'

const units = (value) => {
  const [w, f = ''] = value.replace('-', '').split('.')
  return (
    (BigInt(w) * 1000000n + BigInt(f.padEnd(6, '0'))) *
    (value.startsWith('-') ? -1n : 1n)
  )
}
export async function checkNetWorth(page, origin, root) {
  const output = path.join(root, 'docs/screenshots/v014-net-worth')
  await mkdir(output, { recursive: true })
  try {
    await copyFile(
      path.join(root, '.tmp/v014-networth-reference.png'),
      path.join(output, 'reference-official-1440.png'),
    )
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    console.warn(
      'Official reference cache absent; browser checks continue without visual pairing.',
    )
  }
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(origin + '/#/settings?view=appearance')
  await page.getByRole('button', { name: 'Light', exact: true }).click()
  await page.getByRole('button', { name: /Inter/ }).click()
  await page.getByRole('button', { name: 'Classic', exact: true }).click()
  const runtime = await (await page.request.get(origin + '/api/runtime')).json()
  assert(
    runtime.demo === true || runtime.mode === 'demo' || runtime.generation,
    'Only an owned isolated demo is allowed',
  )
  const headers = {
    'x-finance-demo': '1',
    'x-demo-generation': runtime.generation,
    origin,
  }
  const post = async (url, data) => {
    const response = await page.request.post(origin + '/api' + url, {
      data,
      headers,
    })
    assert(response.ok(), `${url}: ${await response.text()}`)
    return response.json()
  }
  const manual = async (name, kind, category, first, last) => {
    const p = await post('/manual-positions', {
      name,
      kind,
      category,
      currency: 'BRL',
      start_date: '2024-10-01',
    })
    await post(`/manual-positions/${p.id}/observations`, {
      effective_date: '2024-10-01',
      amount: first,
    })
    await post(`/manual-positions/${p.id}/observations`, {
      effective_date: '2026-06-01',
      amount: last,
    })
    return p
  }
  const accountsBefore = await (
    await page.request.get(origin + '/api/accounts')
  ).json()
  const baseline = await (
    await page.request.get(
      origin + '/api/net-worth/history?start=2026-01-01&end=2026-09-30',
    )
  ).json()
  await page.goto(origin + '/#/net-worth?end=2026-09-30&range=YTD')
  await page.locator('.net-worth-source-grid').waitFor()
  await page.waitForLoadState('networkidle')
  assert.equal(
    await page
      .getByRole('tab', { name: 'Liabilities', includeHidden: true })
      .count(),
    0,
  )
  assert.equal(
    await page
      .getByRole('option', { name: 'Liabilities', includeHidden: true })
      .count(),
    0,
  )
  await page.screenshot({ path: path.join(output, 'house-car-demo-1440.png') })
  await page.getByRole('button', { name: 'Properties', exact: true }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^House/ })
    .waitFor()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Vehicles', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: /^Car/ }).waitFor()
  await page.keyboard.press('Escape')
  const property = await manual(
    'Review property',
    'ASSET',
    'REAL_ESTATE',
    '300000',
    '340000',
  )
  await manual('Review vehicle', 'ASSET', 'VEHICLE', '45000', '38000')
  const mortgage = await manual(
    'Review mortgage',
    'LIABILITY',
    'MORTGAGE',
    '250000',
    '210000',
  )
  const visit = async (range = 'YTD') => {
    await page.goto(origin + `/#/net-worth?end=2026-09-30&range=${range}`)
    // API-created fixtures bypass React Query mutations; reload the owned browser
    // before checking newly added positions against the already visited baseline.
    await page.reload()
    await page.locator('.net-worth-source-grid').waitFor()
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)
  }
  await visit()
  assert.equal(
    await page.locator('.net-worth-source-chart .recharts-surface').count(),
    1,
  )
  await page.getByText('Monthly pace', { exact: true }).waitFor()
  assert.equal(await page.getByText('Momentum', { exact: true }).count(), 0)
  await page
    .getByRole('heading', { name: 'Needs attention', exact: true })
    .waitFor()
  const report = await (
    await page.request.get(
      origin +
        '/api/net-worth/history?start=2026-01-01&end=2026-09-30&details=true',
    )
  ).json()
  assert.equal(units(report.value), units(baseline.value) + units('168000'))
  assert.equal(report.insights.velocity.available, true)
  assert.equal('momentum' in report.insights, false)
  assert.equal(
    report.insights.velocity.drivers.reduce((s, d) => s + units(d.value), 0n),
    units(report.change),
  )
  assert(report.insights.stale.some((p) => p.id === property.id))
  await page.mouse.move(1435, 5)
  await page.screenshot({ path: path.join(output, 'net-worth-light-1440.png') })
  const offset = await page
    .locator('.net-worth-primary-line')
    .evaluate((n) => n.getBoundingClientRect().top - 82)
  await page.evaluate((y) => window.scrollBy(0, y), offset)
  await page.screenshot({
    path: path.join(output, 'net-worth-aligned-light-1440.png'),
  })
  await page.evaluate(() => window.scrollTo(0, 0))
  const assets = page.getByRole('button', { name: /^Assets/ }).first()
  await assets.click()
  assert.equal(await assets.getAttribute('aria-expanded'), 'false')
  await assets.click()
  await page.getByRole('button', { name: 'Properties', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: /^Review property/ }).waitFor()
  await dialog.locator('.recharts-surface').waitFor()
  await page.screenshot({
    path: path.join(output, 'property-category-light-1440.png'),
  })
  await page.keyboard.press('Tab')
  assert(await dialog.evaluate((node) => node.contains(document.activeElement)))
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'hidden' })
  await page.getByRole('button', { name: 'Hide balances', exact: true }).click()
  assert(
    (await page.locator('.net-worth-primary-line').innerText()).includes(
      '••••',
    ),
  )
  assert.equal(
    await page.locator('.net-worth-source-overview [title*="695"]').count(),
    0,
  )
  await page
    .locator('.net-worth-source-chart')
    .first()
    .hover({ position: { x: 450, y: 110 } })
  await page.screenshot({
    path: path.join(output, 'net-worth-private-1440.png'),
  })
  await page.getByRole('button', { name: 'Show balances', exact: true }).click()
  await page
    .getByLabel('Link property', { exact: true })
    .selectOption(property.id)
  await page
    .getByLabel('Link property', { exact: true })
    .waitFor({ state: 'hidden' })
  const linked = await (
    await page.request.get(origin + '/api/manual-positions')
  ).json()
  assert.equal(
    linked.find((p) => p.id === mortgage.id).associated_asset_id,
    property.id,
  )
  assert.deepEqual(
    await (await page.request.get(origin + '/api/accounts')).json(),
    accountsBefore,
  )
  await page
    .getByRole('button', { name: 'Investments', exact: true })
    .last()
    .click()
  await page
    .getByRole('dialog')
    .getByRole('heading', { name: 'Investment composition', exact: true })
    .waitFor()
  await page
    .getByRole('dialog')
    .getByText('Fixed Income', { exact: true })
    .waitFor()
  await page.keyboard.press('Escape')
  for (const range of ['1D', '1W', '1M', '3M', '6M', '1Y', 'ALL', 'YTD']) {
    await page
      .getByRole('navigation', { name: 'Net worth date range' })
      .getByRole('button', { name: range, exact: true })
      .click()
    await page.waitForLoadState('networkidle')
    assert((await page.url()).includes('range=' + range))
  }
  await page
    .locator('.net-worth-attention')
    .getByRole('button', { name: /Review property/ })
    .click()
  await page
    .getByRole('heading', { name: 'Review property', exact: true })
    .waitFor()
  await page.getByRole('button', { name: 'Values', exact: true }).click()
  await page.getByRole('button', { name: 'Add valuation', exact: true }).click()
  const valueDialog = page.getByRole('dialog')
  await valueDialog
    .getByLabel('Effective date', { exact: true })
    .fill('2026-09-30')
  await valueDialog.getByLabel('Amount (BRL)', { exact: true }).fill('345000')
  await valueDialog.getByRole('button', { name: 'Save', exact: true }).click()
  await valueDialog.waitFor({ state: 'hidden' })
  await visit()
  assert.equal(
    await page
      .locator('.net-worth-attention')
      .getByRole('button', { name: /Review property/ })
      .count(),
    0,
  )
  await page.goto(origin + '/#/settings?view=appearance')
  await page.getByRole('button', { name: 'Dark', exact: true }).click()
  await visit()
  await page.screenshot({ path: path.join(output, 'net-worth-dark-1440.png') })
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.screenshot({ path: path.join(output, 'net-worth-dark-1920.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({
    path: path.join(output, 'net-worth-mobile.png'),
    fullPage: true,
  })
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    'No mobile horizontal overflow',
  )
  await page
    .getByRole('button', { name: 'Open navigation', exact: true })
    .click()
  await page.getByRole('dialog').waitFor()
  await page.screenshot({
    path: path.join(output, 'net-worth-mobile-navigation.png'),
  })
  await page.keyboard.press('Escape')
  await writeFile(
    path.join(output, 'financial-check.json'),
    JSON.stringify(
      { value: report.value, change: report.change, insights: report.insights },
      null,
      2,
    ),
  )
  console.log(
    'Net Worth populated browser: source chart, category drawer, privacy, range controls, mortgage link, valuation, mobile PASS',
  )
}
