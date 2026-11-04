import { canonicalRoute, workspaceRoute } from './route-aliases'

it.each([
  ['overview', '', 'dashboard', 'view=spending', 'spending', 'Overview'],
  [
    'spending',
    'view=Budgets',
    'dashboard',
    'view=spending&detail=budget',
    'spending',
    'Budgets',
  ],
  [
    'spending',
    'view=Life+Events',
    'dashboard',
    'view=spending&detail=insights&stage=when',
    'spending',
    'Life Events',
  ],
  [
    'investments',
    '',
    'dashboard',
    'view=investments',
    'investments',
    'Overview',
  ],
  ['investments', 'view=Holdings', 'holdings', '', 'investments', 'Holdings'],
  [
    'investments',
    'view=Fixed+Income',
    'holdings',
    'type=fixed-income',
    'investments',
    'Fixed Income',
  ],
  [
    'investments',
    'view=Allocation',
    'insights',
    'view=overview',
    'investments',
    'Allocation',
  ],
  [
    'performance',
    '',
    'insights',
    'view=performance',
    'investments',
    'Performance',
  ],
  [
    'investments',
    'view=Income',
    'insights',
    'view=income',
    'investments',
    'Income',
  ],
  [
    'investments',
    'view=Activity',
    'activities',
    'view=investment-activity',
    'investments',
    'Activity',
  ],
  [
    'investments',
    'view=Imports',
    'activities',
    'tool=imports&kind=investment',
    'investments',
    'Imports',
  ],
  [
    'transactions',
    'view=imports',
    'activities',
    'tool=imports&kind=bank',
    'transactions',
    'imports',
  ],
  [
    'transactions',
    'view=gmail',
    'activities',
    'tool=gmail',
    'transactions',
    'gmail',
  ],
  [
    'transactions',
    'view=scheduled',
    'activities',
    'tool=scheduled',
    'transactions',
    'scheduled',
  ],
  [
    'transactions',
    '',
    'activities',
    'view=transactions',
    'transactions',
    'activity',
  ],
])(
  'round trips %s %s through its canonical product destination',
  (oldPath, search, path, query, workspace, view) => {
    const route = canonicalRoute(oldPath, new URLSearchParams(search))
    expect(route.path).toBe(path)
    expect(route.params.toString()).toBe(query)
    const restored = workspaceRoute(route.path, route.params)
    expect(restored.path).toBe(workspace)
    expect(restored.params.get('view')).toBe(view)
  },
)

it('preserves exact filter values and entity scope without changing its input', () => {
  const params = new URLSearchParams({
    amount_min: '9007199254740993.123456',
    account: 'a/b',
    search: 'Synthetic & Co',
    view: 'activity',
  })
  const before = params.toString()
  const route = canonicalRoute('transactions', params)
  const restored = workspaceRoute(route.path, route.params)
  expect(restored.params.toString()).toBe(before)
  expect(params.toString()).toBe(before)
})

it('retains focused statement bookmarks and legacy reconciliation state', () => {
  const route = canonicalRoute(
    'transactions',
    new URLSearchParams(
      'view=reconciliation&reconcile=statements&statement=synthetic-id',
    ),
  )
  expect(route.path).toBe('activities')
  expect(route.params.get('section')).toBe('statements')
  const restored = workspaceRoute(route.path, route.params)
  expect(restored.params.get('reconcile')).toBe('statements')
  expect(restored.params.get('statement')).toBe('synthetic-id')
})

it('keeps reports explicitly under Settings previews and manual wealth under Dashboard', () => {
  const reports = canonicalRoute('reports', new URLSearchParams())
  expect(reports.path).toBe('settings')
  expect(reports.params.get('preview')).toBe('reports')
  expect(workspaceRoute(reports.path, reports.params).path).toBe('reports')
  const wealth = canonicalRoute(
    'net-worth',
    new URLSearchParams('position=synthetic-id'),
  )
  expect(wealth.path).toBe('dashboard')
  expect(
    workspaceRoute(wealth.path, wealth.params).params.get('position'),
  ).toBe('synthetic-id')
})

it('defaults missing or invalid Dashboard modes to Spending', () => {
  for (const query of ['', 'view=unknown']) {
    expect(workspaceRoute('dashboard', new URLSearchParams(query)).path).toBe(
      'spending',
    )
  }
})
