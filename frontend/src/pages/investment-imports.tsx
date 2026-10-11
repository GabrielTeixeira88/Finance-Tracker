import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { Field } from '@/components/forms'
import { Button } from '@/components/ui/button'
import { ErrorState, Money, SectionHeader } from '@/components/primitives'
import { request, type Account } from '@/lib/api'
import { useWrite } from '@/lib/use-write'

const candidateSchema = z
  .object({
    activity_date: z.string(),
    activity_type: z.string(),
    symbol: z.string().optional(),
    quantity: z.string(),
    unit_price: z.string(),
    fees: z.string(),
    taxes: z.string(),
    gross_amount: z.string(),
    cash_amount: z.string().optional(),
    currency: z.string(),
  })
  .passthrough()
const batchSchema = z.object({
  id: z.string(),
  status: z.string(),
  filename: z.string(),
  ready: z.boolean(),
  preview_token: z.string().nullable(),
  counts: z.record(z.string(), z.number()),
  rows: z.array(
    z.object({
      id: z.string(),
      row_number: z.number(),
      status: z.string(),
      errors: z.array(z.string()),
      candidate: candidateSchema.nullable(),
      decision: z.object({ action: z.string().optional() }),
    }),
  ),
})
type Batch = z.infer<typeof batchSchema>
const initialColumns = {
  date: 0,
  type: 1,
  symbol: 2,
  exchange: 3,
  quantity: 4,
  unit_price: 5,
  gross_amount: 6,
  fees: 7,
  taxes: 8,
  currency: 9,
  external_id: 10,
}
const mappingSchema = z.object({
  kind: z.literal('BROKERAGE').default('BROKERAGE'),
  columns: z.record(z.string(), z.number()),
  delimiter: z.enum([',', ';']).default(','),
  date_format: z.enum(['%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y']).default('%Y-%m-%d'),
  decimal_separator: z.enum(['.', ',']).default('.'),
  thousands_separator: z.enum(['', '.', ',']).default(''),
  encoding: z.enum(['utf-8-sig', 'cp1252']).default('utf-8-sig'),
  has_header: z.boolean().default(true),
  source_namespace: z.string().default(''),
})
type Mapping = z.infer<typeof mappingSchema>
const profileSchema = z.object({
  id: z.string(),
  name: z.string(),
  configuration: mappingSchema,
})
export default function BrokerageImports({
  accounts,
}: {
  accounts: Account[]
}) {
  const [account, setAccount] = useState(
    accounts.find((a) => a.type === 'INVESTMENT' && a.active)?.id || '',
  )
  const [mapping, setMapping] = useState<Mapping>(() =>
    mappingSchema.parse({ columns: initialColumns }),
  )
  const [file, setFile] = useState<File | null>(null)
  const [batch, setBatch] = useState<Batch | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')
  const [profileName, setProfileName] = useState('')
  const write = useWrite()
  const profiles = useQuery({
    queryKey: ['investments', 'import-profiles'],
    queryFn: async () =>
      z
        .array(profileSchema)
        .parse(await request('/investments/imports/profiles')),
  })
  const history = useQuery({
    queryKey: ['investments', 'import-history'],
    queryFn: async () =>
      z
        .array(
          z.object({
            id: z.string(),
            filename: z.string(),
            status: z.string(),
          }),
        )
        .parse(await request('/investments/imports')),
  })
  async function update(path: string, method = 'POST', data?: unknown) {
    setError('')
    try {
      const result = await write.mutateAsync({
        path: '/investments/imports' + path,
        method,
        data,
      })
      setBatch(batchSchema.parse(result))
      setConfirmed(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
    }
  }
  async function preview() {
    setError('')
    try {
      if (!file || file.size > 2 * 1024 * 1024 || file.size === 0)
        throw new Error('Choose a nonempty CSV of at most 2 MiB')
      const bytes = new Uint8Array(await file.arrayBuffer())
      let binary = ''
      for (const byte of bytes) binary += String.fromCharCode(byte)
      await update('/preview', 'POST', {
        filename: file.name,
        account_id: account,
        content_base64: btoa(binary),
        configuration: mapping,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to read file')
    }
  }
  return (
    <section>
      <SectionHeader
        title="Brokerage CSV imports"
        detail="Local files · Explicit review · No activities or cash movements until confirmation"
      />
      {(error || profiles.isError || history.isError) && (
        <ErrorState
          text={
            error ||
            profiles.error?.message ||
            history.error?.message ||
            'Unable to load import data'
          }
        />
      )}
      {!batch ? (
        <>
          <div className="form-grid investment-editor">
            <Field label="Brokerage CSV file">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </Field>
            <Field label="Brokerage target account">
              <select
                value={account}
                onChange={(e) => setAccount(e.target.value)}
              >
                <option value="">Choose account</option>
                {accounts
                  .filter((a) => a.type === 'INVESTMENT' && a.active)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {a.currency}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Brokerage mapping profile">
              <select
                defaultValue=""
                onChange={(e) => {
                  const p = profiles.data?.find((p) => p.id === e.target.value)
                  if (p) setMapping(p.configuration)
                }}
              >
                <option value="">Custom mapping</option>
                {profiles.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Broker source namespace">
              <input
                value={mapping.source_namespace}
                onChange={(e) =>
                  setMapping({ ...mapping, source_namespace: e.target.value })
                }
                placeholder="Stable broker/export identity"
              />
            </Field>
            <Field label="CSV delimiter">
              <select
                value={mapping.delimiter}
                onChange={(e) =>
                  setMapping({
                    ...mapping,
                    delimiter: e.target.value as ',' | ';',
                  })
                }
              >
                <option value=",">Comma</option>
                <option value=";">Semicolon</option>
              </select>
            </Field>
            <Field label="CSV date format">
              <select
                value={mapping.date_format}
                onChange={(e) =>
                  setMapping({
                    ...mapping,
                    date_format: e.target.value as Mapping['date_format'],
                  })
                }
              >
                {['%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y'].map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </Field>
            <Field label="CSV decimal separator">
              <select
                value={mapping.decimal_separator}
                onChange={(e) =>
                  setMapping({
                    ...mapping,
                    decimal_separator: e.target.value as '.' | ',',
                  })
                }
              >
                <option value=".">Dot</option>
                <option value=",">Comma</option>
              </select>
            </Field>
            <Field label="CSV thousands separator">
              <select
                value={mapping.thousands_separator}
                onChange={(e) =>
                  setMapping({
                    ...mapping,
                    thousands_separator: e.target
                      .value as Mapping['thousands_separator'],
                  })
                }
              >
                <option value="">None</option>
                <option value=".">Dot</option>
                <option value=",">Comma</option>
              </select>
            </Field>
            <Field label="CSV encoding">
              <select
                value={mapping.encoding}
                onChange={(e) =>
                  setMapping({
                    ...mapping,
                    encoding: e.target.value as Mapping['encoding'],
                  })
                }
              >
                <option value="utf-8-sig">UTF-8</option>
                <option value="cp1252">Windows-1252</option>
              </select>
            </Field>
            <label>
              <input
                type="checkbox"
                checked={mapping.has_header}
                onChange={(e) =>
                  setMapping({ ...mapping, has_header: e.target.checked })
                }
              />{' '}
              First row is a header
            </label>
          </div>
          <details>
            <summary>Column mapping (zero-based indexes)</summary>
            <div className="form-grid investment-editor">
              {[...Object.keys(initialColumns), 'notes'].map((key) => (
                <Field label={`Map ${key}`} key={key}>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={mapping.columns[key] ?? ''}
                    onChange={(e) => {
                      const columns = { ...mapping.columns }
                      if (e.target.value === '') delete columns[key]
                      else columns[key] = Number(e.target.value)
                      setMapping({ ...mapping, columns })
                    }}
                  />
                </Field>
              ))}
            </div>
          </details>
          <div className="investment-actions">
            <Field label="Save brokerage profile as">
              <input
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                maxLength={120}
              />
            </Field>
            <Button
              variant="outline"
              disabled={!profileName.trim() || write.isPending}
              onClick={() =>
                void write
                  .mutateAsync({
                    path: '/investments/imports/profiles',
                    data: {
                      name: profileName,
                      configuration: mapping,
                      default_account_id: account || null,
                    },
                  })
                  .then(() => setProfileName(''))
                  .catch((e) => setError(e.message))
              }
            >
              Save brokerage profile
            </Button>
            <Button
              disabled={!file || !account || write.isPending}
              onClick={() => void preview()}
            >
              Preview brokerage CSV
            </Button>
          </div>
          <p className="metadata">
            Create assets first using exact symbol, exchange and currency. Rows
            must be in economic posting order. External IDs are scoped to the
            selected account and source namespace.
          </p>
        </>
      ) : (
        <>
          <div className="investment-actions">
            <strong>
              {batch.filename} · {batch.status}
            </strong>
            <Button
              variant="outline"
              onClick={() => {
                setBatch(null)
                setConfirmed(false)
              }}
            >
              New brokerage import
            </Button>
            <Button
              variant="outline"
              onClick={() => void update('/' + batch.id, 'GET')}
            >
              Refresh brokerage preview
            </Button>
          </div>
          <div className="table-scroll">
            <table className="investment-table">
              <caption className="sr-only">Brokerage import preview</caption>
              <thead>
                <tr>
                  {[
                    'Row / date',
                    'Activity / security',
                    'Quantity',
                    'Price',
                    'Fees / taxes',
                    'Gross / net cash',
                    'Status / decision',
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {batch.rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.row_number}
                      <small>{r.candidate?.activity_date}</small>
                    </td>
                    <td>
                      {r.candidate?.activity_type} {r.candidate?.symbol}
                    </td>
                    <td className="number">{r.candidate?.quantity}</td>
                    <td className="number">
                      {r.candidate && (
                        <Money
                          value={r.candidate.unit_price}
                          currency={r.candidate.currency}
                        />
                      )}
                    </td>
                    <td className="number">
                      {r.candidate && (
                        <>
                          <Money
                            value={r.candidate.fees}
                            currency={r.candidate.currency}
                          />
                          <small>
                            <Money
                              value={r.candidate.taxes}
                              currency={r.candidate.currency}
                            />
                          </small>
                        </>
                      )}
                    </td>
                    <td className="number">
                      {r.candidate && (
                        <>
                          <Money
                            value={r.candidate.gross_amount}
                            currency={r.candidate.currency}
                          />
                          <small>
                            <Money
                              value={
                                r.candidate.cash_amount ||
                                r.candidate.gross_amount
                              }
                              currency={r.candidate.currency}
                            />
                          </small>
                        </>
                      )}
                    </td>
                    <td>
                      {r.status}
                      <small>{r.errors.join(' · ')}</small>
                      {batch.status === 'DRAFT' && (
                        <select
                          aria-label={`Brokerage row ${r.row_number} decision`}
                          value={r.decision.action || ''}
                          disabled={write.isPending}
                          onChange={(e) =>
                            void update(`/${batch.id}/rows/${r.id}`, 'PATCH', {
                              action: e.target.value,
                            })
                          }
                        >
                          <option value="" disabled>
                            Choose decision
                          </option>
                          <option value="SKIP">Skip this row</option>
                          {r.status !== 'INVALID' &&
                            r.status !== 'EXACT_DUPLICATE' && (
                              <option value="NEW">
                                Confirmed separate activity
                              </option>
                            )}
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {batch.status === 'DRAFT' ? (
            <div className="investment-actions">
              <label>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />{' '}
                I confirm this brokerage account and reviewed activities
              </label>
              <Button
                disabled={!confirmed || !batch.ready || write.isPending}
                onClick={() =>
                  void update(`/${batch.id}/confirm`, 'POST', {
                    preview_token: batch.preview_token,
                    account_confirmed: true,
                  })
                }
              >
                Confirm brokerage import
              </Button>
            </div>
          ) : (
            <p role="status">
              Imported: {batch.counts.imported} · Duplicates:{' '}
              {batch.counts.duplicate} · Skipped: {batch.counts.skipped}
            </p>
          )}
        </>
      )}
      <SectionHeader title="Brokerage import history" />
      {history.data?.map((b) => (
        <div className="investment-actions" key={b.id}>
          <button onClick={() => void update('/' + b.id, 'GET')}>
            {b.filename}
          </button>
          <span className="metadata">{b.status}</span>
        </div>
      ))}
    </section>
  )
}
