import { fireEvent, render, screen } from '@testing-library/react'
import { vi, it, expect } from 'vitest'
import { useDraftGuard } from './hooks/use-draft-guard'
import { navigateTo } from '@/lib/navigation'
function Draft({ dirty, discard }: { dirty: boolean; discard: () => void }) {
  useDraftGuard(dirty, discard)
  return <button onClick={() => navigateTo('Goals')}>Leave</button>
}
it('blocks navigation when a dirty scenario is kept and discards only after confirmation', () => {
  window.history.replaceState(null, '', '#/goals?goal=g')
  const confirm = vi.fn(() => false),
    discard = vi.fn()
  vi.stubGlobal('confirm', confirm)
  render(<Draft dirty discard={discard} />)
  fireEvent.click(screen.getByRole('button', { name: 'Leave' }))
  expect(window.location.hash).toBe('#/goals?goal=g')
  expect(discard).not.toHaveBeenCalled()
  confirm.mockReturnValue(true)
  fireEvent.click(screen.getByRole('button', { name: 'Leave' }))
  expect(window.location.hash).toBe('#/goals')
  expect(discard).toHaveBeenCalledTimes(1)
})
