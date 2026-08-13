import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/dashboard.css'
import './index.css'
import App from './App.jsx'
import { registerSavePlaceGlobal } from './utils/savedPlaces'
import { registerServiceWorker } from './utils/pwa'

registerSavePlaceGlobal()
registerServiceWorker()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
