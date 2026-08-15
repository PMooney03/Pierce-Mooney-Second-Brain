import { useEffect, useMemo, useState } from 'react'
import { api, type DocumentItem } from '../api'

export default function LibraryPage() {
  const [docs, setDocs] = useState<DocumentItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [year, setYear] = useState('')
  const [module, setModule] = useState('')
  const [docType, setDocType] = useState('')
  const [ingesting, setIngesting] = useState(false)
  const [ingestMsg, setIngestMsg] = useState<string | null>(null)

  async function load() {
    try {
      const params: Record<string, string> = {}
      if (q) params.q = q
      if (year) params.year = year
      if (module) params.module = module
      if (docType) params.document_type = docType
      setDocs(await api.documents(params))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const years = useMemo(
    () => Array.from(new Set(docs.map((d) => d.year).filter(Boolean))) as string[],
    [docs],
  )
  const modules = useMemo(
    () => Array.from(new Set(docs.map((d) => d.module).filter(Boolean))) as string[],
    [docs],
  )
  const types = useMemo(
    () => Array.from(new Set(docs.map((d) => d.document_type).filter(Boolean))) as string[],
    [docs],
  )

  async function runIngest() {
    setIngesting(true)
    setIngestMsg('Starting ingest…')
    try {
      await api.ingest()
      // Background job — poll until finished
      for (;;) {
        await new Promise((r) => window.setTimeout(r, 1500))
        const job = await api.ingestStatus()
        if (job.status === 'running') {
          setIngestMsg('Ingest running in the background (OCR/embed can take a while)…')
          continue
        }
        if (job.status === 'error') {
          setIngestMsg(job.error || 'Ingest failed')
          break
        }
        if (job.status === 'done' && job.result) {
          const res = job.result
          setIngestMsg(
            `Found ${res.files_found}. New ${res.processed}, updated ${res.updated}, skipped ${res.skipped}, chunks ${res.chunks_created}, errors ${res.errors}.`,
          )
          await load()
          break
        }
        setIngestMsg('Ingest finished.')
        await load()
        break
      }
    } catch (err) {
      setIngestMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setIngesting(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Library</h2>
          <p>Indexed college documents — originals stay untouched on disk.</p>
        </div>
        <button className="primary-btn" type="button" onClick={runIngest} disabled={ingesting}>
          {ingesting ? 'Ingesting…' : 'Run ingest'}
        </button>
      </div>
      <div className="content">
        <div className="filters">
          <input placeholder="Filename" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">All years</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <select value={module} onChange={(e) => setModule(e.target.value)}>
            <option value="">All modules</option>
            {modules.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select value={docType} onChange={(e) => setDocType(e.target.value)}>
            <option value="">All types</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button className="ghost-btn" type="button" onClick={() => void load()}>
            Apply
          </button>
        </div>
        {ingestMsg && <p className="notice">{ingestMsg}</p>}
        {error && <div className="error">{error}</div>}
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Filename</th>
                <th>Path</th>
                <th>Type</th>
                <th>Year</th>
                <th>Module</th>
                <th>Status</th>
                <th>Chunks</th>
                <th>Indexed</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id}>
                  <td>{d.filename}</td>
                  <td>{d.filepath}</td>
                  <td>
                    <span className="badge">{d.file_type}</span>
                  </td>
                  <td>{d.year || '—'}</td>
                  <td>{d.module || '—'}</td>
                  <td>{d.status}</td>
                  <td>{d.chunk_count}</td>
                  <td>{d.ingested_at || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!docs.length && !error && <p className="empty">No indexed documents yet. Run ingest.</p>}
      </div>
    </>
  )
}
