'use client'

import { useMemo, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Trash2 } from 'lucide-react'
import { deleteArticleAction } from './articles-actions'

type Row = {
  id: string
  title: string
  target_keyword: string | null
  status: string
  updated_at: string
  pillar_id: string | null
  role: string | null
  pillar_title: string | null
}

type Pillar = { id: string; title: string }

const STATUS_ORDER = ['planned', 'outlining', 'outline_ready', 'interviewing', 'drafting', 'draft_ready', 'editing'] as const
type Status = typeof STATUS_ORDER[number]

export function ArticlesTable({
  projectId, articles, pillars,
}: {
  projectId: string
  articles: Row[]
  pillars: Pillar[]
}) {
  const t = useTranslations('articles')
  const [pillarFilter, setPillarFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all')
  const [sort, setSort] = useState<'updated' | 'status'>('updated')

  const visible = useMemo(() => {
    const filtered = articles.filter((a) => {
      if (pillarFilter !== 'all' && a.pillar_id !== pillarFilter) return false
      if (statusFilter !== 'all' && a.status !== statusFilter) return false
      return true
    })
    if (sort === 'status') {
      return filtered.sort((a, b) => {
        const ai = STATUS_ORDER.indexOf(a.status as Status)
        const bi = STATUS_ORDER.indexOf(b.status as Status)
        return bi - ai // most advanced first
      })
    }
    return filtered.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  }, [articles, pillarFilter, statusFilter, sort])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          label={t('filter_pillar')}
          value={pillarFilter}
          onChange={setPillarFilter}
          options={[{ value: 'all', label: t('filter_all') }, ...pillars.map((p) => ({ value: p.id, label: p.title }))]}
        />
        <FilterSelect
          label={t('filter_status')}
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as Status | 'all')}
          options={[
            { value: 'all', label: t('filter_all') },
            ...STATUS_ORDER.map((s) => ({ value: s, label: s })),
          ]}
        />
        <FilterSelect
          label={t('sort')}
          value={sort}
          onChange={(v) => setSort(v as 'updated' | 'status')}
          options={[
            { value: 'updated', label: t('sort_updated') },
            { value: 'status', label: t('sort_status') },
          ]}
        />
        <span className="ml-auto text-[11px] font-mono text-ink-4">
          {visible.length} / {articles.length}
        </span>
      </div>

      <div className="rounded-xl border border-rule overflow-hidden bg-bg shadow-sh-1">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-ink-4 border-b border-rule">
              <th className="px-4 py-2 font-medium">{t('col_title')}</th>
              <th className="px-4 py-2 font-medium">{t('col_pillar')}</th>
              <th className="px-4 py-2 font-medium">{t('col_status')}</th>
              <th className="px-4 py-2 font-medium">{t('col_updated')}</th>
              <th className="px-2 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((a) => (
              <ArticleRow key={a.id} projectId={projectId} row={a} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ArticleRow({ projectId, row }: { projectId: string; row: Row }) {
  const t = useTranslations('articles')
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  function onDelete() {
    startTransition(async () => {
      try { await deleteArticleAction(projectId, row.id) }
      catch (err) { console.error(err) }
      finally { setConfirming(false) }
    })
  }

  return (
    <tr className="border-b border-rule/60 group hover:bg-mist/40 transition-colors">
      <td className="px-4 py-2.5">
        <Link
          href={`/projects/${projectId}/articles/${row.id}`}
          className="block hover:text-ochre-2"
        >
          <div className="text-ink font-medium truncate max-w-[360px]">{row.title}</div>
          {row.target_keyword && (
            <div className="font-mono text-[10px] text-ink-3 truncate max-w-[360px]">{row.target_keyword}</div>
          )}
        </Link>
      </td>
      <td className="px-4 py-2.5 text-ink-2 text-[12px]">{row.pillar_title ?? '—'}</td>
      <td className="px-4 py-2.5">
        <StatusPill status={row.status} />
      </td>
      <td className="px-4 py-2.5 font-mono text-[11px] text-ink-3 whitespace-nowrap">
        {new Date(row.updated_at).toISOString().slice(0, 10)}
      </td>
      <td className="px-2 py-2.5">
        {confirming ? (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={pending}>{t('cancel')}</Button>
            <Button variant="destructive" size="sm" onClick={onDelete} disabled={pending}>
              {pending ? '...' : t('delete')}
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            title={t('delete')}
            className="p-1.5 rounded-md text-ink-4 hover:text-rust hover:bg-bg-2 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </td>
    </tr>
  )
}

function StatusPill({ status }: { status: string }) {
  const cls: Record<string, string> = {
    planned:       'bg-bg border-rule text-ink-3',
    outlining:     'bg-bg-2 border-rule text-ochre-2',
    outline_ready: 'bg-bg border-ochre text-ochre-2',
    interviewing:  'bg-bg-2 border-rule text-ochre-2',
    drafting:      'bg-bg-2 border-rule text-ochre-2',
    draft_ready:   'bg-bg border-ochre text-ochre-2',
    editing:       'bg-bg border-ink text-ink',
  }
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] px-2 py-0.5 rounded border',
      cls[status] ?? cls.planned,
    )}>
      <span className="w-1 h-1 rounded-full bg-current opacity-60" />
      {status}
    </span>
  )
}

function FilterSelect({
  label, value, onChange, options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label className="inline-flex items-center gap-1.5 rounded-lg border border-rule bg-bg px-2 py-1">
      <span className="text-[10px] uppercase tracking-[0.14em] text-ink-4">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-[12px] text-ink-2 focus:outline-none"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </label>
  )
}
