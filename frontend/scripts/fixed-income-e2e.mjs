import assert from 'node:assert/strict'
import path from 'node:path'

export async function checkFixedIncome(page, origin, output) {
  const endpoint = '/api/investments/fixed-income?as_of=2026-09-30'
  const baseline = await (await fetch(origin + endpoint)).json()
  assert.equal(baseline.positions.length, 5)
  const money = (value) =>
    new Intl.NumberFormat('en', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 6,
    }).format(value)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${origin}/#/investments?view=Fixed+Income`)
  await page
    .getByRole('heading', { name: 'Fixed Income', exact: true })
    .waitFor()
  for (const p of baseline.positions) {
    const row = page
      .getByRole('row')
      .filter({ has: page.getByRole('button', { name: p.name, exact: true }) })
    assert((await row.innerText()).includes(money(p.gross_value)))
    await row.getByRole('button', { name: p.name, exact: true }).click()
    const detail = page.getByRole('region', { name: p.name, exact: true })
    await detail.locator('.recharts-surface').first().waitFor()
    await page.waitForLoadState('networkidle')
    await detail
      .getByText('Product terms and provenance', { exact: true })
      .click()
    assert((await detail.innerText()).includes(p.contract.issuer))
    await detail
      .getByText('Product terms and provenance', { exact: true })
      .click()
  }
  await page
    .getByRole('button', { name: 'Compare CDB yields', exact: true })
    .click()
  await page.waitForLoadState('networkidle')
  await page.screenshot({
    path: path.join(output, 'fixed-income-1440.jpg'),
    quality: 85,
  })
  const daily = baseline.positions.find(
    (p) =>
      p.contract.liquidity === 'DAILY' &&
      p.contract.instrument_type === 'CDB_CDI',
  )
  await page
    .getByRole('region', { name: daily.name, exact: true })
    .scrollIntoViewIfNeeded()
  await page.screenshot({
    path: path.join(output, 'cdb-history.jpg'),
    quality: 85,
  })
  await page
    .getByRole('button', { name: 'Inspect Tesouro Selic', exact: true })
    .click()
  const treasury = baseline.positions.find(
    (p) => p.contract.instrument_type === 'TESOURO_SELIC',
  )
  const section = page.getByRole('region', { name: treasury.name, exact: true })
  await section.locator('.recharts-surface').first().waitFor()
  await page.waitForLoadState('networkidle')
  await section.scrollIntoViewIfNeeded()
  await page.screenshot({
    path: path.join(output, 'tesouro-selic-history.jpg'),
    quality: 85,
  })
  const series = await (
    await fetch(
      `${origin}/api/investments/fixed-income/${treasury.contract.id}/history?start=2026-06-05&end=2026-09-30`,
    )
  ).json()
  const units = (value) => BigInt(value.replace('.', ''))
  assert(
    series.points.some(
      (p, i) => i && units(p.value) < units(series.points[i - 1].value),
    ),
    'Synthetic Tesouro market history must include a real mark-down',
  )
  await page
    .getByRole('button', { name: 'Compare CDB yields', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Record redemption', exact: true })
    .click()
  await page.getByLabel('Quantity', { exact: true }).fill('100')
  await page
    .getByRole('button', { name: 'Preview redemption', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Confirm redemption', exact: true })
    .waitFor()
  const before = await (
    await fetch(
      `${origin}/api/investments/activities?asset_id=${daily.contract.asset_id}`,
    )
  ).json()
  assert.equal(before.length, 1, 'Preview must not post')
  await page
    .getByRole('button', { name: 'Confirm redemption', exact: true })
    .click()
  await page.getByText('Partially redeemed', { exact: true }).waitFor()
  const after = await (
    await fetch(
      `${origin}/api/investments/activities?asset_id=${daily.contract.asset_id}`,
    )
  ).json()
  assert.equal(after.length, 2)
  assert.equal(after.filter((r) => r.activity_type === 'SELL').length, 1)
  await page.reload()
  await page.getByRole('button', { name: 'Skip tour' }).click()
  await page.getByText('Partially redeemed', { exact: true }).waitFor()
  await page
    .getByRole('button', { name: 'Add fixed-income investment', exact: true })
    .click()
  const purchase = page.getByRole('dialog')
  await purchase
    .getByLabel('Instrument', { exact: true })
    .selectOption('CDB_FIXED')
  await purchase
    .getByLabel('Investment name')
    .fill('Synthetic browser fixed CDB')
  await purchase
    .getByLabel('Issuer', { exact: true })
    .fill('Fictional browser bank')
  await purchase.getByLabel('Maturity', { exact: true }).fill('2027-09-30')
  await purchase
    .getByLabel('Principal to invest (BRL)', { exact: true })
    .fill('100')
  await purchase.getByLabel('Annual fixed rate (%)').fill('12.5')
  await purchase.getByRole('button', { name: 'Save', exact: true }).click()
  await page.waitForFunction(() => !document.querySelector('dialog[open]'))
  assert.equal(
    (await (await fetch(origin + endpoint)).json()).positions.length,
    6,
  )
  await page
    .getByRole('button', { name: 'Record dated index', exact: true })
    .click()
  await page
    .getByRole('dialog')
    .getByLabel('Daily factor (exact decimal)')
    .fill('1.000500000000000001')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Save', exact: true })
    .click()
  await page.getByText('Saved locally', { exact: true }).waitFor()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Reset demo', exact: true }).click()
  await page.getByRole('button', { name: 'Skip tour' }).click()
  assert.deepEqual(await (await fetch(origin + endpoint)).json(), baseline)
  for (const [locale, title] of [
    ['pt-BR', 'Renda Fixa'],
    ['es-419', 'Renta Fija'],
    ['en', 'Fixed Income'],
  ]) {
    await page.goto(`${origin}/#/settings?view=appearance`)
    await page.locator('select').first().selectOption(locale)
    await page.goto(`${origin}/#/investments?view=Fixed+Income`)
    await page.getByRole('heading', { name: title, exact: true }).waitFor()
    await page.waitForLoadState('networkidle')
    await page.screenshot({
      path: path.join(output, `fixed-income-${locale}.jpg`),
      quality: 85,
    })
  }
  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto(`${origin}/#/investments?view=Fixed+Income`)
    await page
      .getByRole('heading', { name: 'Fixed Income', exact: true })
      .waitFor()
    await page.waitForLoadState('networkidle')
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      'Fixed-income page overflow',
    )
    await page.screenshot({
      path: path.join(output, `fixed-income-${viewport.width}.jpg`),
      quality: 85,
    })
  }
}
