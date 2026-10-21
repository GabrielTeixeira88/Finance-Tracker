import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { DemoProvider } from './components/demo-provider'
import './index.css'
import './application.css'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <DemoProvider>
        <App />
      </DemoProvider>
    </QueryClientProvider>
  </StrictMode>,
)
