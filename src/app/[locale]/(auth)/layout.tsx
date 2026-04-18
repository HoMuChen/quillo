import { setRequestLocale } from 'next-intl/server'

export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <main className="relative z-10 min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="font-serif italic text-[40px] leading-none text-ink">Quillo</h1>
          <p className="text-[11px] uppercase tracking-[0.14em] text-ink-4 mt-2">editorial content graph</p>
        </div>
        {children}
      </div>
    </main>
  )
}
