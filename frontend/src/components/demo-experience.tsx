import { useState } from 'react'
import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { useDemoRuntime } from '@/lib/demo-runtime'
import { navigateTo } from '@/lib/navigation'
import { request } from '@/lib/api'
import type { Page } from './app-shell'
import { Button } from './ui/button'
import { ErrorState, PageHeader } from './primitives'

const stops: { page: Page; view?: string; title: string; detail: string }[] = [
  {
    page: 'Overview',
    title: 'Your fictional financial life',
    detail:
      'Explore Alex Morgan’s October 2024–September 2026 history. Values come from the real ledger. You can edit this separate local workspace.',
  },
  {
    page: 'Transactions',
    title: 'Review a transaction',
    detail:
      'Search for Cedar, open a transaction, change its category or review status. Payee names preserve the original description.',
  },
  {
    page: 'Budget',
    title: 'Follow spending targets',
    detail:
      'Compare monthly targets with actual spending. Shopping and travel carry signed rollover; try another month.',
  },
  {
    page: 'Investments',
    title: 'Inspect holdings',
    detail:
      'Three brokerage accounts use fictional instruments and dated synthetic prices. Activities reconstruct both cash and positions.',
  },
  {
    page: 'Performance',
    title: 'Compare returns',
    detail:
      'Choose a period and inspect TWR, XIRR and coverage. The synthetic benchmark is explicitly a price proxy, not a total-return index.',
  },
  {
    page: 'Transactions',
    view: 'imports',
    title: 'Import a fictional statement',
    detail:
      'Use Demo scenarios below to prepare a CSV/OFX preview. Review new, duplicate and ambiguous rows before confirming; previews never post.',
  },
  {
    page: 'Transactions',
    view: 'reconciliation',
    title: 'One purchase, two sources',
    detail:
      'A fictional 85 BRL grocery purchase has Gmail notification and OFX evidence. It counts once. Select Cash to inspect a completed historical statement.',
  },
  {
    page: 'Net Worth',
    title: 'See assets and debts together',
    detail:
      'Inspect dated property, vehicle and debt observations alongside ledger cash and holdings. Missing coverage stays visible.',
  },
  {
    page: 'Goals',
    title: 'Explore goals, then make it yours',
    detail:
      'Goals allocate existing savings without creating assets. Try an edit, then Reset demo to restore the baseline. Gmail simulation is available in Settings.',
  },
]

export function DemoExperience() {
  const { runtime, reset } = useDemoRuntime()
  const [step, setStep] = useState<number | null>(0)
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
    <aside className="demo-experience" aria-label="Fictional demo controls">
      <div className="flex flex-wrap items-center gap-3">
        <strong className="text-sm">Fictional local demo</strong>
        <span className="metadata">
          {runtime.profile} · Sep 2026 · Separate local data
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => go(0)}>
            Guided tour
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setScenarios(!scenarios)}
          >
            Demo scenarios
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pending > 0}
            onClick={() => {
              if (
                window.confirm(
                  'Reset this fictional demo? All demo edits will be replaced by the original dataset. Normal financial data is untouched.',
                )
              )
                action.mutate()
            }}
          >
            {action.isPending ? 'Resetting…' : 'Reset demo'}
          </Button>
        </div>
      </div>
      {action.isError && <ErrorState text={action.error.message} />}
      {step !== null && (
        <div className="demo-tour" aria-live="polite">
          <div>
            <span className="metadata">
              Tour {step + 1} / {stops.length}
            </span>
            <h2 className="text-sm font-medium">{stops[step].title}</h2>
            <p className="metadata mt-1 max-w-3xl">{stops[step].detail}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setStep(null)}>
              Skip tour
            </Button>
            {step > 0 && (
              <Button size="sm" variant="outline" onClick={() => go(step - 1)}>
                Previous
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                step === stops.length - 1 ? setStep(null) : go(step + 1)
              }
            >
              {step === stops.length - 1 ? 'Finish tour' : 'Next'}
            </Button>
          </div>
        </div>
      )}
      {scenarios && <DemoScenarios />}
    </aside>
  )
}

export function DemoScenarios({ settings = false }: { settings?: boolean }) {
  const client = useQueryClient()
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
  return (
    <section className="demo-scenarios">
      {settings && (
        <PageHeader
          title="Gmail Notification Simulation"
          description="Fictional messages pass through the real parser and review workflow. Gmail is not connected. No credentials or network access are used."
        />
      )}
      <p className="metadata mb-3">
        Synthetic examples only. Previews require explicit review and
        confirmation. Repeating the notification retains its source identity.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={action.isPending}
          onClick={() => action.mutate('notification')}
        >
          Simulate Gmail notification
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
                Preview {name}
              </Button>
              <a
                className="text-xs underline"
                href={`/api/demo-control/files/${name}`}
                download
                aria-label={`Download ${name}`}
              >
                Download
              </a>
            </span>
          ),
        )}
      </div>
      {action.isError && <ErrorState text={action.error.message} />}
    </section>
  )
}
