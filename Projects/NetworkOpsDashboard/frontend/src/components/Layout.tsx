import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useTheme } from '../theme/ThemeProvider'

export function Layout({ children }: { children: ReactNode }) {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <strong>Network Ops Dashboard</strong>
          <span>Device registration and simulated monitoring</span>
        </div>

        <nav className="nav" aria-label="Main">
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          <NavLink to="/devices">Devices</NavLink>
          <NavLink to="/devices/new">Add device</NavLink>
        </nav>

        <div className="topbar-actions">
          <button type="button" className="btn" onClick={toggleTheme}>
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
        </div>
      </header>

      <main>{children}</main>
    </div>
  )
}
