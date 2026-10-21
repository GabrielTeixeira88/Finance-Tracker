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
        setRuntime(info.mode === 'local_demo' ? info : undefined)
        setReady(true)
      })
      .catch(() => {
        if (active)
          setError(
            'Unable to identify the local workspace. Start the backend and retry.',
          )
      })
    return () => {
      active = false
    }
  }, [attempt])
  const reset = async () => {
    const info = schema.parse(
      await request('/demo-control/reset', {
        method: 'POST',
        body: JSON.stringify({ confirmation: 'RESET FICTIONAL DEMO' }),
      }),
    )
    if (info.mode !== 'local_demo')
      throw new Error('Unexpected workspace response')
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
  if (!ready) return <LoadingState text="Opening local workspace…" />
  return (
    <DemoContext.Provider
      key={runtime?.generation ?? 'normal'}
      value={{ runtime, reset }}
    >
      {children}
    </DemoContext.Provider>
  )
}
