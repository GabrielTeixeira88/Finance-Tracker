import type { GoalType } from '../api'
// Source creation defaults are editable form suggestions, never financial records.
export const goalTemplates: {
  type: GoalType
  titleKey: string
  descriptionKey: string
  target: string
  icon: 'Briefcase' | 'Home' | 'Car' | 'Star' | 'Wallet'
}[] = [
  {
    type: 'education',
    titleKey: 'education',
    descriptionKey: 'education',
    target: '50000',
    icon: 'Briefcase',
  },
  {
    type: 'home',
    titleKey: 'home',
    descriptionKey: 'home',
    target: '100000',
    icon: 'Home',
  },
  {
    type: 'car',
    titleKey: 'car',
    descriptionKey: 'car',
    target: '40000',
    icon: 'Car',
  },
  {
    type: 'wedding',
    titleKey: 'wedding',
    descriptionKey: 'wedding',
    target: '30000',
    icon: 'Star',
  },
  {
    type: 'custom_save_up',
    titleKey: 'custom_save_up',
    descriptionKey: 'custom_save_up',
    target: '10000',
    icon: 'Wallet',
  },
]
