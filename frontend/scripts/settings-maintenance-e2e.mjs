// Real restore/restart browser check in an exclusively owned temporary personal-style DB.
// Integration workers are explicitly disabled in this harness; no credentials or token vault.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
const root = fileURLToPath(new URL('../../', import.meta.url))
const origin = 'http://127.0.0.1:5175'
try {
  await fetch(origin + '/api/health')
  throw Error('Port 5175 is occupied; refusing existing server')
} catch (error) {
  if (!error.cause) throw error
}
const owned = await mkdtemp(path.join(root, '.tmp/settings-maintenance-'))
const database = path.join(owned, 'fictional.db')
const output = path.join(root, 'docs/screenshots/v014-settings')
await mkdir(output, { recursive: true })
const python = path.join(root, 'backend/.venv/Scripts/python.exe')
const source = `import os
from pathlib import Path
from contextlib import asynccontextmanager
import uvicorn
from alembic import command
from alembic.config import Config
from sqlalchemy.orm import Session
from app.config import get_settings, PROJECT_ROOT
from app.database import get_engine
from app import ledger, schemas, local_backups
from app.models import FinancialAccount
settings=get_settings()
first=not settings.resolved_database_path.exists()
config=Config(str(PROJECT_ROOT/'backend/alembic.ini'))
config.attributes['database_url']=settings.database_url
command.upgrade(config,'head')
if first:
    with Session(get_engine()) as db, db.begin():
        row=ledger.create_account(db, schemas.AccountCreate(name='Fictional original',type='CHECKING',currency='BRL',opening_balance='5000.123456',opening_date='2026-01-01'))
    local_backups.create()
    with Session(get_engine()) as db, db.begin():
        row=db.query(FinancialAccount).first()
        row.name='Fictional after backup'
from app.main import app
from fastapi.staticfiles import StaticFiles
@asynccontextmanager
async def isolated_lifespan(app):
    with local_backups.runtime_lease(settings.resolved_database_path):
        yield
    if get_engine.cache_info().currsize:
        get_engine().dispose()
        get_engine.cache_clear()
app.router.lifespan_context=isolated_lifespan
app.mount('/',StaticFiles(directory=str(PROJECT_ROOT/'frontend/dist'),html=True))
uvicorn.run(app,host='127.0.0.1',port=5175,access_log=False)
`
let server,
  browser,
  stderr = ''
async function start(maintenance) {
  server = spawn(python, ['-c', source], {
    cwd: path.join(root, 'backend'),
    windowsHide: true,
    stdio: ['ignore', 'ignore', 'pipe'],
    env: {
      ...process.env,
      DATABASE_PATH: database,
      MAINTENANCE_MODE: String(maintenance),
      BRAPI_API_TOKEN: '',
      ALPHA_VANTAGE_API_KEY: '',
      GOOGLE_OAUTH_CLIENT_ID: '',
      GOOGLE_OAUTH_CLIENT_SECRET: '',
    },
  })
  server.stderr.on('data', (value) => (stderr += value.toString()))
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw Error(stderr)
    try {
      if ((await fetch(origin + '/api/health')).ok) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw Error('Temporary server did not start')
}
async function stop() {
  if (server) {
    const child = server
    child.kill()
    await new Promise((resolve) => child.once('exit', resolve))
    server = undefined
  }
}
try {
  await start(true)
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
  })
  await page.addInitScript(() =>
    localStorage.setItem(
      'finance-tracker-preferences-normal',
      JSON.stringify({
        mode: 'light',
        font: 'inter',
        language: 'en',
        palette: 'olive',
      }),
    ),
  )
  await page.goto(origin + '/#/settings?view=exports')
  await page
    .getByRole('heading', { name: 'Database maintenance', exact: true })
    .waitFor()
  assert.equal((await page.request.get(origin + '/api/accounts')).status(), 503)
  const header = { 'X-Finance-Admin': '1' }
  const initial = await (
    await page.request.get(origin + '/api/settings/backups', {
      headers: header,
    })
  ).json()
  const identifier = initial.items[0].id
  await page.getByRole('button', { name: 'Create backup', exact: true }).click()
  await page.locator('.source-settings-list>div').nth(1).waitFor()
  const row = page
    .locator('.source-settings-list>div')
    .filter({ hasText: identifier.slice(0, 8) })
  const downloadPromise = page.waitForEvent('download')
  await row.getByRole('button', { name: 'Download', exact: true }).click()
  assert.equal(
    (await downloadPromise).suggestedFilename(),
    'finance-tracker-backup.db',
  )
  const file = await page.request.get(
    `${origin}/api/settings/backups/${identifier}/download`,
    { headers: header },
  )
  await page.getByLabel('Validate backup file', { exact: true }).setInputFiles({
    name: 'fictional.db',
    mimeType: 'application/octet-stream',
    buffer: await file.body(),
  })
  await page.locator('.source-settings-list>div').nth(2).waitFor()
  await row.getByRole('button', { name: 'Restore', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel(/Type RESTORE/).fill('RESTORE')
  await dialog.getByRole('button', { name: 'Restore', exact: true }).click()
  await page
    .getByRole('status')
    .filter({ hasText: 'Restore completed' })
    .waitFor()
  await page.screenshot({
    path: path.join(output, 'maintenance-restore-1440.png'),
  })
  assert.equal((await page.request.get(origin + '/api/accounts')).status(), 503)
  const backups = await page.request.get(origin + '/api/settings/backups', {
    headers: { 'X-Finance-Admin': '1' },
  })
  assert.equal((await backups.json()).items.length, 4)
  await stop()
  await start(false)
  const response = await page.request.get(origin + '/api/accounts')
  assert(response.ok())
  const accounts = await response.json()
  assert.equal(accounts[0].name, 'Fictional original')
  assert.equal(accounts[0].balance, '5000.123456')
  await page.goto(origin + '/#/settings?view=general')
  await page.reload()
  await page.getByRole('heading', { name: 'General', exact: true }).waitFor()
  await page
    .getByLabel('Reporting currency', { exact: true })
    .selectOption('EUR')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page
    .getByRole('status', { name: '' })
    .filter({ hasText: 'Saved' })
    .waitFor()
  assert.equal(
    (
      await (
        await page.request.get(origin + '/api/settings/preferences')
      ).json()
    ).reporting_currency,
    'EUR',
  )
  const unchanged = await (
    await page.request.get(origin + '/api/accounts')
  ).json()
  assert.deepEqual(unchanged, accounts)
  await page.screenshot({
    path: path.join(output, 'general-normal-light-1440.png'),
  })
  await page.goto(origin + '/#/settings?view=securities')
  await page.getByRole('heading', { name: 'Securities', exact: true }).waitFor()
  await page.getByText('No records yet', { exact: true }).waitFor()
  await page.screenshot({
    path: path.join(output, 'empty-securities-1440.png'),
  })
  let failed = true
  await page.route('**/api/settings/account-groups', async (route) => {
    if (failed) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Fictional retry check' }),
      })
    } else await route.continue()
  })
  await page.goto(origin + '/#/settings?view=groups')
  await page.getByRole('button', { name: /Try again|Retry/i }).waitFor()
  failed = false
  await page.getByRole('button', { name: /Try again|Retry/i }).click()
  await page.getByText('No records yet', { exact: true }).waitFor()
  await writeFile(
    path.join(output, 'maintenance-validation.json'),
    JSON.stringify(
      {
        result: 'PASS',
        restore: true,
        recoveryBackup: true,
        restart: true,
        exactMoneyPreserved: true,
        reportingCurrencyMetadataOnly: true,
        isolatedTemporaryDatabase: true,
        integrationWorkersDisabledByHarness: true,
      },
      null,
      2,
    ),
  )
  console.log('Settings personal-style maintenance restore/restart PASS')
} finally {
  await browser?.close()
  await stop()
  await writeFile(path.join(owned, 'server.log'), stderr)
}
