export default function Loading() {
  return (
    <div className="space-y-6 max-w-5xl animate-pulse">
      <div className="space-y-3">
        <div className="h-3 w-28 rounded bg-bg-2" />
        <div className="h-3 w-40 rounded bg-bg-2" />
        <div className="h-10 w-3/4 rounded bg-bg-2" />
        <div className="flex items-center gap-3">
          <div className="h-3 w-24 rounded bg-bg-2" />
          <div className="h-3 w-20 rounded bg-bg-2" />
          <div className="h-3 w-16 rounded bg-bg-2" />
        </div>
      </div>
      <div className="h-48 w-full rounded-xl border border-rule bg-bg-2" />
      <div className="flex items-center gap-2 border-b border-rule pb-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-7 w-20 rounded bg-bg-2" />
        ))}
      </div>
      <div className="space-y-3">
        <div className="h-5 w-1/3 rounded bg-bg-2" />
        <div className="h-3 w-1/2 rounded bg-bg-2" />
        <div className="space-y-2 pt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 w-full rounded-lg border border-rule bg-bg shadow-sh-1" />
          ))}
        </div>
      </div>
    </div>
  )
}
