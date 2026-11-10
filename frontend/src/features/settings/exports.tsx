// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Wealthfolio 92b4647 settings/exports/{exports-page,exports-form,backup-restore-form}.tsx.
import './i18n'
import './settings.css'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useDemoRuntime } from '@/lib/demo-runtime'
import { request, getDemoDate, localDate } from '@/lib/api'
import { getLocale } from '@/lib/preferences'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/forms'
import { ErrorState, LoadingState } from '@/components/primitives'
import { DetailDrawer } from '@/components/detail-drawer'
import { SettingsHeader } from './settings-layout'
import { downloadFile, getExports, getBackups, backupSchema } from './api'

export function ExportsSettings({
  maintenance = false,
}: {
  maintenance?: boolean
}) {
  const { t } = useTranslation('settings_v014')
  const { runtime } = useDemoRuntime()
  const [tab, setTab] = useState(maintenance ? 'backup' : 'export')
  const [dataset, setDataset] = useState('transactions')
  const [format, setFormat] = useState('json')
  const [asOf, setAsOf] = useState(getDemoDate() || localDate())
  const [restoring, setRestoring] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [done, setDone] = useState(false)
  const client = useQueryClient()
  const catalog = useQuery({
    queryKey: ['settings', 'exports'],
    queryFn: getExports,
    enabled: !maintenance,
  })
  const backups = useQuery({
    queryKey: ['settings', 'backups'],
    queryFn: getBackups,
    enabled: !runtime && tab === 'backup',
  })
  const write = useMutation({
    mutationFn: async (action: {
      kind: 'create' | 'restore' | 'upload' | 'download'
      id?: string
      file?: File
    }) => {
      if (action.kind === 'download')
        return downloadFile(
          action.id
            ? `/settings/backups/${action.id}/download`
            : `/settings/exports/${dataset}?${new URLSearchParams({ format, as_of: asOf })}`,
          action.id
            ? 'finance-tracker-backup.db'
            : `finance-tracker-${dataset}.${format}`,
          !!action.id,
        )
      if (action.kind === 'upload') {
        if (!action.file || action.file.size > 128 * 1024 * 1024)
          throw new Error(t('select_backup'))
        const response = await fetch('/api/settings/backups/upload', {
          method: 'POST',
          headers: {
            'X-Finance-Admin': '1',
            'Content-Type': 'application/octet-stream',
          },
          body: action.file,
        })
        if (!response.ok)
          throw new Error(`Backup validation failed (${response.status})`)
        return backupSchema.parse(await response.json())
      }
      return request(
        `/settings/backups${action.kind === 'restore' ? `/${action.id}/restore` : ''}`,
        {
          method: 'POST',
          headers: { 'X-Finance-Admin': '1' },
          ...(action.kind === 'restore'
            ? { body: JSON.stringify({ confirmation }) }
            : {}),
        },
      )
    },
    onSuccess: async (_data, action) => {
      await client.invalidateQueries({ queryKey: ['settings', 'backups'] })
      if (action.kind === 'restore') {
        setDone(true)
        setRestoring('')
        setConfirmation('')
      }
    },
  })
  return (
    <>
      <SettingsHeader
        title={maintenance ? t('maintenance') : t('exports')}
        description={t('export_detail')}
      />
      <div className="settings-tabs" role="tablist" aria-label={t('exports')}>
        <button
          role="tab"
          aria-selected={tab === 'backup'}
          onClick={() => setTab('backup')}
        >
          {t('backups')}
        </button>
        {!maintenance && (
          <button
            role="tab"
            aria-selected={tab === 'export'}
            onClick={() => setTab('export')}
          >
            {t('download')}
          </button>
        )}
      </div>
      {write.isError && <ErrorState text={write.error.message} />}{' '}
      {done && <p role="status">{t('restore_done')}</p>}
      {tab === 'export' ? (
        <section className="source-settings-card">
          <h2>{t('download')}</h2>
          <p>{t('export_help')}</p>
          {catalog.isPending ? (
            <LoadingState />
          ) : catalog.isError ? (
            <ErrorState
              text={catalog.error.message}
              retry={() => void catalog.refetch()}
            />
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                write.mutate({ kind: 'download' })
              }}
            >
              <Field label={t('dataset')}>
                <select
                  value={dataset}
                  onChange={(event) => setDataset(event.target.value)}
                >
                  {catalog.data.datasets.map((key) => (
                    <option key={key} value={key}>
                      {t(key, { defaultValue: key.replaceAll('-', ' ') })}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('format')}>
                <select
                  value={format}
                  onChange={(event) => setFormat(event.target.value)}
                >
                  {catalog.data.formats.map((key) => (
                    <option key={key} value={key}>
                      {key.toUpperCase()}
                    </option>
                  ))}
                </select>
              </Field>
              {['holdings', 'portfolio-history', 'net-worth-history'].includes(
                dataset,
              ) && (
                <Field label={t('date')}>
                  <input
                    type="date"
                    value={asOf}
                    max={getDemoDate() || localDate()}
                    onChange={(event) => setAsOf(event.target.value)}
                    required
                  />
                </Field>
              )}
              <Button disabled={write.isPending}>{t('download')}</Button>
            </form>
          )}
        </section>
      ) : (
        <section className="source-settings-card">
          <h2>{t('backups')}</h2>
          <p>{t('backup_help')}</p>
          {runtime ? (
            <p role="note">{t('demo_backups')}</p>
          ) : (
            <>
              <Button
                disabled={write.isPending}
                onClick={() => write.mutate({ kind: 'create' })}
              >
                {t('create_backup')}
              </Button>
              <p>{t('maintenance_help')}</p>
              <code>
                $env:MAINTENANCE_MODE='true'; uv run uvicorn app.main:app --host
                127.0.0.1 --port 8000
              </code>
              {backups.isPending ? (
                <LoadingState />
              ) : backups.isError ? (
                <ErrorState
                  text={backups.error.message}
                  retry={() => void backups.refetch()}
                />
              ) : (
                <div className="source-settings-list">
                  {backups.data.items.map((backup) => (
                    <div key={backup.id}>
                      <div>
                        <time dateTime={backup.created_at}>
                          {new Date(backup.created_at).toLocaleString(
                            getLocale(),
                          )}
                        </time>
                        <small>
                          {Math.ceil(backup.bytes / 1024)} KiB ·{' '}
                          {backup.id.slice(0, 8)}
                        </small>
                      </div>
                      <Button
                        variant="outline"
                        disabled={write.isPending}
                        onClick={() =>
                          write.mutate({ kind: 'download', id: backup.id })
                        }
                      >
                        {t('download')}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={
                          !backups.data.maintenance || write.isPending || done
                        }
                        onClick={() => {
                          setRestoring(backup.id)
                          setConfirmation('')
                        }}
                      >
                        {t('restore')}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {maintenance && (
                <Field label={t('upload')}>
                  <input
                    type="file"
                    accept=".db,.sqlite,.sqlite3"
                    disabled={write.isPending || done}
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0]
                      if (file) write.mutate({ kind: 'upload', file })
                      event.currentTarget.value = ''
                    }}
                  />
                </Field>
              )}
            </>
          )}
        </section>
      )}
      {restoring && (
        <DetailDrawer title={t('restore')} onClose={() => setRestoring('')}>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              write.mutate({ kind: 'restore', id: restoring })
            }}
          >
            <Field label={t('confirm_restore')}>
              <input
                value={confirmation}
                autoComplete="off"
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </Field>
            <Button disabled={confirmation !== 'RESTORE' || write.isPending}>
              {t('restore')}
            </Button>
          </form>
        </DetailDrawer>
      )}
    </>
  )
}
export function MaintenanceSettings() {
  return (
    <main className="settings-migration maintenance-settings">
      <ExportsSettings maintenance />
    </main>
  )
}
