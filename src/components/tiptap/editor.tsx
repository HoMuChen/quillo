'use client'

import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { Markdown } from 'tiptap-markdown'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Bold, Italic, Heading2, Heading3, List, ListOrdered, Quote, Code, Link2, Minus,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type SaveFn = (tiptapDoc: unknown, markdown: string) => Promise<void>

export function TiptapEditor({
  initialTiptap,
  initialMarkdown,
  onSave,
  placeholder,
}: {
  initialTiptap: unknown | null
  initialMarkdown: string | null
  onSave: SaveFn
  placeholder?: string
}) {
  const t = useTranslations('articles')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const saveTimer = useRef<NodeJS.Timeout | null>(null)
  const firstUpdate = useRef(true)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Image.configure({ inline: false, allowBase64: false }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener', target: '_blank' } }),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
      CharacterCount,
      Markdown.configure({
        html: false,
        tightLists: true,
        breaks: true,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: initialTiptap ?? '',
    editorProps: {
      attributes: {
        class:
          'prose max-w-none focus:outline-none text-[15px] leading-[1.8] text-ink ' +
          '[&_h2]:font-serif [&_h2]:italic [&_h2]:text-[28px] [&_h2]:text-ink [&_h2]:mt-8 [&_h2]:mb-3 ' +
          '[&_h3]:font-serif [&_h3]:italic [&_h3]:text-[22px] [&_h3]:text-ink [&_h3]:mt-6 [&_h3]:mb-2 ' +
          '[&_p]:my-3 [&_a]:text-ochre-2 [&_a]:underline [&_a]:decoration-rule ' +
          '[&_code]:font-mono [&_code]:text-[13px] [&_code]:bg-bg-2 [&_code]:px-1 [&_code]:rounded ' +
          '[&_pre]:bg-bg-2 [&_pre]:border [&_pre]:border-rule [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:my-4 ' +
          '[&_blockquote]:border-l-2 [&_blockquote]:border-ochre [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-ink-2 ' +
          '[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 ' +
          '[&_img]:rounded-lg [&_img]:border [&_img]:border-rule [&_img]:my-4',
      },
    },
  })

  // If no tiptap JSON but we have markdown, seed the editor from markdown on mount.
  useEffect(() => {
    if (!editor) return
    if (initialTiptap) return
    if (initialMarkdown) {
      editor.commands.setContent(initialMarkdown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  // Autosave on update
  const schedule = useCallback(() => {
    if (!editor) return
    if (firstUpdate.current) {
      firstUpdate.current = false
      return
    }
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setStatus('saving')
    saveTimer.current = setTimeout(async () => {
      try {
        const tiptapDoc = editor.getJSON()
        const md = ((editor.storage as unknown as Record<string, { getMarkdown(): string }>).markdown).getMarkdown()
        await onSave(tiptapDoc, md)
        setStatus('saved')
        setTimeout(() => setStatus('idle'), 1500)
      } catch (err) {
        console.error(err)
        setStatus('error')
      }
    }, 1000)
  }, [editor, onSave])

  useEffect(() => {
    if (!editor) return
    editor.on('update', schedule)
    return () => { editor.off('update', schedule) }
  }, [editor, schedule])

  if (!editor) return null

  return (
    <div className="space-y-3">
      <Toolbar editor={editor} />
      <div className="rounded-xl border border-rule bg-bg p-6 min-h-[400px] shadow-sh-1">
        <EditorContent editor={editor} />
      </div>
      <StatusLine status={status} t={t} wordCount={editor.storage.characterCount?.words?.() ?? 0} />
    </div>
  )
}

function Toolbar({ editor }: { editor: Editor }) {
  const t = useTranslations('articles')
  const btn = (active: boolean, extra = '') =>
    cn(
      'h-8 w-8 inline-flex items-center justify-center rounded-md transition-colors',
      active ? 'bg-ink text-bg' : 'text-ink-3 hover:bg-mist hover:text-ink',
      extra,
    )

  function toggleLink() {
    const previous = editor.getAttributes('link').href as string | undefined
    const url = window.prompt(t('editor_link_prompt'), previous ?? 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  return (
    <div className="flex items-center gap-0.5 flex-wrap rounded-lg border border-rule bg-bg p-1.5 shadow-sh-1">
      <button type="button" title="Bold" className={btn(editor.isActive('bold'))}
        onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="w-4 h-4" />
      </button>
      <button type="button" title="Italic" className={btn(editor.isActive('italic'))}
        onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="w-4 h-4" />
      </button>
      <span className="w-px h-5 bg-rule mx-1" />
      <button type="button" title="H2" className={btn(editor.isActive('heading', { level: 2 }))}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="w-4 h-4" />
      </button>
      <button type="button" title="H3" className={btn(editor.isActive('heading', { level: 3 }))}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <Heading3 className="w-4 h-4" />
      </button>
      <span className="w-px h-5 bg-rule mx-1" />
      <button type="button" title="Bullet list" className={btn(editor.isActive('bulletList'))}
        onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="w-4 h-4" />
      </button>
      <button type="button" title="Numbered list" className={btn(editor.isActive('orderedList'))}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="w-4 h-4" />
      </button>
      <button type="button" title="Quote" className={btn(editor.isActive('blockquote'))}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote className="w-4 h-4" />
      </button>
      <button type="button" title="Code" className={btn(editor.isActive('code'))}
        onClick={() => editor.chain().focus().toggleCode().run()}>
        <Code className="w-4 h-4" />
      </button>
      <span className="w-px h-5 bg-rule mx-1" />
      <button type="button" title="Link" className={btn(editor.isActive('link'))}
        onClick={toggleLink}>
        <Link2 className="w-4 h-4" />
      </button>
      <button type="button" title="Divider" className={btn(false)}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <Minus className="w-4 h-4" />
      </button>
    </div>
  )
}

function StatusLine({
  status,
  wordCount,
  t,
}: {
  status: 'idle' | 'saving' | 'saved' | 'error'
  wordCount: number
  t: (k: 'saving' | 'saved' | 'save_error') => string
}) {
  return (
    <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.14em]">
      <span className={cn(
        status === 'error' ? 'text-rust' :
        status === 'saved' ? 'text-sage' :
        'text-ink-4',
      )}>
        {status === 'saving' ? t('saving') :
         status === 'saved' ? t('saved') :
         status === 'error' ? t('save_error') : ''}
      </span>
      <span className="font-mono text-ink-4">{wordCount} words</span>
    </div>
  )
}
