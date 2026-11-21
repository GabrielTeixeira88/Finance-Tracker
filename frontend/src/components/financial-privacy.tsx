import { useContext, useMemo, useState, type ReactNode } from 'react'

import { FinancialPrivacyContext } from '@/lib/financial-privacy'

/** Display-only, temporary masking. Never mutates queries or financial data. */
export function FinancialPrivacy({ children }: { children: ReactNode }) {
  const parent = useContext(FinancialPrivacyContext)
  const [hidden, setHidden] = useState(false)
  const value = useMemo(
    () => ({ provided: true, hidden, toggle: () => setHidden((v) => !v) }),
    [hidden],
  )
  if (parent.provided) return children
  return (
    <FinancialPrivacyContext.Provider value={value}>
      {children}
    </FinancialPrivacyContext.Provider>
  )
}
