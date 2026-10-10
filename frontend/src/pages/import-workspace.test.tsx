import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import TransactionWorkspace from './transaction-workspace'
import type { Account } from '@/lib/api'
import type { ImportBatch } from '@/lib/ingestion-api'

const accounts: Account[] = [
  {
    id: 'a',
    name: 'Synthetic Checking',
    type: 'CHECKING',
    currency: 'BRL',
    active: true,
    balance: '5000',
    institution: null,
  },
]
const makeBatch = (): ImportBatch => ({
  id: 'batch',
  filename: 'synthetic.csv',
  source_type: 'CSV',
  account_id: 'a',
  status: 'DRAFT',
  created_at: '2026-10-10',
  completed_at: null,
  counts: { NEW: 1, ready: 1 },
  source_context: { warnings: [] },
  ready: true,
  preview_token: 'a'.repeat(64),
  incoming: '0',
  outgoing: '32.50',
  rows: [
    {
      id: 'row',
      row_number: 1,
      raw: {
        description: 'Synthetic shop',
        date: '2026-10-01',
        amount: '-32.50',
      },
      candidate: {
        transaction_date: '2026-10-01',
        description: 'Synthetic shop',
        amount: '32.50',
        currency: 'BRL',
        transaction_type: 'EXPENSE',
        payee_id: null,
        category_id: null,
        review_status: 'NEEDS_REVIEW',
        ambiguity: null,
      },
      status: 'NEW',
      errors: [] as string[],
      decision: {},
      matches: [],
      schedules: [],
      rules: [],
      reason: 'No existing candidate',
    },
  ],
})

function setup(failure = false, invalid = false, possible = false) {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  const batch = makeBatch()
  if (invalid) {
    batch.rows[0].status = 'INVALID'
    batch.rows[0].errors = ['Invalid date']
    batch.ready = false
  }
  if (possible) {
    batch.rows[0].status = 'POSSIBLE_DUPLICATE'
    batch.rows[0].matches = [
      { id: 'existing', description: 'Existing fictional shop' },
    ]
    batch.rows[0].rules = [
      {
        field: 'category_id',
        after: 'category',
        rule_name: 'Synthetic classification',
      },
    ]
    batch.ready = false
  }
  let exists = false
  const fetch = vi.fn(async (path: string, options?: RequestInit) => {
    let data: unknown = []
    if (path === '/api/demo') data = { enabled: false }
    if (path === '/api/imports/inspect')
      data = {
        headers: ['Date', 'Description', 'Amount'],
        sample: [['2026-10-01', 'Synthetic shop', '-32.50']],
      }
    if (path === '/api/imports' && options?.method === 'POST') {
      exists = true
      data = batch
    }
    if (path === '/api/imports/batch') data = batch
    if (path.includes('/rows/')) {
      batch.rows[0].decision = JSON.parse(String(options?.body))
      batch.ready = true
      data = batch
    }
    if (path.endsWith('/confirm')) {
      batch.status = 'COMPLETED'
      batch.counts = { NEW: 0, ready: 0 }
      data = batch
    }
    if (path.startsWith('/api/imports?')) data = exists ? [batch] : []
    if (failure && path === '/api/imports/inspect')
      return {
        ok: false,
        status: 422,
        json: async () => ({
          detail: 'Malformed CSV or wrong encoding/delimiter',
        }),
      }
    return {
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => structuredClone(data),
    }
  })
  vi.stubGlobal('fetch', fetch)
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false, gcTime: 0 },
            mutations: { retry: false },
          },
        })
      }
    >
      <TransactionWorkspace accounts={accounts} categories={[]} />
    </QueryClientProvider>,
  )
  return fetch
}

async function chooseFile() {
  await userEvent.click(screen.getByRole('button', { name: 'Imports' }))
  await userEvent.upload(
    screen.getByLabelText('Statement file'),
    new File(
      ['date,description,amount\n2026-10-01,Synthetic shop,-32.50'],
      'synthetic.csv',
      { type: 'text/csv' },
    ),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Inspect columns' }))
}

it('maps a local CSV, previews without posting, explicitly confirms and shows history', async () => {
  const fetch = setup()
  await chooseFile()
  await screen.findByLabelText('Map date')
  await userEvent.selectOptions(screen.getByLabelText('Map description'), '1')
  await userEvent.click(
    screen.getByRole('button', { name: 'Preview transactions' }),
  )
  await screen.findByText(/3. Review and confirm/)
  expect(fetch.mock.calls.some(([path]) => path.endsWith('/confirm'))).toBe(
    false,
  )
  expect(screen.getByRole('button', { name: 'Confirm import' })).toBeDisabled()
  await userEvent.click(
    screen.getByRole('checkbox', { name: /I confirm this statement/ }),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Confirm import' }))
  await screen.findByText(/Import summary/)
  expect(
    await screen.findByRole('button', { name: 'Open import' }),
  ).toBeInTheDocument()
  expect(
    JSON.parse(
      String(fetch.mock.calls.find(([p]) => p.endsWith('/confirm'))![1]?.body),
    ).account_confirmed,
  ).toBe(true)
})

it('retains invalid rows and requires an explicit skip', async () => {
  const fetch = setup(false, true)
  await chooseFile()
  await screen.findByLabelText('Map date')
  await userEvent.click(
    screen.getByRole('button', { name: 'Preview transactions' }),
  )
  await screen.findByText('Invalid date')
  expect(screen.getByRole('button', { name: 'Confirm import' })).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: 'Review row 1' }))
  expect(
    screen.queryByRole('option', { name: /Import as new/ }),
  ).not.toBeInTheDocument()
  await userEvent.click(
    screen.getByRole('button', { name: 'Save row decision' }),
  )
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(
        ([p, options]) =>
          p.includes('/rows/') &&
          JSON.parse(String(options?.body)).action === 'SKIP',
      ),
    ).toBe(true),
  )
})

it('shows parser failures and never confirms a failed upload', async () => {
  const fetch = setup(true)
  await chooseFile()
  expect(await screen.findByRole('alert')).toHaveTextContent('Malformed CSV')
  expect(fetch.mock.calls.some(([p]) => p.endsWith('/confirm'))).toBe(false)
  expect(
    screen.getByRole('button', { name: 'Preview transactions' }),
  ).toBeDisabled()
})

it('shows possible duplicate and rule suggestions and sends an explicit link decision', async () => {
  const fetch = setup(false, false, true)
  await chooseFile()
  await screen.findByLabelText('Map date')
  await userEvent.click(
    screen.getByRole('button', { name: 'Preview transactions' }),
  )
  await screen.findByText('possible duplicate')
  expect(
    await screen.findByText(/Rule: Synthetic classification/),
  ).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Review row 1' }))
  await userEvent.selectOptions(screen.getByLabelText('Row action'), 'LINK')
  await userEvent.selectOptions(
    screen.getByLabelText('Existing transaction'),
    'existing',
  )
  await userEvent.click(
    screen.getByRole('button', { name: 'Save row decision' }),
  )
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(
        ([p, options]) =>
          p.includes('/rows/') &&
          JSON.parse(String(options?.body)).transaction_id === 'existing',
      ),
    ).toBe(true),
  )
})
