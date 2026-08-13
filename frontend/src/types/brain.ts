import type { Source } from '../api'

export type BrainNodeType =
  | 'brain'
  | 'year'
  | 'module'
  | 'project'
  | 'document'
  | 'topic'
  | 'other'

export type BrainNodeState =
  | 'idle'
  | 'queued'
  | 'searching'
  | 'scanned'
  | 'possible_match'
  | 'matched'
  | 'selected'
  | 'faded'

export type BrainNode = {
  id: string
  type: BrainNodeType
  label: string
  state: BrainNodeState
  parentId: string | null
  documentCount?: number | null
  score?: number | null
  matchType?: string | null
  source?: Source | null
  x?: number
  y?: number
}

export type BrainEdge = {
  id: string
  from: string
  to: string
  hot?: boolean
}

export type BrainStats = {
  documents?: number
  years?: number
  modules?: number
  candidates?: number
  strongMatches?: number
  /** Cumulative docs from scopes visited so far (real inventory counts). */
  scanned?: number
}

export type BrainGraphState = {
  nodes: Record<string, BrainNode>
  edges: BrainEdge[]
  statusText: string
  topic: string | null
  stats: BrainStats
  searching: boolean
  selectedId: string | null
  settled: boolean
  /** Latest node that should pulse a path from the core. */
  pulseToId: string | null
  startedAt: number | null
  finishedAt: number | null
}

export const BRAIN_ID = 'brain:core'

/** Search starts from the core only — years/modules grow from real events. */
export function emptyBrainState(): BrainGraphState {
  return {
    nodes: {
      [BRAIN_ID]: {
        id: BRAIN_ID,
        type: 'brain',
        label: 'CharlesGPT',
        state: 'idle',
        parentId: null,
      },
    },
    edges: [],
    statusText: '',
    topic: null,
    stats: {},
    searching: false,
    selectedId: null,
    settled: false,
    pulseToId: null,
    startedAt: null,
    finishedAt: null,
  }
}
