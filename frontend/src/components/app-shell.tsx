import { t as tr, ui } from '@/lib/i18n'
import { usePreferences, setPreferences } from '@/lib/preferences'
// Adapted frontend source; provenance and license: THIRD_PARTY_NOTICES.md.
// SPDX-License-Identifier: AGPL-3.0-only
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { m, useAnimationControls } from 'motion/react'
import { SelectionIndicator } from './selection-indicator'
import { fadeTransition, layoutSpring, useMotionPolicy } from '@/lib/motion'
import {
  ChartNoAxesCombined,
  Gauge,
  Landmark,
  ListFilter,
  Menu,
  Moon,
  Sun,
  Settings,
  X,
  BriefcaseBusiness,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Target,
} from 'lucide-react'
import type { PreviewPage } from '@/pages/previews'
import { navigateTo, useRoute } from '@/lib/navigation'

export type Page =
  | 'Overview'
  | 'Accounts'
  | 'Transactions'
  | 'Settings'
  | 'Account'
  | 'Budget'
  | 'Investments'
  | 'Goals'
  | PreviewPage
export type Navigate = (page: Page, accountId?: string) => void
const primary = [
  { page: 'Budget', label: 'Dashboard', icon: Gauge, view: undefined },
  { page: 'Accounts', label: 'Accounts', icon: Landmark, view: undefined },
  {
    page: 'Transactions',
    label: 'Activities',
    icon: ListFilter,
    view: undefined,
  },
  {
    page: 'Investments',
    label: 'Holdings',
    icon: BriefcaseBusiness,
    view: 'Holdings',
  },
  {
    page: 'Investments',
    label: 'Insights',
    icon: ChartNoAxesCombined,
    view: 'Allocation',
  },
  { page: 'Goals', label: 'Goals', icon: Target, view: undefined },
  { page: 'Settings', label: 'Settings', icon: Settings, view: undefined },
] as const
const destinations = [
  ['Reports preview', 'Reports', ''],
  ['Rules', 'Settings', 'rules'],
  ['Payees', 'Settings', 'payees'],
  ['Categories', 'Settings', 'categories'],
  ['Pluggy', 'Settings', 'pluggy'],
  ['Imports', 'Transactions', 'imports'],
  ['Gmail review', 'Transactions', 'gmail'],
  ['Scheduled transactions', 'Transactions', 'scheduled'],
  ['Reconciliation', 'Transactions', 'reconciliation'],
] as const

export function AppShell({
  page,
  navigate,
  children,
}: {
  page: Page
  navigate: Navigate
  children: ReactNode
}) {
  const route = useRoute()
  const activeView = route.params.get('view')
  const reduced = useMotionPolicy()
  const indicatorId = useId()
  const pageMotion = useAnimationControls()
  const section = `${page}:${activeView ?? ''}`
  const previousSection = useRef(section)
  useEffect(() => {
    if (reduced) {
      pageMotion.stop()
      pageMotion.set({ opacity: 1, y: 0 })
    } else if (previousSection.current !== section) {
      void pageMotion.start({
        opacity: [0.85, 1],
        y: [4, 0],
        transition: fadeTransition,
      })
    }
    previousSection.current = section
  }, [section, reduced, pageMotion])
  const activeLabel =
    page === 'Budget' || page === 'Overview' || page === 'Net Worth'
      ? 'Dashboard'
      : page === 'Account'
        ? 'Accounts'
        : page === 'Transactions'
          ? 'Activities'
          : page === 'Performance'
            ? 'Insights'
            : page === 'Investments'
              ? ['Holdings', 'Fixed Income'].includes(activeView ?? '')
                ? 'Holdings'
                : ['Performance', 'Allocation', 'Income'].includes(
                      activeView ?? '',
                    )
                  ? 'Insights'
                  : ['Activity', 'Imports'].includes(activeView ?? '')
                    ? 'Activities'
                    : 'Dashboard'
              : page === 'Reports'
                ? 'Settings'
                : page
  const sidebarKey = `finance-tracker-sidebar-${document.documentElement.dataset.workspace ?? 'normal'}`
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const saved =
        localStorage.getItem(sidebarKey) ??
        (sidebarKey.endsWith('-normal')
          ? localStorage.getItem('finance-tracker-sidebar')
          : null)
      return saved !== 'expanded'
    } catch {
      return true
    }
  })
  const [search, setSearch] = useState('')
  const searchDialog = useRef<HTMLDialogElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    try {
      localStorage.setItem(sidebarKey, collapsed ? 'collapsed' : 'expanded')
    } catch {
      /* Appearance storage is optional. */
    }
  }, [collapsed, sidebarKey])
  useEffect(() => {
    const findPage = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearch('')
        searchDialog.current?.showModal()
      }
    }
    window.addEventListener('keydown', findPage)
    return () => window.removeEventListener('keydown', findPage)
  }, [])
  const preferences = usePreferences()
  const theme = document.documentElement.dataset.theme ?? preferences.mode
  const setTheme = (mode: 'light' | 'dark') => setPreferences({ mode })
  useEffect(() => {
    if (open) dialog.current?.showModal()
    else dialog.current?.close()
  }, [open])
  useEffect(() => {
    const media = window.matchMedia?.('(min-width: 1024px)')
    const closeOnDesktop = () => {
      if (media?.matches) setOpen(false)
    }
    media?.addEventListener('change', closeOnDesktop)
    return () => media?.removeEventListener('change', closeOnDesktop)
  }, [])
  function go(next: Page, id?: string, view?: string) {
    if (view) navigateTo(next, id, { view })
    else navigate(next, id)
    setOpen(false)
    searchDialog.current?.close()
    requestAnimationFrame(() => document.getElementById('page-title')?.focus())
  }
  function content(surface: string) {
    return (
      <>
        <div className="brand">
          <span className="project-mark">
            <ChartNoAxesCombined aria-hidden="true" size={18} />
          </span>
          <div className="brand-label">
            Finance Tracker
            <span className="metadata">
              {tr('app_shell:personal_workspace_5b8524')}
            </span>
          </div>
        </div>
        <button
          className="nav-item sidebar-search"
          aria-label={tr('app_shell:find_a_page_7504f0')}
          onClick={() => {
            setSearch('')
            searchDialog.current?.showModal()
          }}
        >
          <Search size={20} />
          <span className="nav-label">
            {tr('app_shell:find_a_page_7504f0')}
          </span>
        </button>
        <nav
          aria-label={tr('app_shell:main_navigation_efd197')}
          className="primary-nav"
        >
          {primary.map(({ page: item, label, view, icon: Icon }) => (
            <button
              key={label}
              className="nav-item"
              title={
                ['Reports'].includes(item)
                  ? tr('messages:message_620ebd007aed', { value0: item })
                  : ui(label)
              }
              aria-label={
                ['Reports'].includes(item)
                  ? `${ui(item)} ${tr('app_shell:preview_f1fbb2')}`
                  : ui(label)
              }
              aria-current={activeLabel === label ? 'page' : undefined}
              onClick={() => go(item, undefined, view)}
            >
              {activeLabel === label && (
                <SelectionIndicator id={`sidebar-${indicatorId}-${surface}`} />
              )}
              <Icon size={20} aria-hidden="true" />
              <span className="nav-label">{ui(label)}</span>
              {['Reports'].includes(item) && (
                <span className="nav-preview">
                  {tr('app_shell:preview_f1fbb2')}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button
            className="nav-item"
            aria-label={tr('messages:message_110309e3e301', {
              value0: ui(theme === 'dark' ? 'light' : 'dark'),
            })}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? (
              <Sun size={17} aria-hidden="true" />
            ) : (
              <Moon size={17} aria-hidden="true" />
            )}{' '}
            <span className="nav-label">
              {theme === 'dark'
                ? tr('dynamic:light_appearance_b548aa')
                : tr('dynamic:dark_appearance_f229ed')}
            </span>
          </button>
          <button
            className="nav-item sidebar-toggle"
            aria-label={
              collapsed
                ? tr('dynamic:expand_sidebar_f462e8')
                : tr('dynamic:collapse_sidebar_9e6876')
            }
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <PanelLeftOpen size={20} />
            ) : (
              <PanelLeftClose size={20} />
            )}
            <span className="nav-label">
              {tr('app_shell:collapse_sidebar_9e6876')}
            </span>
          </button>
        </div>
      </>
    )
  }
  return (
    <div
      className={`application-shell reference-shell ${collapsed ? 'sidebar-collapsed' : ''}`}
      data-motion={reduced ? 'reduced' : 'full'}
    >
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault()
          document.getElementById('main-content')?.focus()
        }}
      >
        {tr('app_shell:skip_to_content_0a4470')}
      </a>
      <aside className="desktop-sidebar">{content('desktop')}</aside>
      <dialog
        ref={searchDialog}
        className="page-finder"
        aria-label={tr('app_shell:find_a_page_7504f0')}
      >
        <label className="field">
          {' '}
          {tr('app_shell:find_a_page_7504f0')}{' '}
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={tr('app_shell:page_name_c99f51')}
          />
        </label>
        <nav aria-label={tr('app_shell:matching_pages_3752b0')}>
          {primary
            .filter((item) =>
              ui(item.label).toLocaleLowerCase().includes(search.toLowerCase()),
            )
            .map(({ page: item, label, view, icon: Icon }) => (
              <button
                className="nav-item"
                key={label}
                onClick={() => go(item, undefined, view)}
              >
                <Icon size={18} />
                {ui(label)}
                {['Reports'].includes(item) && (
                  <span className="nav-preview">
                    {tr('app_shell:preview_f1fbb2')}
                  </span>
                )}
              </button>
            ))}
          {destinations
            .filter(([title]) =>
              ui(title).toLocaleLowerCase().includes(search.toLowerCase()),
            )
            .map(([title, target, view]) => (
              <button
                className="nav-item"
                key={ui(title)}
                onClick={() => {
                  navigateTo(target, undefined, { view })
                  setOpen(false)
                  searchDialog.current?.close()
                  requestAnimationFrame(() =>
                    document.getElementById('page-title')?.focus(),
                  )
                }}
              >
                {ui(title)}
                <span className="metadata">{ui(target)}</span>
              </button>
            ))}
        </nav>
        {!destinations.some(([title]) =>
          ui(title).toLocaleLowerCase().includes(search.toLowerCase()),
        ) &&
          !primary.some((item) =>
            ui(item.label).toLocaleLowerCase().includes(search.toLowerCase()),
          ) && (
            <p className="metadata">
              {tr('app_shell:no_matching_pages_6fc270')}
            </p>
          )}
        <button
          className="text-action"
          onClick={() => searchDialog.current?.close()}
        >
          {tr('app_shell:close_bbfa77')}
        </button>
      </dialog>
      <header className="mobile-toolbar">
        <button
          className="icon-button"
          aria-label={tr('app_shell:open_navigation_0f53b3')}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          onClick={() => setOpen(true)}
        >
          <Menu aria-hidden="true" size={20} />
        </button>
        <span>Finance Tracker</span>
        <span className="metadata">{tr('app_shell:local_dc99d5')}</span>
      </header>
      <dialog
        id="mobile-navigation"
        ref={dialog}
        className="navigation-drawer"
        aria-label={tr('app_shell:navigation_cf03cf')}
        onKeyDown={(event) => {
          if (event.key !== 'Tab') return
          const buttons = Array.from(
            event.currentTarget.querySelectorAll<HTMLButtonElement>(
              'button:not(:disabled)',
            ),
          )
          const first = buttons[0]
          const last = buttons.at(-1)
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last?.focus()
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first?.focus()
          }
        }}
        onCancel={() => setOpen(false)}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false)
        }}
      >
        <div className="drawer-content">
          <button
            className="drawer-close icon-button"
            aria-label={tr('app_shell:close_navigation_917c4c')}
            onClick={() => setOpen(false)}
          >
            <X size={20} aria-hidden="true" />
          </button>
          {content('mobile')}
        </div>
      </dialog>
      <m.main
        initial={false}
        animate={pageMotion}
        layout={reduced ? false : 'position'}
        layoutDependency={collapsed}
        transition={reduced ? { duration: 0 } : layoutSpring}
        id="main-content"
        className={`main-content ${page === 'Overview' ? 'overview-main' : ''}`}
        tabIndex={-1}
      >
        {children}
      </m.main>
    </div>
  )
}
