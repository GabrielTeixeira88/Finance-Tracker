/** Canonical product URLs adapted to the existing workspace contracts.
 * Keep financial filter strings opaque: this layer never parses money or dates.
 */
export function workspaceRoute(path: string, input: URLSearchParams) {
  const params = new URLSearchParams(input)
  const view = params.get('view')
  if (path === 'dashboard') {
    if (view === 'investments') {
      params.set('view', 'Overview')
      return { path: 'investments', params }
    }
    if (view === 'net-worth') {
      params.set(
        'view',
        params.get('detail') === 'assets'
          ? 'Assets'
          : params.get('detail') === 'liabilities'
            ? 'Liabilities'
            : 'Overview',
      )
      return { path: 'net-worth', params }
    }
    const detail = params.get('detail')
    params.set(
      'view',
      detail === 'budget'
        ? 'Budgets'
        : detail === 'insights'
          ? params.get('stage') === 'when'
            ? 'Life Events'
            : 'Insights'
          : 'Overview',
    )
    return { path: 'spending', params }
  }
  if (path === 'activities') {
    const tool = params.get('tool')
    if (tool === 'imports' && params.get('kind') === 'investment') {
      params.set('view', 'Imports')
      return { path: 'investments', params }
    }
    if (!tool && view === 'investment-activity') {
      params.set('view', 'Activity')
      return { path: 'investments', params }
    }
    params.set(
      'view',
      ['scheduled', 'imports', 'gmail', 'reconciliation'].includes(tool ?? '')
        ? tool!
        : 'activity',
    )
    if (tool === 'reconciliation' && params.has('section')) {
      params.set('reconcile', params.get('section')!)
    }
    return { path: 'transactions', params }
  }
  if (path === 'holdings') {
    params.set(
      'view',
      params.get('type') === 'fixed-income' ? 'Fixed Income' : 'Holdings',
    )
    return { path: 'investments', params }
  }
  if (path === 'insights') {
    params.set(
      'view',
      view === 'income'
        ? 'Income'
        : view === 'performance'
          ? 'Performance'
          : 'Allocation',
    )
    return { path: 'investments', params }
  }
  if (
    path === 'settings' &&
    view === 'previews' &&
    params.get('preview') === 'reports'
  ) {
    return { path: 'reports', params }
  }
  if (path === 'overview' || path === '') {
    params.set('view', 'Overview')
    return { path: 'spending', params }
  }
  return { path, params }
}

/** Generate one canonical destination while preserving scope and exact filters. */
export function canonicalRoute(path: string, input: URLSearchParams) {
  const params = new URLSearchParams(input)
  const view = params.get('view')
  if (path === 'overview' || path === 'spending') {
    params.set('view', 'spending')
    params.delete('detail')
    if (view === 'Budgets') params.set('detail', 'budget')
    if (view === 'Insights' || view === 'Life Events') {
      params.set('detail', 'insights')
      if (view === 'Life Events') params.set('stage', 'when')
      else if (params.get('stage') === 'when') params.set('stage', 'where')
    }
    return { path: 'dashboard', params }
  }
  if (path === 'net-worth') {
    if (view === 'Assets' || view === 'Liabilities')
      params.set('detail', view.toLowerCase())
    else params.delete('detail')
    params.set('view', 'net-worth')
    return { path: 'dashboard', params }
  }
  if (path === 'performance' || path === 'investments') {
    params.delete('tool')
    params.delete('kind')
    params.delete('type')
    switch (path === 'performance' ? 'Performance' : (view ?? 'Overview')) {
      case 'Performance':
      case 'Allocation':
      case 'Income':
        params.set(
          'view',
          path === 'performance' || view === 'Performance'
            ? 'performance'
            : view === 'Income'
              ? 'income'
              : 'overview',
        )
        return { path: 'insights', params }
      case 'Holdings':
      case 'Fixed Income':
        params.delete('view')
        if (view === 'Fixed Income') params.set('type', 'fixed-income')
        return { path: 'holdings', params }
      case 'Activity':
        params.set('view', 'investment-activity')
        return { path: 'activities', params }
      case 'Imports':
        params.delete('view')
        params.set('tool', 'imports')
        params.set('kind', 'investment')
        return { path: 'activities', params }
      case 'Accounts':
        params.delete('view')
        return { path: 'accounts', params }
      default:
        params.set('view', 'investments')
        return { path: 'dashboard', params }
    }
  }
  if (path === 'transactions') {
    params.delete('tool')
    params.delete('kind')
    if (
      ['scheduled', 'imports', 'gmail', 'reconciliation'].includes(view ?? '')
    ) {
      params.delete('view')
      params.set('tool', view!)
      if (view === 'imports') params.set('kind', 'bank')
      if (view === 'reconciliation' && params.has('reconcile')) {
        params.set('section', params.get('reconcile')!)
        params.delete('reconcile')
      }
    } else params.set('view', 'transactions')
    return { path: 'activities', params }
  }
  if (path === 'reports') {
    params.set('view', 'previews')
    params.set('preview', 'reports')
    return { path: 'settings', params }
  }
  return { path, params }
}
