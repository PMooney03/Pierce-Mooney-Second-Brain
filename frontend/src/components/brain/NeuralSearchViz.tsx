import { useMemo } from 'react'
import type { Source } from '../../api'
import type { BrainGraphState, BrainNode } from '../../types/brain'
import { BRAIN_ID } from '../../types/brain'
import { CX, CY, curveControl, polar, radialLabelOffset, shortLabel } from '../../utils/brainLayout'

type Props = {
  graph: BrainGraphState
  searching: boolean
  settled: boolean
  statusText: string
  pulseToId: string | null
  matchCount: number
  sourceCount: number
  scanned: number
  totalDocs: number | null
  elapsedMs: number
  onSelectNode: (id: string | null) => void
  selectedSource: Source | null
}

const ABSORB_R = 118

/** Ambient star field — varied sizes like the constellation mock. */
const STARDUST: [number, number, number][] = [
  [90, 120, 1.4],
  [150, 260, 0.7],
  [210, 520, 1.1],
  [70, 480, 0.55],
  [280, 160, 0.9],
  [340, 70, 1.3],
  [420, 640, 0.65],
  [480, 720, 1.0],
  [560, 90, 0.8],
  [620, 580, 1.2],
  [680, 200, 0.6],
  [740, 420, 1.5],
  [800, 140, 0.85],
  [860, 300, 1.1],
  [920, 480, 0.7],
  [940, 200, 1.35],
  [180, 700, 0.9],
  [320, 380, 0.5],
  [520, 280, 0.75],
  [780, 660, 1.0],
  [100, 360, 0.8],
  [880, 620, 0.65],
  [250, 80, 0.55],
  [650, 740, 0.9],
  [400, 200, 0.45],
  [720, 50, 0.7],
  [50, 200, 1.0],
  [960, 360, 0.55],
]

function pathIdsToRoot(nodes: Record<string, BrainNode>, toId: string | null): string[] {
  if (!toId || !nodes[toId]) return []
  const chain: string[] = []
  let cur: string | null = toId
  while (cur && nodes[cur]) {
    chain.push(cur)
    cur = nodes[cur].parentId
  }
  return chain
}

function formatElapsed(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`
}

function edgePath(ax: number, ay: number, bx: number, by: number): string {
  const c = curveControl(ax, ay, bx, by)
  return `M ${ax} ${ay} Q ${c.x} ${c.y} ${bx} ${by}`
}

export default function NeuralSearchViz({
  graph,
  searching,
  settled,
  statusText,
  pulseToId,
  matchCount,
  sourceCount,
  scanned,
  totalDocs,
  elapsedMs,
  onSelectNode,
  selectedSource,
}: Props) {
  const phase = searching ? 'searching' : settled ? 'settled' : 'idle'
  const expanded = settled && !searching

  const activeNodes = useMemo(
    () => Object.values(graph.nodes).filter((n) => n.x != null && n.y != null && n.state !== 'faded'),
    [graph.nodes],
  )
  const fadedNodes = useMemo(
    () => Object.values(graph.nodes).filter((n) => n.x != null && n.y != null && n.state === 'faded'),
    [graph.nodes],
  )
  const pulseChain = useMemo(() => new Set(pathIdsToRoot(graph.nodes, pulseToId)), [graph.nodes, pulseToId])

  const absorbed = useMemo(() => {
    const docs = Object.values(graph.nodes).filter(
      (n) =>
        n.type === 'document' &&
        (n.state === 'selected' || n.state === 'matched' || n.state === 'possible_match'),
    )
    const preferred = docs.filter((n) => n.state === 'selected')
    const list = (preferred.length ? preferred : docs)
      .slice()
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 8)
    const n = Math.max(list.length, 1)
    return list.map((doc, i) => {
      const angle = (360 / n) * i - 90
      const pos = polar(angle, ABSORB_R)
      return { ...doc, x: pos.x, y: pos.y, angle }
    })
  }, [graph.nodes])

  const hud = useMemo(() => {
    if (searching) {
      const files =
        totalDocs != null
          ? `${Math.min(scanned || 0, totalDocs)} / ${totalDocs} FILES`
          : scanned
            ? `${scanned} FILES`
            : null
      return files
        ? `SCANNING · ${files} · ${formatElapsed(elapsedMs)}`
        : statusText
          ? statusText.toUpperCase()
          : `SEARCHING · ${formatElapsed(elapsedMs)}`
    }
    if (settled) {
      const files = totalDocs ?? scanned
      const fileBit = files ? `${files} FILES SCANNED` : 'SCAN COMPLETE'
      const matches = matchCount || graph.stats.strongMatches || 0
      const sources = sourceCount || absorbed.length || 0
      return `${fileBit} · ${matches} MATCHES · ${sources} SOURCES · ${formatElapsed(elapsedMs)}`
    }
    return statusText || 'ARCHIVE'
  }, [
    searching,
    settled,
    totalDocs,
    scanned,
    elapsedMs,
    matchCount,
    sourceCount,
    absorbed.length,
    graph.stats.strongMatches,
    statusText,
  ])

  const pulseEdge = useMemo(() => {
    if (!pulseToId || expanded) return null
    const chain = pathIdsToRoot(graph.nodes, pulseToId)
    if (chain.length < 2) return null
    const to = graph.nodes[chain[0]]
    const from = graph.nodes[chain[1]]
    if (!from?.x || !from?.y || !to?.x || !to?.y) return null
    return {
      d: edgePath(from.x, from.y, to.x, to.y),
      key: `${from.id}->${to.id}-${pulseToId}`,
    }
  }, [graph.nodes, pulseToId, expanded])

  const probeTarget = useMemo(() => {
    if (!pulseToId || !graph.nodes[pulseToId]) return null
    const n = graph.nodes[pulseToId]
    if (n.x == null || n.y == null) return null
    return n
  }, [graph.nodes, pulseToId])

  const liveProbes = useMemo(() => {
    return Object.values(graph.nodes)
      .filter((n) => n.type === 'document' && n.state === 'searching')
      .slice(-5)
      .reverse()
  }, [graph.nodes])

  const core = graph.nodes[BRAIN_ID]
  const coreState = core?.state || 'idle'
  const absorbedIds = useMemo(() => new Set(absorbed.map((a) => a.id)), [absorbed])

  return (
    <div className={`neural-backdrop phase-${phase}`} aria-hidden={false}>
      <svg
        className="nb-svg"
        viewBox="0 0 1000 800"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Archive constellation retrieval map"
      >
        <defs>
          <radialGradient id="nbWorld" cx="48%" cy="44%" r="72%">
            <stop offset="0%" stopColor="#f5b89a" stopOpacity="0.1" />
            <stop offset="42%" stopColor="#2a2420" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#08090b" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nbWorldScan" cx="50%" cy="46%" r="74%">
            <stop offset="0%" stopColor="#fde8d4" stopOpacity="0.14" />
            <stop offset="40%" stopColor="#f5b89a" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#08090b" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nbHubGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff8f0" stopOpacity="0.65" />
            <stop offset="45%" stopColor="#f5b89a" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#f5b89a" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nbNodeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fde8d4" stopOpacity="0.6" />
            <stop offset="55%" stopColor="#f5b89a" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#f5b89a" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="nbProbeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f5b89a" stopOpacity="0" />
            <stop offset="50%" stopColor="#f5c4a8" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#fff8f0" stopOpacity="0.9" />
          </linearGradient>
          <filter id="nbSoft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="nbGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="3.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="nbBloom" x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect
          className={`nb-world${searching ? ' scanning' : ''}${settled ? ' settled' : ''}`}
          x="0"
          y="0"
          width="1000"
          height="800"
          fill={searching ? 'url(#nbWorldScan)' : 'url(#nbWorld)'}
        />

        <g className="nb-stardust" opacity={searching ? 0.72 : 0.48} filter="url(#nbSoft)">
          {STARDUST.map(([x, y, r], i) => (
            <circle key={`dust-${i}`} className="nb-dust" cx={x} cy={y} r={r} />
          ))}
        </g>

        <g className="nb-field-lines" opacity={searching ? 0.14 : 0.07}>
          {[220, 320, 410].map((r) => (
            <circle key={r} cx={CX} cy={CY} r={r} fill="none" className="nb-field-ring" />
          ))}
        </g>

        <g className="nb-guides">
          <circle cx={CX} cy={CY} r={195} />
          <circle cx={CX} cy={CY} r={300} />
          <circle cx={CX} cy={CY} r={395} />
        </g>

        {searching && probeTarget ? (
          <g className="nb-probe" filter="url(#nbGlow)">
            <line
              className="nb-probe-beam"
              x1={CX}
              y1={CY}
              x2={probeTarget.x!}
              y2={probeTarget.y!}
            />
            <circle
              className="nb-probe-focus"
              cx={probeTarget.x!}
              cy={probeTarget.y!}
              r={22}
              fill="none"
            />
            <circle className="nb-probe-dot" cx={probeTarget.x!} cy={probeTarget.y!} r={4.5} />
          </g>
        ) : searching ? (
          <g transform={`translate(${CX} ${CY})`} className="nb-probe-idle">
            <circle className="nb-scan-ring" r="100" fill="none" />
            <circle className="nb-scan-ring delay" r="160" fill="none" />
          </g>
        ) : null}

        <g className={`nb-outer${expanded ? ' dimmed' : ''}`}>
          {graph.edges.map((e) => {
            const a = graph.nodes[e.from]
            const b = graph.nodes[e.to]
            if (!a?.x || !a?.y || !b?.x || !b?.y) return null
            if (a.state !== 'faded' && b.state !== 'faded') return null
            return (
              <path
                key={`fade-${e.id}`}
                className="nb-edge reject"
                d={edgePath(a.x, a.y, b.x, b.y)}
                fill="none"
              />
            )
          })}

          {graph.edges.map((e) => {
            const a = graph.nodes[e.from]
            const b = graph.nodes[e.to]
            if (!a?.x || !a?.y || !b?.x || !b?.y) return null
            if (a.state === 'faded' || b.state === 'faded') return null
            const onPulse = pulseChain.has(a.id) && pulseChain.has(b.id)
            const scanning =
              searching || onPulse || b.state === 'searching' || a.state === 'searching'
            const used =
              expanded ||
              b.state === 'selected' ||
              a.state === 'selected' ||
              (settled && (b.state === 'matched' || a.state === 'matched'))
            const tone = used ? 'used' : scanning || e.hot ? 'scan' : ''
            return (
              <path
                key={e.id}
                className={`nb-edge${tone ? ` ${tone}` : ''}${onPulse ? ' active' : ''}`}
                d={edgePath(a.x, a.y, b.x, b.y)}
                fill="none"
              />
            )
          })}

          {fadedNodes.map((n) =>
            n.type === 'brain' ? null : (
              <g key={`f-${n.id}`} className="nb-node state-faded">
                <circle className="nb-hub" cx={n.x!} cy={n.y!} r={2.8} />
              </g>
            ),
          )}

          {activeNodes.map((n) => {
            if (n.type === 'brain') return null
            if (expanded && n.type === 'document' && absorbedIds.has(n.id)) return null
            const { lx, ly, anchor } = radialLabelOffset(
              n.x!,
              n.y!,
              n.type === 'document' ? 14 : n.type === 'module' ? 16 : 12,
            )
            const lit = ['matched', 'selected', 'possible_match', 'searching'].includes(n.state)
            const selected = n.state === 'selected' || n.id === graph.selectedId
            const warm = selected || n.state === 'matched' || n.state === 'possible_match'
            const scanning = n.state === 'searching' || n.id === pulseToId
            const showLabel =
              lit ||
              selected ||
              n.type === 'year' ||
              n.type === 'project' ||
              n.type === 'module' ||
              n.type === 'other'
            const hubR =
              n.type === 'document'
                ? selected
                  ? 7
                  : scanning
                    ? 5.5
                    : lit
                      ? 5
                      : 3.2
                : lit
                  ? 6.5
                  : 4.2

            return (
              <g
                key={n.id}
                className={`nb-node type-${n.type} state-${n.state}${lit ? ' lit' : ''}${warm ? ' warm' : ''}${scanning ? ' scanning' : ''}`}
                onClick={() => {
                  if (n.type === 'document') onSelectNode(n.id === graph.selectedId ? null : n.id)
                }}
                style={{ cursor: n.type === 'document' ? 'pointer' : 'default' }}
              >
                {lit || scanning ? (
                  <circle
                    className="nb-halo"
                    cx={n.x!}
                    cy={n.y!}
                    r={hubR * (scanning ? 4.2 : 3.4)}
                    fill="url(#nbNodeGlow)"
                    filter="url(#nbBloom)"
                  />
                ) : null}
                {scanning ? (
                  <>
                    <circle className="nb-scan-bounce" cx={n.x!} cy={n.y!} r={hubR + 10} fill="none" />
                    <circle
                      className="nb-scan-bounce delay"
                      cx={n.x!}
                      cy={n.y!}
                      r={hubR + 16}
                      fill="none"
                    />
                  </>
                ) : null}
                {warm && !scanning ? (
                  <circle className="nb-pick-pulse" cx={n.x!} cy={n.y!} r={hubR + 8} fill="none" />
                ) : null}
                <circle className="nb-hub" cx={n.x!} cy={n.y!} r={hubR} />
                {selected && n.type === 'document' ? (
                  <circle className="nb-hub-ring" cx={n.x!} cy={n.y!} r={hubR + 5} fill="none" />
                ) : null}
                {showLabel ? (
                  <text className="nb-label" x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle">
                    {shortLabel(
                      n.label,
                      n.type === 'document' ? 15 : n.type === 'module' ? 14 : 11,
                    )}
                  </text>
                ) : null}
              </g>
            )
          })}
        </g>

        {pulseEdge ? (
          <g key={pulseEdge.key} filter="url(#nbGlow)">
            <path className="nb-pulse-trail" d={pulseEdge.d} fill="none" />
            <circle r="6" className="nb-traveler">
              <animateMotion dur="0.48s" repeatCount="1" path={pulseEdge.d} />
            </circle>
          </g>
        ) : null}

        {expanded && absorbed.length > 0 ? (
          <g className="nb-absorbed">
            {absorbed.map((doc) => (
              <g key={`abs-${doc.id}`}>
                <path
                  className="nb-edge used absorb"
                  d={edgePath(CX, CY, doc.x, doc.y)}
                  fill="none"
                />
              </g>
            ))}
            {absorbed.map((doc) => {
              const { lx, ly, anchor } = radialLabelOffset(doc.x, doc.y, 14)
              return (
                <g
                  key={`abs-node-${doc.id}`}
                  className={`nb-node type-document state-${doc.state} lit warm absorbed`}
                  onClick={() => onSelectNode(doc.id === graph.selectedId ? null : doc.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <circle
                    className="nb-halo"
                    cx={doc.x}
                    cy={doc.y}
                    r={24}
                    fill="url(#nbNodeGlow)"
                    filter="url(#nbBloom)"
                  />
                  <circle className="nb-pick-pulse" cx={doc.x} cy={doc.y} r={14} fill="none" />
                  <circle className="nb-hub" cx={doc.x} cy={doc.y} r={6.5} />
                  <circle className="nb-hub-ring" cx={doc.x} cy={doc.y} r={11} fill="none" />
                  <text className="nb-label" x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle">
                    {shortLabel(doc.label, 14)}
                  </text>
                </g>
              )
            })}
          </g>
        ) : null}

        {/* Quiet query hub — soft constellation center, not a seal */}
        <g className={`nb-core state-${coreState}${expanded ? ' expanded' : ''}`}>
          <circle className="nb-core-wash" cx={CX} cy={CY} r={expanded ? 52 : 40} fill="url(#nbHubGlow)" />
          {searching ? (
            <>
              <circle className="nb-core-pulse" cx={CX} cy={CY} r={28} fill="none" />
              <circle className="nb-core-pulse delay" cx={CX} cy={CY} r={40} fill="none" />
            </>
          ) : null}
          <circle
            className="nb-core-hub"
            cx={CX}
            cy={CY}
            r={expanded ? 11 : 8}
            filter="url(#nbSoft)"
          />
          <circle className="nb-core-aura" cx={CX} cy={CY} r={expanded ? 22 : 16} fill="none" />
          <text className="nb-core-label" x={CX} y={CY + (expanded ? 34 : 28)} textAnchor="middle">
            {expanded ? 'LOCKED' : searching ? 'SCAN' : 'QUERY'}
          </text>
        </g>
      </svg>

      <div className="nb-hud">
        <div className="nb-hud-row">
          <span className={`nb-live${searching ? ' on' : ''}`} aria-hidden />
          <span className="nb-hud-main">{hud}</span>
        </div>
        {statusText && searching ? <div className="nb-hud-sub">{statusText}</div> : null}
      </div>

      {searching && (liveProbes.length > 0 || statusText) ? (
        <div className="nb-probe-list" aria-live="polite">
          <div className="nb-probe-list-title">Probing</div>
          {liveProbes.length > 0 ? (
            <ul>
              {liveProbes.map((n) => (
                <li key={n.id}>{shortLabel(n.label, 28)}</li>
              ))}
            </ul>
          ) : (
            <p>{statusText}</p>
          )}
        </div>
      ) : null}

      {selectedSource ? (
        <div className="nb-inspect">
          <div className="nb-inspect-head">
            <strong>{selectedSource.filename}</strong>
            <button type="button" onClick={() => onSelectNode(null)}>
              Close
            </button>
          </div>
          <div className="nb-inspect-meta">
            {[
              selectedSource.year,
              selectedSource.module,
              selectedSource.page != null ? `p.${selectedSource.page}` : null,
              selectedSource.score != null ? `${Math.round(selectedSource.score * 100)}%` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </div>
          <div className="nb-inspect-body">{selectedSource.text_preview}</div>
        </div>
      ) : null}
    </div>
  )
}
