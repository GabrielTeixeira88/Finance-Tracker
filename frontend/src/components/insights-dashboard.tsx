// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Wealthfolio 92b4647 insights-dashboard.tsx, with workspace appearance
// preferences instead of upstream settings, exact-data-free layouts and keyboard controls.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Responsive,
  useContainerWidth,
  getBreakpointFromWidth,
  type Layout,
} from 'react-grid-layout'
import {
  GripVertical,
  X,
  LayoutDashboard,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { usePreferences, setPreferences } from '@/lib/preferences'
import {
  breakpoints,
  gridColumns,
  widgetIds,
  defaultInsightsLayout,
  mergeVisibleLayout,
  moveWidget,
  type InsightsLayout,
  type WidgetId,
} from '@/lib/insights-layout'
import { t } from '@/lib/i18n'
import 'react-grid-layout/css/styles.css'

const label = (id: string) => t(`portfolio_insights:${id}`)
function WidgetContent({
  children,
  onHeight,
}: {
  children: ReactNode
  onHeight: (height: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new ResizeObserver(() => {
      const height = Math.ceil(node.getBoundingClientRect().height)
      if (height > 0) onHeight(height + 18)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [onHeight])
  return (
    <div className="insight-widget-fill">
      <div ref={ref} className="insight-widget-natural">
        {children}
      </div>
    </div>
  )
}
export function InsightsDashboard({
  widgets,
  onCustomizeActionChange,
}: {
  widgets: Record<WidgetId, ReactNode>
  onCustomizeActionChange?: (action: ReactNode | null) => void
}) {
  const saved = usePreferences().insightsLayout
  const [draft, setDraft] = useState<InsightsLayout | null>(null)
  const [picker, setPicker] = useState(false)
  const [heights, setHeights] = useState<Record<string, number>>({})
  const { width, containerRef, mounted } = useContainerWidth({
    measureBeforeMount: true,
  })
  const bp = getBreakpointFromWidth(breakpoints, width)
  const current = draft ?? saved
  const editing = draft !== null
  const customizeTitle = label('customize')
  const customizeAction = useMemo(
    () =>
      editing ? null : (
        <button
          className="insights-customize-action"
          aria-label={customizeTitle}
          title={customizeTitle}
          onClick={() => setDraft(structuredClone(saved))}
        >
          <LayoutDashboard size={15} />
        </button>
      ),
    [editing, saved, customizeTitle],
  )
  useEffect(() => {
    onCustomizeActionChange?.(customizeAction)
    return () => onCustomizeActionChange?.(null)
  }, [onCustomizeActionChange, customizeAction])
  const visible = current.layouts[bp].filter(
    (item) => !current.hidden.includes(item.i as WidgetId),
  )
  const layouts = Object.fromEntries(
    Object.entries(current.layouts).map(([key, items]) => [
      key,
      items
        .filter((item) => !current.hidden.includes(item.i as WidgetId))
        .map((item) => ({
          ...item,
          h:
            key === bp
              ? Math.max(
                  item.h,
                  ...items
                    .filter(
                      (peer) =>
                        widgetIds.slice(0, 5).includes(item.i as WidgetId) &&
                        widgetIds.slice(0, 5).includes(peer.i as WidgetId) &&
                        peer.y === item.y,
                    )
                    .map((peer) => heights[`${bp}:${peer.i}`] ?? 0),
                  heights[`${bp}:${item.i}`] ?? 0,
                )
              : item.h,
        })),
    ]),
  )
  const update = (layout: Layout) =>
    setDraft(
      (prev) =>
        prev && {
          ...prev,
          layouts: {
            ...prev.layouts,
            [bp]: mergeVisibleLayout(prev.layouts[bp], layout, bp),
          },
        },
    )
  const hide = (id: WidgetId) =>
    setDraft(
      (prev) =>
        prev && {
          ...prev,
          hidden: prev.hidden.includes(id)
            ? prev.hidden.filter((item) => item !== id)
            : [...prev.hidden, id],
        },
    )
  const order = [...current.layouts[bp]].sort((a, b) => a.y - b.y || a.x - b.x)
  return (
    <div className={`insights-dashboard ${editing ? 'is-editing' : ''}`}>
      {(editing || !onCustomizeActionChange) && (
        <div className="insights-customize-toolbar">
          {editing ? (
            <>
              <span className="metadata">{label('customize_help')}</span>
              <button onClick={() => setPicker(!picker)} aria-expanded={picker}>
                {label('widgets')}
              </button>
              <button onClick={() => setDraft(defaultInsightsLayout())}>
                {label('restore')}
              </button>
              <button
                onClick={() => {
                  setDraft(null)
                  setPicker(false)
                }}
              >
                {label('cancel')}
              </button>
              <button
                className="insights-save"
                onClick={() => {
                  setPreferences({ insightsLayout: draft })
                  setDraft(null)
                  setPicker(false)
                }}
              >
                {label('save')}
              </button>
            </>
          ) : (
            customizeAction
          )}
        </div>
      )}
      {editing && picker && (
        <section
          className="insight-widget-picker"
          aria-label={label('widgets')}
        >
          <p className="metadata">{label('layout_only')}</p>
          {order.map((item, index) => {
            const id = item.i as WidgetId
            return (
              <div key={id}>
                <label>
                  <input
                    type="checkbox"
                    checked={!current.hidden.includes(id)}
                    onChange={() => hide(id)}
                  />
                  {label(id)}
                </label>
                <button
                  disabled={index === 0}
                  aria-label={`${label('move_up')} ${label(id)}`}
                  onClick={() =>
                    setDraft((prev) => prev && moveWidget(prev, id, -1, bp))
                  }
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  disabled={index === order.length - 1}
                  aria-label={`${label('move_down')} ${label(id)}`}
                  onClick={() =>
                    setDraft((prev) => prev && moveWidget(prev, id, 1, bp))
                  }
                >
                  <ArrowDown size={14} />
                </button>
                <label className="insights-size-label">
                  {label('width')}
                  <input
                    type="number"
                    aria-label={`${label('width')} ${label(id)}`}
                    min={bp === 'mobile' ? 2 : (item.minW ?? 2)}
                    max={gridColumns[bp]}
                    value={item.w}
                    onChange={(event) => {
                      const w = Number(event.target.value)
                      if (Number.isFinite(w) && w > 0)
                        update(
                          current.layouts[bp].map((row) =>
                            row.i === id ? { ...row, w } : row,
                          ),
                        )
                    }}
                  />
                </label>
                <label className="insights-size-label">
                  {label('height')}
                  <input
                    type="number"
                    aria-label={`${label('height')} ${label(id)}`}
                    min={item.minH ?? 104}
                    max={5000}
                    value={item.h}
                    onChange={(event) => {
                      const h = Number(event.target.value)
                      if (Number.isFinite(h) && h > 0)
                        update(
                          current.layouts[bp].map((row) =>
                            row.i === id ? { ...row, h } : row,
                          ),
                        )
                    }}
                  />
                </label>
              </div>
            )
          })}
        </section>
      )}
      {current.hidden.length === widgetIds.length && (
        <p className="empty">{label('all_hidden')}</p>
      )}
      <div ref={containerRef}>
        {mounted && (
          <Responsive
            width={width}
            layouts={layouts}
            breakpoints={breakpoints}
            cols={gridColumns}
            rowHeight={1}
            margin={[16, 0]}
            containerPadding={[0, 0]}
            dragConfig={{
              enabled: editing && bp !== 'mobile',
              handle: '.insights-drag-handle',
            }}
            resizeConfig={{
              enabled: editing && bp !== 'mobile',
              handles: ['e', 'se'],
            }}
            onDragStop={update}
            onResizeStop={update}
          >
            {visible.map((item) => {
              const id = item.i as WidgetId
              return (
                <div
                  key={id}
                  className="insights-grid-widget"
                  data-widget-id={id}
                >
                  {editing && (
                    <div className="insights-widget-edit-controls">
                      <span
                        className="insights-drag-handle"
                        title={`${label('drag')} ${label(id)}`}
                      >
                        <GripVertical size={15} />
                      </span>
                      <button
                        aria-label={`${label('hide')} ${label(id)}`}
                        onClick={() => hide(id)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                  <WidgetContent
                    onHeight={(height) =>
                      setHeights((prev) =>
                        prev[`${bp}:${id}`] === height
                          ? prev
                          : { ...prev, [`${bp}:${id}`]: height },
                      )
                    }
                  >
                    {widgets[id]}
                  </WidgetContent>
                </div>
              )
            })}
          </Responsive>
        )}
      </div>
    </div>
  )
}
