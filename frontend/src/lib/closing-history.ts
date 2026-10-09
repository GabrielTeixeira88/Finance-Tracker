// Carry forward closing balances on days without ledger events; never interpolate money.
export function dailyClosingPoints(
  points: { date: string; balance: string }[],
) {
  return points.flatMap((point, index) => {
    const next = points[index + 1]
    const result = [point]
    if (!next) return result
    const day = new Date(`${point.date}T12:00:00Z`)
    day.setUTCDate(day.getUTCDate() + 1)
    while (day.toISOString().slice(0, 10) < next.date) {
      result.push({
        date: day.toISOString().slice(0, 10),
        balance: point.balance,
      })
      day.setUTCDate(day.getUTCDate() + 1)
    }
    return result
  })
}
