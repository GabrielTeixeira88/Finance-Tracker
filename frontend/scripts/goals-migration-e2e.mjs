import assert from 'node:assert/strict'
import { mkdir, writeFile, copyFile } from 'node:fs/promises'
import path from 'node:path'
export async function checkGoalsMigration(page, origin, root) {
  const output = path.join(root, 'docs/screenshots/v014-goals')
  await mkdir(output, { recursive: true })
  page.setDefaultTimeout(10000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const get = async (pathname) => {
    const r = await page.request.get(origin + '/api' + pathname)
    assert(r.ok(), await r.text())
    return r.json()
  }
  const goals = () => get('/goals?as_of=2026-09-30')
  const before = await get('/accounts')
  const worth = await get('/net-worth/summary?as_of=2026-09-30')
  const seeded = await goals()
  assert.equal(seeded.length, 7)
  const wedding = seeded.find((g) => g.goal.name === 'Wedding celebration')
  const emergency = seeded.find((g) => g.goal.name === 'Emergency reserve')
  assert.equal(wedding.saved, '4800.000000')
  assert(emergency.funding_account_id)
  const visit = async (route, heading = 'Goals') => {
    await page.goto(origin + '/#/' + route)
    await page
      .getByRole('heading', { name: heading, exact: true, level: 1 })
      .waitFor({ timeout: 60000 })
    await page.waitForLoadState('networkidle')
    if (route === 'goals')
      await page
        .locator('.goals-workspace a[href*="goal="]')
        .first()
        .waitFor({ timeout: 60000 })
  }
  const shot = async (name) => {
    await page.evaluate(() => {
      window.scrollTo(0, 0)
      document
        .querySelectorAll('[data-page-scroll-container],main')
        .forEach((e) => (e.scrollTop = 0))
    })
    await page.screenshot({ path: path.join(output, name + '.png') })
  }
  const editPlan = () =>
    page
      .getByRole('button', { name: 'Edit Savings Inputs', exact: true })
      .click()
  const fillMoney = async (label, value) => {
    const field = page.getByRole('textbox', { name: label, exact: true })
    await field.focus()
    const separator = (await field.inputValue()).includes(',') ? ',' : '.'
    await field.fill(value.replace('.', separator))
    await field.press('Tab')
  }
  const saved = async (id) => get('/goals/' + id + '?as_of=2026-09-30')
  const action = async (name) => {
    await page
      .getByRole('button', { name: 'More options', exact: true })
      .click()
    await page.getByRole('button', { name, exact: true }).click()
  }
  const confirm = async () => {
    await page.getByRole('alertdialog').waitFor()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Confirm', exact: true })
      .click()
    await page
      .locator('[data-slot=alert-dialog-content]')
      .waitFor({ state: 'detached' })
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await visit('goals')
  assert.equal(
    await page.locator('.goals-workspace a[href*="goal="]').count(),
    6,
  )
  await page.getByRole('button', { name: 'Archived (1)', exact: true }).click()
  await page.getByRole('link', { name: /Photography workshop/ }).waitFor()
  await shot('dashboard-dark-1440')
  await page.getByRole('link', { name: /Wedding celebration/ }).click()
  await page
    .getByRole('heading', {
      name: 'Wedding celebration',
      exact: true,
      level: 1,
    })
    .waitFor()
  await page.locator('.recharts-line-curve').first().waitFor()
  await shot('detail-dark-1440')
  await page.getByText('Milestones', { exact: true }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(output, 'milestones-dark-1440.png') })
  const chart = page.locator('.recharts-wrapper').first()
  await chart.scrollIntoViewIfNeeded()
  const chartBox = await chart.boundingBox()
  assert(chartBox)
  await page.mouse.move(
    chartBox.x + chartBox.width * 0.55,
    chartBox.y + chartBox.height * 0.5,
  )
  await page
    .locator('.recharts-tooltip-wrapper')
    .first()
    .waitFor({ state: 'visible' })
  await page.screenshot({
    path: path.join(output, 'chart-tooltip-dark-1440.png'),
  })
  await page.mouse.move(0, 0)

  await editPlan()
  await page.getByRole('button', { name: /^Pick a date/ }).click()
  await page.getByRole('button', { name: /September 15, 2027/ }).click()
  await fillMoney('Target amount', '21000')
  await fillMoney('Monthly contribution', '1500.123456')
  await page.waitForResponse((r) => r.url().includes('/preview') && r.ok())
  await page.waitForTimeout(450)
  assert.equal((await saved(wedding.goal.id)).plan.monthly, '1200.000000')
  await shot('planner-dark-1440')
  await page
    .getByRole('button', { name: 'Cancel', exact: true })
    .first()
    .click()
  assert.equal((await saved(wedding.goal.id)).plan.monthly, '1200.000000')
  await editPlan()
  await fillMoney('Monthly contribution', '1400.123456')
  await page.waitForResponse((r) => r.url().includes('/preview') && r.ok())
  await page.getByRole('button', { name: 'Save', exact: true }).first().click()
  await page
    .getByRole('button', { name: 'Edit Savings Inputs', exact: true })
    .waitFor()
  assert.equal((await saved(wedding.goal.id)).plan.monthly, '1400.123456')
  await editPlan()
  await fillMoney('Target amount', '23000')
  await page.waitForTimeout(450)
  page.removeAllListeners('dialog')
  page.once('dialog', (dialog) => dialog.dismiss())
  await page
    .locator('.goals-page-header')
    .getByRole('button', { name: 'Back', exact: true })
    .click()
  assert(
    page.url().includes('goal=' + wedding.goal.id),
    'Keep scenario must prevent navigation',
  )
  page.on('dialog', (dialog) => dialog.accept())
  await page
    .locator('.goals-page-header')
    .getByRole('button', { name: 'Back', exact: true })
    .click()
  await page
    .getByRole('heading', { level: 1, name: 'Goals', exact: true })
    .waitFor()
  assert.equal((await saved(wedding.goal.id)).goal.target, '20000.000000')
  await visit('goals?goal=' + wedding.goal.id, 'Wedding celebration')
  await action('Edit goal')
  await page
    .getByRole('dialog')
    .getByLabel('Title', { exact: true })
    .fill('Wedding celebration updated')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Save changes', exact: true })
    .click()
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  await page
    .getByRole('heading', {
      level: 1,
      name: 'Wedding celebration updated',
      exact: true,
    })
    .waitFor()
  await page
    .getByRole('button', { name: 'Edit goal funding', exact: true })
    .click()
  await fillMoney('Amount', '200')
  await page
    .locator('.goal-funding-card')
    .getByRole('button', { name: 'Save', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Edit goal funding', exact: true })
    .waitFor()
  assert.equal((await saved(wedding.goal.id)).saved, '5000.000000')
  await page
    .getByRole('button', { name: 'Edit goal funding', exact: true })
    .click()
  await fillMoney('Amount', '100')
  await page.getByLabel('Entry type', { exact: true }).selectOption('OUT')
  await page
    .locator('.goal-funding-card')
    .getByRole('button', { name: 'Save', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Edit goal funding', exact: true })
    .waitFor()
  assert.equal((await saved(wedding.goal.id)).saved, '4900.000000')
  await page.getByRole('button', { name: 'Details', exact: true }).click()
  await page.getByRole('table', { name: 'Shared savings' }).waitFor()
  await shot('funding-history-dark-1440')
  await page.keyboard.press('Escape')
  await visit('goals')
  await page.getByRole('link', { name: 'New Goal', exact: true }).click()
  await shot('templates-dark-1440')
  await page.getByRole('button', { name: /Savings Goal/ }).click()
  await page.getByLabel('Title', { exact: true }).fill('Browser savings goal')
  await fillMoney('Target amount', '1000')
  await shot('creation-dark-1440')
  await page.getByRole('button', { name: 'Create Goal', exact: true }).click()
  await page
    .getByRole('heading', {
      name: 'Browser savings goal',
      exact: true,
      level: 1,
    })
    .waitFor()
  const created = (await goals()).find(
    (g) => g.goal.name === 'Browser savings goal',
  )
  assert(created)
  await page
    .getByRole('button', { name: 'Edit goal funding', exact: true })
    .click()
  await page
    .locator('.goal-funding-card')
    .getByRole('button', { name: /Savings/ })
    .click()
  await fillMoney('Savings', '100.123456')
  await page
    .locator('.goal-funding-card')
    .getByRole('button', { name: 'Save', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Edit goal funding', exact: true })
    .waitFor()
  assert.equal((await saved(created.goal.id)).saved, '100.123456')
  await action('Archived')
  await confirm()
  assert.equal((await saved(created.goal.id)).saved, '0.000000')
  await action('Restore goal')
  await confirm()
  assert.equal((await saved(created.goal.id)).saved, '0.000000')
  await action('Delete goal')
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Delete', exact: true })
    .click()
  await page
    .getByRole('heading', { name: 'Goals', exact: true, level: 1 })
    .waitFor()
  assert((await saved(created.goal.id)).deleted)
  await visit('goals?goal=' + emergency.goal.id, 'Emergency reserve')
  assert.equal((await saved(emergency.goal.id)).saved, emergency.saved)
  await page
    .getByText('Whole investment account · gross dated value', { exact: true })
    .waitFor()
  await shot('caixinha-dark-1440')
  // Source layout checks at matching/reference and additional responsive widths.
  for (const [width, height] of [
    [1920, 1080],
    [1024, 900],
    [768, 1024],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height })
    await visit('goals')
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      'Dashboard overflow ' + width,
    )
    await shot('dashboard-dark-' + width)
    await visit('goals?goal=' + wedding.goal.id, 'Wedding celebration updated')
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      'Detail overflow ' + width,
    )
    await shot('detail-dark-' + width)
    if (width === 390) {
      const mobileChart = page.locator('.recharts-wrapper').first()
      await mobileChart.scrollIntoViewIfNeeded()
      await page.waitForTimeout(250)
      const mobileGeometry = await mobileChart.evaluate((e) => ({
        width: e.getBoundingClientRect().width,
        height: e.getBoundingClientRect().height,
        svgWidth: Number(e.querySelector('svg')?.getAttribute('width')),
        pathCount: [...e.querySelectorAll('path.recharts-curve')].filter(
          (p) => p.getAttribute('d')?.length,
        ).length,
      }))
      assert(
        mobileGeometry.width > 250,
        'Mobile chart must not collapse inside Recharts measurement wrapper',
      )
      assert.equal(mobileGeometry.height, 300)
      assert.equal(mobileGeometry.svgWidth, mobileGeometry.width)
      assert(
        mobileGeometry.pathCount >= 3,
        'Mobile recorded/projection/target series must render',
      )
      await writeFile(
        path.join(output, 'mobile-chart-geometry.json'),
        JSON.stringify(mobileGeometry, null, 2),
      )
      await mobileChart.screenshot({
        path: path.join(output, 'chart-dark-390.png'),
      })
      await page
        .getByText('Milestones', { exact: true })
        .scrollIntoViewIfNeeded()
      await page.screenshot({
        path: path.join(output, 'milestones-dark-390.png'),
      })
      await action('Edit goal')
      await page.getByRole('dialog').waitFor()
      await page.screenshot({
        path: path.join(output, 'edit-dialog-dark-390.png'),
      })
      await page.keyboard.press('Escape')
      await page.getByRole('dialog').waitFor({ state: 'hidden' })
    }
  }
  await page
    .getByRole('button', { name: 'Open navigation', exact: true })
    .click()
  await page
    .getByRole('dialog', { name: 'Navigation' })
    .getByRole('button', { name: 'Goals', exact: true })
    .click()
  await page
    .getByRole('heading', { level: 1, name: 'Goals', exact: true })
    .waitFor()
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(origin + '/#/settings?view=appearance')
  await page.getByRole('button', { name: 'Light', exact: true }).click()
  await visit('goals')
  await shot('dashboard-light-1440')
  await visit('goals?goal=' + wedding.goal.id, 'Wedding celebration updated')
  await shot('detail-light-1440')
  const after = await get('/accounts')
  assert.deepEqual(
    after.map((r) => [r.id, r.balance]),
    before.map((r) => [r.id, r.balance]),
  )
  assert.deepEqual(await get('/net-worth/summary?as_of=2026-09-30'), worth)
  await copyFile(
    path.join(root, '.tmp/parity-reference-goals-goal-dark.png'),
    path.join(output, 'reference-detail-dark-1440.png'),
  )
  await copyFile(
    path.join(root, '.tmp/wealth-reference-goals.png'),
    path.join(output, 'reference-dashboard-composite.png'),
  )
  await writeFile(
    path.join(output, 'validation.json'),
    JSON.stringify(
      {
        status: 'PASS',
        checks: [
          '7 seeded goals',
          'templates/create',
          'exact preview/cancel/save',
          'manual contribution/withdrawal',
          'account allocation',
          'archive/restore releases',
          'soft delete',
          'Caixinha retained',
          'milestones/history',
          'chart hover tooltip and mobile milestones/edit dialog',
          'calendar date and target preview',
          'dirty navigation keep/discard',
          'mobile navigation',
          'responsive 1440/1920/1024/768/390',
          'light/dark',
          'balances and Net Worth unchanged',
        ],
        seeded: seeded.map((g) => ({
          name: g.goal.name,
          saved: g.saved,
          plan: g.plan,
          status: g.goal.status,
        })),
      },
      null,
      2,
    ),
  )
  await writeFile(
    path.join(output, 'index.html'),
    `<!doctype html><html lang="en"><meta charset="utf-8"><title>Goals source migration</title><style>body{background:#181818;color:#ddd;font:15px system-ui}section{display:grid;grid-template-columns:1fr 1fr;gap:16px}img{width:100%}h1,h2{font-weight:500}</style><h1>Goals v0.14 comparison</h1><p>Cached official dark detail at 1440×900 alongside Finance Tracker at the same resolution. Reference runtime unavailable; reference screenshot may predate pinned source. Different amounts and approved funding/zero-return boundaries are intentional.</p><h2>Detail — dark 1440×900</h2><section><img src="reference-detail-dark-1440.png"><img src="detail-dark-1440.png"></section><h2>Dashboard — marketing composite (not matching viewport)</h2><section><img src="reference-dashboard-composite.png"><img src="dashboard-light-1440.png"></section><h2>Planner</h2><img src="planner-dark-1440.png" alt="Editable exact savings plan"><h2>Chart and milestones</h2><img src="chart-tooltip-dark-1440.png" alt="Actual API-backed chart tooltip and milestones"><h2>Templates and funding history</h2><section><img src="templates-dark-1440.png" alt="Goal templates"><img src="funding-history-dark-1440.png" alt="Funding details"></section><h2>Mobile</h2><section><img style="max-width:390px" src="detail-dark-390.png" alt="Mobile goal detail"><img style="max-width:390px" src="milestones-dark-390.png" alt="Mobile milestones"></section><section><img style="max-width:390px" src="chart-dark-390.png" alt="324 by 300 pixel mobile chart"><img style="max-width:390px" src="edit-dialog-dark-390.png" alt="Mobile edit dialog"></section></html>`,
  )
}
