import { NavLink, Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { api, type HealthResponse } from './api'

const links = [
  { to: '/', label: 'Chat', end: true },
  { to: '/memory', label: 'Memory' },
  { to: '/search', label: 'Search' },
  { to: '/library', label: 'Library' },
  { to: '/modules', label: 'Modules' },
  { to: '/projects', label: 'Projects' },
  { to: '/knowledge', label: 'Knowledge' },
]

const THEME_KEY = 'secondbrain.theme'

function BrandMark() {
  return (
    <div className="brand-mark" aria-hidden>
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M3 4h12v1.6H3V4zm0 4h8v1.6H3V8zm0 4h10v1.6H3V12z" fill="currentColor" />
        <circle cx="14" cy="13.2" r="2.2" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    </div>
  )
}

function readTheme(): 'light' | 'dark' {
  const stored = localStorage.getItem(THEME_KEY)
  if (stored === 'dark' || stored === 'light') return stored
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
  return 'light'
}

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    typeof window === 'undefined' ? 'light' : readTheme(),
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null))
    const id = window.setInterval(() => {
      api.health().then(setHealth).catch(() => setHealth(null))
    }, 15000)
    return () => window.clearInterval(id)
  }, [])

  const ollamaOk = Boolean(health?.ollama?.reachable)

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <BrandMark />
          <h1>
            Charles
            <span>GPT</span>
          </h1>
          <p>Your private, local college knowledge system.</p>
        </div>
        <nav className="nav-section" aria-label="Workspace">
          <div className="nav-label">Workspace</div>
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <span className="theme-toggle-icon" aria-hidden>
              {theme === 'dark' ? '☀' : '☾'}
            </span>
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <div className="status-row">
            <span className={`status-dot${health && ollamaOk ? '' : ' warn'}`} />
            <span>
              {!health ? 'API offline' : ollamaOk ? 'Ollama online' : 'Ollama offline'}
            </span>
          </div>
          <div className="model-label">{health?.config?.chat_model || '—'}</div>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
