import { useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { useSpendingActions } from './compat'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/vendor/wealthfolio/ui/components/ui/popover'
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
} from '@/vendor/wealthfolio/ui/components/ui/command'
import { Button } from '../../holdings/ui'
export function QuickCategorizePopover({
  selectedCategoryId,
  onSelect,
  onClear,
  trigger,
}: {
  scope: string
  selectedCategoryId: string | null
  onSelect: (taxonomy: string, id: string) => void
  onClear: () => void
  trigger: ReactElement
}) {
  const { t } = useTranslation()
  const { categories, busy } = useSpendingActions()
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger} disabled={busy} />
      <PopoverContent className="w-64 p-0">
        <Command>
          <CommandInput placeholder={t('wfHoldings:search_placeholder')} />
          <CommandList>
            <CommandEmpty>{t('wfUi:faceted.noResults')}</CommandEmpty>
            {categories.map((category) => (
              <CommandItem
                key={category.id}
                value={category.name}
                onSelect={() => {
                  onSelect('local_categories', category.id)
                  setOpen(false)
                }}
              >
                {category.name}
                {category.id === selectedCategoryId ? ' ✓' : ''}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
        {selectedCategoryId && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              onClear()
              setOpen(false)
            }}
          >
            {t('wfCommon:clear')}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  )
}
export function QuickEventPopover({
  selectedEventId,
  onSelect,
  onClear,
  activityId,
  trigger,
}: {
  selectedEventId: string | null
  onSelect: (id: string) => void
  onClear: () => void
  activityId: string
  defaultDate?: Date
  trigger: ReactElement
}) {
  const { t } = useTranslation()
  const { events, busy, rows } = useSpendingActions()
  const [open, setOpen] = useState(false)
  const row = rows.find((row) => row.id === activityId)
  if (row?.transaction_type !== 'EXPENSE' || row.refund_purchase_id) return null
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger} disabled={busy} />
      <PopoverContent className="w-72 p-0">
        <Command>
          <CommandInput placeholder={t('wfSpending:transactions.tagEvent')} />
          <CommandList>
            <CommandEmpty>{t('wfUi:faceted.noResults')}</CommandEmpty>
            {events.map((report) => (
              <CommandItem
                key={report.event.id}
                value={report.event.name}
                disabled={
                  selectedEventId !== null &&
                  selectedEventId !== report.event.id
                }
                onSelect={() => {
                  onSelect(report.event.id)
                  setOpen(false)
                }}
              >
                {report.event.name}
                {selectedEventId === report.event.id ? ' ✓' : ''}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
        {selectedEventId && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              onClear()
              setOpen(false)
            }}
          >
            {t('wfCommon:clear')}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  )
}
