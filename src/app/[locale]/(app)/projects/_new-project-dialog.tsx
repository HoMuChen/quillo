'use client'

import { useEffect, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createProjectAction } from './actions'

export function NewProjectDialog({ locale }: { locale: 'zh-TW' | 'en' }) {
  const t = useTranslations('projects')
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      try {
        await createProjectAction(locale, formData)
      } catch (err) {
        console.error(err)
        setError(t('error_generic'))
      }
    })
  }

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !pending) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, pending])

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>{t('new_button')}</Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-ink/40 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) setOpen(false)
          }}
        >
          <form
            action={handleSubmit}
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-sh-2 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-serif italic text-[22px] text-ink">{t('create')}</h2>

            <div className="space-y-1.5">
              <Label htmlFor="name">{t('form_name')}</Label>
              <Input id="name" name="name" required placeholder={t('form_name_placeholder')} autoFocus />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="domain">{t('form_domain')}</Label>
              <Input id="domain" name="domain" type="text" placeholder={t('form_domain_placeholder')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="audience">{t('form_audience')}</Label>
              <Input id="audience" name="audience" placeholder={t('form_audience_placeholder')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="theme">{t('form_theme')}</Label>
              <Input id="theme" name="theme" placeholder={t('form_theme_placeholder')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="content_locale">{t('form_locale')}</Label>
              <select
                id="content_locale"
                name="content_locale"
                defaultValue="zh-TW"
                className="h-10 w-full rounded-lg border border-rule bg-bg px-3 text-[14px] text-ink focus:outline-none focus:border-ink-3 focus:ring-2 focus:ring-ochre focus:ring-offset-2 focus:ring-offset-bg"
              >
                <option value="zh-TW">繁體中文</option>
                <option value="en">English</option>
              </select>
            </div>

            {error && <p className="text-[12px] text-rust" role="alert">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                {t('cancel')}
              </Button>
              <Button type="submit" variant="primary" disabled={pending}>
                {pending ? '...' : t('submit')}
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
