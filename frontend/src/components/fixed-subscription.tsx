import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAccounts } from '@/lib/api'
import { t } from '@/lib/i18n'
import { exactFormData } from '@/lib/localized-number'
import { useWrite } from '@/lib/use-write'
import { Field } from './forms'
import { Button } from './ui/button'
import { ErrorState, LoadingState, Money } from './primitives'

export function FixedSubscription({
  asOf,
  onDone,
}: {
  asOf: string
  onDone: () => void
}) {
  const [kind, setKind] = useState('CDB_CDI')
  const [liquidity, setLiquidity] = useState('DAILY')
  const [requestId] = useState(() => crypto.randomUUID())
  const query = useQuery({
    queryKey: ['accounts'],
    queryFn: ({ signal }) => getAccounts(signal),
  })
  const write = useWrite()
  if (query.isPending) return <LoadingState />
  if (query.isError) return <ErrorState text={query.error.message} />
  const accounts = query.data.filter(
    (a) => a.type === 'INVESTMENT' && a.currency === 'BRL' && a.active,
  )
  return (
    <form
      className="entry-form"
      onSubmit={(e) => {
        e.preventDefault()
        const d = Object.fromEntries(exactFormData(e.currentTarget))
        write.mutate(
          {
            path: '/investments/fixed-income',
            data: {
              ...d,
              request_id: requestId,
              instrument_type: kind,
              liquidity,
              redemption_from:
                liquidity === 'AT_MATURITY'
                  ? d.maturity_date
                  : d.redemption_from,
              fgc_eligible: d.fgc_eligible === 'on',
              fictional: false,
              index_source: 'MANUAL',
            },
          },
          { onSuccess: onDone },
        )
      }}
    >
      <p className="workflow-context">{t('parity:subscription_notice')}</p>
      <div className="form-grid">
        <Field label={t('parity:account')}>
          <select name="account_id" required>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('fixed_income:instrument')}>
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            {['CDB_CDI', 'CDB_FIXED', 'TESOURO_SELIC'].map((k) => (
              <option key={k} value={k}>
                {t(`parity:${k.toLowerCase()}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('parity:instrument_name')}>
          <input required name="name" maxLength={120} />
        </Field>
        <Field label={t('fixed_income:issuer')}>
          <input required name="issuer" maxLength={120} />
        </Field>
        <Field label={t('parity:settlement')}>
          <input
            required
            type="date"
            name="settlement_date"
            defaultValue={asOf}
            max={asOf}
          />
        </Field>
        <Field label={t('fixed_income:maturity')}>
          <input required type="date" name="maturity_date" />
        </Field>
        <Field label={t('fixed_income:liquidity')}>
          <select
            value={liquidity}
            onChange={(e) => setLiquidity(e.target.value)}
          >
            <option value="DAILY">{t('fixed_income:daily')}</option>
            <option value="AT_MATURITY">{t('fixed_income:at_maturity')}</option>
          </select>
        </Field>
        {liquidity === 'DAILY' && (
          <Field label={t('parity:redemption_from')}>
            <input
              required
              type="date"
              name="redemption_from"
              defaultValue={asOf}
            />
          </Field>
        )}
        <Field
          label={
            kind === 'TESOURO_SELIC'
              ? t('parity:quantity')
              : t('parity:principal_to_invest')
          }
        >
          <input required inputMode="decimal" name="quantity" />
        </Field>
        {kind === 'CDB_CDI' && (
          <Field label={t('parity:cdi_percent')}>
            <input
              required
              inputMode="decimal"
              name="cdi_percent"
              defaultValue="100"
            />
          </Field>
        )}
        {kind === 'CDB_FIXED' && (
          <Field label={t('parity:annual_rate')}>
            <input required inputMode="decimal" name="annual_rate" />
          </Field>
        )}
        {kind === 'TESOURO_SELIC' && (
          <>
            <Field label={t('parity:purchase_price')}>
              <input required inputMode="decimal" name="acquisition_price" />
            </Field>
            <Field label={t('parity:spread_rate')}>
              <input inputMode="decimal" name="spread_rate" defaultValue="0" />
            </Field>
          </>
        )}
        {kind !== 'TESOURO_SELIC' && (
          <Field label={t('parity:fgc')}>
            <input type="checkbox" name="fgc_eligible" />
          </Field>
        )}
        <Field label={t('parity:description')}>
          <input name="notes" maxLength={1000} />
        </Field>
      </div>
      <div className="metadata">
        {accounts.map((a) => (
          <p key={a.id}>
            {a.name}: <Money value={a.balance} currency={a.currency} />
          </p>
        ))}
      </div>
      {write.isError && <ErrorState text={write.error.message} />}
      <Button disabled={write.isPending || !accounts.length}>
        {t('parity:save')}
      </Button>
    </form>
  )
}

export function FixedIndex({
  asOf,
  index = 'CDI',
}: {
  asOf: string
  index?: string
}) {
  const write = useWrite()
  return (
    <form
      className="entry-form"
      onSubmit={(e) => {
        e.preventDefault()
        write.mutate({
          path: '/investments/fixed-income/indices',
          data: Object.fromEntries(exactFormData(e.currentTarget)),
        })
      }}
    >
      <p className="metadata">{t('parity:index_notice')}</p>
      <div className="form-grid">
        <Field label={t('parity:index')}>
          <select
            name="index_name"
            defaultValue={index === 'SELIC_OVER' ? index : 'CDI'}
          >
            <option>CDI</option>
            <option>SELIC_OVER</option>
          </select>
        </Field>
        <Field label={t('parity:date')}>
          <input
            required
            type="date"
            name="observation_date"
            defaultValue={asOf}
            max={asOf}
          />
        </Field>
        <Field label={t('parity:index_factor')}>
          <input
            required
            name="factor"
            pattern="1(\.[0-9]{1,18})?"
            placeholder="1.0005"
          />
        </Field>
      </div>
      {write.isError && <ErrorState text={write.error.message} />}
      {write.isSuccess && <p role="status">{t('parity:saved')}</p>}
      <Button disabled={write.isPending}>{t('parity:save')}</Button>
    </form>
  )
}
