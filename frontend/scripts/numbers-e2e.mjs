import assert from 'node:assert/strict'
import path from 'node:path'
import { mkdir } from 'node:fs/promises'
export async function checkNumbers(page, origin, root) {
  const output = path.join(root, 'docs/screenshots/v014-numbers')
  await mkdir(output, { recursive: true })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  const financial = /^[^0-9]*[0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}$/u
  const verify = async () => {
    const values = await page.locator('.money:visible').allTextContents()
    assert(values.length > 0)
    for (const value of values)
      assert(
        financial.test(value.trim()),
        'Incorrect monetary display: ' + value,
      )
  }
  for (const route of [
    'accounts',
    'transactions',
    'spending',
    'investments?view=Overview',
    'investments?view=Holdings',
    'investments?view=Fixed%20Income',
    'net-worth',
    'goals',
  ]) {
    await page.goto(origin + '/#/' + route)
    await page.locator('.money:visible').first().waitFor()
    await page.waitForLoadState('networkidle')
    await verify()
    await page.screenshot({
      path: path.join(
        output,
        route.split('?')[0] +
          (route.includes('=') ? '-' + route.split('=')[1] : '') +
          '.png',
      ),
    })
  }
  await page.goto(origin + '/#/net-worth?end=2026-09-30&range=1Y')
  await page.locator('.net-worth-primary-line').waitFor()
  assert(
    (await page.locator('.net-worth-primary-line').innerText()).includes(
      'R$ 527.890,18',
    ),
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForFunction(
    () => document.documentElement.scrollWidth <= innerWidth,
    null,
    { timeout: 5000 },
  )
  await page.locator('.net-worth-source-chart .recharts-area-curve').waitFor()
  await page.screenshot({
    path: path.join(output, 'net-worth-mobile.png'),
    fullPage: true,
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  for (const language of ['pt-BR', 'es-419', 'en']) {
    await page.goto(origin + '/#/settings?view=appearance')
    await page
      .locator('.appearance-settings select')
      .last()
      .selectOption(language)
    await page.goto(origin + '/#/accounts')
    await page.locator('.money:visible').first().waitFor()
    await verify()
  }
  await page.locator('.demo-menu > summary').click()
  await page
    .getByLabel('Demo scenario', { exact: true })
    .selectOption('etf-showcase')
  await page.locator('.recharts-area-curve').first().waitFor()
  await page.waitForLoadState('networkidle')
  await verify()
  await page.goto(origin + '/#/investments?view=Holdings')
  await page.getByText('SIM-GLOBAL-ETF', { exact: true }).first().waitFor()
  await verify()
  assert((await page.locator('table').first().innerText()).includes('230,00'))
  await page.screenshot({ path: path.join(output, 'etf-holdings.png') })
  console.log(
    'Brazilian two-decimal display: accounts, ledger, spending, fixed income, ETFs, net worth, goals, languages and mobile PASS',
  )
}
