import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './editorial-v2.css'
import './warm-v3-2.css'
import './cards-v3-3.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
