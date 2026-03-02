import { StrictMode, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Admin from './Admin.tsx'
import LandingPage from './LandingPage.tsx'

const path = window.location.pathname

const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches ||
  (window.navigator as Navigator & { standalone?: boolean }).standalone === true

if (isStandalone) {
  document.documentElement.classList.add('standalone-app')
}

let Component: ReactElement
if (path === '/admin') {
  Component = <Admin />
} else if (path === '/uwicd') {
  Component = <App port="의왕ICD" />
} else {
  Component = <LandingPage />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>{Component}</StrictMode>
)
