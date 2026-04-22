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
  saveShopifyConnectionAction,
  testShopifyConnectionAction,
  deleteShopifyConnectionAction,
  fetchShopifyBlogsAction,
} from './settings-actions'
import { syncShopifyArticlesAction } from '../planning/planning-actions'
import { LastTestBadge, StatusLines } from './_connection-ui'

type Blog = { id: number; title: string }

type Initial = {
  id: string
  name: string
  storeUrl: string | null
  blogTitle: string | null
  last_tested_at: string | null
  last_test_ok: boolean | null
} | null

export function ShopifyConnectionForm({
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
  const [storeUrl, setStoreUrl] = useState(initial?.storeUrl ?? '')
  const [accessToken, setAccessToken] = useState('')
  const [blogs, setBlogs] = useState<Blog[]>([])
  const [selectedBlogId, setSelectedBlogId] = useState<number | null>(null)
  const [selectedBlogTitle, setSelectedBlogTitle] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [testResult, setTestResult] = useState<{ ok: boolean; error: string | null } | null>(null)
  const [editing, setEditing] = useState(!initial)
  const [savePending, startSave] = useTransition()
  const [testPending, startTest] = useTransition()
  const [deletePending, startDelete] = useTransition()
  const [syncPending, startSync] = useTransition()
  const [blogsPending, startBlogsLoad] = useTransition()

  function loadBlogs() {
    setError(null)
    startBlogsLoad(async () => {
      try {
        const result = await fetchShopifyBlogsAction(storeUrl, accessToken)
        setBlogs(result)
        if (result.length > 0) {
          setSelectedBlogId(result[0].id)
          setSelectedBlogTitle(result[0].title)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load blogs')
      }
    })
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedBlogId) { setError('Please select a blog first'); return }
    setError(null); setMessage(null)
    startSave(async () => {
      try {
        await saveShopifyConnectionAction(projectId, {
          name,
          storeUrl,
          accessToken,
          blogId: selectedBlogId,
          blogTitle: selectedBlogTitle,
        })
        setMessage(t('saved'))
        setEditing(false)
        setAccessToken('')
      } catch (err) {
        setError(err instanceof Error ? err.message : t('save_error'))
      }
    })
  }

  function test() {
    setTestResult(null)
    startTest(async () => {
      try {
        const result = await testShopifyConnectionAction(projectId)
        setTestResult(result)
      } catch (err) {
        setTestResult({ ok: false, error: err instanceof Error ? err.message : 'error' })
      }
    })
  }

  function remove() {
    startDelete(async () => {
      try {
        await deleteShopifyConnectionAction(projectId)
        setName(''); setStoreUrl(''); setAccessToken('')
        setBlogs([]); setSelectedBlogId(null); setEditing(true)
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
        const result = await syncShopifyArticlesAction(projectId)
        setSyncMessage({ ok: true, text: tp('sync_shopify_done', { count: result.imported }) })
        router.refresh()
      } catch (err) {
        setSyncMessage({ ok: false, text: err instanceof Error ? err.message : 'Error' })
      }
    })
  }

  return (
    <section className="space-y-4">
      <h2 className="font-sans font-semibold text-[18px] text-ink tracking-tight">{t('shopify_title')}</h2>

      {initial && !editing ? (
        <div className="rounded-xl bg-white p-5 shadow-sh-1 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[14px] text-ink font-medium">{initial.name}</div>
              <div className="text-[11px] text-ink-4 mt-0.5">
                {initial.blogTitle && <span className="mr-2">{initial.blogTitle}</span>}
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
                {syncPending ? tp('syncing') : tp('sync_shopify')}
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
            <Label>{t('store_url')}</Label>
            <Input
              value={storeUrl}
              onChange={(e) => setStoreUrl(e.target.value)}
              required
              placeholder="my-store.myshopify.com"
            />
            <p className="text-[11px] text-ink-4">{t('store_url_help')}</p>
          </div>
          <div className="space-y-1.5">
            <Label>{t('access_token')}</Label>
            <Input
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              required
              placeholder="shpat_..."
              autoComplete="off"
            />
            <p className="text-[11px] text-ink-4">{t('access_token_help')}</p>
          </div>

          <div className="space-y-1.5">
            <Label>{t('default_blog')}</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={loadBlogs}
                disabled={!storeUrl || !accessToken || blogsPending}
              >
                {blogsPending ? '...' : t('fetch_blogs')}
              </Button>
              {blogs.length > 0 && (
                <select
                  className="flex-1 rounded-lg border border-rule bg-white px-3 py-2 text-[14px] text-ink focus:outline-none focus:border-ink-3"
                  value={selectedBlogId ?? ''}
                  onChange={(e) => {
                    const id = Number(e.target.value)
                    setSelectedBlogId(id)
                    setSelectedBlogTitle(blogs.find((b) => b.id === id)?.title ?? '')
                  }}
                >
                  {blogs.map((b) => (
                    <option key={b.id} value={b.id}>{b.title}</option>
                  ))}
                </select>
              )}
            </div>
            <p className="text-[11px] text-ink-4">{t('default_blog_help')}</p>
          </div>

          {error && <p className="text-[12px] text-rust">{error}</p>}
          {message && <p className="text-[12px] text-sage">{message}</p>}
          <div className="flex justify-end gap-2">
            {initial && (
              <Button type="button" variant="ghost" onClick={() => { setEditing(false); setAccessToken(''); setBlogs([]) }} disabled={savePending}>
                {t('cancel')}
              </Button>
            )}
            <Button type="submit" variant="primary" disabled={savePending || !selectedBlogId}>
              {savePending ? '...' : t('save')}
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}
