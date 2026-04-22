'use client'

import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function LastTestBadge({ ok }: { ok: boolean | null }) {
  if (ok === null) return <span className="text-ink-4">—</span>
  return ok
    ? <span className="inline-flex items-center gap-1 text-sage"><Check className="w-3 h-3" /> ok</span>
    : <span className="inline-flex items-center gap-1 text-rust"><X className="w-3 h-3" /> failed</span>
}

type Tone = 'success' | 'error' | 'plain'

function Line({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const color = tone === 'error' ? 'text-rust' : tone === 'success' ? 'text-sage' : 'text-ink-3'
  return <p className={cn('text-[12px]', color)}>{children}</p>
}

export function StatusLines({
  testResult,
  syncMessage,
  message,
  error,
  testSuccessLabel,
  testFailedLabel,
}: {
  testResult?: { ok: boolean; error: string | null } | null
  syncMessage?: { ok: boolean; text: string } | null
  message?: string | null
  error?: string | null
  testSuccessLabel: string
  testFailedLabel: string
}) {
  return (
    <>
      {syncMessage && (
        <Line tone={syncMessage.ok ? 'success' : 'error'}>
          {syncMessage.ok
            ? <><Check className="inline w-3 h-3 mr-1" />{syncMessage.text}</>
            : <><X className="inline w-3 h-3 mr-1" />{syncMessage.text}</>}
        </Line>
      )}
      {testResult && (
        <Line tone={testResult.ok ? 'success' : 'error'}>
          {testResult.ok
            ? <><Check className="inline w-3 h-3 mr-1" />{testSuccessLabel}</>
            : <><X className="inline w-3 h-3 mr-1" />{testResult.error ?? testFailedLabel}</>}
        </Line>
      )}
      {message && <Line tone="success">{message}</Line>}
      {error && <Line tone="error">{error}</Line>}
    </>
  )
}
