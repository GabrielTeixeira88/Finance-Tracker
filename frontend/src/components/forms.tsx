import { t as tr, ui } from '@/lib/i18n'
import { DecimalInput } from './decimal-input'
import { exactFormData } from '@/lib/localized-number'
import {
  cloneElement,
  isValidElement,
  useId,
  useState,
  type FormEvent,
  type ReactNode,
  type InputHTMLAttributes,
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
  if (
    isValidElement<InputHTMLAttributes<HTMLInputElement>>(children) &&
    children.type === 'input' &&
    children.props.inputMode === 'decimal'
  ) {
    return (
      <div className="field">
        <label htmlFor={id}>{text}</label>
        <DecimalInput {...children.props} id={id} />
      </div>
    )
  }
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
      const fields = exactFormData(form)
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
            : tr('dynamic:unable_to_save__78f9b8'),
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
            {tr('forms:saved__9d4af6')}
          </p>
        )}
        <div className="mt-4 flex gap-3">
          <Button disabled={mutation.isPending} type="submit">
            {mutation.isPending
              ? tr('dynamic:saving__56a228')
              : tr('dynamic:save_efc007')}
          </Button>
          {onSaved && (
            <Button
              disabled={mutation.isPending}
              variant="outline"
              type="button"
              onClick={onSaved}
            >
              {tr('forms:cancel_77dfd2')}
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
      title={
        account
          ? tr('dynamic:edit_account_101882')
          : tr('dynamic:create_account_aaf374')
      }
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
                .regex(/^[A-Z]{3}$/, {
                  error: () => tr('errors:INVALID_CURRENCY'),
                })
                .parse(value(form, 'currency')),
              opening_balance: openingInput.parse(
                value(form, 'opening_balance'),
              ),
              opening_direction: value(form, 'opening_direction'),
              opening_date: value(form, 'opening_date'),
            }
      }}
    >
      <Field label={tr('forms:account_name_abe4d6')}>
        <input
          name="name"
          required
          maxLength={120}
          defaultValue={account?.name}
        />
      </Field>
      <Field label={tr('forms:account_type_144b49')}>
        <select name="type" defaultValue={account?.type ?? 'CHECKING'}>
          {accountTypes.map((type) => (
            <option key={type} value={type}>
              {label(type)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={tr('forms:institution_optional__965901')}>
        <input
          name="institution"
          maxLength={120}
          defaultValue={account?.institution ?? ''}
        />
      </Field>
      {account ? (
        <Field label={tr('forms:active_a733b8')}>
          <input
            name="active"
            type="checkbox"
            defaultChecked={account.active}
          />
        </Field>
      ) : (
        <>
          <Field label={tr('forms:currency_e070de')}>
            <input
              name="currency"
              required
              pattern="[A-Z]{3}"
              maxLength={3}
              defaultValue="BRL"
            />
          </Field>
          <Field label={tr('forms:opening_balance_7622a7')}>
            <input
              name="opening_balance"
              inputMode="decimal"
              required
              defaultValue="0"
            />
          </Field>
          <Field label={tr('forms:opening_direction_627e72')}>
            <select name="opening_direction">
              <option value="IN">{tr('forms:positive_balance_fb11b1')}</option>
              <option value="OUT">
                {tr('forms:negative_balance_liability_40a89b')}
              </option>
            </select>
          </Field>
          <Field label={tr('forms:opening_date_a08c44')}>
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
      title={
        transaction
          ? tr('dynamic:edit_transaction_f6bd9c')
          : tr('dynamic:add_income_or_expense_0e14f7')
      }
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
        if (!account) throw new Error(ui('Choose an active account.'))
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
      <Field label={tr('forms:account_85dfa3')}>
        <select
          name="account_id"
          required
          disabled={!!transaction}
          defaultValue={transaction?.account_id ?? ''}
        >
          <option value="" disabled>
            {tr('forms:choose_account_9ccef0')}
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
        <Field label={tr('forms:type_3deb74')}>
          <select
            name="transaction_type"
            defaultValue={transaction?.transaction_type ?? 'EXPENSE'}
          >
            <option value="EXPENSE">{tr('forms:expense_a0db8e')}</option>
            <option value="INCOME">{tr('forms:income_1c89b1')}</option>
          </select>
        </Field>
      )}
      <Field label={tr('forms:amount_43dc85')}>
        <input
          name="amount"
          inputMode="decimal"
          required
          defaultValue={transaction?.amount}
        />
      </Field>
      <Field label={tr('forms:date_eb9a4b')}>
        <input
          name="transaction_date"
          type="date"
          required
          defaultValue={transaction?.transaction_date ?? localDate()}
        />
      </Field>
      <Field label={tr('forms:description_55f8eb')}>
        <input
          name="description"
          required
          maxLength={500}
          defaultValue={transaction?.description}
        />
      </Field>
      <Field label={tr('forms:merchant_optional__33d4eb')}>
        <input
          name="merchant"
          maxLength={120}
          defaultValue={transaction?.merchant ?? ''}
        />
      </Field>
      <PayeePicker initial={transaction?.payee} />
      <Field label={tr('forms:review_status_0fe6b8')}>
        <select
          name="review_status"
          defaultValue={transaction?.review_status ?? 'AUTO'}
        >
          {!transaction && (
            <option value="AUTO">
              {tr('forms:use_rules_default_reviewed_e9232b')}
            </option>
          )}
          <option value="REVIEWED">{tr('forms:reviewed_31ef85')}</option>
          <option value="NEEDS_REVIEW">
            {tr('forms:needs_review_33a506')}
          </option>
        </select>
      </Field>
      <Field label={tr('forms:category_a3c686')}>
        <select
          name="category_id"
          defaultValue={transaction?.category_id ?? ''}
        >
          <option value="">{tr('forms:uncategorized_4ef7d7')}</option>
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
            {tr('forms:manual_assignments_take_precedence_over_rules__4c3564')}
          </span>
          {(transaction.manual_fields ?? []).map((field) => (
            <label key={field}>
              <input type="checkbox" name={`unlock_${field}`} />{' '}
              {tr('forms:allow_rules_to_update_3d96bb')}{' '}
              {field.replace('_id', '').replace('_', ' ')}
            </label>
          ))}
          {Object.values(transaction.rule_assignments ?? {}).map(
            (assignment) => (
              <small key={assignment.rule_id}>
                {' '}
                {tr('forms:assigned_by_rule__d75af5')} {assignment.rule_name}
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
      title={tr('forms:transfer_between_accounts_d4d3b6')}
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
          throw new Error(ui('Choose two different active accounts.'))
        if (from.currency !== to.currency)
          throw new Error(ui('Both accounts must use the same currency.'))
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
      <Field label={tr('forms:from_account_3cebdd')}>
        <select
          name="source"
          required
          value={source}
          onChange={(e) => setSource(e.target.value)}
        >
          <option value="">{tr('forms:choose_account_9ccef0')}</option>
          {accounts
            .filter((a) => a.active)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </option>
            ))}
        </select>
      </Field>
      <Field label={tr('forms:to_account_aef07b')}>
        <select key={source} name="destination" required defaultValue="">
          <option value="" disabled>
            {tr('forms:choose_account_9ccef0')}
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
      <Field label={tr('forms:amount_43dc85')}>
        <input name="amount" inputMode="decimal" required />
      </Field>
      <Field label={tr('forms:date_eb9a4b')}>
        <input name="date" type="date" required defaultValue={localDate()} />
      </Field>
      <Field label={tr('forms:description_optional__388de6')}>
        <input name="description" maxLength={500} />
      </Field>
      <p className="text-sm text-muted-foreground">
        {tr('forms:transfers_move_money_without_changing_income_or__d93c9e')}
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
      title={
        category
          ? tr('dynamic:edit_category_c6071d')
          : tr('dynamic:create_category_61495a')
      }
      path={category ? `/categories/${category.id}` : '/categories'}
      editing={!!category}
      onSaved={onSaved}
      payload={(form) => ({ name: value(form, 'name') })}
    >
      <Field label={tr('forms:category_name_ed3dc4')}>
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
      <Field label={tr('forms:transaction_type_575da7')}>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
        >
          <option value="EXPENSE">{tr('forms:expense_a0db8e')}</option>
          <option value="INCOME">{tr('forms:income_1c89b1')}</option>
          <option value="TRANSFER">{tr('forms:transfer_cbb4cc')}</option>
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
