// SPDX-License-Identifier: AGPL-3.0-only
// Source: Wealthfolio 92b4647; see THIRD_PARTY_NOTICES.md.
import { AnimatedToggleGroup } from './ui'
import { useTranslation } from 'react-i18next'
import type { HoldingsVisibilityFilter } from './holdings-visibility'

interface HoldingsStatusSegmentedControlProps {
  value: HoldingsVisibilityFilter[]
  onChange: (value: HoldingsVisibilityFilter[]) => void
  showClosedPositions?: boolean
}

export function HoldingsStatusSegmentedControl({
  value,
  onChange,
  showClosedPositions = true,
}: HoldingsStatusSegmentedControlProps) {
  const { t } = useTranslation()

  if (!showClosedPositions) return null

  const selectedStatus: HoldingsVisibilityFilter =
    value.length === 1 && value[0] === 'closed' ? 'closed' : 'open'

  return (
    <AnimatedToggleGroup<HoldingsVisibilityFilter>
      aria-label={t('wfCommon:status')}
      value={selectedStatus}
      onValueChange={(status) => onChange([status])}
      items={[
        { value: 'open', label: t('wfHoldings:open') },
        { value: 'closed', label: t('wfHoldings:closed') },
      ]}
      variant="secondary"
      size="xs"
      rounded="md"
      className="shrink-0"
    />
  )
}
