'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react'
import {
  updatePillar,
  deletePillar,
  addPillar,
  updateArticle,
  deleteArticle,
  addArticle,
} from './planning-actions'

type Pillar = {
  id: string
  title: string
  description: string | null
  target_keyword: string | null
  search_intent: string | null
  position: number
}

type Article = {
  id: string
  title: string
  target_keyword: string | null
  lsi_keywords: string[]
  search_intent: string | null
  word_count_target: number | null
  role: string | null
  status: string
  position: number
  pillar_id: string | null
}

const PILLAR_COLORS = ['p1', 'p2', 'p3'] as const
const bgMap = {
  p1: 'bg-p1-tint border-p1',
  p2: 'bg-p2-tint border-p2',
  p3: 'bg-p3-tint border-p3',
}
const textMap = { p1: 'text-p1', p2: 'text-p2', p3: 'text-p3' }

export function PlanningTree({
  projectId,
  pillars,
  articles,
}: {
  projectId: string
  pillars: Pillar[]
  articles: Article[]
}) {
  const t = useTranslations('planning')
  const [addingPillar, setAddingPillar] = useState(false)

  const byPillar = new Map<string, Article[]>()
  for (const a of articles) {
    const key = a.pillar_id ?? ''
    if (!byPillar.has(key)) byPillar.set(key, [])
    byPillar.get(key)!.push(a)
  }

  return (
    <div className="space-y-4">
      {pillars.map((pillar, i) => {
        const color = PILLAR_COLORS[i % PILLAR_COLORS.length]
        return (
          <PillarCard
            key={pillar.id}
            projectId={projectId}
            pillar={pillar}
            articles={byPillar.get(pillar.id) ?? []}
            color={color}
          />
        )
      })}

      {addingPillar ? (
        <PillarEditForm
          projectId={projectId}
          onDone={() => setAddingPillar(false)}
          onCancel={() => setAddingPillar(false)}
        />
      ) : (
        <button
          type="button"
          className="w-full rounded-xl border border-dashed border-rule py-4 text-[13px] text-ink-3 hover:bg-mist hover:text-ink transition-colors"
          onClick={() => setAddingPillar(true)}
        >
          {t('add_pillar')}
        </button>
      )}
    </div>
  )
}

function PillarCard({
  projectId,
  pillar,
  articles,
  color,
}: {
  projectId: string
  pillar: Pillar
  articles: Article[]
  color: (typeof PILLAR_COLORS)[number]
}) {
  const t = useTranslations('planning')
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [addingArticle, setAddingArticle] = useState(false)
  const [pending, startTransition] = useTransition()

  function onDelete() {
    startTransition(async () => {
      try {
        await deletePillar(projectId, pillar.id)
      } catch (err) {
        console.error(err)
      } finally {
        setConfirming(false)
      }
    })
  }

  return (
    <article className={`rounded-xl border ${bgMap[color]} p-5 shadow-sh-1 group`}>
      {editing ? (
        <PillarEditForm
          projectId={projectId}
          pillar={pillar}
          onDone={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <header className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h2 className={`font-serif italic text-[24px] leading-tight ${textMap[color]}`}>
              {pillar.title}
            </h2>
            <div className="flex items-center gap-3 mt-1">
              {pillar.target_keyword && (
                <p className="font-mono text-[11px] text-ink-3 truncate">{pillar.target_keyword}</p>
              )}
              {pillar.search_intent && (
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-3">
                  {pillar.search_intent}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              title={t('edit')}
              className="p-1.5 rounded-md hover:bg-mist text-ink-3 hover:text-ink transition-colors"
              onClick={() => setEditing(true)}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              title={t('delete')}
              className="p-1.5 rounded-md hover:bg-mist text-ink-3 hover:text-rust transition-colors"
              onClick={() => setConfirming(true)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>
      )}

      {!editing && pillar.description && (
        <p className="text-[13px] text-ink-2 leading-[1.55] mb-3">{pillar.description}</p>
      )}

      {confirming && (
        <div className="rounded-md border border-rust bg-bg p-3 mb-3 flex items-center justify-between">
          <p className="text-[12px] text-rust">{t('confirm_delete_pillar')}</p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              {t('cancel')}
            </Button>
            <Button variant="destructive" size="sm" onClick={onDelete} disabled={pending}>
              {pending ? '...' : t('delete')}
            </Button>
          </div>
        </div>
      )}

      {articles.length > 0 && (
        <ul className="border-t border-rule/60 divide-y divide-rule/60">
          {articles.map((a) => (
            <ArticleRow key={a.id} projectId={projectId} article={a} />
          ))}
        </ul>
      )}

      <div className="pt-3 mt-1">
        {addingArticle ? (
          <ArticleEditForm
            projectId={projectId}
            pillarId={pillar.id}
            onDone={() => setAddingArticle(false)}
            onCancel={() => setAddingArticle(false)}
          />
        ) : (
          <button
            type="button"
            className="text-[12px] text-ink-3 hover:text-ink inline-flex items-center gap-1 transition-colors"
            onClick={() => setAddingArticle(true)}
          >
            <Plus className="w-3 h-3" /> {t('add_article')}
          </button>
        )}
      </div>
    </article>
  )
}

function ArticleRow({ projectId, article }: { projectId: string; article: Article }) {
  const t = useTranslations('planning')
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  function onDelete() {
    startTransition(async () => {
      try {
        await deleteArticle(projectId, article.id)
      } catch (err) {
        console.error(err)
      } finally {
        setConfirming(false)
      }
    })
  }

  if (editing) {
    return (
      <li className="py-3">
        <ArticleEditForm
          projectId={projectId}
          pillarId={article.pillar_id!}
          article={article}
          onDone={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      </li>
    )
  }

  return (
    <li className="py-2 -mx-2 px-2 rounded-md group hover:bg-mist transition-colors">
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/projects/${projectId}/articles/${article.id}`}
          className="min-w-0 flex-1"
        >
          <div className="text-[13px] text-ink font-medium truncate">{article.title}</div>
          {article.target_keyword && (
            <div className="font-mono text-[10px] text-ink-3 truncate">{article.target_keyword}</div>
          )}
        </Link>
        <div className="flex items-center gap-2 whitespace-nowrap">
          {article.role && (
            <span
              className={cn(
                'font-mono text-[9px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded border',
                article.role === 'hub'
                  ? 'bg-ink text-bg border-ink'
                  : 'bg-bg border-rule text-ink-3',
              )}
            >
              {article.role}
            </span>
          )}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              title={t('edit')}
              className="p-1 rounded hover:bg-bg-2 text-ink-3 hover:text-ink transition-colors"
              onClick={() => setEditing(true)}
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              type="button"
              title={t('delete')}
              className="p-1 rounded hover:bg-bg-2 text-ink-3 hover:text-rust transition-colors"
              onClick={() => setConfirming(true)}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
      {confirming && (
        <div className="mt-2 rounded-md border border-rust bg-bg p-2 flex items-center justify-between gap-2">
          <p className="text-[11px] text-rust">{t('confirm_delete_article')}</p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              {t('cancel')}
            </Button>
            <Button variant="destructive" size="sm" onClick={onDelete} disabled={pending}>
              {pending ? '...' : t('delete')}
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}

function PillarEditForm({
  projectId,
  pillar,
  onDone,
  onCancel,
}: {
  projectId: string
  pillar?: Pillar
  onDone: () => void
  onCancel: () => void
}) {
  const t = useTranslations('planning')
  const [title, setTitle] = useState(pillar?.title ?? '')
  const [description, setDescription] = useState(pillar?.description ?? '')
  const [keyword, setKeyword] = useState(pillar?.target_keyword ?? '')
  const [intent, setIntent] = useState(pillar?.search_intent ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setError(null)
    const payload = {
      title: title.trim(),
      description: description || null,
      target_keyword: keyword || null,
      search_intent: (intent || null) as
        | 'informational'
        | 'commercial'
        | 'transactional'
        | null,
    }
    startTransition(async () => {
      try {
        if (pillar) await updatePillar(projectId, pillar.id, payload)
        else await addPillar(projectId, payload)
        onDone()
      } catch (err) {
        console.error(err)
        setError(t('error_generic'))
      }
    })
  }

  return (
    <form onSubmit={submit} className="rounded-md border border-rule bg-bg p-3 space-y-3">
      <div className="space-y-1.5">
        <Label>{t('form_pillar_title')}</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label>{t('form_pillar_description')}</Label>
        <textarea
          value={description ?? ''}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full min-h-[60px] py-2 px-3 rounded-lg border border-rule bg-bg text-[14px] text-ink"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>{t('form_target_keyword')}</Label>
          <Input value={keyword ?? ''} onChange={(e) => setKeyword(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>{t('form_search_intent')}</Label>
          <select
            value={intent ?? ''}
            onChange={(e) => setIntent(e.target.value)}
            className="h-10 w-full rounded-lg border border-rule bg-bg px-3 text-[14px] text-ink"
          >
            <option value="">—</option>
            <option value="informational">informational</option>
            <option value="commercial">commercial</option>
            <option value="transactional">transactional</option>
          </select>
        </div>
      </div>
      {error && <p className="text-[12px] text-rust">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={pending}
        >
          <X className="w-3 h-3 mr-1" /> {t('cancel')}
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={pending || !title.trim()}>
          <Check className="w-3 h-3 mr-1" /> {pending ? '...' : t('save')}
        </Button>
      </div>
    </form>
  )
}

function ArticleEditForm({
  projectId,
  pillarId,
  article,
  onDone,
  onCancel,
}: {
  projectId: string
  pillarId: string
  article?: Article
  onDone: () => void
  onCancel: () => void
}) {
  const t = useTranslations('planning')
  const [title, setTitle] = useState(article?.title ?? '')
  const [keyword, setKeyword] = useState(article?.target_keyword ?? '')
  const [lsi, setLsi] = useState((article?.lsi_keywords ?? []).join(', '))
  const [intent, setIntent] = useState(article?.search_intent ?? '')
  const [role, setRole] = useState(article?.role ?? 'supporting')
  const [wc, setWc] = useState(article?.word_count_target?.toString() ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setError(null)
    const payload = {
      title: title.trim(),
      target_keyword: keyword || null,
      lsi_keywords: lsi
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 3),
      search_intent: (intent || null) as
        | 'informational'
        | 'commercial'
        | 'transactional'
        | null,
      role: (role || null) as 'hub' | 'supporting' | 'comparison' | null,
      word_count_target: wc ? parseInt(wc, 10) : null,
    }
    startTransition(async () => {
      try {
        if (article) await updateArticle(projectId, article.id, payload)
        else await addArticle(projectId, pillarId, payload)
        onDone()
      } catch (err) {
        console.error(err)
        setError(t('error_generic'))
      }
    })
  }

  return (
    <form onSubmit={submit} className="rounded-md border border-rule bg-bg p-3 space-y-3">
      <div className="space-y-1.5">
        <Label>{t('form_article_title')}</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>{t('form_target_keyword')}</Label>
          <Input value={keyword ?? ''} onChange={(e) => setKeyword(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>{t('form_lsi_keywords')}</Label>
          <Input value={lsi} onChange={(e) => setLsi(e.target.value)} placeholder="a, b, c" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>{t('form_search_intent')}</Label>
          <select
            value={intent ?? ''}
            onChange={(e) => setIntent(e.target.value)}
            className="h-10 w-full rounded-lg border border-rule bg-bg px-3 text-[14px] text-ink"
          >
            <option value="">—</option>
            <option value="informational">informational</option>
            <option value="commercial">commercial</option>
            <option value="transactional">transactional</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>{t('form_role')}</Label>
          <select
            value={role ?? ''}
            onChange={(e) => setRole(e.target.value)}
            className="h-10 w-full rounded-lg border border-rule bg-bg px-3 text-[14px] text-ink"
          >
            <option value="hub">hub</option>
            <option value="supporting">supporting</option>
            <option value="comparison">comparison</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>{t('form_word_count')}</Label>
          <Input type="number" value={wc} onChange={(e) => setWc(e.target.value)} />
        </div>
      </div>
      {error && <p className="text-[12px] text-rust">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={pending}
        >
          <X className="w-3 h-3 mr-1" /> {t('cancel')}
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={pending || !title.trim()}>
          <Check className="w-3 h-3 mr-1" /> {pending ? '...' : t('save')}
        </Button>
      </div>
    </form>
  )
}
