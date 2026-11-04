import { createContext, useContext } from 'react'

export type DemoRuntime = {
  mode: 'local_demo'
  profile: string
  start_date: string
  end_date: string
  generation: string
  scenario?: string
  scenarios?: { id: string; name: string }[]
}
export const DemoContext = createContext<{
  runtime?: DemoRuntime
  reset?: () => Promise<void>
  selectScenario?: (scenario: string) => Promise<void>
}>({})
export const useDemoRuntime = () => useContext(DemoContext)
