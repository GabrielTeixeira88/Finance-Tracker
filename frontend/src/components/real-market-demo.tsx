import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { request } from '@/lib/api'
import { t } from '@/lib/i18n'
import { getFixedIncome } from '@/lib/fixed-income'
import { Money, ErrorState, LoadingState } from './primitives'
import { useDemoRuntime } from '@/lib/demo-runtime'

const evidenceSchema = z.object({
  reference_date: z.string(),
  retrieved_on: z.string(),
  etf_coverage: z.string(),
  warnings: z.array(z.string()),
  sources: z.record(
    z.string(),
    z.object({ url: z.string(), sha256: z.string() }),
  ),
  caixinha: z.record(z.string(), z.string().nullable()),
  taxes: z.string(),
  treasury_fees: z.string(),
})

/** Backend projections and provenance, scoped to the isolated historical demo. */
export function RealMarketDemo() {
  const { runtime } = useDemoRuntime()
  const query = useQuery({
    queryKey: ['real-market-evidence'],
    queryFn: async () =>
      evidenceSchema.parse(await request('/demo-control/market-evidence')),
  })
  const positions = useQuery({
    queryKey: ['real-market-contracts', runtime?.end_date],
    queryFn: () => getFixedIncome(runtime!.end_date, ''),
    enabled: !!runtime,
  })
  if (query.isPending) return <LoadingState />
  if (query.isError) return <ErrorState text={query.error.message} />
  const data = query.data
  return (
    <section aria-label={t('real_market:context')} className="metadata">
      {data.warnings.map((warning) => (
        <p role="status" key={warning}>
          {warning}
        </p>
      ))}
      <details className="financial-disclosure">
        <summary>{t('real_market:context')}</summary>
        <p>
          {t('real_market:source_dates', {
            reference: data.reference_date,
            retrieved: data.retrieved_on,
          })}
        </p>
        <p>
          {t('real_market:caixinha')} — {t('real_market:deposited')}:{' '}
          {data.caixinha.principal && (
            <Money
              fractionDigits={2}
              value={data.caixinha.principal}
              currency="BRL"
            />
          )}
          {' · '}
          {t('real_market:gross')}:{' '}
          {data.caixinha.gross_value && (
            <Money
              fractionDigits={2}
              value={data.caixinha.gross_value}
              currency="BRL"
            />
          )}
          {' · '}
          {t('real_market:net')}:{' '}
          {data.caixinha.estimated_net && (
            <Money
              fractionDigits={2}
              value={data.caixinha.estimated_net}
              currency="BRL"
            />
          )}
        </p>
        {positions.isError ? (
          <ErrorState text={positions.error.message} />
        ) : (
          <div className="table-scroll">
            <table className="finance-table">
              <caption className="sr-only">
                {t('real_market:contracts')}
              </caption>
              <thead>
                <tr>
                  <th>{t('real_market:contracts')}</th>
                  <th>{t('real_market:application')}</th>
                  <th>{t('real_market:maturity')}</th>
                  {[
                    t('real_market:deposited'),
                    t('real_market:gross'),
                    t('real_market:interest'),
                    t('real_market:tax'),
                    t('real_market:iof'),
                    t('real_market:net'),
                  ].map((h) => (
                    <th key={h} className="amount-cell">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {positions.data?.positions.map((p) => (
                  <tr key={p.contract.id}>
                    <td>
                      <details>
                        <summary>{p.name}</summary>
                        <p className="max-w-xl">{p.contract.notes}</p>
                      </details>
                    </td>
                    <td>{p.contract.settlement_date}</td>
                    <td>{p.contract.maturity_date}</td>
                    {[
                      p.principal,
                      p.gross_value,
                      p.gross_interest,
                      p.income_tax,
                      p.iof,
                      p.estimated_net,
                    ].map((v, i) => (
                      <td className="amount-cell" key={i}>
                        {v === null ? (
                          t('common:unavailable')
                        ) : (
                          <Money value={v} currency="BRL" fractionDigits={2} />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p>{data.taxes}</p>
        <p>{data.treasury_fees}</p>
        <ul>
          {Object.entries(data.sources).map(([name, source]) => (
            <li key={name}>
              <a href={source.url} target="_blank" rel="noreferrer">
                {name}
              </a>{' '}
              · SHA-256 <code>{source.sha256}</code>
            </li>
          ))}
        </ul>
      </details>
    </section>
  )
}
