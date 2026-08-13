import { useCallback, useEffect, useState } from 'react'
import { api, type LearnedMemory } from '../api'

export default function MemoryPage() {
  const [items, setItems] = useState<LearnedMemory[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await api.memories(80)
      setItems(rows.map((r) => ({ id: r.id, content: r.content, kind: r.kind || 'learned' })))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Memory</h2>
          <p>
            Things CharlesGPT has learned from your chats. Say <em>remember that…</em>,{' '}
            <em>what do you remember</em>, or <em>forget everything</em> in Chat anytime.
          </p>
        </div>
        <div className="page-header-actions">
          <button className="ghost-btn" type="button" onClick={() => void load()} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>
      <div className="content memory-page">
        {error && <div className="error">{error}</div>}
        {!loading && !error && items.length === 0 ? (
          <p className="empty">Nothing learned yet — chat normally and useful facts will land here.</p>
        ) : null}
        <ul className="memory-bank-list">
          {items.map((m, i) => (
            <li key={m.id} className="memory-bank-item" style={{ animationDelay: `${i * 28}ms` }}>
              <span className={`memory-kind ${m.kind || 'learned'}`}>{m.kind || 'learned'}</span>
              <span className="memory-bank-text">{m.content}</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
