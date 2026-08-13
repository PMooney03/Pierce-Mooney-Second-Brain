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

function hexPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = []
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2
    pts.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`)
  }
  return pts.join(' ')
}

function hexVerts(cx: number, cy: number, r: number) {
  const pts: { x: number; y: number }[] = []
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r })
  }
  return pts
}

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
  const sealGems = useMemo(() => hexVerts(CX, CY, expanded ? 76 : 64), [expanded])
  const hexOuter = useMemo(() => hexPoints(CX, CY, expanded ? 92 : 78), [expanded])
  const hexMid = useMemo(() => hexPoints(CX, CY, expanded ? 78 : 66), [expanded])
  const hexPulse = useMemo(() => hexPoints(CX, CY, 70), [])

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
    return statusText || 'CHARLESGPT'
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
        aria-label="CharlesGPT live retrieval network"
      >
        <defs>
          <radialGradient id="nbWorld" cx="50%" cy="48%" r="70%">
            <stop offset="0%" stopColor="#134e4a" stopOpacity="0.22" />
            <stop offset="45%" stopColor="#0f766e" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#0a1628" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nbWorldScan" cx="50%" cy="48%" r="72%">
            <stop offset="0%" stopColor="#0f766e" stopOpacity="0.22" />
            <stop offset="40%" stopColor="#14b8a6" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#0a1628" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nbSealGlow" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
            <stop offset="40%" stopColor="#0f766e" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#0a7a6a" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="nbSealFace" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ecfeff" stopOpacity="0.95" />
            <stop offset="45%" stopColor="#99f6e4" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#0f766e" stopOpacity="0.35" />
          </linearGradient>
          <linearGradient id="nbProbeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#14b8a6" stopOpacity="0" />
            <stop offset="55%" stopColor="#2dd4bf" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#ccfbf1" stopOpacity="0.85" />
          </linearGradient>
          <filter id="nbSoft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="nbGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="3.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Atmospheric field */}
        <rect
          className={`nb-world${searching ? ' scanning' : ''}${settled ? ' settled' : ''}`}
          x="0"
          y="0"
          width="1000"
          height="800"
          fill={searching ? 'url(#nbWorldScan)' : 'url(#nbWorld)'}
        />
        <g className="nb-field-lines" opacity={searching ? 0.35 : 0.18}>
          {[180, 260, 340, 420].map((r) => (
            <circle key={r} cx={CX} cy={CY} r={r} fill="none" className="nb-field-ring" />
          ))}
        </g>

        <g className="nb-guides">
          <circle cx={CX} cy={CY} r={195} />
          <circle cx={CX} cy={CY} r={300} />
          <circle cx={CX} cy={CY} r={395} />
        </g>

        {/* Probe beam aimed at the live node — not a pointless free spin */}
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
              r={18}
              fill="none"
            />
            <circle className="nb-probe-dot" cx={probeTarget.x!} cy={probeTarget.y!} r={4} />
          </g>
        ) : searching ? (
          <g transform={`translate(${CX} ${CY})`} className="nb-probe-idle">
            <circle className="nb-scan-ring" r="120" fill="none" />
            <circle className="nb-scan-ring delay" r="180" fill="none" />
          </g>
        ) : null}

        {/* Outer network — fades when core expands with absorbed evidence */}
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
              searching ||
              onPulse ||
              b.state === 'searching' ||
              a.state === 'searching'
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
                <circle className="nb-hub" cx={n.x!} cy={n.y!} r={5} />
              </g>
            ),
          )}

          {activeNodes.map((n) => {
            if (n.type === 'brain') return null
            // When expanded, documents move to inner orbit — hide outer copies
            if (expanded && n.type === 'document' && absorbedIds.has(n.id)) return null
            const { lx, ly, anchor } = radialLabelOffset(
              n.x!,
              n.y!,
              n.type === 'document' ? 18 : n.type === 'module' ? 20 : 16,
            )
            const lit = ['matched', 'selected', 'possible_match', 'searching'].includes(n.state)
            const selected = n.state === 'selected' || n.id === graph.selectedId

            return (
              <g
                key={n.id}
                className={`nb-node type-${n.type} state-${n.state}${lit ? ' lit' : ''}`}
                onClick={() => {
                  if (n.type === 'document') onSelectNode(n.id === graph.selectedId ? null : n.id)
                }}
                style={{ cursor: n.type === 'document' ? 'pointer' : 'default' }}
              >
                {n.type === 'module' ? (
                  <rect x={n.x! - 7} y={n.y! - 7} width={14} height={14} rx={3} className="nb-mod" />
                ) : (
                  <circle
                    className="nb-hub"
                    cx={n.x!}
                    cy={n.y!}
                    r={n.type === 'document' ? (selected ? 7 : 5) : lit ? 9 : 7}
                  />
                )}
                {selected && n.type === 'document' ? (
                  <text className="nb-check" x={n.x! + 11} y={n.y! + 4}>
                    ✓
                  </text>
                ) : null}
                <text className="nb-label" x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle">
                  {shortLabel(n.label, n.type === 'document' ? 20 : n.type === 'module' ? 16 : 12)}
                </text>
              </g>
            )
          })}
        </g>

        {pulseEdge ? (
          <g key={pulseEdge.key} filter="url(#nbGlow)">
            <path className="nb-pulse-trail" d={pulseEdge.d} fill="none" />
            <circle r="5.5" className="nb-traveler">
              <animateMotion dur="0.55s" repeatCount="1" path={pulseEdge.d} />
            </circle>
          </g>
        ) : null}

        {/* Absorbed evidence orbit — settled expand */}
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
              const { lx, ly, anchor } = radialLabelOffset(doc.x, doc.y, 16)
              return (
                <g
                  key={`abs-node-${doc.id}`}
                  className={`nb-node type-document state-${doc.state} lit absorbed`}
                  onClick={() => onSelectNode(doc.id === graph.selectedId ? null : doc.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <circle className="nb-hub" cx={doc.x} cy={doc.y} r={7} />
                  <text className="nb-check" x={doc.x + 11} y={doc.y + 4}>
                    ✓
                  </text>
                  <text className="nb-label" x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle">
                    {shortLabel(doc.label, 16)}
                  </text>
                </g>
              )
            })}
          </g>
        ) : null}

        {/* CharlesGPT seal — monogram hub, not a plain circle */}
        <g className={`nb-core state-${coreState}${expanded ? ' expanded' : ''}`}>
          <circle className="nb-core-wash" cx={CX} cy={CY} r={100} fill="url(#nbSealGlow)" />

          {searching ? (
            <>
              <polygon className="nb-seal-pulse" points={hexPulse} fill="none" />
              <polygon className="nb-seal-pulse delay" points={hexPulse} fill="none" />
            </>
          ) : null}

          <g className="nb-seal-spin">
            <polygon className="nb-seal-hex outer" points={hexOuter} fill="none" />
          </g>
          <g className="nb-seal-spin reverse">
            <polygon className="nb-seal-hex mid" points={hexMid} fill="none" />
          </g>

          {/* Technical corner brackets */}
          <g className="nb-seal-brackets" transform={`translate(${CX} ${CY})`}>
            <path d="M -52 -28 V -52 H -28" />
            <path d="M 52 -28 V -52 H 28" />
            <path d="M -52 28 V 52 H -28" />
            <path d="M 52 28 V 52 H 28" />
          </g>

          {/* Diamond face */}
          <g transform={`translate(${CX} ${CY})`}>
            <rect
              className="nb-seal-plate"
              x={-44}
              y={-44}
              width={88}
              height={88}
              rx={16}
              transform="rotate(45)"
              fill="url(#nbSealFace)"
            />
            <rect
              className="nb-seal-plate-edge"
              x={-44}
              y={-44}
              width={88}
              height={88}
              rx={16}
              transform="rotate(45)"
              fill="none"
            />
            <text className="nb-seal-mark" textAnchor="middle" dominantBaseline="central" y={2}>
              C
            </text>
            <text className="nb-seal-word" textAnchor="middle" y={78}>
              CHARLESGPT
            </text>
            <text className="nb-seal-sub" textAnchor="middle" y={92}>
              {expanded ? 'LOCKED' : searching ? 'SCAN' : 'READY'}
            </text>
          </g>

          {/* Vertex gems */}
          <g className="nb-seal-gems" filter="url(#nbSoft)">
            {sealGems.map((p, i) => (
              <rect
                key={`gem-${i}`}
                className="nb-seal-gem"
                x={p.x - 3.5}
                y={p.y - 3.5}
                width={7}
                height={7}
                rx={1.5}
                transform={`rotate(45 ${p.x} ${p.y})`}
              />
            ))}
          </g>
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
