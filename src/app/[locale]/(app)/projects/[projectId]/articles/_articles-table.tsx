'use client'

import { useMemo, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { ArticleStatusChip } from '@/components/ui/chip'
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ARTICLE_STATUSES, type ArticleStatus } from '@/lib/article'
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

type Status = ArticleStatus

const PAGE_SIZE = 20

export function ArticlesTable({
  projectId, articles, pillars, gscMetrics,
}: {
  projectId: string
  articles: Row[]
  pillars: Pillar[]
  gscMetrics?: Record<string, { clicks: number; position: number }>
}) {
  const t = useTranslations('articles')
  const [pillarFilter, setPillarFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all')
  const [sort, setSort] = useState<'updated' | 'status' | 'clicks' | 'position'>('updated')
  const [page, setPage] = useState(1)

  const visible = useMemo(() => {
    const filtered = articles.filter((a) => {
      if (pillarFilter !== 'all' && a.pillar_id !== pillarFilter) return false
      if (statusFilter !== 'all' && a.status !== statusFilter) return false
      return true
    })
    if (sort === 'status') {
      return filtered.sort((a, b) => {
        const ai = ARTICLE_STATUSES.indexOf(a.status as Status)
        const bi = ARTICLE_STATUSES.indexOf(b.status as Status)
        return bi - ai
      })
    }
    if (sort === 'clicks') {
      return filtered.sort((a, b) => {
        const ac = gscMetrics?.[a.id]?.clicks ?? -1
        const bc = gscMetrics?.[b.id]?.clicks ?? -1
        return bc - ac
      })
    }
    if (sort === 'position') {
      // lower position = better rank; articles without data go to the end
      return filtered.sort((a, b) => {
        const ap = gscMetrics?.[a.id]?.position ?? Infinity
        const bp = gscMetrics?.[b.id]?.position ?? Infinity
        return ap - bp
      })
    }
    return filtered.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  }, [articles, pillarFilter, statusFilter, sort, gscMetrics])

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageRows = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function changeFilter(setter: (v: string) => void) {
    return (v: string) => { setter(v); setPage(1) }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          label={t('filter_pillar')}
          value={pillarFilter}
          onChange={changeFilter(setPillarFilter)}
          options={[{ value: 'all', label: t('filter_all') }, ...pillars.map((p) => ({ value: p.id, label: p.title }))]}
        />
        <FilterSelect
          label={t('filter_status')}
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v as Status | 'all'); setPage(1) }}
          options={[
            { value: 'all', label: t('filter_all') },
            ...ARTICLE_STATUSES.map((s) => ({ value: s, label: s })),
          ]}
        />
        <FilterSelect
          label={t('sort')}
          value={sort}
          onChange={(v) => setSort(v as 'updated' | 'status' | 'clicks' | 'position')}
          options={[
            { value: 'updated', label: t('sort_updated') },
            { value: 'status', label: t('sort_status') },
          ]}
        />
        <span className="ml-auto text-[11px] font-mono text-ink-4">
          {visible.length} / {articles.length}
        </span>
      </div>

      <div className="rounded-xl overflow-hidden bg-white shadow-sh-1">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-ink-4 border-b border-rule">
              <th className="px-4 py-2 font-medium">{t('col_title')}</th>
              <th className="px-4 py-2 font-medium">{t('col_pillar')}</th>
              <th className="px-4 py-2 font-medium">{t('col_status')}</th>
              <th className="px-4 py-2 font-medium">{t('col_updated')}</th>
              <th className="px-4 py-2 font-medium text-right">
                <button
                  type="button"
                  onClick={() => setSort(sort === 'clicks' ? 'updated' : 'clicks')}
                  className="inline-flex items-center gap-1 cursor-pointer hover:text-ink-2 transition-colors"
                  title={t('col_clicks_28d')}
                >
                  {t('col_clicks_28d')} {sort === 'clicks' ? '↓' : ''}
                </button>
              </th>
              <th className="px-4 py-2 font-medium text-right">
                <button
                  type="button"
                  onClick={() => setSort(sort === 'position' ? 'updated' : 'position')}
                  className="inline-flex items-center gap-1 cursor-pointer hover:text-ink-2 transition-colors"
                  title={t('col_position_28d')}
                >
                  {t('col_position_28d')} {sort === 'position' ? '↑' : ''}
                </button>
              </th>
              <th className="px-2 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((a) => (
              <ArticleRow key={a.id} projectId={projectId} row={a} gscMetrics={gscMetrics} />
            ))}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-4 border-t border-rule px-4 py-2.5">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center gap-1 text-[12px] text-ink-3 hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Prev
            </button>

            <div className="flex items-center gap-1">
              {pageNumbers(currentPage, totalPages).map((n, i) =>
                n === '…' ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-[12px] text-ink-4">…</span>
                ) : (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n as number)}
                    className={cn(
                      'w-7 h-7 rounded-md text-[12px] font-mono transition-colors cursor-pointer',
                      n === currentPage
                        ? 'bg-ink text-bg font-medium'
                        : 'text-ink-3 hover:bg-mist hover:text-ink',
                    )}
                  >
                    {n}
                  </button>
                )
              )}
            </div>

            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex items-center gap-1 text-[12px] text-ink-3 hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function pageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '…')[] = [1]
  if (current > 3) pages.push('…')
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i)
  if (current < total - 2) pages.push('…')
  pages.push(total)
  return pages
}

function ArticleRow({ projectId, row, gscMetrics }: { projectId: string; row: Row; gscMetrics?: Record<string, { clicks: number; position: number }> }) {
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
          className="block hover:text-ochre-ink"
        >
          <div className="text-ink font-medium truncate max-w-[360px]">{row.title}</div>
          {row.target_keyword && (
            <div className="font-mono text-[10px] text-ink-3 truncate max-w-[360px]">{row.target_keyword}</div>
          )}
        </Link>
      </td>
      <td className="px-4 py-2.5 text-ink-2 text-[12px]">{row.pillar_title ?? '—'}</td>
      <td className="px-4 py-2.5">
        <ArticleStatusChip status={row.status} />
      </td>
      <td className="px-4 py-2.5 font-mono text-[11px] text-ink-3 whitespace-nowrap">
        {new Date(row.updated_at).toISOString().slice(0, 10)}
      </td>
      <td className="px-4 py-2.5 font-mono text-[11px] text-ink-3 text-right whitespace-nowrap">
        {gscMetrics?.[row.id]?.clicks != null
          ? gscMetrics[row.id].clicks > 999
            ? `${(gscMetrics[row.id].clicks / 1000).toFixed(1)}k`
            : String(gscMetrics[row.id].clicks)
          : '—'}
      </td>
      <td className="px-4 py-2.5 font-mono text-[11px] text-ink-3 text-right whitespace-nowrap">
        {gscMetrics?.[row.id]?.position != null && gscMetrics[row.id].position > 0
          ? gscMetrics[row.id].position.toFixed(1)
          : '—'}
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
            className="p-1.5 rounded-md text-ink-4 hover:text-rust hover:bg-bg-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </td>
    </tr>
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
    <label className="inline-flex items-center gap-1.5 rounded-lg border border-rule bg-white px-2 py-1 cursor-pointer">
      <span className="text-[10px] uppercase tracking-[0.14em] text-ink-4">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-[12px] text-ink-2 focus:outline-none cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </label>
  )
}
