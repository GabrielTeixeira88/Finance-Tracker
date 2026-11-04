// Real local API/browser integration with entirely synthetic Pluggy adapter responses.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
const root = fileURLToPath(new URL('../../', import.meta.url)),
  port = 5174
const origin = `http://127.0.0.1:${port}`
try {
  await fetch(origin + '/api/health')
  throw new Error(
    'Port 5174 is occupied; never attach to an existing workspace',
  )
} catch (e) {
  if (!e.cause) throw e
}
const output = path.join(root, 'docs/screenshots/pluggy')
await mkdir(output, { recursive: true })
const source = `from pathlib import Path
import importlib.util, tempfile, os
from alembic.config import Config
from alembic import command
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from sqlalchemy import URL
from sqlalchemy.orm import Session
import uvicorn
from app.config import PROJECT_ROOT, Settings
from app.database import make_engine, get_session
root=Path(tempfile.mkdtemp(prefix="pluggy-e2e-",dir=PROJECT_ROOT/".tmp"))
scratch=(root/"synthetic.db").resolve()
assert scratch.is_relative_to((PROJECT_ROOT/".tmp").resolve())
os.environ["DATABASE_PATH"]=str(scratch)
from app.config import get_settings
get_settings.cache_clear()
assert get_settings().resolved_database_path==scratch
from app.main import app as normal
from app import pluggy_routes, pluggy_provider
from app.pluggy_service import PluggyService
url=URL.create("sqlite+pysqlite",database=str(scratch))
config=Config(str(PROJECT_ROOT/"backend/alembic.ini"))
config.attributes["database_url"]=url
command.upgrade(config,"head")
engine=make_engine(url)
spec=importlib.util.spec_from_file_location("synthetic_pluggy",PROJECT_ROOT/"backend/tests/test_pluggy.py")
fixtures=importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixtures)
settings=Settings(database_path=root/"synthetic.db",pluggy_local_origins="${origin}")
service=PluggyService(engine,settings,provider=fixtures.Provider(engine),vault=fixtures.Vault())
app=FastAPI()
app.router.routes.extend(normal.router.routes)
def session():
    with Session(engine) as db:
        yield db
normal.dependency_overrides[get_session]=session
app.dependency_overrides[get_session]=session
normal.dependency_overrides[pluggy_routes.get_service]=lambda:service
app.dependency_overrides[pluggy_routes.get_service]=lambda:service

def forbidden(*args, **kwargs):
    raise RuntimeError("Live integration service/vault/network forbidden in synthetic browser tests")
pluggy_routes.cached_service=forbidden
pluggy_provider.PluggyTransport.request=forbidden
from app.database import get_engine
get_engine.cache_clear()
assert Path(get_engine().url.database).resolve()==scratch
@app.get("/api/test-workspace")
def test_workspace():
    assert Path(get_engine().url.database).resolve()==scratch
    return {"isolated":True}
pluggy_routes.get_settings=lambda:settings
app.mount("/",StaticFiles(directory=PROJECT_ROOT/"frontend/dist",html=True))
uvicorn.run(app,host="127.0.0.1",port=${port},access_log=False)
`
const python = path.join(
  root,
  'backend/.venv',
  process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
)
const server = spawn(python, ['-c', source], {
  cwd: path.join(root, 'backend'),
  windowsHide: true,
  stdio: ['ignore', 'ignore', 'pipe'],
})
let logs = '',
  browser
server.stderr.on('data', (d) => {
  logs += d.toString()
})
try {
  let ready = false
  for (let i = 0; i < 180; i++) {
    if (server.exitCode !== null) throw new Error(logs)
    try {
      ready = (await fetch(origin + '/api/health')).ok
    } catch {}
    if (ready) break
    await new Promise((r) => setTimeout(r, 250))
  }
  assert(ready, 'Owned synthetic API did not start')
  browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL || 'msedge',
    headless: true,
  })
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
    colorScheme: 'dark',
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const errors = [],
    external = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('request', (r) => {
    if (!r.url().startsWith(origin) && !r.url().startsWith('data:'))
      external.push(new URL(r.url()).origin)
  })
  const rpc = async (method, url, data) => {
    const response = await page.request.fetch(origin + '/api' + url, {
      method,
      headers: { 'X-Finance-Pluggy': '1' },
      ...(data === undefined ? {} : { data }),
    })
    assert(
      response.ok(),
      `${method} ${url}: ${response.status()} ${await response.text()}`,
    )
    return response.json()
  }
  assert.equal((await rpc('GET', '/test-workspace')).isolated, true)
  const checking = await rpc('POST', '/accounts', {
    name: 'Synthetic checking',
    type: 'CHECKING',
    currency: 'BRL',
    opening_balance: '500',
    opening_date: '2026-01-01',
  })
  const brokerage = await rpc('POST', '/accounts', {
    name: 'Synthetic brokerage',
    type: 'INVESTMENT',
    currency: 'BRL',
    opening_balance: '100',
    opening_date: '2026-01-01',
  })
  const asset = await rpc('POST', '/investments/assets', {
    name: 'Synthetic security',
    symbol: 'FAKEONLY11',
    asset_type: 'ETF',
    exchange: 'SYNTHETIC',
    currency: 'BRL',
  })
  await page.goto(origin + '/#/settings?view=pluggy')
  await page
    .getByRole('heading', { name: 'Pluggy connections', exact: true })
    .waitFor()
  await page
    .getByLabel('Existing Pluggy / MeuPluggy Item ID')
    .fill('00000000-0000-0000-0000-000000000001')
  await page
    .getByRole('button', { name: 'Attach existing connection', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Retrieve provider data', exact: true })
    .click()
  const bank = page.getByRole('row').filter({ hasText: 'Synthetic bank' })
  await bank.waitFor()
  assert.equal(
    (await rpc('GET', '/accounts/' + checking.id)).balance,
    '500.000000',
  )
  await page.screenshot({ path: path.join(output, 'connections-1440.png') })
  const map = async (row, accountId, assetId) => {
    await row.getByRole('button', { name: 'Map', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog
      .getByLabel('Local account', { exact: true })
      .selectOption(accountId)
    if (assetId)
      await dialog
        .getByLabel('Local asset', { exact: true })
        .selectOption(assetId)
    await dialog
      .getByRole('button', { name: 'Save mapping', exact: true })
      .click()
    await dialog.waitFor({ state: 'hidden' })
  }
  await map(bank, checking.id)
  await bank
    .getByRole('button', { name: 'Prepare review', exact: true })
    .click()
  const evidence = page.getByRole('dialog')
  await evidence.getByLabel('From', { exact: true }).fill('2026-10-01')
  await evidence.getByLabel('Through', { exact: true }).fill('2026-10-30')
  await evidence
    .getByRole('button', { name: 'Prepare review', exact: true })
    .click()
  await page.getByText('SYNTHETIC SHOP', { exact: true }).first().waitFor()
  assert(page.url().includes('batch='))
  await page.getByLabel(/I confirm this statement belongs to/).check()
  page.once('dialog', (d) => d.accept())
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/confirm') && r.request().method() === 'POST',
    ),
    page.getByRole('button', { name: 'Confirm import', exact: true }).click(),
  ])
  assert.equal(
    (await rpc('GET', '/accounts/' + checking.id)).balance,
    '474.876544',
  )
  const items = await rpc('GET', '/pluggy/items')
  await page.goto(
    origin + '/#/settings?view=pluggy&item=' + items[0].id + '&kind=INVESTMENT',
  )
  const investment = page
    .getByRole('row')
    .filter({ hasText: 'Synthetic position' })
  await investment.waitFor()
  await map(investment, brokerage.id, asset.id)
  await investment
    .getByRole('button', { name: 'Prepare review', exact: true })
    .click()
  const review = page.getByRole('dialog')
  await review.locator('.pluggy-activity input[type=checkbox]').check()
  await review.getByLabel('Verified fees', { exact: true }).fill('0')
  await review.getByLabel('Verified taxes', { exact: true }).fill('0')
  await review
    .getByLabel(
      'I verified the selected activities and charges against the provider evidence.',
    )
    .check()
  await review
    .getByRole('button', { name: 'Prepare review', exact: true })
    .click()
  await page
    .getByLabel('I confirm this brokerage account and reviewed activities')
    .check()
  await page.screenshot({
    path: path.join(output, 'investment-review-1440.png'),
  })
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/confirm') && r.request().method() === 'POST',
    ),
    page.getByRole('button', { name: /Confirm/ }).click(),
  ])
  assert.equal(
    (await rpc('GET', '/accounts/' + brokerage.id)).balance,
    '80.000000',
  )
  const transactions = await rpc(
    'GET',
    '/transactions?account_id=' + brokerage.id,
  )
  assert.equal(
    transactions.length,
    1,
    'Brokerage must only have its opening transaction, no activity twin',
  )
  await page.goto(
    origin + '/#/settings?view=pluggy&item=' + items[0].id + '&kind=CONSENT',
  )
  await page.getByRole('table').waitFor()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: path.join(output, 'connections-390.png') })
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    'No page overflow',
  )
  assert.deepEqual(errors, [])
  assert.deepEqual(
    external,
    [],
    'No real provider request is permitted in this synthetic test',
  )
  console.log(
    'PASS: owned migrated SQLite; real Settings/API mapping; exact bank import; investment review/one cash posting; consent view; responsive layout; zero live provider requests.',
  )
} finally {
  await browser?.close()
  server.kill()
}
