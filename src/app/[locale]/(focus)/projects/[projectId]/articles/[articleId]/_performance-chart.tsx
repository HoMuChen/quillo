'use client'

import { useState, useRef } from 'react'

type DataPoint = { date: string; clicks: number; impressions: number }

const CLICKS_COLOR = '#5c3d14'      // ochre-ink — same token used elsewhere
const IMPRESSIONS_COLOR = '#b0a99a' // ink-4 tone

const W = 600
const H = 80
const PAD_X = 0
const PAD_Y = 6

export function PerformanceChart({
  data,
  labelClicks,
  labelImpressions,
}: {
  data: DataPoint[]
  labelClicks: string
  labelImpressions: string
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  if (data.length < 2) return null

  const n = data.length
  const maxC = Math.max(...data.map((d) => d.clicks), 1)
  const maxI = Math.max(...data.map((d) => d.impressions), 1)

  const xOf = (i: number) => PAD_X + (i / (n - 1)) * (W - PAD_X * 2)
  const yOf = (v: number, max: number) => H - PAD_Y - (v / max) * (H - PAD_Y * 2)

  const polyPts = (vals: number[], max: number) =>
    vals.map((v, i) => `${xOf(i)},${yOf(v, max)}`).join(' ')

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const relX = ((e.clientX - rect.left) / rect.width) * W
    const i = Math.round((relX / W) * (n - 1))
    setHoverIdx(Math.max(0, Math.min(n - 1, i)))
  }

  const pt = hoverIdx !== null ? data[hoverIdx] : null
  const hoverX = hoverIdx !== null ? xOf(hoverIdx) : null

  // Tooltip position: flip to left side when near right edge
  const tooltipLeft = hoverIdx !== null && hoverIdx > n * 0.65

  return (
    <div className="space-y-2.5">
      {/* Legend */}
      <div className="flex items-center gap-4 text-[11px]">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-5 rounded-full inline-block" style={{ background: CLICKS_COLOR }} />
          <span className="text-ink-3">{labelClicks}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-5 rounded-full inline-block" style={{ background: IMPRESSIONS_COLOR }} />
          <span className="text-ink-3">{labelImpressions}</span>
        </span>
        <span className="ml-auto text-[10px] text-ink-4 font-mono">each scaled independently</span>
      </div>

      {/* SVG chart */}
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-[72px] cursor-crosshair"
          preserveAspectRatio="none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIdx(null)}
        >
          {/* Impressions — lighter */}
          <polyline
            points={polyPts(data.map((d) => d.impressions), maxI)}
            fill="none"
            stroke={IMPRESSIONS_COLOR}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Clicks — stronger */}
          <polyline
            points={polyPts(data.map((d) => d.clicks), maxC)}
            fill="none"
            stroke={CLICKS_COLOR}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />

          {/* Hover: vertical line + dots */}
          {hoverIdx !== null && hoverX !== null && (
            <>
              <line
                x1={hoverX} y1={PAD_Y}
                x2={hoverX} y2={H - PAD_Y}
                stroke="var(--color-rule)"
                strokeWidth="1"
              />
              <circle
                cx={hoverX}
                cy={yOf(data[hoverIdx].clicks, maxC)}
                r="3"
                fill={CLICKS_COLOR}
              />
              <circle
                cx={hoverX}
                cy={yOf(data[hoverIdx].impressions, maxI)}
                r="3"
                fill={IMPRESSIONS_COLOR}
              />
            </>
          )}
        </svg>

        {/* Floating tooltip */}
        {pt !== null && hoverX !== null && (
          <div
            className="pointer-events-none absolute -top-1 z-10 rounded-md bg-ink px-2.5 py-2 shadow-sh-2 text-[11px] text-bg space-y-0.5 -translate-y-full"
            style={{
              left: tooltipLeft
                ? `calc(${(hoverX / W) * 100}% - 4px)`
                : `calc(${(hoverX / W) * 100}% + 4px)`,
              transform: `translateY(-100%) ${tooltipLeft ? 'translateX(-100%)' : ''}`,
            }}
          >
            <div className="font-mono text-[10px] text-ink-4">{pt.date}</div>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full shrink-0 inline-block" style={{ background: CLICKS_COLOR }} />
              {labelClicks}: <span className="font-medium">{pt.clicks.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full shrink-0 inline-block" style={{ background: IMPRESSIONS_COLOR }} />
              {labelImpressions}: <span className="font-medium">{pt.impressions.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between text-[10px] text-ink-4 font-mono">
        <span>{data[0].date}</span>
        <span>{data[data.length - 1].date}</span>
      </div>
    </div>
  )
}
