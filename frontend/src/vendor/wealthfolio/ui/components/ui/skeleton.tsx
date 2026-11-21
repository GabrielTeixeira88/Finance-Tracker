// Source: Wealthfolio 92b4647; package UI declares MIT. See THIRD_PARTY_NOTICES.md.
import { cn } from '../../lib/utils'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('bg-muted animate-pulse rounded-md', className)}
      {...props}
    />
  )
}

export { Skeleton }
