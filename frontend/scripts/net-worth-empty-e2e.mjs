// Real empty/missing-data FastAPI + migrated SQLite, in an owned temporary root.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const root = fileURLToPath(new URL('../../', import.meta.url)),
  origin = 'http://127.0.0.1:5174'
try {
  await fetch(origin + '/api/health')
  throw new Error('Port 5174 is already in use')
} catch (e) {
  if (!e.cause) throw e
}
const output = path.join(root, 'docs/screenshots/v014-dashboards')
await mkdir(output, { recursive: true })
const python = path.join(
  root,
  'backend/.venv',
  process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
)
const source = `import os,sys,tempfile
from pathlib import Path
from contextlib import asynccontextmanager
root=Path(tempfile.mkdtemp(prefix='v014-empty-',dir=Path(sys.argv[1])/'.tmp'))
os.environ['DATABASE_PATH']=str(root/'empty.db')
os.environ['PYTHON_KEYRING_BACKEND']='keyring.backends.null.Keyring'
os.environ['BRAPI_API_TOKEN']=''
os.environ['ALPHA_VANTAGE_API_KEY']=''
os.environ['GOOGLE_OAUTH_CLIENT_ID']=''
os.environ['GOOGLE_OAUTH_CLIENT_SECRET']=''
from alembic import command
from alembic.config import Config
config=Config('alembic.ini')
command.upgrade(config,'head')
from app.main import app
from fastapi.staticfiles import StaticFiles
import uvicorn
@asynccontextmanager
async def isolated_lifespan(app):
    yield
app.router.lifespan_context=isolated_lifespan
app.mount('/',StaticFiles(directory=str(Path(sys.argv[1])/'frontend/dist'),html=True))
uvicorn.run(app,host='127.0.0.1',port=5174,access_log=False)
`
const server = spawn(python, ['-c', source, root], {
  cwd: path.join(root, 'backend'),
  windowsHide: true,
  stdio: ['ignore', 'ignore', 'pipe'],
})
let stderr = '',
  browser
server.stderr.on('data', (chunk) => {
  stderr += chunk.toString()
})
try {
  let ready = false
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null) throw Error(stderr)
    try {
      ready = (await fetch(origin + '/api/health')).ok
    } catch {
      /* startup */
    }
    if (ready) break
    await new Promise((r) => setTimeout(r, 250))
  }
  assert(ready, 'Empty app startup timed out')
  browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL || 'msedge',
    headless: true,
  })
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
    reducedMotion: 'reduce',
  })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(origin + '/#/settings?view=appearance')
  await page.getByRole('button', { name: 'Light', exact: true }).click()
  await page.getByLabel('Font family', { exact: true }).selectOption('inter')
  await page.goto(
    origin + '/#/dashboard?view=investments&end=2026-09-30&range=YTD',
  )
  await page.getByText('No investment accounts yet', { exact: true }).waitFor()
  await page.getByText('No investment holdings yet', { exact: true }).waitFor()
  await page.getByText('No active savings goals', { exact: true }).waitFor()
  assert.equal(
    await page.locator('.dashboard-history-chart .recharts-surface').count(),
    0,
  )
  await page.screenshot({
    path: path.join(output, 'investments-empty-light-1440.png'),
  })
  await page.goto(origin + '/#/net-worth?end=2026-09-30&range=YTD')
  await page.getByText('No financial records yet', { exact: true }).waitFor()
  await page.getByText('No history yet', { exact: true }).waitFor()
  assert.deepEqual(
    await (await page.request.get(origin + '/api/accounts')).json(),
    [],
  )
  assert.equal(
    await page.locator('.net-worth-source-chart .recharts-surface').count(),
    0,
  )
  await page.screenshot({ path: path.join(output, 'empty-light-1440.png') })
  const post = async (path, data) => {
    const response = await page.request.post(origin + '/api' + path, { data })
    assert(response.ok(), await response.text())
    return response.json()
  }
  await post('/accounts', {
    name: 'Fictional zero brokerage',
    type: 'INVESTMENT',
    currency: 'BRL',
    opening_balance: '0',
    opening_date: '2026-01-01',
  })
  await page.goto(
    origin + '/#/dashboard?view=investments&end=2026-09-30&range=YTD',
  )
  await page.getByTestId('portfolio-balance').waitFor()
  assert(
    (await page.getByTestId('portfolio-balance').innerText()).includes('0,00'),
  )
  const loan = await post('/manual-positions', {
    name: 'Fictional recorded debt',
    kind: 'LIABILITY',
    category: 'LOAN',
    currency: 'BRL',
    start_date: '2026-01-01',
  })
  await post(`/manual-positions/${loan.id}/observations`, {
    effective_date: '2026-01-01',
    amount: '500.123456',
  })
  await page.goto(
    origin + '/#/dashboard?view=net-worth&end=2026-09-30&range=YTD',
  )
  await page.getByRole('heading', { name: /500,12/ }).waitFor()
  assert(
    (await page.locator('.net-worth-primary-line').innerText()).includes('-'),
  )
  await page.screenshot({ path: path.join(output, 'negative-light-1440.png') })
  const created = await page.request.post(origin + '/api/manual-positions', {
    data: {
      name: 'Synthetic missing valuation',
      kind: 'ASSET',
      category: 'REAL_ESTATE',
      currency: 'BRL',
      start_date: '2026-01-01',
    },
  })
  assert.equal(created.status(), 201)
  await page.reload()
  await page
    .getByRole('alert')
    .filter({ hasText: 'Incomplete valuation' })
    .waitFor()
  assert(
    (await page.locator('.net-worth-primary-line').innerText()).includes(
      'Unavailable',
    ),
  )
  assert.equal(await page.locator('.net-worth-composition').count(), 0)
  await page.screenshot({
    path: path.join(output, 'unavailable-light-1440.png'),
  })
  // Test the retry interaction without inventing a financial response.
  let fail = true
  await page.route('**/api/net-worth/history?**', async (route) => {
    if (fail)
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: '{"detail":"Synthetic test outage"}',
      })
    else await route.continue()
  })
  await page.reload()
  await page.getByRole('button', { name: 'Retry', exact: true }).waitFor()
  await page.screenshot({ path: path.join(output, 'error-light-1440.png') })
  fail = false
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await page.locator('.net-worth-source-overview').waitFor()
  await post('/accounts', {
    name: 'Fictional missing-FX brokerage',
    type: 'INVESTMENT',
    currency: 'USD',
    opening_balance: '100',
    opening_date: '2026-01-01',
  })
  await page.goto(
    origin + '/#/dashboard?view=investments&end=2026-09-30&range=YTD',
  )
  await page.getByTestId('portfolio-balance').waitFor()
  await page.getByText('Unavailable', { exact: true }).first().waitFor()
  assert(
    (await page.getByTestId('portfolio-balance').innerText()).includes(
      'Unavailable',
    ),
  )
  await page.screenshot({
    path: path.join(output, 'investments-unavailable-light-1440.png'),
  })
  await page.setViewportSize({ width: 390, height: 844 })
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  )
  assert.deepEqual(errors, [])
  await writeFile(
    path.join(output, 'empty-validation.json'),
    JSON.stringify(
      {
        empty: true,
        missing: true,
        investments_empty: true,
        zero: true,
        negative: true,
        investment_missing_fx: true,
        retry: true,
        mobile: true,
        normal_database_untouched: true,
      },
      null,
      2,
    ),
  )
  console.log(
    'Empty/missing-data/retry Net Worth browser PASS (real isolated SQLite; no normal workers/vault)',
  )
} finally {
  if (browser) await browser.close()
  server.kill()
  await new Promise((r) => server.once('exit', r))
}
