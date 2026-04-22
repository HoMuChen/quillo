'use client'

import {
  useCallback, useLayoutEffect, useMemo, useRef, useState, useTransition, useEffect,
} from 'react'
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/routing'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2, RefreshCw, Plus, X } from 'lucide-react'
import {
  updatePillar, deletePillar, addArticle,
  assignOrphanToPillarAction, createPillarAndAssignAction,
} from './planning-actions'
import { RegenerateClusterOverlay } from './_regenerate-cluster'

type Pillar = {
  id: string
  title: string
  description: string | null
  target_keyword: string | null
  search_intent: string | null
  position: number
}

type Article = {
  id: string
  title: string
  target_keyword: string | null
  search_intent: string | null
  role: string | null
  status: string
  position: number
  pillar_id: string | null
}

type OrphanArticle = {
  id: string
  title: string
  target_keyword: string | null
  slug: string | null
  tags: string[]
  status: string
  source: string
}

type PublishTarget = {
  article_id: string
  remote_status: string | null
}

type VisualStatus = 'published' | 'draft' | 'empty'

const COLOR_IDX = [0, 1, 2] as const

function articleVisualStatus(article: Article, target: PublishTarget | undefined): VisualStatus {
  if (target?.remote_status === 'published') return 'published'
  if (target?.remote_status === 'draft' || target?.remote_status === 'scheduled') return 'draft'
  if (article.status === 'editing' || article.status === 'draft_ready') return 'draft'
  return 'empty'
}

function pillarVisualStatus(statuses: VisualStatus[]): VisualStatus {
  if (statuses.some((s) => s === 'published')) return 'published'
  if (statuses.some((s) => s === 'draft')) return 'draft'
  return 'empty'
}

type LaidOutNode = {
  id: string
  kind: 'pillar' | 'cluster' | 'orphan'
  x: number
  y: number
  size: number
  pillarId: string
  colorIdx: number
  status: VisualStatus
  isHub?: boolean
  title: string
  subtitle?: string | null
  parentId?: string
}

type LaidOutEdge = {
  from: { x: number; y: number }
  to: { x: number; y: number }
  pillarId: string
  colorIdx: number
  pillarStatus: VisualStatus
  clusterStatus: VisualStatus
}

// Dot sizes — Obsidian-style small nodes
const PILLAR_DOT = 18
const CLUSTER_DOT = 8
const ORPHAN_DOT = 7

function computeLayout(
  pillars: Pillar[],
  articlesByPillar: Map<string, Article[]>,
  targetsByArticle: Map<string, PublishTarget>,
  W: number,
  H: number,
  orphans: OrphanArticle[] = [],
): { nodes: LaidOutNode[]; edges: LaidOutEdge[] } {
  if ((pillars.length === 0 && orphans.length === 0) || W === 0 || H === 0) return { nodes: [], edges: [] }

  // --- Build node list ---
  type FNode = {
    id: string; kind: 'pillar' | 'cluster' | 'orphan'
    pillarId: string; colorIdx: number; status: VisualStatus
    isHub?: boolean; title: string; subtitle?: string | null
    parentId?: string
    x: number; y: number; vx: number; vy: number
    size: number; mass: number
  }

  const colorMap = new Map<string, number>()
  const pillarStatusMap = new Map<string, VisualStatus>()
  const fnodes: FNode[] = []

  // Pillars
  pillars.forEach((pillar, i) => {
    const colorIdx = COLOR_IDX[i % COLOR_IDX.length]
    colorMap.set(pillar.id, colorIdx)
    const articles = articlesByPillar.get(pillar.id) ?? []
    const childStatuses = articles.map((a) => articleVisualStatus(a, targetsByArticle.get(a.id)))
    const pStatus = pillarVisualStatus(childStatuses)
    pillarStatusMap.set(pillar.id, pStatus)
    const ang = -Math.PI / 2 + (i / Math.max(pillars.length, 1)) * Math.PI * 2
    fnodes.push({
      id: pillar.id, kind: 'pillar', pillarId: pillar.id, colorIdx, status: pStatus,
      title: pillar.title, subtitle: pillar.target_keyword,
      x: W / 2 + Math.cos(ang) * Math.min(W, H) * 0.25,
      y: H / 2 + Math.sin(ang) * Math.min(W, H) * 0.25,
      vx: 0, vy: 0, size: PILLAR_DOT, mass: 4,
    })
  })

  // Clusters
  pillars.forEach((pillar) => {
    const colorIdx = colorMap.get(pillar.id) ?? 0
    const articles = articlesByPillar.get(pillar.id) ?? []
    articles.forEach((article, idx) => {
      const status = articleVisualStatus(article, targetsByArticle.get(article.id))
      const ang = -Math.PI / 2 + (idx / Math.max(articles.length, 1)) * Math.PI * 2
      const r0 = PILLAR_DOT * 3
      const px = fnodes.find(n => n.id === pillar.id)
      fnodes.push({
        id: article.id, kind: 'cluster', pillarId: pillar.id, colorIdx, status,
        isHub: article.role === 'hub', title: article.title, subtitle: article.target_keyword,
        parentId: pillar.id,
        x: (px?.x ?? W/2) + Math.cos(ang) * r0,
        y: (px?.y ?? H/2) + Math.sin(ang) * r0,
        vx: 0, vy: 0, size: article.role === 'hub' ? CLUSTER_DOT + 3 : CLUSTER_DOT, mass: 1,
      })
    })
  })

  // Orphans — scatter to the sides
  orphans.forEach((o, i) => {
    const hx = hashId(o.id)
    const hy = hashId(o.id + 'y')
    fnodes.push({
      id: o.id, kind: 'orphan', pillarId: '', colorIdx: 0,
      status: (o.status === 'draft_ready' ? 'draft' : 'empty') as VisualStatus,
      title: o.title, subtitle: o.target_keyword,
      x: (((hx % 1000) / 1000) - 0.5) * W * 1.4 + W / 2,
      y: (((hy % 1000) / 1000) - 0.5) * H * 1.4 + H / 2,
      vx: 0, vy: 0, size: ORPHAN_DOT, mass: 1,
    })
  })

  // Index for O(1) lookup
  const fmap = new Map(fnodes.map(n => [n.id, n]))

  // Edges (spring pairs): pillar ↔ cluster
  const springPairs: Array<[string, string, number]> = [] // [fromId, toId, restLength]
  for (const n of fnodes) {
    if (n.kind === 'cluster' && n.parentId) {
      springPairs.push([n.parentId, n.id, PILLAR_DOT * 5])
    }
  }

  // --- Force simulation ---
  const REPULSION = 1200
  const SPRING_K = 0.055
  const CENTER_K = 0.004
  const DAMPING = 0.82
  const ITERS = 280

  for (let it = 0; it < ITERS; it++) {
    const alpha = Math.max(0.05, 1 - it / (ITERS * 0.85))

    // Repulsion between all pairs
    for (let i = 0; i < fnodes.length; i++) {
      const a = fnodes[i]
      for (let j = i + 1; j < fnodes.length; j++) {
        const b = fnodes[j]
        const dx = a.x - b.x
        const dy = a.y - b.y
        const d2 = dx * dx + dy * dy + 0.1
        const d = Math.sqrt(d2)
        const f = (REPULSION * alpha * a.mass * b.mass) / d2
        const fx = (dx / d) * f
        const fy = (dy / d) * f
        a.vx += fx / a.mass
        a.vy += fy / a.mass
        b.vx -= fx / b.mass
        b.vy -= fy / b.mass
      }
    }

    // Spring attraction
    for (const [fromId, toId, rest] of springPairs) {
      const a = fmap.get(fromId)
      const b = fmap.get(toId)
      if (!a || !b) continue
      const dx = b.x - a.x
      const dy = b.y - a.y
      const d = Math.hypot(dx, dy) || 0.01
      const f = SPRING_K * (d - rest)
      const fx = (dx / d) * f
      const fy = (dy / d) * f
      a.vx += fx / a.mass
      a.vy += fy / a.mass
      b.vx -= fx / b.mass
      b.vy -= fy / b.mass
    }

    // Centering
    for (const n of fnodes) {
      n.vx += (W / 2 - n.x) * CENTER_K * alpha
      n.vy += (H / 2 - n.y) * CENTER_K * alpha
      n.vx *= DAMPING
      n.vy *= DAMPING
      n.x += n.vx
      n.y += n.vy
    }
  }

  // Build output
  const nodes: LaidOutNode[] = fnodes.map(n => ({
    id: n.id, kind: n.kind, x: n.x, y: n.y, size: n.size,
    pillarId: n.pillarId, colorIdx: n.colorIdx, status: n.status,
    isHub: n.isHub, title: n.title, subtitle: n.subtitle, parentId: n.parentId,
  }))

  const edges: LaidOutEdge[] = []
  for (const [fromId, toId] of springPairs) {
    const a = fmap.get(fromId)
    const b = fmap.get(toId)
    if (!a || !b) continue
    const colorIdx = b.colorIdx as 0 | 1 | 2
    edges.push({
      from: { x: a.x, y: a.y },
      to: { x: b.x, y: b.y },
      pillarId: b.pillarId,
      colorIdx,
      pillarStatus: pillarStatusMap.get(b.pillarId) ?? 'empty',
      clusterStatus: b.status,
    })
  }

  return { nodes, edges }
}

function hashId(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = (((h * 33) ^ s.charCodeAt(i)) >>> 0)
  return h
}

function curvePath(ax: number, ay: number, bx: number, by: number): string {
  const dx = bx - ax
  const dy = by - ay
  const mid = 0.5
  // Subtle curve outward
  const cx = ax + dx * mid - dy * 0.08
  const cy = ay + dy * mid + dx * 0.08
  return `M ${ax.toFixed(1)} ${ay.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`
}

const COLOR_HEX = {
  0: { main: '#2b3f36', tint: '#e6ede6' },
  1: { main: '#2d4a66', tint: '#e4eaf0' },
  2: { main: '#6e3a2f', tint: '#efe2dc' },
} as const

// Dark-canvas palette for Obsidian-style rendering
const DARK_HEX = {
  0: { bright: '#5db88a', mid: '#3d7a5e', dim: '#2a5040' },
  1: { bright: '#5a9fd4', mid: '#3d6fa0', dim: '#2a4d70' },
  2: { bright: '#d4784e', mid: '#a05838', dim: '#703a28' },
} as const

export function PlanningGraph({
  projectId,
  pillars,
  articles,
  publishTargets,
  orphanArticles,
  hasGhostConnection,
}: {
  projectId: string
  pillars: Pillar[]
  articles: Article[]
  publishTargets: PublishTarget[]
  orphanArticles: OrphanArticle[]
  hasGhostConnection: boolean
}) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [selectedPillarId, setSelectedPillarId] = useState<string | null>(null)
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null)
  const [hoveredPillarId, setHoveredPillarId] = useState<string | null>(null)
  const [assignPending, startAssign] = useTransition()
  const router = useRouter()

  // Pan & zoom
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const panDragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null)
  const [isPanning, setIsPanning] = useState(false)

  // Orphan drag-to-assign
  const DRAG_THRESHOLD = 8
  const orphanDragRef = useRef<{ orphanId: string; startX: number; startY: number } | null>(null)
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
  const [dragTargetPillarId, setDragTargetPillarId] = useState<string | null>(null)

  function onWheel(e: React.WheelEvent) {
    e.preventDefault()
    const rect = canvasRef.current!.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const factor = e.deltaY < 0 ? 1.03 : 0.97
    const newZoom = Math.max(0.2, Math.min(4, zoom * factor))
    setPan(p => ({
      x: cx - (cx - p.x) * (newZoom / zoom),
      y: cy - (cy - p.y) * (newZoom / zoom),
    }))
    setZoom(newZoom)
  }

  function onMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return
    panDragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y }
    setIsPanning(true)
  }

  function onMouseMove(e: React.MouseEvent) {
    // Orphan drag takes priority
    if (orphanDragRef.current) {
      const dx = e.clientX - orphanDragRef.current.startX
      const dy = e.clientY - orphanDragRef.current.startY
      if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        setDragPos({ x: e.clientX, y: e.clientY })
        const rect = canvasRef.current!.getBoundingClientRect()
        const cx = (e.clientX - rect.left - pan.x) / zoom
        const cy = (e.clientY - rect.top - pan.y) / zoom
        let nearest: string | null = null
        let nearestD = 80 / zoom
        for (const n of nodes) {
          if (n.kind !== 'pillar') continue
          const d = Math.hypot(cx - n.x, cy - n.y)
          if (d < nearestD) { nearestD = d; nearest = n.id }
        }
        setDragTargetPillarId(nearest)
      }
      return
    }
    if (!panDragRef.current) return
    setPan({
      x: panDragRef.current.panX + e.clientX - panDragRef.current.startX,
      y: panDragRef.current.panY + e.clientY - panDragRef.current.startY,
    })
  }

  function onMouseUp(e: React.MouseEvent) {
    if (orphanDragRef.current) {
      const { orphanId, startX, startY } = orphanDragRef.current
      const moved = Math.hypot(e.clientX - startX, e.clientY - startY) > DRAG_THRESHOLD
      if (moved && dragTargetPillarId) {
        startAssign(async () => {
          await assignOrphanToPillarAction(projectId, orphanId, dragTargetPillarId)
          router.refresh()
        })
      } else if (!moved) {
        setSelectedArticleId(orphanId === selectedArticleId ? null : orphanId)
      }
      orphanDragRef.current = null
      setDragPos(null)
      setDragTargetPillarId(null)
      return
    }
    panDragRef.current = null
    setIsPanning(false)
  }

  function resetView() {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  useLayoutEffect(() => {
    const el = canvasRef.current
    if (!el) return
    function sync() {
      const rect = el!.getBoundingClientRect()
      setSize({ w: rect.width, h: rect.height })
    }
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const articlesByPillar = useMemo(() => {
    const m = new Map<string, Article[]>()
    for (const a of articles) {
      if (!a.pillar_id) continue
      if (!m.has(a.pillar_id)) m.set(a.pillar_id, [])
      m.get(a.pillar_id)!.push(a)
    }
    return m
  }, [articles])

  const targetsByArticle = useMemo(() => {
    const m = new Map<string, PublishTarget>()
    for (const t of publishTargets) m.set(t.article_id, t)
    return m
  }, [publishTargets])

  const { nodes, edges } = useMemo(
    () => computeLayout(pillars, articlesByPillar, targetsByArticle, size.w, size.h, orphanArticles),
    [pillars, articlesByPillar, targetsByArticle, size.w, size.h, orphanArticles],
  )

  const selectedPillar = selectedPillarId ? (pillars.find((p) => p.id === selectedPillarId) ?? null) : null
  const selectedPillarArticles = selectedPillar ? (articlesByPillar.get(selectedPillar.id) ?? []) : []

  const selectedArticle = selectedArticleId
    ? (articles.find((a) => a.id === selectedArticleId) ?? orphanArticles.find((o) => o.id === selectedArticleId) ?? null)
    : null
  const isOrphanSelected = selectedArticleId ? orphanArticles.some((o) => o.id === selectedArticleId) : false

  const t = useTranslations('planning')

  return (
    <div className="space-y-3">
      <div
        ref={canvasRef}
        className="relative w-full overflow-hidden rounded-xl"
        style={{ height: 'calc(100vh - 130px)', cursor: dragPos ? 'grabbing' : isPanning ? 'grabbing' : 'grab' }}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onClick={(e) => {
          if (e.target === e.currentTarget) { setSelectedPillarId(null); setSelectedArticleId(null) }
        }}
      >
        {/* Transform wrapper — pan & zoom applied here */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            width: Math.max(size.w, nodes.reduce((m, n) => Math.max(m, n.x + 120), 0)),
            height: Math.max(size.h, nodes.reduce((m, n) => Math.max(m, n.y + 120), 0)),
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) { setSelectedPillarId(null); setSelectedArticleId(null) }
          }}
        >
        {/* Edges — SVG */}
        <svg
          className="absolute inset-0 pointer-events-none"
          style={{ width: size.w, height: size.h }}
          viewBox={`0 0 ${size.w} ${size.h}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {edges.map((e, i) => {
            const dim = !!hoveredPillarId && hoveredPillarId !== e.pillarId
            const active = hoveredPillarId === e.pillarId
            const dashed = e.clusterStatus === 'empty'
            return (
              <path
                key={i}
                d={curvePath(e.from.x, e.from.y, e.to.x, e.to.y)}
                fill="none"
                stroke={DARK_HEX[e.colorIdx as 0 | 1 | 2].mid}
                strokeWidth={active ? 1.2 : 0.6}
                strokeLinecap="round"
                opacity={dim ? 0.04 : active ? 0.7 : 0.2}
                style={{ transition: 'opacity 150ms ease, stroke-width 150ms ease' }}
              />
            )
          })}
        </svg>

        {/* Nodes */}
        {nodes.map((n) => {
          const dkHex = DARK_HEX[n.colorIdx as 0 | 1 | 2]
          const hex = COLOR_HEX[n.colorIdx as 0 | 1 | 2]
          const isHoveredGroup = hoveredPillarId === n.pillarId
          const isSelected = selectedPillarId === n.id

          if (n.kind === 'pillar') {
            const isDragTarget = dragTargetPillarId === n.id
            const isActive = isHoveredGroup || isSelected
            const pillarOpacity = hoveredPillarId ? (isActive ? 1 : 0.25) : 1
            return (
              <button
                key={n.id}
                type="button"
                onMouseEnter={() => setHoveredPillarId(n.id)}
                onMouseLeave={() => setHoveredPillarId(null)}
                onClick={() => setSelectedPillarId(n.id === selectedPillarId ? null : n.id)}
                className="absolute select-none cursor-pointer group"
                style={{
                  left: n.x, top: n.y,
                  transform: 'translate(-50%, -50%)',
                  opacity: pillarOpacity,
                  transition: 'opacity 200ms ease',
                  zIndex: isActive ? 4 : 2,
                }}
              >
                <span className="rounded-full block group-hover:scale-110 transition-transform duration-150" style={{
                  width: n.size, height: n.size,
                  background: hex.main,
                  boxShadow: isDragTarget
                    ? `0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-ochre), 0 0 12px var(--color-ochre)`
                    : isSelected
                      ? `0 0 0 2px var(--color-bg), 0 0 0 3.5px var(--color-ochre)`
                      : isActive
                        ? `0 0 0 4px color-mix(in oklab, ${hex.main} 30%, transparent)`
                        : `0 1px 3px rgba(18,34,28,0.12)`,
                }} />
                <span style={{
                  position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                  marginTop: 5, whiteSpace: 'nowrap',
                  fontSize: 11, fontWeight: 500, color: 'var(--color-ink)',
                  fontFamily: 'var(--font-sans)',
                  pointerEvents: 'none',
                }}>
                  {n.subtitle || n.title}
                </span>
              </button>
            )
          }

          if (n.kind === 'orphan') {
            const isArticleSelected = selectedArticleId === n.id
            return (
              <button
                key={n.id}
                type="button"
                onMouseDown={(e) => {
                  e.stopPropagation()
                  orphanDragRef.current = { orphanId: n.id, startX: e.clientX, startY: e.clientY }
                }}
                className="absolute select-none cursor-grab active:cursor-grabbing group"
                style={{
                  left: n.x, top: n.y,
                  transform: 'translate(-50%, -50%)',
                  zIndex: isArticleSelected ? 3 : 1,
                  opacity: isArticleSelected ? 1 : hoveredPillarId ? 0.25 : 0.7,
                  transition: 'opacity 150ms ease',
                }}
              >
                <span
                  className="relative rounded-full transition-all duration-150 group-hover:scale-105"
                  style={{
                    width: n.size,
                    height: n.size,
                    background: 'var(--color-ink-3)',
                    boxShadow: isArticleSelected
                      ? `0 0 0 2px var(--color-bg), 0 0 0 3.5px var(--color-ochre)`
                      : undefined,
                  }}
                />
                <span style={{
                  position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                  marginTop: 4, whiteSpace: 'nowrap',
                  fontSize: 10, color: 'var(--color-ink-3)',
                  fontFamily: 'var(--font-sans)',
                  opacity: isArticleSelected ? 1 : 0,
                  transition: 'opacity 150ms',
                  pointerEvents: 'none',
                }}>
                  {n.subtitle || n.title.slice(0, 16)}
                </span>
              </button>
            )
          }

          // Cluster
          const isClusterSelected = selectedArticleId === n.id
          const isRevealed = !!hoveredPillarId && hoveredPillarId === n.pillarId
          const dotColor = n.status === 'published'
            ? hex.main
            : n.status === 'draft'
              ? `color-mix(in oklab, ${hex.main} 70%, var(--color-bg))`
              : `color-mix(in oklab, ${hex.main} 35%, var(--color-bg))`
          const clusterOpacity = isClusterSelected ? 1 : hoveredPillarId
            ? (isRevealed ? 1 : 0.06)
            : 0.65
          return (
            <button
              key={n.id}
              type="button"
              onMouseEnter={() => setHoveredPillarId(n.pillarId)}
              onMouseLeave={() => setHoveredPillarId(null)}
              onClick={() => setSelectedArticleId(n.id === selectedArticleId ? null : n.id)}
              className="absolute select-none cursor-pointer group"
              style={{
                left: n.x, top: n.y,
                transform: 'translate(-50%, -50%)',
                opacity: clusterOpacity,
                transition: 'opacity 200ms ease',
                zIndex: isClusterSelected ? 3 : isRevealed ? 2 : 1,
                pointerEvents: isRevealed || isClusterSelected || !hoveredPillarId ? 'auto' : 'none',
              }}
            >
              <span className="rounded-full block group-hover:scale-150 transition-transform duration-100" style={{
                width: n.size, height: n.size,
                background: dotColor,
                boxShadow: isClusterSelected
                  ? `0 0 0 2px var(--color-bg), 0 0 0 3px var(--color-ochre)`
                  : n.isHub
                    ? `0 0 0 2px var(--color-bg), 0 0 0 3px ${hex.main}`
                    : undefined,
              }} />
              {(isRevealed || isClusterSelected) && (
                <span style={{
                  position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                  marginTop: 3, whiteSpace: 'nowrap',
                  fontSize: 9, color: 'var(--color-ink-2)',
                  fontFamily: 'var(--font-sans)',
                  pointerEvents: 'none',
                }}>
                  {n.subtitle || n.title.slice(0, 16)}
                </span>
              )}
            </button>
          )
        })}

        </div>{/* end transform wrapper */}

        {/* Drag ghost — follows cursor when dragging an orphan */}
        {dragPos && (
          <div
            className="fixed rounded-full pointer-events-none z-50"
            style={{
              width: 40, height: 40,
              left: dragPos.x - 20, top: dragPos.y - 20,
              background: dragTargetPillarId ? 'var(--color-ochre)' : 'var(--color-ink-3)',
              opacity: 0.85,
              boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
              transition: 'background 120ms',
            }}
          />
        )}

        {/* Legend */}
        <div className="absolute left-4 bottom-4 rounded-lg border border-rule bg-bg/90 backdrop-blur-sm shadow-sh-1 p-3 text-[11px] text-ink-3 space-y-1.5 pointer-events-none">
          <LegendItem dot="published" label="published" />
          <LegendItem dot="draft" label="draft" />
          <LegendItem dot="empty" label="planning" />
        </div>

        {/* Zoom controls */}
        <div className="absolute right-4 bottom-4 flex items-center gap-1 rounded-lg border border-rule bg-bg/90 backdrop-blur-sm shadow-sh-1 p-1 pointer-events-auto">
          <button type="button" onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setZoom(z => Math.min(4, +(z * 1.25).toFixed(2))) }}
            className="w-7 h-7 flex items-center justify-center rounded text-[16px] text-ink-3 hover:bg-mist hover:text-ink transition-colors cursor-pointer">+</button>
          <button type="button" onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); resetView() }}
            className="font-mono text-[10px] px-1.5 h-7 flex items-center text-ink-4 hover:bg-mist hover:text-ink transition-colors rounded cursor-pointer">{Math.round(zoom * 100)}%</button>
          <button type="button" onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setZoom(z => Math.max(0.2, +(z / 1.25).toFixed(2))) }}
            className="w-7 h-7 flex items-center justify-center rounded text-[16px] text-ink-3 hover:bg-mist hover:text-ink transition-colors cursor-pointer">−</button>
        </div>
      </div>

      {selectedPillar && (
        <PillarDetail
          projectId={projectId}
          pillar={selectedPillar}
          articles={selectedPillarArticles}
          onClose={() => setSelectedPillarId(null)}
        />
      )}

      {selectedArticle && (
        <ArticlePanel
          projectId={projectId}
          article={selectedArticle}
          isOrphan={isOrphanSelected}
          pillars={pillars}
          onClose={() => setSelectedArticleId(null)}
        />
      )}
    </div>
  )
}

function LegendItem({ dot, label }: { dot: 'published' | 'draft' | 'empty'; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          'w-3 h-3 rounded-full border',
          dot === 'published' && 'bg-ink border-ink',
          dot === 'draft' && 'border-ink',
          dot === 'empty' && 'border-ink-3 border-dashed',
        )}
        style={{
          background: dot === 'draft'
            ? 'repeating-linear-gradient(45deg, #12221c 0 2px, #faf7f0 2px 4px)'
            : undefined,
        }}
      />
      <span>{label}</span>
    </div>
  )
}

function PillarDetail({
  projectId,
  pillar,
  articles,
  onClose,
}: {
  projectId: string
  pillar: Pillar
  articles: Article[]
  onClose: () => void
}) {
  const t = useTranslations('planning')
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [mode, setMode] = useState<'view' | 'edit' | 'confirm-delete' | 'add-article'>('view')
  const [regenerating, setRegenerating] = useState(false)
  const canRegenerate = articles.every((a) => a.status === 'planned')

  const refresh = useCallback(() => {
    router.refresh()
  }, [router])

  function onDelete() {
    startTransition(async () => {
      try {
        await deletePillar(projectId, pillar.id)
        onClose()
      } catch (err) { console.error(err) }
    })
  }

  return (
    <aside className="fixed right-6 bottom-6 top-24 w-[340px] z-40 flex flex-col rounded-xl border border-rule bg-bg shadow-sh-2 overflow-hidden">
      <header className="flex items-start justify-between gap-2 p-4 border-b border-rule">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.14em] text-ink-4">{t('pillar_label')}</div>
          <h3 className="font-serif italic text-[24px] text-ink leading-tight truncate">{pillar.title}</h3>
          {pillar.target_keyword && (
            <p className="font-mono text-[11px] text-ink-3 mt-1 truncate">{pillar.target_keyword}</p>
          )}
        </div>
        <button type="button" onClick={onClose} className="p-1 text-ink-3 hover:text-ink cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </header>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {mode === 'view' && (
          <>
            {pillar.description && (
              <p className="text-[13px] text-ink-2 leading-[1.55]">{pillar.description}</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="default" size="sm" onClick={() => setMode('edit')}>
                <Pencil className="w-3 h-3 mr-1" /> {t('edit')}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => canRegenerate && setRegenerating(true)}
                disabled={!canRegenerate}
                title={canRegenerate ? t('regenerate_tooltip') : t('regenerate_blocked')}
              >
                <RefreshCw className="w-3 h-3 mr-1" /> {t('regenerate_tooltip')}
              </Button>
              <Button variant="default" size="sm" onClick={() => setMode('add-article')}>
                <Plus className="w-3 h-3 mr-1" /> {t('add_article')}
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setMode('confirm-delete')}>
                <Trash2 className="w-3 h-3 mr-1" /> {t('delete')}
              </Button>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-ink-4 mb-2">
                {t('article_count', { count: articles.length })}
              </div>
              <ul className="divide-y divide-rule/60 rounded-lg border border-rule overflow-hidden">
                {articles.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => { window.location.href = `/projects/${projectId}/articles/${a.id}` }}
                      className="w-full text-left px-3 py-2 hover:bg-mist transition-colors flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <span className="text-[13px] text-ink truncate">{a.title}</span>
                      {a.role === 'hub' && (
                        <span className="font-mono text-[9px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded border bg-ink text-bg border-ink">hub</span>
                      )}
                    </button>
                  </li>
                ))}
                {articles.length === 0 && (
                  <li className="px-3 py-3 text-[12px] text-ink-4">{t('pillar_no_articles')}</li>
                )}
              </ul>
            </div>
          </>
        )}

        {mode === 'edit' && (
          <PillarEditInline
            pillar={pillar}
            onCancel={() => setMode('view')}
            onDone={() => { setMode('view'); refresh() }}
            projectId={projectId}
          />
        )}

        {mode === 'add-article' && (
          <ArticleAddInline
            pillarId={pillar.id}
            onCancel={() => setMode('view')}
            onDone={() => { setMode('view'); refresh() }}
            projectId={projectId}
          />
        )}

        {mode === 'confirm-delete' && (
          <div className="rounded-lg border border-rust bg-bg p-3 space-y-3">
            <p className="text-[13px] text-rust">{t('confirm_delete_pillar')}</p>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setMode('view')} disabled={pending}>
                {t('cancel')}
              </Button>
              <Button variant="destructive" size="sm" onClick={onDelete} disabled={pending}>
                {pending ? '...' : t('delete')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {regenerating && (
        <RegenerateClusterOverlay
          projectId={projectId}
          pillarId={pillar.id}
          pillarTitle={pillar.title}
          onClose={() => { setRegenerating(false); refresh() }}
        />
      )}
    </aside>
  )
}

function PillarEditInline({
  pillar, onCancel, onDone, projectId,
}: {
  pillar: Pillar
  onCancel: () => void
  onDone: () => void
  projectId: string
}) {
  const t = useTranslations('planning')
  const [title, setTitle] = useState(pillar.title)
  const [description, setDescription] = useState(pillar.description ?? '')
  const [keyword, setKeyword] = useState(pillar.target_keyword ?? '')
  const [intent, setIntent] = useState(pillar.search_intent ?? '')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setError(null)
    startTransition(async () => {
      try {
        await updatePillar(projectId, pillar.id, {
          title: title.trim(),
          description: description || null,
          target_keyword: keyword || null,
          search_intent: (intent || null) as 'informational' | 'commercial' | 'transactional' | null,
        })
        onDone()
      } catch (err) {
        console.error(err)
        setError(t('error_generic'))
      }
    })
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <FieldInline label={t('form_pillar_title')}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required className="inp" />
      </FieldInline>
      <FieldInline label={t('form_pillar_description')}>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)}
          className="inp min-h-[60px]" />
      </FieldInline>
      <FieldInline label={t('form_target_keyword')}>
        <input value={keyword} onChange={(e) => setKeyword(e.target.value)} className="inp" />
      </FieldInline>
      <FieldInline label={t('form_search_intent')}>
        <select value={intent} onChange={(e) => setIntent(e.target.value)} className="inp">
          <option value="">—</option>
          <option value="informational">informational</option>
          <option value="commercial">commercial</option>
          <option value="transactional">transactional</option>
        </select>
      </FieldInline>

      {error && <p className="text-[12px] text-rust">{error}</p>}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          {t('cancel')}
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? '...' : t('save')}
        </Button>
      </div>

      <style>{`.inp{width:100%;padding:6px 10px;border:1px solid var(--color-rule);border-radius:8px;background:var(--color-bg);font-size:13px;color:var(--color-ink);outline:none}`}</style>
    </form>
  )
}

function ArticleAddInline({
  pillarId, onCancel, onDone, projectId,
}: {
  pillarId: string
  onCancel: () => void
  onDone: () => void
  projectId: string
}) {
  const t = useTranslations('planning')
  const [title, setTitle] = useState('')
  const [keyword, setKeyword] = useState('')
  const [role, setRole] = useState<'hub' | 'supporting' | 'comparison'>('supporting')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setError(null)
    startTransition(async () => {
      try {
        await addArticle(projectId, pillarId, {
          title: title.trim(),
          target_keyword: keyword || null,
          lsi_keywords: [],
          search_intent: null,
          word_count_target: null,
          role,
        })
        onDone()
      } catch (err) {
        console.error(err)
        setError(t('error_generic'))
      }
    })
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <FieldInline label={t('form_article_title')}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required className="inp" autoFocus />
      </FieldInline>
      <FieldInline label={t('form_target_keyword')}>
        <input value={keyword} onChange={(e) => setKeyword(e.target.value)} className="inp" />
      </FieldInline>
      <FieldInline label={t('form_role')}>
        <select value={role} onChange={(e) => setRole(e.target.value as 'hub' | 'supporting' | 'comparison')} className="inp">
          <option value="hub">hub</option>
          <option value="supporting">supporting</option>
          <option value="comparison">comparison</option>
        </select>
      </FieldInline>

      {error && <p className="text-[12px] text-rust">{error}</p>}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          {t('cancel')}
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? '...' : t('save')}
        </Button>
      </div>

      <style>{`.inp{width:100%;padding:6px 10px;border:1px solid var(--color-rule);border-radius:8px;background:var(--color-bg);font-size:13px;color:var(--color-ink);outline:none}`}</style>
    </form>
  )
}

function ArticlePanel({
  projectId,
  article,
  isOrphan,
  pillars,
  onClose,
}: {
  projectId: string
  article: Article | OrphanArticle
  isOrphan: boolean
  pillars: Pillar[]
  onClose: () => void
}) {
  const t = useTranslations('planning')
  const router = useRouter()
  const [mode, setMode] = useState<'assign' | 'new-pillar'>('assign')
  const [assignPillarId, setAssignPillarId] = useState(pillars[0]?.id ?? '')
  const [newTitle, setNewTitle] = useState('')
  const [newKeyword, setNewKeyword] = useState(article.target_keyword ?? '')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const tags = 'tags' in article ? (article as OrphanArticle).tags : []
  const role = 'role' in article ? (article as Article).role : null

  function assign() {
    if (!assignPillarId) return
    setError(null)
    startTransition(async () => {
      try {
        await assignOrphanToPillarAction(projectId, article.id, assignPillarId)
        onClose()
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error')
      }
    })
  }

  function createAndAssign(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    setError(null)
    startTransition(async () => {
      try {
        await createPillarAndAssignAction(projectId, article.id, {
          title: newTitle.trim(),
          target_keyword: newKeyword || null,
        })
        onClose()
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error')
      }
    })
  }

  return (
    <aside className="fixed right-6 bottom-6 top-24 w-[320px] z-40 flex flex-col rounded-xl border border-rule bg-bg shadow-sh-2 overflow-hidden">
      <header className="flex items-start justify-between gap-2 p-4 border-b border-rule">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.14em] text-ink-4 flex items-center gap-2">
            {isOrphan ? 'Ghost' : 'Cluster'}
            {role && <span className="px-1.5 py-0.5 rounded border border-rule bg-bg-2">{role}</span>}
          </div>
          <h3 className="font-serif italic text-[20px] text-ink leading-tight">{article.title}</h3>
          {article.target_keyword && (
            <p className="font-mono text-[11px] text-ink-3 mt-0.5 truncate">{article.target_keyword}</p>
          )}
        </div>
        <button type="button" onClick={onClose} className="p-1 text-ink-3 hover:text-ink cursor-pointer shrink-0">
          <X className="w-4 h-4" />
        </button>
      </header>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span key={tag} className="font-mono text-[10px] px-2 py-0.5 rounded-full border border-rule bg-bg-2 text-ink-3">
                {tag}
              </span>
            ))}
          </div>
        )}

        <Link
          href={`/projects/${projectId}/articles/${article.id}`}
          className="flex items-center justify-center gap-2 w-full rounded-lg border border-rule bg-bg-2 px-4 py-2.5 text-[13px] text-ink hover:bg-mist transition-colors"
        >
          {t('open_editor')}
        </Link>

        {isOrphan && (
          <>
            <div className="border-t border-rule/60 pt-3">
              <p className="text-[11px] text-ink-4 mb-3">{t('orphan_assign')}</p>
              <div className="flex gap-1 rounded-lg border border-rule overflow-hidden text-[11px] mb-3">
                {(['assign', 'new-pillar'] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setMode(m)}
                    className={cn('flex-1 px-3 py-1.5 transition-colors cursor-pointer',
                      mode === m ? 'bg-ink text-bg' : 'text-ink-3 hover:bg-mist')}
                  >
                    {m === 'assign' ? t('orphan_assign_existing') : t('orphan_new_pillar')}
                  </button>
                ))}
              </div>

              {mode === 'assign' && (
                <div className="space-y-2">
                  {pillars.length === 0 ? (
                    <p className="text-[12px] text-ink-4">{t('orphan_no_pillars')}</p>
                  ) : (
                    <>
                      <select value={assignPillarId} onChange={(e) => setAssignPillarId(e.target.value)}
                        className="w-full rounded-lg border border-rule bg-bg px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-ink-3">
                        {pillars.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                      </select>
                      <Button variant="primary" disabled={!assignPillarId || pending} onClick={assign} className="w-full">
                        {pending ? '…' : t('orphan_assign_confirm')}
                      </Button>
                    </>
                  )}
                </div>
              )}

              {mode === 'new-pillar' && (
                <form onSubmit={createAndAssign} className="space-y-2">
                  <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required
                    placeholder={t('orphan_pillar_title')}
                    className="w-full rounded-lg border border-rule bg-bg px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-ink-3" />
                  <input value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)}
                    placeholder={t('orphan_pillar_keyword')}
                    className="w-full rounded-lg border border-rule bg-bg px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-ink-3" />
                  <Button type="submit" variant="primary" disabled={!newTitle.trim() || pending} className="w-full">
                    {pending ? '…' : t('orphan_assign_confirm')}
                  </Button>
                </form>
              )}
            </div>
          </>
        )}

        {error && <p className="text-[12px] text-rust">{error}</p>}
      </div>
    </aside>
  )
}

function FieldInline({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-[0.12em] text-ink-4 font-medium">{label}</div>
      {children}
    </div>
  )
}
