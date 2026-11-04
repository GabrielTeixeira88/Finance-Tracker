import { act, renderHook, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, it, expect } from 'vitest'
import { useChartMotion, useMotionPolicy } from './motion'
import { MotionProvider } from '@/components/motion-provider'
import { SectionNavigation } from '@/components/section-navigation'

function preference(initial: boolean) {
  let reduced = initial
  const listeners = new Set<() => void>()
  vi.stubGlobal('matchMedia', () => ({
    get matches() {
      return reduced
    },
    addEventListener: (_: string, listener: () => void) =>
      listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) =>
      listeners.delete(listener),
  }))
  return (next: boolean) =>
    act(() => {
      reduced = next
      listeners.forEach((notify) => notify())
    })
}

it('stops chart interpolation immediately when the system preference changes, and restores it on opt-in', () => {
  const update = preference(false)
  const { result, unmount } = renderHook(useChartMotion)
  expect(result.current).toMatchObject({
    isAnimationActive: true,
    animationDuration: 300,
    animationEasing: 'ease-out',
  })
  update(true)
  expect(result.current.isAnimationActive).toBe(false)
  update(false)
  expect(result.current.isAnimationActive).toBe(true)
  unmount()
  update(true)
})

it('disables spatial motion from the first render for reduced-motion users', () => {
  preference(true)
  expect(renderHook(useMotionPolicy).result.current).toBe(true)
  expect(renderHook(useChartMotion).result.current.isAnimationActive).toBe(
    false,
  )
})

it('uses a safe static fallback when the environment cannot report a motion preference', () => {
  vi.stubGlobal('matchMedia', undefined)
  expect(renderHook(useMotionPolicy).result.current).toBe(true)
})

it('keeps selection indicators decorative and independent while retaining keyboard activation', async () => {
  preference(true)
  const onChange = vi.fn()
  render(
    <MotionProvider>
      <SectionNavigation
        label="First section"
        items={[
          ['one', 'One'],
          ['two', 'Two'],
        ]}
        value="one"
        onChange={onChange}
      />
      <SectionNavigation
        label="Second section"
        items={[
          ['a', 'Alpha'],
          ['b', 'Beta'],
        ]}
        value="b"
        onChange={vi.fn()}
      />
    </MotionProvider>,
  )
  expect(document.querySelectorAll('.motion-selection')).toHaveLength(2)
  document
    .querySelectorAll('.motion-selection')
    .forEach((el) => expect(el).toHaveAttribute('aria-hidden', 'true'))
  const second = screen.getByRole('button', { name: 'Two' })
  second.focus()
  await userEvent.keyboard('{Enter}')
  expect(onChange).toHaveBeenCalledWith('two')
  expect(screen.getByRole('button', { name: 'One' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  expect(screen.getByRole('button', { name: 'Beta' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})
