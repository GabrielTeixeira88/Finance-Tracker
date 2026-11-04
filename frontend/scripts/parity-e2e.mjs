import assert from 'node:assert/strict'
import path from 'node:path'

export async function checkParity(page, origin, output) {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const get = async (path) => {
    const r = await fetch(origin + '/api' + path)
    assert(r.ok, path)
    return r.json()
  }
  const before = await get('/accounts')
  const baseline = await get('/life-events?as_of=2026-09-30')
  assert.equal(baseline.length, 4)
  assert(baseline.every((r) => r.complete && r.transaction_count > 0))
  const capture = async (name) => {
    await page.waitForLoadState('networkidle')
    await page.waitForFunction(
      () =>
        !/\b(Loading|Calculating|Reconstructing)\b/.test(
          document.body.innerText,
        ),
    )
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({
      path: path.join(output, name + '.jpg'),
      quality: 88,
    })
  }
  const visit = async (route) => {
    await page.goto(origin + '/#/' + route)
    await page.reload()
    const skip = page.getByRole('button', { name: 'Skip tour' })
    if (await skip.count()) await skip.click()
    await page.waitForLoadState('networkidle')
    await page.waitForFunction(
      () =>
        !/\b(Loading|Calculating|Reconstructing)\b/.test(
          document.body.innerText,
        ),
    )
  }
  await visit('investments')
  if (await page.getByRole('button', { name: 'Collapse sidebar' }).count())
    await page.getByRole('button', { name: 'Collapse sidebar' }).click()
  await page.locator('.portfolio-overview-rows').waitFor()
  await capture('investments-1440')
  await page.setViewportSize({ width: 1920, height: 1080 })
  await capture('investments-1920')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.locator('.portfolio-account-row').first().click()
  await capture('account-detail-1440')
  await visit('investments?view=Holdings')
  await page.getByLabel('Sort holdings').selectOption('value')
  await capture('holdings-1440')
  const assets = await get('/investments/assets')
  const equity = assets.find((r) => r.symbol === 'DEMOUP')
  await page
    .getByRole('button', { name: equity.symbol, exact: true })
    .first()
    .click()
  await page.getByRole('heading', { name: equity.name, exact: true }).waitFor()
  await capture('holding-detail-1440')
  for (const [route, name] of [
    ['investments?view=Allocation', 'portfolio-insights'],
    ['performance', 'performance'],
    ['investments?view=Income', 'income'],
    ['net-worth', 'net-worth'],
    ['spending', 'spending'],
    ['spending?view=Insights', 'spending-insights'],
  ]) {
    await visit(route)
    if (name === 'income')
      await page.getByRole('button', { name: 'ALL', exact: true }).click()
    await page
      .locator(
        name === 'spending-insights' ? '.spending-story' : '.recharts-surface',
      )
      .first()
      .waitFor()
    await capture(name + '-1440')
  }
  await visit('net-worth?view=Assets')
  await page
    .getByRole('button', { name: 'Fictional Riverside Home', exact: true })
    .click()
  await page.getByRole('dialog').waitFor()
  await capture('property-detail-1440')
  await page.keyboard.press('Escape')
  assert.equal(await page.getByRole('dialog').count(), 0)
  await visit('goals')
  await page
    .getByRole('button', {
      name: 'International vacation',
      exact: true,
    })
    .click()
  await page.getByLabel('Assumed monthly contribution').fill('600')
  await page.getByText('On track', { exact: true }).waitFor()
  await page.locator('.trajectory-chart').waitFor()
  await capture('goal-detail-1440')
  await visit('spending?view=Life+Events')
  await page.locator('.event-band').first().waitFor()
  await capture('life-events-1440')
  await page.locator('.event-band').first().click()
  const dialog = page.getByRole('dialog')
  await dialog.locator('.recharts-surface').first().waitFor()
  await capture('life-event-detail-1440')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Add event', exact: true }).click()
  await dialog.getByLabel('Event name').fill('Synthetic browser event')
  await dialog.getByLabel('Start date', { exact: true }).fill('2026-09-01')
  await dialog.getByLabel('End date', { exact: true }).fill('2026-09-30')
  await dialog.getByLabel('Planned budget').fill('123.456789')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('button', { name: /Synthetic browser event/ }).click()
  await dialog
    .getByRole('button', { name: 'Link transactions', exact: true })
    .click()
  await dialog.locator('.event-candidate input:not(:disabled)').first().check()
  await dialog.getByRole('button', { name: /Link selected/ }).click()
  await dialog
    .getByRole('button', { name: 'Remove association', exact: true })
    .waitFor()
  const created = (await get('/life-events?as_of=2026-09-30')).find(
    (r) => r.event.name === 'Synthetic browser event',
  )
  assert.equal(created.event.planned_budget, '123.456789')
  assert.equal(created.linked_ids.length, 1)
  await dialog
    .getByRole('button', { name: 'Remove association', exact: true })
    .click()
  await dialog
    .getByRole('button', { name: 'Delete event', exact: true })
    .click()
  await page.waitForFunction(() => !document.querySelector('dialog[open]'))
  assert.deepEqual(
    await get('/accounts'),
    before,
    'Event metadata must never change account balances',
  )
  assert.equal((await get('/life-events?as_of=2026-09-30')).length, 4)
  await page.setViewportSize({ width: 390, height: 844 })
  await visit('spending?view=Life+Events')
  await capture('life-events-mobile')
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    'No outer mobile overflow',
  )
  await page.locator('.event-band').first().click()
  await capture('life-event-detail-mobile')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page
    .getByRole('dialog', { name: 'Navigation' })
    .getByRole('button', { name: 'Investments', exact: true })
    .click()
  await page.locator('.portfolio-overview-rows').waitFor()
  await capture('investments-mobile')
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    'No outer portfolio overflow',
  )
}
