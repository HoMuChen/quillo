export default function Home() {
  return (
    <main className="relative z-10 min-h-screen p-12 space-y-10">
      <header className="space-y-2">
        <h1 className="font-serif italic text-[48px] leading-none tracking-tight text-ink">
          Quillo
        </h1>
        <p className="text-ink-3 max-w-md text-[14px]">
          editorial, ink-on-off-white
        </p>
      </header>

      <section className="flex gap-3">
        <button className="h-10 px-4 rounded-lg bg-ink text-bg border border-ink text-[13px] font-medium hover:bg-ink-2 hover:border-ink-2 transition-colors shadow-sh-1">
          Primary action
        </button>
        <button className="h-10 px-4 rounded-lg bg-bg text-ink border border-rule text-[13px] font-medium hover:border-ink-3 transition-colors">
          Default action
        </button>
      </section>

      <section>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium uppercase tracking-wide border border-rule bg-bg text-ink-2">
          <span className="w-1.5 h-1.5 rounded-full bg-ochre" />
          Draft
        </span>
      </section>

      <section className="max-w-md rounded-xl border border-rule p-4 font-serif italic text-[15px] leading-[1.4] text-ink-2 bg-[linear-gradient(180deg,#f7f0d8_0%,#f1e7c6_100%)] relative shadow-sh-1">
        <span className="absolute top-2.5 right-3 text-ochre not-italic">
          ✦
        </span>
        <div className="font-sans not-italic text-[10px] font-medium tracking-[0.14em] uppercase text-ochre-2 mb-1.5">
          AI Suggestion
        </div>
        <p>這是一個 AI 建議的樣式範例，用來確認字級、顏色與紙感背景都正確套用。</p>
      </section>

      <section className="max-w-md text-[12px] text-ink-4 uppercase tracking-[0.14em] border-t border-rule pt-4">
        Token check passed
      </section>
    </main>
  );
}
