// Visual spring adapted from the pinned licensed reference tab/toggle patterns.
// SPDX-License-Identifier: AGPL-3.0-only; see THIRD_PARTY_NOTICES.md.
import { useId, useSyncExternalStore } from 'react'

export function useSelectionId() {
  return `selection-${useId()}`
}

export const selectionSpring = {
  type: 'spring',
  stiffness: 500,
  damping: 35,
  mass: 0.6,
} as const
export const layoutSpring = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
  mass: 0.8,
} as const
export const fadeTransition = { duration: 0.16, ease: 'easeOut' } as const
export const chartTransition = { duration: 300, easing: 'ease-out' } as const

const mediaQuery = '(prefers-reduced-motion: reduce)'
function readReducedMotion() {
  return (
    typeof window === 'undefined' ||
    !window.matchMedia ||
    window.matchMedia(mediaQuery).matches
  )
}
function subscribeReducedMotion(notify: () => void) {
  const media = window.matchMedia?.(mediaQuery)
  media?.addEventListener('change', notify)
  return () => media?.removeEventListener('change', notify)
}

/** Live system preference, including changes while an editor/chart stays mounted. */
export function useMotionPolicy() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    readReducedMotion,
    () => true,
  )
}

/** Recharts interpolates normalized geometry only; exact financial labels never tween. */
export function useChartMotion() {
  const reduced = useMotionPolicy()
  return {
    isAnimationActive: !reduced,
    animationBegin: 0,
    animationDuration: chartTransition.duration,
    animationEasing: chartTransition.easing,
  }
}
