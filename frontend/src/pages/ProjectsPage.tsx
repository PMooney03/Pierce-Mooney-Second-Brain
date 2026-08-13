import { useEffect, useState } from 'react'
import Markdown from 'react-markdown'
import {
  api,
  type ProjectBrowse,
  type ProjectCard,
  type ProjectFileView,
} from '../api'

function formatSize(bytes: number | null | undefined): string {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function projectNameFromPath(filepath: string): string | null {
  const parts = filepath.replace(/\\/g, '/').split('/').filter(Boolean)
  const idx = parts.findIndex((p) => p.toLowerCase() === 'projects')
  if (idx >= 0 && parts[idx + 1]) return parts[idx + 1]
  return null
}

/** Accept folder catalog rows, or collapse legacy indexed document rows. */
function normalizeProjectCards(raw: unknown): ProjectCard[] {
  if (!Array.isArray(raw) || !raw.length) return []

  const first = raw[0] as Record<string, unknown>
  const looksLikeFolderCard =
    typeof first === 'object' &&
    first != null &&
    typeof first.name === 'string' &&
    first.name.trim() !== '' &&
    first.name !== 'undefined' &&
    ('file_count' in first || 'dir_count' in first || 'folder' in first)

  if (looksLikeFolderCard) {
    return (raw as Array<Record<string, unknown>>)
      .map((row) => {
        const name = String(row.name || '').trim()
        if (!name || name === 'undefined') return null
        return {
          name,
          folder: String(row.folder || `Projects/${name}`),
          file_count: Number(row.file_count ?? 0),
          dir_count: Number(row.dir_count ?? 0),
          has_readme: Boolean(row.has_readme),
        } satisfies ProjectCard
      })
      .filter((c): c is ProjectCard => c != null)
  }

  // Legacy: flat document list from /api/projects
  const names = new Map<string, ProjectCard>()
  for (const row of raw as Array<Record<string, unknown>>) {
    const name =
      projectNameFromPath(String(row.filepath || row.folder || '')) ||
      (typeof row.name === 'string' ? row.name.trim() : '')
    if (!name || name === 'undefined') continue
    if (!names.has(name)) {
      names.set(name, {
        name,
        folder: `Projects/${name}`,
        file_count: 0,
        dir_count: 0,
        has_readme: false,
      })
    }
    const card = names.get(name)!
    card.file_count += 1
    if (String(row.filename || '').toLowerCase() === 'readme.md') card.has_readme = true
  }
  return Array.from(names.values()).sort((a, b) => a.name.localeCompare(b.name))
}

export default function ProjectsPage() {
  const [items, setItems] = useState<ProjectCard[]>([])
  const [error, setError] = useState<string | null>(null)
  const [project, setProject] = useState<string | null>(null)
  const [browse, setBrowse] = useState<ProjectBrowse | null>(null)
  const [fileView, setFileView] = useState<ProjectFileView | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await api.projects()
        if (cancelled) return
        const cards = normalizeProjectCards(data)
        setItems(cards)
        if (!cards.length) {
          setError('No project folders found under Projects/.')
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function openFolder(name: string, path = '') {
    const clean = String(name || '').trim()
    if (!clean || clean === 'undefined') {
      setError('Missing project name — refresh the page and try again.')
      return
    }
    setLoading(true)
    setError(null)
    setFileView(null)
    try {
      const data = await api.projectBrowse(clean, path)
      setProject(clean)
      setBrowse(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function openFile(name: string, path: string) {
    const clean = String(name || '').trim()
    if (!clean || clean === 'undefined') return
    setLoading(true)
    setError(null)
    try {
      setFileView(await api.projectFile(clean, path))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  function backToProjects() {
    setProject(null)
    setBrowse(null)
    setFileView(null)
    setError(null)
  }

  function goBreadcrumb(index: number) {
    if (!project || !browse) return
    if (index < 0) {
      void openFolder(project, '')
      return
    }
    void openFolder(project, browse.breadcrumbs.slice(0, index + 1).join('/'))
  }

  if (project && browse) {
    const parentPath =
      browse.breadcrumbs.length > 1
        ? browse.breadcrumbs.slice(0, -1).join('/')
        : browse.breadcrumbs.length === 1
          ? ''
          : null

    return (
      <>
        <div className="page-header">
          <div>
            <button className="ghost-btn" type="button" onClick={backToProjects}>
              ← All projects
            </button>
            <h2 style={{ marginTop: '0.75rem' }}>{browse.name}</h2>
            <p className="project-breadcrumbs">
              <button type="button" className="crumb" onClick={() => goBreadcrumb(-1)}>
                {browse.name}
              </button>
              {browse.breadcrumbs.map((part, i) => (
                <span key={`${part}-${i}`}>
                  <span className="crumb-sep">/</span>
                  <button type="button" className="crumb" onClick={() => goBreadcrumb(i)}>
                    {part}
                  </button>
                </span>
              ))}
            </p>
          </div>
        </div>
        <div className="content project-browser">
          {error && <div className="error">{error}</div>}
          {loading ? <p className="notice">Loading…</p> : null}

          <div className="project-browser-layout">
            <section className="project-entry-list">
              {parentPath !== null || browse.path ? (
                <button
                  type="button"
                  className="project-entry"
                  onClick={() => void openFolder(project, parentPath || '')}
                >
                  <span className="project-entry-icon dir">DIR</span>
                  <span className="project-entry-name">..</span>
                  <span className="project-entry-meta">parent folder</span>
                </button>
              ) : null}

              {browse.entries.map((e) => {
                const nextPath = browse.path ? `${browse.path}/${e.name}` : e.name
                return (
                  <button
                    key={`${e.kind}-${e.name}`}
                    type="button"
                    className={`project-entry${fileView?.path === nextPath ? ' active' : ''}`}
                    onClick={() => {
                      if (e.kind === 'dir') void openFolder(project, nextPath)
                      else void openFile(project, nextPath)
                    }}
                  >
                    <span className={`project-entry-icon ${e.kind}`}>
                      {e.kind === 'dir' ? 'DIR' : 'FILE'}
                    </span>
                    <span className="project-entry-name">{e.name}</span>
                    <span className="project-entry-meta">
                      {e.kind === 'dir' ? 'folder' : formatSize(e.size)}
                    </span>
                  </button>
                )
              })}

              {!browse.entries.length ? (
                <p className="empty">This folder is empty (or only has ignored build folders).</p>
              ) : null}
            </section>

            <section className="project-file-pane">
              {fileView ? (
                <>
                  <div className="project-main-file-label">{fileView.path}</div>
                  <h3>{fileView.filename}</h3>
                  {fileView.readable && fileView.text != null ? (
                    fileView.is_markdown ? (
                      <div className="message-body md project-readme">
                        <Markdown>{fileView.text}</Markdown>
                      </div>
                    ) : (
                      <pre className="project-code">{fileView.text}</pre>
                    )
                  ) : (
                    <p className="empty">
                      Binary or unsupported file
                      {fileView.size != null ? ` · ${formatSize(fileView.size)}` : ''}.
                    </p>
                  )}
                </>
              ) : (
                <p className="empty">Select a file to preview it here.</p>
              )}
            </section>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Projects</h2>
          <p>Click a project folder to browse its files and structure.</p>
        </div>
      </div>
      <div className="content">
        {error ? <div className="error">{error}</div> : null}
        <div className="knowledge-grid project-grid">
          {items.map((p, i) => (
            <button
              type="button"
              className="knowledge-card project-card"
              key={p.name}
              style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
              onClick={() => void openFolder(p.name)}
            >
              <h3 className="project-card-title">{p.name}</h3>
              <p>
                {p.dir_count} folders · {p.file_count} files
                {p.has_readme ? ' · README' : ''}
              </p>
              <span className="project-card-cta">Browse structure →</span>
            </button>
          ))}
        </div>
        {!items.length && !error ? (
          <p className="empty">No project folders found under Projects/.</p>
        ) : null}
      </div>
    </>
  )
}
