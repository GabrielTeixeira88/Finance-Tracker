// SPDX-License-Identifier: AGPL-3.0-only
// Wealthfolio 92b4647 headline.ts; exact strings replace financial Number math.
import { decimalUnits, subtractMoney, unitsToMoney } from '@/lib/money'
import { exactAbs } from '../compat'
const MIN_DRIVER_CONCENTRATION = 0.25
/**
 * Headline composition for the "What changed" view.
 *
 * `buildHeadline` is the only place that decides what the narrative says.
 * It reads period state + per-category descriptors and emits a structured
 * model. Components render the fragments — they don't decide content.
 */

import { type ChangeDescriptor, type PeriodState } from './headline-descriptors'

type HeadlineTranslator = (
  key: string,
  options?: Record<string, unknown>,
) => string

export type HeadlineFragmentTone = 'up' | 'down' | 'neutral'

/** A typed fragment of the narrative — components decide colors/arrows. */
export type HeadlineFragment =
  | { type: 'text'; text: string }
  | { type: 'amount'; value: string; tone: HeadlineFragmentTone }
  | { type: 'mover'; descriptor: HeadlineMover; tone: HeadlineFragmentTone }

export interface HeadlineMover {
  id: string
  name: string
  descriptor: ChangeDescriptor
}

export interface HeadlineModel {
  /** Used by the meta line above the headline. */
  metaLabel: string
  /** Narrative paragraph, broken into fragments for styled rendering. */
  fragments: HeadlineFragment[]
  /** Compact comparison line — replaces the 4-stat strip. */
  summary: HeadlineSummary | null
}

export interface HeadlineSummary {
  current: string
  prior: string | null
  delta: string | null
  pct: string | null
  showPct: boolean
}

export interface BuildHeadlineInput {
  periodState: PeriodState
  movers: (ChangeDescriptor & { id: string; name: string })[]
  currentTotal: string
  priorTotal: string
  priorLabel: string
  metaLabel: string
  t: HeadlineTranslator
}

export function buildHeadline(input: BuildHeadlineInput): HeadlineModel {
  const {
    periodState,
    movers,
    currentTotal,
    priorTotal,
    priorLabel,
    metaLabel,
    t,
  } = input
  const normalizedPriorLabel = priorLabel.replace(/[.\s]+$/u, '')

  if (periodState.kind === 'no_activity_either_side') {
    return {
      metaLabel,
      fragments: [
        { type: 'text', text: t('wfSpending:whatChanged.headlineNoActivity') },
      ],
      summary: null,
    }
  }

  if (periodState.kind === 'no_prior_period') {
    return {
      // Suppress the meta label when there's nothing to compare against.
      metaLabel: '',
      fragments: [
        { type: 'text', text: t('wfSpending:whatChanged.headlineLeadPrefix') },
        { type: 'amount', value: currentTotal, tone: 'neutral' },
        {
          type: 'text',
          text: t('wfSpending:whatChanged.headlineNoPriorSuffix'),
        },
      ],
      // No summary line in this state — the narrative already carries the total.
      summary: null,
    }
  }

  // valid_comparison from here on.
  const netDelta = subtractMoney(currentTotal, priorTotal)
  const direction: HeadlineFragmentTone =
    decimalUnits(netDelta) >= 0n ? 'up' : 'down'

  // Total Δ% has its own noise guard (we use the same base threshold as
  // per-category, applied to total spend).
  const summaryShowPct =
    decimalUnits(priorTotal) > 0n &&
    decimalUnits(exactAbs(netDelta)) * 1000n >= decimalUnits(priorTotal) * 5n
  const summary: HeadlineSummary = {
    current: currentTotal,
    prior: priorTotal,
    delta: netDelta,
    pct:
      decimalUnits(priorTotal) > 0n
        ? unitsToMoney(
            (decimalUnits(netDelta) * 100000000n) / decimalUnits(priorTotal),
          )
        : null,
    showPct: summaryShowPct,
  }

  // Lead sentence: "You spent CA$X more/less than {priorLabel}."
  const lead: HeadlineFragment[] = [
    { type: 'text', text: t('wfSpending:whatChanged.headlineLeadPrefix') },
    {
      type: 'amount',
      value: exactAbs(netDelta),
      tone: decimalUnits(netDelta) === 0n ? 'neutral' : direction,
    },
    {
      type: 'text',
      text: t(
        decimalUnits(netDelta) >= 0n
          ? 'wfSpending:whatChanged.headlineMoreSuffix'
          : 'wfSpending:whatChanged.headlineLessSuffix',
        { priorLabel: normalizedPriorLabel },
      ),
    },
  ]

  if (decimalUnits(netDelta) === 0n || movers.length === 0) {
    return { metaLabel, fragments: lead, summary }
  }

  // Driver sentence.
  // Filter out no-activity rows; rank already applied upstream.
  const significantMovers = movers.filter(
    (m) => m.kind !== 'no_activity' && decimalUnits(m.absDelta) > 0n,
  )

  if (significantMovers.length === 0) {
    return { metaLabel, fragments: lead, summary }
  }

  const top =
    significantMovers.find(
      (m) => decimalUnits(m.delta) > 0n === decimalUnits(netDelta) > 0n,
    ) ?? significantMovers[0]
  // Concentration gate: if no row owns enough of the movement, don't claim a driver.
  if ((top.shareOfMovement ?? 0) < MIN_DRIVER_CONCENTRATION) {
    return {
      metaLabel,
      fragments: [
        ...lead,
        { type: 'text', text: ' ' },
        {
          type: 'text',
          text: t('wfSpending:whatChanged.headlineSeveralDrivers'),
        },
      ],
      summary,
    }
  }

  const topTone: HeadlineFragmentTone =
    decimalUnits(top.delta) >= 0n ? 'up' : 'down'
  const topMover: HeadlineMover = {
    id: top.id,
    name: top.name,
    descriptor: top,
  }

  const driverFragments: HeadlineFragment[] = [
    {
      type: 'text',
      text: t(
        decimalUnits(netDelta) >= 0n
          ? 'wfSpending:whatChanged.headlineRiseDriverPrefix'
          : 'wfSpending:whatChanged.headlineDropDriverPrefix',
      ),
    },
    { type: 'mover', descriptor: topMover, tone: topTone },
    { type: 'text', text: t('wfSpending:whatChanged.headlineSentenceEnd') },
  ]

  // Optional second mover, only when it moves opposite the net direction and is material.
  const second = significantMovers
    .filter((m) => m.id !== top.id)
    .find(
      (m) =>
        decimalUnits(m.delta) > 0n !== decimalUnits(netDelta) > 0n &&
        (m.shareOfMovement ?? 0) >= MIN_DRIVER_CONCENTRATION,
    )
  if (second) {
    const secondTone: HeadlineFragmentTone =
      decimalUnits(second.delta) >= 0n ? 'up' : 'down'
    driverFragments.push(
      { type: 'text', text: ' ' },
      {
        type: 'mover',
        descriptor: { id: second.id, name: second.name, descriptor: second },
        tone: secondTone,
      },
      {
        type: 'text',
        text: t('wfSpending:whatChanged.headlineOppositeSuffix'),
      },
    )
  }

  return {
    metaLabel,
    fragments: [...lead, ...driverFragments],
    summary,
  }
}
