// SPDX-License-Identifier: AGPL-3.0-only
// Wealthfolio 92b4647 goal-detail-page.tsx: source header/action palette,
// metadata dialog, deletion confirmation and Save Up composition. Retirement
// branches are excluded; FastAPI remains authoritative for every amount/action.
import '../i18n'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  Page,
  PageHeader,
  PageContent,
  Skeleton,
  Button,
  Icons,
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
  Spinner,
} from '@/features/spending/ui'
import {
  ActionPalette,
  type ActionPaletteGroup,
} from '@/features/holdings/action-palette'
import { GoalEditDialog } from '../components/goal-edit-dialog'
import SaveUpDetailPage from '../save-up/components/save-up-detail'
import { getSavedGoal, useGoalWrite, goalDate } from '../api'
import { sourceGoal } from '../compat'
import { navigateTo } from '@/lib/navigation'
import { ErrorState } from '@/components/primitives'

export default function GoalDetailPage({ goalId }: { goalId: string }) {
  const { t } = useTranslation(),
    query = useQuery({
      queryKey: ['goal', goalId],
      queryFn: ({ signal }) => getSavedGoal(goalId, signal),
    }),
    write = useGoalWrite()
  const [editOpen, setEditOpen] = useState(false),
    [deleteOpen, setDeleteOpen] = useState(false),
    [actionPaletteOpen, setActionPaletteOpen] = useState(false),
    [transition, setTransition] = useState<string | null>(null)
  const goBack = () => navigateTo('Goals')
  if (query.isPending)
    return (
      <Page>
        <PageHeader heading={t('wfCommon:loading')} />
        <PageContent>
          <Skeleton className="h-64 w-full" />
        </PageContent>
      </Page>
    )
  if (query.isError)
    return (
      <Page>
        <PageHeader
          heading={t('wfGoals:detail.not_found_title')}
          onBack={goBack}
        />
        <PageContent>
          <ErrorState
            text={query.error.message}
            retry={() => void query.refetch()}
          />
          <Button onClick={goBack}>{t('wfGoals:detail.back_to_goals')}</Button>
        </PageContent>
      </Page>
    )
  const detail = query.data,
    goal = sourceGoal(detail),
    typeLabel = t('wfGoals:type.' + goal.goalType)
  if (detail.deleted)
    return (
      <Page>
        <PageHeader heading={goal.title} onBack={goBack} />
        <PageContent>
          <p>{t('goalsMigration:deleted')}</p>
          <Button onClick={goBack}>{t('wfGoals:detail.back_to_goals')}</Button>
        </PageContent>
      </Page>
    )
  const actionGroups = [
    {
      items: [
        {
          icon: Icons.Settings2,
          label: t('wfGoals:detail.edit_goal'),
          onClick: () => setEditOpen(true),
        },
        {
          icon: Icons.Target,
          label:
            detail.goal.status === 'ARCHIVED'
              ? t('goalsMigration:restore')
              : ['PAUSED', 'COMPLETED'].includes(detail.goal.status)
                ? t('goalsMigration:resume')
                : t('goalsMigration:pause'),
          onClick: () =>
            setTransition(
              ['ARCHIVED', 'PAUSED', 'COMPLETED'].includes(detail.goal.status)
                ? 'ACTIVE'
                : 'PAUSED',
            ),
        },
        {
          icon: Icons.FileArchive,
          label: t('wfGoals:edit.lifecycle_archived_label'),
          onClick: () => setTransition('ARCHIVED'),
          disabled: detail.goal.status === 'ARCHIVED',
        },
        {
          icon: Icons.Trash,
          label: t('wfGoals:detail.delete_goal'),
          onClick: () => setDeleteOpen(true),
          variant: 'destructive',
        },
      ],
    },
  ] satisfies ActionPaletteGroup[]
  return (
    <Page>
      <PageHeader
        heading={goal.title}
        text={
          goal.description
            ? t('wfGoals:detail.header_with_description', {
                type: typeLabel,
                description: goal.description,
              })
            : t('wfGoals:detail.header', { type: typeLabel })
        }
        onBack={goBack}
        className="goals-page-header"
        actions={
          <ActionPalette
            open={actionPaletteOpen}
            onOpenChange={setActionPaletteOpen}
            title={goal.title}
            groups={actionGroups}
          />
        }
      />
      <GoalEditDialog
        key={editOpen ? 'open' : 'closed'}
        detail={detail}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />
      <AlertDialog
        open={deleteOpen || transition !== null}
        onOpenChange={(open) => {
          if (!open && !write.isPending) {
            setDeleteOpen(false)
            setTransition(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteOpen
                ? t('wfGoals:detail.delete_goal')
                : transition === 'ACTIVE'
                  ? t('goalsMigration:restore')
                  : t('wfGoals:edit.status_label')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteOpen
                ? t('wfGoals:detail.delete_confirm', { title: goal.title })
                : t('goalsMigration:releaseWarning')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={write.isPending}>
              {t('wfCommon:cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={write.isPending}
              variant={deleteOpen ? 'destructive' : 'default'}
              onClick={(event) => {
                event.preventBaseUIHandler()
                const removing = deleteOpen
                write.mutate(
                  {
                    path: '/goals/' + goalId + (removing ? '' : '/status'),
                    method: removing ? 'DELETE' : 'POST',
                    data: removing
                      ? { effective_date: goalDate() }
                      : { status: transition, effective_date: goalDate() },
                  },
                  {
                    onSuccess: () => {
                      setDeleteOpen(false)
                      setTransition(null)
                      if (removing) goBack()
                    },
                  },
                )
              }}
            >
              {write.isPending ? (
                <>
                  <Spinner className="me-2 h-4 w-4" />
                  {t(
                    deleteOpen
                      ? 'wfGoals:detail.deleting'
                      : 'wfGoals:edit.saving',
                  )}
                </>
              ) : deleteOpen ? (
                t('wfCommon:delete')
              ) : (
                t('wfCommon:confirm')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
          {write.isError && <ErrorState text={write.error.message} />}
        </AlertDialogContent>
      </AlertDialog>
      <PageContent>
        {detail.warnings.map((warning) => (
          <ErrorState key={warning} text={warning} />
        ))}
        <SaveUpDetailPage overview={detail} />
      </PageContent>
    </Page>
  )
}
