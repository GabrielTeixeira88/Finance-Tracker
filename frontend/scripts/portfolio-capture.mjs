// Curated portfolio evidence, not the legacy v0.12 screenshot/test campaign.
// Creates a new owned demo root; never attaches/reset a saved or personal workspace.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { mkdir, mkdtemp, writeFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = fileURLToPath(new URL('../../', import.meta.url))
const output = path.join(root, 'docs/screenshots/v014')
const port = process.env.PORTFOLIO_PORT || '5174'
assert(['8001', '5174'].includes(port), 'Use an approved loopback demo port')
await new Promise((resolve, reject) => {
  const probe = createServer()
  probe.once('error', reject)
  probe.listen(Number(port), '127.0.0.1', () => probe.close(resolve))
})
await mkdir(path.join(root, '.tmp'), { recursive: true })
await mkdir(output, { recursive: true })
const workspace = await mkdtemp(path.join(root, '.tmp/portfolio-v014-'))
const origin = `http://127.0.0.1:${port}`
const normalGuard = path.join(workspace, 'never-open-personal.db')
const python = path.join(
  root,
  'backend/.venv',
  process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
)
const source = `from pathlib import Path
import os, uvicorn
from app.demo.app import create_demo_app
uvicorn.run(create_demo_app(Path(os.environ['DATABASE_PATH']), Path(os.environ['PORTFOLIO_DEMO_ROOT']), scenario='unified'), host='127.0.0.1', port=${port}, access_log=False, log_level='warning')`
const server = spawn(python, ['-c', source], {
  cwd: path.join(root, 'backend'),
  env: {
    ...process.env,
    DATABASE_PATH: normalGuard,
    PORTFOLIO_DEMO_ROOT: path.join(workspace, 'owned-demo'),
    PYTHON_KEYRING_BACKEND: 'keyring.backends.null.Keyring',
  },
  windowsHide: true,
  stdio: ['ignore', 'ignore', 'pipe'],
})
let serverLog = ''
server.stderr.on('data', (chunk) => (serverLog += chunk.toString()))
let browser
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const screens = [
  [
    'investments',
    'dashboard?view=investments&range=ALL',
    '.investment-source-dashboard .recharts-surface',
    'Investments overview',
  ],
  [
    'spending',
    'dashboard?view=spending&start=2026-09-01&end=2026-09-30',
    '.wf-spending .recharts-bar-rectangle',
    'Spending',
  ],
  ['holdings', 'holdings', '.wf-workspace table', 'Holdings'],
  [
    'performance',
    'insights?view=performance&range=1Y',
    '.performance-chart-region .recharts-line-curve',
    'Performance',
  ],
  [
    'portfolio-insights',
    'insights?view=overview',
    '[data-widget-id=composition] .recharts-surface',
    'Portfolio Insights',
  ],
  [
    'net-worth',
    'dashboard?view=net-worth&range=ALL',
    '.net-worth-v014 .recharts-surface',
    'Net Worth',
  ],
  ['goals', 'goals', '.goals-workspace a[href*="goal="]', 'Goals'],
  ['activities', 'activities?view=transactions', 'main table', 'Activities'],
  [
    'budgets',
    'dashboard?view=spending&detail=budget',
    'button[aria-label="Expand group"]',
    'Monthly budgets',
  ],
  [
    'income',
    'insights?view=income&range=ALL',
    '.income-history-chart .recharts-surface',
    'Investment income',
  ],
]
const failures = []
const evidence = []
const viewport = { width: 1600, height: 1000 }
const preferences = {
  mode: 'dark',
  font: 'inter',
  palette: 'olive',
  language: 'en',
}
const prepareContext = async (context) => {
  await context.addInitScript(
    ({ saved, applicationOrigin }) => {
      if (location.origin !== applicationOrigin) return
      localStorage.setItem(
        'finance-tracker-preferences-demo',
        JSON.stringify(saved),
      )
      localStorage.setItem('finance-tracker-sidebar-demo', 'expanded')
    },
    { saved: preferences, applicationOrigin: origin },
  )
  context.on('page', (page) => {
    page.setDefaultTimeout(60000)
    page.on('pageerror', (error) => failures.push(error.message))
    page.on('response', (response) => {
      if (
        response.url().startsWith(origin + '/api/') &&
        response.status() >= 400
      )
        failures.push(
          `${response.status()} ${new URL(response.url()).pathname}`,
        )
    })
    page.on('request', (request) => {
      assert(
        request.url().startsWith(origin) || /^(data|blob):/.test(request.url()),
        'Capture must not request external providers',
      )
    })
  })
}
const visit = async (page, screen) => {
  const [, route, marker] = screen
  await page.goto(origin + '/#/' + route)
  await page.locator('#main-content').waitFor()
  const skip = page.getByRole('button', { name: 'Skip tour', exact: true })
  if (await skip.isVisible()) await skip.click()
  await page.locator(marker).first().waitFor()
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  await page.waitForFunction(() => {
    const messages = [...document.querySelectorAll('main [role="status"]')]
    return !messages.some((el) => /loading/i.test(el.textContent || ''))
  })
  await page.mouse.move(1450, 25)
  await sleep(800)
  assert.equal(await page.locator('main [role="alert"]').count(), 0, route)
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    route,
  )
}
try {
  for (let i = 0; i < 360; i++) {
    if (server.exitCode !== null)
      throw new Error('Owned demo server failed; see local server log')
    try {
      if ((await fetch(origin + '/api/runtime')).ok) break
    } catch {
      /* Owned server is still preparing its new fixture. */
    }
    assert(i < 359, 'Owned demo startup timeout')
    await sleep(250)
  }
  const get = async (route) => {
    const response = await fetch(origin + '/api' + route)
    assert(response.ok, route)
    return response.json()
  }
  const runtime = await get('/runtime')
  assert.equal(runtime.scenario, 'unified')
  const before = await get('/accounts')
  const dashboard = await get('/dashboard?month=2026-09')
  assert.equal(dashboard.totals[0].income, '9800.000000')
  assert.equal(dashboard.totals[0].expenses, '4184.820000')
  const assets = await get('/investments/assets')
  const proxy = assets.find((asset) => asset.symbol === 'SIM-GLOBAL-ETF')
  assert(proxy, 'Fictional price-only benchmark available')
  screens[3][1] += '&benchmark=' + proxy.id
  browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL || 'msedge',
    headless: true,
  })
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    locale: 'en-US',
    reducedMotion: 'reduce',
  })
  await prepareContext(context)
  const page = await context.newPage()
  for (const screen of screens) {
    await visit(page, screen)
    const [name, route, , title] = screen
    const filename = name + '.jpg'
    await page.screenshot({
      path: path.join(output, filename),
      type: 'jpeg',
      quality: 83,
    })
    evidence.push({
      name,
      title,
      route,
      filename,
      bytes: (await stat(path.join(output, filename))).size,
    })
    console.log('Captured ' + name)
  }
  await context.close()
  let video = null
  if (process.argv.includes('--record')) {
    // Genuine browser frames; no injected presentation overlays or simulated screens.
    const recording = await browser.newContext({
      viewport,
      deviceScaleFactor: 1,
      colorScheme: 'dark',
      locale: 'en-US',
      recordVideo: { dir: path.join(workspace, 'video'), size: viewport },
    })
    await prepareContext(recording)
    const movie = await recording.newPage()
    const started = performance.now()
    const scenes = [
      [0, 0, 13],
      [13, 1, 14],
      [27, 7, 12],
      [39, 8, 10],
      [49, 2, 11],
      [60, 3, 12],
      [72, 4, 12],
      [84, 5, 14],
      [98, 6, 12],
      [110, 0, 10],
    ]
    const timings = []
    for (const [target, index, duration] of scenes) {
      const wait = target * 1000 - (performance.now() - started)
      if (wait > 0) await sleep(wait)
      await visit(movie, screens[index])
      timings.push({
        screen: screens[index][0],
        seconds: Math.round((performance.now() - started) / 1000),
      })
      console.log('Recorded scene ' + screens[index][0])
      await sleep(
        Math.max(0, (target + duration) * 1000 - (performance.now() - started)),
      )
    }
    const recordingFile = movie.video()
    await recording.close()
    await recordingFile.saveAs(path.join(output, 'walkthrough.webm'))
    video = {
      filename: 'walkthrough.webm',
      seconds: Math.round((performance.now() - started) / 1000),
      timings,
      bytes: (await stat(path.join(output, 'walkthrough.webm'))).size,
    }
    assert(
      video.bytes < 12 * 1024 * 1024,
      'Review/compress oversized video before publication',
    )
  }
  assert.deepEqual(
    await get('/accounts'),
    before,
    'Read-only capture must preserve balances and account records',
  )
  assert.deepEqual(failures, [], 'No browser/API errors in captured views')
  assert.equal(
    await stat(normalGuard).then(
      () => true,
      () => false,
    ),
    false,
    'Normal database guard never opened',
  )
  await writeFile(
    path.join(workspace, 'capture-validation.json'),
    JSON.stringify(
      {
        viewport,
        evidence,
        video,
        browserErrors: failures,
        accountBalancesUnchanged: true,
        normalDatabaseNeverOpened: true,
      },
      null,
      2,
    ),
  )
  await writeFile(
    path.join(output, 'capture-manifest.json'),
    JSON.stringify(
      {
        version: '0.14.0',
        captured: '2026-11-21',
        viewport,
        theme: 'Classic dark',
        font: 'Inter',
        zoom: '100%',
        provenance:
          'Fictional unified ledger; official CDI/Treasury inputs and simulated SIM security quotes remain distinct. Not real investor returns.',
        screens: evidence,
        video,
      },
      null,
      2,
    ) + '\n',
  )
  console.log(
    JSON.stringify({
      result: 'PASS',
      screenshots: evidence.length,
      video,
      validation: path.relative(root, workspace),
    }),
  )
} catch (error) {
  await writeFile(path.join(workspace, 'capture-failure.txt'), String(error))
  throw error
} finally {
  await browser?.close()
  server.kill()
  await writeFile(path.join(workspace, 'server.log'), serverLog)
}
