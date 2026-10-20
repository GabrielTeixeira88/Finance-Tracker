import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Field } from '@/components/forms'
import { PayeePicker } from '@/components/payee-picker'
import { Button } from '@/components/ui/button'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Money,
} from '@/components/primitives'
import { getPayees, label, type Account, type Category } from '@/lib/api'
import { useWrite } from '@/lib/use-write'
import {
  conditionFields,
  getRules,
  getSuggestions,
  previewDraft,
  previewRule,
  type Condition,
  type Rule,
  type RuleDraft,
  type RulePreview,
  type Suggestion,
} from '@/lib/automation-api'

const fresh = (): RuleDraft => ({
  name: '',
  enabled: true,
  priority: 100,
  match_mode: 'ALL',
  conditions: [{ field: 'description', operator: 'contains', value: '' }],
  actions: {},
})
export function Rules({
  accounts,
  categories,
}: {
  accounts: Account[]
  categories: Category[]
}) {
  const rules = useQuery({ queryKey: ['rules'], queryFn: getRules })
  const suggestions = useQuery({
    queryKey: ['rule-suggestions'],
    queryFn: getSuggestions,
  })
  const payees = useQuery({
    queryKey: ['payees', ''],
    queryFn: () => getPayees(''),
  })
  const [editor, setEditor] = useState<{
    rule?: Rule
    suggestion?: Suggestion
    initialDraft?: RuleDraft
  }>()
  const [preview, setPreview] = useState<{ id: string; data: RulePreview }>()
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const visibleRules = (rules.data ?? []).filter(
    (rule) =>
      rule.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()) &&
      (status === 'all' || rule.enabled === (status === 'enabled')),
  )
  const write = useWrite()
  const valueName = (field: string, value: string | null | undefined) =>
    field === 'category_id'
      ? (categories.find((c) => c.id === value)?.name ?? 'Category')
      : field === 'payee_id'
        ? (payees.data?.find((p) => p.id === value)?.name ?? 'Selected payee')
        : field === 'account_id'
          ? (accounts.find((a) => a.id === value)?.name ?? 'Account')
          : (value ?? '')
  async function inspect(rule: Rule) {
    setError('')
    try {
      setPreview({ id: rule.id, data: await previewRule(rule.id) })
    } catch (e) {
      setError((e as Error).message)
    }
  }
  return (
    <section className="panel">
      <div className="flex justify-between items-center">
        <h2>Transaction rules</h2>
        <Button
          onClick={() => {
            setEditor({})
            setPreview(undefined)
          }}
        >
          Create rule
        </Button>
      </div>
      <p className="metadata">
        Lower priority numbers run first. Manual choices win. Saving applies
        only to future ordinary transactions.
      </p>
      <div className="filter-bar">
        <Field label="Search rules">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
        <Field label="Rule status">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All rules</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
        </Field>
      </div>
      {editor && (
        <RuleEditor
          key={
            editor.rule?.id ??
            editor.suggestion?.id ??
            editor.initialDraft?.name ??
            'new'
          }
          {...editor}
          accounts={accounts}
          categories={categories}
          valueName={valueName}
          onSaved={() => setEditor(undefined)}
        />
      )}
      {rules.isPending ? (
        <LoadingState text="Loading rules…" />
      ) : rules.isError ? (
        <ErrorState
          text="Unable to load rules"
          retry={() => void rules.refetch()}
        />
      ) : (
        <>
          {!rules.data.length && (
            <EmptyState
              title="No rules yet"
              detail="Create a narrow rule and preview its effect before applying it."
            />
          )}
          {!!rules.data.length && !visibleRules.length && (
            <EmptyState
              title="No matching rules"
              detail="Change the search or status filter."
            />
          )}
          {visibleRules.map((rule) => (
            <div className="automation-row" key={rule.id}>
              <div>
                <strong>{rule.name}</strong>
                <p className="metadata">
                  {rule.enabled ? 'Enabled' : 'Disabled'} · Priority{' '}
                  {rule.priority} · {rule.match_mode}
                </p>
                <p>
                  {rule.conditions
                    .map(
                      (c) =>
                        `${label(c.field)} ${label(c.operator)} “${valueName(c.field, c.value)}”`,
                    )
                    .join(rule.match_mode === 'ALL' ? ' AND ' : ' OR ')}
                </p>
                <p className="metadata">
                  {Object.entries(rule.actions)
                    .filter(([, v]) => v)
                    .map(
                      ([k, v]) =>
                        `${label(k.replace('_id', ''))}: ${valueName(k, v)}`,
                    )
                    .join(' · ')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  aria-label={`Edit ${rule.name}`}
                  onClick={() => setEditor({ rule })}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={write.isPending}
                  onClick={() => {
                    setPreview(undefined)
                    write.mutate({
                      path: `/rules/${rule.id}`,
                      method: 'PATCH',
                      data: { enabled: !rule.enabled },
                    })
                  }}
                >
                  {rule.enabled ? 'Disable' : 'Enable'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void inspect(rule)}
                >
                  Preview history
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditor({
                      initialDraft: {
                        ...rule,
                        name: `${rule.name} (copy)`.slice(0, 120),
                        enabled: false,
                      },
                    })
                    setPreview(undefined)
                  }}
                >
                  Duplicate
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={write.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Delete rule ${rule.name}? Existing classifications remain.`,
                      )
                    ) {
                      setPreview(undefined)
                      write.mutate({
                        path: `/rules/${rule.id}`,
                        method: 'DELETE',
                      })
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </>
      )}
      {preview && (
        <>
          <Preview result={preview.data} valueName={valueName} />
          <Button
            disabled={write.isPending || !preview.data.change_count}
            onClick={() => {
              if (
                window.confirm(
                  `Apply this rule to ${preview.data.change_count} transactions from this preview? Manual overrides remain protected.`,
                )
              )
                write.mutate(
                  {
                    path: `/rules/${preview.id}/apply`,
                    data: { preview_token: preview.data.preview_token },
                  },
                  {
                    onSuccess: (result) => {
                      setFeedback(
                        `${result.applied} transactions changed; ${result.skipped_fields} fields skipped.`,
                      )
                      setPreview(undefined)
                    },
                  },
                )
            }}
          >
            Apply previewed changes
          </Button>
        </>
      )}
      {(error || write.isError) && (
        <ErrorState text={error || write.error!.message} />
      )}
      {feedback && <p role="status">{feedback}</p>}
      <h2 className="mt-6">Suggested automation</h2>
      <p className="metadata">
        Suggestions come from consistent explicit corrections, never from an AI
        service. Acceptance creates a future-only rule.
      </p>
      {suggestions.isPending ? (
        <LoadingState text="Loading suggestions…" />
      ) : suggestions.isError ? (
        <ErrorState
          text="Unable to load suggestions"
          retry={() => void suggestions.refetch()}
        />
      ) : (
        <>
          {!suggestions.data.some((s) => s.status === 'PENDING') && (
            <EmptyState title="No pending suggestions" />
          )}
          {suggestions.data.map((s) => (
            <div className="automation-row" key={s.id}>
              <div>
                <strong>{s.name}</strong>
                <p>
                  {s.support_count} distinct corrected transactions ·{' '}
                  {label(s.status)}
                </p>
                <p className="metadata">
                  {s.conditions
                    .map(
                      (c) =>
                        `${label(c.field)} ${label(c.operator)} ${valueName(c.field, c.value)}`,
                    )
                    .join(' AND ')}{' '}
                  →{' '}
                  {Object.entries(s.actions)
                    .map(
                      ([k, v]) =>
                        `${label(k.replace('_id', ''))}: ${valueName(k, v)}`,
                    )
                    .join(' · ')}
                </p>
              </div>
              {s.status === 'PENDING' && (
                <div className="flex gap-2">
                  <Button
                    disabled={write.isPending}
                    onClick={() =>
                      write.mutate({
                        path: `/rule-suggestions/${s.id}/accept`,
                        data: {},
                      })
                    }
                  >
                    Accept
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setEditor({ suggestion: s })}
                  >
                    Edit suggestion
                  </Button>
                  <Button
                    variant="outline"
                    disabled={write.isPending}
                    onClick={() =>
                      write.mutate({
                        path: `/rule-suggestions/${s.id}/dismiss`,
                      })
                    }
                  >
                    Dismiss
                  </Button>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </section>
  )
}

function Preview({
  result,
  valueName,
}: {
  result: RulePreview
  valueName: (field: string, value: string | null | undefined) => string
}) {
  return (
    <section className="editor-surface">
      <h3>Rule preview — no changes saved</h3>
      <p>
        {result.match_count} matches · {result.change_count} would change ·{' '}
        {result.skipped_fields} fields skipped
      </p>
      <p className="metadata">
        Up to 50 representative matches. Higher-priority rules and manual
        overrides are included.
      </p>
      <ul>
        {result.rows.map((row) => (
          <li className="automation-row" key={row.transaction_id}>
            <div>
              <strong>{row.description}</strong>
              <p className="metadata">
                {row.date} ·{' '}
                <Money value={row.amount} currency={row.currency} />
              </p>
              {row.proposed.map((a) => (
                <p key={a.field}>
                  {label(a.field.replace('_id', ''))}:{' '}
                  {valueName(a.field, a.before) || 'Unassigned'} →{' '}
                  {valueName(a.field, a.after)}
                </p>
              ))}
              {row.skipped.map((a, i) => (
                <p className="metadata" key={i}>
                  {label(a.field.replace('_id', ''))}: {a.reason}
                </p>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function RuleEditor({
  rule,
  initialDraft,
  suggestion,
  accounts,
  categories,
  onSaved,
  valueName,
}: {
  rule?: Rule
  initialDraft?: RuleDraft
  suggestion?: Suggestion
  accounts: Account[]
  categories: Category[]
  onSaved: () => void
  valueName: (field: string, value: string | null | undefined) => string
}) {
  const [draft, setDraft] = useState<RuleDraft>(
    rule ??
      initialDraft ??
      (suggestion
        ? {
            ...fresh(),
            name: suggestion.name,
            conditions: suggestion.conditions,
            actions: suggestion.actions,
          }
        : fresh()),
  )
  const [advanced, setAdvanced] = useState(() => {
    const value = rule ?? initialDraft ?? suggestion
    return (
      !!value &&
      (value.conditions.length !== 1 ||
        value.conditions[0]?.field !== 'description' ||
        value.conditions[0]?.operator !== 'contains')
    )
  })
  const [preview, setPreview] = useState<RulePreview>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const write = useWrite()
  const update = (value: Partial<RuleDraft>) => {
    setDraft((d) => ({ ...d, ...value }))
    setPreview(undefined)
  }
  const changeCondition = (index: number, value: Partial<Condition>) =>
    update({
      conditions: draft.conditions.map((c, i) =>
        i === index ? { ...c, ...value } : c,
      ),
    })
  const payload = () => ({
    name: draft.name,
    enabled: draft.enabled,
    priority: draft.priority,
    match_mode: draft.match_mode,
    conditions: draft.conditions,
    actions: Object.fromEntries(
      Object.entries(draft.actions).filter(([, v]) => v),
    ),
  })
  return (
    <section className="editor-surface">
      <h3>
        {suggestion
          ? 'Edit suggested rule'
          : rule
            ? 'Edit rule'
            : 'Create rule'}
      </h3>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          setError('')
          write.mutate(
            {
              path: suggestion
                ? `/rule-suggestions/${suggestion.id}/accept`
                : rule
                  ? `/rules/${rule.id}`
                  : '/rules',
              method: rule ? 'PATCH' : 'POST',
              data: suggestion ? { rule: payload() } : payload(),
            },
            { onSuccess: onSaved },
          )
        }}
      >
        <fieldset disabled={write.isPending || busy}>
          <div className="form-grid">
            <Field label="Rule name">
              <input
                required
                maxLength={120}
                value={draft.name}
                onChange={(e) => update({ name: e.target.value })}
              />
            </Field>
          </div>
          {!advanced &&
            draft.conditions.length === 1 &&
            draft.conditions[0].field === 'description' &&
            draft.conditions[0].operator === 'contains' && (
              <Field label="Description contains">
                <input
                  required
                  maxLength={500}
                  value={draft.conditions[0].value}
                  onChange={(e) =>
                    changeCondition(0, { value: e.target.value })
                  }
                />
              </Field>
            )}
          <Button
            type="button"
            variant="ghost"
            aria-expanded={advanced}
            onClick={() => setAdvanced(!advanced)}
          >
            Advanced conditions and priority
          </Button>
          {advanced && (
            <div className="advanced-fields">
              <div className="form-grid">
                <Field label="Priority">
                  <input
                    type="number"
                    min={0}
                    max={100000}
                    required
                    value={draft.priority}
                    onChange={(e) =>
                      update({ priority: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Match mode">
                  <select
                    value={draft.match_mode}
                    onChange={(e) =>
                      update({ match_mode: e.target.value as 'ALL' | 'ANY' })
                    }
                  >
                    <option value="ALL">All conditions</option>
                    <option value="ANY">Any condition</option>
                  </select>
                </Field>
                <Field label="Rule enabled">
                  <input
                    type="checkbox"
                    checked={draft.enabled}
                    onChange={(e) => update({ enabled: e.target.checked })}
                  />
                </Field>
              </div>
              {draft.conditions.map((c, i) => (
                <div className="filter-bar" key={i}>
                  <Field label={`Condition ${i + 1} field`}>
                    <select
                      value={c.field}
                      onChange={(e) =>
                        changeCondition(i, {
                          field: e.target.value as Condition['field'],
                          operator: 'equals',
                          value: '',
                        })
                      }
                    >
                      {conditionFields.map((f) => (
                        <option key={f} value={f}>
                          {label(f)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={`Condition ${i + 1} operator`}>
                    <select
                      value={c.operator}
                      onChange={(e) =>
                        changeCondition(i, { operator: e.target.value })
                      }
                    >
                      {(['description', 'payee_name'].includes(c.field)
                        ? ['contains', 'not_contains', 'equals', 'starts_with']
                        : c.field === 'amount'
                          ? ['equals', 'greater_than', 'less_than']
                          : ['equals']
                      ).map((op) => (
                        <option key={op} value={op}>
                          {label(op)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={`Condition ${i + 1} value`}>
                    {[
                      'account_id',
                      'category_id',
                      'transaction_type',
                      'review_status',
                    ].includes(c.field) ? (
                      <select
                        required
                        value={c.value}
                        onChange={(e) =>
                          changeCondition(i, { value: e.target.value })
                        }
                      >
                        <option value="">Choose value</option>
                        {(c.field === 'account_id'
                          ? accounts.map((a) => ({ id: a.id, name: a.name }))
                          : c.field === 'category_id'
                            ? categories
                            : c.field === 'transaction_type'
                              ? ['INCOME', 'EXPENSE'].map((v) => ({
                                  id: v,
                                  name: label(v),
                                }))
                              : ['NEEDS_REVIEW', 'REVIEWED'].map((v) => ({
                                  id: v,
                                  name: label(v),
                                }))
                        ).map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        required
                        maxLength={500}
                        value={c.value}
                        onChange={(e) =>
                          changeCondition(i, { value: e.target.value })
                        }
                      />
                    )}
                  </Field>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={draft.conditions.length === 1}
                    onClick={() =>
                      update({
                        conditions: draft.conditions.filter(
                          (_, index) => i !== index,
                        ),
                      })
                    }
                  >
                    Remove condition {i + 1}
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                disabled={draft.conditions.length >= 12}
                onClick={() =>
                  update({
                    conditions: [
                      ...draft.conditions,
                      { field: 'description', operator: 'contains', value: '' },
                    ],
                  })
                }
              >
                Add condition
              </Button>
            </div>
          )}
          <h3 className="mt-4">Metadata actions</h3>
          <div className="form-grid">
            <PayeePicker
              initial={
                draft.actions.payee_id
                  ? {
                      id: draft.actions.payee_id,
                      name: valueName('payee_id', draft.actions.payee_id),
                    }
                  : null
              }
              onChange={(id) =>
                update({ actions: { ...draft.actions, payee_id: id || null } })
              }
            />
            <Field label="Set category">
              <select
                value={draft.actions.category_id ?? ''}
                onChange={(e) =>
                  update({
                    actions: {
                      ...draft.actions,
                      category_id: e.target.value || null,
                    },
                  })
                }
              >
                <option value="">No category action</option>
                {categories.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Set review status">
              <select
                value={draft.actions.review_status ?? ''}
                onChange={(e) =>
                  update({
                    actions: {
                      ...draft.actions,
                      review_status: e.target.value || null,
                    },
                  })
                }
              >
                <option value="">No review action</option>
                <option value="REVIEWED">Reviewed</option>
                <option value="NEEDS_REVIEW">Needs review</option>
              </select>
            </Field>
          </div>
          <div className="flex gap-2 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                setBusy(true)
                setError('')
                try {
                  setPreview(await previewDraft(payload(), rule?.id))
                } catch (e) {
                  setError((e as Error).message)
                } finally {
                  setBusy(false)
                }
              }}
            >
              Preview draft
            </Button>
            <Button type="submit">
              {suggestion ? 'Accept edited suggestion' : 'Save rule'}
            </Button>
            <Button type="button" variant="outline" onClick={onSaved}>
              Cancel
            </Button>
          </div>
        </fieldset>
      </form>
      {(error || write.isError) && (
        <ErrorState text={error || write.error!.message} />
      )}
      {preview && <Preview result={preview} valueName={valueName} />}
    </section>
  )
}
