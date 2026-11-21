import { t as tr } from '@/lib/i18n'
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
        title={tr('settings_v014:payees')}
        description={tr(
          'payees:payees_normalized_names_original_descriptions_pr_477788',
        )}
      >
        <Button
          onClick={() => {
            setEditing(null)
            setName('')
          }}
        >
          {tr('payees:add_payee_11d40f')}
        </Button>
      </PageHeader>
      <Field label={tr('payees:search_payees_1e877e')}>
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
            <Field label={tr('payees:payee_name_3759c5')}>
              <input
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <p className="metadata">
              {tr(
                'payees:renaming_updates_the_display_name_of_linked_tran_db8856',
              )}
            </p>
            <div className="form-actions">
              <Button type="submit">{tr('payees:save_payee_3869a9')}</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(undefined)}
              >
                {tr('payees:cancel_77dfd2')}
              </Button>
            </div>
          </fieldset>
          {write.isError && <ErrorState text={write.error.message} />}
        </form>
      )}
      {query.isPending ? (
        <LoadingState text={tr('payees:loading_payees__f905a4')} />
      ) : query.isError ? (
        <ErrorState
          text={tr('payees:unable_to_load_payees_0abdf7')}
          retry={() => void query.refetch()}
        />
      ) : (
        <section aria-label={tr('payees:payees_42ca15')}>
          {!query.data.length && (
            <EmptyState
              title={tr('payees:no_matching_payees_ad1e21')}
              detail={tr(
                'payees:add_a_normalized_name_or_change_your_search__a33083',
              )}
            />
          )}
          {query.data.map((payee) => (
            <div className="automation-row" key={payee.id}>
              <strong>{payee.name}</strong>
              <Button
                variant="outline"
                size="sm"
                aria-label={tr('messages:message_f2daca3f4eb7', {
                  value0: payee.name,
                })}
                onClick={() => {
                  setEditing(payee)
                  setName(payee.name)
                }}
              >
                {tr('payees:rename_d3f4cb')}
              </Button>
            </div>
          ))}
          {query.data.length === 50 && (
            <p className="metadata">
              {tr(
                'payees:showing_the_first_50_matches_refine_the_search_t_25964f',
              )}
            </p>
          )}
        </section>
      )}
    </>
  )
}
