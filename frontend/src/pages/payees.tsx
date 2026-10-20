import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Field } from '@/components/forms'
import { Button } from '@/components/ui/button'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from '@/components/primitives'
import { getPayees, type Payee } from '@/lib/api'
import { useWrite } from '@/lib/use-write'

export function PayeeSettings() {
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Payee | null | undefined>()
  const [name, setName] = useState('')
  const query = useQuery({
    queryKey: ['payees', search],
    queryFn: ({ signal }) => getPayees(search, signal),
  })
  const write = useWrite()
  return (
    <>
      <PageHeader
        title="Settings"
        description="Payees · normalized names, original descriptions preserved"
      >
        <Button
          onClick={() => {
            setEditing(null)
            setName('')
          }}
        >
          Add payee
        </Button>
      </PageHeader>
      <Field label="Search payees">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Field>
      {editing !== undefined && (
        <form
          className="editor-surface"
          onSubmit={(e) => {
            e.preventDefault()
            write.mutate(
              {
                path: editing ? `/payees/${editing.id}` : '/payees',
                method: editing ? 'PATCH' : 'POST',
                data: { name: name.trim() },
              },
              { onSuccess: () => setEditing(undefined) },
            )
          }}
        >
          <fieldset disabled={write.isPending}>
            <Field label="Payee name">
              <input
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <p className="metadata">
              Renaming updates the display name of linked transactions. Amounts
              and raw descriptions stay unchanged.
            </p>
            <div className="form-actions">
              <Button type="submit">Save payee</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(undefined)}
              >
                Cancel
              </Button>
            </div>
          </fieldset>
          {write.isError && <ErrorState text={write.error.message} />}
        </form>
      )}
      {query.isPending ? (
        <LoadingState text="Loading payees…" />
      ) : query.isError ? (
        <ErrorState
          text="Unable to load payees"
          retry={() => void query.refetch()}
        />
      ) : (
        <section aria-label="Payees">
          {!query.data.length && (
            <EmptyState
              title="No matching payees"
              detail="Add a normalized name or change your search."
            />
          )}
          {query.data.map((payee) => (
            <div className="automation-row" key={payee.id}>
              <strong>{payee.name}</strong>
              <Button
                variant="outline"
                size="sm"
                aria-label={`Rename ${payee.name}`}
                onClick={() => {
                  setEditing(payee)
                  setName(payee.name)
                }}
              >
                Rename
              </Button>
            </div>
          ))}
          {query.data.length === 50 && (
            <p className="metadata">
              Showing the first 50 matches. Refine the search to find another
              payee.
            </p>
          )}
        </section>
      )}
    </>
  )
}
