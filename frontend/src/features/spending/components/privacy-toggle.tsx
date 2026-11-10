import { Eye, EyeOff } from 'lucide-react'
import { useFinancialPrivacy } from '@/lib/financial-privacy'
import { useTranslation } from 'react-i18next'
export function PrivacyToggle() {
  const { hidden, toggle } = useFinancialPrivacy(),
    { t } = useTranslation()
  const Icon = hidden ? EyeOff : Eye
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={hidden}
      aria-label={t('spendingMigration:hideBalances')}
      className="text-muted-foreground hover:text-foreground rounded-full p-2"
    >
      <Icon size={16} />
    </button>
  )
}
