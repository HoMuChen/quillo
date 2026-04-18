# Quillo Design System Reference

**Source of truth for visuals:** `docs/demo.html`. Always open it in the browser and mirror the look.

Style thesis: **editorial, ink-on-off-white**. Paper texture, hairline rules, italic serif for titles, mono for numerals. Feels like a writer's notebook, not a SaaS dashboard.

---

## Color tokens (CSS variables — use these exact values)

```css
:root {
  /* surfaces */
  --bg:      #faf7f0;  /* page background — soft off-white */
  --bg-2:    #efeadc;  /* nested surface, hover fills */

  /* ink scale */
  --ink:     #12221c;  /* deep midnight green — primary text, dark buttons */
  --ink-2:   #2b3f36;  /* body emphasis */
  --ink-3:   #5a6b62;  /* secondary text */
  --ink-4:   #8a9891;  /* tertiary / placeholder */

  /* structure */
  --rule:    #d9d2bf;  /* hairline borders, dividers */
  --mist:    rgba(18,34,28,0.06);  /* hover wash */

  /* accents */
  --ochre:   #c28c3c;  /* primary highlight / focus / AI sparkle */
  --ochre-2: #a0722c;
  --rust:    #9c4a30;  /* destructive / unpublish / attention */
  --sage:    #6a8466;  /* secondary accent */

  /* pillar group colors (used in tree / graph) */
  --p1: #2b3f36; --p1-tint: #e6ede6;   /* sage-ink */
  --p2: #2d4a66; --p2-tint: #e4eaf0;   /* blue-ink */
  --p3: #6e3a2f; --p3-tint: #efe2dc;   /* rust-ink */

  /* shadows */
  --sh-1: 0 1px 0 rgba(18,34,28,0.05), 0 2px 8px rgba(18,34,28,0.04);
  --sh-2: 0 2px 0 rgba(18,34,28,0.06), 0 8px 24px rgba(18,34,28,0.08);
  --sh-focus: 0 0 0 2px var(--bg), 0 0 0 3.5px var(--ochre);
}
```

### Tailwind mapping

Extend `tailwind.config` so classes like `bg-bg`, `text-ink-3`, `border-rule`, `ring-ochre` work:

```ts
// tailwind.config (in globals.css @theme inline or via config)
theme: {
  extend: {
    colors: {
      bg: '#faf7f0', 'bg-2': '#efeadc',
      ink: '#12221c', 'ink-2': '#2b3f36', 'ink-3': '#5a6b62', 'ink-4': '#8a9891',
      rule: '#d9d2bf',
      ochre: { DEFAULT: '#c28c3c', 2: '#a0722c' },
      rust: '#9c4a30',
      sage: '#6a8466',
      p1: { DEFAULT: '#2b3f36', tint: '#e6ede6' },
      p2: { DEFAULT: '#2d4a66', tint: '#e4eaf0' },
      p3: { DEFAULT: '#6e3a2f', tint: '#efe2dc' },
    },
    boxShadow: {
      'sh-1': '0 1px 0 rgba(18,34,28,0.05), 0 2px 8px rgba(18,34,28,0.04)',
      'sh-2': '0 2px 0 rgba(18,34,28,0.06), 0 8px 24px rgba(18,34,28,0.08)',
    },
    fontFamily: {
      serif: ['Instrument Serif', 'Noto Serif TC', 'Georgia', 'serif'],
      sans: ['Geist', 'Noto Sans TC', 'system-ui', 'sans-serif'],
      mono: ['Geist Mono', 'JetBrains Mono', 'ui-monospace', 'monospace'],
    },
  }
}
```

---

## Typography

### Fonts — load via `next/font/google`

```ts
// src/app/[locale]/layout.tsx
import { Instrument_Serif, Geist, Geist_Mono, Noto_Serif_TC, Noto_Sans_TC } from 'next/font/google'

const serif = Instrument_Serif({ subsets: ['latin'], weight: ['400'], style: ['normal','italic'], variable: '--font-serif' })
const sans  = Geist({ subsets: ['latin'], weight: ['300','400','500','600','700'], variable: '--font-sans' })
const mono  = Geist_Mono({ subsets: ['latin'], weight: ['400','500','600'], variable: '--font-mono' })
const notoSerif = Noto_Serif_TC({ subsets: ['latin'], weight: ['400','500','700'], variable: '--font-serif-tc' })
const notoSans  = Noto_Sans_TC({ subsets: ['latin'], weight: ['300','400','500','600','700'], variable: '--font-sans-tc' })
```

Apply `${sans.variable} ${serif.variable} ${mono.variable} ${notoSans.variable} ${notoSerif.variable}` to `<html>`.

### Usage

| Context | Class / style |
|---|---|
| Brand lockup "Quillo" | `font-serif italic text-[30px] tracking-tight leading-none` |
| Page H1 / article title | `font-serif italic text-[32px] font-normal leading-tight tracking-tight` |
| Section H2/H3 | `font-serif italic text-[22px] font-normal` |
| Body | `font-sans text-[14px] leading-[1.5] text-ink` |
| Section labels ("PILLARS", "STATS") | `text-[10px] uppercase tracking-[0.14em] text-ink-4` |
| Numerals / counts / keyboard hints | `font-mono text-[11px] text-ink-3` |
| Metadata (keyword, word count) | `font-mono text-[10px] tracking-[0.04em] text-ink-3` |

### Traditional Chinese mix

When locale is `zh-TW`, Chinese characters naturally cascade to `Noto Serif TC` / `Noto Sans TC`. Don't override.

---

## Layout primitives

### Paper grain overlay — add to root `<body>` (or body-level layer):

```css
body::before {
  content: "";
  position: fixed; inset: 0; pointer-events: none; z-index: 1;
  background-image:
    radial-gradient(rgba(18,34,28,0.035) 1px, transparent 1.2px),
    radial-gradient(rgba(18,34,28,0.025) 1px, transparent 1.2px);
  background-size: 3px 3px, 7px 7px;
  background-position: 0 0, 1px 2px;
  mix-blend-mode: multiply;
}
```

### App shell — three columns

```
┌─────────────────────────────────────────────────────────┐
│ HEADER 60px  — brand + breadcrumb + tools               │
├──────────┬───────────────────────────────┬──────────────┤
│ LEFT     │ MAIN                          │ RIGHT        │
│ 260px    │                               │ 340px        │
│ projects │ (content graph / articles /   │ detail panel │
│ pillars  │  editor / brand / settings)   │ (collapsible)│
│          │                               │              │
├──────────┴───────────────────────────────┴──────────────┤
│ FOOTER 48px — progress + status                         │
└─────────────────────────────────────────────────────────┘
```

The right panel collapses via `.no-panel` class (transforms off-canvas).

On pages where the right detail panel doesn't apply (projects list, settings), let main span columns 2-3.

### Borders + radius

- All cards / inputs / buttons: `border border-rule`
- Radius: `rounded-lg` (8px) default, `rounded-xl` (10px) for prominent panels, `rounded-full` for chips / pills
- Hairlines: `border-t border-rule` — never heavier than 1px

### Shadows

- `shadow-sh-1` (resting): cards, buttons, filter bars
- `shadow-sh-2` (elevated): modals, popovers, tooltips
- Focus ring: `focus:ring-2 focus:ring-ochre focus:ring-offset-2 focus:ring-offset-bg`

---

## Button system

```tsx
// Pattern — use cva
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 font-medium leading-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        default:  'bg-bg text-ink border border-rule hover:border-ink-3 hover:bg-[#f5efdf]',
        primary:  'bg-ink text-bg border border-ink hover:bg-ink-2 hover:border-ink-2',
        ochre:    'bg-ochre text-white border border-ochre-2 hover:bg-ochre-2',
        ghost:    'bg-transparent hover:bg-mist text-ink border-0',
        destructive: 'bg-rust text-white border border-rust hover:opacity-90',
      },
      size: {
        default: 'h-10 px-4 rounded-lg text-[13px]',
        sm:      'h-8  px-2.5 rounded-md text-[12px]',
        lg:      'h-11 px-5 rounded-lg text-[14px]',
        icon:    'h-8 w-8 rounded-md',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
)
```

**Keyboard hint chips** inside buttons: `<span className="font-mono text-[10px] opacity-60 ml-1">⌘K</span>`.

---

## Input / textarea / select

```tsx
className="h-10 w-full rounded-lg border border-rule bg-bg px-3 text-[14px] text-ink
           placeholder:text-ink-4
           focus:outline-none focus:ring-2 focus:ring-ochre focus:ring-offset-2 focus:ring-offset-bg"
```

Textarea: same pattern, remove `h-10`, add `min-h-[96px] py-2`.

---

## Status chips

Used on publish badges, article status, etc.:

```tsx
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                 text-[11px] font-medium uppercase tracking-wide
                 border border-rule bg-bg text-ink-2">
  <span className="w-1.5 h-1.5 rounded-full bg-ink-3" />
  Draft
</span>
```

Variants (apply to both chip + dot):
- **default / empty**: `bg-bg text-ink-2 border-rule` + dot `bg-ink-3`
- **draft**: dot `bg-ochre`
- **published**: `bg-ink text-bg border-ink` + dot `bg-ochre`
- **error / unpublish**: `text-rust border-rust`

---

## Section label pattern

```tsx
<div className="flex items-center justify-between mt-5 mb-2">
  <span className="text-[10px] uppercase tracking-[0.14em] text-ink-4">
    Pillars
  </span>
  <button className="w-5 h-5 rounded-full text-[14px] text-ink-3 hover:bg-mist hover:text-ink">
    +
  </button>
</div>
```

---

## AI-accent note card

For anything "AI-generated" or "suggested":

```tsx
<div className="rounded-xl border border-rule p-4 font-serif italic text-[15px] leading-[1.4] text-ink-2
                bg-[linear-gradient(180deg,#f7f0d8_0%,#f1e7c6_100%)] relative">
  <span className="absolute top-2.5 right-3 text-ochre">✦</span>
  <div className="font-sans not-italic text-[10px] font-medium tracking-[0.14em] uppercase text-ochre-2 mb-1.5">
    AI Suggestion
  </div>
  <p>{text}</p>
</div>
```

---

## Data visualization (Pillar tree / graph)

- Pillars get 1 of 3 colors (`p1 / p2 / p3`) assigned by position (cycle).
- Pillar node: filled circle with `radial-gradient(circle at 30% 25%, white-mix, pillar-color 75%)`, italic serif title.
- Cluster node: outlined circle tinted with pillar color, serif-italic keyword.
- Sub-cluster node: smaller, sans label.
- Published: solid fill in pillar color.
- Draft: tint fill, solid outline.
- Empty: dashed outline, "+" character inside.

See demo.html lines 291-445 for full node CSS — port verbatim when building the tree/graph.

Edges: thin (1.25px), colored by pillar, opacity 0.55. Dashed for weak links.

---

## Animation

- `inkBloom` — new nodes / cards entry: opacity fade + scale 0.4→1 over 550ms `cubic-bezier(.2,.8,.3,1)`.
- `drawStroke` — edges draw over 700ms ease-out.
- Hover on button: 150ms `ease`.
- Panel collapse: 300ms `cubic-bezier(.2,.8,.3,1)`.

Keep motion subtle — it's an editorial tool, not a marketing site.

---

## Do / Don't

**DO**
- Italic serif for titles and AI-generated content.
- Monospace for numbers, keyword tags, progress counts.
- Hairline borders + soft shadows, not heavy elevation.
- Leave breathing room — default padding 20-28px on panels.
- Keep chrome quiet, let content (article titles, body) lead.

**DON'T**
- Use pure `#000` or `#fff`. Always ink for text, bg for surfaces.
- Use gradients aggressively outside of AI-note and pillar nodes.
- Use emojis for status. Use the chip system.
- Add colored shadows.
- Center-align body text (left-align except in empty states).

---

## When unsure

Open `docs/demo.html` in a browser. The visual in that file is the spec. If a component isn't shown in the demo, extrapolate using the token system above.
