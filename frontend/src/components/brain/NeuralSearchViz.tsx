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
  const sealGems = useMemo(() => hexVerts(CX, CY, expanded ? 70 : 58), [expanded])

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
            <stop offset="0%" stopColor="#1a2a38" stopOpacity="0.35" />
            <stop offset="40%" stopColor="#0f766e" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#070d14" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nbWorldScan" cx="50%" cy="48%" r="72%">
            <stop offset="0%" stopColor="#134e4a" stopOpacity="0.28" />
            <stop offset="45%" stopColor="#14b8a6" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#070d14" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nbSealGlow" cx="40%" cy="35%" r="68%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
            <stop offset="35%" stopColor="#99f6e4" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0f766e" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nbNodeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fde8d4" stopOpacity="0.55" />
            <stop offset="55%" stopColor="#f5b89a" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#f5b89a" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nbNodeGlowTeal" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ccfbf1" stopOpacity="0.5" />
            <stop offset="55%" stopColor="#14b8a6" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="nbSealFace" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ecfeff" stopOpacity="0.75" />
            <stop offset="50%" stopColor="#99f6e4" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0f766e" stopOpacity="0.22" />
          </linearGradient>
          <linearGradient id="nbProbeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#14b8a6" stopOpacity="0" />
            <stop offset="55%" stopColor="#2dd4bf" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#fde8d4" stopOpacity="0.75" />
          </linearGradient>
          <filter id="nbSoft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="nbGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2.8" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="nbBloom" x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="4.5" result="b" />
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

        {/* Quiet star dust — depth without noise */}
        <g className="nb-stardust" opacity={searching ? 0.55 : 0.38}>
          {[
            [120, 140, 1.1],
            [210, 520, 0.8],
            [860, 180, 1.2],
            [780, 620, 0.9],
            [160, 680, 0.7],
            [920, 420, 1.0],
            [640, 110, 0.75],
            [340, 90, 0.85],
            [480, 700, 0.7],
            [70, 360, 0.9],
            [900, 300, 0.65],
            [250, 280, 0.7],
          ].map(([x, y, r], i) => (
            <circle key={`dust-${i}`} className="nb-dust" cx={x} cy={y} r={r} />
          ))}
        </g>

        <g className="nb-field-lines" opacity={searching ? 0.22 : 0.12}>
          {[200, 300, 400].map((r) => (
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
                <circle className="nb-hub" cx={n.x!} cy={n.y!} r={3.5} />
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
              n.type === 'document' ? 16 : n.type === 'module' ? 18 : 14,
            )
            const lit = ['matched', 'selected', 'possible_match', 'searching'].includes(n.state)
            const selected = n.state === 'selected' || n.id === graph.selectedId
            const warm = selected || n.state === 'matched' || n.state === 'possible_match'
            const hubR =
              n.type === 'document' ? (selected ? 6 : lit ? 5 : 3.8) : lit ? 7 : 5.2

            return (
              <g
                key={n.id}
                className={`nb-node type-${n.type} state-${n.state}${lit ? ' lit' : ''}${warm ? ' warm' : ''}`}
                onClick={() => {
                  if (n.type === 'document') onSelectNode(n.id === graph.selectedId ? null : n.id)
                }}
                style={{ cursor: n.type === 'document' ? 'pointer' : 'default' }}
              >
                {lit ? (
                  <circle
                    className="nb-halo"
                    cx={n.x!}
                    cy={n.y!}
                    r={hubR * 3.2}
                    fill={warm ? 'url(#nbNodeGlow)' : 'url(#nbNodeGlowTeal)'}
                    filter="url(#nbBloom)"
                  />
                ) : null}
                <circle className="nb-hub" cx={n.x!} cy={n.y!} r={hubR} />
                {selected && n.type === 'document' ? (
                  <circle className="nb-hub-ring" cx={n.x!} cy={n.y!} r={hubR + 4} fill="none" />
                ) : null}
                {(lit || selected) && (
                  <text className="nb-label" x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle">
                    {shortLabel(n.label, n.type === 'document' ? 22 : n.type === 'module' ? 16 : 12)}
                  </text>
                )}
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
              const { lx, ly, anchor } = radialLabelOffset(doc.x, doc.y, 15)
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
                    r={22}
                    fill="url(#nbNodeGlow)"
                    filter="url(#nbBloom)"
                  />
                  <circle className="nb-hub" cx={doc.x} cy={doc.y} r={6} />
                  <circle className="nb-hub-ring" cx={doc.x} cy={doc.y} r={10} fill="none" />
                  <text className="nb-label" x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle">
                    {shortLabel(doc.label, 18)}
                  </text>
                </g>
              )
            })}
          </g>
        ) : null}

        {/* Soft core — quiet constellation hub */}
        <g className={`nb-core state-${coreState}${expanded ? ' expanded' : ''}`}>
          <circle className="nb-core-wash" cx={CX} cy={CY} r={118} fill="url(#nbSealGlow)" />
          <circle className="nb-core-aura" cx={CX} cy={CY} r={expanded ? 86 : 72} fill="none" />

          {searching ? (
            <>
              <circle className="nb-seal-pulse-ring" cx={CX} cy={CY} r={70} fill="none" />
              <circle className="nb-seal-pulse-ring delay" cx={CX} cy={CY} r={88} fill="none" />
            </>
          ) : null}

          <g className="nb-seal-spin">
            <circle className="nb-seal-orbit" cx={CX} cy={CY} r={expanded ? 78 : 66} fill="none" />
          </g>

          <g transform={`translate(${CX} ${CY})`}>
            <circle className="nb-seal-disk" r={expanded ? 36 : 32} fill="url(#nbSealFace)" />
            <circle className="nb-seal-disk-edge" r={expanded ? 36 : 32} fill="none" />
            <text className="nb-seal-mark" textAnchor="middle" dominantBaseline="central" y={1}>
              C
            </text>
            <text className="nb-seal-word" textAnchor="middle" y={58}>
              CHARLESGPT
            </text>
            <text className="nb-seal-sub" textAnchor="middle" y={72}>
              {expanded ? 'LOCKED' : searching ? 'SCAN' : 'READY'}
            </text>
          </g>

          <g className="nb-seal-gems" filter="url(#nbSoft)">
            {sealGems.map((p, i) => (
              <circle key={`gem-${i}`} className="nb-seal-gem" cx={p.x} cy={p.y} r={2.4} />
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
