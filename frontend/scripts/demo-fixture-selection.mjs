// Regression fixtures only. Public UI exposes one complete demo, no scenario picker.
import assert from 'node:assert/strict'

export async function selectDemoFixture(page, origin, scenario) {
  const runtime = await (await page.request.get(origin + '/api/runtime')).json()
  assert.notEqual(
    runtime.scenario,
    'unified',
    'Never switch the unified public workspace',
  )
  const response = await page.request.post(
    origin + '/api/demo-control/scenario',
    {
      headers: {
        'X-Finance-Demo': '1',
        'X-Demo-Generation': runtime.generation,
      },
      data: { scenario },
    },
  )
  assert(response.ok(), 'Explicit regression fixture selection')
  await page.reload()
  await page.waitForLoadState('networkidle')
}
