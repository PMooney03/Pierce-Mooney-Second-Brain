import { useEffect, useState } from 'react'
import { api } from '../api'

export default function KnowledgePage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .knowledge()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  const years = (data?.years as Array<{ name: string; document_count: number }>) || []
  const modules = (data?.modules as Array<{ name: string; year: string | null; document_count: number }>) || []
  const projects = (data?.projects as Array<Record<string, unknown>>) || []

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Knowledge</h2>
          <p>College profile foundations — years, modules, and projects linked to indexed evidence.</p>
        </div>
      </div>
      <div className="content">
        {error && <div className="error">{error}</div>}
        {data?.note ? <p className="notice">{String(data.note)}</p> : null}

        <h3 className="section-title">Years</h3>
        <div className="knowledge-grid">
          {years.map((y, i) => (
            <div className="knowledge-card" key={y.name} style={{ animationDelay: `${i * 40}ms` }}>
              <h3>{y.name}</h3>
              <p>{y.document_count} documents</p>
            </div>
          ))}
        </div>

        <h3 className="section-title">Modules</h3>
        <div className="knowledge-grid">
          {modules.slice(0, 24).map((m, i) => (
            <div
              className="knowledge-card"
              key={`${m.year}-${m.name}`}
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <h3>{m.name}</h3>
              <p>
                {m.year || '—'} · {m.document_count} docs
              </p>
            </div>
          ))}
        </div>

        <h3 className="section-title">Projects</h3>
        <div className="knowledge-grid">
          {projects.map((p, i) => {
            const name = String(p.name || p.filename || '')
            if (!name) return null
            return (
              <div className="knowledge-card" key={name} style={{ animationDelay: `${i * 30}ms` }}>
                <h3>{name}</h3>
                <p>
                  {p.folder ? String(p.folder) : 'Projects'}
                  {p.file_count != null ? ` · ${String(p.file_count)} files` : ''}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
