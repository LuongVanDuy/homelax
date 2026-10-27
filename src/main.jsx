import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ErrorBoundary from './components/ui/feedback/ErrorBoundary'
import AppProviders from './app/providers/AppProviders.tsx'
import { cleanupLegacyStorage } from './app/migrations/legacyStorage.ts'
import './index.css'
import App from './App.jsx'

cleanupLegacyStorage()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <AppProviders>
        <App />
      </AppProviders>
    </ErrorBoundary>
  </StrictMode>,
)


