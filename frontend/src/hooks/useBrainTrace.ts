import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Source, TraceEvent } from '../api'
import {
  BRAIN_ID,
  emptyBrainState,
  type BrainGraphState,
  type BrainNode,
  type BrainNodeState,
  type BrainNodeType,
} from '../types/brain'
import { layoutBrainGraph } from '../utils/brainLayout'

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function scopeId(name: string): string {
  return `scope:${name}`
}

function moduleId(year: string | null | undefined, name: string): string {
  return `mod:${year || 'x'}:${name}`
}

function docId(chunkId: string): string {
  return `doc:${chunkId}`
}

function scopeType(name: string): BrainNodeType {
  if (name === 'Projects') return 'project'
  if (name.startsWith('Year')) return 'year'
  if (name === 'Web' || name === 'Weather' || name === 'Tools') return 'other'
  return 'other'
}

function upsertNode(state: BrainGraphState, node: BrainNode): BrainGraphState {
  return {
    ...state,
    nodes: { ...state.nodes, [node.id]: { ...state.nodes[node.id], ...node } },
  }
}

function setNodeState(state: BrainGraphState, id: string, next: BrainNodeState): BrainGraphState {
  const n = state.nodes[id]
  if (!n) return state
  return upsertNode(state, { ...n, state: next })
}

function applyEvent(state: BrainGraphState, event: TraceEvent): BrainGraphState {
  const kind = event.event
  let next = { ...state, nodes: { ...state.nodes }, stats: { ...state.stats } }

  if (kind === 'trace_started') {
    next = emptyBrainState()
    next.searching = true
    next.settled = false
    next.startedAt = Date.now()
    next.finishedAt = null
    next.topic = (event.topic as string) || null
    next.statusText = 'Searching academic memory…'
    next.pulseToId = BRAIN_ID
    next.nodes[BRAIN_ID] = {
      ...next.nodes[BRAIN_ID],
      state: 'searching',
    }
    return next
  }

  if (kind === 'status') {
    next.statusText = String(event.message || next.statusText)
    return next
  }

  if (kind === 'phase') {
    const phase = String(event.phase || '')
    const fallback =
      phase === 'keyword'
        ? 'Keyword search…'
        : phase === 'semantic'
          ? 'Semantic search…'
          : phase === 'fuse'
            ? 'Fusing rankings…'
            : `Phase: ${phase}`
    next.statusText = (event.message as string) || fallback
    next.nodes[BRAIN_ID] = { ...next.nodes[BRAIN_ID], state: 'searching' }
    return next
  }

  if (kind === 'stats') {
    next.stats = {
      ...next.stats,
      documents: (event.documents as number) ?? next.stats.documents,
      years: (event.years as number) ?? next.stats.years,
      modules: (event.modules as number) ?? next.stats.modules,
      candidates: (event.candidates as number) ?? next.stats.candidates,
      strongMatches: (event.strong_matches as number) ?? next.stats.strongMatches,
    }
    if (event.message) next.statusText = String(event.message)
    return next
  }

  if (kind === 'scope') {
    const name = String(event.scope || 'Other Material')
    const id = scopeId(name)
    const st = (event.state as BrainNodeState) || 'searching'
    const count = (event.document_count as number) ?? null
    const isNew = !next.nodes[id]
    next = upsertNode(next, {
      id,
      type: scopeType(name),
      label: name,
      state: st,
      parentId: BRAIN_ID,
      documentCount: count,
    })
    if (isNew && count != null) {
      next.stats = {
        ...next.stats,
        scanned: (next.stats.scanned || 0) + count,
      }
    }
    next.statusText = `Scanning ${name}…`
    next.pulseToId = id
    next.nodes[BRAIN_ID] = { ...next.nodes[BRAIN_ID], state: 'searching' }
    return next
  }

  if (kind === 'module') {
    const name = String(event.module || 'Module')
    const year = (event.year as string) || null
    const parent = year ? scopeId(year) : BRAIN_ID
    if (year && !next.nodes[scopeId(year)]) {
      next = upsertNode(next, {
        id: scopeId(year),
        type: 'year',
        label: year,
        state: 'searching',
        parentId: BRAIN_ID,
      })
    }
    const id = moduleId(year, name)
    // While the live scan is running, keep modules yellow even if the
    // backend labels them "matched" — files still need to appear.
    const rawState = (event.state as BrainNodeState) || 'searching'
    const st =
      next.searching && (rawState === 'matched' || rawState === 'possible_match')
        ? 'searching'
        : rawState
    next = upsertNode(next, {
      id,
      type: 'module',
      label: name,
      state: st,
      parentId: next.nodes[parent] ? parent : BRAIN_ID,
      documentCount: (event.document_count as number) ?? null,
    })
    if (next.nodes[parent]) next = setNodeState(next, parent, 'searching')
    next.statusText = `Checking ${name}…`
    next.pulseToId = id
    return next
  }

  if (kind === 'match' || kind === 'file') {
    const source = event.source as Source | undefined
    if (!source?.chunk_id) return next
    const scopeName =
      (event.scope as string) ||
      (source.year
        ? source.year
        : (source.filepath || '').toLowerCase().includes('project')
          ? 'Projects'
          : 'Other Material')
    const sId = scopeId(scopeName)
    const probing = next.searching
    // During a live retrieval trace, probe as yellow `searching`.
    // Outside a trace (tool-only file events), land as matched candidates.
    const probeState: BrainNodeState = probing ? 'searching' : 'matched'
    if (!next.nodes[sId]) {
      next = upsertNode(next, {
        id: sId,
        type: scopeType(scopeName),
        label: scopeName,
        state: probeState,
        parentId: BRAIN_ID,
      })
    } else if (next.nodes[sId].state !== 'selected' && next.nodes[sId].state !== 'faded') {
      next = setNodeState(next, sId, probeState)
    }

    let parentId = sId
    if (source.module) {
      const mId = moduleId(source.year, source.module)
      if (!next.nodes[mId]) {
        next = upsertNode(next, {
          id: mId,
          type: 'module',
          label: source.module,
          state: probeState,
          parentId: sId,
        })
      } else if (next.nodes[mId].state !== 'selected' && next.nodes[mId].state !== 'faded') {
        next = setNodeState(next, mId, probeState)
      }
      parentId = mId
    }

    const score = source.score ?? (event.score as number) ?? null
    const strong = score == null || score >= 0.015
    const dId = docId(source.chunk_id)
    const prior = next.nodes[dId]
    const docState: BrainNodeState =
      prior?.state === 'selected'
        ? 'selected'
        : prior?.state === 'faded'
          ? 'faded'
          : probing
            ? 'searching'
            : strong
              ? 'matched'
              : 'possible_match'
    next = upsertNode(next, {
      id: dId,
      type: 'document',
      label: source.filename,
      state: docState,
      parentId,
      score,
      matchType: source.match_type || (event.match_type as string) || null,
      source,
    })
    next.statusText = probing ? `Scanning ${source.filename}…` : `Found ${source.filename}`
    next.pulseToId = dId
    return next
  }

  if (kind === 'sources_selected') {
    const ids = (event.chunk_ids as string[]) || []
    const selected = new Set(ids.map(docId))
    for (const n of Object.values(next.nodes)) {
      if (n.type !== 'document') continue
      if (selected.has(n.id)) {
        next.nodes[n.id] = { ...n, state: 'selected' }
        let p = n.parentId
        while (p && next.nodes[p]) {
          if (next.nodes[p].type !== 'brain') {
            next.nodes[p] = { ...next.nodes[p], state: 'selected' }
          }
          p = next.nodes[p].parentId
        }
      } else if (
        n.state === 'matched' ||
        n.state === 'possible_match' ||
        n.state === 'searching'
      ) {
        next.nodes[n.id] = { ...n, state: 'faded' }
      }
    }
    for (const n of Object.values(next.nodes)) {
      if (n.type === 'year' || n.type === 'project' || n.type === 'other' || n.type === 'module') {
        const hasKeep = Object.values(next.nodes).some(
          (c) =>
            c.parentId === n.id &&
            (c.state === 'selected' || c.state === 'matched' || c.state === 'searching' || c.type === 'module'),
        )
        const selfSelected = n.state === 'selected'
        if (!hasKeep && !selfSelected) {
          next.nodes[n.id] = { ...n, state: 'faded' }
        }
      }
    }
    // Fade modules that have no selected docs
    for (const n of Object.values(next.nodes)) {
      if (n.type !== 'module') continue
      const keep = Object.values(next.nodes).some(
        (c) => c.parentId === n.id && c.state === 'selected',
      )
      if (!keep && n.state !== 'selected') next.nodes[n.id] = { ...n, state: 'faded' }
    }
    next.statusText = 'Selecting strongest evidence…'
    return next
  }

  if (kind === 'trace_complete') {
    next.searching = false
    next.settled = true
    next.finishedAt = Date.now()
    next.nodes[BRAIN_ID] = { ...next.nodes[BRAIN_ID], state: 'selected' }
    next.statusText = 'Generating answer…'
    next.pulseToId = null
    return next
  }

  if (kind === 'trace_rest') {
    return emptyBrainState()
  }

  return next
}

export function useBrainTrace(enabled: boolean) {
  const [raw, setRaw] = useState<BrainGraphState>(() => emptyBrainState())
  const [now, setNow] = useState(() => Date.now())
  const queueRef = useRef<TraceEvent[]>([])
  const timerRef = useRef<number | null>(null)
  const restTimerRef = useRef<number | null>(null)
  const processingRef = useRef(false)
  const tickRef = useRef<number | null>(null)
  const turnRef = useRef(0)

  const flushOne = useCallback(() => {
    const ev = queueRef.current.shift()
    if (!ev) {
      processingRef.current = false
      timerRef.current = null
      return
    }
    setRaw((s) => applyEvent(s, ev))
    // Slight visual buffer so paths are readable; answer stream is independent.
    const delay =
      prefersReducedMotion() || !enabled
        ? 0
        : queueRef.current.length > 30
          ? 12
          : queueRef.current.length > 10
            ? 28
            : 48
    timerRef.current = window.setTimeout(flushOne, delay)
  }, [enabled])

  const clearQueue = useCallback(() => {
    queueRef.current = []
    processingRef.current = false
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (restTimerRef.current) {
      window.clearTimeout(restTimerRef.current)
      restTimerRef.current = null
    }
  }, [])

  const enqueue = useCallback(
    (event: TraceEvent) => {
      // New retrieval must drop any pending visual events from the prior turn
      // and collapse the settled graph immediately — never wait in the delay queue.
      if (event.event === 'trace_started') {
        clearQueue()
        setRaw((s) => applyEvent(s, event))
        return
      }
      if (!enabled) {
        setRaw((s) => applyEvent(s, event))
        return
      }
      queueRef.current.push(event)
      if (!processingRef.current) {
        processingRef.current = true
        timerRef.current = window.setTimeout(flushOne, prefersReducedMotion() ? 0 : 16)
      }
    },
    [clearQueue, enabled, flushOne],
  )

  const reset = useCallback(() => {
    turnRef.current += 1
    clearQueue()
    setRaw(emptyBrainState())
  }, [clearQueue])

  const selectNode = useCallback((id: string | null) => {
    setRaw((s) => ({ ...s, selectedId: id }))
  }, [])

  // Keep beginTurn / finishIfSearching as plain functions (not useCallback) so
  // Fast Refresh does not insert new hook slots ahead of the effects below.
  /** Immediate UI reset on send: core-only + yellow searching (before stream events). */
  function beginTurn() {
    turnRef.current += 1
    clearQueue()
    setRaw(() => {
      const next = emptyBrainState()
      next.searching = true
      next.settled = false
      next.startedAt = Date.now()
      next.finishedAt = null
      next.statusText = 'Searching academic memory…'
      next.pulseToId = BRAIN_ID
      next.nodes[BRAIN_ID] = {
        ...next.nodes[BRAIN_ID],
        state: 'searching',
      }
      return next
    })
  }

  /** Soft-finish when a turn ends without trace_complete (e.g. tools-only ask). */
  function finishIfSearching() {
    const turn = turnRef.current
    const tryFinish = () => {
      if (turn !== turnRef.current) return
      // Wait for delayed visual queue so a pending trace_complete wins first.
      if (queueRef.current.length > 0 || processingRef.current) {
        window.setTimeout(tryFinish, 48)
        return
      }
      if (turn !== turnRef.current) return
      setRaw((s) => {
        if (!s.searching) return s
        const hasOrbit = Object.values(s.nodes).some((n) => n.type !== 'brain')
        if (!hasOrbit) {
          return emptyBrainState()
        }
        return {
          ...s,
          searching: false,
          settled: true,
          finishedAt: Date.now(),
          pulseToId: null,
          nodes: {
            ...s.nodes,
            [BRAIN_ID]: { ...s.nodes[BRAIN_ID], state: 'selected' },
          },
          statusText: s.statusText || 'Done',
        }
      })
    }
    tryFinish()
  }

  useEffect(() => {
    if (!raw.searching || !raw.startedAt) {
      if (tickRef.current) {
        window.clearInterval(tickRef.current)
        tickRef.current = null
      }
      return
    }
    tickRef.current = window.setInterval(() => setNow(Date.now()), 50)
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current)
    }
  }, [raw.searching, raw.startedAt])

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      if (restTimerRef.current) window.clearTimeout(restTimerRef.current)
      if (tickRef.current) window.clearInterval(tickRef.current)
    }
  }, [])

  const graph = useMemo(() => layoutBrainGraph(raw), [raw])

  const selectedSource = useMemo(() => {
    if (!raw.selectedId) return null
    return raw.nodes[raw.selectedId]?.source || null
  }, [raw])

  const matchCount = useMemo(() => {
    return Object.values(raw.nodes).filter(
      (n) =>
        n.type === 'document' &&
        (n.state === 'matched' ||
          n.state === 'selected' ||
          n.state === 'possible_match' ||
          n.state === 'searching'),
    ).length
  }, [raw])

  const sourceCount = useMemo(() => {
    return Object.values(raw.nodes).filter((n) => n.type === 'document' && n.state === 'selected')
      .length
  }, [raw])

  const elapsedMs = useMemo(() => {
    if (!raw.startedAt) return 0
    const end = raw.finishedAt ?? (raw.searching ? now : raw.startedAt)
    return Math.max(0, end - raw.startedAt)
  }, [raw.startedAt, raw.finishedAt, raw.searching, now])

  const hasNetwork = useMemo(() => {
    return Object.values(raw.nodes).some((n) => n.type !== 'brain')
  }, [raw])

  return {
    graph,
    enqueue,
    reset,
    beginTurn,
    finishIfSearching,
    selectNode,
    selectedSource,
    statusText: raw.statusText,
    stats: raw.stats,
    searching: raw.searching,
    settled: raw.settled,
    topic: raw.topic,
    pulseToId: raw.pulseToId,
    matchCount,
    sourceCount,
    elapsedMs,
    scanned: raw.stats.scanned ?? 0,
    totalDocs: raw.stats.documents ?? null,
    hasNetwork,
  }
}
