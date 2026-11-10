import {
  defaultInsightsLayout,
  readInsightsLayout,
  mergeVisibleLayout,
  moveWidget,
  widgetIds,
} from './insights-layout'

it('uses source 12/6/2 columns and keeps all supported widgets recoverable', () => {
  const layout = defaultInsightsLayout()
  for (const bp of ['desktop', 'tablet', 'mobile'] as const) {
    expect(layout.layouts[bp].map((item) => item.i)).toEqual([...widgetIds])
  }
  expect(
    layout.layouts.desktop
      .filter((item) =>
        ['account', 'asset_class', 'geography', 'sector'].includes(item.i),
      )
      .map((item) => item.w),
  ).toEqual([3, 3, 3, 3])
  expect(readInsightsLayout(null)).toEqual(layout)
})
it('validates persisted geometry and strips extra payloads, unknown IDs and duplicates', () => {
  const original = defaultInsightsLayout()
  const saved = {
    ...original,
    hidden: ['value', 'private'],
    layouts: {
      ...original.layouts,
      desktop: [
        { i: 'value', x: -4, y: -9, w: 100, h: 0, balance: '99999' },
        { i: 'unknown', x: 0, y: 0, w: 1, h: 1 },
      ],
    },
  }
  const parsed = readInsightsLayout(saved)
  expect(parsed.hidden).toEqual(['value'])
  expect(parsed.layouts.desktop[0]).toMatchObject({
    i: 'value',
    x: 0,
    y: 0,
    w: 12,
    h: 104,
  })
  expect(parsed.layouts.desktop).toHaveLength(widgetIds.length)
  expect(JSON.stringify(parsed)).not.toContain('balance')
})
it('merges visible drag/resize updates while preserving hidden positions and supports keyboard order', () => {
  const layout = defaultInsightsLayout()
  const moved = mergeVisibleLayout(
    layout.layouts.desktop,
    [{ ...layout.layouts.desktop[0], w: 6, h: 180 }],
    'desktop',
  )
  expect(moved[0]).toMatchObject({ w: 6, h: 180 })
  expect(moved[1].i).toBe('cash')
  const keyboard = moveWidget(layout, 'cash', -1, 'mobile')
  expect(keyboard.layouts.mobile[0].i).toBe('cash')
  expect(layout.layouts.mobile[0].i).toBe('value')
})

it('appends newly supported widgets below saved geometry without moving customized widgets', () => {
  const old = defaultInsightsLayout()
  for (const bp of ['desktop', 'tablet', 'mobile'] as const) {
    old.layouts[bp] = old.layouts[bp]
      .filter((item) => !['top_movers', 'targets'].includes(item.i))
      .map((item) => ({ ...item, y: item.y + 75 }))
  }
  const upgraded = readInsightsLayout(old)
  for (const bp of ['desktop', 'tablet', 'mobile'] as const) {
    for (const item of old.layouts[bp])
      expect(upgraded.layouts[bp].find((row) => row.i === item.i)).toEqual(item)
    const bottom = Math.max(...old.layouts[bp].map((item) => item.y + item.h))
    expect(
      upgraded.layouts[bp].find((item) => item.i === 'targets')!.y,
    ).toBeGreaterThanOrEqual(bottom)
    expect(
      upgraded.layouts[bp].find((item) => item.i === 'top_movers')!.y,
    ).toBeGreaterThanOrEqual(bottom)
  }
})
