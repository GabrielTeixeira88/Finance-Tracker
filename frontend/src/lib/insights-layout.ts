// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Wealthfolio 92b4647 insights-layout.ts: responsive plain-data layout.
// Only implemented widgets are persisted. No balances, scopes, queries or provider data.
import type { Layout, LayoutItem } from 'react-grid-layout'

export const widgetIds = [
  'value',
  'cash',
  'invested',
  'cost_basis',
  'unrealized',
  'account',
  'asset_class',
  'geography',
  'sector',
  'composition',
  'breakdown',
  'concentration',
  'top_movers',
  'targets',
] as const
export type WidgetId = (typeof widgetIds)[number]
export const breakpoints = { desktop: 1100, tablet: 700, mobile: 0 }
export const gridColumns = { desktop: 12, tablet: 6, mobile: 2 }
export type LayoutBreakpoint = keyof typeof gridColumns
export type InsightsLayout = {
  version: 1
  hidden: WidgetId[]
  layouts: Record<LayoutBreakpoint, LayoutItem[]>
}
const summaries = new Set<string>(widgetIds.slice(0, 5))
const minHeight = (id: string) =>
  summaries.has(id)
    ? 104
    : ['composition', 'breakdown'].includes(id)
      ? 300
      : 234

export function defaultInsightsLayout(): InsightsLayout {
  const desktop = widgetIds.map((i, index) =>
    index < 5
      ? {
          i,
          x: index === 0 ? 0 : 4 + (index - 1) * 2,
          y: 0,
          w: index === 0 ? 4 : 2,
          h: 104,
        }
      : index < 9
        ? { i, x: (index - 5) * 3, y: 104, w: 3, h: 250 }
        : {
            i,
            x: 0,
            y:
              index === 9
                ? 354
                : index === 10
                  ? 954
                  : 1554 + (index - 11) * 600,
            w: 12,
            h:
              index === 9 ? 600 : index === 10 ? 600 : index === 11 ? 390 : 500,
          },
  )
  Object.assign(
    desktop.find((item) => item.i === 'composition')!,
    { x: 0, y: 354, w: 9, h: 622 },
  )
  Object.assign(
    desktop.find((item) => item.i === 'targets')!,
    { x: 9, y: 354, w: 3, h: 622 },
  )
  Object.assign(
    desktop.find((item) => item.i === 'breakdown')!,
    { x: 0, y: 976, w: 12, h: 552 },
  )
  Object.assign(
    desktop.find((item) => item.i === 'top_movers')!,
    { x: 0, y: 1528, w: 6, h: 420 },
  )
  Object.assign(
    desktop.find((item) => item.i === 'concentration')!,
    { x: 6, y: 1528, w: 6, h: 420 },
  )
  const tablet = desktop.map((item, index) => ({
    ...item,
    x:
      index < 5
        ? index === 0
          ? 0
          : ((index - 1) % 2) * 3
        : index < 9
          ? ((index - 5) % 2) * 3
          : 0,
    w: index === 0 || index >= 9 ? 6 : 3,
    y:
      index === 0
        ? 0
        : index < 5
          ? 104 + Math.floor((index - 1) / 2) * 104
          : index < 9
            ? 312 + Math.floor((index - 5) / 2) * 250
            : 812 + (index - 9) * 600,
  }))
  let y = 0
  const mobile = desktop.map((item) => {
    const result = { ...item, x: 0, y, w: 2 }
    y += item.h
    return result
  })
  return {
    version: 1,
    hidden: [],
    layouts: {
      desktop: normalizeWidgets(desktop, 'desktop'),
      tablet: normalizeWidgets(tablet, 'tablet'),
      mobile: normalizeWidgets(mobile, 'mobile'),
    },
  }
}

export function normalizeWidgets(
  items: Layout,
  breakpoint: LayoutBreakpoint,
): LayoutItem[] {
  const cols = gridColumns[breakpoint]
  return items.map(({ i, x, y, w, h }) => {
    const minW =
      breakpoint === 'mobile'
        ? 2
        : summaries.has(i)
          ? 2
          : ['composition', 'breakdown'].includes(i)
            ? Math.min(6, cols)
            : 3
    const width = Math.min(cols, Math.max(minW, Math.round(w)))
    return {
      i,
      x: Math.min(cols - width, Math.max(0, Math.round(x))),
      y: Math.min(100000, Math.max(0, Math.round(y))),
      w: width,
      h: Math.min(5000, Math.max(minHeight(i), Math.round(h))),
      minW,
      maxW: cols,
      minH: minHeight(i),
      maxH: 5000,
    }
  })
}

export function readInsightsLayout(value: unknown): InsightsLayout {
  const fallback = defaultInsightsLayout()
  if (!value || typeof value !== 'object') return fallback
  const candidate = value as Partial<InsightsLayout>
  if (
    candidate.version !== 1 ||
    !candidate.layouts ||
    !Array.isArray(candidate.hidden)
  )
    return fallback
  const result = {
    ...fallback,
    hidden: widgetIds.filter((id) => candidate.hidden!.includes(id)),
    layouts: { ...fallback.layouts },
  }
  for (const bp of Object.keys(gridColumns) as LayoutBreakpoint[]) {
    const saved = candidate.layouts[bp]
    if (!Array.isArray(saved)) continue
    const valid = saved.filter(
      (item) =>
        item &&
        widgetIds.includes(item.i as WidgetId) &&
        [item.x, item.y, item.w, item.h].every(
          (n) => typeof n === 'number' && Number.isFinite(n),
        ),
    )
    const unique = [...new Map(valid.map((item) => [item.i, item])).values()]
    let bottom = Math.max(0, ...unique.map((item) => item.y + item.h))
    const additions = fallback.layouts[bp]
      .filter((item) => !unique.some((v) => v.i === item.i))
      .map((item) => {
        if (!unique.length) return item
        const appended = { ...item, x: 0, y: bottom, w: gridColumns[bp] }
        bottom += item.h
        return appended
      })
    result.layouts[bp] = normalizeWidgets([...unique, ...additions], bp)
  }
  return result
}

export function mergeVisibleLayout(
  saved: Layout,
  visible: Layout,
  bp: LayoutBreakpoint,
) {
  return normalizeWidgets(
    saved.map((item) => visible.find((next) => next.i === item.i) ?? item),
    bp,
  )
}

/** Keyboard/mobile alternative changes the same breakpoint order, never financial data. */
export function moveWidget(
  layout: InsightsLayout,
  id: WidgetId,
  direction: -1 | 1,
  bp: LayoutBreakpoint,
): InsightsLayout {
  const ordered = [...layout.layouts[bp]].sort((a, b) => a.y - b.y || a.x - b.x)
  const index = ordered.findIndex((item) => item.i === id),
    next = index + direction
  if (index < 0 || next < 0 || next >= ordered.length) return layout
  ;[ordered[index], ordered[next]] = [ordered[next], ordered[index]]
  let y = 0
  return {
    ...layout,
    layouts: {
      ...layout.layouts,
      [bp]: ordered.map((item) => {
        const row = { ...item, x: 0, y, w: gridColumns[bp] }
        y += item.h
        return row
      }),
    },
  }
}
