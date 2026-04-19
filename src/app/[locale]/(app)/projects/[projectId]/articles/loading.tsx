export default function Loading() {
  return (
    <div className="space-y-5 max-w-6xl animate-pulse">
      <div className="flex items-start justify-between gap-4">
        <div className="h-8 w-40 rounded bg-bg-2" />
        <div className="h-10 w-36 rounded-lg bg-bg-2" />
      </div>
      <div className="rounded-xl border border-rule bg-bg shadow-sh-1 overflow-hidden">
        <div className="grid grid-cols-[1fr_120px_100px_120px] gap-4 px-4 py-3 border-b border-rule bg-bg/60">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-3 rounded bg-bg-2" />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_120px_100px_120px] gap-4 px-4 py-4 border-b border-rule/60 last:border-b-0"
          >
            <div className="space-y-2">
              <div className="h-4 w-3/4 rounded bg-bg-2" />
              <div className="h-3 w-1/3 rounded bg-bg-2" />
            </div>
            <div className="h-4 w-20 rounded bg-bg-2 self-center" />
            <div className="h-4 w-16 rounded bg-bg-2 self-center" />
            <div className="h-4 w-24 rounded bg-bg-2 self-center" />
          </div>
        ))}
      </div>
    </div>
  )
}
