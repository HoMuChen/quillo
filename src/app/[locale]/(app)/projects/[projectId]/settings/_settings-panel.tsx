'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { SlideOverPanel } from '@/components/ui/slide-over'
import { Button } from '@/components/ui/button'
import { Check, X } from 'lucide-react'
import { ConnectionForm } from './_connection-form'
import { ShopifyConnectionForm } from './_shopify-connection-form'
import { GscConnectionCard } from './_gsc-connection-card'
import { cn } from '@/lib/utils'

// --- prop types (mirror what page.tsx already computes) ---

type GhostInitial = {
  id: string; name: string; last_tested_at: string | null;
  last_test_ok: boolean | null; apiUrl: string | null
} | null

type ShopifyInitial = {
  id: string; name: string; storeUrl: string | null; blogTitle: string | null;
  last_tested_at: string | null; last_test_ok: boolean | null
} | null

type GscInitial = {
  id: string; google_user_email: string; property_url: string;
  last_synced_at: string | null; last_sync_status: string | null; last_sync_error: string | null
} | null

export function SettingsPanel({
  projectId,
  locale,
  ghostInitial,
  shopifyInitial,
  gscInitial,
}: {
  projectId: string
  locale: string
  ghostInitial: GhostInitial
  shopifyInitial: ShopifyInitial
  gscInitial: GscInitial
}) {
  const t = useTranslations('publish')
  const [openPanel, setOpenPanel] = useState<'ghost' | 'shopify' | 'gsc' | null>(null)

  const close = () => setOpenPanel(null)

  return (
    <>
      <div className="space-y-8">
        {/* Publishing section */}
        <section className="space-y-3">
          <h2 className="font-sans font-semibold text-[14px] text-ink-3 uppercase tracking-[0.1em]">
            {t('section_publish')}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <ConnectionCard
              name="Ghost"
              connected={!!ghostInitial}
              detail={ghostInitial?.apiUrl ?? undefined}
              status={ghostInitial ? (ghostInitial.last_test_ok === false ? 'error' : 'ok') : 'none'}
              onClick={() => setOpenPanel('ghost')}
            />
            <ConnectionCard
              name="Shopify"
              connected={!!shopifyInitial}
              detail={shopifyInitial?.storeUrl ?? undefined}
              sub={shopifyInitial?.blogTitle ?? undefined}
              status={shopifyInitial ? (shopifyInitial.last_test_ok === false ? 'error' : 'ok') : 'none'}
              onClick={() => setOpenPanel('shopify')}
            />
          </div>
        </section>

        {/* SEO section */}
        <section className="space-y-3">
          <h2 className="font-sans font-semibold text-[14px] text-ink-3 uppercase tracking-[0.1em]">
            {t('section_seo')}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <ConnectionCard
              name="Google Search Console"
              connected={!!gscInitial}
              detail={gscInitial?.google_user_email ?? undefined}
              sub={gscInitial?.property_url ?? undefined}
              status={gscInitial
                ? (gscInitial.last_sync_error === 'refresh_token_revoked' ? 'error'
                  : gscInitial.last_sync_status === 'error' ? 'error' : 'ok')
                : 'none'}
              onClick={() => setOpenPanel('gsc')}
            />
          </div>
        </section>
      </div>

      {/* Slide-over panels */}
      <SlideOverPanel open={openPanel === 'ghost'} onClose={close} ariaLabel="Ghost settings" width={560}>
        <div className="flex flex-col h-full overflow-auto">
          <PanelHeader title="Ghost" onClose={close} />
          <div className="flex-1 overflow-auto p-5">
            <ConnectionForm projectId={projectId} initial={ghostInitial} />
          </div>
        </div>
      </SlideOverPanel>

      <SlideOverPanel open={openPanel === 'shopify'} onClose={close} ariaLabel="Shopify settings" width={560}>
        <div className="flex flex-col h-full overflow-auto">
          <PanelHeader title="Shopify" onClose={close} />
          <div className="flex-1 overflow-auto p-5">
            <ShopifyConnectionForm projectId={projectId} initial={shopifyInitial} />
          </div>
        </div>
      </SlideOverPanel>

      <SlideOverPanel open={openPanel === 'gsc'} onClose={close} ariaLabel="Google Search Console settings" width={560}>
        <div className="flex flex-col h-full overflow-auto">
          <PanelHeader title="Google Search Console" onClose={close} />
          <div className="flex-1 overflow-auto p-5">
            <GscConnectionCard projectId={projectId} initial={gscInitial} />
          </div>
        </div>
      </SlideOverPanel>
    </>
  )
}

function PanelHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-5 h-14 border-b border-rule shrink-0">
      <h3 className="font-sans font-semibold text-[16px] text-ink">{title}</h3>
      <Button variant="ghost" size="icon" onClick={onClose}>
        <X className="w-4 h-4" />
      </Button>
    </div>
  )
}

function ConnectionCard({
  name, connected, detail, sub, status, onClick,
}: {
  name: string
  connected: boolean
  detail?: string
  sub?: string
  status: 'ok' | 'error' | 'none'
  onClick: () => void
}) {
  const t = useTranslations('publish')

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'text-left w-full rounded-xl p-4 border transition-colors cursor-pointer',
        'hover:border-ink-3 hover:shadow-sh-1',
        connected
          ? 'bg-white border-rule shadow-sh-1'
          : 'bg-bg border-dashed border-rule',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-sans font-semibold text-[14px] text-ink leading-tight">{name}</span>
        {connected ? (
          <span className={cn(
            'inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full shrink-0',
            status === 'error'
              ? 'bg-rust/10 text-rust'
              : 'bg-sage/15 text-sage',
          )}>
            {status === 'error'
              ? <><X className="w-2.5 h-2.5" />{t('card_error')}</>
              : <><Check className="w-2.5 h-2.5" />{t('card_connected')}</>}
          </span>
        ) : (
          <span className="text-[11px] text-ink-4">{t('card_not_set')}</span>
        )}
      </div>
      {connected && detail && (
        <p className="mt-1.5 text-[11px] text-ink-3 truncate">{detail}</p>
      )}
      {connected && sub && (
        <p className="text-[11px] text-ink-4 truncate">{sub}</p>
      )}
      {!connected && (
        <p className="mt-1.5 text-[11px] text-ink-4">{t('card_click_to_setup')}</p>
      )}
    </button>
  )
}
