import InstallPrompt from './InstallPrompt'

export default function Header() {
  const adminUrl = `${window.location.origin}/admin/`

  return (
    <header className="header">
      <h1>🗺️ Urban Mapping</h1>
      <nav className="nav-menu">
        <InstallPrompt />
        <a href="/" className="nav-link">
          Dashboard
        </a>
        <a href={adminUrl} className="nav-link" target="_blank" rel="noreferrer">
          Admin
        </a>
      </nav>
    </header>
  )
}
