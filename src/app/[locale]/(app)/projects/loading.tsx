export default function Loading() {
  return (
    <div className="space-y-6 max-w-6xl animate-pulse">
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-3">
          <div className="h-10 w-56 rounded bg-bg-2" />
          <div className="h-4 w-72 rounded bg-bg-2" />
        </div>
        <div className="h-10 w-28 rounded-lg bg-bg-2" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-rule bg-bg p-5 shadow-sh-1 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="h-6 w-3/4 rounded bg-bg-2" />
              <div className="h-3 w-10 rounded bg-bg-2" />
            </div>
            <div className="h-3 w-1/2 rounded bg-bg-2" />
            <div className="h-3 w-2/3 rounded bg-bg-2" />
          </div>
        ))}
      </div>
    </div>
  )
}
