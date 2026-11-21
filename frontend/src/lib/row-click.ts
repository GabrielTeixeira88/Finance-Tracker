// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Wealthfolio 92b4647 apps/frontend/src/lib/row-click.ts.
// See THIRD_PARTY_NOTICES.md for source and license attribution.
import type { MouseEvent } from 'react'

const ROW_CLICK_IGNORED =
  'button, a, input, label, [role="button"], [role="checkbox"], [data-row-click-ignore]'

/** Row controls, portalled menus and text selection retain their own behavior. */
export function isRowBodyClick(event: MouseEvent<HTMLElement>): boolean {
  const target = event.target
  if (
    !(target instanceof Element) ||
    !event.currentTarget.contains(target) ||
    target.closest(ROW_CLICK_IGNORED)
  )
    return false
  return window.getSelection()?.isCollapsed !== false
}
