import { DetailDrawer } from '@/components/detail-drawer'
import { t as tr } from '@/lib/i18n'
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
        <h2>{tr('rules:transaction_rules_eafa08')}</h2>
        <Button
          onClick={() => {
            setEditor({})
            setPreview(undefined)
          }}
        >
          {tr('rules:create_rule_69c3ac')}
        </Button>
      </div>
      <p className="metadata">
        {tr('rules:lower_priority_numbers_run_first_manual_choices__a5cc95')}
      </p>
      <div className="filter-bar">
        <Field label={tr('rules:search_rules_d6162b')}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
        <Field label={tr('rules:rule_status_9f01fa')}>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">{tr('rules:all_rules_f0e38d')}</option>
            <option value="enabled">{tr('rules:enabled_df174a')}</option>
            <option value="disabled">{tr('rules:disabled_f4f447')}</option>
          </select>
        </Field>
      </div>
      {editor && (
        <DetailDrawer
          title={tr('rules:transaction_rules_eafa08')}
          onClose={() => setEditor(undefined)}
        >
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
        </DetailDrawer>
      )}
      {rules.isPending ? (
        <LoadingState text={tr('rules:loading_rules__10065d')} />
      ) : rules.isError ? (
        <ErrorState
          text={tr('rules:unable_to_load_rules_d56e06')}
          retry={() => void rules.refetch()}
        />
      ) : (
        <>
          {!rules.data.length && (
            <EmptyState
              title={tr('rules:no_rules_yet_2a1ac5')}
              detail={tr(
                'rules:create_a_narrow_rule_and_preview_its_effect_befo_343a32',
              )}
            />
          )}
          {!!rules.data.length && !visibleRules.length && (
            <EmptyState
              title={tr('rules:no_matching_rules_266dab')}
              detail={tr('rules:change_the_search_or_status_filter__45c28e')}
            />
          )}
          {visibleRules.map((rule) => (
            <div className="automation-row" key={rule.id}>
              <div>
                <strong>{rule.name}</strong>
                <p className="metadata">
                  {rule.enabled
                    ? tr('dynamic:enabled_df174a')
                    : tr('dynamic:disabled_f4f447')}{' '}
                  {tr('rules:_priority_96469a')} {rule.priority} ·{' '}
                  {rule.match_mode}
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
                  aria-label={tr('messages:message_f8d9f06aa37b', {
                    value0: rule.name,
                  })}
                  onClick={() => setEditor({ rule })}
                >
                  {tr('rules:edit_530164')}
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
                  {rule.enabled
                    ? tr('dynamic:disable_9a7d4e')
                    : tr('dynamic:enable_20063a')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void inspect(rule)}
                >
                  {tr('rules:preview_history_53df55')}
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
                  {tr('rules:duplicate_972d57')}
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
                  {tr('rules:delete_f6fdbe')}
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
            {tr('rules:apply_previewed_changes_3a75e2')}
          </Button>
        </>
      )}
      {(error || write.isError) && (
        <ErrorState text={error || write.error!.message} />
      )}
      {feedback && <p role="status">{feedback}</p>}
      <h2 className="mt-6">{tr('rules:suggested_automation_d75f1b')}</h2>
      <p className="metadata">
        {tr('rules:suggestions_come_from_consistent_explicit_correc_f1ad8f')}
      </p>
      {suggestions.isPending ? (
        <LoadingState text={tr('rules:loading_suggestions__886bd1')} />
      ) : suggestions.isError ? (
        <ErrorState
          text={tr('rules:unable_to_load_suggestions_af53ee')}
          retry={() => void suggestions.refetch()}
        />
      ) : (
        <>
          {!suggestions.data.some((s) => s.status === 'PENDING') && (
            <EmptyState title={tr('rules:no_pending_suggestions_6f26fc')} />
          )}
          {suggestions.data.map((s) => (
            <div className="automation-row" key={s.id}>
              <div>
                <strong>{s.name}</strong>
                <p>
                  {s.support_count}{' '}
                  {tr('rules:distinct_corrected_transactions__1127aa')}{' '}
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
                    {tr('rules:accept_bb54db')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setEditor({ suggestion: s })}
                  >
                    {tr('rules:edit_suggestion_01f1cf')}
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
                    {tr('rules:dismiss_70afe9')}
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
      <h3>{tr('rules:rule_preview_no_changes_saved_b8b138')}</h3>
      <p>
        {result.match_count} {tr('rules:matches__6ab392')} {result.change_count}{' '}
        {tr('rules:would_change__7422b3')} {result.skipped_fields}{' '}
        {tr('rules:fields_skipped_d36e02')}{' '}
      </p>
      <p className="metadata">
        {tr('rules:up_to_50_representative_matches_higher_priority__8f6082')}
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
                  {valueName(a.field, a.before) ||
                    tr('dynamic:unassigned_e57016')}{' '}
                  → {valueName(a.field, a.after)}
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
          ? tr('dynamic:edit_suggested_rule_d35b32')
          : rule
            ? tr('dynamic:edit_rule_1f53b2')
            : tr('dynamic:create_rule_69c3ac')}
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
            <Field label={tr('rules:rule_name_9e84d7')}>
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
              <Field label={tr('rules:description_contains_020eae')}>
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
            {tr('rules:advanced_conditions_and_priority_8ad8b8')}
          </Button>
          {advanced && (
            <div className="advanced-fields">
              <div className="form-grid">
                <Field label={tr('rules:priority_886cbf')}>
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
                <Field label={tr('rules:match_mode_97c46f')}>
                  <select
                    value={draft.match_mode}
                    onChange={(e) =>
                      update({ match_mode: e.target.value as 'ALL' | 'ANY' })
                    }
                  >
                    <option value="ALL">
                      {tr('rules:all_conditions_771ea0')}
                    </option>
                    <option value="ANY">
                      {tr('rules:any_condition_424666')}
                    </option>
                  </select>
                </Field>
                <Field label={tr('rules:rule_enabled_5b1cf1')}>
                  <input
                    type="checkbox"
                    checked={draft.enabled}
                    onChange={(e) => update({ enabled: e.target.checked })}
                  />
                </Field>
              </div>
              {draft.conditions.map((c, i) => (
                <div className="filter-bar" key={i}>
                  <Field
                    label={tr('messages:message_f7a60143c2b2', {
                      value0: i + 1,
                    })}
                  >
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
                  <Field
                    label={tr('messages:message_391a282cfd9b', {
                      value0: i + 1,
                    })}
                  >
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
                  <Field
                    label={tr('messages:message_873b14191460', {
                      value0: i + 1,
                    })}
                  >
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
                        <option value="">
                          {tr('rules:choose_value_fc65ad')}
                        </option>
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
                    {' '}
                    {tr('rules:remove_condition_858fb1')} {i + 1}
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
                {tr('rules:add_condition_42fe69')}
              </Button>
            </div>
          )}
          <h3 className="mt-4">{tr('rules:metadata_actions_a71185')}</h3>
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
            <Field label={tr('rules:set_category_d8b3fe')}>
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
                <option value="">
                  {tr('rules:no_category_action_e70d62')}
                </option>
                {categories.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={tr('rules:set_review_status_00dfb8')}>
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
                <option value="">{tr('rules:no_review_action_6b5c6c')}</option>
                <option value="REVIEWED">{tr('rules:reviewed_31ef85')}</option>
                <option value="NEEDS_REVIEW">
                  {tr('rules:needs_review_33a506')}
                </option>
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
              {tr('rules:preview_draft_7997b9')}
            </Button>
            <Button type="submit">
              {suggestion
                ? tr('dynamic:accept_edited_suggestion_ab86a4')
                : tr('dynamic:save_rule_9e1aa5')}
            </Button>
            <Button type="button" variant="outline" onClick={onSaved}>
              {tr('rules:cancel_77dfd2')}
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
