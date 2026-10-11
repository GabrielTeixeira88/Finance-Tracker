import { useState, type FormEvent } from 'react'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { Field } from '@/components/forms'
import { Money } from '@/components/primitives'
import { Button } from '@/components/ui/button'
import { request, type Account, localDate } from '@/lib/api'
import type { Asset } from '@/lib/investments'
import { quantityText } from '@/lib/investments'
import { useWrite } from '@/lib/use-write'

const decimal = z
  .string()
  .regex(
    /^\d+(\.\d{1,6})?$/,
    'Use a positive decimal with up to six fractional digits',
  )
const fields = (form: HTMLFormElement) =>
  Object.fromEntries(new FormData(form)) as Record<string, string>

export function AssetForm({ onSaved }: { onSaved: () => void }) {
  const write = useWrite()
  return (
    <form
      className="form-grid investment-editor"
      onSubmit={(e) => {
        e.preventDefault()
        const data = fields(e.currentTarget)
        void write
          .mutateAsync({
            path: '/investments/assets',
            data: { ...data, isin: data.isin || null },
          })
          .then(onSaved)
          .catch(() => {})
      }}
    >
      <Field label="Security symbol">
        <input name="symbol" required maxLength={40} />
      </Field>
      <Field label="Security name">
        <input name="name" required maxLength={120} />
      </Field>
      <Field label="Exchange">
        <input
          name="exchange"
          placeholder="XBSP / XNYS"
          required
          maxLength={40}
        />
      </Field>
      <Field label="Security currency">
        <input
          name="currency"
          defaultValue="BRL"
          required
          pattern="[A-Z]{3}"
          maxLength={3}
        />
      </Field>
      <Field label="Asset type">
        <select name="asset_type">
          {['STOCK', 'ETF', 'FUND', 'BOND', 'REIT', 'FII', 'BDR', 'OTHER'].map(
            (t) => (
              <option key={t}>{t}</option>
            ),
          )}
        </select>
      </Field>
      <Field label="ISIN (optional)">
        <input name="isin" maxLength={12} />
      </Field>
      {write.isError && <p role="alert">{write.error.message}</p>}
      <Button disabled={write.isPending}>Save security</Button>
    </form>
  )
}

export function PriceForm({
  asset,
  onSaved,
}: {
  asset: Asset
  onSaved: () => void
}) {
  const write = useWrite()
  return (
    <form
      className="form-grid investment-editor"
      onSubmit={(e) => {
        e.preventDefault()
        void write
          .mutateAsync({
            path: `/investments/assets/${asset.id}/prices`,
            data: { ...fields(e.currentTarget), currency: asset.currency },
          })
          .then(onSaved)
          .catch(() => {})
      }}
    >
      <Field label="Manual price date">
        <input
          type="date"
          name="price_date"
          defaultValue={localDate()}
          required
        />
      </Field>
      <Field label={`Manual price (${asset.currency})`}>
        <input name="price" inputMode="decimal" required />
      </Field>
      <p className="metadata">
        Manual observation, not a live quote. One observation per security/date.
      </p>
      {write.isError && <p role="alert">{write.error.message}</p>}
      <Button disabled={write.isPending}>Save manual price</Button>
    </form>
  )
}

const previewSchema = z.object({
  gross_amount: z.string(),
  cash_amount: z.string(),
  direction: z.string(),
  resulting_quantity: z.string(),
})
export function ActivityForm({
  accounts,
  assets,
  initialAccount,
  onSaved,
}: {
  accounts: Account[]
  assets: Asset[]
  initialAccount: string
  onSaved: () => void
}) {
  const [kind, setKind] = useState('BUY')
  const [accountId, setAccountId] = useState(
    initialAccount ||
      accounts.find((a) => a.type === 'INVESTMENT' && a.active)?.id ||
      '',
  )
  const [requestId] = useState(() => crypto.randomUUID())
  const [approved, setApproved] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState('')
  const preview = useMutation({
    mutationFn: async (data: Record<string, unknown>) =>
      previewSchema.parse(
        await request('/investments/activities/preview', {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      ),
  })
  const write = useWrite()
  const account = accounts.find((a) => a.id === accountId)
  const trade = kind === 'BUY' || kind === 'SELL'
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    try {
      const values = fields(e.currentTarget)
      const data = {
        request_id: requestId,
        account_id: accountId,
        currency: account?.currency,
        activity_type: kind,
        activity_date: values.activity_date,
        asset_id: values.asset_id || null,
        notes: values.notes,
        quantity: trade ? decimal.parse(values.quantity) : '0',
        unit_price: trade ? decimal.parse(values.unit_price) : '0',
        gross_amount: trade ? null : decimal.parse(values.gross_amount),
        fees: decimal.parse(values.fees || '0'),
        taxes: decimal.parse(values.taxes || '0'),
      }
      await preview.mutateAsync(data)
      setApproved(data)
    } catch (e) {
      setApproved(null)
      setError(e instanceof Error ? e.message : 'Unable to preview activity')
    }
  }
  return (
    <form
      className="form-grid investment-editor"
      onSubmit={submit}
      onChange={() => setApproved(null)}
    >
      <Field label="Investment account">
        <select
          required
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
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
      <Field label="Activity type">
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          {['BUY', 'SELL', 'DIVIDEND', 'INTEREST', 'FEE', 'TAX'].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </Field>
      <Field label="Activity security">
        <select name="asset_id" required={trade}>
          <option value="">Account cash / no security</option>
          {assets
            .filter((a) => a.currency === account?.currency)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.symbol} · {a.exchange}
              </option>
            ))}
        </select>
      </Field>
      <Field label="Activity date">
        <input
          type="date"
          name="activity_date"
          defaultValue={localDate()}
          required
        />
      </Field>
      {trade ? (
        <>
          <Field label="Quantity">
            <input name="quantity" inputMode="decimal" required />
          </Field>
          <Field label="Unit price">
            <input name="unit_price" inputMode="decimal" required />
          </Field>
        </>
      ) : (
        <Field label="Gross amount">
          <input name="gross_amount" inputMode="decimal" required />
        </Field>
      )}
      {kind !== 'FEE' && kind !== 'TAX' && (
        <>
          <Field label="Activity fees">
            <input name="fees" inputMode="decimal" defaultValue="0" required />
          </Field>
          <Field label="Activity taxes">
            <input name="taxes" inputMode="decimal" defaultValue="0" required />
          </Field>
        </>
      )}
      <Field label="Activity notes">
        <input name="notes" maxLength={500} />
      </Field>
      {(error || write.isError) && (
        <p role="alert">{error || write.error?.message}</p>
      )}
      <div className="investment-actions">
        <Button disabled={preview.isPending || write.isPending}>
          Preview activity
        </Button>
        {approved && preview.data && account && (
          <>
            <div role="status" className="investment-preview">
              Gross{' '}
              <Money
                value={preview.data.gross_amount}
                currency={account.currency}
              />{' '}
              · Net cash {preview.data.direction === 'OUT' ? '−' : '+'}
              <Money
                value={preview.data.cash_amount}
                currency={account.currency}
              />{' '}
              · Resulting quantity{' '}
              {quantityText(preview.data.resulting_quantity)}
            </div>
            <Button
              type="button"
              disabled={write.isPending}
              onClick={() =>
                void write
                  .mutateAsync({
                    path: '/investments/activities',
                    data: approved,
                  })
                  .then(onSaved)
                  .catch(() => {})
              }
            >
              Confirm activity
            </Button>
          </>
        )}
      </div>
      <p className="metadata">
        Activities are immutable. Validated void and replacement correct
        mistakes; short sales and margin are unsupported.
      </p>
    </form>
  )
}
