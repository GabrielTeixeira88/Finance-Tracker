// Source: Wealthfolio 92b4647; package UI declares MIT. See THIRD_PARTY_NOTICES.md.
import * as React from 'react'

import { cn } from '../../lib/utils'

function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    <label
      data-slot="label"
      className={cn(
        'peer-data-disabled:cursor-not-allowed peer-data-disabled:opacity-70 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className,
      )}
      {...props}
    />
  )
}

export { Label }
