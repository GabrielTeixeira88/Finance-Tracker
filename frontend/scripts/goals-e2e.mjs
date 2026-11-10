import assert from 'node:assert/strict'
import path from 'node:path'

// Called only by the existing runner that owns an isolated, migrated demo workspace.
export async function checkGoals(page, origin, output) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  const collapse = page.getByRole('button', {
    name: 'Collapse sidebar',
    exact: true,
  })
  if (await collapse.count()) await collapse.click()
  for (const mode of ['Dark', 'Light']) {
    await page.goto(origin + '/#/settings?view=appearance')
    await page.getByRole('button', { name: mode, exact: true }).click()
    await page.goto(origin + '/#/goals')
    const studio = page.getByRole('button', {
      name: 'Home studio',
      exact: true,
    })
    await studio.waitFor()
    assert.equal(await page.locator('.goal-visual').count(), 5)
    assert.equal(await page.locator('.goal-visual img').count(), 0)
    assert(
      !(await page.locator('.goal-visual-grid').innerText()).includes(
        'Synthetic',
      ),
    )
    assert((await studio.innerText()).includes('13,33%'))
    assert((await studio.innerText()).includes('R$ 2.000,00'))
    const funding = page.locator('.goal-funding-overview')
    const fundingSummary = funding.locator('summary')
    assert.equal(await funding.getAttribute('open'), null)
    assert.equal(
      await page.getByText('Goal - Status', { exact: true }).count(),
      0,
    )
    await fundingSummary.focus()
    await page.keyboard.press('Enter')
    const fundingTable = page.getByRole('table', {
      name: 'Funding overview',
      exact: true,
    })
    await fundingTable.waitFor()
    const savings = fundingTable.getByRole('row').filter({ hasText: 'Savings' })
    assert((await savings.innerText()).includes('R$ 48.000,00'))
    assert((await savings.innerText()).includes('R$ 25.000,00'))
    assert((await savings.innerText()).includes('R$ 23.000,00'))
    await page.screenshot({
      path: path.join(
        output,
        `goals-funding-expanded-${mode.toLowerCase()}.png`,
      ),
    })
    await fundingSummary.focus()
    await page.keyboard.press('Enter')
    await fundingTable.waitFor({ state: 'hidden' })
    await fundingSummary.evaluate((el) => el.blur())
    assert(
      (await studio.textContent()).includes('1y 3m left'),
      'Countdown must use the demo financial date',
    )
    const vehicle = page.getByRole('button', {
      name: 'Vehicle upgrade',
      exact: true,
    })
    assert((await vehicle.textContent()).includes('Off track'))
    assert.equal(
      await vehicle.locator('.goal-card-completion.negative').count(),
      1,
    )
    assert.equal(await vehicle.locator('.goal-card-fill.is-overdue').count(), 1)
    const emergency = page.getByRole('button', {
      name: 'Emergency fund',
      exact: true,
    })
    assert.equal(
      await emergency.locator('.goal-card-completion.is-positive').count(),
      1,
    )
    assert.notEqual(
      await vehicle
        .locator('.goal-card-completion')
        .evaluate((el) => getComputedStyle(el).color),
      await emergency
        .locator('.goal-card-completion')
        .evaluate((el) => getComputedStyle(el).color),
      'Behind-schedule progress must not use the positive color',
    )
    for (const width of [1440, 1920, 390]) {
      await page.setViewportSize({
        width,
        height: width === 390 ? 844 : width === 1920 ? 1080 : 900,
      })
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        'Goals page must not overflow',
      )
      const columns = await page
        .locator('.goal-visual-grid')
        .evaluate(
          (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length,
        )
      assert.equal(columns, width === 390 ? 1 : 3)
      await page.mouse.move(70, 0)
      await page.screenshot({
        path: path.join(output, `goals-${mode.toLowerCase()}-${width}.png`),
      })
    }
    await page.setViewportSize({ width: 1440, height: 900 })
    await studio.focus()
    await page.keyboard.press('Enter')
    await page
      .getByRole('heading', { name: 'Home studio', exact: true })
      .waitFor()
    assert(page.url().includes('goal='))
    await page.locator('.entity-back').click()
    await studio.waitFor()
  }
}
