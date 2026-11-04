import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { t } from '@/lib/i18n'
import './detail-drawer.css'
import { m, useAnimationControls } from 'motion/react'
import { layoutSpring, useMotionPolicy } from '@/lib/motion'

/** Native modal gives Escape, focus containment and an inert background. */
export function DetailDrawer({
  title,
  onClose,
  children,
  modal = true,
  className = '',
}: {
  title: string
  onClose: () => void
  children: ReactNode
  modal?: boolean
  className?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const dirty = useRef(false)
  const reduced = useMotionPolicy()
  const controls = useAnimationControls()
  useEffect(() => {
    if (reduced) {
      controls.stop()
      controls.set({ opacity: 1, x: 0 })
    } else {
      void controls.start({
        opacity: [0.92, 1],
        x: [12, 0],
        transition: layoutSpring,
      })
    }
  }, [reduced, controls])
  const requestClose = () => {
    if (ref.current?.querySelector('fieldset:disabled')) return
    if (!dirty.current || window.confirm(t('parity:discard_draft'))) onClose()
  }
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const dialog = ref.current!
    if (modal) dialog.showModal()
    else dialog.setAttribute('open', '')
    return () => {
      dialog.close()
      previous?.focus()
    }
  }, [modal])
  return (
    <m.dialog
      initial={false}
      animate={controls}
      transition={reduced ? { duration: 0 } : layoutSpring}
      ref={ref}
      className={`detail-drawer ${className}`}
      aria-labelledby={titleId}
      onChangeCapture={() => {
        dirty.current = true
      }}
      onCancel={(e) => {
        e.preventDefault()
        requestClose()
      }}
    >
      <header>
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          onClick={requestClose}
          aria-label={t('parity:close')}
          autoFocus
        >
          <X size={18} />
        </button>
      </header>
      <div className="detail-drawer-content">{children}</div>
    </m.dialog>
  )
}
