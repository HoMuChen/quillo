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

function computeLayout(
  pillars: Pillar[],
  articlesByPillar: Map<string, Article[]>,
  targetsByArticle: Map<string, PublishTarget>,
  W: number,
  H: number,
  orphans: OrphanArticle[] = [],
): { nodes: LaidOutNode[]; edges: LaidOutEdge[] } {
  if ((pillars.length === 0 && orphans.length === 0) || W === 0 || H === 0) return { nodes: [], edges: [] }

  const cx = W / 2
  const cy = H / 2
  const S = Math.min(W, H)
  const scale = Math.max(0.6, Math.min(1, S / 700))
  const pillarSize = 96 * scale
  const clusterSize = 46 * scale
  const sep = S * (S < 520 ? 0.3 : 0.34)

  type Placed = {
    id: string
    x: number
    y: number
    r: number // collision radius
    size: number
    kind: 'pillar' | 'cluster' | 'orphan'
    pillarId: string
    pinned: boolean
    parentX?: number
    parentY?: number
    baseR?: number
  }
  const placed: Placed[] = []

  const pillarInfo = pillars.map((pillar, i) => {
    const colorIdx = COLOR_IDX[i % COLOR_IDX.length]
    // Distribute pillars evenly on a circle, starting from the top
    const ang = -Math.PI / 2 + (i / Math.max(pillars.length, 1)) * Math.PI * 2
    const x = cx + Math.cos(ang) * sep
    const y = cy + Math.sin(ang) * sep
    return { pillar, x, y, ang, colorIdx }
  })

  const nodes: LaidOutNode[] = []
  const pillarStatusMap = new Map<string, VisualStatus>()

  // Place pillars (pinned)
  for (const info of pillarInfo) {
    const articles = articlesByPillar.get(info.pillar.id) ?? []
    const childStatuses = articles.map((a) => articleVisualStatus(a, targetsByArticle.get(a.id)))
    const pStatus = pillarVisualStatus(childStatuses)
    pillarStatusMap.set(info.pillar.id, pStatus)

    nodes.push({
      id: info.pillar.id,
      kind: 'pillar',
      x: info.x,
      y: info.y,
      size: pillarSize,
      pillarId: info.pillar.id,
      colorIdx: info.colorIdx,
      status: pStatus,
      title: info.pillar.title,
      subtitle: info.pillar.target_keyword,
    })
    placed.push({
      id: info.pillar.id,
      x: info.x,
      y: info.y,
      r: pillarSize / 2 + 12,
      size: pillarSize,
      kind: 'pillar',
      pillarId: info.pillar.id,
      pinned: true,
    })
  }

  // Place clusters in an outward-facing wedge around each pillar
  const baseR = Math.max(pillarSize / 2 + clusterSize / 2 + 36, 130 * scale)
  const wedge = Math.PI * (S < 520 ? 1.1 : 1.45)

  for (const info of pillarInfo) {
    const articles = articlesByPillar.get(info.pillar.id) ?? []
    if (articles.length === 0) continue

    // outward = angle pointing away from center (same as info.ang)
    const outward = info.ang
    const angMin = outward - wedge / 2
    const angMax = outward + wedge / 2

    articles.forEach((article, idx) => {
      const N = articles.length
      const pad = 0.12
      const t = N === 1 ? 0.5 : pad + (idx / (N - 1)) * (1 - 2 * pad)
      const ang = angMin + (angMax - angMin) * t
      const x = info.x + Math.cos(ang) * baseR
      const y = info.y + Math.sin(ang) * baseR

      const status = articleVisualStatus(article, targetsByArticle.get(article.id))
      nodes.push({
        id: article.id,
        kind: 'cluster',
        x, y,
        size: clusterSize,
        pillarId: info.pillar.id,
        colorIdx: info.colorIdx,
        status,
        isHub: article.role === 'hub',
        title: article.title,
        subtitle: article.target_keyword,
        parentId: info.pillar.id,
      })
      placed.push({
        id: article.id,
        x, y,
        r: clusterSize / 2 + 22, // label breathing room (keyword only)
        size: clusterSize,
        kind: 'cluster',
        pillarId: info.pillar.id,
        pinned: false,
        parentX: info.x,
        parentY: info.y,
        baseR,
      })
    })
  }

  // ---- Place orphan nodes around the periphery ----
  const outerR = sep * 1.65
  orphans.forEach((o, i) => {
    const ang = -Math.PI / 2 + (i / Math.max(orphans.length, 1)) * Math.PI * 2
    const x = cx + Math.cos(ang) * outerR
    const y = cy + Math.sin(ang) * outerR
    nodes.push({
      id: o.id,
      kind: 'orphan',
      x, y,
      size: clusterSize,
      pillarId: '',
      colorIdx: 0,
      status: (o.status === 'draft_ready' ? 'draft' : 'empty') as VisualStatus,
      title: o.title,
      subtitle: o.target_keyword,
    })
    placed.push({
      id: o.id,
      x, y,
      r: clusterSize / 2 + 26,
      size: clusterSize,
      kind: 'orphan',
      pillarId: '',
      pinned: false,
    })
  })

  // ---- Collision relaxation + parent tether + territorial pull ----
  const pillarCentroids = new Map<string, { x: number; y: number }>()
  for (const info of pillarInfo) pillarCentroids.set(info.pillar.id, { x: info.x, y: info.y })

  const ITER = 80
  for (let it = 0; it < ITER; it++) {
    for (let i = 0; i < placed.length; i++) {
      const a = placed[i]
      if (a.pinned) continue
      let fx = 0
      let fy = 0

      // Node-node repulsion
      for (let j = 0; j < placed.length; j++) {
        if (i === j) continue
        const b = placed[j]
        const dx = a.x - b.x
        const dy = a.y - b.y
        const d = Math.hypot(dx, dy) || 0.01
        const minD = a.r + b.r + 2
        if (d < minD) {
          const push = (minD - d) * 0.55
          fx += (dx / d) * push
          fy += (dy / d) * push
        }
      }

      // Tether to own parent
      if (a.parentX != null && a.parentY != null && a.baseR) {
        const tx = a.x - a.parentX
        const ty = a.y - a.parentY
        const td = Math.hypot(tx, ty) || 0.01
        const diff = td - a.baseR
        const k = 0.1
        fx -= (tx / td) * diff * k
        fy -= (ty / td) * diff * k
      }

      // Territorial pull — if another pillar is closer than own, push back toward own
      const own = pillarCentroids.get(a.pillarId)
      if (own) {
        let nearest = own
        let nearestD = Math.hypot(a.x - own.x, a.y - own.y)
        for (const [pid, p] of pillarCentroids) {
          if (pid === a.pillarId) continue
          const d = Math.hypot(a.x - p.x, a.y - p.y)
          if (d < nearestD) { nearestD = d; nearest = p }
        }
        if (nearest !== own) {
          const tx = a.x - own.x
          const ty = a.y - own.y
          const td = Math.hypot(tx, ty) || 0.01
          const k = 0.03
          fx += (tx / td) * td * k * -0 + (own.x - a.x) * k
          fy += (own.y - a.y) * k
        }
      }

      a.x += fx
      a.y += fy
    }
  }

  // Reflect relaxed positions back into nodes
  const byId = new Map(placed.map((p) => [p.id, p]))
  for (const n of nodes) {
    const p = byId.get(n.id)
    if (p) { n.x = p.x; n.y = p.y }
  }

  // Build edges: pillar → each cluster under it
  const edges: LaidOutEdge[] = []
  for (const n of nodes) {
    if (n.kind !== 'cluster' || !n.parentId) continue
    const parent = nodes.find((x) => x.id === n.parentId)
    if (!parent) continue
    edges.push({
      from: { x: parent.x, y: parent.y },
      to: { x: n.x, y: n.y },
      pillarId: n.pillarId,
      colorIdx: n.colorIdx,
      pillarStatus: parent.status,
      clusterStatus: n.status,
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
        className="relative w-full h-[calc(100vh-180px)] min-h-[560px] overflow-hidden"
        style={{ cursor: dragPos ? 'grabbing' : isPanning ? 'grabbing' : 'grab' }}
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
            width: size.w,
            height: size.h,
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
                stroke={COLOR_HEX[e.colorIdx as 0 | 1 | 2].main}
                strokeWidth={active ? 1.75 : 1.25}
                strokeLinecap="round"
                strokeDasharray={dashed ? '3 5' : undefined}
                opacity={dim ? 0.08 : dashed ? 0.4 : active ? 0.8 : 0.55}
                style={{ transition: 'opacity 150ms ease, stroke-width 150ms ease' }}
              />
            )
          })}
        </svg>

        {/* Nodes */}
        {nodes.map((n) => {
          const hex = COLOR_HEX[n.colorIdx as 0 | 1 | 2]
          const isInGroup = hoveredPillarId && hoveredPillarId === n.pillarId
          const isDimmed = hoveredPillarId && hoveredPillarId !== n.pillarId
          const isSelected = selectedPillarId === n.id

          if (n.kind === 'pillar') {
            const isDragTarget = dragTargetPillarId === n.id
            return (
              <button
                key={n.id}
                type="button"
                onMouseEnter={() => setHoveredPillarId(n.id)}
                onMouseLeave={() => setHoveredPillarId(null)}
                onClick={() => setSelectedPillarId(n.id === selectedPillarId ? null : n.id)}
                className="absolute flex flex-col items-center gap-1 text-center select-none group cursor-pointer"
                style={{
                  left: n.x,
                  top: n.y,
                  transform: 'translate(-50%, -50%)',
                  opacity: isDimmed ? 0.22 : 1,
                  filter: isDimmed ? 'saturate(0.55)' : undefined,
                  transition: 'opacity 150ms ease, filter 150ms ease',
                  zIndex: isInGroup || isSelected ? 3 : 1,
                }}
              >
                <span
                  className={cn(
                    'relative flex items-center justify-center rounded-full transition-transform duration-150 group-hover:scale-105',
                  )}
                  style={{
                    width: n.size,
                    height: n.size,
                    background: n.status === 'empty'
                      ? 'var(--color-bg)'
                      : n.status === 'draft'
                        ? hex.tint
                        : `radial-gradient(circle at 30% 25%, color-mix(in oklab, ${hex.main} 85%, white), ${hex.main} 75%)`,
                    color: n.status === 'published' ? 'var(--color-bg)' : hex.main,
                    border: n.status === 'published'
                      ? 'none'
                      : n.status === 'empty'
                        ? `2px dashed ${hex.main}`
                        : `2px solid ${hex.main}`,
                    boxShadow: isDragTarget
                      ? `0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-ochre), 0 0 16px var(--color-ochre)`
                      : isSelected
                        ? `0 0 0 2px var(--color-bg), 0 0 0 3.5px var(--color-ochre)`
                        : '0 1px 0 rgba(18,34,28,0.05), 0 2px 8px rgba(18,34,28,0.04)',
                  }}
                >
                  {/* Draft hatching overlay */}
                  {n.status === 'draft' && (
                    <span
                      className="absolute inset-0 rounded-full pointer-events-none"
                      style={{
                        background: `repeating-linear-gradient(135deg, color-mix(in oklab, ${hex.main} 35%, transparent) 0 2px, transparent 2px 8px)`,
                      }}
                    />
                  )}
                  <span
                    className="font-serif italic leading-tight px-2 text-center"
                    style={{ fontSize: Math.max(12, n.size * 0.15) }}
                  >
                    {n.subtitle || n.title}
                  </span>
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
                className="absolute flex flex-col items-center gap-1 text-center select-none group cursor-grab active:cursor-grabbing"
                style={{
                  left: n.x,
                  top: n.y,
                  transform: 'translate(-50%, -50%)',
                  maxWidth: n.size + 80,
                  zIndex: isArticleSelected ? 3 : 1,
                  opacity: isArticleSelected ? 1 : 0.65,
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
                      ? '0 0 0 2px var(--color-bg), 0 0 0 3.5px var(--color-ochre)'
                      : '0 1px 0 rgba(18,34,28,0.06), 0 2px 8px rgba(18,34,28,0.08)',
                  }}
                />
                <span className="font-serif italic text-[11px] text-ink-3 leading-tight whitespace-normal" style={{ maxWidth: n.size + 80 }}>
                  {n.subtitle || n.title.slice(0, 12)}
                </span>
              </button>
            )
          }

          // Cluster
          const isClusterSelected = selectedArticleId === n.id
          return (
            <button
              key={n.id}
              type="button"
              onMouseEnter={() => setHoveredPillarId(n.pillarId)}
              onMouseLeave={() => setHoveredPillarId(null)}
              onClick={() => setSelectedArticleId(n.id === selectedArticleId ? null : n.id)}
              className="absolute flex flex-col items-center gap-1 text-center select-none group cursor-pointer"
              style={{
                left: n.x,
                top: n.y,
                transform: 'translate(-50%, -50%)',
                opacity: isDimmed ? 0.22 : 1,
                filter: isDimmed ? 'saturate(0.55)' : undefined,
                transition: 'opacity 150ms ease',
                zIndex: isClusterSelected ? 3 : isInGroup ? 2 : 1,
                maxWidth: n.size + 80,
              }}
            >
              <span
                className={cn('relative rounded-full transition-all duration-150 group-hover:scale-105')}
                style={{
                  width: n.size,
                  height: n.size,
                  background: n.status === 'published'
                    ? hex.main
                    : n.status === 'draft'
                      ? hex.tint
                      : 'var(--color-bg)',
                  border: n.status === 'empty'
                    ? `1.5px dashed color-mix(in oklab, ${hex.main} 55%, var(--color-ink-4))`
                    : `1.5px solid ${hex.main}`,
                  color: n.status === 'empty'
                    ? `color-mix(in oklab, ${hex.main} 60%, var(--color-ink-4))`
                    : hex.main,
                  boxShadow: n.isHub
                    ? `0 0 0 3px var(--color-bg), 0 0 0 4px color-mix(in oklab, ${hex.main} 65%, var(--color-ink-4))`
                    : '0 1px 0 rgba(18,34,28,0.05), 0 2px 8px rgba(18,34,28,0.04)',
                }}
              >
                {n.status === 'draft' && (
                  <span className="absolute inset-0 rounded-full pointer-events-none" style={{
                    background: `repeating-linear-gradient(135deg, color-mix(in oklab, ${hex.main} 35%, transparent) 0 1.5px, transparent 1.5px 6px)`,
                  }} />
                )}
                {n.status === 'empty' && (
                  <span className="absolute inset-0 flex items-center justify-center font-serif text-[22px] leading-none pointer-events-none"
                    style={{ color: `color-mix(in oklab, ${hex.main} 60%, var(--color-ink-4))` }}>+</span>
                )}
              </span>
              <span className="font-serif italic text-[13px] text-ink leading-tight whitespace-normal" style={{ maxWidth: n.size + 80 }}>
                {n.subtitle || n.title.slice(0, 12)}
              </span>
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

        {/* Legend — bottom-left, outside transform */}
        <div className="absolute left-4 bottom-4 rounded-lg border border-rule bg-bg/90 backdrop-blur-sm shadow-sh-1 p-3 text-[11px] text-ink-3 space-y-1.5 pointer-events-none">
          <LegendItem dot="published" label="published" />
          <LegendItem dot="draft" label="draft" />
          <LegendItem dot="empty" label="planning" />
        </div>

        {/* Zoom controls — bottom-right, outside transform */}
        <div className="absolute right-4 bottom-4 flex items-center gap-1 rounded-lg border border-rule bg-bg/90 backdrop-blur-sm shadow-sh-1 p-1 pointer-events-auto">
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setZoom(z => Math.min(4, +(z * 1.25).toFixed(2))) }}
            className="w-7 h-7 flex items-center justify-center rounded text-[16px] text-ink-3 hover:bg-mist hover:text-ink transition-colors cursor-pointer"
          >+</button>
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); resetView() }}
            className="font-mono text-[10px] px-1.5 h-7 flex items-center text-ink-4 hover:bg-mist hover:text-ink transition-colors rounded cursor-pointer"
          >{Math.round(zoom * 100)}%</button>
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setZoom(z => Math.max(0.2, +(z / 1.25).toFixed(2))) }}
            className="w-7 h-7 flex items-center justify-center rounded text-[16px] text-ink-3 hover:bg-mist hover:text-ink transition-colors cursor-pointer"
          >−</button>
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
