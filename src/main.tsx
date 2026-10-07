import '@/styles/global.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppRoot } from '@/app/AppRoot'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element not found')

createRoot(rootElement).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>,
)
