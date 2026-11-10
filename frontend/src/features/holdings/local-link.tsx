import { useRoute, updateRouteParams } from '@/lib/navigation'
import type { AnchorHTMLAttributes } from 'react'
export function Link({
  to,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  const route = useRoute()
  const id = to.split('/').at(-1)?.split('?')[0] ?? ''
  const next = new URLSearchParams(route.params)
  next.set('position', decodeURIComponent(id))
  const sourceQuery = new URLSearchParams(to.split('?')[1] ?? '')
  next.delete('action')
  next.set(
    'position_view',
    sourceQuery.get('tab') === 'history' ? 'Values' : 'Overview',
  )
  if (sourceQuery.get('action') === 'confirm-balance')
    next.set('action', 'value')
  const destination = `#/holdings?${next}`
  return (
    <a
      {...props}
      href={destination}
      onClick={(event) => {
        props.onClick?.(event)
        if (
          !event.defaultPrevented &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.shiftKey &&
          event.button === 0
        ) {
          event.preventDefault()
          updateRouteParams(next)
        }
      }}
    >
      {children}
    </a>
  )
}
