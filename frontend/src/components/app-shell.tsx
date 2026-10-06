import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ArrowLeftRight,
  ChartNoAxesCombined,
  House,
  Landmark,
  ListFilter,
  Menu,
  Moon,
  Sun,
  Tags,
  X,
} from 'lucide-react'
import type { Account } from '@/lib/api'
import { Money } from './primitives'

export type Page =
  | 'Dashboard'
  | 'Accounts'
  | 'Transactions'
  | 'Transfers'
  | 'Categories'
  | 'Account'
export type Navigate = (page: Page, accountId?: string) => void
const primary = [
  { page: 'Dashboard', icon: House },
  { page: 'Transactions', icon: ListFilter },
  { page: 'Transfers', icon: ArrowLeftRight },
  { page: 'Categories', icon: Tags },
] as const

export function AppShell({
  page,
  accountId,
  accounts,
  navigate,
  children,
}: {
  page: Page
  accountId?: string
  accounts: Account[]
  navigate: Navigate
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const [theme, setTheme] = useState(() => {
    try {
      const stored = localStorage.getItem('finance-tracker-theme')
      if (stored === 'dark' || stored === 'light') return stored
    } catch {
      /* Storage is optional. */
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
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
    requestAnimationFrame(() => document.getElementById('page-title')?.focus())
  }
  function content() {
    return (
      <>
        <div className="brand">
          <span className="project-mark">
            <ChartNoAxesCombined aria-hidden="true" size={18} />
          </span>
          <div>
            Finance Tracker<span className="metadata">Personal workspace</span>
          </div>
        </div>
        <nav aria-label="Main navigation" className="primary-nav">
          {primary.map(({ page: item, icon: Icon }) => (
            <button
              key={item}
              className="nav-item"
              aria-current={page === item ? 'page' : undefined}
              onClick={() => go(item)}
            >
              <Icon size={17} aria-hidden="true" />
              {item}
            </button>
          ))}
        </nav>
        <section className="sidebar-accounts" aria-label="Account navigation">
          <div className="sidebar-section-title">
            Accounts
            <button
              className="text-action"
              onClick={() => go('Accounts')}
              aria-label="Manage accounts"
            >
              Manage
            </button>
          </div>
          <button
            className="nav-item"
            aria-current={page === 'Accounts' ? 'page' : undefined}
            onClick={() => go('Accounts')}
          >
            <Landmark size={17} aria-hidden="true" />
            All accounts
          </button>
          {!accounts.some((a) => a.active) && (
            <p className="metadata px-3 py-2">No active accounts yet.</p>
          )}
          {accounts
            .filter((a) => a.active)
            .map((a) => (
              <button
                className="account-nav"
                key={a.id}
                aria-current={
                  page === 'Account' && accountId === a.id ? 'page' : undefined
                }
                onClick={() => go('Account', a.id)}
                aria-label={`Open ${a.name}`}
              >
                <span className="account-name" title={a.name}>
                  {a.name}
                </span>
                <Money
                  value={a.balance}
                  currency={a.currency}
                  compact
                  tone={a.balance.startsWith('-') ? 'negative' : 'neutral'}
                />
              </button>
            ))}
        </section>
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
            {theme === 'dark' ? 'Light appearance' : 'Dark appearance'}
          </button>
          <p className="metadata">
            <span className="local-dot" />
            Local · Self-hosted
          </p>
        </div>
      </>
    )
  }
  return (
    <div className="application-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="desktop-sidebar">{content()}</aside>
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
      <main id="main-content" className="main-content" tabIndex={-1}>
        {children}
      </main>
    </div>
  )
}
