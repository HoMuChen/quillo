'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { saveBrandAction } from './actions'
import { AnalyzeFromArticlesButton } from './_analyze-button'
import type { AnalyzeBrandResult } from '@/lib/ai/schemas'

type Brand = {
  author_background: string | null
  reader_persona: string | null
  tone: string | null
  preferred_terms: string[]
  forbidden_terms: string[]
  ee_at_cases: string | null
}

type ArticleRef = { id: string; title: string; target_keyword: string | null }

function appendText(existing: string | null, addition: string | null | undefined): string | null {
  if (!addition) return existing
  if (!existing) return addition
  return `${existing}\n\n${addition}`
}

function mergeChips(existing: string[], addition: string[] | undefined): string[] {
  if (!addition?.length) return existing
  return [...existing, ...addition.filter((t) => !existing.includes(t))]
}

export function BrandForm({
  projectId,
  initial,
  articlesWithBody = [],
}: {
  projectId: string
  initial: Brand
  articlesWithBody?: ArticleRef[]
}) {
  const t = useTranslations('brand')
  const [form, setForm] = useState<Brand>(initial)
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const timer = useRef<NodeJS.Timeout | null>(null)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) { first.current = false; return }
    if (timer.current) clearTimeout(timer.current)
    setStatus('saving')
    timer.current = setTimeout(() => {
      startTransition(async () => {
        try {
          await saveBrandAction(projectId, form)
          setStatus('saved')
          setTimeout(() => setStatus('idle'), 1500)
        } catch (err) {
          console.error(err)
          setStatus('error')
        }
      })
    }, 900)
    return () => { if (timer.current) clearTimeout(timer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(form)])

  function applyAnalysis(result: AnalyzeBrandResult) {
    setForm((prev) => ({
      ...prev,
      tone: appendText(prev.tone, result.tone),
      author_background: appendText(prev.author_background, result.author_background),
      reader_persona: appendText(prev.reader_persona, result.reader_persona),
      ee_at_cases: appendText(prev.ee_at_cases, result.ee_at_cases),
      preferred_terms: mergeChips(prev.preferred_terms, result.preferred_terms),
      forbidden_terms: mergeChips(prev.forbidden_terms, result.forbidden_terms),
    }))
  }

  return (
    <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
      <div className="flex items-center justify-between h-4">
        <StatusLine status={status} t={t} pending={pending} />
        {articlesWithBody.length > 0 && (
          <AnalyzeFromArticlesButton
            projectId={projectId}
            articles={articlesWithBody}
            onApply={applyAnalysis}
          />
        )}
      </div>

      <Field
        label={t('author_background')}
        textarea
        placeholder={t('author_background_placeholder')}
        value={form.author_background ?? ''}
        onChange={(v) => setForm({ ...form, author_background: v })}
      />
      <Field
        label={t('reader_persona')}
        textarea
        placeholder={t('reader_persona_placeholder')}
        value={form.reader_persona ?? ''}
        onChange={(v) => setForm({ ...form, reader_persona: v })}
      />
      <Field
        label={t('tone')}
        placeholder={t('tone_placeholder')}
        value={form.tone ?? ''}
        onChange={(v) => setForm({ ...form, tone: v })}
      />

      <ChipsField
        label={t('preferred_terms')}
        help={t('preferred_terms_help')}
        value={form.preferred_terms}
        onChange={(v) => setForm({ ...form, preferred_terms: v })}
      />
      <ChipsField
        label={t('forbidden_terms')}
        help={t('forbidden_terms_help')}
        value={form.forbidden_terms}
        onChange={(v) => setForm({ ...form, forbidden_terms: v })}
        variant="rust"
      />

      <Field
        label={t('ee_at_cases')}
        textarea
        placeholder={t('ee_at_cases_placeholder')}
        value={form.ee_at_cases ?? ''}
        onChange={(v) => setForm({ ...form, ee_at_cases: v })}
      />
    </form>
  )
}

function StatusLine({
  status,
  t,
  pending,
}: {
  status: 'idle' | 'saving' | 'saved' | 'error'
  t: (k: 'saving' | 'saved' | 'save_error') => string
  pending: boolean
}) {
  if (status === 'idle' && !pending) return <div />
  const text =
    status === 'saving' || pending ? t('saving') :
    status === 'saved' ? t('saved') :
    status === 'error' ? t('save_error') : ''
  const color =
    status === 'error' ? 'text-rust' :
    status === 'saved' ? 'text-sage' : 'text-ink-4'
  return <div className={cn('h-4 text-[11px] uppercase tracking-[0.14em]', color)}>{text}</div>
}

function Field({
  label, textarea, placeholder, value, onChange,
}: {
  label: string
  textarea?: boolean
  placeholder?: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {textarea ? (
        <textarea
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-h-[92px] py-2 px-3 rounded-lg border border-rule bg-white text-[14px] text-ink placeholder:text-ink-4 focus:outline-none focus:border-ink-3 focus:ring-2 focus:ring-ochre focus:ring-offset-2 focus:ring-offset-bg"
        />
      ) : (
        <Input placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  )
}

function ChipsField({
  label, help, value, onChange, variant = 'default',
}: {
  label: string
  help?: string
  value: string[]
  onChange: (v: string[]) => void
  variant?: 'default' | 'rust'
}) {
  const [draft, setDraft] = useState('')
  function add() {
    const v = draft.trim()
    if (!v) return
    if (value.includes(v)) { setDraft(''); return }
    onChange([...value, v])
    setDraft('')
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="rounded-lg border border-rule bg-white p-2 flex flex-wrap gap-1.5">
        {value.map((term) => (
          <span
            key={term}
            className={cn(
              'inline-flex items-center gap-1.5 font-mono text-[11px] px-2 py-0.5 rounded-md border',
              variant === 'rust'
                ? 'bg-bg-2 border-rule text-rust'
                : 'bg-bg-2 border-rule text-ink-2',
            )}
          >
            {term}
            <button
              type="button"
              onClick={() => onChange(value.filter((x) => x !== term))}
              className="text-ink-4 hover:text-ink transition-colors cursor-pointer"
              aria-label={`remove ${term}`}
            >
              ×
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
          className="flex-1 min-w-[140px] bg-transparent outline-none text-[13px] text-ink placeholder:text-ink-4"
        />
      </div>
      {help && <p className="text-[11px] text-ink-4">{help}</p>}
    </div>
  )
}
