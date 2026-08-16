import { NavLink, Outlet } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { api, type HealthResponse } from './api'
import { useSettings } from './settings'

const SIDEBAR_KEY = 'secondbrain.sidebarCollapsed'

const links = [
  { to: '/', label: 'Chat', short: 'C', end: true },
  { to: '/memory', label: 'Memory', short: 'M' },
  { to: '/search', label: 'Search', short: 'S' },
  { to: '/library', label: 'Library', short: 'L' },
  { to: '/modules', label: 'Modules', short: 'Md' },
  { to: '/projects', label: 'Projects', short: 'P' },
  { to: '/knowledge', label: 'Knowledge', short: 'K' },
]

function MenuIcon({ collapsed }: { collapsed: boolean }) {
  return collapsed ? (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M4 4.5h10M4 9h10M4 13.5h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M3 4h12v1.6H3V4zm0 4h8v1.6H3V8zm0 4h10v1.6H3V12z" fill="currentColor" />
      <circle cx="14" cy="13.2" r="2.2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M19.4 13.1c.05-.36.05-.74 0-1.1l1.7-1.3a.5.5 0 0 0 .12-.64l-1.6-2.8a.5.5 0 0 0-.6-.22l-2 .8a7.2 7.2 0 0 0-.95-.55l-.3-2.1a.5.5 0 0 0-.5-.42h-3.2a.5.5 0 0 0-.5.42l-.3 2.1c-.34.14-.66.33-.95.55l-2-.8a.5.5 0 0 0-.6.22L3.78 10a.5.5 0 0 0 .12.64l1.7 1.3c-.05.36-.05.74 0 1.1l-1.7 1.3a.5.5 0 0 0-.12.64l1.6 2.8c.13.23.4.32.6.22l2-.8c.29.22.61.41.95.55l.3 2.1c.04.24.25.42.5.42h3.2c.25 0 .46-.18.5-.42l.3-2.1c.34-.14.66-.33.95-.55l2 .8c.23.1.5 0 .6-.22l1.6-2.8a.5.5 0 0 0-.12-.64l-1.7-1.3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(SIDEBAR_KEY) === '1'
  })
  const settingsRef = useRef<HTMLDivElement>(null)
  const { theme, toggleTheme, mapKeep, setMapKeep } = useSettings()

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed ? '1' : '0')
  }, [sidebarCollapsed])

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null))
    const id = window.setInterval(() => {
      api.health().then(setHealth).catch(() => setHealth(null))
    }, 15000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (!settingsOpen) return
    function onPointerDown(e: PointerEvent) {
      if (!settingsRef.current?.contains(e.target as Node)) {
        setSettingsOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSettingsOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [settingsOpen])

  const ollamaOk = Boolean(health?.ollama?.reachable)

  return (
    <div className={`app-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <button
            type="button"
            className="brand-mark"
            onClick={() => {
              setSidebarCollapsed((v) => !v)
              setSettingsOpen(false)
            }}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!sidebarCollapsed}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <MenuIcon collapsed={sidebarCollapsed} />
          </button>
          <div className="brand-copy">
            <h1>
              Charles
              <span>GPT</span>
            </h1>
            <p>Your private, local college knowledge system.</p>
          </div>
        </div>
        <nav className="nav-section" aria-label="Workspace">
          <div className="nav-label">Workspace</div>
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}
              title={link.label}
            >
              <span className="nav-btn-short" aria-hidden>
                {link.short}
              </span>
              <span className="nav-btn-label">{link.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="settings-wrap" ref={settingsRef}>
            {settingsOpen ? (
              <div className="settings-panel" role="dialog" aria-label="Settings">
                <div className="settings-panel-title">Settings</div>
                <div className="settings-row">
                  <div className="settings-row-copy">
                    <span className="settings-row-label">Appearance</span>
                    <span className="settings-row-hint">
                      {theme === 'dark' ? 'Dark mode' : 'Light mode'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="settings-toggle"
                    onClick={toggleTheme}
                    aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                  >
                    {theme === 'dark' ? 'Light' : 'Dark'}
                  </button>
                </div>
                <div className="settings-row">
                  <div className="settings-row-copy">
                    <span className="settings-row-label">Retrieval map</span>
                    <span className="settings-row-hint">
                      {mapKeep ? 'Keep after answers' : 'Fade after answers'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`settings-toggle${mapKeep ? ' on' : ''}`}
                    onClick={() => setMapKeep(!mapKeep)}
                    aria-pressed={mapKeep}
                    aria-label={mapKeep ? 'Switch map to fade' : 'Switch map to keep'}
                  >
                    {mapKeep ? 'KEEP' : 'FADE'}
                  </button>
                </div>
              </div>
            ) : null}
            <button
              type="button"
              className={`theme-toggle settings-btn${settingsOpen ? ' open' : ''}`}
              onClick={() => setSettingsOpen((v) => !v)}
              aria-expanded={settingsOpen}
              aria-haspopup="dialog"
              title="Settings"
            >
              <span className="theme-toggle-icon" aria-hidden>
                <SettingsIcon />
              </span>
              <span className="settings-btn-label">Settings</span>
            </button>
          </div>
          <div className="status-row">
            <span className={`status-dot${health && ollamaOk ? '' : ' warn'}`} />
            <span className="status-text">
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
