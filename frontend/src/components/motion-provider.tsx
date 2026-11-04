import { LazyMotion, MotionConfig, domMax } from 'motion/react'
import type { ReactNode } from 'react'
import { layoutSpring, useMotionPolicy } from '@/lib/motion'

export function MotionProvider({ children }: { children: ReactNode }) {
  const reduced = useMotionPolicy()
  return (
    <MotionConfig
      reducedMotion={reduced ? 'always' : 'never'}
      transition={layoutSpring}
    >
      <LazyMotion features={domMax} strict>
        {children}
      </LazyMotion>
    </MotionConfig>
  )
}
