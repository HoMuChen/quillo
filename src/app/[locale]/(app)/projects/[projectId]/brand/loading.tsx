export default function Loading() {
  return (
    <div className="space-y-6 max-w-3xl animate-pulse">
      <div className="space-y-2">
        <div className="h-8 w-40 rounded bg-bg-2" />
        <div className="h-4 w-72 rounded bg-bg-2" />
      </div>
      <div className="rounded-xl border border-rule bg-bg p-6 shadow-sh-1 space-y-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-28 rounded bg-bg-2" />
            <div className="h-10 w-full rounded-lg bg-bg-2" />
          </div>
        ))}
        <div className="pt-2 flex justify-end">
          <div className="h-10 w-28 rounded-lg bg-bg-2" />
        </div>
      </div>
    </div>
  )
}
