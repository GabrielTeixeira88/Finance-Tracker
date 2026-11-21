import { getLocale } from '@/lib/preferences'
export { useIsMobileViewport } from '@/features/holdings/compat'
export function useNameComparator() {
  const collator = new Intl.Collator(getLocale())
  return collator.compare
}
