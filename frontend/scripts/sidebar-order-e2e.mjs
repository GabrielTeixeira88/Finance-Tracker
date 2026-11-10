import assert from 'node:assert/strict'
import path from 'node:path'
import { mkdir } from 'node:fs/promises'
export async function checkSidebarOrder(page, origin, root) {
  const output = path.join(root, 'docs/screenshots/v014-sidebar')
  await mkdir(output, { recursive: true })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(origin + '/#/settings?view=appearance')
  const list = page.getByRole('list', { name: 'Sidebar order' })
  await list.waitFor()
  const sections = page.locator('.appearance-settings > section')
  assert.equal(await sections.first().getByRole('combobox').count(), 1)
  assert.equal(
    await sections
      .last()
      .getByRole('list', { name: 'Sidebar order', exact: true })
      .count(),
    1,
  )
  assert.equal(
    await page
      .getByRole('heading', { name: 'Financial colors', exact: true })
      .count(),
    0,
  )
  await page
    .getByRole('button', { name: 'Restore default order', exact: true })
    .click()
  const initial = [
    'Dashboard',
    'Accounts',
    'Activities',
    'Holdings',
    'Insights',
    'Goals',
    'Settings',
  ]
  const order = () =>
    page
      .locator('.desktop-sidebar .primary-nav button')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('aria-label')))
  assert.deepEqual(await order(), initial)
  await list.getByRole('button', { name: 'Move Goals up', exact: true }).click()
  const moved = [
    'Dashboard',
    'Accounts',
    'Activities',
    'Holdings',
    'Goals',
    'Insights',
    'Settings',
  ]
  assert.deepEqual(await order(), moved)
  await page.reload()
  await page.getByRole('list', { name: 'Sidebar order' }).waitFor()
  assert.deepEqual(await order(), moved)
  await page.screenshot({
    path: path.join(output, 'sidebar-settings-1440.png'),
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page
    .getByRole('button', { name: 'Open navigation', exact: true })
    .click()
  const dialog = page.getByRole('dialog', { name: 'Navigation', exact: true })
  assert.deepEqual(
    await dialog
      .locator('.primary-nav button')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('aria-label'))),
    moved,
  )
  await dialog.getByRole('button', { name: 'Goals', exact: true }).click()
  await page.getByRole('heading', { name: 'Goals', exact: true }).waitFor()
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(origin + '/#/net-worth?end=2026-09-30&range=1Y')
  await page.locator('.net-worth-source-grid').waitFor()
  assert.equal(await page.getByText('Momentum', { exact: true }).count(), 0)
  const report = await (
    await page.request.get(
      origin +
        '/api/net-worth/history?start=2026-01-01&end=2026-09-30&details=true',
    )
  ).json()
  assert.equal('momentum' in report.insights, false)
  await page.screenshot({
    path: path.join(output, 'net-worth-without-momentum-1440.png'),
  })
  await page.goto(origin + '/#/settings?view=appearance')
  await page
    .getByRole('button', { name: 'Restore default order', exact: true })
    .click()
  assert.deepEqual(await order(), initial)
  console.log(
    'Sidebar ordering: immediate/reload/mobile/routing/reset PASS; Momentum absent from UI and API',
  )
}
