import { t as tr } from '@/lib/i18n'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { Field } from '@/components/forms'
import { Button } from '@/components/ui/button'
import { ErrorState, Money } from '@/components/primitives'
import {
  getTransactions,
  localDate,
  moneyInput,
  request,
  type Account,
} from '@/lib/api'
import { useWrite } from '@/lib/use-write'

export default function Refunds({
  accounts,
  currency,
}: {
  accounts: Account[]
  currency: string
  month: string
}) {
  const [search, setSearch] = useState(''),
    [purchase, setPurchase] = useState('')
  const [mode, setMode] = useState('new'),
    [credit, setCredit] = useState('')
  const [amount, setAmount] = useState(''),
    [day, setDay] = useState(localDate())
  const [account, setAccount] = useState(
    accounts.find((a) => a.currency === currency)?.id ?? '',
  )
  const [error, setError] = useState(''),
    [description, setDescription] = useState('Purchase refund')
  const expenses = useQuery({
    queryKey: ['transactions', 'refund-purchases', currency, search],
    queryFn: ({ signal }) =>
      getTransactions(
        new URLSearchParams({
          currency,
          search,
          transaction_type: 'EXPENSE',
          limit: '100',
        }),
        signal,
      ),
  })
  const credits = useQuery({
    queryKey: ['transactions', 'refund-credits', currency, search],
    queryFn: ({ signal }) =>
      getTransactions(
        new URLSearchParams({
          currency,
          search,
          transaction_type: 'INCOME',
          limit: '100',
        }),
        signal,
      ),
    enabled: mode === 'existing',
  })
  const links = useQuery({
    queryKey: ['refunds'],
    queryFn: async () =>
      z
        .array(
          z.object({
            id: z.string(),
            purchase_id: z.string(),
            refund_id: z.string(),
          }),
        )
        .parse(await request('/spending/refunds')),
  })
  const write = useWrite()
  return (
    <section className="editor-surface">
      <h2>{tr('spending_refunds:purchase_refunds_8f65e7')}</h2>
      <p className="metadata">
        {tr(
          'spending_refunds:explicitly_associate_a_credit_with_its_purchase__70a177',
        )}
      </p>
      <form
        aria-label={tr('spending_refunds:refund_editor_3b8d1f')}
        onSubmit={(e) => {
          e.preventDefault()
          if (mode === 'new' && !moneyInput.safeParse(amount).success) {
            setError(tr('dynamic:enter_a_positive_exact_refund_amount__85027e'))
            return
          }
          setError('')
          write.mutate(
            {
              path:
                mode === 'new' ? '/spending/refunds' : '/spending/refunds/link',
              data:
                mode === 'new'
                  ? {
                      purchase_id: purchase,
                      account_id: account,
                      amount,
                      transaction_date: day,
                      description,
                    }
                  : { purchase_id: purchase, refund_id: credit },
            },
            {
              onSuccess: () => {
                setAmount('')
                setCredit('')
                setPurchase('')
              },
            },
          )
        }}
      >
        {(error ||
          write.isError ||
          expenses.isError ||
          credits.isError ||
          links.isError) && (
          <ErrorState
            text={
              error ||
              write.error?.message ||
              expenses.error?.message ||
              credits.error?.message ||
              links.error?.message ||
              tr('dynamic:unable_to_load_refunds_b201d0')
            }
          />
        )}
        <fieldset className="filter-bar" disabled={write.isPending}>
          <Field
            label={tr('spending_refunds:search_refund_purchase_credit_8f2653')}
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tr(
                'spending_refunds:search_description_or_payee_80dc3b',
              )}
            />
          </Field>
          <Field label={tr('spending_refunds:original_purchase_2e2d66')}>
            <select
              required
              value={purchase}
              onChange={(e) => setPurchase(e.target.value)}
            >
              <option value="">
                {tr(
                  'spending_refunds:choose_purchase_latest_100_matches__a32ab6',
                )}
              </option>
              {expenses.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.transaction_date} · {t.description} · {t.amount}{' '}
                  {t.currency}
                </option>
              ))}
            </select>
          </Field>
          <Field label={tr('spending_refunds:refund_operation_939cfa')}>
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="new">
                {tr('spending_refunds:record_a_new_credit_f0e1cd')}
              </option>
              <option value="existing">
                {tr(
                  'spending_refunds:link_an_existing_credit_no_new_money__edbfeb',
                )}
              </option>
            </select>
          </Field>
          {mode === 'new' ? (
            <>
              <Field label={tr('spending_refunds:refund_account_d7ac4d')}>
                <select
                  required
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                >
                  {accounts
                    .filter((a) => a.active && a.currency === currency)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label={tr('spending_refunds:refund_amount_b7a4c9')}>
                <input
                  required
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </Field>
              <Field label={tr('spending_refunds:refund_date_62e797')}>
                <input
                  required
                  type="date"
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                />
              </Field>
              <Field label={tr('spending_refunds:refund_description_745e99')}>
                <input
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>
            </>
          ) : (
            <Field label={tr('spending_refunds:existing_credit_23a828')}>
              <select
                required
                value={credit}
                onChange={(e) => setCredit(e.target.value)}
              >
                <option value="">
                  {tr('spending_refunds:choose_credit_c02ed1')}
                </option>
                {credits.data?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.transaction_date} · {t.description} · {t.amount}{' '}
                    {t.currency}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Button type="submit">
            {tr('spending_refunds:save_refund_34e5c4')}
          </Button>
        </fieldset>
      </form>
      <p className="metadata">
        {tr(
          'spending_refunds:linked_purchases_and_credits_protect_financial_f_b0b6e8',
        )}
      </p>
      {links.data?.length ? (
        <details>
          <summary>
            {tr('spending_refunds:recent_refund_links_up_to_50__d88276')}
          </summary>
          {links.data.map((link) => {
            const t = expenses.data?.find((t) => t.id === link.purchase_id)
            return (
              <div className="insight-row" key={link.id}>
                <span>
                  {t?.description ?? `Purchase ${link.purchase_id}`}{' '}
                  {t && <Money value={t.amount} currency={t.currency} />}
                  <small className="metadata block">
                    {' '}
                    {tr('spending_refunds:credit_8a45d3')} {link.refund_id}
                  </small>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={write.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        tr(
                          'dynamic:unlink_refund_the_credit_remains_and_will_count__61408b',
                        ),
                      )
                    )
                      write.mutate({
                        path: `/spending/refunds/${link.id}`,
                        method: 'DELETE',
                      })
                  }}
                >
                  {tr('spending_refunds:unlink_0dc291')}
                </Button>
              </div>
            )
          })}
        </details>
      ) : null}
    </section>
  )
}
