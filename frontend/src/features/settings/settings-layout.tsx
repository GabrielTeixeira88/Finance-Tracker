// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Wealthfolio 92b4647 settings-layout.tsx, sidebar-nav.tsx and settings-header.tsx.
import './i18n'
import './settings.css'
import type { ReactNode } from 'react'
import { useLayoutEffect, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  ChevronRight,
  Settings2,
  Monitor,
  CreditCard,
  Folder,
  Wallet,
  BadgeDollarSign,
  Blocks,
  Download,
  BarChart3,
  Mail,
  Cable,
  Info,
  type LucideIcon,
} from 'lucide-react'
import { settingsLink } from './settings-navigation'

const sections = [
  [
    'preferences',
    [
      ['general', Settings2],
      ['appearance', Monitor],
    ],
  ],
  [
    'finance',
    [
      ['accounts', CreditCard],
      ['groups', Folder],
      ['spending', Wallet],
    ],
  ],
  [
    'data',
    [
      ['securities', BadgeDollarSign],
      ['classifications', Blocks],
      ['exports', Download],
    ],
  ],
  [
    'connections',
    [
      ['market', BarChart3],
      ['gmail', Mail],
      ['pluggy', Cable],
    ],
  ],
  ['about', [['about', Info]]],
] as const
export function SettingsHeader({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children?: ReactNode
}) {
  return (
    <header className="source-settings-header">
      <div>
        <div>
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
      </div>
      {children}
    </header>
  )
}
function Item({
  id,
  icon: Icon,
  active,
}: {
  id: string
  icon: LucideIcon
  active: boolean
}) {
  const { t } = useTranslation('settings_v014')
  const title = id === 'gmail' ? 'Gmail' : id === 'pluggy' ? 'Pluggy' : t(id)
  return (
    <a
      href={`#/settings?view=${id}`}
      onClick={(event) => {
        if (
          !event.ctrlKey &&
          !event.metaKey &&
          !event.shiftKey &&
          !event.altKey &&
          event.button === 0
        ) {
          event.preventDefault()
          settingsLink(id)
        }
      }}
      aria-current={active ? 'page' : undefined}
      className="source-settings-link"
    >
      <Icon size={16} aria-hidden="true" />
      <span>{title}</span>
      <ChevronRight className="settings-mobile-chevron" size={16} />
    </a>
  )
}
export function SettingsLayout({
  view,
  children,
}: {
  view: string
  children: ReactNode
}) {
  const { t } = useTranslation('settings_v014')
  const selected = [
    'categories',
    'payees',
    'rules',
    'events',
    'budgets',
  ].includes(view)
    ? 'spending'
    : view === 'index'
      ? 'general'
      : view
  useLayoutEffect(() => {
    // A long Appearance editor must not leave the next section's header off screen.
    if (window.scrollY)
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    const main = document.getElementById('main-content')
    if (main?.scrollTop) main.scrollTop = 0
  }, [view])
  const compact = useSyncExternalStore(
    (listener) => {
      const media = window.matchMedia('(max-width: 1023px)')
      media.addEventListener('change', listener)
      return () => media.removeEventListener('change', listener)
    },
    () => window.matchMedia('(max-width: 1023px)').matches,
    () => false,
  )
  return (
    <div
      className={`settings-migration ${view === 'index' ? 'settings-index' : ''}`}
    >
      <div className="settings-root-title">
        <h2>{t('title')}</h2>
      </div>
      <div className="source-settings-columns">
        <aside className="source-settings-sidebar">
          <nav aria-label={t('title')}>
            {sections.map(([heading, items]) => (
              <section key={heading}>
                <h3>{t(heading)}</h3>
                <div>
                  {items.map(([id, icon]) => (
                    <Item
                      key={id}
                      id={id}
                      icon={icon}
                      active={selected === id}
                    />
                  ))}
                </div>
              </section>
            ))}
          </nav>
        </aside>
        {!(compact && view === 'index') && (
          <div className="source-settings-content">
            <button
              className="settings-mobile-back"
              onClick={() => settingsLink('index')}
              aria-label={t('back')}
            >
              <ArrowLeft size={20} />
            </button>
            {children}
          </div>
        )}
      </div>
    </div>
  )
}
