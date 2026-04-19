'use client'

import { useEffect, useState, useRef, useTransition } from 'react'
import { experimental_useObject as useObject } from '@ai-sdk/react'
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Sparkles, SkipForward } from 'lucide-react'
import { planAndQuestionsSchema } from '@/lib/ai/schemas'
import {
  answerQuestionAction, skipQuestionAction, skipAllAction,
} from './actions'

type Section = { id: string; title: string; purpose: string; needs_interview: boolean }

type Question = {
  id: string
  section_id: string
  question: string
  answer: string | null
  status: 'pending' | 'answered' | 'skipped'
  position: number
}

export function InterviewTab({
  projectId,
  articleId,
  status,
  sections,
  questions: initialQuestions,
}: {
  projectId: string
  articleId: string
  status: string
  sections: Section[]
  questions: Question[]
}) {
  const t = useTranslations('articles')
  const router = useRouter()
  const [questions, setQuestions] = useState<Question[]>(initialQuestions)
  const [pending, startTransition] = useTransition()

  const { object, submit, isLoading, error: streamError } = useObject({
    api: '/api/ai/interview',
    schema: planAndQuestionsSchema,
  })

  // After streaming ends, refresh the server page to pick up the
  // freshly persisted outline + interview_questions rows.
  useEffect(() => {
    if (!isLoading && object?.questions) {
      router.refresh()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading])

  const sectionLabelById = new Map(sections.map((s) => [s.id, s.title]))

  const pendingCount = questions.filter((q) => q.status === 'pending').length
  const hasQuestions = questions.length > 0
  const allNonPending = hasQuestions && pendingCount === 0

  const canGenerate = !isLoading && !['drafting'].includes(status)

  // After streaming completes, detect "no questions needed" outcome.
  // Streamed object is partial; only trust after isLoading becomes false.
  const streamFinishedWithNoQuestions =
    !isLoading &&
    !!object?.sections &&
    object.sections.length > 0 &&
    (!object.questions || object.questions.length === 0)

  const showNoQuestionsCard = !hasQuestions && streamFinishedWithNoQuestions

  return (
    <section className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif italic text-[22px] text-ink">{t('interview_title')}</h2>
          <p className="text-[12px] text-ink-3">{t('interview_subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {hasQuestions && pendingCount > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={() =>
                startTransition(async () => {
                  try {
                    await skipAllAction(projectId, articleId)
                    setQuestions(questions.map((q) => q.status === 'pending' ? { ...q, status: 'skipped' } : q))
                  } catch (err) { console.error(err) }
                })
              }
              disabled={pending}
            >
              <SkipForward className="w-3 h-3 mr-1" />
              {t('skip_all')}
            </Button>
          )}
          <Button
            variant={hasQuestions ? 'default' : 'primary'}
            onClick={() => submit({ articleId })}
            disabled={!canGenerate}
          >
            <Sparkles className="w-3.5 h-3.5 mr-1" />
            {hasQuestions ? t('interview_regenerate') : t('interview_start')}
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

      {!hasQuestions && !isLoading && !showNoQuestionsCard && (
        <div className="rounded-xl border border-rule border-dashed p-10 text-center text-ink-3">
          <p className="text-[13px]">{t('interview_start_desc')}</p>
        </div>
      )}

      {showNoQuestionsCard && (
        <div className="rounded-xl border border-ochre bg-[linear-gradient(180deg,#f7f0d8_0%,#f1e7c6_100%)] p-5 flex items-center justify-between gap-4">
          <div>
            <p className="font-serif italic text-[18px] text-ink">{t('interview_no_questions_title')}</p>
            <p className="text-[12px] text-ink-2 mt-1">{t('interview_no_questions_body')}</p>
          </div>
          <Link href={`/projects/${projectId}/articles/${articleId}/editor`}>
            <Button variant="primary">{t('interview_continue_no_q')}</Button>
          </Link>
        </div>
      )}

      {hasQuestions && (
        <ol className="space-y-3">
          {questions.map((q, i) => (
            <QuestionRow
              key={q.id}
              index={i + 1}
              question={q}
              sectionTitle={sectionLabelById.get(q.section_id) ?? q.section_id}
              projectId={projectId}
              articleId={articleId}
              onLocalUpdate={(patch) =>
                setQuestions(questions.map((x) => x.id === q.id ? { ...x, ...patch } : x))
              }
            />
          ))}
        </ol>
      )}

      {allNonPending && (
        <div className="rounded-xl border border-ochre bg-[linear-gradient(180deg,#f7f0d8_0%,#f1e7c6_100%)] p-5 flex items-center justify-between">
          <p className="text-[13px] text-ink-2">{t('interview_ready')}</p>
          <Link href={`/projects/${projectId}/articles/${articleId}/editor`}>
            <Button variant="primary">{t('interview_to_draft')}</Button>
          </Link>
        </div>
      )}
    </section>
  )
}

function QuestionRow({
  index,
  question,
  sectionTitle,
  projectId,
  articleId,
  onLocalUpdate,
}: {
  index: number
  question: Question
  sectionTitle: string
  projectId: string
  articleId: string
  onLocalUpdate: (patch: Partial<Question>) => void
}) {
  const t = useTranslations('articles')
  const [local, setLocal] = useState(question.answer ?? '')
  const timer = useRef<NodeJS.Timeout | null>(null)
  const [pending, startTransition] = useTransition()

  // Debounced autosave on blur OR after 500ms idle
  function scheduleSave() {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => commit(), 500)
  }

  function commit() {
    if (local === (question.answer ?? '')) return
    startTransition(async () => {
      try {
        await answerQuestionAction(projectId, articleId, question.id, local)
        onLocalUpdate({
          answer: local.trim() || null,
          status: local.trim().length > 0 ? 'answered' : 'pending',
        })
      } catch (err) {
        console.error(err)
      }
    })
  }

  function skip() {
    startTransition(async () => {
      try {
        await skipQuestionAction(projectId, articleId, question.id)
        setLocal('')
        onLocalUpdate({ answer: null, status: 'skipped' })
      } catch (err) {
        console.error(err)
      }
    })
  }

  return (
    <li
      className={cn(
        'rounded-lg border bg-bg p-4 shadow-sh-1 space-y-2',
        question.status === 'skipped' ? 'border-rule opacity-60' :
        question.status === 'answered' ? 'border-sage' : 'border-rule',
      )}
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[11px] text-ink-4">{index}</span>
          <span className="text-[10px] uppercase tracking-[0.14em] text-ink-4">
            {sectionTitle}
          </span>
        </div>
        <StatusBadge status={question.status} />
      </header>
      <p className="font-serif italic text-[18px] text-ink leading-[1.4]">{question.question}</p>

      {question.status !== 'skipped' && (
        <textarea
          value={local}
          onChange={(e) => { setLocal(e.target.value); scheduleSave() }}
          onBlur={commit}
          placeholder={t('interview_answer_placeholder')}
          className="w-full min-h-[80px] py-2 px-3 rounded-lg border border-rule bg-bg text-[14px] text-ink"
        />
      )}

      <div className="flex items-center justify-between">
        <div className="text-[11px] text-ink-4">{pending ? t('saving') : ''}</div>
        {question.status !== 'skipped' && (
          <Button variant="ghost" size="sm" onClick={skip} disabled={pending}>
            <SkipForward className="w-3 h-3 mr-1" />
            {t('skip')}
          </Button>
        )}
      </div>
    </li>
  )
}

function StatusBadge({ status }: { status: Question['status'] }) {
  const t = useTranslations('articles')
  const map: Record<Question['status'], { label: string; cls: string }> = {
    pending:  { label: t('q_pending'),  cls: 'bg-bg border-rule text-ink-3' },
    answered: { label: t('q_answered'), cls: 'bg-sage/10 border-sage text-sage' },
    skipped:  { label: t('q_skipped'),  cls: 'bg-bg border-rule text-ink-4' },
  }
  const v = map[status]
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] px-1.5 py-0.5 rounded border ${v.cls}`}>
      <span className="w-1 h-1 rounded-full bg-current opacity-60" />
      {v.label}
    </span>
  )
}
