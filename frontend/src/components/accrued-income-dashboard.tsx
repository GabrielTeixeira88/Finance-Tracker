import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getFixedIncome, getFixedHistory } from '@/lib/fixed-income'
import { getAccruedIncome } from '@/lib/investment-analytics'
import { t } from '@/lib/i18n'
import { sumMoney, subtractMoney } from '@/lib/money'
import { IncomeCard } from './income-dashboard'
import { FixedIncomeChart } from './fixed-income-chart'
import { EmptyState, ErrorState, LoadingState, Money } from './primitives'
const text = (key: string) => t(`income_dashboard:${key}`)

/** Read-only contract projections. Unrealized results never post cash. */
export function AccruedIncomeDashboard({
  asOf,
  start,
  accountId,
  onSecurity,
}: {
  asOf: string
  start: string
  accountId: string
  onSecurity: (id: string) => void
}) {
  const [selected, setSelected] = useState('')
  const report = useQuery({
    queryKey: ['fixed-income', asOf, accountId],
    queryFn: ({ signal }) => getFixedIncome(asOf, accountId, signal),
  })
  const accrual = useQuery({
    queryKey: ['income-accrual', start, asOf, accountId],
    queryFn: ({ signal }) => getAccruedIncome(start, asOf, accountId, signal),
  })
  const positions =
    report.data?.positions.filter(
      (position) => position.contract.instrument_type !== 'TESOURO_SELIC',
    ) ?? []
  const treasury =
    report.data?.positions.filter(
      (position) => position.contract.instrument_type === 'TESOURO_SELIC',
    ) ?? []
  const active = positions.find((position) => position.contract.id === selected)
  const history = useQuery({
    queryKey: ['fixed-income-history', active?.contract.id, start, asOf],
    queryFn: ({ signal }) =>
      getFixedHistory(active!.contract.id, start, asOf, signal),
    enabled: !!active,
  })
  if (report.isPending) return <LoadingState />
  if (report.isError)
    return (
      <ErrorState
        text={report.error.message}
        retry={() => void report.refetch()}
      />
    )
  const completeSum = (field: 'gross_interest' | 'income_tax' | 'iof') =>
    positions.some((position) => position[field] === null)
      ? null
      : sumMoney(positions.map((position) => position[field]!))
  const gross = completeSum('gross_interest')
  const net = positions.some((position) => position.estimated_net === null)
    ? null
    : sumMoney(
        positions.map((position) =>
          subtractMoney(position.estimated_net!, position.principal),
        ),
      )
  const ir = completeSum('income_tax'),
    iof = completeSum('iof')
  const withholding = ir === null || iof === null ? null : sumMoney([ir, iof])
  const visibleHistory = active ? history : accrual
  const chart = active ? history.data : accrual.data?.history
  const value = (amount: string | null) =>
    amount === null ? (
      <span className="metadata">{t('common:unavailable')}</span>
    ) : (
      <Money value={amount} currency="BRL" />
    )
  return (
    <div className="income-dashboard">
      <p className="metadata">{text('accrued_definition')}</p>
      {!positions.length ? (
        <EmptyState title={text('no_accrual')} />
      ) : (
        <>
          <div className="income-metric-grid">
            {[
              ['gross_accrual', gross],
              ['net_accrual', net],
              ['withholding', withholding],
            ].map(([key, amount]) => (
              <IncomeCard
                key={key}
                title={text(key!)}
                className="income-summary-card"
              >
                {value(amount)}
                <p className="metadata">
                  {text('as_of')} {asOf} · BRL
                </p>
              </IncomeCard>
            ))}
          </div>
          {accrual.isError ? (
            <ErrorState
              text={accrual.error.message}
              retry={() => void accrual.refetch()}
            />
          ) : accrual.isPending ? (
            <LoadingState />
          ) : (
            <IncomeCard title={text('period_earnings')}>
              <div className="income-period-metrics">
                <div>
                  <p className="metadata">{text('gross_earned')}</p>
                  {value(accrual.data.period.gross)}
                </div>
                <div>
                  <p className="metadata">{text('net_earned')}</p>
                  {value(accrual.data.period.estimated_net)}
                </div>
                <div>
                  <p className="metadata">{text('redeemed_earnings')}</p>
                  {value(accrual.data.period.redeemed_net)}
                </div>
              </div>
              <p className="metadata">{text('period_definition')}</p>
              {accrual.data.quality !== 'COMPLETE' && (
                <p role="status" className="metadata">
                  {text('accrual_partial')}
                </p>
              )}
            </IncomeCard>
          )}
          <IncomeCard
            title={text('outstanding_history')}
            action={
              <select
                aria-label={text('contract')}
                value={active?.contract.id ?? ''}
                onChange={(event) => setSelected(event.target.value)}
              >
                <option value="">{text('all_contracts')}</option>
                {positions.map((position) => (
                  <option
                    key={position.contract.id}
                    value={position.contract.id}
                  >
                    {position.name}
                  </option>
                ))}
              </select>
            }
          >
            <p className="metadata">{text('outstanding_definition')}</p>
            {visibleHistory.isPending ? (
              <LoadingState />
            ) : visibleHistory.isError ? (
              <ErrorState
                text={visibleHistory.error.message}
                retry={() => void visibleHistory.refetch()}
              />
            ) : chart?.points.some((point) => point.gross_interest !== null) ? (
              <FixedIncomeChart history={chart} earnings />
            ) : (
              <EmptyState title={text('history_unavailable')} />
            )}
          </IncomeCard>
          <div className="table-scroll">
            <table className="investment-table">
              <caption>{text('accrued_positions')}</caption>
              <thead>
                <tr>
                  {[
                    'contract',
                    'principal',
                    'gross_accrual',
                    'net_accrual',
                    'withholding',
                  ].map((key) => (
                    <th key={key}>{text(key)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {positions.map((position) => (
                  <tr key={position.contract.id}>
                    <td>
                      <button
                        onClick={() => onSecurity(position.contract.asset_id)}
                      >
                        {position.name}
                      </button>
                      <small className="metadata">
                        {position.contract.issuer}
                      </small>
                    </td>
                    <td className="number">{value(position.principal)}</td>
                    <td className="number">{value(position.gross_interest)}</td>
                    <td className="number">
                      {value(
                        position.estimated_net === null
                          ? null
                          : subtractMoney(
                              position.estimated_net,
                              position.principal,
                            ),
                      )}
                    </td>
                    <td className="number">
                      {value(
                        position.income_tax === null || position.iof === null
                          ? null
                          : sumMoney([position.income_tax, position.iof]),
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!!treasury.length && (
        <IncomeCard title={text('treasury_result')}>
          <p className="metadata">{text('treasury_definition')}</p>
          {treasury.map((position) => (
            <div className="insight-holding" key={position.contract.id}>
              <button
                className="investment-security"
                onClick={() => onSecurity(position.contract.asset_id)}
              >
                {position.name}
              </button>
              {value(position.gross_interest)}
            </div>
          ))}
        </IncomeCard>
      )}
    </div>
  )
}
