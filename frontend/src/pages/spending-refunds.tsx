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
      <h2>Purchase refunds</h2>
      <p className="metadata">
        Explicitly associate a credit with its purchase. Unmatched credits
        remain income. Refunds reduce spending on the credit date, using the
        purchase's current category and payee. Combined refunds cannot exceed
        the purchase.
      </p>
      <form
        aria-label="Refund editor"
        onSubmit={(e) => {
          e.preventDefault()
          if (mode === 'new' && !moneyInput.safeParse(amount).success) {
            setError('Enter a positive exact refund amount.')
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
              'Unable to load refunds'
            }
          />
        )}
        <fieldset className="filter-bar" disabled={write.isPending}>
          <Field label="Search refund purchase/credit">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search description or payee"
            />
          </Field>
          <Field label="Original purchase">
            <select
              required
              value={purchase}
              onChange={(e) => setPurchase(e.target.value)}
            >
              <option value="">Choose purchase (latest 100 matches)</option>
              {expenses.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.transaction_date} · {t.description} · {t.amount}{' '}
                  {t.currency}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Refund operation">
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="new">Record a new credit</option>
              <option value="existing">
                Link an existing credit (no new money)
              </option>
            </select>
          </Field>
          {mode === 'new' ? (
            <>
              <Field label="Refund account">
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
              <Field label="Refund amount">
                <input
                  required
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </Field>
              <Field label="Refund date">
                <input
                  required
                  type="date"
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                />
              </Field>
              <Field label="Refund description">
                <input
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>
            </>
          ) : (
            <Field label="Existing credit">
              <select
                required
                value={credit}
                onChange={(e) => setCredit(e.target.value)}
              >
                <option value="">Choose credit</option>
                {credits.data?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.transaction_date} · {t.description} · {t.amount}{' '}
                    {t.currency}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Button type="submit">Save refund</Button>
        </fieldset>
      </form>
      <p className="metadata">
        Linked purchases and credits protect financial fields. Unlink before
        correcting their amount, account or date. Unlinking keeps the credit in
        the ledger and restores income classification.
      </p>
      {links.data?.length ? (
        <details>
          <summary>Recent refund links (up to 50)</summary>
          {links.data.map((link) => {
            const t = expenses.data?.find((t) => t.id === link.purchase_id)
            return (
              <div className="insight-row" key={link.id}>
                <span>
                  {t?.description ?? `Purchase ${link.purchase_id}`}{' '}
                  {t && <Money value={t.amount} currency={t.currency} />}
                  <small className="metadata block">
                    Credit {link.refund_id}
                  </small>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={write.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        'Unlink refund? The credit remains, and will count as income.',
                      )
                    )
                      write.mutate({
                        path: `/spending/refunds/${link.id}`,
                        method: 'DELETE',
                      })
                  }}
                >
                  Unlink
                </Button>
              </div>
            )
          })}
        </details>
      ) : null}
    </section>
  )
}
