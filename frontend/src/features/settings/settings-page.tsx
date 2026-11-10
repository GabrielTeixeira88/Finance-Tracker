import { settingsLink } from './settings-navigation'
// SPDX-License-Identifier: AGPL-3.0-only
// Source hierarchy adapted from Wealthfolio 92b4647 pages/settings; local APIs remain authoritative.
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useDemoRuntime } from '@/lib/demo-runtime'
import { resetAppearance } from '@/lib/preferences'
import { useRoute, navigateTo } from '@/lib/navigation'
import { localDate, type Account, type Category } from '@/lib/api'
import Appearance from '@/pages/appearance'
import { Accounts, CategorySettings } from './management-components'
import { PayeeSettings } from '@/pages/payees'
import { Rules } from '@/pages/rules'
import { MarketDataSettings } from '@/pages/market-data'
import { GmailSettings } from '@/pages/gmail'
import { PluggySettings } from '@/pages/pluggy'
import { DemoScenarios } from '@/components/demo-experience'
import { FixedIndex } from '@/components/fixed-subscription'
import { Button } from '@/components/ui/button'
import { ErrorState, LoadingState } from '@/components/primitives'
import { getAbout } from './api'
import { SettingsLayout, SettingsHeader } from './settings-layout'
import { GeneralSettings } from './general'
import { GroupsSettings } from './groups'
import { ExportsSettings } from './exports'
import { SecuritiesSettings } from './securities'

function SpendingSettings({
  accounts,
  categories,
}: {
  accounts: Account[]
  categories: Category[]
}) {
  const { t } = useTranslation('settings_v014')
  const cards = [
    [
      'spending_accounts',
      'spending_accounts_help',
      () => settingsLink('accounts'),
      accounts.filter((account) => account.active).length,
    ],
    [
      'budgets',
      'budget_help',
      () => navigateTo('Budget', undefined, { view: 'Budgets', setup: 'true' }),
      undefined,
    ],
    [
      'categories',
      'classification_help',
      () => settingsLink('categories'),
      categories.length,
    ],
    ['payees', 'classification_help', () => settingsLink('payees'), undefined],
    ['rules', 'spending_help', () => settingsLink('rules'), undefined],
    [
      'events',
      'event_help',
      () => navigateTo('Budget', undefined, { view: 'Life Events' }),
      undefined,
    ],
  ] as const
  return (
    <>
      <SettingsHeader title={t('spending')} description={t('spending_help')} />
      <div className="settings-overview-grid">
        {cards.map(([title, description, action, count]) => (
          <section className="source-settings-card" key={title}>
            <h2>{t(title)}</h2>
            <p>{t(description)}</p>
            {count !== undefined && (
              <strong className="settings-overview-count">{count}</strong>
            )}
            <Button variant="outline" onClick={action}>
              {t('manage')}
            </Button>
          </section>
        ))}
      </div>
    </>
  )
}
function AboutSettings() {
  const { t } = useTranslation('settings_v014')
  const query = useQuery({ queryKey: ['settings', 'about'], queryFn: getAbout })
  return (
    <>
      <SettingsHeader title={t('about')} />
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState
          text={query.error.message}
          retry={() => void query.refetch()}
        />
      ) : (
        <section className="source-settings-card">
          <h2>{query.data.name}</h2>
          <dl className="settings-information">
            {(['version', 'database', 'deployment'] as const).map((key) => (
              <div key={key}>
                <dt>{t(key)}</dt>
                <dd>{query.data[key]}</dd>
              </div>
            ))}
          </dl>
          <p>
            <a href={query.data.repository} target="_blank" rel="noreferrer">
              {t('repository')}
            </a>
          </p>
          <p>{query.data.license}</p>
          <p>{t('owner_copyright')}</p>
          <p>{t('rights_notice')}</p>
          <p>
            <a
              href="/licenses/SOURCE_ACCESS.md"
              target="_blank"
              rel="noreferrer"
            >
              {t('source_access')}
            </a>
          </p>
          <a href="/licenses/" target="_blank" rel="noreferrer">
            {t('licenses')}
          </a>
        </section>
      )}
    </>
  )
}
export function Settings({
  accounts,
  categories,
}: {
  accounts: Account[]
  categories: Category[]
}) {
  const { t } = useTranslation('settings_v014')
  const { runtime } = useDemoRuntime()
  const route = useRoute()
  const view = route.params.get('view') || 'index'
  let content
  switch (view) {
    case 'index':
    case 'general':
      content = <GeneralSettings />
      break
    case 'appearance':
      content = (
        <>
          <SettingsHeader
            title={t('appearance')}
            description={t('appearance_detail')}
          >
            <Button variant="outline" onClick={resetAppearance}>
              {t('reset_appearance_f5546d', { ns: 'appearance' })}
            </Button>
          </SettingsHeader>
          <Appearance embedded />
        </>
      )
      break
    case 'accounts':
      content = (
        <Accounts
          accounts={accounts}
          navigate={(page, id) => navigateTo(page, id)}
        />
      )
      break
    case 'groups':
      content = <GroupsSettings accounts={accounts} />
      break
    case 'spending':
      content = <SpendingSettings accounts={accounts} categories={categories} />
      break
    case 'categories':
      content = <CategorySettings categories={categories} />
      break
    case 'payees':
      content = <PayeeSettings />
      break
    case 'rules':
      content = (
        <>
          <SettingsHeader title={t('rules')} />
          <Rules accounts={accounts} categories={categories} />
        </>
      )
      break
    case 'securities':
      content = <SecuritiesSettings />
      break
    case 'classifications':
      content = (
        <>
          <SettingsHeader
            title={t('classifications')}
            description={t('classification_help')}
          />
          <div className="settings-tabs">
            <Button
              variant="outline"
              onClick={() => settingsLink('categories')}
            >
              {t('category_config')}
            </Button>
          </div>
          <SecuritiesSettings classifications />
        </>
      )
      break
    case 'exports':
      content = <ExportsSettings />
      break
    case 'market':
      content =
        route.params.get('action') === 'record-index' ? (
          <FixedIndex
            asOf={route.params.get('end') || localDate()}
            index={route.params.get('index') ?? 'CDI'}
          />
        ) : runtime ? (
          <>
            <SettingsHeader title={t('market')} description={t('cache_help')} />
            <p>{t('general_demo')}</p>
            <Button
              variant="outline"
              onClick={() => settingsLink('securities')}
            >
              {t('quotes')}
            </Button>
          </>
        ) : (
          <MarketDataSettings />
        )
      break
    case 'gmail':
      content = runtime ? (
        <>
          <SettingsHeader title="Gmail" description={t('connection_help')} />
          <DemoScenarios settings />
        </>
      ) : (
        <GmailSettings accounts={accounts} />
      )
      break
    case 'pluggy':
      content = runtime ? (
        <>
          <SettingsHeader title="Pluggy" description={t('connection_help')} />
          <p>{t('pluggy:demo_disabled', { ns: 'pluggy' })}</p>
        </>
      ) : (
        <PluggySettings accounts={accounts} />
      )
      break
    case 'about':
      content = <AboutSettings />
      break
    case 'previews':
      content = (
        <>
          <SettingsHeader title={t('about')} />
          <Button variant="outline" onClick={() => navigateTo('Reports')}>
            Reports
          </Button>
        </>
      )
      break
    default:
      content = (
        <>
          <SettingsHeader title={t('title')} />
          <Button onClick={() => settingsLink('general')}>
            {t('general')}
          </Button>
        </>
      )
  }
  return <SettingsLayout view={view}>{content}</SettingsLayout>
}
