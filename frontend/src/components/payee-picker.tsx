import { t as tr } from '@/lib/i18n'
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
        ? tr('dynamic:payee_renamed_for_all_associated_transactions__18803c')
        : tr('dynamic:payee_created_save_the_transaction_to_associate__b082a3'),
    )
  }
  return (
    <div className="field payee-picker">
      <label htmlFor={`${id}-search`}>
        {tr('payee_picker:search_payees_1e877e')}
      </label>
      <input
        id={`${id}-search`}
        value={search}
        maxLength={120}
        placeholder={tr('payee_picker:find_a_normalized_payee_8e228d')}
        onFocus={() => setOpened(true)}
        onChange={(e) => {
          setOpened(true)
          setSearch(e.target.value)
        }}
      />
      <label htmlFor={`${id}-select`}>{tr('payee_picker:payee_dde5f9')}</label>
      <select
        id={`${id}-select`}
        name="payee_id"
        value={selected?.id ?? ''}
        onFocus={() => setOpened(true)}
        onChange={(e) =>
          choose(choices.find((p) => p.id === e.target.value) ?? null)
        }
      >
        <option value="">{tr('payee_picker:no_payee_542e74')}</option>
        {choices.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {opened && payees.isPending && (
        <small role="status">{tr('payee_picker:loading_payees__f905a4')}</small>
      )}
      {payees.isError && (
        <small role="alert">
          {' '}
          {tr('payee_picker:unable_to_load_payees__4b5394')}{' '}
          <button type="button" onClick={() => void payees.refetch()}>
            {tr('payee_picker:retry_9f5cd8')}
          </button>
        </small>
      )}
      {opened && payees.data?.length === 0 && (
        <small>{tr('payee_picker:no_matching_payees__74fa07')}</small>
      )}
      {payees.data?.length === 50 && (
        <small>
          {tr('payee_picker:showing_50_matches_refine_your_search__1b09ba')}
        </small>
      )}
      <details>
        <summary>{tr('payee_picker:create_or_rename_a_payee_9bb7c1')}</summary>
        <label htmlFor={`${id}-name`}>
          {tr('payee_picker:payee_name_3759c5')}
        </label>
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
            {tr('payee_picker:create_payee_369d9c')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!selected || !name.trim() || write.isPending}
            onClick={() => {
              if (
                window.confirm(
                  tr(
                    'dynamic:rename_this_payee_for_every_associated_transacti_311e5b',
                  ),
                )
              )
                void save(true).catch(() => {})
            }}
          >
            {tr('payee_picker:rename_selected_payee_d0393f')}
          </Button>
        </div>
        <small>
          {tr(
            'payee_picker:these_actions_save_the_payee_immediately_renamin_6496a2',
          )}
        </small>
      </details>
      {write.isError && <small role="alert">{write.error.message}</small>}
      {notice && <small role="status">{notice}</small>}
    </div>
  )
}
