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

const PORT_MAP: Record<string, string> = {
  '/uwicd':      '의왕ICD',
  '/incheon-new': '인천신항',
  '/incheon':    '인천항',
  '/busan-new':  '부산신항',
  '/busan':      '부산북항',
  '/gwangyang':  '광양항',
}

let Component: ReactElement
if (path === '/admin') {
  Component = <Admin />
} else if (PORT_MAP[path]) {
  Component = <App port={PORT_MAP[path]} />
} else {
  Component = <LandingPage />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>{Component}</StrictMode>
)
