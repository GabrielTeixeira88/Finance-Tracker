// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Wealthfolio 92b4647 apps/frontend/src/features/spending/components/selection-checkbox.tsx; exact local data boundaries.
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'
import { Checkbox } from './ui'

/**
 * Circular selection control for the mobile list, following the platform
 * convention rather than the square checkbox the desktop table uses.
 *
 * The visible circle stays small, so a `before` pseudo-element widens the hit
 * area to roughly the 44pt touch target without changing the layout around it.
 */
export function SelectionCheckbox({
  className,
  ...props
}: ComponentProps<typeof Checkbox>) {
  return (
    <Checkbox
      className={cn(
        'h-5.5 w-5.5 relative rounded-full border-[1.5px]',
        "before:absolute before:-inset-[0.6875rem] before:content-['']",
        className,
      )}
      {...props}
    />
  )
}
