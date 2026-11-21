import './i18n'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/vendor/wealthfolio/ui/components/ui/dialog'

it('preserves an exact unsubmitted financial draft and input identity across viewport changes', async () => {
  vi.stubGlobal('innerWidth', 1440)
  render(
    <Dialog defaultOpen>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Recorded asset draft</DialogTitle>
          <DialogDescription>Unsubmitted exact values</DialogDescription>
        </DialogHeader>
        <label>
          Name
          <input defaultValue="" />
        </label>
        <label>
          Exact value
          <input defaultValue="" />
        </label>
      </DialogContent>
    </Dialog>,
  )
  const name = await screen.findByRole('textbox', { name: 'Name' })
  const value = screen.getByRole('textbox', { name: 'Exact value' })
  fireEvent.change(name, { target: { value: 'Unsubmitted asset' } })
  fireEvent.change(value, { target: { value: '9007199254740993,123456' } })
  for (const width of [390, 1920]) {
    await act(async () => {
      vi.stubGlobal('innerWidth', width)
      window.dispatchEvent(new Event('resize'))
    })
    expect(screen.getByRole('textbox', { name: 'Name' })).toBe(name)
    expect(name).toHaveValue('Unsubmitted asset')
    expect(screen.getByRole('textbox', { name: 'Exact value' })).toBe(value)
    expect(value).toHaveValue('9007199254740993,123456')
  }
})
