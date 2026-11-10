// SPDX-License-Identifier: AGPL-3.0-only
// Wealthfolio 92b4647 goal-edit-dialog.tsx: original metadata/status card form.
// Existing local lifecycle values and one atomic metadata mutation replace provider updates.
import '../i18n'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GoalDetail } from '@/lib/wealth-api'
import { cn } from '@/lib/utils'
import { sourceGoal } from '../compat'
import { useGoalWrite, goalDate } from '../api'
import {
  Button,
  Input,
  Label,
  Badge,
  Icons,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/spending/ui'
import { Textarea } from '@/vendor/wealthfolio/ui/components/ui/textarea'
import { ErrorState } from '@/components/primitives'
export function GoalEditDialog({
  detail,
  open,
  onClose,
}: {
  detail: GoalDetail
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation(),
    goal = sourceGoal(detail),
    updateMutation = useGoalWrite()
  const [title, setTitle] = useState(goal.title),
    [description, setDescription] = useState(goal.description),
    [lifecycle, setLifecycle] = useState(detail.goal.status)
  const trimmedTitle = title.trim()
  const goalTypeLabels = Object.fromEntries(
    ['education', 'home', 'car', 'wedding', 'custom_save_up'].map((type) => [
      type,
      t('wfGoals:edit.type_' + type),
    ]),
  )
  const lifecycleOptions = [
    {
      value: 'ACTIVE' as const,
      label: t('wfGoals:edit.lifecycle_active_label'),
      hint: t('wfGoals:edit.lifecycle_active_hint'),
      description: t('wfGoals:edit.lifecycle_active_description'),
      icon: Icons.Target,
    },
    {
      value: 'PAUSED' as const,
      label: t('goalsMigration:paused'),
      hint: t('goalsMigration:paused'),
      description: t('goalsMigration:pauseNote'),
      icon: Icons.Clock,
    },
    {
      value: 'COMPLETED' as const,
      label: t('goalsMigration:completed'),
      hint: t('wfGoals:edit.lifecycle_achieved_hint'),
      description: t('goalsMigration:completionNote'),
      icon: Icons.CheckCircle,
    },
    {
      value: 'ARCHIVED' as const,
      label: t('wfGoals:edit.lifecycle_archived_label'),
      hint: t('wfGoals:edit.lifecycle_archived_hint'),
      description: t('goalsMigration:releaseWarning'),
      icon: Icons.FileArchive,
    },
  ]
  const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!trimmedTitle || updateMutation.isPending) return
    updateMutation.mutate(
      {
        path: '/goals/' + goal.id + '/metadata',
        method: 'PATCH',
        data: {
          name: trimmedTitle,
          notes: description.trim(),
          status: lifecycle,
          effective_date: goalDate(),
        },
      },
      { onSuccess: onClose },
    )
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose()
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={handleSave} className="space-y-6">
          <DialogHeader>
            <DialogTitle>{t('wfGoals:edit.title')}</DialogTitle>
            <DialogDescription>
              {t('wfGoals:edit.description')}{' '}
              {t('goalsMigration:releaseWarning')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="bg-muted/30 rounded-xl border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {t('wfGoals:edit.goal_type')}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {t('wfGoals:edit.goal_type_hint')}
                  </p>
                </div>
                <Badge variant="secondary">
                  {goalTypeLabels[goal.goalType]}
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="goal-title">
                {t('wfGoals:edit.title_label')}
              </Label>
              <Input
                id="goal-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t('wfGoals:edit.title_placeholder')}
                maxLength={120}
                required
                autoFocus
              />
              {!trimmedTitle && (
                <p className="text-destructive text-xs">
                  {t('wfGoals:edit.title_required')}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="goal-description">
                {t('wfGoals:edit.notes_label')}
              </Label>
              <Textarea
                id="goal-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t('wfGoals:edit.notes_placeholder')}
                rows={3}
                maxLength={2000}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('wfGoals:edit.status_label')}</Label>
              <p className="text-muted-foreground text-xs">
                {t('wfGoals:edit.status_hint')}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {lifecycleOptions.map((option) => {
                  const selected = lifecycle === option.value
                  const Icon = option.icon

                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setLifecycle(option.value)}
                      className={cn(
                        'rounded-xl border p-4 text-start transition-colors',
                        'focus-visible:ring-ring focus:outline-none focus-visible:ring-2',
                        selected
                          ? 'border-primary bg-primary/5'
                          : 'border-border/70 bg-card hover:bg-accent',
                      )}
                    >
                      <span className="mb-3 flex items-center gap-2">
                        <span
                          className={cn(
                            'bg-muted inline-flex h-8 w-8 items-center justify-center rounded-full',
                            option.value === 'COMPLETED' && 'text-success',
                            option.value === 'ACTIVE' && 'text-primary',
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="text-muted-foreground text-2xs font-medium tracking-wider uppercase">
                          {option.hint}
                        </span>
                      </span>
                      <span className="block text-sm font-medium">
                        {option.label}
                      </span>
                      <span className="text-muted-foreground mt-1.5 block text-xs leading-relaxed">
                        {option.description}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {updateMutation.isError && (
            <ErrorState text={updateMutation.error.message} />
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('wfCommon:cancel')}
            </Button>
            <Button
              type="submit"
              disabled={updateMutation.isPending || !trimmedTitle}
            >
              {updateMutation.isPending
                ? t('wfGoals:edit.saving')
                : t('wfGoals:edit.save_changes')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
