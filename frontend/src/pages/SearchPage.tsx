import { useState } from 'react'
import type { FormEvent } from 'react'
import { api, type SearchResult } from '../api'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState('hybrid')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<SearchResult[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setBusy(true)
    setError(null)
    setSearched(true)
    try {
      const res = await api.search(query.trim(), mode)
      setResults(res.results)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Search</h2>
          <p>Exact and semantic retrieval — no LLM generation, just evidence from your files.</p>
        </div>
      </div>
      <div className="content">
        <form className="filters" onSubmit={onSubmit}>
          <input
            style={{ flex: 1, minWidth: 220 }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Exact phrase or concept (e.g. NIS2, Docker)"
          />
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="hybrid">Hybrid</option>
            <option value="keyword">Keyword (FTS5)</option>
            <option value="semantic">Semantic</option>
          </select>
          <button className="primary-btn" type="submit" disabled={busy}>
            {busy ? 'Searching…' : 'Search'}
          </button>
        </form>
        {error && <div className="error">{error}</div>}
        {!results.length && !busy && (
          <div className="empty">
            {searched ? 'No matching chunks.' : 'Try an exact acronym or a concept from your modules.'}
          </div>
        )}
        <div className="result-list">
          {results.map((r, i) => {
            const open = openId === r.chunk_id
            return (
              <div
                key={r.chunk_id}
                className="result-card"
                style={{ animationDelay: `${i * 40}ms` }}
                onClick={() => setOpenId(open ? null : r.chunk_id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <div className="source-title">{r.filename}</div>
                  {r.hybrid_score != null && <span className="badge">{r.hybrid_score.toFixed(3)}</span>}
                </div>
                <div className="source-meta">
                  {r.page_start != null
                    ? `Page ${r.page_start}${r.page_end && r.page_end !== r.page_start ? `–${r.page_end}` : ''}`
                    : r.heading
                      ? `Section: ${r.heading}`
                      : 'Location unknown'}
                  {r.module ? ` · ${r.module}` : ''}
                  {r.year ? ` · ${r.year}` : ''}
                </div>
                <div className="source-preview" style={{ marginTop: '0.65rem', borderTop: 'none', paddingTop: 0 }}>
                  {open ? r.text : r.text_preview}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
