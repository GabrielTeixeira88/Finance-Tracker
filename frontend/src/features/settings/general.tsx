// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Wealthfolio 92b4647 settings/general/{general-page,currency-settings,language-region-settings}.tsx.
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useDemoRuntime } from '@/lib/demo-runtime'
import { getMarketStatus } from '@/lib/market-data'
import {
  usePreferences,
  setPreferences,
  type Language,
} from '@/lib/preferences'
import { useWrite } from '@/lib/use-write'
import { Field } from '@/components/forms'
import { Button } from '@/components/ui/button'
import { ErrorState, LoadingState, EmptyState } from '@/components/primitives'
import { SettingsHeader } from './settings-layout'
import { getFX } from './api'

export function LanguageSettings() {
  const { t } = useTranslation('settings_v014')
  const preferences = usePreferences()
  return (
    <section className="source-settings-card">
      <h2>{t('language')}</h2>
      <p>{t('language_help')}</p>
      <Field label={t('language')}>
        <select
          value={preferences.language}
          onChange={(event) =>
            setPreferences({ language: event.target.value as Language })
          }
        >
          <option value="en">English</option>
          <option value="pt-BR">Português (Brasil)</option>
          <option value="es-419">Español (Latinoamérica)</option>
        </select>
      </Field>
    </section>
  )
}
export function GeneralSettings() {
  const { t } = useTranslation('settings_v014')
  const { runtime } = useDemoRuntime()
  const status = useQuery({
    queryKey: ['market-data', 'status'],
    queryFn: getMarketStatus,
    enabled: !runtime,
  })
  const write = useWrite()
  const [currency, setCurrency] = useState('')
  return (
    <>
      <SettingsHeader title={t('general')} description={t('general_detail')} />
      <LanguageSettings />
      <section className="source-settings-card">
        <h2>{t('reporting')}</h2>
        <p>{t('reporting_help')}</p>
        {runtime ? (
          <p>{t('general_demo')}</p>
        ) : status.isPending ? (
          <LoadingState />
        ) : status.isError ? (
          <ErrorState
            text={status.error.message}
            retry={() => void status.refetch()}
          />
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              write.mutate({
                path: '/market-data/settings',
                method: 'PUT',
                data: {
                  ...status.data.settings,
                  reporting_currency:
                    currency || status.data.settings.reporting_currency,
                },
              })
            }}
          >
            <Field label={t('reporting')}>
              <select
                value={currency || status.data.settings.reporting_currency}
                onChange={(event) => setCurrency(event.target.value)}
              >
                {['BRL', 'USD', 'EUR', 'JPY'].map((code) => (
                  <option key={code}>{code}</option>
                ))}
              </select>
            </Field>
            <Button disabled={write.isPending}>{t('save')}</Button>
            {write.isError && <ErrorState text={write.error.message} />}{' '}
            {write.isSuccess && <p role="status">{t('saved')}</p>}
          </form>
        )}
      </section>
      <section className="source-settings-card">
        <h2>{t('timezone')}</h2>
        <p>{t('timezone_help')}</p>
        <p>{Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
      </section>
      <FXSettings />
    </>
  )
}
export function FXSettings() {
  const { t } = useTranslation('settings_v014')
  const [offset, setOffset] = useState(0)
  const query = useQuery({
    queryKey: ['settings', 'fx', offset],
    queryFn: () => getFX(offset),
  })
  return (
    <section className="source-settings-card">
      <h2>{t('rates')}</h2>
      <p>{t('rates_help')}</p>
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState
          text={query.error.message}
          retry={() => void query.refetch()}
        />
      ) : (
        <>
          {!query.data.items.length ? (
            <EmptyState title={t('empty')} />
          ) : (
            <div className="settings-table-scroll">
              <table>
                <thead>
                  <tr>
                    {['date', 'from', 'to', 'rate', 'source'].map((key) => (
                      <th key={key} scope="col">
                        {t(key)}
                      </th>
                    ))}
                    <th scope="col">{t('market_data:retrieved_5538ff')}</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.items.map((row) => (
                    <tr key={row.id}>
                      <td>{row.rate_date}</td>
                      <td>{row.base_currency}</td>
                      <td>{row.quote_currency}</td>
                      <td className="numeric">{row.rate}</td>
                      <td>{row.provider}</td>
                      <td>
                        <time dateTime={row.fetched_at}>{row.fetched_at}</time>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="settings-pagination">
            <Button
              variant="outline"
              disabled={!offset}
              onClick={() => setOffset(Math.max(0, offset - 30))}
            >
              {t('previous')}
            </Button>
            <span>{t('rows', { count: query.data.total })}</span>
            <Button
              variant="outline"
              disabled={offset + 30 >= query.data.total}
              onClick={() => setOffset(offset + 30)}
            >
              {t('next')}
            </Button>
          </div>
        </>
      )}
    </section>
  )
}
