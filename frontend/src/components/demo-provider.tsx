import { t as tr, ui } from '@/lib/i18n'
import { setPreferenceWorkspace } from '@/lib/preferences'
import { useEffect, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { request, setDemoGeneration } from '@/lib/api'
import { DemoContext, type DemoRuntime } from '@/lib/demo-runtime'
import { navigateTo } from '@/lib/navigation'
import { ErrorState, LoadingState } from './primitives'

const schema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('normal') }),
  z.object({
    mode: z.literal('local_demo'),
    profile: z.string(),
    start_date: z.string(),
    end_date: z.string(),
    generation: z.string(),
    scenario: z.string().optional(),
    scenarios: z
      .array(z.object({ id: z.string(), name: z.string() }))
      .optional(),
  }),
])

export function DemoProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient()
  const [runtime, setRuntime] = useState<DemoRuntime>()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    request('/runtime')
      .then((value) => {
        if (!active) return
        const info = schema.parse(value)
        setDemoGeneration(
          info.mode === 'local_demo' ? info.generation : undefined,
          info.mode === 'local_demo' ? info.end_date : undefined,
        )
        setPreferenceWorkspace(info.mode === 'local_demo')
        setRuntime(info.mode === 'local_demo' ? info : undefined)
        setReady(true)
      })
      .catch(() => {
        if (active)
          setError(
            tr(
              'dynamic:unable_to_identify_the_local_workspace_start_the_67c127',
            ),
          )
      })
    return () => {
      active = false
    }
  }, [attempt])
  const reset = async () => {
    await replaceRuntime(
      await request('/demo-control/reset', {
        method: 'POST',
        body: JSON.stringify({ confirmation: 'RESET FICTIONAL DEMO' }),
      }),
    )
  }
  const selectScenario = async (scenario: string) => {
    await replaceRuntime(
      await request('/demo-control/scenario', {
        method: 'POST',
        body: JSON.stringify({ scenario }),
      }),
    )
  }
  const replaceRuntime = async (value: unknown) => {
    const info = schema.parse(value)
    if (info.mode !== 'local_demo')
      throw new Error(ui('Unexpected workspace response'))
    await client.cancelQueries()
    client.clear()
    setDemoGeneration(info.generation, info.end_date)
    setRuntime(info)
    navigateTo('Overview')
  }
  if (error)
    return (
      <ErrorState
        text={error}
        retry={() => {
          setError('')
          setAttempt(attempt + 1)
        }}
      />
    )
  if (!ready)
    return (
      <LoadingState
        text={tr('demo_provider:opening_local_workspace__1684d0')}
      />
    )
  return (
    <DemoContext.Provider
      key={runtime?.generation ?? 'normal'}
      value={{ runtime, reset, selectScenario }}
    >
      {children}
    </DemoContext.Provider>
  )
}
