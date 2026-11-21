import { useState, type Dispatch, type SetStateAction } from 'react'

/** Persist only display preferences. Financial filters, selections and sort state stay in memory/URL. */
export function usePersistentState<T>(
  key: string,
  initial: T,
  _fallbackKey?: string,
): [T, Dispatch<SetStateAction<T>>] {
  void _fallbackKey
  const scope =
    sessionStorage.getItem('finance-tracker-appearance-scope') === 'demo'
      ? 'demo'
      : 'normal'
  const storageKey = `finance-tracker:${scope}:table-appearance:${key}`
  const permitted = /column-visibility|column-sizing|density/.test(key)
  const [value, setValue] = useState<T>(() => {
    if (permitted) {
      try {
        const saved = localStorage.getItem(storageKey)
        if (saved) return JSON.parse(saved) as T
      } catch {
        /* Appearance is optional. */
      }
    }
    return initial
  })
  return [
    value,
    (update) =>
      setValue((previous) => {
        const next =
          typeof update === 'function'
            ? (update as (value: T) => T)(previous)
            : update
        if (permitted) {
          try {
            localStorage.setItem(storageKey, JSON.stringify(next))
          } catch {
            /* Appearance is optional. */
          }
        }
        return next
      }),
  ]
}
