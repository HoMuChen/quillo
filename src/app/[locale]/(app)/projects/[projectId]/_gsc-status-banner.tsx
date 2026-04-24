import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { AlertTriangle, Info } from 'lucide-react'

type GscConn = {
  last_synced_at: string | null
  last_sync_error: string | null
} | null

type Props = {
  gscConn: GscConn
  projectId: string
  locale: string
}

const STALE_THRESHOLD_MS = 48 * 60 * 60 * 1000

export async function GscStatusBanner({ gscConn, projectId, locale }: Props) {
  if (!gscConn) return null

  const t = await getTranslations('publish')

  const isRevoked = gscConn.last_sync_error === 'refresh_token_revoked'
  const isNeverSynced = !gscConn.last_synced_at
  const isStale =
    !isRevoked &&
    !isNeverSynced &&
    Date.now() - new Date(gscConn.last_synced_at!).getTime() > STALE_THRESHOLD_MS

  if (!isRevoked && !isNeverSynced && !isStale) return null

  const settingsHref = `/projects/${projectId}/settings`

  if (isRevoked) {
    return (
      <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[12px] text-amber-800">
        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-none" />
        <span>{t('gsc_reconnect_needed')}</span>
        <Link
          href={settingsHref}
          locale={locale as 'zh-TW' | 'en'}
          className="ml-auto font-medium underline underline-offset-2 hover:opacity-70 shrink-0"
        >
          {t('gsc_banner_go_settings')}
        </Link>
      </div>
    )
  }

  if (isNeverSynced) {
    return (
      <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-[12px] text-blue-700">
        <Info className="w-3.5 h-3.5 mt-0.5 flex-none" />
        <span>{t('gsc_banner_never')}</span>
        <Link
          href={settingsHref}
          locale={locale as 'zh-TW' | 'en'}
          className="ml-auto font-medium underline underline-offset-2 hover:opacity-70 shrink-0"
        >
          {t('gsc_banner_go_settings')}
        </Link>
      </div>
    )
  }

  // Stale
  const when = new Date(gscConn.last_synced_at!).toISOString().slice(0, 10)
  return (
    <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[12px] text-amber-800">
      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-none" />
      <span>{t('gsc_banner_stale', { when })}</span>
      <Link
        href={settingsHref}
        locale={locale as 'zh-TW' | 'en'}
        className="ml-auto font-medium underline underline-offset-2 hover:opacity-70 shrink-0"
      >
        {t('gsc_banner_go_settings')}
      </Link>
    </div>
  )
}
