import { setRequestLocale } from 'next-intl/server'

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <div className="space-y-4">
      <h1 className="font-serif italic text-[32px] text-ink">Projects</h1>
      <p className="text-ink-3 text-[13px]">Placeholder — Task 16 fills this in.</p>
    </div>
  )
}
