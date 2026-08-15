import { useEffect, useMemo, useState } from 'react'
import { api, type DocumentItem, type IngestJobStatus, type IngestProgress } from '../api'

export default function LibraryPage() {
  const [docs, setDocs] = useState<DocumentItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [year, setYear] = useState('')
  const [module, setModule] = useState('')
  const [docType, setDocType] = useState('')
  const [ingesting, setIngesting] = useState(false)
  const [ingestMsg, setIngestMsg] = useState<string | null>(null)
  const [progress, setProgress] = useState<IngestProgress | null>(null)

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

  // Resume progress UI if a job is already running when the page opens
  useEffect(() => {
    let cancelled = false
    let timer: number | null = null

    function stop() {
      if (timer != null) {
        window.clearInterval(timer)
        timer = null
      }
    }

    async function pollExisting() {
      try {
        const job = await api.ingestStatus()
        if (cancelled) return
        if (job.status !== 'running') return
        setIngesting(true)
        setProgress(job.progress || null)
        setIngestMsg(job.progress?.message || 'Ingest running…')
        timer = window.setInterval(() => {
          void (async () => {
            try {
              const next = await api.ingestStatus()
              if (cancelled) return
              if (applyJob(next)) stop()
            } catch {
              /* ignore transient poll errors */
            }
          })()
        }, 900)
      } catch {
        /* ignore */
      }
    }

    void pollExisting()
    return () => {
      cancelled = true
      stop()
    }
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

  function applyJob(job: IngestJobStatus): boolean {
    if (job.progress) setProgress({ ...job.progress })
    if (job.status === 'running') {
      setIngestMsg(job.progress?.message || 'Ingest running…')
      return false
    }
    if (job.status === 'error') {
      setIngestMsg(job.error || 'Ingest failed')
      setIngesting(false)
      return true
    }
    if (job.status === 'done' && job.result) {
      const res = job.result
      setIngestMsg(
        `Found ${res.files_found}. New ${res.processed}, updated ${res.updated}, skipped ${res.skipped}, chunks ${res.chunks_created}, errors ${res.errors}.`,
      )
      setIngesting(false)
      void load()
      return true
    }
    setIngestMsg('Ingest finished.')
    setIngesting(false)
    void load()
    return true
  }

  async function runIngest() {
    setIngesting(true)
    setIngestMsg('Starting ingest…')
    setProgress(null)
    try {
      await api.ingest()
      for (;;) {
        await new Promise((r) => window.setTimeout(r, 900))
        const job = await api.ingestStatus()
        if (applyJob(job)) break
      }
    } catch (err) {
      setIngestMsg(err instanceof Error ? err.message : String(err))
      setIngesting(false)
    }
  }

  const pct =
    progress && progress.total_files > 0
      ? Math.min(100, Math.round((progress.current_index / progress.total_files) * 100))
      : ingesting
        ? 4
        : 0

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Library</h2>
          <p>Indexed college documents — originals stay untouched on disk.</p>
        </div>
        <button className="primary-btn" type="button" onClick={() => void runIngest()} disabled={ingesting}>
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

        {(ingesting || progress || ingestMsg) && (
          <div className={`ingest-panel${ingesting ? ' active' : ''}`}>
            <div className="ingest-panel-top">
              <div>
                <strong>{ingesting ? 'Ingest in progress' : 'Last ingest'}</strong>
                <p>{progress?.message || ingestMsg}</p>
              </div>
              {progress && progress.total_files > 0 ? (
                <span className="ingest-pct">
                  {progress.current_index}/{progress.total_files} · {pct}%
                </span>
              ) : null}
            </div>
            <div className="ingest-bar" aria-hidden>
              <div className="ingest-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            {progress?.current_file ? (
              <p className="ingest-current">
                <span>Current</span> {progress.current_file}
              </p>
            ) : null}
            {progress ? (
              <div className="ingest-stats">
                <span>New {progress.processed}</span>
                <span>Updated {progress.updated}</span>
                <span>Skipped {progress.skipped}</span>
                <span>Chunks {progress.chunks_created}</span>
                <span>Errors {progress.errors}</span>
              </div>
            ) : null}
            {progress?.recent?.length ? (
              <ul className="ingest-log">
                {[...progress.recent].reverse().map((line, i) => (
                  <li key={`${line}-${i}`}>{line}</li>
                ))}
              </ul>
            ) : null}
            {!ingesting && ingestMsg && !progress?.recent?.length ? (
              <p className="notice" style={{ margin: 0 }}>
                {ingestMsg}
              </p>
            ) : null}
          </div>
        )}

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
