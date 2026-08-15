import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import Markdown from 'react-markdown'
import { api, type ChatMode, type LearnedMemory, type Source } from '../api'
import NeuralSearchViz from '../components/brain/NeuralSearchViz'
import { useBrainTrace } from '../hooks/useBrainTrace'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  mode?: string
  saved?: boolean
  learned?: LearnedMemory[]
  retrieval?: string
}

function retrievalTag(retrieval?: string, sources?: Source[]): {
  label: string
  kind: 'archive' | 'web' | 'archive+web' | 'tools'
} | null {
  const kind =
    retrieval ||
    (() => {
      if (!sources?.length) return null
      const ddg = sources.some(
        (s) =>
          (s.heading || '').startsWith('DuckDuckGo') ||
          s.module === 'DuckDuckGo' ||
          (s.chunk_id || '').startsWith('web:ddg'),
      )
      const archive = sources.some(
        (s) =>
          (s.document_id || 0) > 0 &&
          !(s.chunk_id || '').startsWith('web:') &&
          !(s.chunk_id || '').startsWith('tool:'),
      )
      if (archive && ddg) return 'archive+web'
      if (ddg) return 'web'
      if (archive) return 'archive'
      return null
    })()
  if (kind === 'web') return { label: 'Web search', kind: 'web' }
  if (kind === 'archive') return { label: 'RAG', kind: 'archive' }
  if (kind === 'archive+web') return { label: 'RAG + Web search', kind: 'archive+web' }
  if (kind === 'tools') return { label: 'Model answer', kind: 'tools' }
  return null
}

const MODES: { id: ChatMode; label: string; hint: string; placeholder: string }[] = [
  {
    id: 'ask',
    label: 'Ask',
    hint: 'General chat with archive + tools',
    placeholder: 'Ask about your college work…',
  },
  {
    id: 'recall',
    label: 'Recall',
    hint: 'Quote what your documents say',
    placeholder: 'What do my notes say about…',
  },
  {
    id: 'explain',
    label: 'Explain',
    hint: 'Simplify retrieved material',
    placeholder: 'Explain this more simply…',
  },
  {
    id: 'connect',
    label: 'Connect',
    hint: 'Link ideas across modules',
    placeholder: 'How does X connect to Y…',
  },
  {
    id: 'revision',
    label: 'Revision',
    hint: 'Notes + quiz from your files',
    placeholder: 'Revision notes on…',
  },
  {
    id: 'interview',
    label: 'Interview',
    hint: 'Interview answers from your evidence',
    placeholder: 'Interview answer about…',
  },
  {
    id: 'project',
    label: 'Project',
    hint: 'Project brief from your files',
    placeholder: 'Break down my project…',
  },
]

function modeLabel(mode?: string): string | null {
  if (!mode) return null
  return MODES.find((m) => m.id === mode)?.label ?? mode
}

const SUGGESTIONS: { mode: ChatMode; text: string }[] = [
  { mode: 'ask', text: 'What tech shows up in my college work?' },
  { mode: 'interview', text: 'Interview answer: my Linux experience' },
]

function SourceCards({ sources, defaultOpen = false }: { sources: Source[]; defaultOpen?: boolean }) {
  const [showList, setShowList] = useState(defaultOpen)
  const [open, setOpen] = useState<string | null>(null)
  if (!sources.length) return null

  return (
    <div className="sources">
      <button
        type="button"
        className={`sources-toggle${showList ? ' open' : ''}`}
        onClick={() => {
          setShowList((v) => !v)
          if (showList) setOpen(null)
        }}
        aria-expanded={showList}
      >
        <span>
          {sources.length} source{sources.length === 1 ? '' : 's'}
        </span>
        <span className="sources-toggle-action">{showList ? 'Hide' : 'Show'}</span>
      </button>

      {showList &&
        sources.map((s) => {
          const key = s.chunk_id
          const expanded = open === key
          return (
            <div
              key={key}
              className={`source-card${expanded ? ' open' : ''}`}
              onClick={() => setOpen(expanded ? null : key)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setOpen(expanded ? null : key)
                }
              }}
            >
              <div className="source-title">{s.filename}</div>
              <div className="source-meta">
                {s.page != null
                  ? `Page ${s.page}`
                  : s.heading
                    ? `Section: ${s.heading}`
                    : 'Location unknown'}
                {s.module ? ` · ${s.module}` : ''}
                {s.year ? ` · ${s.year}` : ''}
                {s.score != null ? ` · ${Math.round(s.score * 100)}%` : ''}
                <span className="source-action">{expanded ? 'Hide' : 'Inspect'}</span>
              </div>
              {expanded && <div className="source-preview">{s.text_preview}</div>}
            </div>
          )
        })}
    </div>
  )
}

const SESSION_KEY = 'secondbrain.sessionId'

export default function ChatPage() {
  const [mode, setMode] = useState<ChatMode>('ask')
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [liveSources, setLiveSources] = useState<Source[]>([])
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  // Live network on by default — ambient core always visible; toggle only dims detail.
  const [traceEnabled, setTraceEnabled] = useState(true)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [learnToast, setLearnToast] = useState<string | null>(null)
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const activeMode = MODES.find((m) => m.id === mode) ?? MODES[0]
  const brain = useBrainTrace(true)

  useEffect(() => {
    let cancelled = false
    async function boot(attempt = 0) {
      try {
        const stored = localStorage.getItem(SESSION_KEY)
        if (stored) {
          try {
            const rows = await api.sessionMessages(stored)
            if (cancelled) return
            setSessionId(stored)
            setMessages(
              rows.map((r) => ({
                id: String(r.id),
                role: r.role as 'user' | 'assistant',
                content: r.content,
                sources: r.sources,
                mode: r.mode || undefined,
                saved: true,
                retrieval: r.retrieval || undefined,
              })),
            )
            setReady(true)
            return
          } catch {
            // Stale session, timeout, or backend restarting — fall through to create
            localStorage.removeItem(SESSION_KEY)
          }
        }
        const created = await api.createSession()
        if (cancelled) return
        localStorage.setItem(SESSION_KEY, created.session.id)
        setSessionId(created.session.id)
      } catch {
        if (attempt < 2 && !cancelled) {
          window.setTimeout(() => void boot(attempt + 1), 700 * (attempt + 1))
          return
        }
        if (!cancelled) {
          setSessionId(crypto.randomUUID())
          setError(
            'Could not reach the API to load chat. If you just started ingest, wait or restart the backend, then refresh.',
          )
          setReady(true)
        }
        return
      }
      if (!cancelled) setReady(true)
    }
    void boot()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!learnToast) return
    const t = window.setTimeout(() => setLearnToast(null), 4500)
    return () => window.clearTimeout(t)
  }, [learnToast])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: streaming ? 'auto' : 'smooth' })
  }, [messages, busy, liveSources.length, streaming])

  async function ask(text: string, overrideMode?: ChatMode) {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    let sid = sessionId
    if (!sid) {
      try {
        const created = await api.createSession()
        sid = created.session.id
        localStorage.setItem(SESSION_KEY, sid)
        setSessionId(sid)
      } catch {
        sid = crypto.randomUUID()
        setSessionId(sid)
      }
    }
    const useMode = overrideMode ?? mode
    if (overrideMode) setMode(overrideMode)
    setError(null)
    setInput('')
    const history = messages.map(({ role, content }) => ({ role, content }))
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'user', content: trimmed }])
    setLiveSources([])
    // Always restart the brain viz on send so chat never feels like a blank box.
    brain.beginTurn()
    setBusy(true)
    const assistantId = crypto.randomUUID()
    let streamed = false
    setStreaming(false)
    try {
      let learnedPayload: { memories: LearnedMemory[]; session_saved: boolean; message: string } | null =
        null
      const res = await api.chatStream(
        trimmed,
        useMode,
        history,
        {
          onTrace: (ev) => brain.enqueue(ev),
          onToken: (text, replace) => {
            if (!text) return
            if (!streamed) {
              streamed = true
              setStreaming(true)
              setMessages((m) => [
                ...m,
                {
                  id: assistantId,
                  role: 'assistant',
                  content: text,
                  mode: useMode,
                },
              ])
              return
            }
            setMessages((m) =>
              m.map((msg) =>
                msg.id === assistantId
                  ? { ...msg, content: replace ? text : `${msg.content}${text}` }
                  : msg,
              ),
            )
          },
          onFile: (source) => {
            setLiveSources((prev) => {
              if (prev.some((s) => s.chunk_id === source.chunk_id)) return prev
              return [...prev, source]
            })
          },
          onLearned: (ev) => {
            learnedPayload = {
              memories: ev.memories || [],
              session_saved: ev.session_saved,
              message: ev.message,
            }
            if (ev.message) setLearnToast(ev.message)
          },
        },
        sid,
      )
      setMessages((m) => {
        const next = {
          id: assistantId,
          role: 'assistant' as const,
          content: res.answer || '(See sources below.)',
          sources: res.sources,
          mode: res.mode,
          saved: learnedPayload?.session_saved ?? Boolean(sid),
          learned: learnedPayload?.memories || [],
          retrieval: res.retrieval,
        }
        if (streamed) {
          return m.map((msg) => (msg.id === assistantId ? next : msg))
        }
        return [...m, next]
      })
      setLiveSources(res.sources || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      if (streamed) {
        setMessages((m) => m.filter((msg) => msg.id !== assistantId))
      }
    } finally {
      setBusy(false)
      setStreaming(false)
      brain.finishIfSearching()
      // Quiet mode: after the answer, fold back to ambient core (keep cool, not sticky map).
      if (!traceEnabled) {
        window.setTimeout(() => brain.reset(), 1600)
      }
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void ask(input)
  }

  async function newChat() {
    setMessages([])
    setError(null)
    setInput('')
    setLiveSources([])
    brain.reset()
    try {
      const created = await api.createSession()
      localStorage.setItem(SESSION_KEY, created.session.id)
      setSessionId(created.session.id)
    } catch {
      const sid = crypto.randomUUID()
      localStorage.setItem(SESSION_KEY, sid)
      setSessionId(sid)
    }
  }

  const showHero = messages.length === 0 && !busy
  const networkDetailed = traceEnabled

  if (!ready) {
    return (
      <div className="page-header">
        <div>
          <h2>Chat</h2>
          <p>Loading saved conversation…</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Chat</h2>
        </div>
        <div className="page-header-actions">
          <button
            className={`ghost-btn${traceEnabled ? ' active' : ''}`}
            type="button"
            onClick={() => setTraceEnabled((v) => !v)}
            title="Keep the full search map after answers (off = ambient core only)"
          >
            Map: {traceEnabled ? 'KEEP' : 'FADE'}
          </button>
          <button className="ghost-btn" type="button" onClick={() => void newChat()}>
            New chat
          </button>
        </div>
      </div>

      {learnToast ? (
        <div className="learn-toast" role="status">
          <span className="learn-toast-dot" />
          {learnToast}
        </div>
      ) : null}

      <div
        className={`content chat-surface has-network has-ambient${busy || brain.searching ? ' is-searching' : ''}${brain.settled && !brain.searching ? ' is-settled' : ''}${networkDetailed ? ' network-detailed' : ' network-quiet'}`}
      >
        <div className="neural-backdrop-fill" aria-hidden={false}>
          <NeuralSearchViz
            graph={brain.graph}
            searching={brain.searching || busy}
            settled={brain.settled && !brain.searching}
            statusText={brain.statusText}
            pulseToId={brain.pulseToId}
            matchCount={brain.matchCount}
            sourceCount={brain.sourceCount}
            scanned={brain.scanned}
            totalDocs={brain.totalDocs}
            elapsedMs={brain.elapsedMs}
            onSelectNode={brain.selectNode}
            selectedSource={networkDetailed ? brain.selectedSource : null}
          />
        </div>

        <div className="chat-foreground">
          {showHero && (
            <div className="chat-hero">
              <h3>CharlesGPT</h3>
              <p>Ask about your coursework, projects, or anything else.</p>
              <div className="suggestion-row">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.text}
                    type="button"
                    className="suggestion"
                    onClick={() => void ask(s.text, s.mode)}
                  >
                    {s.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="message-list">
            {messages.map((msg) => {
              const sourceTag = msg.role === 'assistant' ? retrievalTag(msg.retrieval, msg.sources) : null
              const askTag = msg.role === 'assistant' ? modeLabel(msg.mode) : null
              return (
              <div key={msg.id} className={`message ${msg.role}`}>
                <div className="message-role">
                  {msg.role === 'user' ? 'You' : 'CharlesGPT'}
                  {askTag ? <span className="tag">{askTag}</span> : null}
                  {sourceTag ? (
                    <span
                      className={`tag${
                        sourceTag.kind === 'web' || sourceTag.kind === 'archive+web'
                          ? ' tag-web'
                          : sourceTag.kind === 'archive'
                            ? ' tag-archive'
                            : ' tag-direct'
                      }`}
                      title={
                        sourceTag.kind === 'web'
                          ? 'Answer used DuckDuckGo web search'
                          : sourceTag.kind === 'archive'
                            ? 'Answer used RAG over your college files'
                            : sourceTag.kind === 'archive+web'
                              ? 'Answer used RAG plus DuckDuckGo web search'
                              : 'Answered by the local model without RAG or web search'
                      }
                    >
                      {sourceTag.label}
                    </span>
                  ) : null}
                  {msg.role === 'assistant' && msg.saved ? (
                    <span className="tag tag-saved">Saved</span>
                  ) : null}
                  {msg.role === 'assistant' && msg.learned && msg.learned.length > 0 ? (
                    <span className="tag tag-learned">Learned {msg.learned.length}</span>
                  ) : null}
                </div>
                {msg.role === 'assistant' ? (
                  <div className={`message-body md${streaming && msg.id === messages[messages.length - 1]?.id ? ' streaming' : ''}`}>
                    <Markdown>{msg.content}</Markdown>
                  </div>
                ) : (
                  <div className="message-body">{msg.content}</div>
                )}
                {msg.learned && msg.learned.length > 0 ? (
                  <div className="learned-chips">
                    {msg.learned.map((m) => (
                      <div key={m.id} className="learned-chip" title={m.content}>
                        {m.content.length > 90 ? `${m.content.slice(0, 87)}…` : m.content}
                      </div>
                    ))}
                  </div>
                ) : null}
                {msg.sources && msg.sources.length > 0 ? (
                  <SourceCards sources={msg.sources} defaultOpen={false} />
                ) : null}
              </div>
              )
            })}

            {busy && !streaming && !brain.searching && !brain.hasNetwork ? (
              <div className="message assistant composing">
                <div className="message-role">CharlesGPT</div>
                <div className="thinking" aria-label="Searching">
                  <span />
                  <span />
                  <span />
                  {brain.statusText || 'Searching academic memory…'}
                </div>
              </div>
            ) : null}

            {error && <div className="error">{error}</div>}
            <div ref={bottomRef} />
          </div>
        </div>
      </div>

      <form className="composer" onSubmit={onSubmit}>
        <div className="composer-controls">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              title={m.hint}
              className={`mode-pill${mode === m.id ? ' active' : ''}`}
              onClick={() => setMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="composer-row">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={activeMode.placeholder}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void ask(input)
              }
            }}
          />
          <button className="primary-btn" type="submit" disabled={busy || !input.trim()}>
            {busy ? 'Working…' : 'Send'}
          </button>
        </div>
      </form>
    </>
  )
}
