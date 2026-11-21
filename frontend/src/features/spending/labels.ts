import type { TFunction } from 'i18next'
/** Never translate user-created category/group names as application copy. */
export const getCategoryLabel = (
  _t: TFunction,
  _taxonomy: string,
  _id: string,
  name: string,
) => name
export const getBudgetGroupLabel = (_t: TFunction, _id: string, name: string) =>
  name
