export const defaultSidebarOrder = [
  'Dashboard',
  'Accounts',
  'Activities',
  'Holdings',
  'Insights',
  'Goals',
  'Settings',
] as const
export type SidebarItem = (typeof defaultSidebarOrder)[number]
export function normalizeSidebarOrder(value: unknown): SidebarItem[] {
  const valid = Array.isArray(value)
    ? value.filter(
        (id): id is SidebarItem =>
          typeof id === 'string' &&
          defaultSidebarOrder.includes(id as SidebarItem),
      )
    : []
  return [...new Set([...valid, ...defaultSidebarOrder])]
}
export function moveSidebarItem(
  order: readonly SidebarItem[],
  item: SidebarItem,
  direction: -1 | 1,
): SidebarItem[] {
  const result = normalizeSidebarOrder(order)
  const index = result.indexOf(item),
    next = index + direction
  if (index >= 0 && next >= 0 && next < result.length)
    [result[index], result[next]] = [result[next], result[index]]
  return result
}
