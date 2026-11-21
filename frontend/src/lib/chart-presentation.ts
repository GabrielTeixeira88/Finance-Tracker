// SPDX-License-Identifier: AGPL-3.0-only
// Curve/gradient conventions adapted from Wealthfolio 92b4647 history-chart.tsx.
// Modes select presentation only: they never generate intermediate monetary values.
export type FinancialChartMode = 'ledger' | 'manual-observations' | 'market'
export const financialCurve = (mode: FinancialChartMode) =>
  mode === 'ledger' ? ('stepAfter' as const) : ('monotoneX' as const)
export const financialGradient = [
  { offset: '5%', opacity: 0.2 },
  { offset: '70%', opacity: 0.08 },
  { offset: '100%', opacity: 0 },
] as const
