// Adapted frontend source; provenance and license: THIRD_PARTY_NOTICES.md.
// SPDX-License-Identifier: AGPL-3.0-only
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ChartNoAxesCombined,
  House,
  Landmark,
  ListFilter,
  Menu,
  Moon,
  Sun,
  Settings,
  X,
  Wallet,
  BriefcaseBusiness,
  TrendingUp,
  ChartPie,
  Files,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Target,
} from 'lucide-react'
import type { PreviewPage } from '@/pages/previews'

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
  { page: 'Overview', icon: House },
  { page: 'Accounts', icon: Landmark },
  { page: 'Transactions', icon: ListFilter },
  { page: 'Budget', icon: Wallet },
  { page: 'Investments', icon: BriefcaseBusiness },
  { page: 'Performance', icon: TrendingUp },
  { page: 'Net Worth', icon: ChartPie },
  { page: 'Goals', icon: Target },
  { page: 'Reports', icon: Files },
  { page: 'Settings', icon: Settings },
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
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(true)
  const [search, setSearch] = useState('')
  const searchDialog = useRef<HTMLDialogElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const [theme, setTheme] = useState(() => {
    try {
      const stored = localStorage.getItem('finance-tracker-theme')
      if (stored === 'dark' || stored === 'light') return stored
    } catch {
      /* Storage is optional. */
    }
    return 'dark'
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('finance-tracker-theme', theme)
    } catch {
      /* No data storage dependency. */
    }
  }, [theme])
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
  function go(next: Page, id?: string) {
    navigate(next, id)
    setOpen(false)
    searchDialog.current?.close()
    requestAnimationFrame(() => document.getElementById('page-title')?.focus())
  }
  function content() {
    return (
      <>
        <div className="brand">
          <span className="project-mark">
            <ChartNoAxesCombined aria-hidden="true" size={18} />
          </span>
          <div className="brand-label">
            Finance Tracker<span className="metadata">Personal workspace</span>
          </div>
        </div>
        <button
          className="nav-item sidebar-search"
          aria-label="Find a page"
          onClick={() => {
            setSearch('')
            searchDialog.current?.showModal()
          }}
        >
          <Search size={20} />
          <span className="nav-label">Find a page</span>
        </button>
        <nav aria-label="Main navigation" className="primary-nav">
          {primary.map(({ page: item, icon: Icon }) => (
            <button
              key={item}
              className="nav-item"
              title={['Reports'].includes(item) ? `${item} · Preview` : item}
              aria-label={['Reports'].includes(item) ? `${item} Preview` : item}
              aria-current={
                page === item || (page === 'Account' && item === 'Accounts')
                  ? 'page'
                  : undefined
              }
              onClick={() => go(item)}
            >
              <Icon size={20} aria-hidden="true" />
              <span className="nav-label">{item}</span>
              {['Reports'].includes(item) && (
                <span className="nav-preview">Preview</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button
            className="nav-item"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? (
              <Sun size={17} aria-hidden="true" />
            ) : (
              <Moon size={17} aria-hidden="true" />
            )}{' '}
            <span className="nav-label">
              {theme === 'dark' ? 'Light appearance' : 'Dark appearance'}
            </span>
          </button>
          <button
            className="nav-item sidebar-toggle"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <PanelLeftOpen size={20} />
            ) : (
              <PanelLeftClose size={20} />
            )}
            <span className="nav-label">Collapse sidebar</span>
          </button>
          <span
            className="workspace-avatar"
            title="Finance Tracker · Local workspace"
            aria-label="Local workspace"
          >
            FT
          </span>
        </div>
      </>
    )
  }
  return (
    <div
      className={`application-shell reference-shell ${collapsed ? 'sidebar-collapsed' : ''}`}
    >
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="desktop-sidebar">{content()}</aside>
      <dialog
        ref={searchDialog}
        className="page-finder"
        aria-label="Find a page"
      >
        <label className="field">
          Find a page
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Page name"
          />
        </label>
        <nav aria-label="Matching pages">
          {primary
            .filter((item) =>
              item.page.toLowerCase().includes(search.toLowerCase()),
            )
            .map(({ page: item, icon: Icon }) => (
              <button className="nav-item" key={item} onClick={() => go(item)}>
                <Icon size={18} />
                {item}
                {['Reports'].includes(item) && (
                  <span className="nav-preview">Preview</span>
                )}
              </button>
            ))}
        </nav>
        {!primary.some((item) =>
          item.page.toLowerCase().includes(search.toLowerCase()),
        ) && <p className="metadata">No matching pages</p>}
        <button
          className="text-action"
          onClick={() => searchDialog.current?.close()}
        >
          Close
        </button>
      </dialog>
      <header className="mobile-toolbar">
        <button
          className="icon-button"
          aria-label="Open navigation"
          aria-expanded={open}
          aria-controls="mobile-navigation"
          onClick={() => setOpen(true)}
        >
          <Menu aria-hidden="true" size={20} />
        </button>
        <span>Finance Tracker</span>
        <span className="metadata">Local</span>
      </header>
      <dialog
        id="mobile-navigation"
        ref={dialog}
        className="navigation-drawer"
        aria-label="Navigation"
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
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          >
            <X size={20} aria-hidden="true" />
          </button>
          {content()}
        </div>
      </dialog>
      <main
        id="main-content"
        className={`main-content ${page === 'Overview' ? 'overview-main' : ''}`}
        tabIndex={-1}
      >
        {children}
      </main>
    </div>
  )
}
