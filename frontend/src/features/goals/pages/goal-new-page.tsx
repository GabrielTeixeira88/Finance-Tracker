// SPDX-License-Identifier: AGPL-3.0-only
// Wealthfolio 92b4647 goal-new-page.tsx: source template selection, form/card JSX
// and create/open flow. Retirement is excluded by decision; exact inputs and
// explicit local tracking/currency replace upstream provider assumptions.
import '../i18n'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGoalWrite, goalDate } from '../api'
import { goalTemplates } from '../lib/templates'
import { GoalLeverRow } from '../components/goal-lever-row'
import { navigateTo } from '@/lib/navigation'
import { decimalUnits } from '@/lib/money'
import { Field } from '@/components/forms'
import { ErrorState } from '@/components/primitives'
import {
  Page,
  PageHeader,
  PageContent,
  Button,
  Icons,
} from '@/features/spending/ui'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  cardSurfaceClassName,
} from '@/vendor/wealthfolio/ui/components/ui/card'
import { Input } from '@/vendor/wealthfolio/ui/components/ui/input'
import { Label } from '@/vendor/wealthfolio/ui/components/ui/label'
import { Textarea } from '@/vendor/wealthfolio/ui/components/ui/textarea'
import { DatePickerInput } from '@/vendor/wealthfolio/ui/components/ui/date-picker-input'
import { formatDateISO } from '@/features/spending/lib/calendar-adapter'
import { goalDetailSchema } from '@/lib/wealth-api'

export default function GoalNewPage({
  defaultCurrency = 'BRL',
}: {
  defaultCurrency?: string
}) {
  const { t } = useTranslation(),
    write = useGoalWrite()
  const [selectedType, setSelectedType] = useState<string | null>(null),
    [title, setTitle] = useState(''),
    [description, setDescription] = useState(''),
    [targetAmount, setTargetAmount] = useState('0'),
    [targetDate, setTargetDate] = useState(''),
    [monthly, setMonthly] = useState('0'),
    [currency, setCurrency] = useState(defaultCurrency),
    [mode, setMode] = useState('ACCOUNT'),
    [start, setStart] = useState(goalDate())
  const template = goalTemplates.find((row) => row.type === selectedType)
  const label = (key: string) => t('wfGoals:new.template_' + key + '_title')
  const select = (type: string) => {
    const row = goalTemplates.find((row) => row.type === type)
    if (!row) return
    setSelectedType(type)
    setTitle(label(row.titleKey))
    setDescription(
      t('wfGoals:new.template_' + row.descriptionKey + '_description'),
    )
    setTargetAmount(row.target)
    setTargetDate('')
  }
  const valid = Boolean(
    title.trim() &&
    /^[A-Z]{3}$/.test(currency) &&
    start <= goalDate() &&
    (!targetDate || targetDate >= start),
  )
  return (
    <Page>
      <PageHeader
        heading={t('wfGoals:new.create_goal')}
        text={t('wfGoals:new.subtitle')}
        onBack={() => navigateTo('Goals')}
        className="goals-page-header"
      />
      <PageContent>
        {!selectedType ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {goalTemplates.map((tmpl) => {
              const Icon = Icons[tmpl.icon]
              return (
                <button
                  type="button"
                  key={tmpl.type}
                  className={`${cardSurfaceClassName} group overflow-hidden text-start transition-all hover:border-border cursor-pointer hover:shadow-md`}
                  onClick={() => select(tmpl.type)}
                >
                  <div className="relative h-36 overflow-hidden sm:h-40">
                    <img
                      src={'/goal-covers/' + tmpl.type + '.png'}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute start-4 bottom-3">
                      <p className="text-base font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
                        {label(tmpl.titleKey)}
                      </p>
                    </div>
                  </div>
                  <CardHeader className="pb-4">
                    <CardDescription className="text-xs leading-relaxed">
                      <Icon className="mb-2 h-5 w-5" />
                      {t(
                        'wfGoals:new.template_' +
                          tmpl.descriptionKey +
                          '_description',
                      )}
                    </CardDescription>
                  </CardHeader>
                </button>
              )
            })}
          </div>
        ) : (
          <form
            className="mx-auto max-w-2xl space-y-6"
            aria-label={t('wfGoals:new.create_goal')}
            onSubmit={(event) => {
              event.preventDefault()
              if (!valid || write.isPending || !template) return
              write.mutate(
                {
                  path: '/goals',
                  data: {
                    name: title.trim(),
                    notes: description.trim(),
                    target: targetAmount,
                    deadline: targetDate || null,
                    currency,
                    mode,
                    start_date: start,
                    monthly,
                    goal_type: template.type,
                  },
                },
                {
                  onSuccess: (result) => {
                    const created =
                      goalDetailSchema.shape.goal.safeParse(result)
                    if (created.success)
                      navigateTo(
                        'Goals',
                        undefined,
                        { goal: created.data.id },
                        true,
                      )
                  },
                },
              )
            }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-full">
                    <Icons.Target className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      {template && label(template.titleKey)}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {template &&
                        t(
                          'wfGoals:new.template_' +
                            template.descriptionKey +
                            '_description',
                        )}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="goal-title">
                      {t('wfGoals:new.title_label')}
                    </Label>
                    <Input
                      id="goal-title"
                      value={title}
                      maxLength={120}
                      onChange={(event) => setTitle(event.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="goal-description">
                      {t('wfGoals:new.description_label')}
                    </Label>
                    <Textarea
                      id="goal-description"
                      value={description}
                      maxLength={2000}
                      rows={3}
                      onChange={(event) => setDescription(event.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <GoalLeverRow
                      label={t('wfGoals:new.target_amount')}
                      value={targetAmount}
                      onChange={setTargetAmount}
                      max="100000"
                      step="100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('wfGoals:new.target_date')}</Label>
                    <DatePickerInput
                      aria-label={t('wfGoals:new.target_date')}
                      value={targetDate || undefined}
                      onChange={(day) =>
                        setTargetDate(day ? formatDateISO(day) : '')
                      }
                    />
                  </div>
                  <Field label={t('goals:start_date_ff99f5')}>
                    <input
                      type="date"
                      value={start}
                      max={goalDate()}
                      onChange={(event) => setStart(event.target.value)}
                      required
                    />
                  </Field>
                  <Field label={t('goals:tracking_mode_b9fcd9')}>
                    <select
                      value={mode}
                      onChange={(event) => setMode(event.target.value)}
                    >
                      <option value="ACCOUNT">
                        {t('dynamic:account_allocations_ab4965')}
                      </option>
                      <option value="MANUAL">
                        {t('dynamic:manual_contributions_fa9467')}
                      </option>
                    </select>
                  </Field>
                  <Field label={t('goals:currency_e070de')}>
                    <input
                      value={currency}
                      pattern="[A-Z]{3}"
                      required
                      maxLength={3}
                      onChange={(event) =>
                        setCurrency(event.target.value.toUpperCase())
                      }
                    />
                  </Field>
                  <div className="text-muted-foreground sm:col-span-2 text-xs leading-relaxed">
                    {t('wfGoals:new.funding_hint')}
                  </div>
                  <details className="sm:col-span-2">
                    <summary className="text-sm">
                      {t('wfGoals:save_up.monthly_plan')}
                    </summary>
                    <GoalLeverRow
                      label={t('wfGoals:save_up.field_monthly_contribution')}
                      value={monthly}
                      onChange={setMonthly}
                      max="5000"
                      step="25"
                    />
                  </details>
                </div>
              </CardContent>
            </Card>
            {write.isError && <ErrorState text={write.error.message} />}
            {!valid && (
              <p role="alert" className="text-destructive text-sm">
                {t('goalsMigration:invalidGoal')}
              </p>
            )}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setSelectedType(null)}
                disabled={write.isPending}
              >
                {t('wfCommon:back')}
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={
                  write.isPending || !valid || decimalUnits(targetAmount) < 0n
                }
              >
                {write.isPending
                  ? t('wfGoals:new.creating')
                  : t('wfGoals:new.create_goal')}
              </Button>
            </div>
          </form>
        )}
      </PageContent>
    </Page>
  )
}
