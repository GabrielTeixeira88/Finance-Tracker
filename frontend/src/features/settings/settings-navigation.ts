import { navigateTo } from '@/lib/navigation'
export function settingsLink(view: string) {
  navigateTo('Settings', undefined, { view })
}
