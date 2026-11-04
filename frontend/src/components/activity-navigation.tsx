import { t, ui } from '@/lib/i18n'
import { navigateTo } from '@/lib/navigation'
import { SectionNavigation } from './section-navigation'

/** Product navigation only: bank and investment tools retain separate contracts. */
export function ActivityNavigation({
  investment = false,
  tool = '',
  account = false,
  onTool,
  onTransactions,
}: {
  investment?: boolean
  tool?: string
  account?: boolean
  onTool: (tool: string) => void
  onTransactions?: () => void
}) {
  return (
    <div className="activity-navigation">
      <SectionNavigation
        label={t('transaction_workspace:transaction_views_a5570d')}
        items={
          account
            ? [['transactions', 'All Activity']]
            : [
                ['transactions', 'Transactions'],
                ['investments', 'Investment Activity'],
              ]
        }
        value={investment ? 'investments' : tool ? '' : 'transactions'}
        onChange={(next) =>
          next === 'investments'
            ? navigateTo('Investments', undefined, { view: 'Activity' })
            : onTransactions
              ? onTransactions()
              : navigateTo('Transactions')
        }
      />
      <label className="tool-select">
        {t('parity:tools')}
        <select
          aria-label={t('parity:tools')}
          value={tool}
          onChange={(e) => e.target.value && onTool(e.target.value)}
        >
          <option value="">{t('parity:tools')}</option>
          {(investment
            ? [['imports', 'Imports']]
            : account
              ? [['reconciliation', 'Reconcile']]
              : [
                  ['scheduled', 'Scheduled'],
                  ['imports', 'Imports'],
                  ['gmail', 'Gmail review'],
                  ['reconciliation', 'Reconcile'],
                ]
          ).map(([key, name]) => (
            <option key={key} value={key}>
              {ui(name)}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
