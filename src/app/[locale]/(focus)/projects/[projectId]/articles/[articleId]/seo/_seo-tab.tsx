'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { experimental_useObject as useObject } from '@ai-sdk/react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Sparkles, X } from 'lucide-react'
import { seoSuggestionSchema } from '@/lib/ai/schemas'
import { saveSeoAction } from './actions'

type Seo = {
  meta_title: string
  meta_description: string
  slug: string
  excerpt: string
  canonical_url: string
  focus_keyword: string
  tags: string[]
}

export function SeoTab({
  projectId, articleId, initial,
}: {
  projectId: string
  articleId: string
  initial: Seo
}) {
  const t = useTranslations('articles')
  const [form, setForm] = useState<Seo>(initial)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [pending, startTransition] = useTransition()
  const saveTimer = useRef<NodeJS.Timeout | null>(null)
  const firstRender = useRef(true)

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setStatus('saving')
    saveTimer.current = setTimeout(() => {
      startTransition(async () => {
        try {
          await saveSeoAction(projectId, articleId, {
            meta_title: form.meta_title || null,
            meta_description: form.meta_description || null,
            slug: form.slug || null,
            excerpt: form.excerpt || null,
            canonical_url: form.canonical_url || null,
            focus_keyword: form.focus_keyword || null,
            tags: form.tags,
          })
          setStatus('saved')
          setTimeout(() => setStatus('idle'), 1500)
        } catch (err) {
          console.error(err)
          setStatus('error')
        }
      })
    }, 900)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(form)])

  const { object, submit, isLoading } = useObject({
    api: '/api/ai/meta-suggest',
    schema: seoSuggestionSchema,
  })

  // When AI streams, reflect into the form in real time — each field
  // gets overwritten as soon as Claude emits it. Use React's "adjust state
  // during render" pattern instead of an effect so we don't trigger a second
  // render per chunk and to satisfy react-hooks/set-state-in-effect.
  // Ref: https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [lastAiSnapshot, setLastAiSnapshot] = useState(object)
  if (object && object !== lastAiSnapshot) {
    setLastAiSnapshot(object)
    setForm((f) => ({
      ...f,
      meta_title: object.meta_title ?? f.meta_title,
      meta_description: object.meta_description ?? f.meta_description,
      slug: object.slug ?? f.slug,
      excerpt: object.excerpt ?? f.excerpt,
      focus_keyword: object.focus_keyword ?? f.focus_keyword,
      tags: (object.tags?.filter((x): x is string => typeof x === 'string' && x.length > 0)) ?? f.tags,
    }))
  }

  return (
    <section className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-sans font-semibold text-[18px] text-ink tracking-tight">{t('seo_title')}</h2>
          <p className="text-[12px] text-ink-3">{t('seo_subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          {status !== 'idle' && (
            <span className={cn('text-[11px] uppercase tracking-[0.14em]',
              status === 'error' ? 'text-rust' : status === 'saved' ? 'text-sage' : 'text-ink-4',
            )}>
              {status === 'saving' ? t('saving') : status === 'saved' ? t('saved') : t('save_error')}
            </span>
          )}
          <Button variant="default" onClick={() => submit({ articleId })} disabled={isLoading}>
            <Sparkles className="w-3.5 h-3.5 mr-1" />
            {t('seo_suggest')}
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-[12px] text-ochre-ink">
          <span className="w-2 h-2 rounded-full bg-ochre animate-pulse" />
          {t('generating')}
        </div>
      )}

      <div className="space-y-4">
        <Field label={t('seo_meta_title')} counter={{ current: form.meta_title.length, max: 60 }}>
          <Input
            value={form.meta_title}
            onChange={(e) => setForm({ ...form, meta_title: e.target.value })}
            maxLength={120}
          />
        </Field>

        <Field label={t('seo_meta_description')} counter={{ current: form.meta_description.length, max: 160 }}>
          <textarea
            value={form.meta_description}
            onChange={(e) => setForm({ ...form, meta_description: e.target.value })}
            className="w-full min-h-[120px] py-2 px-3 rounded-lg border border-rule bg-bg text-[14px] text-ink focus:outline-none focus:border-ink-3"
            maxLength={320}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label={t('seo_slug')}>
            <Input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
              placeholder="my-article-title"
            />
          </Field>
          <Field label={t('seo_focus_keyword')}>
            <Input
              value={form.focus_keyword}
              onChange={(e) => setForm({ ...form, focus_keyword: e.target.value })}
            />
          </Field>
        </div>

        <Field label={t('seo_excerpt')} counter={{ current: form.excerpt.length, max: 280 }}>
          <textarea
            value={form.excerpt}
            onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
            className="w-full min-h-[120px] py-2 px-3 rounded-lg border border-rule bg-bg text-[14px] text-ink focus:outline-none focus:border-ink-3"
            maxLength={500}
          />
        </Field>

        <Field label={t('seo_canonical')} help={t('seo_canonical_help')}>
          <Input
            type="url"
            value={form.canonical_url}
            onChange={(e) => setForm({ ...form, canonical_url: e.target.value })}
            placeholder="https://"
          />
        </Field>

        <Field label={t('seo_tags')} help={t('seo_tags_help')}>
          <TagsField value={form.tags} onChange={(tags) => setForm({ ...form, tags })} />
        </Field>
      </div>

      {pending && <p className="text-[11px] text-ink-4 uppercase tracking-[0.14em]">{t('saving')}</p>}
    </section>
  )
}

function Field({
  label, help, counter, children,
}: {
  label: string
  help?: string
  counter?: { current: number; max: number }
  children: React.ReactNode
}) {
  const overshoot = counter && counter.current > counter.max
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {counter && (
          <span className={cn('font-mono text-[10px]', overshoot ? 'text-rust' : 'text-ink-4')}>
            {counter.current} / {counter.max}
          </span>
        )}
      </div>
      {children}
      {help && <p className="text-[11px] text-ink-4">{help}</p>}
    </div>
  )
}

function TagsField({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('')
  function add() {
    const v = draft.trim()
    if (!v) return
    if (value.includes(v)) { setDraft(''); return }
    onChange([...value, v]); setDraft('')
  }
  return (
    <div className="rounded-lg border border-rule bg-bg p-2 flex flex-wrap gap-1.5">
      {value.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1.5 font-mono text-[11px] px-2 py-0.5 rounded-md border border-rule bg-bg-2 text-ink-2">
          {tag}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== tag))} className="text-ink-4 hover:text-ink">
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); add() }
          if (e.key === ',') { e.preventDefault(); add() }
          if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1))
        }}
        onBlur={add}
        placeholder="+"
        className="flex-1 min-w-[100px] bg-transparent outline-none text-[13px] text-ink placeholder:text-ink-4"
      />
    </div>
  )
}
