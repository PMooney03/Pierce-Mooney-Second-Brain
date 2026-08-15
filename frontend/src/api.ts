export type ChatMode =
  | 'ask'
  | 'recall'
  | 'search'
  | 'explain'
  | 'connect'
  | 'revision'
  | 'interview'
  | 'project'

export interface Source {
  document_id: number
  chunk_id: string
  filename: string
  filepath: string
  page: number | null
  heading: string | null
  text_preview: string
  year: string | null
  module: string | null
  score?: number | null
  match_type?: string | null
  semantic_score?: number | null
  keyword_score?: number | null
}

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatResponse {
  answer: string
  sources: Source[]
  mode: string
  model: string
  retrieval?: string
}

export type TraceEvent = {
  event: string
  [key: string]: unknown
}

export type LearnedMemory = {
  id: number
  content: string
  kind?: string
}

export type LearnedEvent = {
  event: 'learned'
  session_saved: boolean
  memory_ids: number[]
  memories: LearnedMemory[]
  message: string
}

export type ChatStreamHandlers = {
  onStatus?: (message: string, node?: string) => void
  onFile?: (source: Source, node?: string) => void
  onTrace?: (event: TraceEvent) => void
  onLearned?: (event: LearnedEvent) => void
  onDone?: () => void
  onError?: (message: string) => void
}

const TRACE_KINDS = new Set([
  'trace_started',
  'scope',
  'phase',
  'module',
  'match',
  'stats',
  'sources_selected',
  'trace_complete',
  'status',
  'file',
  'learned',
  'retrieval',
])

export async function chatStream(
  message: string,
  mode: ChatMode,
  history: ChatTurn[],
  handlers: ChatStreamHandlers = {},
  sessionId?: string | null,
): Promise<ChatResponse> {
  const res = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, mode, history, session_id: sessionId || undefined }),
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail || JSON.stringify(body)
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }
  if (!res.body) throw new Error('No stream body')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finalAnswer: ChatResponse | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      let event: TraceEvent
      try {
        event = JSON.parse(trimmed) as TraceEvent
      } catch {
        continue
      }
      const kind = event.event
      if (TRACE_KINDS.has(String(kind))) {
        handlers.onTrace?.(event)
      }
      if (kind === 'status') {
        handlers.onStatus?.(String(event.message || ''), event.node as string | undefined)
      } else if (kind === 'file' && event.source) {
        handlers.onFile?.(event.source as Source, event.node as string | undefined)
      } else if (kind === 'answer') {
        finalAnswer = {
          answer: String(event.answer || ''),
          sources: (event.sources as Source[]) || [],
          mode: String(event.mode || mode),
          model: String(event.model || ''),
          retrieval: event.retrieval ? String(event.retrieval) : undefined,
        }
      } else if (kind === 'learned') {
        handlers.onLearned?.(event as unknown as LearnedEvent)
      } else if (kind === 'done') {
        handlers.onDone?.()
      } else if (kind === 'error') {
        handlers.onError?.(String(event.message || 'Stream error'))
        throw new Error(String(event.message || 'Stream error'))
      }
    }
  }

  if (!finalAnswer) throw new Error('Stream ended without an answer')
  return finalAnswer
}

export interface SearchResult {
  chunk_id: string
  document_id: number
  filename: string
  filepath: string
  page_start: number | null
  page_end: number | null
  heading: string | null
  year: string | null
  module: string | null
  document_type: string | null
  text_preview: string
  text: string
  hybrid_score: number | null
  semantic_score: number | null
  keyword_score: number | null
}

export interface DocumentItem {
  id: number
  filepath: string
  filename: string
  file_type: string
  file_size: number
  status: string
  year: string | null
  module: string | null
  document_type: string | null
  chunk_count: number
  ingested_at: string | null
  modified_at: string | null
  error_message: string | null
}

export interface ProjectCard {
  name: string
  folder: string
  file_count: number
  dir_count: number
  has_readme: boolean
}

export interface ProjectBrowseEntry {
  name: string
  kind: 'dir' | 'file'
  size: number | null
  ext?: string | null
}

export interface ProjectBrowse {
  name: string
  folder: string
  path: string
  breadcrumbs: string[]
  entries: ProjectBrowseEntry[]
}

export interface ProjectFileView {
  name: string
  path: string
  filename: string
  size: number | null
  ext: string | null
  readable: boolean
  text: string | null
  is_markdown: boolean
}

export interface HealthResponse {
  status: string
  ollama: {
    ok: boolean
    reachable: boolean
    error: string | null
    chat_model: string
    embed_model: string
  }
  config: {
    chat_model: string
    embed_model: string
    top_k: number
  }
}

export interface IngestJobStatus {
  status: 'idle' | 'running' | 'done' | 'error' | string
  started_at: string | null
  finished_at: string | null
  error: string | null
  result: {
    files_found: number
    processed: number
    skipped: number
    updated: number
    deleted: number
    errors: number
    chunks_created: number
    details?: string[]
  } | null
}

async function request<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const { timeoutMs, ...rest } = init || {}
  const controller = new AbortController()
  const timer =
    timeoutMs && timeoutMs > 0
      ? window.setTimeout(() => controller.abort(), timeoutMs)
      : null
  try {
    const isForm = typeof FormData !== 'undefined' && rest.body instanceof FormData
    const headers: Record<string, string> = { ...(rest.headers as Record<string, string> | undefined) }
    if (!isForm && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json'
    }
    const res = await fetch(path, {
      ...rest,
      signal: controller.signal,
      headers,
    })
    if (!res.ok) {
      let detail = res.statusText
      try {
        const body = await res.json()
        detail = body.detail || JSON.stringify(body)
      } catch {
        /* ignore */
      }
      throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
    }
    return res.json() as Promise<T>
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Request timed out — is the API busy or offline?')
    }
    throw err
  } finally {
    if (timer != null) window.clearTimeout(timer)
  }
}

export const api = {
  health: () => request<HealthResponse>('/api/health'),
  chat: (message: string, mode: ChatMode, history: ChatTurn[] = [], sessionId?: string | null) =>
    request<ChatResponse>('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message, mode, history, session_id: sessionId || undefined }),
    }),
  chatStream,
  createSession: () =>
    request<{ session: { id: string; title: string | null; created_at: string; updated_at: string } }>(
      '/api/chat/sessions',
      { method: 'POST', body: '{}', timeoutMs: 8000 },
    ),
  listSessions: () =>
    request<Array<{ id: string; title: string | null; created_at: string; updated_at: string }>>(
      '/api/chat/sessions',
      { timeoutMs: 8000 },
    ),
  sessionMessages: (sessionId: string) =>
    request<
      Array<{
        id: number
        session_id: string
        role: string
        content: string
        mode: string | null
        sources: Source[]
        retrieval?: string | null
        created_at: string
      }>
    >(`/api/chat/sessions/${encodeURIComponent(sessionId)}/messages`, { timeoutMs: 8000 }),
  deleteSession: (sessionId: string) =>
    request<{ ok: boolean }>(`/api/chat/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    }),
  memories: (limit = 40) =>
    request<Array<{ id: number; content: string; kind?: string; created_at?: string; updated_at?: string }>>(
      `/api/memories?limit=${limit}`,
    ),
  search: (query: string, mode = 'hybrid') =>
    request<{ query: string; mode: string; results: SearchResult[] }>('/api/search', {
      method: 'POST',
      body: JSON.stringify({ query, mode }),
    }),
  documents: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request<DocumentItem[]>(`/api/documents${qs}`)
  },
  document: (id: number) => request<{ document: DocumentItem; chunks: unknown[] }>(`/api/documents/${id}`),
  chunk: (id: string) => request<SearchResult & { text: string }>(`/api/chunks/${id}`),
  modules: () => request<Array<{ name: string; year: string | null; document_count: number }>>('/api/modules'),
  projects: () => request<ProjectCard[]>('/api/project-folders'),
  projectBrowse: (name: string, path = '') => {
    const qs = path ? `?path=${encodeURIComponent(path)}` : ''
    return request<ProjectBrowse>(`/api/projects/${encodeURIComponent(name)}/browse${qs}`)
  },
  projectFile: (name: string, path: string) =>
    request<ProjectFileView>(
      `/api/projects/${encodeURIComponent(name)}/file?path=${encodeURIComponent(path)}`,
    ),
  knowledge: () => request<Record<string, unknown>>('/api/knowledge'),
  ingest: () =>
    request<{
      status: string
      started_at: string | null
      message: string
      job: IngestJobStatus
    }>('/api/ingest', { method: 'POST', timeoutMs: 15000 }),
  ingestStatus: () => request<IngestJobStatus>('/api/ingest/status', { timeoutMs: 8000 }),
}
