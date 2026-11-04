import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { vi } from 'vitest'
import { CandidateInspector } from './candidate-inspector'

function Draft() {
  const [value, setValue] = useState('')
  return (
    <label>
      Decision reason
      <input value={value} onChange={(e) => setValue(e.target.value)} />
    </label>
  )
}

test('retains an unsaved decision when desktop inspector becomes a mobile dialog', async () => {
  let update = () => {}
  const media = {
    matches: false,
    addEventListener: (_: string, fn: () => void) => {
      update = fn
    },
    removeEventListener: vi.fn(),
  }
  vi.stubGlobal('matchMedia', () => media)
  const close = vi.fn()
  render(
    <CandidateInspector title="Synthetic candidate" onClose={close}>
      <Draft />
    </CandidateInspector>,
  )
  await userEvent.type(
    screen.getByLabelText('Decision reason'),
    'Keep exact source identity',
  )
  act(() => {
    media.matches = true
    update()
  })
  expect(
    screen.getByRole('dialog', { name: 'Synthetic candidate' }),
  ).toBeVisible()
  expect(screen.getByLabelText('Decision reason')).toHaveValue(
    'Keep exact source identity',
  )
  act(() => {
    media.matches = false
    update()
  })
  expect(screen.getByLabelText('Decision reason')).toHaveValue(
    'Keep exact source identity',
  )
  expect(close).not.toHaveBeenCalled()
})
