import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFolderGallery, FOLDER_PATHS } from '../src/folder-gallery.js';

const ITEMS = [
  { label: 'One', color: '#2a3a3a' },
  { label: 'Two', color: '#3d2e42' },
  { label: 'Three', color: '#2a2d3e' },
];

let root;
beforeEach(() => {
  document.body.innerHTML = '';
  root = document.createElement('div');
  document.body.appendChild(root);
});

describe('createFolderGallery - DOM & ARIA', () => {
  it('builds its own DOM: scene, cards, dots, live region', () => {
    createFolderGallery(root, { items: ITEMS });
    expect(root.classList.contains('fg-root')).toBe(true);
    expect(root.querySelectorAll('.fg-card').length).toBe(3);
    expect(root.querySelectorAll('.fg-dot').length).toBe(3);
    expect(root.querySelector('[aria-live="polite"]')).toBeTruthy();
  });

  it('uses listbox/option semantics with roving tabindex', () => {
    createFolderGallery(root, { items: ITEMS });
    const scene = root.querySelector('.fg-scene');
    expect(scene.getAttribute('role')).toBe('listbox');
    const cards = [...root.querySelectorAll('.fg-card')];
    expect(cards.map((c) => c.getAttribute('role'))).toEqual(['option', 'option', 'option']);
    expect(cards.map((c) => c.tabIndex)).toEqual([0, -1, -1]);
    expect(cards[0].getAttribute('aria-selected')).toBe('true');
  });

  it('throws without a root element and tolerates zero items', () => {
    expect(() => createFolderGallery(null, {})).toThrow();
    const h = createFolderGallery(root, { items: [] });
    expect(h.getActiveIndex()).toBe(-1);
    h.destroy();
  });
});

describe('navigation', () => {
  it('next/prev/goTo move the active card and wrap when loop=true', () => {
    const h = createFolderGallery(root, { items: ITEMS, loop: true });
    expect(h.getActiveIndex()).toBe(0);
    h.next();
    expect(h.getActiveIndex()).toBe(1);
    h.goTo(2);
    expect(h.getActiveIndex()).toBe(2);
    h.next(); // wraps
    expect(h.getActiveIndex()).toBe(0);
    h.prev(); // wraps back
    expect(h.getActiveIndex()).toBe(2);
  });

  it('clamps instead of wrapping when loop=false', () => {
    const h = createFolderGallery(root, { items: ITEMS, loop: false });
    h.prev();
    expect(h.getActiveIndex()).toBe(0);
    h.goTo(99);
    expect(h.getActiveIndex()).toBe(2);
    h.next();
    expect(h.getActiveIndex()).toBe(2);
  });

  it('ArrowRight advances; Home/End jump; active card roves tabindex', () => {
    const h = createFolderGallery(root, { items: ITEMS });
    const scene = root.querySelector('.fg-scene');
    scene.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(h.getActiveIndex()).toBe(1);
    scene.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(h.getActiveIndex()).toBe(2);
    scene.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(h.getActiveIndex()).toBe(0);
    const cards = [...root.querySelectorAll('.fg-card')];
    expect(cards[0].tabIndex).toBe(0);
  });

  it('emits fg-activechange on navigation', () => {
    const seen = [];
    root.addEventListener('fg-activechange', (e) => seen.push(e.detail.index));
    const h = createFolderGallery(root, { items: ITEMS });
    h.next();
    h.next();
    expect(seen).toEqual([1, 2]);
  });
});

describe('selection', () => {
  it('clicking a non-active card activates it; clicking the active card selects', () => {
    const onSelect = vi.fn();
    const h = createFolderGallery(root, { items: ITEMS, onSelect });
    const cards = [...root.querySelectorAll('.fg-card')];
    cards[1].click();
    expect(h.getActiveIndex()).toBe(1);
    expect(onSelect).not.toHaveBeenCalled();
    cards[1].click();
    expect(onSelect).toHaveBeenCalledWith(ITEMS[1], 1);
  });

  it('fires a bubbling fg-select CustomEvent', () => {
    const seen = vi.fn();
    document.body.addEventListener('fg-select', (e) => seen(e.detail.index));
    createFolderGallery(root, { items: ITEMS });
    root.querySelectorAll('.fg-card')[0].click();
    expect(seen).toHaveBeenCalledWith(0);
  });

  it('Enter on the active card selects it', () => {
    const onSelect = vi.fn();
    createFolderGallery(root, { items: ITEMS, onSelect });
    const card = root.querySelector('.fg-card');
    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onSelect).toHaveBeenCalledWith(ITEMS[0], 0);
  });
});

describe('modes', () => {
  it('setMode switches, reflects data-fg-mode, and emits fg-modechange', () => {
    const seen = vi.fn();
    root.addEventListener('fg-modechange', (e) => seen(e.detail.mode));
    const h = createFolderGallery(root, { items: ITEMS });
    h.setMode('grid');
    expect(h.getMode()).toBe('grid');
    expect(root.getAttribute('data-fg-mode')).toBe('grid');
    expect(seen).toHaveBeenCalledWith('grid');
  });

  it('ignores unknown modes', () => {
    const h = createFolderGallery(root, { items: ITEMS });
    h.setMode('bogus');
    expect(h.getMode()).toBe('stack');
  });
});

describe('content', () => {
  it('renders item.content (HTML string) via the default renderer', () => {
    createFolderGallery(root, { items: [{ label: 'X', content: '<em id="inner">hi</em>' }] });
    expect(root.querySelector('#inner')).toBeTruthy();
  });

  it('a consumer contentRenderer replaces the default entirely', () => {
    const renderer = vi.fn((card, item) => {
      const el = document.createElement('div');
      el.className = 'custom';
      el.textContent = item.label;
      card.appendChild(el);
    });
    createFolderGallery(root, { items: ITEMS, contentRenderer: renderer });
    expect(renderer).toHaveBeenCalledTimes(3);
    expect(root.querySelectorAll('.custom').length).toBe(3);
    expect(root.querySelector('.fg-content')).toBeFalsy();
  });
});

describe('destroy', () => {
  it('empties the root, removes classes, and detaches window listeners', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const h = createFolderGallery(root, { items: ITEMS });
    h.destroy();
    expect(root.children.length).toBe(0);
    expect(root.classList.contains('fg-root')).toBe(false);
    expect(root.getAttribute('data-fg-mode')).toBeNull();
    expect(removeSpy.mock.calls.some(([ev]) => ev === 'resize')).toBe(true);
    removeSpy.mockRestore();
  });

  it('two instances on separate roots do not collide', () => {
    const rootB = document.createElement('div');
    document.body.appendChild(rootB);
    const a = createFolderGallery(root, { items: ITEMS });
    const b = createFolderGallery(rootB, { items: ITEMS });
    a.next();
    expect(a.getActiveIndex()).toBe(1);
    expect(b.getActiveIndex()).toBe(0);
    a.destroy();
    b.next();
    expect(b.getActiveIndex()).toBe(1);
    b.destroy();
  });
});

describe('peek', () => {
  it('defaults to hover and reflects as data-fg-peek', () => {
    createFolderGallery(root, { items: ITEMS });
    expect(root.getAttribute('data-fg-peek')).toBe('hover');
  });

  it('respects the option and falls back on invalid values', () => {
    const h = createFolderGallery(root, { items: ITEMS, peek: 'off' });
    expect(root.getAttribute('data-fg-peek')).toBe('off');
    h.setPeek('bogus');
    expect(root.getAttribute('data-fg-peek')).toBe('off');
    h.setPeek('always');
    expect(root.getAttribute('data-fg-peek')).toBe('always');
  });

  it('destroy removes the peek attribute', () => {
    const h = createFolderGallery(root, { items: ITEMS });
    h.destroy();
    expect(root.getAttribute('data-fg-peek')).toBeNull();
  });
});

describe('decal', () => {
  it('prints the photo on the folder front and marks the card', () => {
    createFolderGallery(root, { items: [{ label: 'X', color: '#2a3a3a', decal: '/photos/tokyo.jpg' }] });
    const card = root.querySelector('.fg-card');
    expect(card.classList.contains('fg-card--decal')).toBe(true);
    const photo = card.querySelector('.fg-front img.fg-decal');
    expect(photo.getAttribute('src')).toBe('/photos/tokyo.jpg');
    expect(photo.loading).toBe('lazy');
    // the back stays a colored path, no SVG image
    expect(card.querySelector('.fg-folder image')).toBeFalsy();
  });

  it('keeps the label on top of the photo', () => {
    createFolderGallery(root, { items: [{ label: 'Tokyo', decal: '/p.jpg' }] });
    const front = root.querySelector('.fg-front');
    expect(front.querySelector('.fg-decal')).toBeTruthy();
    expect(front.querySelector('.fg-label').textContent).toBe('Tokyo');
  });

  it('cards without a decal are untouched', () => {
    createFolderGallery(root, { items: ITEMS });
    expect(root.querySelector('.fg-card--decal')).toBeFalsy();
    expect(root.querySelector('.fg-decal')).toBeFalsy();
  });
});

describe('theming (color + gradient)', () => {
  it('item.gradient paints a front gradient layer and marks the card', () => {
    createFolderGallery(root, { items: [{ label: 'X', color: '#2a3a3a', gradient: 'linear-gradient(135deg, #236363, #8B7FB8)' }] });
    const card = root.querySelector('.fg-card');
    expect(card.classList.contains('fg-card--gradient')).toBe(true);
    const layer = card.querySelector('.fg-front .fg-gradient');
    expect(layer).toBeTruthy();
    expect(layer.style.background).toContain('linear-gradient');
    expect(layer.getAttribute('aria-hidden')).toBe('true');
  });

  it('cards without a gradient have no gradient layer', () => {
    createFolderGallery(root, { items: ITEMS });
    expect(root.querySelector('.fg-gradient')).toBeFalsy();
    expect(root.querySelector('.fg-card--gradient')).toBeFalsy();
  });

  it('build-time color still paints the back fill and front vars', () => {
    createFolderGallery(root, { items: [{ label: 'X', color: '#2a3a3a' }] });
    const card = root.querySelector('.fg-card');
    expect(card.style.getPropertyValue('--fg-folder-bg')).toBe('#2a3a3a');
    expect(card.querySelector('.fg-folder path').getAttribute('fill').startsWith('rgb(')).toBe(true);
  });

  it('setColor re-derives a folder\'s palette at runtime', () => {
    const h = createFolderGallery(root, { items: ITEMS });
    const card = root.querySelectorAll('.fg-card')[1];
    h.setColor(1, '#804020');
    expect(card.style.getPropertyValue('--fg-folder-bg')).toBe('#804020');
    expect(card.querySelector('.fg-folder path').getAttribute('fill').startsWith('rgb(')).toBe(true);
    expect(card.style.getPropertyValue('--fg-front')).toContain('rgba(');
    expect(card.style.getPropertyValue('--fg-label-on-color')).toBeTruthy();
  });

  it('setColor tolerates out-of-range indices and a missing hex', () => {
    const h = createFolderGallery(root, { items: ITEMS });
    expect(() => h.setColor(99, '#fff000')).not.toThrow();
    expect(() => h.setColor(0)).not.toThrow();
  });

  it('setGradient adds then clears a front gradient', () => {
    const h = createFolderGallery(root, { items: ITEMS });
    const card = root.querySelector('.fg-card');
    h.setGradient(0, 'linear-gradient(90deg, #000, #fff)');
    expect(card.querySelector('.fg-gradient')).toBeTruthy();
    expect(card.classList.contains('fg-card--gradient')).toBe(true);
    h.setGradient(0, null);
    expect(card.querySelector('.fg-gradient')).toBeFalsy();
    expect(card.classList.contains('fg-card--gradient')).toBe(false);
  });
});

describe('drag (grab and throw)', () => {
  const PE = typeof window.PointerEvent === 'function' ? window.PointerEvent : window.MouseEvent;
  const pev = (type, x, y) => new PE(type, { clientX: x, clientY: y, button: 0, bubbles: true });

  function drag(card, from, to) {
    card.dispatchEvent(pev('pointerdown', from[0], from[1]));
    window.dispatchEvent(pev('pointermove', to[0], to[1]));
    window.dispatchEvent(pev('pointerup', to[0], to[1]));
  }

  it('reflects the option as data-fg-drag and defaults to fling', () => {
    const h = createFolderGallery(root, { items: ITEMS });
    expect(root.getAttribute('data-fg-drag')).toBe('fling');
    h.destroy();
    createFolderGallery(root, { items: ITEMS, drag: 'off' });
    expect(root.getAttribute('data-fg-drag')).toBe('off');
  });

  it('a fling past the distance threshold advances', async () => {
    const h = createFolderGallery(root, { items: ITEMS });
    const card = root.querySelector('.fg-card.is-active');
    drag(card, [200, 200], [40, 200]); // 160px left
    await new Promise((r) => setTimeout(r, 300));
    expect(h.getActiveIndex()).toBe(1);
  });

  it('a short drag springs back without advancing', async () => {
    const h = createFolderGallery(root, { items: ITEMS });
    const card = root.querySelector('.fg-card.is-active');
    const base = card.style.transform;
    // dispatch move/up on separate ticks so the velocity sample decays
    card.dispatchEvent(pev('pointerdown', 200, 200));
    window.dispatchEvent(pev('pointermove', 230, 200));
    await new Promise((r) => setTimeout(r, 50));
    window.dispatchEvent(pev('pointermove', 230, 200));
    window.dispatchEvent(pev('pointerup', 230, 200));
    await new Promise((r) => setTimeout(r, 300));
    expect(h.getActiveIndex()).toBe(0);
    expect(card.style.transform).toBe(base);
  });

  it('a real drag suppresses the click that follows, a tap does not', async () => {
    const onSelect = vi.fn();
    createFolderGallery(root, { items: ITEMS, onSelect });
    const card = root.querySelector('.fg-card.is-active');
    card.dispatchEvent(pev('pointerdown', 200, 200));
    window.dispatchEvent(pev('pointermove', 230, 200));
    await new Promise((r) => setTimeout(r, 50));
    window.dispatchEvent(pev('pointermove', 230, 200));
    window.dispatchEvent(pev('pointerup', 230, 200));
    card.click();
    expect(onSelect).not.toHaveBeenCalled(); // drag ate this click
    card.dispatchEvent(pev('pointerdown', 200, 200));
    window.dispatchEvent(pev('pointerup', 200, 200));
    card.click();
    expect(onSelect).toHaveBeenCalledTimes(1); // tap selects normally
  });

  it('does not advance past the end when loop is off', async () => {
    const h = createFolderGallery(root, { items: ITEMS, loop: false });
    const card = root.querySelector('.fg-card.is-active');
    drag(card, [40, 200], [200, 200]); // fling right = previous, blocked at 0
    await new Promise((r) => setTimeout(r, 300));
    expect(h.getActiveIndex()).toBe(0);
  });

  it('drag: off wires nothing', async () => {
    const h = createFolderGallery(root, { items: ITEMS, drag: 'off' });
    const card = root.querySelector('.fg-card.is-active');
    drag(card, [200, 200], [40, 200]);
    await new Promise((r) => setTimeout(r, 300));
    expect(h.getActiveIndex()).toBe(0);
    expect(card.classList.contains('fg-card--dragging')).toBe(false);
  });
});

describe('robustness: bad goTo input', () => {
  it('goTo(NaN|undefined|"x") never corrupts active, transforms, or events', () => {
    const seen = [];
    const h = createFolderGallery(root, { items: ITEMS });
    root.addEventListener('fg-activechange', (e) => seen.push(e.detail.index));
    h.goTo(1); // one legitimate move to a valid index
    [NaN, undefined, 'x', {}].forEach((bad) => expect(() => h.goTo(bad)).not.toThrow());
    // active stays the last valid index, still an in-range integer
    const a = h.getActiveIndex();
    expect(Number.isInteger(a)).toBe(true);
    expect(a).toBe(1);
    // no card carries a NaN transform
    [...root.querySelectorAll('.fg-card')].forEach((c) => {
      expect(c.style.transform).not.toContain('NaN');
    });
    // only the one valid move emitted, and never with a NaN index
    expect(seen).toEqual([1]);
    expect(seen.every((i) => Number.isInteger(i))).toBe(true);
  });
});

describe('robustness: empty gallery handle', () => {
  it('every method is a callable no-op on an empty gallery', () => {
    const h = createFolderGallery(root, { items: [] });
    expect(() => {
      h.setColor(0, '#ffffff');
      h.setGradient(0, 'linear-gradient(90deg,#000,#fff)');
      h.getItems();
      h.getPeek();
      h.getColor(0);
      h.getGradient(0);
      h.next();
      h.prev();
      h.goTo(2);
    }).not.toThrow();
    expect(h.getItems()).toEqual([]);
    expect(h.getColor(0)).toBeUndefined();
    expect(h.getGradient(0)).toBeUndefined();
    h.destroy();
  });
});

describe('robustness: post-destroy inertness', () => {
  it('goTo/setMode/setPeek/setColor are inert after destroy and add no attributes back', () => {
    const h = createFolderGallery(root, { items: ITEMS });
    h.destroy();
    expect(() => {
      h.goTo(2);
      h.setMode('grid');
      h.setPeek('always');
      h.setColor(0, '#ffffff');
      h.setGradient(0, 'linear-gradient(90deg,#000,#fff)');
    }).not.toThrow();
    expect(root.getAttribute('data-fg-mode')).toBeNull();
    expect(root.getAttribute('data-fg-peek')).toBeNull();
    expect(root.getAttribute('data-fg-drag')).toBeNull();
    expect(root.children.length).toBe(0);
  });

  it('destroy is idempotent', () => {
    const h = createFolderGallery(root, { items: ITEMS });
    h.destroy();
    expect(() => h.destroy()).not.toThrow();
    expect(root.children.length).toBe(0);
  });
});

describe('robustness: double init', () => {
  it('re-initializing a root tears the old instance down (exactly one scene)', () => {
    const a = createFolderGallery(root, { items: ITEMS });
    a.next();
    expect(a.getActiveIndex()).toBe(1);
    const b = createFolderGallery(root, { items: ITEMS });
    expect(root.querySelectorAll('.fg-scene').length).toBe(1);
    expect(root.querySelectorAll('.fg-card').length).toBe(3);
    // the old handle is now dead; the new one starts fresh
    expect(b.getActiveIndex()).toBe(0);
    b.destroy();
  });
});

describe('robustness: color parsing', () => {
  it('setColor accepts 3-digit hex and paints a valid rgb (not NaN)', () => {
    const h = createFolderGallery(root, { items: ITEMS });
    const path = () => root.querySelector('.fg-card .fg-folder path').getAttribute('fill');
    h.setColor(0, '#f00');
    expect(path().startsWith('rgb(')).toBe(true);
    expect(path()).not.toContain('NaN');
  });

  it('an invalid color (red, #zzz) is a no-op, never painting rgb(NaN)', () => {
    const h = createFolderGallery(root, { items: ITEMS });
    const card = root.querySelector('.fg-card');
    h.setColor(0, '#f00');
    const before = card.querySelector('.fg-folder path').getAttribute('fill');
    h.setColor(0, 'red');
    h.setColor(0, '#zzz');
    const after = card.querySelector('.fg-folder path').getAttribute('fill');
    expect(after).toBe(before);
    expect(after).not.toContain('NaN');
  });
});

describe('robustness: undefined options keep defaults', () => {
  it('loop: undefined still loops (default true is not clobbered)', () => {
    const h = createFolderGallery(root, { items: ITEMS, loop: undefined });
    h.prev(); // from 0, wraps to last only if loop stayed true
    expect(h.getActiveIndex()).toBe(2);
  });
});

describe('peek accessors', () => {
  it('getPeek reflects the current peek; setPeek updates it and emits fg-peekchange', () => {
    const seen = vi.fn();
    root.addEventListener('fg-peekchange', (e) => seen(e.detail.peek));
    const h = createFolderGallery(root, { items: ITEMS });
    expect(h.getPeek()).toBe('hover');
    h.setPeek('always');
    expect(h.getPeek()).toBe('always');
    expect(seen).toHaveBeenCalledWith('always');
  });
});

describe('color/gradient/items accessors', () => {
  it('getColor and getGradient reflect what setColor/setGradient set', () => {
    const h = createFolderGallery(root, { items: ITEMS });
    expect(h.getColor(0)).toBe('#2a3a3a'); // build-time color
    expect(h.getGradient(0)).toBeUndefined();
    h.setColor(0, '#804020');
    expect(h.getColor(0)).toBe('#804020');
    h.setGradient(0, 'linear-gradient(90deg, #000, #fff)');
    expect(h.getGradient(0)).toContain('linear-gradient');
  });

  it('getColor/getGradient are undefined when unset', () => {
    const h = createFolderGallery(root, { items: [{ label: 'Bare' }] });
    expect(h.getColor(0)).toBeUndefined();
    expect(h.getGradient(0)).toBeUndefined();
  });

  it('getItems returns a copy: mutating it does not affect internal state', () => {
    const h = createFolderGallery(root, { items: ITEMS });
    const got = h.getItems();
    expect(got).toEqual(ITEMS);
    got.push({ label: 'Injected' });
    got.length = 0; // wipe the returned array
    expect(h.getItems().length).toBe(3);
    expect(h.getItems()[0].label).toBe('One');
  });
});

describe('fling events', () => {
  const PE = typeof window.PointerEvent === 'function' ? window.PointerEvent : window.MouseEvent;
  const pev = (type, x, y) => new PE(type, { clientX: x, clientY: y, button: 0, bubbles: true });
  function drag(card, from, to) {
    card.dispatchEvent(pev('pointerdown', from[0], from[1]));
    window.dispatchEvent(pev('pointermove', to[0], to[1]));
    window.dispatchEvent(pev('pointerup', to[0], to[1]));
  }

  // reducedMotion:'force' collapses the async fling choreography so both events
  // fire synchronously on release - deterministic without waiting out timers.
  it('a fling emits fg-flingstart then fg-flingend, each with {index, direction}', () => {
    const events = [];
    root.addEventListener('fg-flingstart', (e) => events.push(['start', e.detail]));
    root.addEventListener('fg-flingend', (e) => events.push(['end', e.detail]));
    const h = createFolderGallery(root, { items: ITEMS, reducedMotion: 'force' });
    const card = root.querySelector('.fg-card.is-active');
    drag(card, [200, 200], [40, 200]); // 160px left = next
    expect(events.map((e) => e[0])).toEqual(['start', 'end']);
    expect(events[0][1]).toMatchObject({ index: 0, direction: 'next' });
    expect(events[1][1]).toMatchObject({ index: 1, direction: 'next' });
    expect(h.getActiveIndex()).toBe(1);
  });
});

describe('FOLDER_PATHS', () => {
  it('exports string left/right/tray paths', () => {
    expect(typeof FOLDER_PATHS.left).toBe('string');
    expect(typeof FOLDER_PATHS.right).toBe('string');
    expect(typeof FOLDER_PATHS.tray).toBe('string');
  });

  it('folderPath: FOLDER_PATHS.tray renders as the path d attribute', () => {
    createFolderGallery(root, { items: ITEMS, folderPath: FOLDER_PATHS.tray });
    const d = root.querySelector('.fg-folder path').getAttribute('d');
    expect(d).toBe(FOLDER_PATHS.tray);
  });
});

describe('grid legibility fix (cell width, no shrink)', () => {
  it('grid sizes each card via inline px width and does not scale it down', () => {
    const h = createFolderGallery(root, { items: ITEMS, mode: 'grid' });
    const card = root.querySelector('.fg-card');
    expect(card.style.width).toMatch(/px$/);
    expect(card.style.transform).toContain('scale(1)');
    expect(card.style.transform).not.toMatch(/scale\(0\./); // no sub-1 shrink
    // switching back to stack clears the inline width
    h.setMode('stack');
    expect(card.style.width).toBe('');
  });

  it('grid columns:2 lays out two per row (shared row y-offset), no throw', () => {
    expect(() => createFolderGallery(root, { items: ITEMS, mode: 'grid', grid: { columns: 2 } })).not.toThrow();
    const cards = [...root.querySelectorAll('.fg-card')];
    cards.forEach((c) => expect(c.style.width).toMatch(/px$/));
    const yOf = (c) => c.style.transform.match(/translate3d\([^,]+,\s*([^,]+),/)[1];
    // cols=2 → cards 0,1 share row 0; card 2 wraps to row 1
    expect(yOf(cards[0])).toBe(yOf(cards[1]));
    expect(yOf(cards[2])).not.toBe(yOf(cards[0]));
  });
});

describe('carousel mode', () => {
  it('setMode(carousel) sets data-fg-mode and next/prev navigate', () => {
    const h = createFolderGallery(root, { items: ITEMS });
    h.setMode('carousel');
    expect(root.getAttribute('data-fg-mode')).toBe('carousel');
    expect(() => { h.next(); h.prev(); }).not.toThrow();
    h.next();
    expect(h.getActiveIndex()).toBe(1);
  });
});

describe('wheel navigation', () => {
  const wheel = (dy) => new WheelEvent('wheel', { deltaY: dy, bubbles: true, cancelable: true });

  it('a wheel past the threshold advances, then respects the cooldown', () => {
    vi.useFakeTimers();
    try {
      const h = createFolderGallery(root, { items: ITEMS });
      root.dispatchEvent(wheel(60)); // > SCROLL_THRESHOLD (30)
      expect(h.getActiveIndex()).toBe(1);
      root.dispatchEvent(wheel(60)); // still cooling down: no advance
      expect(h.getActiveIndex()).toBe(1);
      vi.advanceTimersByTime(500); // past SCROLL_COOLDOWN.stack (450)
      root.dispatchEvent(wheel(60));
      expect(h.getActiveIndex()).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('touch swipe', () => {
  it('a dominant-axis swipe on the scene navigates (drag off so touch owns it)', () => {
    const h = createFolderGallery(root, { items: ITEMS, drag: 'off' });
    const scene = root.querySelector('.fg-scene');
    const start = new Event('touchstart', { bubbles: true });
    start.touches = [{ clientX: 200, clientY: 200 }];
    scene.dispatchEvent(start);
    const end = new Event('touchend', { bubbles: true });
    end.changedTouches = [{ clientX: 100, clientY: 200 }]; // 100px left = next
    scene.dispatchEvent(end);
    expect(h.getActiveIndex()).toBe(1);
  });
});
