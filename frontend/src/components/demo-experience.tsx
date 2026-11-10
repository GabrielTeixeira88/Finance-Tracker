import { isSimulatedInvestmentScenario } from '@/lib/demo-runtime'
import { t as tr, ui } from '@/lib/i18n'
import { useState } from 'react'
import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { useDemoRuntime } from '@/lib/demo-runtime'
import { navigateTo, useRoute } from '@/lib/navigation'
import { request } from '@/lib/api'
import type { Page } from './app-shell'
import { Button } from './ui/button'
import { ErrorState, PageHeader } from './primitives'
import { RealMarketDemo } from './real-market-demo'

function tourStops(): {
  page: Page
  view?: string
  title: string
  detail: string
}[] {
  return [
    {
      page: 'Overview',
      title: tr('tour:your_fictional_financial_life_60965b'),
      detail: tr(
        'tour:explore_alex_morgan_s_october_2024_september_202_b5dedf',
      ),
    },
    {
      page: 'Transactions',
      title: tr('tour:review_a_transaction_a36a9f'),
      detail: tr(
        'tour:search_for_cedar_open_a_transaction_change_its_c_114ab1',
      ),
    },
    {
      page: 'Budget',
      title: tr('tour:follow_spending_targets_2ded3e'),
      detail: tr(
        'tour:compare_monthly_targets_with_actual_spending_sho_6627e1',
      ),
    },
    {
      page: 'Investments',
      title: tr('tour:inspect_holdings_58c457'),
      detail: tr(
        'tour:three_brokerage_accounts_use_fictional_instrumen_1e1a53',
      ),
    },
    {
      page: 'Performance',
      title: tr('tour:compare_returns_ee9953'),
      detail: tr(
        'tour:choose_a_period_and_inspect_twr_xirr_and_coverag_cc9b18',
      ),
    },
    {
      page: 'Investments',
      view: 'Fixed Income',
      title: tr('fixed_income:compare_cdb'),
      detail: tr('fixed_income:compare_guide'),
    },
    {
      page: 'Investments',
      view: 'Fixed Income',
      title: tr('fixed_income:inspect_selic'),
      detail: tr('fixed_income:selic_guide'),
    },
    {
      page: 'Transactions',
      view: 'imports',
      title: tr('tour:import_a_fictional_statement_8ed923'),
      detail: tr(
        'tour:use_demo_scenarios_below_to_prepare_a_csv_ofx_pr_64c484',
      ),
    },
    {
      page: 'Transactions',
      view: 'reconciliation',
      title: tr('tour:one_purchase_two_sources_45bd92'),
      detail: tr(
        'tour:a_fictional_85_brl_grocery_purchase_has_gmail_no_61043e',
      ),
    },
    {
      page: 'Net Worth',
      title: tr('tour:see_assets_and_debts_together_dd8cec'),
      detail: tr(
        'tour:inspect_dated_property_vehicle_and_debt_observat_ca54e7',
      ),
    },
    {
      page: 'Goals',
      title: tr('tour:explore_goals_then_make_it_yours_2ba80b'),
      detail: tr(
        'tour:goals_allocate_existing_savings_without_creating_9cb985',
      ),
    },
  ]
}

export function DemoExperience() {
  const stops = tourStops()
  const { runtime, reset } = useDemoRuntime()
  const [step, setStep] = useState<number | null>(null)
  const [scenarios, setScenarios] = useState(false)
  const pending = useIsMutating()
  const action = useMutation({
    mutationFn: async () => {
      await reset?.()
    },
  })
  if (!runtime) return null
  const go = (index: number) => {
    setStep(index)
    const stop = stops[index]
    navigateTo(stop.page, undefined, stop.view ? { view: stop.view } : {})
  }
  return (
    <aside
      className="demo-experience"
      aria-label={tr('demo_experience:fictional_demo_controls_d38e52')}
    >
      <details className="demo-menu">
        <summary>{ui('Demo')}</summary>
        <div className="demo-menu-content">
          <div className="flex flex-wrap items-center gap-3">
            <strong className="text-sm">
              {tr('demo_experience:fictional_local_demo_4848ab')}
            </strong>
            <span className="metadata">
              {runtime.profile} {runtime.end_date}
            </span>
            <div className="ml-auto flex flex-wrap gap-2">
              {(runtime.scenario ?? 'synthetic') === 'synthetic' && (
                <Button variant="ghost" size="sm" onClick={() => go(0)}>
                  {tr('demo_experience:guided_tour_5a0d30')}
                </Button>
              )}
              {(runtime.scenario ?? 'synthetic') === 'synthetic' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setScenarios(!scenarios)}
                >
                  {tr('demo_experience:demo_scenarios_85b9bc')}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={pending > 0}
                onClick={() => {
                  if (
                    window.confirm(
                      tr(
                        'dynamic:reset_this_fictional_demo_all_demo_edits_will_be_c96a26',
                      ),
                    )
                  )
                    action.mutate()
                }}
              >
                {action.isPending
                  ? tr('dynamic:resetting__6d27dc')
                  : tr('dynamic:reset_demo_e5d736')}
              </Button>
            </div>
          </div>
        </div>
      </details>
      {action.isError && <ErrorState text={action.error.message} />}
      {step !== null && (
        <div className="demo-tour" aria-live="polite">
          <div>
            <span className="metadata">
              {' '}
              {tr('demo_experience:tour_cd9e8f')} {step + 1} / {stops.length}
            </span>
            <h2 className="text-sm font-medium">{stops[step].title}</h2>
            <p className="metadata mt-1 max-w-3xl">{stops[step].detail}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setStep(null)}>
              {tr('demo_experience:skip_tour_57bc79')}
            </Button>
            {step > 0 && (
              <Button size="sm" variant="outline" onClick={() => go(step - 1)}>
                {tr('demo_experience:previous_50f942')}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                step === stops.length - 1 ? setStep(null) : go(step + 1)
              }
            >
              {step === stops.length - 1
                ? tr('dynamic:finish_tour_cee41f')
                : tr('dynamic:next_bc9819')}
            </Button>
          </div>
        </div>
      )}
      {scenarios && (runtime.scenario ?? 'synthetic') === 'synthetic' && (
        <DemoScenarios />
      )}
    </aside>
  )
}

/** Keep historical provenance after the financial page, with unchanged route scope. */
export function HistoricalDemoFooter() {
  const { page, params } = useRoute()
  const { runtime } = useDemoRuntime()
  if (
    runtime?.scenario !== 'unified' &&
    isSimulatedInvestmentScenario(runtime?.scenario) &&
    page === 'Investments' &&
    params.get('view') === 'Income'
  )
    return (
      <footer className="demo-market-footer mt-8">
        <SimulatedDemoNotice />
      </footer>
    )
  if (
    !['real-market-br', 'unified'].includes(runtime?.scenario ?? '') ||
    !['Investments', 'Performance'].includes(page)
  )
    return null
  return (
    <footer className="demo-market-footer mt-8">
      <p className="metadata" role="status">
        {tr(
          runtime?.scenario === 'unified'
            ? 'demo_context:unified_disclosure'
            : 'real_market:disclosure',
        )}
      </p>
      <RealMarketDemo />
    </footer>
  )
}

export function DemoScenarios({ settings = false }: { settings?: boolean }) {
  const client = useQueryClient()
  const { runtime } = useDemoRuntime()
  const action = useMutation({
    mutationFn: async (kind: string) =>
      request(`/demo-control/${kind}`, { method: 'POST' }),
    onSuccess: async (result, kind) => {
      await client.invalidateQueries()
      navigateTo('Transactions', undefined, {
        view: kind === 'notification' ? 'gmail' : 'imports',
        ...(kind === 'notification' ? {} : { batch: String(result.batch_id) }),
      })
    },
  })
  if (
    ['real-market-br', 'unified'].includes(runtime?.scenario ?? '') ||
    isSimulatedInvestmentScenario(runtime?.scenario)
  )
    return null
  return (
    <section className="demo-scenarios">
      {settings && (
        <PageHeader
          title={tr('demo_experience:gmail_notification_simulation_cf5d19')}
          description={tr(
            'demo_experience:fictional_messages_pass_through_the_real_parser__4759b2',
          )}
        />
      )}
      <p className="metadata mb-3">
        {tr(
          'demo_experience:synthetic_examples_only_previews_require_explici_e67c62',
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={action.isPending}
          onClick={() => action.mutate('notification')}
        >
          {tr('demo_experience:simulate_gmail_notification_ffbf4f')}
        </Button>
        {['demo-checking.csv', 'demo-credit-card.csv', 'demo-checking.ofx'].map(
          (name) => (
            <span key={name} className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={action.isPending}
                onClick={() => action.mutate(`sample/${name}`)}
              >
                {' '}
                {tr('demo_experience:preview_f1fbb2')} {name}
              </Button>
              <a
                className="text-xs underline"
                href={`/api/demo-control/files/${name}`}
                download
                aria-label={tr('messages:message_316d33da8523', {
                  value0: name,
                })}
              >
                {tr('demo_experience:download_a479c9')}
              </a>
            </span>
          ),
        )}
      </div>
      {action.isError && <ErrorState text={action.error.message} />}
    </section>
  )
}

function SimulatedDemoNotice() {
  const { runtime } = useDemoRuntime()
  if (!runtime) return null
  return (
    <p className="metadata" role="status">
      {tr('charts:simulated')}
    </p>
  )
}
