import { useEffect, useMemo, useState } from 'react'
import Markdown from 'react-markdown'
import {
  api,
  type DocumentItem,
  type ProjectBrowse,
  type ProjectCard,
  type ProjectFileView,
} from '../api'

type ModuleCard = {
  name: string
  year: string | null
  document_count: number
}

function formatSize(bytes: number | null | undefined): string {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function yearLabel(year: string | null): string {
  const trimmed = year?.trim()
  if (!trimmed) return 'Projects'
  if (/^year\s*\d+$/i.test(trimmed)) return trimmed
  return 'Extra data'
}

function yearSortKey(label: string): string {
  if (/^year\s*\d+$/i.test(label)) {
    const n = label.match(/\d+/)
    return n ? n[0].padStart(2, '0') : label.toLowerCase()
  }
  if (label === 'Projects') return '90'
  if (label === 'Extra data') return '99'
  return `80-${label.toLowerCase()}`
}

function normalizeProjectCards(raw: unknown): ProjectCard[] {
  if (!Array.isArray(raw) || !raw.length) return []
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

export default function KnowledgePage() {
  const [modules, setModules] = useState<ModuleCard[]>([])
  const [projects, setProjects] = useState<ProjectCard[]>([])
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Module drill-in
  const [selectedModule, setSelectedModule] = useState<ModuleCard | null>(null)
  const [docs, setDocs] = useState<DocumentItem[]>([])
  const [activeDoc, setActiveDoc] = useState<{
    document: DocumentItem
    chunks: Array<{
      id: string
      text: string
      page_start?: number | null
      heading?: string | null
      chunk_index?: number
    }>
  } | null>(null)

  // Project drill-in
  const [project, setProject] = useState<string | null>(null)
  const [browse, setBrowse] = useState<ProjectBrowse | null>(null)
  const [fileView, setFileView] = useState<ProjectFileView | null>(null)

  useEffect(() => {
    api
      .knowledge()
      .then((data) => {
        const mods = (data.modules as ModuleCard[]) || []
        setModules(
          mods.map((m) => ({
            name: m.name,
            year: m.year,
            document_count: m.document_count,
          })),
        )
        setProjects(normalizeProjectCards(data.projects))
        setNote(data.note ? String(data.note) : null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  const grouped = useMemo(() => {
    const map = new Map<string, ModuleCard[]>()
    for (const m of modules) {
      const key = yearLabel(m.year)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(m)
    }
    return Array.from(map.entries()).sort(([a], [b]) =>
      yearSortKey(a).localeCompare(yearSortKey(b)),
    )
  }, [modules])

  async function openModule(mod: ModuleCard) {
    setLoading(true)
    setError(null)
    setActiveDoc(null)
    setSelectedModule(mod)
    setProject(null)
    setBrowse(null)
    setFileView(null)
    try {
      const params: Record<string, string> = { module: mod.name }
      if (mod.year) params.year = mod.year
      setDocs(await api.documents(params))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setDocs([])
    } finally {
      setLoading(false)
    }
  }

  async function openDocument(id: number) {
    setLoading(true)
    setError(null)
    try {
      const data = await api.document(id)
      setActiveDoc({
        document: data.document,
        chunks:
          (data.chunks as Array<{
            id: string
            text: string
            page_start?: number | null
            heading?: string | null
            chunk_index?: number
          }>) || [],
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function openFolder(name: string, path = '') {
    const clean = String(name || '').trim()
    if (!clean || clean === 'undefined') {
      setError('Missing project name — refresh and try again.')
      return
    }
    setLoading(true)
    setError(null)
    setFileView(null)
    setSelectedModule(null)
    setDocs([])
    setActiveDoc(null)
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

  function backToOverview() {
    setSelectedModule(null)
    setDocs([])
    setActiveDoc(null)
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

  // —— Module drill-in (same pattern as Modules page) ——
  if (selectedModule) {
    return (
      <>
        <div className="page-header">
          <div>
            <button className="ghost-btn" type="button" onClick={backToOverview}>
              ← Knowledge
            </button>
            <h2 style={{ marginTop: '0.75rem' }}>{selectedModule.name}</h2>
            <p>
              {yearLabel(selectedModule.year)} · {docs.length || selectedModule.document_count}{' '}
              indexed document{(docs.length || selectedModule.document_count) === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <div className="content project-browser">
          {error ? <div className="error">{error}</div> : null}
          {loading ? <p className="notice">Loading…</p> : null}
          <div className="project-browser-layout">
            <section className="project-entry-list">
              {docs.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={`project-entry${activeDoc?.document.id === d.id ? ' active' : ''}`}
                  onClick={() => void openDocument(d.id)}
                >
                  <span className="project-entry-icon file">
                    {d.file_type?.toUpperCase().slice(0, 4) || 'DOC'}
                  </span>
                  <span className="project-entry-name">{d.filename}</span>
                  <span className="project-entry-meta">
                    {d.document_type || 'Document'}
                    {d.chunk_count ? ` · ${d.chunk_count} chunks` : ''}
                    {d.file_size ? ` · ${formatSize(d.file_size)}` : ''}
                  </span>
                </button>
              ))}
              {!docs.length && !loading ? (
                <p className="empty">No indexed documents for this module yet.</p>
              ) : null}
            </section>
            <section className="project-file-pane">
              {activeDoc ? (
                <>
                  <div className="project-main-file-label">{activeDoc.document.filepath}</div>
                  <h3>{activeDoc.document.filename}</h3>
                  <p className="project-card-main">
                    {[activeDoc.document.document_type, activeDoc.document.year, activeDoc.document.module]
                      .filter(Boolean)
                      .join(' · ')}
                    {activeDoc.document.chunk_count
                      ? ` · ${activeDoc.document.chunk_count} chunks`
                      : ''}
                  </p>
                  {activeDoc.chunks.length ? (
                    <div className="module-chunk-list">
                      {activeDoc.chunks.slice(0, 40).map((c) => (
                        <article key={c.id} className="module-chunk">
                          <header>
                            {c.heading
                              ? c.heading
                              : c.page_start != null
                                ? `Page ${c.page_start}`
                                : `Chunk ${(c.chunk_index ?? 0) + 1}`}
                          </header>
                          <pre>{c.text.length > 900 ? `${c.text.slice(0, 900)}…` : c.text}</pre>
                        </article>
                      ))}
                      {activeDoc.chunks.length > 40 ? (
                        <p className="empty">Showing first 40 of {activeDoc.chunks.length} chunks.</p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="empty">No chunks stored for this document.</p>
                  )}
                </>
              ) : (
                <p className="empty">Select a document to inspect its indexed chunks.</p>
              )}
            </section>
          </div>
        </div>
      </>
    )
  }

  // —— Project drill-in (same pattern as Projects page) ——
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
            <button className="ghost-btn" type="button" onClick={backToOverview}>
              ← Knowledge
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
          {error ? <div className="error">{error}</div> : null}
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
              {!browse.entries.length && !loading ? (
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

  // —— Overview: year-grouped modules + project cards ——
  return (
    <>
      <div className="page-header">
        <div>
          <h2>Knowledge</h2>
          <p>Click a module or project to browse — same layout as Modules and Projects.</p>
        </div>
      </div>
      <div className="content">
        {error ? <div className="error">{error}</div> : null}
        {note ? <p className="notice">{note}</p> : null}

        {grouped.map(([year, mods]) => (
          <section key={year} className="module-year-section">
            <div className="module-year-heading">
              <h3>{year}</h3>
              <span>
                {mods.length} module{mods.length === 1 ? '' : 's'} ·{' '}
                {mods.reduce((n, m) => n + m.document_count, 0)} documents
              </span>
            </div>
            <div className="knowledge-grid project-grid">
              {mods.map((m, i) => (
                <button
                  type="button"
                  className="knowledge-card project-card"
                  key={`${m.year}-${m.name}`}
                  style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
                  onClick={() => void openModule(m)}
                >
                  <h3 className="project-card-title">{m.name}</h3>
                  <p>
                    {m.document_count} document{m.document_count === 1 ? '' : 's'}
                  </p>
                  <span className="project-card-cta">Browse documents →</span>
                </button>
              ))}
            </div>
          </section>
        ))}

        <section className="module-year-section">
          <div className="module-year-heading">
            <h3>Projects</h3>
            <span>
              {projects.length} project{projects.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="knowledge-grid project-grid">
            {projects.map((p, i) => (
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
          {!projects.length ? (
            <p className="empty">No project folders found under Projects/.</p>
          ) : null}
        </section>

        {!modules.length && !projects.length && !error ? (
          <p className="empty">Nothing indexed yet — ingest documents or add Projects/ folders.</p>
        ) : null}
      </div>
    </>
  )
}
