import { useEffect, useState } from 'react'
import { api } from '../api'

export default function ModulesPage() {
  const [items, setItems] = useState<Array<{ name: string; year: string | null; document_count: number }>>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .modules()
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Modules</h2>
          <p>Derived from folder metadata on indexed documents.</p>
        </div>
      </div>
      <div className="content">
        {error && <div className="error">{error}</div>}
        <div className="knowledge-grid">
          {items.map((m, i) => (
            <div
              className="knowledge-card"
              key={`${m.year}-${m.name}`}
              style={{ animationDelay: `${i * 35}ms` }}
            >
              <h3>{m.name}</h3>
              <p>
                {m.year || 'Year unknown'} · {m.document_count} documents
              </p>
            </div>
          ))}
        </div>
        {!items.length && !error && <p className="empty">No modules yet — ingest documents first.</p>}
      </div>
    </>
  )
}
