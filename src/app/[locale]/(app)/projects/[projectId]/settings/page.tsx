import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { decryptJson } from '@/lib/crypto/encrypt'
import { ConnectionForm } from './_connection-form'

type Props = { params: Promise<{ locale: string; projectId: string }> }

export default async function SettingsPage({ params }: Props) {
  const { locale, projectId } = await params
  setRequestLocale(locale)
  const t = await getTranslations('publish')

  const supabase = await createClient()
  const { data: project } = await supabase
    .from('projects').select('id,name').eq('id', projectId).single()
  if (!project) notFound()

  const { data: connection } = await supabase
    .from('site_connections')
    .select('id,name,platform,last_tested_at,last_test_ok,config_encrypted')
    .eq('project_id', projectId)
    .eq('platform', 'ghost')
    .maybeSingle()

  let apiUrl: string | null = null
  if (connection?.config_encrypted) {
    try {
      const bytea = connection.config_encrypted as unknown as Uint8Array | Buffer
      const buf = Buffer.isBuffer(bytea) ? bytea : Buffer.from(bytea)
      const cfg = decryptJson<{ apiUrl: string; apiKey: string }>(buf)
      apiUrl = cfg.apiUrl
    } catch (err) {
      console.error('decrypt ghost config', err)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <header>
        <h1 className="font-serif italic text-[32px] text-ink leading-tight">{t('settings_title')}</h1>
        <p className="text-[12px] text-ink-3 mt-1">{t('settings_subtitle')}</p>
      </header>
      <ConnectionForm
        projectId={projectId}
        initial={connection ? {
          id: connection.id,
          name: connection.name,
          last_tested_at: connection.last_tested_at,
          last_test_ok: connection.last_test_ok,
          apiUrl,
        } : null}
      />
    </div>
  )
}
