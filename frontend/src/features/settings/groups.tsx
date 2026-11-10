// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Wealthfolio 92b4647 settings/portfolios/portfolios-page.tsx.
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { Account } from '@/lib/api'
import { useWrite } from '@/lib/use-write'
import { Field } from '@/components/forms'
import { Button } from '@/components/ui/button'
import { ErrorState, EmptyState, LoadingState } from '@/components/primitives'
import { DetailDrawer } from '@/components/detail-drawer'
import { SettingsHeader } from './settings-layout'
import { getGroups, type AccountGroup } from './api'

export function GroupsSettings({ accounts }: { accounts: Account[] }) {
  const { t } = useTranslation('settings_v014')
  const query = useQuery({
    queryKey: ['settings', 'account-groups'],
    queryFn: getGroups,
  })
  const [editing, setEditing] = useState<AccountGroup | null | undefined>()
  const [removing, setRemoving] = useState<AccountGroup>()
  const write = useWrite()
  return (
    <>
      <SettingsHeader title={t('groups')} description={t('groups_detail')}>
        <Button onClick={() => setEditing(null)}>{t('create_group')}</Button>
      </SettingsHeader>
      <p className="metadata">{t('portfolio_limit')}</p>
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState
          text={query.error.message}
          retry={() => void query.refetch()}
        />
      ) : !query.data.length ? (
        <EmptyState title={t('empty')} />
      ) : (
        <div className="source-settings-list">
          {query.data.map((group) => (
            <div key={group.id}>
              <div>
                <strong>{group.name}</strong>
                <p className="metadata">{group.description}</p>
                <small>
                  {accounts
                    .filter((a) => group.account_ids.includes(a.id))
                    .map((a) => a.name)
                    .join(' · ')}
                </small>
              </div>
              <Button variant="ghost" onClick={() => setEditing(group)}>
                {t('edit')}
              </Button>
              <Button variant="ghost" onClick={() => setRemoving(group)}>
                {t('remove')}
              </Button>
            </div>
          ))}
        </div>
      )}
      {editing !== undefined && (
        <DetailDrawer
          title={editing?.name ?? t('create_group')}
          onClose={() => setEditing(undefined)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault()
              const form = new FormData(event.currentTarget)
              write.mutate(
                {
                  path: `/settings/account-groups${editing ? `/${editing.id}` : ''}`,
                  method: editing ? 'PUT' : 'POST',
                  data: {
                    name: form.get('name'),
                    description: form.get('description'),
                    account_ids: form.getAll('account'),
                  },
                },
                { onSuccess: () => setEditing(undefined) },
              )
            }}
          >
            <fieldset disabled={write.isPending}>
              <Field label={t('group_name')}>
                <input
                  name="name"
                  required
                  maxLength={120}
                  defaultValue={editing?.name}
                />
              </Field>
              <Field label={t('description')}>
                <textarea
                  name="description"
                  maxLength={500}
                  defaultValue={editing?.description}
                />
              </Field>
              <fieldset className="group-membership">
                <legend>{t('membership')}</legend>
                {accounts.map((account) => (
                  <label key={account.id}>
                    <input
                      type="checkbox"
                      name="account"
                      value={account.id}
                      defaultChecked={editing?.account_ids.includes(account.id)}
                    />
                    {account.name} <small>{account.currency}</small>
                  </label>
                ))}
              </fieldset>
              <Button>{t('save')}</Button>
            </fieldset>
            {write.isError && <ErrorState text={write.error.message} />}
          </form>
        </DetailDrawer>
      )}
      {removing && (
        <DetailDrawer
          title={t('remove_group')}
          onClose={() => setRemoving(undefined)}
        >
          <p>{removing.name}</p>
          <Button
            disabled={write.isPending}
            onClick={() =>
              write.mutate(
                {
                  path: `/settings/account-groups/${removing.id}`,
                  method: 'DELETE',
                },
                { onSuccess: () => setRemoving(undefined) },
              )
            }
          >
            {t('remove')}
          </Button>
          {write.isError && <ErrorState text={write.error.message} />}
        </DetailDrawer>
      )}
    </>
  )
}
