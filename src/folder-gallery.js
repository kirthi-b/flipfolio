/* ============================================================================
 * folder-gallery - a framework-agnostic 3D folder gallery (core, v0.1.0, WIP)
 *
 *   import { createFolderGallery } from 'folder-gallery';
 *   import 'folder-gallery/styles.css';
 *
 *   const gallery = createFolderGallery(rootEl, {
 *     items: [{ label, color, src }, ...],   // or { content: Node | html }
 *     mode: 'stack',                          // 'stack' | 'grid' | 'carousel'
 *     onSelect: (item, index) => { ... },
 *   });
 *   gallery.next(); gallery.setMode('grid'); gallery.destroy();
 *
 * Ported from a hand-built portfolio engine. No framework, no dependencies.
 * Owns its own DOM and removes every listener on destroy().
 * ========================================================================== */

const SVG_NS = 'http://www.w3.org/2000/svg';

/* Default manila-folder-with-tab silhouette (viewBox 0 0 480 342). */
const DEFAULT_FOLDER_PATH =
  'M 0 22 C 0 10 10 0 22 0 L 155 0 C 168 0 172 6 176 14 C 180 24 188 32 204 32 ' +
  'L 458 32 C 470 32 480 42 480 54 L 480 320 C 480 332 470 342 458 342 ' +
  'L 22 342 C 10 342 0 332 0 320 Z';

const DEFAULTS = {
  mode: 'stack',           // 'stack' | 'grid' | 'carousel'
  folderPath: DEFAULT_FOLDER_PATH,
  loop: true,
  scrollNav: true,
  reducedMotion: 'auto',   // 'auto' | 'off' | 'force'
  peek: 'hover',           // 'hover' | 'always' | 'off'
  defaultActiveIndex: 0,
  label: 'Folder gallery',
};

const PEEK_MODES = new Set(['hover', 'always', 'off']);
let instanceCount = 0; // unique SVG clip ids across instances

const MODE_WIDTHS = { stack: 480, grid: 720, carousel: 720 };
const SCROLL_THRESHOLD = 30;
const SCROLL_COOLDOWN = { stack: 450, carousel: 300 };

function hexToRgb(hex) {
  const h = String(hex).replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
/* Derive the folder's three surfaces from one base color (same offsets as the
 * original engine): back/tab −30, frosted front +40 at 0.55, solid front +35.
 * The solid variant is what keeps NON-active cards fully opaque - only the
 * active card gets the translucent frosted treatment. */
function folderColors(hex) {
  const [r, g, b] = hexToRgb(hex);
  const dn = (v) => Math.max(v - 30, 0);
  const up = (v, o) => Math.min(v + o, 255);
  return {
    back: `rgb(${dn(r)},${dn(g)},${dn(b)})`,
    front: `rgba(${up(r, 40)},${up(g, 40)},${up(b, 40)},0.55)`,
    frontSolid: `rgb(${up(r, 35)},${up(g, 35)},${up(b, 35)})`,
  };
}

/* Built-in default content renderer. Accepts item.content (a Node or HTML
 * string) or item.src (an image). Consumers pass their own contentRenderer
 * (card, item, index) to hold arbitrary content - that's the whole point. */
function defaultContentRenderer(card, item /* , index */) {
  const wrap = document.createElement('div');
  wrap.className = 'fg-content';
  // Duck-type DOM nodes (nodeType) rather than `instanceof Node` - `Node`
  // isn't a global in every embedding (SSR shims, minimal DOM harnesses).
  if (item.content && typeof item.content === 'object' && typeof item.content.nodeType === 'number') {
    wrap.appendChild(item.content);
  } else if (typeof item.content === 'string') {
    wrap.innerHTML = item.content;
  } else if (item.src) {
    const img = document.createElement('img');
    img.className = 'fg-image';
    img.src = item.src;
    img.alt = item.label || '';
    img.loading = 'lazy';
    img.decoding = 'async';
    wrap.appendChild(img);
  }
  card.appendChild(wrap);
}

export function createFolderGallery(root, options = {}) {
  if (!root || !root.nodeType) throw new Error('createFolderGallery: a root element is required');

  const opts = { ...DEFAULTS, ...options };
  const items = Array.isArray(opts.items) ? opts.items : [];
  const n = items.length;
  const renderContent =
    typeof opts.contentRenderer === 'function' ? opts.contentRenderer : defaultContentRenderer;

  const reduced =
    opts.reducedMotion === 'force' ||
    (opts.reducedMotion !== 'off' &&
      typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches);

  let mode = MODE_WIDTHS[opts.mode] ? opts.mode : 'stack';
  let active = Math.min(Math.max(opts.defaultActiveIndex | 0, 0), Math.max(n - 1, 0));
  let scrollCooldown = false;
  let scrollAccum = 0;

  /* ── Listener bookkeeping for destroy() ── */
  const cleanups = [];
  const on = (el, ev, fn, o) => { el.addEventListener(ev, fn, o); cleanups.push(() => el.removeEventListener(ev, fn, o)); };
  const emit = (name, detail) => root.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));

  /* ── Build own DOM (no page scaffold assumed) ── */
  const uid = 'fg' + (++instanceCount);
  root.classList.add('fg-root');
  root.setAttribute('data-fg-mode', mode);
  root.setAttribute('data-fg-peek', PEEK_MODES.has(opts.peek) ? opts.peek : 'hover');
  const scene = document.createElement('div');
  scene.className = 'fg-scene';
  scene.setAttribute('role', 'listbox');
  scene.setAttribute('aria-label', opts.label);
  scene.setAttribute('aria-roledescription', 'folder gallery');
  const dotsEl = document.createElement('div');
  dotsEl.className = 'fg-dots';
  dotsEl.setAttribute('role', 'tablist');
  const live = document.createElement('div');
  live.className = 'fg-sr-only';
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('aria-atomic', 'true');
  root.append(scene, dotsEl, live);

  function teardown() {
    cleanups.forEach((fn) => fn());
    cleanups.length = 0;
    root.replaceChildren();
    root.classList.remove('fg-root');
    root.removeAttribute('data-fg-mode');
    root.removeAttribute('data-fg-peek');
  }

  if (n === 0) {
    return { next() {}, prev() {}, goTo() {}, setMode() {}, setPeek() {}, getActiveIndex: () => -1, getMode: () => mode, destroy: teardown };
  }

  /* ── Normalized transform - identical function list for every mode ── */
  function setCardTransform(card, { x, y, z, rx, ry, s, zIndex, opacity, isActive }) {
    card.style.transform = `translate3d(${x}px,${y}px,${z}px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${s})`;
    card.style.transformOrigin = 'center bottom';
    card.style.zIndex = String(zIndex);
    card.style.opacity = String(opacity);
    card.setAttribute('aria-selected', isActive ? 'true' : 'false');
    card.classList.toggle('is-active', isActive);
  }

  /* ── Build cards ── */
  const cardEls = items.map((item, i) => {
    const card = document.createElement('div');
    card.className = 'fg-card';
    card.tabIndex = i === active ? 0 : -1; // roving tabindex
    card.setAttribute('role', 'option');
    card.setAttribute('aria-label', item.label || `Item ${i + 1}`);
    if (item.color) {
      const c = folderColors(item.color);
      card.style.setProperty('--fg-folder-bg', item.color);
      card.style.setProperty('--fg-front', c.front);
      card.style.setProperty('--fg-front-solid', c.frontSolid);
    }

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'fg-folder');
    svg.setAttribute('viewBox', '0 0 480 342');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', opts.folderPath);
    path.setAttribute('fill', item.color ? folderColors(item.color).back : 'var(--fg-folder-bg)');
    svg.appendChild(path);

    /* Decal: skin the whole silhouette (tab included) with an image,
       clipped to the same folder path. The color path stays underneath as
       the fallback while the image loads. */
    if (item.decal) {
      const clipId = `${uid}-clip-${i}`;
      const clip = document.createElementNS(SVG_NS, 'clipPath');
      clip.setAttribute('id', clipId);
      const clipShape = document.createElementNS(SVG_NS, 'path');
      clipShape.setAttribute('d', opts.folderPath);
      clip.appendChild(clipShape);
      svg.appendChild(clip);
      const img = document.createElementNS(SVG_NS, 'image');
      img.setAttribute('href', item.decal);
      img.setAttribute('width', '480');
      img.setAttribute('height', '342');
      img.setAttribute('preserveAspectRatio', 'xMidYMid slice');
      img.setAttribute('clip-path', `url(#${clipId})`);
      svg.appendChild(img);
      card.classList.add('fg-card--decal');
    }
    card.appendChild(svg);

    renderContent(card, item, i);

    const front = document.createElement('div');
    front.className = 'fg-front';
    if (item.label) {
      const label = document.createElement('div');
      label.className = 'fg-label';
      label.textContent = item.label;
      front.appendChild(label);
    }
    card.appendChild(front);

    scene.appendChild(card);
    return card;
  });

  /* ── Dots ── */
  const dots = cardEls.map((_, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'fg-dot';
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', items[i].label || `Go to ${i + 1}`);
    on(dot, 'click', () => goTo(i));
    dotsEl.appendChild(dot);
    return dot;
  });

  /* ── Layouts ── */
  function layoutStack() {
    scene.style.height = '';
    cardEls.forEach((card, i) => {
      const behind = (i - active + n) % n;
      if (behind === 0) {
        setCardTransform(card, { x: 0, y: 100, z: 20, rx: 0, ry: 0, s: 1, zIndex: n + 1, opacity: 1, isActive: true });
        return;
      }
      const safeN = Math.max(n - 1, 1);
      const tz = -behind * 25 - behind * behind * 3;
      const rx = reduced ? 0 : -behind * 3;
      const ty = 100 - behind * 28 - behind * behind * 2;
      const sc = 1 - behind * 0.06 - (behind / safeN) * (behind / safeN) * 0.04;
      setCardTransform(card, { x: 0, y: ty, z: tz, rx, ry: 0, s: Math.max(sc, 0.5), zIndex: n - behind, opacity: 1 - behind * 0.08, isActive: false });
    });
  }
  function layoutGrid() {
    const sceneW = scene.clientWidth || MODE_WIDTHS.grid;
    // Two columns on narrow scenes so folders stay tappable and readable.
    const cols = sceneW < 520 ? 2 : n <= 4 ? 2 : 3;
    const gap = 16;
    const cardW = sceneW;
    const cardH = sceneW * (2 / 3);
    const sc = (sceneW - (cols - 1) * gap) / (cols * cardW);
    const scaledW = cardW * sc;
    const scaledH = cardH * sc;
    const tabScaled = 22 * sc;
    const rows = Math.ceil(n / cols);
    cardEls.forEach((card, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const itemsInRow = Math.min(cols, n - row * cols);
      const rowW = itemsInRow * scaledW + (itemsInRow - 1) * gap;
      const rowStartX = (sceneW - rowW) / 2;
      const cellLeft = rowStartX + col * (scaledW + gap);
      const cellTop = row * (scaledH + tabScaled + gap) + tabScaled;
      const tx = cellLeft + scaledW / 2 - cardW / 2;
      const ty = cellTop + scaledH - cardH;
      setCardTransform(card, { x: tx, y: ty, z: 0, rx: 0, ry: 0, s: sc, zIndex: i === active ? 2 : 1, opacity: 1, isActive: i === active });
    });
    scene.style.height = rows * (scaledH + tabScaled + gap) + 20 + 'px';
  }
  function layoutCarousel() {
    const sceneW = scene.clientWidth || MODE_WIDTHS.carousel;
    const cardW = sceneW;
    const cardH = cardW * (2 / 3);
    const activeSc = 0.62;
    const activeW = cardW * activeSc;
    const sceneH = Math.max(cardH * activeSc + 40, 180);
    scene.style.height = sceneH + 'px';
    const offsetStep = Math.min(130, (sceneW - activeW) / 4);
    cardEls.forEach((card, i) => {
      let offset = i - active;
      if (n > 2 && offset > Math.floor(n / 2)) offset -= n;
      if (n > 2 && offset < -Math.floor(n / 2)) offset += n;
      const sc = Math.max(activeSc - Math.abs(offset) * 0.06, 0.28);
      const z = -Math.abs(offset) * 50;
      const op = Math.max(1 - Math.abs(offset) * 0.25, 0.15);
      const tx = sceneW / 2 + offset * offsetStep - cardW / 2;
      const ty = sceneH - 20 - cardH;
      setCardTransform(card, { x: tx, y: ty, z, rx: 0, ry: 0, s: sc, zIndex: n - Math.abs(offset), opacity: op, isActive: offset === 0 });
    });
  }
  // Scene width tracks the active mode so the layout math (which assumes the
  // mode's logical width) matches the actually-rendered card width. Layouts
  // then read scene.clientWidth, so everything stays self-consistent at any size.
  function sizeScene() {
    scene.style.width = `min(${MODE_WIDTHS[mode]}px, 92vw)`;
  }
  function applyLayout() {
    sizeScene();
    (mode === 'grid' ? layoutGrid : mode === 'carousel' ? layoutCarousel : layoutStack)();
    dots.forEach((d, i) => {
      d.classList.toggle('is-active', i === active);
      d.setAttribute('aria-selected', i === active ? 'true' : 'false');
    });
    cardEls.forEach((c, i) => { c.tabIndex = i === active ? 0 : -1; });
    const cur = items[active];
    live.textContent = cur && cur.label ? `${active + 1} of ${n}: ${cur.label}` : `${active + 1} of ${n}`;
  }

  /* ── Navigation ── */
  function goTo(i) {
    const next = opts.loop ? ((i % n) + n) % n : Math.min(Math.max(i, 0), n - 1);
    if (next === active) return;
    active = next;
    applyLayout();
    emit('fg-activechange', { index: active, item: items[active] });
  }
  function select(i) {
    emit('fg-select', { index: i, item: items[i] });
    if (typeof opts.onSelect === 'function') opts.onSelect(items[i], i);
  }
  function setMode(m) {
    if (m === mode || !MODE_WIDTHS[m]) return;
    mode = m;
    root.setAttribute('data-fg-mode', mode);
    applyLayout();
    emit('fg-modechange', { mode });
  }
  function setPeek(p) {
    if (!PEEK_MODES.has(p)) return;
    root.setAttribute('data-fg-peek', p);
  }

  /* ── Interaction ── */
  cardEls.forEach((card, i) => {
    on(card, 'click', () => { i === active ? select(i) : goTo(i); });
    on(card, 'keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(i); }
    });
  });
  on(scene, 'keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); goTo(active + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); goTo(active - 1); }
    else if (e.key === 'Home') { e.preventDefault(); goTo(0); }
    else if (e.key === 'End') { e.preventDefault(); goTo(n - 1); }
    else return;
    cardEls[active].focus();
  });

  if (opts.scrollNav) {
    on(scene, 'wheel', (e) => {
      if (mode === 'grid') return;
      const atStart = !opts.loop && active === 0 && e.deltaY < 0;
      const atEnd = !opts.loop && active === n - 1 && e.deltaY > 0;
      if (atStart || atEnd) return;
      e.preventDefault();
      if (scrollCooldown) return;
      scrollAccum += e.deltaY;
      if (Math.abs(scrollAccum) >= SCROLL_THRESHOLD) {
        const dir = scrollAccum > 0 ? 1 : -1;
        scrollAccum = 0;
        scrollCooldown = true;
        goTo(active + dir);
        setTimeout(() => { scrollCooldown = false; scrollAccum = 0; }, SCROLL_COOLDOWN[mode] || 300);
      }
    }, { passive: false });
  }

  /* Dominant-axis swipe: up or left advances, down or right goes back.
     Horizontal is the natural phone gesture in carousel; vertical matches
     the wheel direction on the stack. Both work everywhere. */
  let touchStartX = 0;
  let touchStartY = 0;
  on(scene, 'touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  on(scene, 'touchend', (e) => {
    const dx = touchStartX - e.changedTouches[0].clientX;
    const dy = touchStartY - e.changedTouches[0].clientY;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if (Math.max(ax, ay) < 40) return;
    const dir = ax > ay ? (dx > 0 ? 1 : -1) : (dy > 0 ? 1 : -1);
    goTo(active + dir);
  }, { passive: true });

  let resizeTimer;
  on(window, 'resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(applyLayout, 150); });

  applyLayout();

  /* ── Public handle ── */
  return {
    next: () => goTo(active + 1),
    prev: () => goTo(active - 1),
    goTo,
    setMode,
    setPeek,
    getActiveIndex: () => active,
    getMode: () => mode,
    destroy: teardown,
  };
}

export default createFolderGallery;
