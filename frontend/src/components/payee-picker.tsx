import { useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getPayees, type Payee } from '@/lib/api'
import { useWrite } from '@/lib/use-write'
import { Button } from './ui/button'

/** Search/selection changes only the payee link, never the raw description. */
export function PayeePicker({
  initial,
  onChange,
}: {
  initial?: Payee | null
  onChange?: (id: string) => void
}) {
  const id = useId()
  const [search, setSearch] = useState('')
  const [opened, setOpened] = useState(false)
  const [selected, setSelected] = useState<Payee | null>(initial ?? null)
  const [name, setName] = useState('')
  const [notice, setNotice] = useState('')
  const payees = useQuery({
    queryKey: ['payees', search],
    queryFn: ({ signal }) => getPayees(search, signal),
    enabled: opened,
  })
  const write = useWrite()
  const choices = [
    ...(selected ? [selected] : []),
    ...(payees.data ?? []).filter((p) => p.id !== selected?.id),
  ]
  function choose(payee: Payee | null) {
    setSelected(payee)
    onChange?.(payee?.id ?? '')
  }
  async function save(rename: boolean) {
    if (!name.trim() || (rename && !selected)) return
    const result = await write.mutateAsync({
      path: rename ? `/payees/${selected!.id}` : '/payees',
      method: rename ? 'PATCH' : 'POST',
      data: { name: name.trim() },
    })
    choose({ id: result.id, name: result.name })
    setName('')
    setNotice(
      rename
        ? 'Payee renamed for all associated transactions.'
        : 'Payee created. Save the transaction to associate it.',
    )
  }
  return (
    <div className="field payee-picker">
      <label htmlFor={`${id}-search`}>Search payees</label>
      <input
        id={`${id}-search`}
        value={search}
        maxLength={120}
        placeholder="Find a normalized payee"
        onFocus={() => setOpened(true)}
        onChange={(e) => {
          setOpened(true)
          setSearch(e.target.value)
        }}
      />
      <label htmlFor={`${id}-select`}>Payee</label>
      <select
        id={`${id}-select`}
        name="payee_id"
        value={selected?.id ?? ''}
        onFocus={() => setOpened(true)}
        onChange={(e) =>
          choose(choices.find((p) => p.id === e.target.value) ?? null)
        }
      >
        <option value="">No payee</option>
        {choices.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {opened && payees.isPending && (
        <small role="status">Loading payees…</small>
      )}
      {payees.isError && (
        <small role="alert">
          Unable to load payees.{' '}
          <button type="button" onClick={() => void payees.refetch()}>
            Retry
          </button>
        </small>
      )}
      {opened && payees.data?.length === 0 && (
        <small>No matching payees.</small>
      )}
      {payees.data?.length === 50 && (
        <small>Showing 50 matches. Refine your search.</small>
      )}
      <details>
        <summary>Create or rename a payee</summary>
        <label htmlFor={`${id}-name`}>Payee name</label>
        <input
          id={`${id}-name`}
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex flex-wrap gap-2 mt-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!name.trim() || write.isPending}
            onClick={() => void save(false).catch(() => {})}
          >
            Create payee
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!selected || !name.trim() || write.isPending}
            onClick={() => {
              if (
                window.confirm(
                  'Rename this payee for every associated transaction? Raw descriptions will be preserved.',
                )
              )
                void save(true).catch(() => {})
            }}
          >
            Rename selected payee
          </Button>
        </div>
        <small>
          These actions save the payee immediately. Renaming affects all its
          transactions.
        </small>
      </details>
      {write.isError && <small role="alert">{write.error.message}</small>}
      {notice && <small role="status">{notice}</small>}
    </div>
  )
}
