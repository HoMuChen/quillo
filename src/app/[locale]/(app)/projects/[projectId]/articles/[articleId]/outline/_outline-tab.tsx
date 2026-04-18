'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { experimental_useObject as useObject } from '@ai-sdk/react'
import { useTranslations } from 'next-intl'
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2, GripVertical, Plus, Sparkles } from 'lucide-react'
import { outlineSchema } from '@/lib/ai/schemas'
import { saveOutlineAction } from './actions'

type Section = {
  id: string
  title: string
  purpose: string
  needs_interview: boolean
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `s-${Math.random().toString(36).slice(2, 6)}`
}

export function OutlineTab({
  projectId,
  articleId,
  initialSections,
  initialStatus,
}: {
  projectId: string
  articleId: string
  initialSections: Section[]
  initialStatus: string
}) {
  const t = useTranslations('articles')
  const [sections, setSections] = useState<Section[]>(initialSections)
  const [pending, startTransition] = useTransition()
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const firstRender = useRef(true)

  const { object, submit, isLoading, error: streamError } = useObject({
    api: '/api/ai/outline',
    schema: outlineSchema,
  })

  // When stream finishes, adopt its output
  useEffect(() => {
    if (!isLoading && object?.sections && object.sections.length > 0) {
      const normalized: Section[] = object.sections
        .filter((s): s is NonNullable<typeof s> => !!s && !!s.id && !!s.title)
        .map((s) => ({
          id: s.id!,
          title: s.title!,
          purpose: s.purpose ?? '',
          needs_interview: s.needs_interview ?? false,
        }))
      if (normalized.length > 0) setSections(normalized)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading])

  // Autosave with 900ms debounce on any change after first render
  const saveTimer = useRef<NodeJS.Timeout | null>(null)
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    if (sections.length === 0) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveStatus('saving')
    saveTimer.current = setTimeout(() => {
      startTransition(async () => {
        try {
          await saveOutlineAction(projectId, articleId, sections)
          setSaveStatus('saved')
          setTimeout(() => setSaveStatus('idle'), 1500)
        } catch (err) {
          console.error(err)
          setSaveStatus('error')
        }
      })
    }, 900)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(sections)])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = sections.findIndex((s) => s.id === active.id)
    const newIndex = sections.findIndex((s) => s.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    setSections(arrayMove(sections, oldIndex, newIndex))
  }

  function addSection() {
    const s: Section = {
      id: slugify(`new-${sections.length + 1}`),
      title: '',
      purpose: '',
      needs_interview: false,
    }
    setSections([...sections, s])
  }

  function updateSection(id: string, patch: Partial<Section>) {
    setSections(sections.map((s) => s.id === id ? { ...s, ...patch } : s))
  }

  function deleteSection(id: string) {
    setSections(sections.filter((s) => s.id !== id))
  }

  const canGenerate = !isLoading && !['outlining', 'drafting'].includes(initialStatus)

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif italic text-[22px] text-ink">{t('outline_title')}</h2>
          <p className="text-[12px] text-ink-3">{t('outline_subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {saveStatus !== 'idle' && (
            <span className={`text-[11px] uppercase tracking-[0.14em] ${
              saveStatus === 'error' ? 'text-rust' :
              saveStatus === 'saved' ? 'text-sage' : 'text-ink-4'
            }`}>
              {saveStatus === 'saving' ? t('saving') : saveStatus === 'saved' ? t('saved') : t('save_error')}
            </span>
          )}
          <Button
            variant={sections.length === 0 ? 'primary' : 'default'}
            onClick={() => submit({ articleId })}
            disabled={!canGenerate}
          >
            <Sparkles className="w-3.5 h-3.5 mr-1" />
            {sections.length === 0 ? t('outline_generate') : t('outline_regenerate')}
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-[12px] text-ochre-2">
          <span className="w-2 h-2 rounded-full bg-ochre animate-pulse" />
          {t('generating')}
        </div>
      )}

      {streamError && <p className="text-[12px] text-rust" role="alert">{t('error_generic')}</p>}

      {sections.length === 0 && !isLoading && (
        <div className="rounded-xl border border-rule border-dashed p-10 text-center text-ink-3">
          <p className="text-[13px]">{t('outline_empty')}</p>
        </div>
      )}

      {sections.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <ol className="space-y-2">
              {sections.map((section, i) => (
                <SortableRow
                  key={section.id}
                  index={i + 1}
                  section={section}
                  onChange={(patch) => updateSection(section.id, patch)}
                  onDelete={() => deleteSection(section.id)}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}

      <button
        type="button"
        onClick={addSection}
        className="w-full rounded-lg border border-dashed border-rule py-3 text-[12px] text-ink-3 hover:bg-mist hover:text-ink transition-colors inline-flex items-center justify-center gap-1.5"
      >
        <Plus className="w-3 h-3" /> {t('outline_add')}
      </button>

      {pending && (
        <p className="text-[11px] text-ink-4 uppercase tracking-[0.14em]">{t('saving')}</p>
      )}
    </section>
  )
}

function SortableRow({
  section,
  index,
  onChange,
  onDelete,
}: {
  section: Section
  index: number
  onChange: (patch: Partial<Section>) => void
  onDelete: () => void
}) {
  const t = useTranslations('articles')
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-rule bg-bg p-3 shadow-sh-1"
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="p-1 text-ink-4 hover:text-ink cursor-grab active:cursor-grabbing"
          aria-label="drag"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        <span className="font-mono text-[11px] text-ink-4 pt-2.5 min-w-[20px]">{index}</span>

        <div className="flex-1 space-y-2 min-w-0">
          <Input
            value={section.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder={t('outline_title_placeholder')}
          />
          <Input
            value={section.purpose}
            onChange={(e) => onChange({ purpose: e.target.value })}
            placeholder={t('outline_purpose_placeholder')}
          />
          <label className="inline-flex items-center gap-2 text-[12px] text-ink-2 cursor-pointer">
            <input
              type="checkbox"
              checked={section.needs_interview}
              onChange={(e) => onChange({ needs_interview: e.target.checked })}
              className="accent-ochre"
            />
            {t('outline_needs_interview')}
          </label>
        </div>

        <button
          type="button"
          onClick={onDelete}
          className="p-1.5 text-ink-4 hover:text-rust transition-colors"
          aria-label={t('delete')}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </li>
  )
}
