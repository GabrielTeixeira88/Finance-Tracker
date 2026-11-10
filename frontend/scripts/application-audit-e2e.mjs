// Application-wide audit in demo-e2e's exclusively owned temporary unified database.
import assert from 'node:assert/strict'
import path from 'node:path'
import { mkdir, writeFile, copyFile } from 'node:fs/promises'

export async function checkApplicationAudit(page, origin, root) {
  const filtered = process.env.AUDIT_SCREENS?.split(',')
  const output = path.join(
    root,
    filtered
      ? 'docs/screenshots/v014-audit-followup'
      : 'docs/screenshots/v014-audit',
  )
  await mkdir(output, { recursive: true })
  page.setDefaultTimeout(20000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const get = async (route) => {
    const response = await page.request.get(origin + '/api' + route)
    assert(response.ok(), route)
    return response.json()
  }
  const accounts = await get('/accounts'),
    assets = await get('/investments/assets')
  const manual = await get('/manual-positions')
  const checking = accounts.find((a) => a.name === 'Checking')
  const security = assets.find((a) => a.symbol === 'SIM-GLOBAL-ETF')
  const house = manual.find((a) => a.category === 'REAL_ESTATE'),
    car = manual.find((a) => a.category === 'VEHICLE')
  assert(checking && security && house && car, 'Required demo entities missing')
  const goals = await get('/goals?as_of=2026-09-30')
  const inventory = [
    [
      'spending',
      'dashboard?view=spending',
      'parity-reference-spending-spending-overview-dark.png',
    ],
    [
      'investments',
      'dashboard?view=investments',
      'parity-reference-investments-dashboard-dark.png',
    ],
    [
      'net-worth',
      'dashboard?view=net-worth',
      'parity-reference-networth-dashboard-dark.png',
    ],
    ['holdings', 'holdings', 'parity-reference-investments-holdings-dark.png'],
    ['assets', 'holdings?tab=assets', null],
    ['liabilities', 'holdings?tab=liabilities', null],
    [
      'security',
      `holdings?asset=${security.id}`,
      'parity-reference-investments-asset-dark.png',
    ],
    [
      'property',
      `holdings?tab=assets&position=${house.id}`,
      'parity-reference-networth-property-dark.png',
    ],
    ['vehicle', `holdings?tab=assets&position=${car.id}`, null],
    [
      'account',
      `account?account=${checking.id}`,
      'parity-reference-investments-account-dark.png',
    ],
    ['investment-activity', 'activities?view=investment-activity', null],
    ['transactions', 'activities?view=transactions', null],
    ['imports', 'activities?tool=imports&kind=bank', null],
    ['investment-imports', 'activities?tool=imports&kind=investment', null],
    ['review', 'activities?view=transactions&review_status=NEEDS_REVIEW', null],
    ['reconciliation', 'activities?tool=reconciliation', null],
    ['schedules', 'activities?tool=scheduled', null],
    [
      'budgets',
      'dashboard?view=spending&detail=budget',
      'v014-reference-spending-budget.png',
    ],
    [
      'spending-insights',
      'dashboard?view=spending&detail=insights&stage=where',
      'parity-reference-spending-spending-insights-dark.png',
    ],
    [
      'life-events',
      'dashboard?view=spending&detail=insights&stage=when',
      'parity-reference-spending-spending-events-dark.png',
    ],
    ['goals', 'goals', null],
    [
      'goal-detail',
      `goals?goal=${goals[0].goal.id}`,
      'parity-reference-goals-goal-dark.png',
    ],
    ['accrued-income', 'insights?view=income&mode=accrued', null],
    [
      'performance',
      'insights?view=performance',
      'parity-reference-performance-compare-dark.png',
    ],
    [
      'portfolio-insights',
      'insights?view=overview',
      'parity-reference-portfolio-insights-overview-dark.png',
    ],
    [
      'income',
      'insights?view=income',
      'v014-income-reference-summary-dark.png',
    ],
    ['accounts', 'accounts', null],
    ['settings', 'settings?view=index', null],
    ...[
      'general',
      'appearance',
      'groups',
      'spending',
      'securities',
      'classifications',
      'categories',
      'payees',
      'rules',
      'market',
      'gmail',
      'pluggy',
      'exports',
      'about',
    ].map((view) => [
      'settings-' + view,
      'settings?view=' + view,
      view === 'general' ? 'v014-settings-reference.png' : null,
    ]),
  ]
  const screens = filtered
    ? inventory.filter(([name]) => filtered.includes(name))
    : inventory
  assert(screens.length > 0, 'No audit screens selected')
  const quick = process.env.AUDIT_QUICK === '1'
  const viewports = quick
    ? [
        [1440, 900],
        [390, 844],
      ]
    : [
        [1920, 1080],
        [1440, 900],
        [1280, 800],
        [768, 1024],
        [390, 844],
      ]
  const results = []
  const external = []
  page.on('request', (r) => {
    if (
      !r.url().startsWith(origin) &&
      !r.url().startsWith('data:') &&
      !r.url().startsWith('blob:')
    )
      external.push(new URL(r.url()).origin)
  })
  await page.goto(origin)
  await page.locator('#main-content').waitFor()
  for (const mode of quick ? ['dark'] : ['dark', 'light']) {
    for (const [width, height] of viewports) {
      await page.setViewportSize({ width, height })
      await page.evaluate(
        (preferences) =>
          localStorage.setItem(
            'finance-tracker-preferences-demo',
            JSON.stringify(preferences),
          ),
        {
          mode,
          font: mode === 'dark' ? 'mono' : 'inter',
          language: 'en',
          palette: 'olive',
        },
      )
      for (const [name, route, reference] of screens) {
        const started = performance.now()
        await page.goto(origin + '/#/' + route)
        // A full document refresh verifies deep links and isolates each page's state.
        await page.reload()
        await page.locator('#main-content').waitFor()
        await page.waitForLoadState('networkidle')
        await page.evaluate(() => document.fonts.ready)
        await page.evaluate(() =>
          window.scrollTo({ top: 0, behavior: 'instant' }),
        )
        const state = await page.evaluate(() => {
          const controls = [...document.querySelectorAll('main button')].filter(
            (e) => e.getClientRects().length && !e.disabled,
          )
          const unnamed = controls
            .filter(
              (e) =>
                !e.textContent.trim() &&
                !e.getAttribute('aria-label') &&
                !e.getAttribute('title') &&
                !e.getAttribute('aria-labelledby'),
            )
            .map((e) => e.outerHTML.slice(0, 200))
          const overflowing = [...document.querySelectorAll('main *')]
            .filter(
              (e) =>
                e.getClientRects().length &&
                e.getBoundingClientRect().right > innerWidth + 2 &&
                getComputedStyle(e).position !== 'fixed' &&
                !e.closest(
                  '[role="dialog"],.overflow-x-auto,.table-scroll,.settings-table-scroll',
                ),
            )
            .slice(0, 8)
            .map((e) => e.tagName + '.' + String(e.className).slice(0, 100))
          const main = document.querySelector('main')
          return {
            wide: [...document.querySelectorAll('body *')]
              .filter(
                (e) => e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 2,
              )
              .slice(0, 25)
              .map((e) => ({
                element: e.tagName + '.' + String(e.className).slice(0, 100),
                client: e.clientWidth,
                scroll: e.scrollWidth,
                overflow: getComputedStyle(e).overflow,
                rect: e.getBoundingClientRect().toJSON(),
              })),
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
            documentWidth: document.documentElement.scrollWidth,
            overflowing,
            unnamed,
            alerts: [...document.querySelectorAll('main [role="alert"]')].map(
              (e) => e.textContent.slice(0, 250),
            ),
            headings: [...document.querySelectorAll('main h1,main h2')].map(
              (e) => e.textContent,
            ),
            rawKeys:
              (main?.innerText ?? '').match(
                /\b(?:wf[A-Z]\w*|settings_v014|spending|wealth|goals):[\w.]+\b/g,
              ) ?? [],
            rows: document.querySelectorAll('main tbody tr').length,
            chartPaths: document.querySelectorAll(
              'main .recharts-area-curve,main .recharts-line-curve,main .recharts-bar-rectangle',
            ).length,
          }
        })
        const filename = `${name}-${mode}-${width}.png`
        await page.screenshot({ path: path.join(output, filename) })
        results.push({
          screen: name,
          route,
          mode,
          width,
          height,
          reference: reference ?? null,
          screenshot: filename,
          ms: Math.round(performance.now() - started),
          ...state,
        })
        await writeFile(
          path.join(output, 'audit-results.json'),
          JSON.stringify(
            {
              screens: screens.length,
              captures: results.length,
              quick,
              results,
            },
            null,
            2,
          ),
        )
        if (width === 1440 && reference) {
          await copyFile(
            path.join(root, '.tmp', reference),
            path.join(output, reference),
          ).catch(() => {})
        }
      }
    }
  }
  // All major pages in each supported additional locale, at a long-label desktop width.
  for (const language of ['pt-BR', 'es-419']) {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.evaluate(
      (preferences) =>
        localStorage.setItem(
          'finance-tracker-preferences-demo',
          JSON.stringify(preferences),
        ),
      { mode: 'dark', font: 'inter', language, palette: 'olive' },
    )
    for (const [name, route] of screens) {
      await page.goto(origin + '/#/' + route)
      await page.reload()
      await page.locator('#main-content').waitFor()
      await page.waitForLoadState('networkidle')
      const text = await page.locator('#main-content').innerText()
      const filename = `${name}-${language}-1280.png`
      await page.screenshot({ path: path.join(output, filename) })
      results.push({
        screen: name,
        language,
        width: 1280,
        screenshot: filename,
        rawKeys:
          text.match(
            /\b(?:wf[A-Z]\w*|settings_v014|spending|wealth|goals):[\w.]+\b/g,
          ) ?? [],
        overflow: await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
      })
    }
  }
  assert.deepEqual(
    await get('/accounts'),
    accounts,
    'Read-only audit changed accounts',
  )
  assert.deepEqual([...new Set(external)], [], 'Unexpected external requests')
  await writeFile(
    path.join(output, 'audit-results.json'),
    JSON.stringify(
      { screens: screens.length, captures: results.length, quick, results },
      null,
      2,
    ),
  )
  await writeFile(
    path.join(output, 'index.html'),
    `<!doctype html><html lang="en"><meta charset="utf-8"><title>v0.14 application audit</title><style>body{background:#171717;color:#eee;font:14px system-ui;margin:24px}section{display:grid;grid-template-columns:1fr 1fr;gap:16px}img{width:100%}a{color:#abc}</style><h1>Application-wide audit</h1><p>Native captures. Official images may predate the pinned source. No upstream runtime comparison is claimed. Financial values are fictional.</p>${screens.map(([name, , reference]) => `<h2>${name}</h2><section>${reference ? `<figure><figcaption>Official reference (original resolution)</figcaption><img src="${reference}"></figure>` : ''}<figure><figcaption>Finance Tracker 1440 x 900</figcaption><img src="${name}-${reference && !reference.includes('dark') ? 'light' : 'dark'}-1440.png"></figure></section>`).join('')}`,
  )
  console.log(
    JSON.stringify(
      {
        screens: screens.length,
        captures: results.length,
        overflow: results
          .filter((r) => r.overflow)
          .map((r) => [r.screen, r.width, r.language ?? r.mode]),
        alerts: results
          .filter((r) => r.alerts?.length)
          .map((r) => [r.screen, r.alerts]),
        rawKeys: results.filter((r) => r.rawKeys.length).length,
      },
      null,
      2,
    ),
  )
  assert.deepEqual(
    results
      .filter(
        (row) =>
          row.overflow ||
          row.alerts?.length ||
          row.unnamed?.length ||
          row.rawKeys?.length,
      )
      .map((row) => [row.screen, row.width, row.language ?? row.mode]),
    [],
    'Resolve audit findings before treating this inventory as passing',
  )
}
