export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6 animate-pulse">
        <div className="h-8 w-48 rounded bg-bg-2" />
        <div className="h-10 w-40 rounded-lg bg-bg-2" />
      </div>
      <div className="rounded-xl border border-rule bg-bg/60 p-16 shadow-sh-1 flex flex-col items-center justify-center gap-3 min-h-[360px]">
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-4 inline-flex items-center gap-1.5">
          <span>loading graph</span>
          <span className="inline-flex gap-1">
            <span className="w-1 h-1 rounded-full bg-ink-4 animate-[pulse_1s_ease-in-out_infinite]" />
            <span className="w-1 h-1 rounded-full bg-ink-4 animate-[pulse_1s_ease-in-out_0.15s_infinite]" />
            <span className="w-1 h-1 rounded-full bg-ink-4 animate-[pulse_1s_ease-in-out_0.3s_infinite]" />
          </span>
        </div>
        <div className="grid grid-cols-3 gap-8 mt-4 opacity-50 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="h-4 w-20 rounded bg-bg-2" />
              <div className="h-14 w-14 rounded-full bg-bg-2" />
              <div className="w-px h-6 bg-bg-2" />
              <div className="space-y-1.5">
                <div className="h-2 w-14 rounded bg-bg-2" />
                <div className="h-2 w-10 rounded bg-bg-2" />
                <div className="h-2 w-12 rounded bg-bg-2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
