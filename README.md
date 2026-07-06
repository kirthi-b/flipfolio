# folder-gallery

> **v0.1.0 · work in progress.** Private while it's built out; not published to npm yet.

A framework-agnostic 3D folder gallery for the web. Items render as physical manila folders you can browse in **stack**, **grid**, or **carousel** mode. No framework, no dependencies, ~self-contained.

> _**[Kirthi writes the real pitch here — her voice.]** The positioning to land (per the plan): "a manila-folder gallery for **real content**, not a decorative folder icon." Everything below the fold is factual scaffolding; the hero + "why I built it" are hers to write before launch._

## Status
This is the extracted **core** — ported from the hand-built portfolio engine, adapted to own its own DOM and tear down cleanly. Still to come before publish: named build (tsup ESM+CJS+types), Web-Component wrapper, docs site + live playground, polished default CSS, tests, and the npm/shadcn-registry release. See `~/Documents/notes/folder-widget-plan.md`.

## Quick start
```html
<link rel="stylesheet" href="folder-gallery/src/folder-gallery.css">
<div id="gallery"></div>
<script type="module">
  import { createFolderGallery } from 'folder-gallery';

  const gallery = createFolderGallery(document.getElementById('gallery'), {
    items: [
      { label: 'One Corner',   color: '#2a3a3a', src: '/img/one.jpg' },
      { label: 'Banglatown',   color: '#3d2e42', content: '<p>Any HTML or a DOM node.</p>' },
      { label: 'Diversity',    color: '#2a2d3e', src: '/img/three.jpg' },
    ],
    mode: 'stack',
    onSelect: (item, i) => console.log('selected', item.label, i),
  });

  // gallery.next() / .prev() / .goTo(2) / .setMode('carousel') / .destroy()
</script>
```

## API
`createFolderGallery(rootElement, options) → handle`

**Options**

| option | type | default | notes |
|---|---|---|---|
| `items` | `Item[]` | `[]` | `{ label?, color?, src?, content?, ...data }` |
| `mode` | `'stack'\|'grid'\|'carousel'` | `'stack'` | 3 modes (a 4th "shelf" is planned) |
| `contentRenderer` | `(card, item, i) => void` | built-in | fills the folder interior — this is how you hold arbitrary content |
| `onSelect` | `(item, i) => void` | — | fired on click/Enter of the active folder (no built-in navigation) |
| `folderPath` | `string` | manila default | SVG path `d` (viewBox `0 0 480 342`) |
| `loop` | `boolean` | `true` | wrap-around |
| `scrollNav` | `boolean` | `true` | wheel/trackpad cycles the stack/carousel |
| `reducedMotion` | `'auto'\|'off'\|'force'` | `'auto'` | drops the 3D tilt when reduced |
| `defaultActiveIndex` | `number` | `0` | |
| `label` | `string` | `'Folder gallery'` | `aria-label` for the listbox |

**Handle**: `next()`, `prev()`, `goTo(i)`, `setMode(m)`, `getActiveIndex()`, `getMode()`, `destroy()`.

**Events** (CustomEvent on the root, bubbling): `fg-select`, `fg-activechange`, `fg-modechange` — each with `event.detail`.

## Content
Each item's interior comes from `item.src` (an image), `item.content` (an HTML string or a DOM node), or a consumer `contentRenderer(card, item, index)` for anything richer. This is the difference from decorative "folder" widgets — it holds real, arbitrary content.

## Accessibility
`role="listbox"`/`option`, roving tabindex, arrow-key + Home/End navigation, `aria-live` position announcements, `:focus-visible` rings, and a `prefers-reduced-motion` fallback that drops the 3D tilt.

## Theming
Override the CSS custom properties on `.fg-root` — `--fg-folder-bg`, `--fg-radius`, `--fg-perspective`, `--fg-transition`, `--fg-front`, `--fg-front-active`, `--fg-active-blur`, `--fg-label`, `--fg-dot`, `--fg-dot-active`.

## License
MIT © Kirthi Balakrishnan
