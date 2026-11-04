import { decimalUnits } from '@/lib/money'
import { t as tr } from '@/lib/i18n'

function width(spent: string, total: string) {
  const s = decimalUnits(spent),
    t = decimalUnits(total)
  if (t <= 0n) return s > 0n ? 100 : 0
  const p = (s * 10000n) / t
  return Number(p < 0n ? 0n : p > 10000n ? 10000n : p) / 100
}
export function BudgetProgress({
  spent,
  available,
}: {
  spent: string
  available: string
}) {
  const over = decimalUnits(spent) > decimalUnits(available)
  return (
    <div
      className={`spending-progress ${over ? 'over' : ''}`}
      role="img"
      aria-label={
        over
          ? tr('dynamic:spending_over_target_8b524c')
          : tr('dynamic:spending_progress_7ae049')
      }
    >
      <span style={{ width: `${width(spent, available)}%` }} />
    </div>
  )
}
