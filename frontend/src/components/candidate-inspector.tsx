import {
  useEffect,
  useState,
  createContext,
  useContext,
  type ReactNode,
} from 'react'
import { DetailDrawer } from './detail-drawer'
import { Button } from './ui/button'
import { t } from '@/lib/i18n'

const InspectorContext = createContext(false)

/** Focus is independent from approval selection. Each caller retains its own API. */
export function CandidateInspector({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const nested = useContext(InspectorContext)
  const [mobile, setMobile] = useState(
    () => window.matchMedia('(max-width: 767px)').matches,
  )
  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const update = () => setMobile(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  if (nested)
    return (
      <section className="embedded-inspector">
        <Button variant="ghost" onClick={onClose}>
          {t('parity:close')}
        </Button>
        {children}
      </section>
    )
  return (
    <InspectorContext.Provider value={true}>
      <DetailDrawer
        title={title}
        onClose={onClose}
        modal={mobile}
        className={mobile ? '' : 'candidate-inspector'}
      >
        {children}
      </DetailDrawer>
    </InspectorContext.Provider>
  )
}
