import { t as tr, ui } from '@/lib/i18n'
import { exactFormData } from '@/lib/localized-number'
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
  Object.fromEntries(exactFormData(form)) as Record<string, string>

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
      <Field label={tr('investment_forms:security_symbol_328573')}>
        <input name="symbol" required maxLength={40} />
      </Field>
      <Field label={tr('investment_forms:security_name_55a120')}>
        <input name="name" required maxLength={120} />
      </Field>
      <Field label={tr('investment_forms:exchange_5b13ea')}>
        <input
          name="exchange"
          placeholder={tr('investment_forms:xbsp_xnys_8b43db')}
          required
          maxLength={40}
        />
      </Field>
      <Field label={tr('investment_forms:security_currency_8e0442')}>
        <input
          name="currency"
          defaultValue="BRL"
          required
          pattern="[A-Z]{3}"
          maxLength={3}
        />
      </Field>
      <Field label={tr('investment_forms:asset_type_e6f887')}>
        <select name="asset_type">
          {['STOCK', 'ETF', 'FUND', 'BOND', 'REIT', 'FII', 'BDR', 'OTHER'].map(
            (t) => (
              <option key={t} value={t}>
                {ui(t)}
              </option>
            ),
          )}
        </select>
      </Field>
      <Field label={tr('investment_forms:isin_optional__c64ed4')}>
        <input name="isin" maxLength={12} />
      </Field>
      {write.isError && <p role="alert">{write.error.message}</p>}
      <Button disabled={write.isPending}>
        {tr('investment_forms:save_security_2f5ff4')}
      </Button>
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
      <Field label={tr('investment_forms:manual_price_date_2890a9')}>
        <input
          type="date"
          name="price_date"
          defaultValue={localDate()}
          required
        />
      </Field>
      <Field
        label={tr('messages:message_0a7ce40611a6', { value0: asset.currency })}
      >
        <input name="price" inputMode="decimal" required />
      </Field>
      <p className="metadata">
        {tr(
          'investment_forms:manual_observation_not_a_live_quote_one_observat_c28a80',
        )}
      </p>
      {write.isError && <p role="alert">{write.error.message}</p>}
      <Button disabled={write.isPending}>
        {tr('investment_forms:save_manual_price_70b04c')}
      </Button>
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
      setError(
        e instanceof Error
          ? e.message
          : tr('dynamic:unable_to_preview_activity_2fe8ba'),
      )
    }
  }
  return (
    <form
      className="form-grid investment-editor"
      onSubmit={submit}
      onChange={() => setApproved(null)}
    >
      <Field label={tr('investment_forms:investment_account_f3d13a')}>
        <select
          required
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
        >
          <option value="">
            {tr('investment_forms:choose_account_9ccef0')}
          </option>
          {accounts
            .filter((a) => a.type === 'INVESTMENT' && a.active)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · {a.currency}
              </option>
            ))}
        </select>
      </Field>
      <Field label={tr('investment_forms:activity_type_c66092')}>
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          {['BUY', 'SELL', 'DIVIDEND', 'INTEREST', 'FEE', 'TAX'].map((t) => (
            <option key={t} value={t}>
              {ui(t)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={tr('investment_forms:activity_security_6a7e9f')}>
        <select name="asset_id" required={trade}>
          <option value="">
            {tr('investment_forms:account_cash_no_security_f2dcef')}
          </option>
          {assets
            .filter((a) => a.currency === account?.currency)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.symbol} · {a.exchange}
              </option>
            ))}
        </select>
      </Field>
      <Field label={tr('investment_forms:activity_date_14bd67')}>
        <input
          type="date"
          name="activity_date"
          defaultValue={localDate()}
          required
        />
      </Field>
      {trade ? (
        <>
          <Field label={tr('investment_forms:quantity_44f6af')}>
            <input name="quantity" inputMode="decimal" required />
          </Field>
          <Field label={tr('investment_forms:unit_price_3c6c77')}>
            <input name="unit_price" inputMode="decimal" required />
          </Field>
        </>
      ) : (
        <Field label={tr('investment_forms:gross_amount_ae5b9d')}>
          <input name="gross_amount" inputMode="decimal" required />
        </Field>
      )}
      {kind !== 'FEE' && kind !== 'TAX' && (
        <>
          <Field label={tr('investment_forms:activity_fees_8955ed')}>
            <input name="fees" inputMode="decimal" defaultValue="0" required />
          </Field>
          <Field label={tr('investment_forms:activity_taxes_82bdf6')}>
            <input name="taxes" inputMode="decimal" defaultValue="0" required />
          </Field>
        </>
      )}
      <Field label={tr('investment_forms:activity_notes_5f27dd')}>
        <input name="notes" maxLength={500} />
      </Field>
      {(error || write.isError) && (
        <p role="alert">{error || write.error?.message}</p>
      )}
      <div className="investment-actions">
        <Button disabled={preview.isPending || write.isPending}>
          {tr('investment_forms:preview_activity_c4ee6d')}
        </Button>
        {approved && preview.data && account && (
          <>
            <div role="status" className="investment-preview">
              {' '}
              {tr('investment_forms:gross_9580a6')}{' '}
              <Money
                value={preview.data.gross_amount}
                currency={account.currency}
              />{' '}
              {tr('investment_forms:_net_cash_df0c37')}{' '}
              {preview.data.direction === 'OUT' ? '−' : '+'}
              <Money
                value={preview.data.cash_amount}
                currency={account.currency}
              />{' '}
              {tr('investment_forms:_resulting_quantity_2db465')}{' '}
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
              {tr('investment_forms:confirm_activity_b868c2')}
            </Button>
          </>
        )}
      </div>
      <p className="metadata">
        {tr(
          'investment_forms:activities_are_immutable_validated_void_and_repl_98f3f7',
        )}
      </p>
    </form>
  )
}
