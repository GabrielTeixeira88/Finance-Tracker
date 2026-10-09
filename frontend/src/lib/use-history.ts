import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDemo, getHistory, localDate, type Period } from './api'

export function useHistory(initialPeriod: Period = '1Y') {
  const demo = useQuery({
    queryKey: ['demo'],
    queryFn: ({ signal }) => getDemo(signal),
  })
  const [period, setPeriod] = useState<Period>(initialPeriod)
  const [chosenEnd, setChosenEnd] = useState<string>()
  const end =
    chosenEnd ?? (demo.data?.enabled ? demo.data.end_date : localDate())
  const result = useQuery({
    queryKey: ['history', period, end],
    queryFn: ({ signal }) => getHistory(period, end, signal),
    enabled: demo.isSuccess,
  })
  const [chosenCurrency, setCurrency] = useState<string>()
  const series =
    result.data?.series.find((s) => s.currency === chosenCurrency) ??
    result.data?.series[0]
  function moveMonth(delta: number) {
    const date = new Date(`${end}T12:00:00`)
    const target = new Date(date.getFullYear(), date.getMonth() + delta + 1, 0)
    setChosenEnd(
      `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`,
    )
  }
  return {
    demo,
    period,
    setPeriod,
    end,
    moveMonth,
    result,
    series,
    setCurrency,
  }
}
