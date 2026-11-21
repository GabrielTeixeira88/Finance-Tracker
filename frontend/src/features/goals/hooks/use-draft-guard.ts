import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

/** Temporary scenarios remain memory-only; navigation never silently saves them. */
export function useDraftGuard(dirty: boolean, discard: () => void) {
  const { t } = useTranslation(),
    state = useRef({ dirty, discard })
  useEffect(() => {
    state.current = { dirty, discard }
  }, [dirty, discard])
  useEffect(() => {
    let previous = window.location.hash
    const allow = () => {
      if (!state.current.dirty) return true
      if (!window.confirm(t('goalsMigration:discardDraft'))) return false
      state.current.dirty = false
      state.current.discard()
      return true
    }
    const before = (event: Event) => {
      if (!allow()) event.preventDefault()
    }
    const click = (event: MouseEvent) => {
      const link =
        event.target instanceof Element
          ? event.target.closest('a[href^="#/"]')
          : null
      if (
        link &&
        link.getAttribute('href') !== window.location.hash &&
        !allow()
      ) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    const history = () => {
      if (window.location.hash !== previous && !allow()) {
        window.history.replaceState(window.history.state, '', previous)
        window.dispatchEvent(new Event('finance-tracker:navigation'))
      } else previous = window.location.hash
    }
    const unload = (event: BeforeUnloadEvent) => {
      if (state.current.dirty) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('finance-tracker:before-navigation', before)
    window.addEventListener('hashchange', history)
    window.addEventListener('beforeunload', unload)
    document.addEventListener('click', click, true)
    return () => {
      window.removeEventListener('finance-tracker:before-navigation', before)
      window.removeEventListener('hashchange', history)
      window.removeEventListener('beforeunload', unload)
      document.removeEventListener('click', click, true)
    }
  }, [t])
}
