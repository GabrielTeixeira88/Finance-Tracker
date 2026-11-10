// Minimal compatibility boundary for upstream UI; monetary helpers are intentionally absent.
export { cn } from '@/lib/utils'
export function isKeyboardEventComposing(
  event: Pick<KeyboardEvent, 'isComposing' | 'keyCode'>,
) {
  return event.isComposing || event.keyCode === 229
}
