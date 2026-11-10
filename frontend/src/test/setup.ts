import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

window.matchMedia = (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent: () => true,
})

// jsdom does not implement native modal methods; browser checks cover focus/Escape.
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute('open', '')
}
HTMLDialogElement.prototype.close = function () {
  if (this.hasAttribute('open')) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
}

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock

// cmdk scrolls its selected option. jsdom has no layout/scroll implementation;
// Playwright checks the real filter popovers and their keyboard interactions.
HTMLElement.prototype.scrollIntoView = function () {}

// jsdom has no canvas/layout implementation. Source charts use their documented
// unavailable-measurement fallback here; real font metrics are exercised in Playwright.
HTMLCanvasElement.prototype.getContext = () => null
