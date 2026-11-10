// SPDX-License-Identifier: AGPL-3.0-only
// Sheet structure adapted from Wealthfolio 92b4647 spending/components/cash-activity-form.tsx.
// Existing exact posting/review forms remain authoritative inside the native editor surface.
import type { ReactNode } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/vendor/wealthfolio/ui/components/ui/sheet'
export function ActivityEditor({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent
        side="inline-end"
        className="wf-workspace wf-editor flex h-full w-full flex-col overflow-hidden p-0 sm:max-w-xl"
      >
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  )
}
