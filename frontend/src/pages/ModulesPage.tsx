import { useEffect, useMemo, useState } from 'react'
import { api, type DocumentItem } from '../api'

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
  // Real college years stay as-is (Year 1, Year 2, …)
  if (/^year\s*\d+$/i.test(trimmed)) return trimmed
  // Anything else that landed without a proper year bucket
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

export default function ModulesPage() {
  const [items, setItems] = useState<ModuleCard[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<ModuleCard | null>(null)
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
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api
      .modules()
      .then((rows) =>
        setItems(
          rows.map((m) => ({
            name: m.name,
            year: m.year,
            document_count: m.document_count,
          })),
        ),
      )
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  const grouped = useMemo(() => {
    const map = new Map<string, ModuleCard[]>()
    for (const m of items) {
      const key = yearLabel(m.year)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(m)
    }
    return Array.from(map.entries()).sort(([a], [b]) =>
      yearSortKey(a).localeCompare(yearSortKey(b)),
    )
  }, [items])

  async function openModule(mod: ModuleCard) {
    setLoading(true)
    setError(null)
    setActiveDoc(null)
    setSelected(mod)
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
        chunks: (data.chunks as Array<{
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

  function backToModules() {
    setSelected(null)
    setDocs([])
    setActiveDoc(null)
    setError(null)
  }

  if (selected) {
    return (
      <>
        <div className="page-header">
          <div>
            <button className="ghost-btn" type="button" onClick={backToModules}>
              ← All modules
            </button>
            <h2 style={{ marginTop: '0.75rem' }}>{selected.name}</h2>
            <p>
              {yearLabel(selected.year)} · {docs.length || selected.document_count} indexed
              document{(docs.length || selected.document_count) === 1 ? '' : 's'}
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

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Modules</h2>
          <p>Click a module to browse its indexed documents — grouped by year.</p>
        </div>
      </div>
      <div className="content">
        {error ? <div className="error">{error}</div> : null}

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

        {!items.length && !error ? (
          <p className="empty">No modules yet — ingest documents first.</p>
        ) : null}
      </div>
    </>
  )
}
