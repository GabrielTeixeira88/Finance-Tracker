// SPDX-License-Identifier: AGPL-3.0-only
// Source row/card/header composition from Wealthfolio 92b4647 spending-transactions-tab.tsx.
import '../../holdings/i18n'
import { Fragment, useState, type ComponentProps } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { TransactionTable } from '@/components/transaction-table'
import { useWrite } from '@/lib/use-write'
import { getEvents } from '@/lib/life-events'
import type { Transaction } from '@/lib/api'
import { ErrorState, EmptyState } from '@/components/primitives'
import { useIsMobileViewport } from '../../holdings/compat'
import {
  useDateFormatting,
  Card,
  Checkbox,
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from './ui'
import { DayHeaderRow, DayHeading } from '../day-header'
import { TransactionRow } from './transaction-row'
import { TransactionCard } from './transaction-card'
import { SelectionToolbar } from './selection-toolbar'
import {
  SpendingActionsProvider,
  toSpendingRow,
  type TransactionRowVM,
  NoUnsupportedAction,
} from './compat'

export function SpendingTable({
  rows,
  accounts,
  categories,
  onEdit,
  onDelete,
  busy = false,
  selected = [],
  onSelect,
  onSelectPage,
  onInspect,
  onCreateRule,
  onDuplicate,
  pageOffset = 0,
  pageTotal = rows.length,
}: ComponentProps<typeof TransactionTable> & {
  onDuplicate?: (row: Transaction) => void
  pageOffset?: number
  pageTotal?: number
}) {
  const { t } = useTranslation()
  const mobile = useIsMobileViewport()
  const { formatCalendarDate } = useDateFormatting()
  const write = useWrite()
  const events = useQuery({
    queryKey: ['life-events', 'activity-list'],
    queryFn: getEvents,
  })
  const [selectionMode, setSelectionMode] = useState(false)
  const sourceRows = rows.map((row) =>
    toSpendingRow(row, categories, !!onDuplicate),
  )
  const groups: { day: string; rows: TransactionRowVM[] }[] = []
  for (const row of sourceRows) {
    let group = groups.at(-1)
    if (group?.day !== row.activity.activityDate) {
      group = { day: row.activity.activityDate, rows: [] }
      groups.push(group)
    }
    group.rows.push(row)
  }
  // A day can span server pages. Do not present a partial page count as its full total.
  const isPartialDay = (day: string) =>
    (pageOffset > 0 && day === groups[0]?.day) ||
    (pageOffset + rows.length < pageTotal && day === groups.at(-1)?.day)
  const assign = (
    id: string,
    _taxonomy: string,
    category_id: string | null,
  ) => {
    void _taxonomy
    write.mutate({
      path: `/transactions/${id}`,
      method: 'PATCH',
      data: { category_id },
    })
  }
  const setEvent = (id: string, eventId: string | null) => {
    const current = events.data?.find((report) =>
      report.linked_ids.includes(id),
    )
    if (eventId)
      write.mutate({
        path: `/life-events/${eventId}/transactions`,
        data: { transaction_ids: [id] },
      })
    else if (current)
      write.mutate({
        path: `/life-events/${current.event.id}/transactions/${id}`,
        method: 'DELETE',
      })
  }
  const propsFor = (row: TransactionRowVM) => {
    const current = events.data?.find(
      (report) =>
        report.linked_ids.includes(row.activity.id) ||
        report.transactions.some((tx) => tx.id === row.activity.id),
    )
    const account = accounts.find(
      (account) => account.id === row.activity.accountId,
    )
    return {
      row,
      account: account ? { ...account, accountType: account.type } : undefined,
      event: current
        ? {
            id: current.event.id,
            name: current.event.name,
            eventTypeId: current.event.event_type,
          }
        : null,
      eventTypeColor: current?.event.color ?? null,
      showAccount: new Set(rows.map((row) => row.account_id)).size > 1,
      isSelected: selected.includes(row.activity.id),
      onToggleSelect: (id: string) => onSelect?.(id),
      onAssignCategory: assign,
      onClearCategory: (id: string, taxonomy: string) =>
        assign(id, taxonomy, null),
      onSetEvent: setEvent,
      onEdit: (row: TransactionRowVM) => onEdit?.(row.activity.original),
      onDelete: (row: TransactionRowVM) => onDelete?.(row.activity.original),
      onDuplicate: (row: TransactionRowVM) =>
        onDuplicate?.(row.activity.original),
      onMarkReimbursement: NoUnsupportedAction,
      onEditSplits: NoUnsupportedAction,
    }
  }
  if (!rows.length)
    return (
      <EmptyState
        title={t('transaction_table:no_transactions_match_this_view__aa3bbf')}
        detail={t(
          'transaction_table:add_a_transaction_or_adjust_your_filters__77fcec',
        )}
      />
    )
  return (
    <SpendingActionsProvider
      value={{
        categories,
        events: events.data ?? [],
        busy: busy || write.isPending,
        rows,
        inspect: onInspect,
        createRule: onCreateRule,
      }}
    >
      {write.isError && <ErrorState text={write.error.message} />}
      {events.isError && (
        <ErrorState
          text={events.error.message}
          retry={() => void events.refetch()}
        />
      )}
      {mobile ? (
        <div className="space-y-2">
          <SelectionToolbar
            rowCount={rows.length}
            selectionMode={selectionMode || selected.length > 0}
            onEnterSelectionMode={() => setSelectionMode(true)}
            onExitSelectionMode={() => {
              setSelectionMode(false)
              for (const id of selected) onSelect?.(id)
            }}
            allVisibleSelected={rows.every((row) => selected.includes(row.id))}
            someVisibleSelected={selected.length > 0}
            onToggleSelectAllVisible={() => onSelectPage?.()}
          />
          {groups.map((group) => (
            <Fragment key={group.day}>
              <div className="flex items-baseline gap-2 px-1 pt-2">
                <DayHeading
                  label={formatCalendarDate(group.day)}
                  count={group.rows.length}
                  isPartial={isPartialDay(group.day)}
                  countLabel={(count) =>
                    t('wfActivity:table.day_count', { count })
                  }
                  muted
                />
              </div>
              {group.rows.map((row) => (
                <TransactionCard
                  key={row.activity.id}
                  {...propsFor(row)}
                  selectionMode={selectionMode || selected.length > 0}
                />
              ))}
            </Fragment>
          ))}
        </div>
      ) : (
        <Card
          className="group/list min-h-0 overflow-auto"
          data-selecting={selected.length ? true : undefined}
        >
          <Table
            className="wf-spending-table table-fixed"
            aria-label={t('transaction_table:transaction_ledger_a1a871')}
          >
            <TableHeader className="bg-card sticky top-0 z-10">
              <TableRow>
                <TableHead className="w-10 px-3">
                  <Checkbox
                    aria-label={t(
                      'transaction_table:select_current_page_0e5f18',
                    )}
                    checked={rows.every((row) => selected.includes(row.id))}
                    indeterminate={
                      selected.length > 0 &&
                      !rows.every((row) => selected.includes(row.id))
                    }
                    onCheckedChange={() => onSelectPage?.()}
                  />
                </TableHead>
                <TableHead className="px-3">
                  {t('wfSpending:txTab.nameNotes')}
                </TableHead>
                <TableHead className="hidden w-44 px-3 sm:table-cell">
                  {t('forms:category_a3c686')}
                </TableHead>
                <TableHead className="w-36 px-3 text-end">
                  {t('forms:amount_43dc85')}
                </TableHead>
                <TableHead className="w-10 px-3" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <Fragment key={group.day}>
                  <DayHeaderRow>
                    <TableCell colSpan={5} className="px-3 py-1.5">
                      <div className="flex items-baseline gap-2">
                        <DayHeading
                          label={formatCalendarDate(group.day)}
                          count={group.rows.length}
                          isPartial={isPartialDay(group.day)}
                          countLabel={(count) =>
                            t('wfActivity:table.day_count', { count })
                          }
                        />
                      </div>
                    </TableCell>
                  </DayHeaderRow>
                  {group.rows.map((row) => (
                    <TransactionRow key={row.activity.id} {...propsFor(row)} />
                  ))}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </SpendingActionsProvider>
  )
}
