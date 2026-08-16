import type { BrainEdge, BrainGraphState, BrainNode } from '../types/brain'
import { BRAIN_ID } from '../types/brain'

/** Wide canvas for full-bleed neural backdrop. */
export const CX = 500
export const CY = 400
export const YEAR_R = 195
export const MODULE_R = 300
export const DOC_R = 395

export function polar(angleDeg: number, radius: number, cx = CX, cy = CY) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + Math.cos(rad) * radius, y: cy + Math.sin(rad) * radius }
}

function fanAngles(count: number, center: number, spread: number): number[] {
  if (count <= 1) return [center]
  const start = center - spread / 2
  const step = spread / Math.max(count - 1, 1)
  return Array.from({ length: count }, (_, i) => start + i * step)
}

const YEAR_ORDER = [
  'Year 1',
  'Year 2',
  'Year 3',
  'Year 4',
  'Projects',
  'Other Material',
  'Web',
  'Weather',
  'Tools',
]

function yearAngle(index: number, total: number): number {
  if (total <= 0) return 0
  // Even ring around the core so paths read as a hive, not a list
  return (360 / total) * index
}

/** Label offset along radial direction from brain center. */
export function radialLabelOffset(
  x: number,
  y: number,
  distance: number,
): { lx: number; ly: number; anchor: 'start' | 'middle' | 'end' } {
  const dx = x - CX
  const dy = y - CY
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const lx = x + ux * distance
  const ly = y + uy * distance
  let anchor: 'start' | 'middle' | 'end' = 'middle'
  if (ux > 0.35) anchor = 'start'
  else if (ux < -0.35) anchor = 'end'
  return { lx, ly, anchor }
}

/** Organic quadratic control point for neural-looking links. */
export function curveControl(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): { x: number; y: number } {
  const mx = (ax + bx) / 2
  const my = (ay + by) / 2
  const dx = bx - ax
  const dy = by - ay
  // Perpendicular bend toward / away from core for organic arcs
  const len = Math.hypot(dx, dy) || 1
  const bend = 0.18 * len
  const px = -dy / len
  const py = dx / len
  // Bias bend so arcs bow outward from core
  const fromCoreX = mx - CX
  const fromCoreY = my - CY
  const outward = fromCoreX * px + fromCoreY * py >= 0 ? 1 : -1
  return { x: mx + px * bend * outward, y: my + py * bend * outward }
}

/** Assign stable radial positions from hierarchy. */
export function layoutBrainGraph(state: BrainGraphState): BrainGraphState {
  const nodes = { ...state.nodes }
  const brain = nodes[BRAIN_ID]
  if (brain) {
    nodes[BRAIN_ID] = { ...brain, x: CX, y: CY }
  }

  const years = Object.values(nodes)
    .filter((n) => n.type === 'year' || n.type === 'project' || n.type === 'other')
    .sort((a, b) => {
      const ia = YEAR_ORDER.indexOf(a.label)
      const ib = YEAR_ORDER.indexOf(b.label)
      if (ia === -1 && ib === -1) return a.label.localeCompare(b.label)
      if (ia === -1) return 1
      if (ib === -1) return -1
      return ia - ib
    })

  const yearTotal = Math.max(years.length, 1)
  years.forEach((y, i) => {
    const pos = polar(yearAngle(i, yearTotal), YEAR_R)
    nodes[y.id] = { ...nodes[y.id], x: pos.x, y: pos.y }
  })

  const yearAngleById = new Map<string, number>()
  years.forEach((y, i) => {
    yearAngleById.set(y.id, yearAngle(i, yearTotal))
  })

  const modulesByParent = new Map<string, BrainNode[]>()
  for (const n of Object.values(nodes)) {
    if (n.type !== 'module' || !n.parentId) continue
    const list = modulesByParent.get(n.parentId) || []
    list.push(n)
    modulesByParent.set(n.parentId, list)
  }

  for (const [parentId, mods] of modulesByParent) {
    const center = yearAngleById.get(parentId) ?? 0
    const spread = Math.min(70, 18 + 14 * mods.length)
    const angles = fanAngles(mods.length, center, spread)
    mods
      .sort((a, b) => a.label.localeCompare(b.label))
      .forEach((m, i) => {
        const r = MODULE_R + (i % 2) * 16
        const pos = polar(angles[i] ?? center, r)
        nodes[m.id] = { ...nodes[m.id], x: pos.x, y: pos.y }
      })
  }

  const docsByParent = new Map<string, BrainNode[]>()
  for (const n of Object.values(nodes)) {
    if (n.type !== 'document' || !n.parentId) continue
    const list = docsByParent.get(n.parentId) || []
    list.push(n)
    docsByParent.set(n.parentId, list)
  }

  for (const [parentId, docs] of docsByParent) {
    const parent = nodes[parentId]
    const parentAngle =
      parent?.x != null && parent?.y != null
        ? Math.atan2(parent.y - CY, parent.x - CX) * (180 / Math.PI) + 90
        : yearAngleById.get(parentId) ?? 0
    const capped = docs
      .slice()
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 5)
    const spread = Math.min(64, 20 + 12 * capped.length)
    const angles = fanAngles(capped.length, parentAngle, spread)
    capped.forEach((d, i) => {
      const r = DOC_R + (i % 2) * 18
      const pos = polar(angles[i] ?? parentAngle, r)
      nodes[d.id] = { ...nodes[d.id], x: pos.x, y: pos.y }
    })
    for (const d of docs) {
      if (!capped.some((c) => c.id === d.id) && nodes[d.id]) {
        nodes[d.id] = { ...nodes[d.id], x: undefined, y: undefined, state: 'faded' }
      }
    }
  }

  const topic = Object.values(nodes).find((n) => n.type === 'topic')
  if (topic) {
    nodes[topic.id] = { ...nodes[topic.id], x: CX, y: CY - 100 }
  }

  const edges: BrainEdge[] = []
  for (const n of Object.values(nodes)) {
    if (!n.parentId || n.x == null || n.y == null) continue
    const parent = nodes[n.parentId]
    if (!parent || parent.x == null || parent.y == null) continue
    const hot = ['matched', 'selected', 'possible_match', 'searching'].includes(n.state)
    edges.push({
      id: `e:${n.parentId}->${n.id}`,
      from: n.parentId,
      to: n.id,
      hot,
    })
  }

  return { ...state, nodes, edges }
}

export function shortLabel(label: string, max = 15): string {
  if (label.length <= max) return label
  return label.slice(0, max - 1) + '…'
}
