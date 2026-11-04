// Adapted from pinned Wealthfolio tabs.tsx / animated-toggle-group.tsx.
// SPDX-License-Identifier: AGPL-3.0-only; see THIRD_PARTY_NOTICES.md.
import { m } from 'motion/react'
import { selectionSpring, useMotionPolicy } from '@/lib/motion'
import type { ButtonHTMLAttributes } from 'react'

export function SelectionIndicator({ id }: { id: string }) {
  const reduced = useMotionPolicy()
  return (
    <m.span
      aria-hidden="true"
      className="motion-selection"
      initial={false}
      layoutId={reduced ? undefined : id}
      transition={reduced ? { duration: 0 } : selectionSpring}
    />
  )
}

export function MotionChoice({
  selected,
  groupId,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  selected: boolean
  groupId: string
}) {
  return (
    <button {...props} aria-pressed={selected}>
      {selected && <SelectionIndicator id={groupId} />}
      <span className="motion-choice-label">{children}</span>
    </button>
  )
}
