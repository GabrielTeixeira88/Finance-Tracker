import {
  cloneElement,
  isValidElement,
  useId,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { useWrite } from '@/lib/use-write'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { PayeePicker } from '@/components/payee-picker'
import { decimalUnits } from '@/lib/money'
import {
  accountTypes,
  label,
  localDate,
  moneyInput,
  openingInput,
  type Account,
  type Category,
  type Transaction,
} from '@/lib/api'

export function Field({
  label: text,
  children,
}: {
  label: string
  children: ReactNode
}) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>{text}</label>
      {isValidElement<{ id?: string }>(children)
        ? cloneElement(children, { id })
        : children}
    </div>
  )
}

function Editor({
  title,
  path,
  editing,
  payload,
  onSaved,
  children,
  method,
}: {
  title: string
  path: string
  editing?: boolean
  payload: (form: FormData) => unknown
  onSaved?: () => void
  children: ReactNode
  method?: (form: FormData) => 'PUT' | 'PATCH'
}) {
  const mutation = useWrite()
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    setError('')
    setSaved(false)
    try {
      const fields = new FormData(form)
      const data = payload(fields)
      await mutation.mutateAsync({
        path,
        method: method?.(fields) ?? (editing ? 'PUT' : 'POST'),
        data,
      })
      form.reset()
      setSaved(true)
      onSaved?.()
    } catch (failure) {
      setError(
        failure instanceof z.ZodError
          ? failure.issues[0].message
          : failure instanceof Error
            ? failure.message
            : 'Unable to save.',
      )
    }
  }
  return (
    <section className="editor-surface">
      <h2>{title}</h2>
      <form onSubmit={(event) => void submit(event)}>
        <fieldset disabled={mutation.isPending} className="form-grid">
          {children}
        </fieldset>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="mt-3 text-sm text-primary">
            Saved.
          </p>
        )}
        <div className="mt-4 flex gap-3">
          <Button disabled={mutation.isPending} type="submit">
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
          {onSaved && (
            <Button
              disabled={mutation.isPending}
              variant="outline"
              type="button"
              onClick={onSaved}
            >
              Cancel
            </Button>
          )}
        </div>
      </form>
    </section>
  )
}

const value = (form: FormData, key: string) =>
  String(form.get(key) ?? '').trim()
const optional = (form: FormData, key: string) => value(form, key) || null

export function AccountForm({
  account,
  onSaved,
}: {
  account?: Account
  onSaved: () => void
}) {
  return (
    <Editor
      title={account ? 'Edit account' : 'Create account'}
      path={account ? `/accounts/${account.id}` : '/accounts'}
      editing={!!account}
      onSaved={onSaved}
      payload={(form) => {
        const base = {
          name: value(form, 'name'),
          type: value(form, 'type'),
          institution: optional(form, 'institution'),
        }
        return account
          ? { ...base, active: form.get('active') === 'on' }
          : {
              ...base,
              currency: z
                .string()
                .regex(
                  /^[A-Z]{3}$/,
                  'Use a three-letter uppercase currency code.',
                )
                .parse(value(form, 'currency')),
              opening_balance: openingInput.parse(
                value(form, 'opening_balance'),
              ),
              opening_direction: value(form, 'opening_direction'),
              opening_date: value(form, 'opening_date'),
            }
      }}
    >
      <Field label="Account name">
        <input
          name="name"
          required
          maxLength={120}
          defaultValue={account?.name}
        />
      </Field>
      <Field label="Account type">
        <select name="type" defaultValue={account?.type ?? 'CHECKING'}>
          {accountTypes.map((type) => (
            <option key={type} value={type}>
              {label(type)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Institution (optional)">
        <input
          name="institution"
          maxLength={120}
          defaultValue={account?.institution ?? ''}
        />
      </Field>
      {account ? (
        <Field label="Active">
          <input
            name="active"
            type="checkbox"
            defaultChecked={account.active}
          />
        </Field>
      ) : (
        <>
          <Field label="Currency">
            <input
              name="currency"
              required
              pattern="[A-Z]{3}"
              maxLength={3}
              defaultValue="BRL"
            />
          </Field>
          <Field label="Opening balance">
            <input
              name="opening_balance"
              inputMode="decimal"
              required
              defaultValue="0"
            />
          </Field>
          <Field label="Opening direction">
            <select name="opening_direction">
              <option value="IN">Positive balance</option>
              <option value="OUT">Negative balance / liability</option>
            </select>
          </Field>
          <Field label="Opening date">
            <input
              name="opening_date"
              type="date"
              required
              defaultValue={localDate()}
            />
          </Field>
        </>
      )}
    </Editor>
  )
}

export function TransactionForm({
  transaction,
  kind,
  accounts,
  categories,
  onSaved,
}: {
  transaction?: Transaction
  kind?: 'INCOME' | 'EXPENSE'
  accounts: Account[]
  categories: Category[]
  onSaved: () => void
}) {
  const financialChange = (form: FormData) =>
    !!transaction &&
    (decimalUnits(moneyInput.parse(value(form, 'amount'))) !==
      decimalUnits(transaction.amount) ||
      value(form, 'transaction_type') !== transaction.transaction_type)
  return (
    <Editor
      title={transaction ? 'Edit transaction' : 'Add income or expense'}
      path={transaction ? `/transactions/${transaction.id}` : '/transactions'}
      editing={!!transaction}
      onSaved={onSaved}
      method={
        transaction
          ? (form) => (financialChange(form) ? 'PUT' : 'PATCH')
          : undefined
      }
      payload={(form) => {
        const base = {
          transaction_type: value(form, 'transaction_type'),
          amount: moneyInput.parse(value(form, 'amount')),
          transaction_date: value(form, 'transaction_date'),
          description: value(form, 'description'),
          merchant: optional(form, 'merchant'),
          category_id: optional(form, 'category_id'),
          payee_id: optional(form, 'payee_id'),
          review_status: z
            .enum(['REVIEWED', 'NEEDS_REVIEW', 'AUTO'])
            .parse(value(form, 'review_status')),
        }
        if (transaction) {
          if (financialChange(form)) return base
          const metadata = {
            transaction_date: base.transaction_date,
            description: base.description,
            merchant: base.merchant,
            category_id: base.category_id,
            payee_id: base.payee_id,
            review_status: base.review_status,
          }
          return {
            ...Object.fromEntries(
              Object.entries(metadata).filter(
                ([key, next]) => next !== transaction[key as keyof Transaction],
              ),
            ),
            unlock_fields: ['payee_id', 'category_id', 'review_status'].filter(
              (field) => form.get(`unlock_${field}`) === 'on',
            ),
          }
        }
        const account = accounts.find(
          (a) => a.id === value(form, 'account_id') && a.active,
        )
        if (!account) throw new Error('Choose an active account.')
        return {
          ...Object.fromEntries(
            Object.entries(base).filter(
              ([key, next]) =>
                !(['payee_id', 'category_id'].includes(key) && next === null) &&
                !(key === 'review_status' && next === 'AUTO'),
            ),
          ),
          account_id: account.id,
          currency: account.currency,
        }
      }}
    >
      <Field label="Account">
        <select
          name="account_id"
          required
          disabled={!!transaction}
          defaultValue={transaction?.account_id ?? ''}
        >
          <option value="" disabled>
            Choose account
          </option>
          {accounts
            .filter((a) => a.active || a.id === transaction?.account_id)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </option>
            ))}
        </select>
      </Field>
      {kind ? (
        <input type="hidden" name="transaction_type" value={kind} />
      ) : (
        <Field label="Type">
          <select
            name="transaction_type"
            defaultValue={transaction?.transaction_type ?? 'EXPENSE'}
          >
            <option value="EXPENSE">Expense</option>
            <option value="INCOME">Income</option>
          </select>
        </Field>
      )}
      <Field label="Amount">
        <input
          name="amount"
          inputMode="decimal"
          required
          defaultValue={transaction?.amount}
        />
      </Field>
      <Field label="Date">
        <input
          name="transaction_date"
          type="date"
          required
          defaultValue={transaction?.transaction_date ?? localDate()}
        />
      </Field>
      <Field label="Description">
        <input
          name="description"
          required
          maxLength={500}
          defaultValue={transaction?.description}
        />
      </Field>
      <Field label="Merchant (optional)">
        <input
          name="merchant"
          maxLength={120}
          defaultValue={transaction?.merchant ?? ''}
        />
      </Field>
      <PayeePicker initial={transaction?.payee} />
      <Field label="Review status">
        <select
          name="review_status"
          defaultValue={transaction?.review_status ?? 'AUTO'}
        >
          {!transaction && (
            <option value="AUTO">Use rules / default Reviewed</option>
          )}
          <option value="REVIEWED">Reviewed</option>
          <option value="NEEDS_REVIEW">Needs review</option>
        </select>
      </Field>
      <Field label="Category">
        <select
          name="category_id"
          defaultValue={transaction?.category_id ?? ''}
        >
          <option value="">Uncategorized</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      {transaction && (
        <div className="field">
          <span className="metadata">
            Manual assignments take precedence over rules.
          </span>
          {(transaction.manual_fields ?? []).map((field) => (
            <label key={field}>
              <input type="checkbox" name={`unlock_${field}`} /> Allow rules to
              update {field.replace('_id', '').replace('_', ' ')}
            </label>
          ))}
          {Object.values(transaction.rule_assignments ?? {}).map(
            (assignment) => (
              <small key={assignment.rule_id}>
                Assigned by rule: {assignment.rule_name}
              </small>
            ),
          )}
        </div>
      )}
    </Editor>
  )
}

export function TransferForm({
  accounts,
  onSaved,
}: {
  accounts: Account[]
  onSaved?: () => void
}) {
  const [source, setSource] = useState('')
  const selected = accounts.find((a) => a.id === source)
  return (
    <Editor
      title="Transfer between accounts"
      path="/transfers"
      onSaved={() => {
        setSource('')
        onSaved?.()
      }}
      payload={(form) => {
        const from = accounts.find(
          (a) => a.id === value(form, 'source') && a.active,
        )
        const to = accounts.find(
          (a) => a.id === value(form, 'destination') && a.active,
        )
        if (!from || !to || from.id === to.id)
          throw new Error('Choose two different active accounts.')
        if (from.currency !== to.currency)
          throw new Error('Both accounts must use the same currency.')
        return {
          source_account_id: from.id,
          destination_account_id: to.id,
          currency: from.currency,
          amount: moneyInput.parse(value(form, 'amount')),
          transaction_date: value(form, 'date'),
          description: value(form, 'description') || 'Transfer',
        }
      }}
    >
      <Field label="From account">
        <select
          name="source"
          required
          value={source}
          onChange={(e) => setSource(e.target.value)}
        >
          <option value="">Choose account</option>
          {accounts
            .filter((a) => a.active)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </option>
            ))}
        </select>
      </Field>
      <Field label="To account">
        <select key={source} name="destination" required defaultValue="">
          <option value="" disabled>
            Choose account
          </option>
          {accounts
            .filter(
              (a) =>
                a.active &&
                a.id !== source &&
                a.currency === selected?.currency,
            )
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </option>
            ))}
        </select>
      </Field>
      <Field label="Amount">
        <input name="amount" inputMode="decimal" required />
      </Field>
      <Field label="Date">
        <input name="date" type="date" required defaultValue={localDate()} />
      </Field>
      <Field label="Description (optional)">
        <input name="description" maxLength={500} />
      </Field>
      <p className="text-sm text-muted-foreground">
        Transfers move money without changing income or expenses. Both accounts
        must use the same currency.
      </p>
    </Editor>
  )
}

export function CategoryForm({
  category,
  onSaved,
}: {
  category?: Category
  onSaved: () => void
}) {
  return (
    <Editor
      title={category ? 'Edit category' : 'Create category'}
      path={category ? `/categories/${category.id}` : '/categories'}
      editing={!!category}
      onSaved={onSaved}
      payload={(form) => ({ name: value(form, 'name') })}
    >
      <Field label="Category name">
        <input
          name="name"
          required
          maxLength={120}
          defaultValue={category?.name}
        />
      </Field>
    </Editor>
  )
}

export function TransactionComposer({
  accounts,
  categories,
  onSaved,
}: {
  accounts: Account[]
  categories: Category[]
  onSaved: () => void
}) {
  const [kind, setKind] = useState<'EXPENSE' | 'INCOME' | 'TRANSFER'>('EXPENSE')
  return (
    <div className="transaction-composer">
      <Field label="Transaction type">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
        >
          <option value="EXPENSE">Expense</option>
          <option value="INCOME">Income</option>
          <option value="TRANSFER">Transfer</option>
        </select>
      </Field>
      {kind === 'TRANSFER' ? (
        <TransferForm accounts={accounts} onSaved={onSaved} />
      ) : (
        <TransactionForm
          key={kind}
          kind={kind}
          accounts={accounts}
          categories={categories}
          onSaved={onSaved}
        />
      )}
    </div>
  )
}
