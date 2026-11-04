import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { DemoProvider } from './components/demo-provider'
import { MotionProvider } from './components/motion-provider'
import './index.css'
import './application.css'
import './appearance.css'
import './lib/preferences'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <DemoProvider>
        <MotionProvider>
          <App />
        </MotionProvider>
      </DemoProvider>
    </QueryClientProvider>
  </StrictMode>,
)

import './ux-redesign.css'
import './motion.css'

import './themes/tokens.css'
import './themes/charts.css'
