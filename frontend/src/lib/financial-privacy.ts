import { createContext, useContext } from 'react'
export const FinancialPrivacyContext = createContext<{
  provided?: boolean
  hidden: boolean
  toggle: () => void
}>({
  provided: false,
  hidden: false,
  toggle: () => {},
})
export const useFinancialPrivacy = () => useContext(FinancialPrivacyContext)
