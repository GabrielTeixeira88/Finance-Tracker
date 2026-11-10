// Adapted from Wealthfolio 92b4647 lib/row-click.test.tsx; see THIRD_PARTY_NOTICES.md.
import { fireEvent, render, screen } from '@testing-library/react'
import { createPortal } from 'react-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { isRowBodyClick } from './activity-compat'
import { Checkbox } from './spending/ui'

afterEach(() => window.getSelection()?.removeAllRanges())

function renderRow(onEdit: () => void, onSelect = vi.fn()) {
  render(
    <table>
      <tbody>
        <tr onClick={(event) => isRowBodyClick(event) && onEdit()}>
          <td>Row content</td>
          <td data-row-click-ignore>
            <Checkbox
              aria-label="Select transaction"
              onCheckedChange={onSelect}
            />
            <span>Beside checkbox</span>
          </td>
          <td>
            <button type="button">Row action</button>
          </td>
          <td>{createPortal(<div>Portalled action</div>, document.body)}</td>
        </tr>
      </tbody>
    </table>,
  )
  return onSelect
}

it('selects with the actual native checkbox without also opening the transaction editor', () => {
  const edit = vi.fn()
  const select = renderRow(edit)
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select transaction' }))
  expect(select).toHaveBeenCalledOnce()
  expect(edit).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText('Beside checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Row action' }))
  fireEvent.click(screen.getByText('Portalled action'))
  expect(edit).not.toHaveBeenCalled()
})

it('opens plain row content but preserves text selection', () => {
  const edit = vi.fn()
  renderRow(edit)
  const content = screen.getByText('Row content')
  fireEvent.click(content)
  expect(edit).toHaveBeenCalledOnce()
  window.getSelection()?.selectAllChildren(content)
  fireEvent.click(content)
  expect(edit).toHaveBeenCalledOnce()
})
