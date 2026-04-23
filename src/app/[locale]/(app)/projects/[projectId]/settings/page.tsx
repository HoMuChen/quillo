import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { decryptJson, fromBytea } from '@/lib/crypto/encrypt'
import { ConnectionForm } from './_connection-form'
import { ShopifyConnectionForm } from './_shopify-connection-form'
import { GscConnectionCard } from './_gsc-connection-card'

type Props = { params: Promise<{ locale: string; projectId: string }> }

export default async function SettingsPage({ params }: Props) {
  const { locale, projectId } = await params
  setRequestLocale(locale)
  const t = await getTranslations('publish')

  const supabase = await createClient()
  const { data: project } = await supabase
    .from('projects').select('id,name').eq('id', projectId).single()
  if (!project) notFound()

  const [{ data: ghostConn }, { data: shopifyConn }, { data: gscConn }] = await Promise.all([
    supabase
      .from('site_connections')
      .select('id,name,platform,last_tested_at,last_test_ok,config_encrypted')
      .eq('project_id', projectId)
      .eq('platform', 'ghost')
      .maybeSingle(),
    supabase
      .from('site_connections')
      .select('id,name,platform,last_tested_at,last_test_ok,config_encrypted')
      .eq('project_id', projectId)
      .eq('platform', 'shopify')
      .maybeSingle(),
    supabase
      .from('gsc_connections')
      .select('id,google_user_email,property_url,last_synced_at,last_sync_status,last_sync_error')
      .eq('project_id', projectId)
      .maybeSingle(),
  ])

  let ghostApiUrl: string | null = null
  if (ghostConn?.config_encrypted) {
    try {
      const cfg = decryptJson<{ apiUrl: string; apiKey: string }>(fromBytea(ghostConn.config_encrypted))
      ghostApiUrl = cfg.apiUrl
    } catch (err) {
      console.error('decrypt ghost config', err)
    }
  }

  let shopifyInitial: {
    id: string; name: string; storeUrl: string | null; blogTitle: string | null;
    last_tested_at: string | null; last_test_ok: boolean | null
  } | null = null
  if (shopifyConn?.config_encrypted) {
    try {
      const cfg = decryptJson<{ storeUrl: string; blogTitle: string }>(fromBytea(shopifyConn.config_encrypted))
      shopifyInitial = {
        id: shopifyConn.id,
        name: shopifyConn.name,
        storeUrl: cfg.storeUrl,
        blogTitle: cfg.blogTitle,
        last_tested_at: shopifyConn.last_tested_at,
        last_test_ok: shopifyConn.last_test_ok,
      }
    } catch (err) {
      console.error('decrypt shopify config', err)
    }
  }

  return (
    <div className="space-y-10 max-w-2xl">
      <header>
        <h1 className="font-serif italic text-[32px] text-ink leading-tight">{t('settings_title')}</h1>
        <p className="text-[12px] text-ink-3 mt-1">{t('settings_subtitle')}</p>
      </header>
      <ConnectionForm
        projectId={projectId}
        initial={ghostConn ? {
          id: ghostConn.id,
          name: ghostConn.name,
          last_tested_at: ghostConn.last_tested_at,
          last_test_ok: ghostConn.last_test_ok,
          apiUrl: ghostApiUrl,
        } : null}
      />
      <ShopifyConnectionForm
        projectId={projectId}
        initial={shopifyInitial}
      />
      <GscConnectionCard projectId={projectId} initial={gscConn ?? null} />
    </div>
  )
}
