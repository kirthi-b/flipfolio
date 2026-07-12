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
  drag: 'fling',           // 'fling' | 'off' - grab the active folder and throw it (stack mode)
  defaultActiveIndex: 0,
  label: 'Folder gallery',
};

const PEEK_MODES = new Set(['hover', 'always', 'off']);
const DRAG_MODES = new Set(['fling', 'off']);

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
 * active card gets the translucent frosted treatment. Also picks a label
 * color (white or ink) by the frontSolid surface's YIQ brightness, so a
 * dark folder color doesn't leave the label unreadable regardless of theme. */
function folderColors(hex) {
  const [r, g, b] = hexToRgb(hex);
  const dn = (v) => Math.max(v - 30, 0);
  const up = (v, o) => Math.min(v + o, 255);
  const fr = up(r, 35);
  const fg = up(g, 35);
  const fb = up(b, 35);
  const yiq = (fr * 299 + fg * 587 + fb * 114) / 1000;
  return {
    back: `rgb(${dn(r)},${dn(g)},${dn(b)})`,
    front: `rgba(${up(r, 40)},${up(g, 40)},${up(b, 40)},0.55)`,
    frontSolid: `rgb(${fr},${fg},${fb})`,
    label: yiq >= 128 ? '#1c1c1a' : '#ffffff',
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
  root.classList.add('fg-root');
  root.setAttribute('data-fg-mode', mode);
  root.setAttribute('data-fg-peek', PEEK_MODES.has(opts.peek) ? opts.peek : 'hover');
  root.setAttribute('data-fg-drag', DRAG_MODES.has(opts.drag) ? opts.drag : 'fling');
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
    root.removeAttribute('data-fg-drag');
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
      card.style.setProperty('--fg-label-on-color', c.label);
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

    card.appendChild(svg);

    renderContent(card, item, i);

    const front = document.createElement('div');
    front.className = 'fg-front';
    /* Decal: the photo prints on the folder's FRONT PANEL. The back and tab
       keep their color, so the folder stays a folder: colored tabs in the
       stack, a real material boundary at the front's lip. */
    if (item.decal) {
      card.classList.add('fg-card--decal');
      const photo = document.createElement('img');
      photo.className = 'fg-decal';
      photo.src = item.decal;
      photo.alt = '';
      photo.loading = 'lazy';
      photo.decoding = 'async';
      front.appendChild(photo);
    }
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
  const dragEnabled = opts.drag !== 'off';
  let suppressClick = false; // a real drag eats the click that follows pointerup

  cardEls.forEach((card, i) => {
    on(card, 'click', () => {
      if (suppressClick) { suppressClick = false; return; }
      i === active ? select(i) : goTo(i);
    });
    on(card, 'keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(i); }
    });
  });
  /* Arrow keys work two ways, matching the reference implementation:
     1. Focus already inside the gallery (Tab to a card/dot) - bubbles here
        and re-focuses the new active card, standard roving-tabindex UX.
     2. Mouse hovering the gallery, focus anywhere else on the page - a
        document-level listener picks it up. Without this route, arrow
        keys only work AFTER a click puts focus on a card - and a click is
        also what fires onSelect, which in real use is often a link. Making
        keyboard nav depend on that first click means the only way to
        "activate" arrows is to risk navigating away. Hover is enough. */
  function handleArrowKeys(e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); goTo(active + 1); return true; }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); goTo(active - 1); return true; }
    if (e.key === 'Home') { e.preventDefault(); goTo(0); return true; }
    if (e.key === 'End') { e.preventDefault(); goTo(n - 1); return true; }
    return false;
  }
  on(scene, 'keydown', (e) => { if (handleArrowKeys(e)) cardEls[active].focus(); });
  on(dotsEl, 'keydown', (e) => { if (handleArrowKeys(e)) cardEls[active].focus(); });

  let hovered = false;
  on(root, 'mouseenter', () => { hovered = true; });
  on(root, 'mouseleave', () => { hovered = false; });
  on(document, 'keydown', (e) => {
    if (!hovered) return;
    // Don't hijack arrows if focus is on an interactive control outside
    // the gallery (nav link, a form field elsewhere on the page).
    const ae = document.activeElement;
    if (ae && ae !== document.body && !root.contains(ae)) return;
    handleArrowKeys(e); // no forced focus - the user hasn't tabbed in
  });

  if (opts.scrollNav) {
    /* Bound to root, not just the scene box: root is the widget's full
       footprint (scene + dots), so wheel events over the dots row or any
       gap the consumer's own layout leaves around the gallery still cycle
       it, instead of requiring the pointer over the exact folder art. */
    on(root, 'wheel', (e) => {
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
    // In stack mode the pointer-based drag below owns the gesture; letting
    // both fire would advance twice per swipe.
    if (dragEnabled && mode === 'stack') return;
    const dx = touchStartX - e.changedTouches[0].clientX;
    const dy = touchStartY - e.changedTouches[0].clientY;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if (Math.max(ax, ay) < 40) return;
    const dir = ax > ay ? (dx > 0 ? 1 : -1) : (dy > 0 ? 1 : -1);
    goTo(active + dir);
  }, { passive: true });

  /* ── Drag: grab the active folder and throw it (stack mode) ──
     Pointer Events give one code path for mouse, touch, and pen. The
     gesture constants come from the folder-deck prototype this feature is
     ported from: rotation follows the drag at 0.04deg/px, a release past
     90px of travel (or a genuine throw, over 0.5px/ms) flings the folder
     off along the dominant axis and advances; anything shorter springs
     back into the pile on the card's own transition. Direction keeps the
     swipe semantics: left or up is next, right or down is previous. */
  if (dragEnabled) {
    const DRAG_ROT = 0.04;
    const FLING_DIST = 90;
    const FLING_VEL = 0.5;
    const TAP_SLOP = 6;
    let dragCard = null;
    let dragBase = '';
    let startPX = 0, startPY = 0, dragDX = 0, dragDY = 0;
    let lastX = 0, lastY = 0, lastT = 0, velX = 0, velY = 0;

    on(scene, 'pointerdown', (e) => {
      if (mode !== 'stack') return;
      if (e.button !== undefined && e.button !== 0) return;
      const card = e.target && e.target.closest ? e.target.closest('.fg-card') : null;
      if (!card || !card.classList.contains('is-active')) return;
      dragCard = card;
      dragBase = card.style.transform;
      startPX = e.clientX; startPY = e.clientY;
      dragDX = 0; dragDY = 0;
      lastX = e.clientX; lastY = e.clientY;
      lastT = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      velX = 0; velY = 0;
      card.classList.add('fg-card--dragging');
      if (card.setPointerCapture && e.pointerId !== undefined) {
        try { card.setPointerCapture(e.pointerId); } catch (_) { /* jsdom / detached */ }
      }
    });
    on(window, 'pointermove', (e) => {
      if (!dragCard) return;
      dragDX = e.clientX - startPX;
      dragDY = e.clientY - startPY;
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      const dt = Math.max(now - lastT, 1);
      velX = (e.clientX - lastX) / dt;
      velY = (e.clientY - lastY) / dt;
      lastX = e.clientX; lastY = e.clientY; lastT = now;
      // translateZ lifts the grabbed folder clear of every plane in the
      // pile (tilted tops can poke past the active card's resting depth)
      // and reads as physically picking it up.
      dragCard.style.transform = `${dragBase} translate3d(${dragDX}px, ${dragDY}px, 40px) rotate(${(dragDX * DRAG_ROT).toFixed(2)}deg)`;
    });
    const endDrag = () => {
      if (!dragCard) return;
      const card = dragCard;
      dragCard = null;
      card.classList.remove('fg-card--dragging');
      const dist = Math.hypot(dragDX, dragDY);
      if (dist < TAP_SLOP) { card.style.transform = dragBase; return; } // a tap: the click handler owns it
      suppressClick = true;
      const horizontal = Math.abs(dragDX) >= Math.abs(dragDY);
      const flung = dist > FLING_DIST || Math.hypot(velX, velY) > FLING_VEL;
      const dir = horizontal ? (dragDX > 0 ? -1 : 1) : (dragDY > 0 ? -1 : 1);
      const target = active + dir;
      const blocked = !opts.loop && (target < 0 || target > n - 1);
      if (!flung || blocked) { card.style.transform = dragBase; return; } // spring back into the pile
      if (reduced) { goTo(target); return; }
      const offX = horizontal ? Math.sign(dragDX) * Math.max(window.innerWidth * 0.7, 480) : dragDX * 3;
      const offY = horizontal ? dragDY * 3 : Math.sign(dragDY) * Math.max(window.innerHeight * 0.7, 480);
      card.style.transform = `${dragBase} translate3d(${offX}px, ${offY}px, 40px) rotate(${Math.sign(dragDX || 1) * 18}deg)`;
      card.style.opacity = '0';
      setTimeout(() => {
        /* The thrown folder joins the back of the pile by TELEPORT, not by
           flying back across the scene: transitioning from off-screen to
           the rear slot would drag it through the other folders' 3D planes
           and slice them visibly on the way. Kill its transition for one
           frame, relayout, flush, restore. */
        card.classList.add('fg-card--snap');
        goTo(target);
        void card.offsetWidth; // commit the snapped position before transitions return
        card.classList.remove('fg-card--snap');
      }, 240);
    };
    on(window, 'pointerup', endDrag);
    on(window, 'pointercancel', endDrag);
  }

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
