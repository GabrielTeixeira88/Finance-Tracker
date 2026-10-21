import { createContext, useContext } from 'react'

export type DemoRuntime = {
  mode: 'local_demo'
  profile: string
  start_date: string
  end_date: string
  generation: string
}
export const DemoContext = createContext<{
  runtime?: DemoRuntime
  reset?: () => Promise<void>
}>({})
export const useDemoRuntime = () => useContext(DemoContext)
