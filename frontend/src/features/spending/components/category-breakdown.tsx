// SPDX-License-Identifier: AGPL-3.0-only
// Extracted/adapted from Wealthfolio 92b4647 spending-tab-content.tsx (inline components).
import { useMemo, useState, type FC } from 'react'
import { useTranslation } from 'react-i18next'
import { ResponsiveContainer, Treemap, Tooltip } from 'recharts'
import { cn } from '@/lib/utils'
import { decimalUnits, sumMoney, subtractMoney } from '@/lib/money'
import { useBalancePrivacy, safePercent, positiveMoney, Link } from '../compat'
import {
  PrivacyAmount,
  useAmountFormatting,
  useNumberFormatting,
  Icons,
} from '../ui'
import { getBudgetGroupLabel } from '../labels'
const SAVINGS_ROW_ID = '__savings__'
const SAVINGS_ROW_COLOR = 'var(--spending-saving)'
const stripBidiControls = (text: string) =>
  text.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
export function SegmentedToggle({
  items,
  value,
  onChange,
  ariaLabel,
}: {
  items: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
  /** A11y label for the group — without this, screen readers announce two
   *  unrelated buttons instead of a single logical control. */
  ariaLabel?: string
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="bg-card/40 border-border/60 inline-flex max-w-full items-center gap-0.5 rounded-full border p-0.5"
    >
      {items.map((it) => {
        const active = it.value === value
        return (
          <button
            key={it.value}
            type="button"
            onClick={() => onChange(it.value)}
            aria-pressed={active}
            className={cn(
              'text-2xs rounded-full px-2.5 py-0.5 font-medium transition-colors',
              active
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {it.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Where it went — Map (treemap) and List variants ──────────────────────

export interface CategoryRow {
  id: string
  name: string
  color: string | null
  icon: string | null
  amount: string
}

function WhereItWentEmptyState({
  hasNoIncludedAccounts,
}: {
  hasNoIncludedAccounts: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className="py-6 text-center">
      {hasNoIncludedAccounts ? (
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm">
            {t('wfSpending:tabContent.noAccountsSelected')}
          </p>
          <Link
            to="/settings/spending"
            className="text-foreground inline-flex text-xs underline-offset-4 hover:underline"
          >
            {t('wfSpending:tabContent.openSpendingSettings')}
          </Link>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          {t('wfSpending:hierarchy.noCategorizedSpending')}
        </p>
      )}
    </div>
  )
}

interface CategoryTreemapNodeProps {
  depth?: number
  x?: number
  y?: number
  width?: number
  height?: number
  name?: string
  amount?: string
  pct?: number
  fill?: string
  currency?: string
  id?: string
}

interface CategoryTreemapNodeMonoProps extends CategoryTreemapNodeProps {
  accent?: string | null
  onActivate?: (id: string) => void
}

export function CategoryTreemapMono({
  rows,
  total,
  currency,
  themeColor,
  hasNoIncludedAccounts,
  activityHrefFor,
}: {
  rows: CategoryRow[]
  total: string
  currency: string
  themeColor: string
  hasNoIncludedAccounts: boolean
  activityHrefFor: (id: string) => string
}) {
  const { t } = useTranslation()
  const numberFormatting = useNumberFormatting()
  const navigate = (to: string) => {
    window.location.hash = to
  }

  if (rows.length === 0 || decimalUnits(total) <= 0n) {
    return (
      <WhereItWentEmptyState hasNoIncludedAccounts={hasNoIncludedAccounts} />
    )
  }

  const top = rows.slice(0, 8)
  const restAmount = sumMoney(rows.slice(8).map((r) => r.amount))
  const data: {
    name: string
    amount: string
    fill: string
    accent: string | null
    id: string
    pct: number
    area: number
  }[] = top.map((r) => ({
    name: r.name,
    amount: r.amount,
    area: safePercent(r.amount, total),
    fill: themeColor,
    accent: r.color,
    id: r.id,
    pct: decimalUnits(total) > 0n ? safePercent(r.amount, total) * 100 : 0,
  }))
  if (decimalUnits(restAmount) > 0n) {
    data.push({
      name: t('wfSpending:hero.other'),
      amount: restAmount,
      area: safePercent(restAmount, total),
      fill: themeColor,
      accent: null,
      id: '__other__',
      pct: decimalUnits(total) > 0n ? safePercent(restAmount, total) * 100 : 0,
    })
  }

  return (
    <div className="border-border/60 bg-card/40 overflow-hidden rounded-xl border p-4 backdrop-blur-xl md:p-5">
      <div className="h-55 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={data}
            dataKey="area"
            aspectRatio={4 / 3}
            stroke="transparent"
            content={
              (
                <CategoryTreemapNodeMono
                  currency={currency}
                  onActivate={(id) => {
                    if (id && id !== '__other__') {
                      navigate(activityHrefFor(id))
                    }
                  }}
                />
              ) as unknown as React.ReactElement
            }
            isAnimationActive={false}
            onClick={(node: unknown) => {
              const id = (node as { id?: string } | null)?.id
              if (id && id !== '__other__') {
                navigate(activityHrefFor(id))
              }
            }}
          >
            <Tooltip
              cursor={{ fill: 'var(--muted)', opacity: 0.3 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const p = payload[0].payload as {
                  name: string
                  amount: string
                  pct: number
                }
                return (
                  <div className="bg-background rounded-md border px-3 py-2 text-xs shadow-sm">
                    <div className="text-foreground font-semibold">
                      {p.name}
                    </div>
                    <div className="text-muted-foreground tabular-nums">
                      <PrivacyAmount value={p.amount} currency={currency} /> ·{' '}
                      {numberFormatting.formatPercent(
                        (p.pct / 100).toFixed(6),
                        {
                          digits: 1,
                        },
                      )}
                    </div>
                  </div>
                )
              }}
            />
          </Treemap>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

const CategoryTreemapNodeMono: FC<CategoryTreemapNodeMonoProps> = ({
  depth = 0,
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  name,
  amount = '0',
  pct = 0,
  fill = '#7DB3D9',
  currency = 'USD',
  accent,
  id,
  onActivate,
}) => {
  const formatting = useAmountFormatting()
  const numberFormatting = useNumberFormatting()
  const { t } = useTranslation()
  const { isBalanceHidden } = useBalancePrivacy()
  if (depth === 0) return null

  const showName = width > 56 && height > 32
  const labelFontSize = Math.max(
    9.5,
    Math.min(11.5, Math.min(width, height) * 0.11),
  )
  const amountFontSize = Math.max(
    11,
    Math.min(15, Math.min(width, height) * 0.15),
  )
  const pctFontSize = 10
  const padX = Math.max(10, width * 0.05)
  const padY = Math.max(10, height * 0.07)

  const fillOpacity = 0.12 + Math.min(0.55, (pct / 30) * 0.55)
  const dotR = Math.max(2.5, Math.min(4, Math.min(width, height) * 0.04))
  const showDot = accent && width > 40 && height > 28

  const amountText = isBalanceHidden
    ? '••••'
    : formatting.formatAmount(amount, currency)
  const pctText = numberFormatting.formatPercent((pct / 100).toFixed(6), {
    digits: 1,
  })
  // Estimate from the visible characters; right-to-left pages add bidi marks.
  const amountTextW =
    stripBidiControls(amountText).length * amountFontSize * 0.58
  const pctTextW = stripBidiControls(pctText).length * pctFontSize * 0.6
  const innerW = Math.max(0, width - padX * 2)
  const showAmount = width > 60 && height > 48
  const showPct =
    showAmount && height > 70 && amountTextW + pctTextW + 8 <= innerW

  const isOther = id === '__other__'
  const isClickable = !!id && !isOther
  const a11yProps = isClickable
    ? {
        role: 'button' as const,
        tabIndex: 0,
        'aria-label': `${name ?? t('wfSpending:filters.category')}: ${amountText}, ${pctText}`,
        onKeyDown: (e: React.KeyboardEvent<SVGGElement>) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onActivate?.(id)
          }
        },
      }
    : {}

  return (
    <g style={{ cursor: isClickable ? 'pointer' : 'default' }} {...a11yProps}>
      <rect
        x={x + 1}
        y={y + 1}
        width={Math.max(0, width - 2)}
        height={Math.max(0, height - 2)}
        rx={5}
        ry={5}
        fill={fill}
        fillOpacity={fillOpacity}
        stroke={fill}
        strokeOpacity={0.4}
        strokeWidth={0.75}
      />
      {showDot && (
        <circle
          cx={x + padX + dotR}
          cy={y + padY + dotR}
          r={dotR}
          fill={accent ?? 'transparent'}
        />
      )}
      {/* Visual labels — the parent <g> already carries an aria-label with
          the full "<name>: <amount>, <pct>" string, so the SVG <text> nodes
          are decorative and would otherwise double-announce on screen
          readers. */}
      {showName && (
        <text
          x={x + padX + (showDot ? dotR * 2 + 6 : 0)}
          y={y + padY + labelFontSize - 2}
          fill="var(--foreground)"
          className="font-semibold uppercase"
          style={{
            fontSize: labelFontSize,
            letterSpacing: '0.06em',
            opacity: 0.7,
          }}
          aria-hidden
        >
          {truncateForBox(
            name ?? '',
            width - padX * 2 - (showDot ? dotR * 2 + 6 : 0),
            labelFontSize,
          )}
        </text>
      )}
      {showAmount && (
        <text
          x={x + padX}
          y={y + height - padY}
          fill="var(--foreground)"
          className="font-semibold tabular-nums"
          style={{ fontSize: amountFontSize, opacity: 0.92 }}
          aria-hidden
        >
          {truncateForBox(
            amountText,
            innerW - (showPct ? pctTextW + 8 : 0),
            amountFontSize,
          )}
        </text>
      )}
      {showPct && (
        <text
          x={x + width - padX}
          y={y + height - padY}
          textAnchor="end"
          fill="var(--foreground)"
          className="tabular-nums"
          style={{ fontSize: pctFontSize, opacity: 0.5 }}
          aria-hidden
        >
          {pctText}
        </text>
      )}
    </g>
  )
}

export function CategoryRankedBar({
  rows,
  total,
  currency,
  themeColor,
  groupRows = [],
  hasNoIncludedAccounts,
  activityHrefFor,
}: {
  rows: CategoryRow[]
  total: string
  currency: string
  themeColor: string
  hasNoIncludedAccounts: boolean
  /**
   * Budget groups (Needs / Wants / …). When any category here is assigned to a
   * group, the list switches to a grouped layout with collapsible group rows.
   */
  groupRows?: import('../types/budget').BudgetGroupRow[]
  activityHrefFor: (id: string) => string
}) {
  const formatting = useAmountFormatting()
  const numberFormatting = useNumberFormatting()
  const { t } = useTranslation()
  const { isBalanceHidden } = useBalancePrivacy()
  // Memoize derivations so we don't rebuild the Map + reduce + slices on every
  // parent re-render — this card lives inside a chart-heavy page.
  const derived = useMemo(() => {
    const categoryGroup = new Map<
      string,
      { id: string; name: string; color: string | null }
    >()
    for (const g of groupRows) {
      for (const cat of g.categories) {
        categoryGroup.set(cat.categoryId, {
          id: g.group.id,
          name: g.group.name,
          color: g.group.color,
        })
      }
    }
    const hasAnyGroup = rows.some((r) => categoryGroup.has(r.id))
    const categorizedSum = sumMoney(rows.map((r) => r.amount))
    const uncategorizedAmount = positiveMoney(
      subtractMoney(total, categorizedSum),
    )

    const top = rows.slice(0, 7)
    const restAmount = sumMoney(rows.slice(7).map((r) => r.amount))
    const barSegments: CategoryRow[] = [...top]
    if (decimalUnits(restAmount) > 0n) {
      barSegments.push({
        id: '__other__',
        name: t('wfSpending:hero.other'),
        amount: restAmount,
        color: null,
        icon: null,
      })
    }
    return {
      categoryGroup,
      hasAnyGroup,
      uncategorizedAmount,
      top,
      restAmount,
      barSegments,
    }
  }, [rows, total, groupRows, t])

  if (rows.length === 0) {
    return (
      <WhereItWentEmptyState hasNoIncludedAccounts={hasNoIncludedAccounts} />
    )
  }

  const {
    categoryGroup,
    hasAnyGroup,
    uncategorizedAmount,
    top,
    restAmount,
    barSegments,
  } = derived

  const StackedBar = (
    <div className="bg-foreground/10 relative flex h-3 w-full overflow-hidden rounded-full">
      {(!rows.some((row) => decimalUnits(row.amount) < 0n)
        ? barSegments
        : []
      ).map((s, i) => {
        const share = safePercent(s.amount, total) * 100
        const color = s.color ?? themeColor
        return (
          <div
            key={s.id}
            className="h-full transition-opacity hover:opacity-80"
            style={{
              width: `${share}%`,
              backgroundColor: color,
              opacity: 0.85 - i * 0.05,
              borderRight: '1px solid var(--card)',
            }}
            title={`${s.name} — ${
              isBalanceHidden
                ? '••••'
                : formatting.formatAmount(s.amount, currency)
            } (${numberFormatting.formatPercent((share / 100).toFixed(6), { digits: 1 })})`}
          />
        )
      })}
    </div>
  )

  if (hasAnyGroup) {
    // Group rows by their group assignment; unassigned categories + the
    // uncategorized bucket fall into a synthetic "Other" group.
    interface Bucket {
      id: string
      name: string
      color: string | null
      categories: CategoryRow[]
      total: string
    }
    const buckets = new Map<string, Bucket>()
    const ensureBucket = (id: string, name: string, color: string | null) => {
      let b = buckets.get(id)
      if (!b) {
        b = { id, name, color, categories: [], total: '0' }
        buckets.set(id, b)
      }
      return b
    }
    // Seed declared groups first so they keep the user's sortOrder when totals tie.
    for (const g of groupRows)
      ensureBucket(g.group.id, g.group.name, g.group.color)

    // The backend ships an "Other" system group (key="other"). Reuse it for
    // unassigned categories so we don't render two "Other" rows side by side.
    const fallbackGroup =
      groupRows.find((g) => g.group.key === 'other') ??
      groupRows.find((g) => g.group.name.toLowerCase() === 'other')
    const ensureOther = () =>
      fallbackGroup
        ? ensureBucket(
            fallbackGroup.group.id,
            fallbackGroup.group.name,
            fallbackGroup.group.color,
          )
        : ensureBucket('__other__', t('wfSpending:hero.other'), null)

    for (const row of rows) {
      let b: Bucket
      if (row.id === SAVINGS_ROW_ID) {
        b = ensureBucket(
          SAVINGS_ROW_ID,
          t('wfSpending:cashFlow.saving'),
          SAVINGS_ROW_COLOR,
        )
      } else {
        const g = categoryGroup.get(row.id)
        b = g ? ensureBucket(g.id, g.name, g.color) : ensureOther()
      }
      b.categories.push(row)
      b.total = sumMoney([b.total, row.amount])
    }
    if (decimalUnits(uncategorizedAmount) > 0n) {
      const b = ensureOther()
      b.categories.push({
        id: '__uncategorized__',
        name: t('wfSpending:tabContent.uncategorizedReview'),
        color: null,
        icon: null,
        amount: uncategorizedAmount,
      })
      b.total = sumMoney([b.total, uncategorizedAmount])
    }

    // Preserve insertion order: declared groups follow the user's `sortOrder`
    // from the backend (mockup convention), and the synthetic "Other" bucket
    // naturally lands last because it's only created on demand.
    const orderedBuckets = Array.from(buckets.values()).filter(
      (b) => decimalUnits(b.total) !== 0n,
    )

    return (
      <div>
        {StackedBar}
        <div className="mt-3 space-y-2">
          {orderedBuckets.map((bucket) => (
            <GroupedCategoryBlock
              key={bucket.id}
              bucket={bucket}
              total={total}
              currency={currency}
              themeColor={themeColor}
              activityHrefFor={activityHrefFor}
            />
          ))}
        </div>
      </div>
    )
  }

  // ── Flat layout (no budget groups configured) — unchanged. ──────────
  const uncategorizedShare =
    decimalUnits(total) > 0n ? safePercent(uncategorizedAmount, total) * 100 : 0
  return (
    <div className="border-border/60 bg-card/40 overflow-hidden rounded-xl border p-4 backdrop-blur-xl md:p-5">
      {StackedBar}

      <div className="mt-3 space-y-1.5">
        {top.map((r, i) => {
          const share = safePercent(r.amount, total) * 100
          const color = r.color ?? themeColor
          return (
            <Link
              key={r.id}
              to={activityHrefFor(r.id)}
              className="hover:bg-muted/40 group flex items-center gap-2.5 rounded-md px-1 py-1 transition-colors"
            >
              <span
                className="block h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: color, opacity: 0.85 - i * 0.05 }}
              />
              <span className="text-foreground/90 min-w-0 flex-1 truncate text-xs font-medium">
                {r.name}
              </span>
              <span className="text-muted-foreground/70 text-2xs w-12 text-end tabular-nums">
                {numberFormatting.formatPercent((share / 100).toFixed(6), {
                  digits: 1,
                })}
              </span>
              <span className="text-foreground w-24 text-end text-xs font-semibold tabular-nums">
                <PrivacyAmount value={r.amount} currency={currency} />
              </span>
            </Link>
          )
        })}
        {decimalUnits(uncategorizedAmount) > 0n && (
          <Link
            to={activityHrefFor('__uncategorized__')}
            className="border-border/60 hover:bg-muted/40 mt-1 flex items-center gap-2.5 rounded-md border border-dashed px-2 py-1.5 transition-colors"
          >
            <Icons.AlertCircle className="text-muted-foreground h-3 w-3 shrink-0" />
            <span className="text-foreground/80 min-w-0 flex-1 text-xs font-medium">
              {t('wfSpending:tabContent.uncategorizedImprove')}
            </span>
            <span className="text-muted-foreground/70 text-2xs w-12 text-end tabular-nums">
              {numberFormatting.formatPercent(
                (uncategorizedShare / 100).toFixed(6),
                { digits: 1 },
              )}
            </span>
            <span className="text-foreground w-24 text-end text-xs font-semibold tabular-nums">
              <PrivacyAmount value={uncategorizedAmount} currency={currency} />
            </span>
          </Link>
        )}
        {decimalUnits(restAmount) > 0n && (
          <div className="text-muted-foreground/60 text-2xs px-1 pt-1">
            {t('wfSpending:tabContent.plusMore', { count: rows.length - 7 })} ·{' '}
            <PrivacyAmount value={restAmount} currency={currency} />
          </div>
        )}
      </div>
    </div>
  )
}

function GroupedCategoryBlock({
  bucket,
  total,
  currency,
  themeColor,
  activityHrefFor,
}: {
  bucket: {
    id: string
    name: string
    color: string | null
    categories: CategoryRow[]
    total: string
  }
  total: string
  currency: string
  themeColor: string
  activityHrefFor: (id: string) => string
}) {
  const { t } = useTranslation()
  const numberFormatting = useNumberFormatting()
  const [expanded, setExpanded] = useState(false)
  const share =
    decimalUnits(total) > 0n ? safePercent(bucket.total, total) * 100 : 0
  const accent = bucket.color ?? themeColor
  // Sort categories by spend descending, but always pin the uncategorized
  // bucket to the end — it's a "to-do" row, not a normal category.
  const sortedCats = useMemo(
    () =>
      bucket.categories.slice().sort((a, b) => {
        if (a.id === '__uncategorized__') return 1
        if (b.id === '__uncategorized__') return -1
        return decimalUnits(a.amount) > decimalUnits(b.amount)
          ? -1
          : decimalUnits(a.amount) < decimalUnits(b.amount)
            ? 1
            : 0
      }),
    [bucket.categories],
  )

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="hover:bg-muted/40 flex w-full items-center gap-2.5 rounded-md px-1 py-1 transition-colors"
      >
        <Icons.ChevronRight
          className={cn(
            'text-muted-foreground/70 h-3 w-3 shrink-0 transition-transform',
            expanded ? 'rotate-90' : 'rtl:rotate-180',
          )}
        />
        <span
          className="block h-2.5 w-2.5 shrink-0 rounded-sm"
          style={{ backgroundColor: accent }}
        />
        <span className="text-foreground min-w-0 flex-1 truncate text-start text-xs font-semibold tracking-wide uppercase">
          {getBudgetGroupLabel(t, bucket.id, bucket.name)}
        </span>
        <span className="text-muted-foreground/80 text-2xs w-12 text-end font-medium tabular-nums">
          {numberFormatting.formatPercent((share / 100).toFixed(6), {
            digits: 1,
          })}
        </span>
        <span className="text-foreground w-24 text-end text-xs font-semibold tabular-nums">
          <PrivacyAmount value={bucket.total} currency={currency} />
        </span>
      </button>
      {expanded && (
        <div className="mt-1 space-y-0.5 ps-6">
          {sortedCats.map((cat) => {
            const catShare =
              decimalUnits(total) > 0n
                ? safePercent(cat.amount, total) * 100
                : 0
            const isUncategorized = cat.id === '__uncategorized__'
            const to = activityHrefFor(cat.id)
            const dotColor = cat.color ?? accent
            return (
              <Link
                key={cat.id}
                to={to}
                className="hover:bg-muted/40 flex items-center gap-2.5 rounded-md px-1 py-1 transition-colors"
              >
                <span
                  className="block h-2 w-2 shrink-0 rounded-sm"
                  style={{ backgroundColor: dotColor, opacity: 0.85 }}
                />
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-xs font-medium',
                    isUncategorized
                      ? 'text-muted-foreground/90 italic'
                      : 'text-foreground/90',
                  )}
                >
                  {cat.name}
                </span>
                <span className="text-muted-foreground/70 text-2xs w-12 text-end tabular-nums">
                  {numberFormatting.formatPercent((catShare / 100).toFixed(6), {
                    digits: 1,
                  })}
                </span>
                <span className="text-foreground w-24 text-end text-xs font-medium tabular-nums">
                  <PrivacyAmount value={cat.amount} currency={currency} />
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function truncateForBox(
  text: string,
  boxWidth: number,
  fontSize: number,
): string {
  if (!text) return ''
  const charW = fontSize * 0.62
  const max = Math.max(2, Math.floor(boxWidth / charW))
  return text.length > max ? text.slice(0, Math.max(1, max - 1)) + '…' : text
}
