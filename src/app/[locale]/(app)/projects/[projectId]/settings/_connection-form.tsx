'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { Trash2, RefreshCw } from 'lucide-react'
import {
  saveGhostConnectionAction, testGhostConnectionAction, deleteGhostConnectionAction,
} from './settings-actions'
import { syncGhostArticlesAction } from '../planning/planning-actions'
import { LastTestBadge, StatusLines } from './_connection-ui'

type Initial = {
  id: string
  name: string
  last_tested_at: string | null
  last_test_ok: boolean | null
  apiUrl: string | null
} | null

export function ConnectionForm({
  projectId,
  initial,
}: {
  projectId: string
  initial: Initial
}) {
  const t = useTranslations('publish')
  const tp = useTranslations('planning')
  const router = useRouter()
  const [name, setName] = useState(initial?.name ?? '')
  const [apiUrl, setApiUrl] = useState(initial?.apiUrl ?? '')
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [testResult, setTestResult] = useState<{ ok: boolean; error: string | null } | null>(null)
  const [savePending, startSave] = useTransition()
  const [testPending, startTest] = useTransition()
  const [deletePending, startDelete] = useTransition()
  const [syncPending, startSync] = useTransition()
  const [editing, setEditing] = useState(!initial)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setMessage(null)
    startSave(async () => {
      try {
        await saveGhostConnectionAction(projectId, { name, apiUrl, apiKey })
        setMessage(t('saved'))
        setEditing(false)
        setApiKey('')
      } catch (err) {
        setError(err instanceof Error ? err.message : t('save_error'))
      }
    })
  }

  function test() {
    setTestResult(null)
    startTest(async () => {
      try {
        const result = await testGhostConnectionAction(projectId)
        setTestResult(result)
      } catch (err) {
        setTestResult({ ok: false, error: err instanceof Error ? err.message : 'error' })
      }
    })
  }

  function remove() {
    startDelete(async () => {
      try {
        await deleteGhostConnectionAction(projectId)
        setName(''); setApiUrl(''); setApiKey(''); setEditing(true)
        setMessage(t('deleted'))
      } catch (err) {
        setError(err instanceof Error ? err.message : t('save_error'))
      }
    })
  }

  function sync() {
    setSyncMessage(null)
    startSync(async () => {
      try {
        const result = await syncGhostArticlesAction(projectId)
        setSyncMessage({ ok: true, text: tp('sync_done', { count: result.imported }) })
        router.refresh()
      } catch (err) {
        setSyncMessage({ ok: false, text: err instanceof Error ? err.message : 'Error' })
      }
    })
  }

  return (
    <section className="space-y-4">
      <h2 className="font-sans font-semibold text-[18px] text-ink tracking-tight">{t('ghost_title')}</h2>

      {initial && !editing ? (
        <div className="rounded-xl bg-white p-5 shadow-sh-1 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[14px] text-ink font-medium">{initial.name}</div>
              <div className="text-[11px] text-ink-4 mt-0.5">
                {initial.last_tested_at ? (
                  <>
                    <LastTestBadge ok={initial.last_test_ok} />{' '}
                    <span className="font-mono">{new Date(initial.last_tested_at).toISOString().slice(0, 16).replace('T', ' ')}</span>
                  </>
                ) : t('never_tested')}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="default" size="sm" onClick={sync} disabled={syncPending}>
                <RefreshCw className={cn('w-3 h-3 mr-1', syncPending && 'animate-spin')} />
                {syncPending ? tp('syncing') : tp('sync_ghost')}
              </Button>
              <Button variant="default" size="sm" onClick={test} disabled={testPending}>
                {testPending ? '...' : t('test_connection')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>{t('replace')}</Button>
              <Button variant="ghost" size="sm" onClick={remove} disabled={deletePending}>
                <Trash2 className="w-3 h-3 mr-1" /> {t('delete')}
              </Button>
            </div>
          </div>
          <StatusLines
            testResult={testResult}
            syncMessage={syncMessage}
            message={message}
            error={error}
            testSuccessLabel={t('test_success')}
            testFailedLabel={t('test_failed')}
          />
        </div>
      ) : (
        <form onSubmit={save} className="rounded-xl bg-white p-5 shadow-sh-1 space-y-4">
          <div className="space-y-1.5">
            <Label>{t('conn_name')}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder={t('conn_name_placeholder')} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('admin_api_url')}</Label>
            <Input
              type="url"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              required
              placeholder="https://your-blog.ghost.io"
            />
            <p className="text-[11px] text-ink-4">{t('admin_api_url_help')}</p>
          </div>
          <div className="space-y-1.5">
            <Label>{t('admin_api_key')}</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              required
              placeholder="12345abcde:67890fghij..."
              autoComplete="off"
            />
            <p className="text-[11px] text-ink-4">{t('admin_api_key_help')}</p>
          </div>
          {error && <p className="text-[12px] text-rust">{error}</p>}
          {message && <p className="text-[12px] text-sage">{message}</p>}
          <div className="flex justify-end gap-2">
            {initial && (
              <Button type="button" variant="ghost" onClick={() => { setEditing(false); setApiUrl(initial.apiUrl ?? ''); setApiKey('') }} disabled={savePending}>
                {t('cancel')}
              </Button>
            )}
            <Button type="submit" variant="primary" disabled={savePending}>
              {savePending ? '...' : t('save')}
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}
