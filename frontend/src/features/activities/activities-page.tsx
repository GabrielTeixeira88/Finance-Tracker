// SPDX-License-Identifier: AGPL-3.0-only
// Page composition adapted from Wealthfolio 92b4647 pages/activity/activity-page.tsx.
// The native swipeable tabs/action palette wrap established local workflows, without cloud sync.
import '../holdings/i18n'
import '../holdings/migration.css'
import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { Account, Category } from '@/lib/api'
import { getAssets } from '@/lib/investments'
import { useRoute, navigateTo, readRoute } from '@/lib/navigation'
import { ErrorState, LoadingState } from '@/components/primitives'
import Transactions from '@/pages/transactions'
import { InvestmentActivities } from './investment-activities'
import { SwipablePage } from '../holdings/swipable-page'
import { ActionPalette } from '../holdings/action-palette'
import { Button } from '../holdings/ui'
import { Icons } from '@/vendor/wealthfolio/ui/components/ui/icons'
import { PortalScope } from '@/vendor/wealthfolio/ui/components/ui/portal-scope'

type Handle = { openAddForm: () => void }
export default function ActivitiesPage({
  accounts,
  categories,
  initialFilters,
  initialInvestment = false,
}: {
  accounts: Account[]
  categories: Category[]
  initialFilters?: Record<string, string>
  initialInvestment?: boolean
}) {
  const { t } = useTranslation()
  const route = useRoute()
  const investments = useRef<Handle>(null)
  const spending = useRef<Handle>(null)
  const [palette, setPalette] = useState(false)
  const requestedTab = route.params.get('tab')
  const selected =
    requestedTab === 'investments' || requestedTab === 'spending'
      ? requestedTab
      : initialInvestment
        ? 'investments'
        : 'spending'
  const isInvestment = selected === 'investments'
  const data = useQuery({
    queryKey: ['investments', 'assets'],
    queryFn: getAssets,
    enabled: isInvestment,
  })
  const groups = [
    {
      items: [
        {
          icon: Icons.Activity,
          label: t('wfActivity:add_transaction'),
          onClick: () => {
            if (isInvestment) investments.current?.openAddForm()
            else spending.current?.openAddForm()
          },
        },
        {
          icon: Icons.Import,
          label: t('wfCommon:import'),
          onClick: () =>
            isInvestment
              ? navigateTo('Investments', route.accountId, { view: 'Imports' })
              : navigateTo('Transactions', route.accountId, {
                  view: 'imports',
                }),
        },
        ...(!isInvestment
          ? [
              {
                icon: Icons.Calendar,
                label: t('labels:scheduled'),
                onClick: () =>
                  navigateTo('Transactions', route.accountId, {
                    view: 'scheduled',
                  }),
              },
              {
                icon: Icons.Mail,
                label: t('labels:gmail_review'),
                onClick: () =>
                  navigateTo('Transactions', route.accountId, {
                    view: 'gmail',
                  }),
              },
              {
                icon: Icons.CheckCircle,
                label: t('labels:reconcile'),
                onClick: () =>
                  navigateTo('Transactions', route.accountId, {
                    view: 'reconciliation',
                  }),
              },
              {
                icon: Icons.List,
                label: t('rules:transaction_rules_eafa08'),
                onClick: () =>
                  navigateTo('Settings', undefined, { view: 'rules' }),
              },
            ]
          : []),
      ],
    },
  ]
  const actions = (
    <ActionPalette
      open={palette}
      onOpenChange={setPalette}
      groups={groups}
      trigger={
        <Button size="sm">
          <Icons.Plus className="me-2 h-4 w-4" />
          {t('wfActivity:page.add_activities')}
        </Button>
      }
    />
  )
  const investmentContent = (
    <>
      {data.isError ? (
        <ErrorState
          text={data.error.message}
          retry={() => void data.refetch()}
        />
      ) : data.isPending ? (
        <LoadingState />
      ) : (
        <InvestmentActivities
          workspaceRef={investments}
          embedded
          accountId={route.accountId ?? ''}
          assetId={route.params.get('asset') ?? ''}
          accounts={accounts}
          assets={data.data}
        />
      )}
    </>
  )
  const spendingContent = (
    <Transactions
      workspaceRef={spending}
      embedded
      accounts={accounts}
      categories={categories}
      initialFilters={initialFilters}
    />
  )
  return (
    <PortalScope name="holdings-migration">
      <section className="wf-workspace" aria-label={t('wfActivity:activities')}>
        <h1 id="page-title" className="sr-only">
          {isInvestment
            ? t('investments:investment_activity_f52165')
            : t('dynamic:transactions_1e3281')}
        </h1>
        <SwipablePage
          views={[
            {
              value: 'investments',
              label: t('wfHoldings:investments'),
              icon: Icons.TrendingUp,
              content: investmentContent,
              actions,
            },
            {
              value: 'spending',
              label: t('labels:spending'),
              icon: Icons.Wallet,
              content: spendingContent,
              actions,
            },
          ]}
          defaultView={initialInvestment ? 'investments' : 'spending'}
          onViewChange={(tab) =>
            navigateTo(
              tab === 'investments' ? 'Investments' : 'Transactions',
              route.accountId,
              {
                ...Object.fromEntries(readRoute().params),
                tab,
                view: tab === 'investments' ? 'Activity' : 'activity',
              },
              true,
            )
          }
        />
      </section>
    </PortalScope>
  )
}
