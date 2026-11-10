// SPDX-License-Identifier: AGPL-3.0-only
// Page structure from Wealthfolio 92b4647 activity/import/activity-import-page.tsx.
// Existing bounded local CSV/OFX preview/decision/confirmation services are preserved.
import '../../holdings/i18n'
import '../../holdings/migration.css'
import { useTranslation } from 'react-i18next'
import type { Account, Category } from '@/lib/api'
import { navigateTo, useRoute } from '@/lib/navigation'
import ImportWorkspace from '@/pages/import-workspace'
import BrokerageImports from '@/pages/investment-imports'
import { Page, PageHeader, PageContent } from '../../holdings/ui'
import { PortalScope } from '@/vendor/wealthfolio/ui/components/ui/portal-scope'
export default function ImportPage({
  investment = false,
  accounts,
  categories,
  accountId,
}: {
  investment?: boolean
  accounts: Account[]
  categories: Category[]
  accountId?: string
}) {
  const { t } = useTranslation()
  const route = useRoute()
  const scope = accountId ?? route.accountId
  return (
    <PortalScope name="holdings-migration">
      <section className="wf-workspace">
        <Page>
          <PageHeader
            onBack={() =>
              navigateTo(investment ? 'Investments' : 'Transactions', scope, {
                view: investment ? 'Activity' : 'activity',
              })
            }
            heading={t(
              investment
                ? 'investment_imports:brokerage_csv_imports_e1171b'
                : 'import_workspace:imports_e42328',
            )}
          />
          <PageContent>
            <div className="space-y-4">
              {investment ? (
                <BrokerageImports
                  embedded
                  accounts={accounts}
                  initialAccount={scope}
                />
              ) : (
                <ImportWorkspace
                  embedded
                  accounts={accounts}
                  categories={categories}
                  initialAccount={scope}
                />
              )}
            </div>
          </PageContent>
        </Page>
      </section>
    </PortalScope>
  )
}
