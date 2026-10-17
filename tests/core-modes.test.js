import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createFolderGallery as rawCreate } from '../src/folder-gallery.js';

const ITEMS = [
  { label: 'One', color: '#2a3a3a' },
  { label: 'Two', color: '#3d2e42' },
  { label: 'Three', color: '#2a2d3e' },
  { label: 'Four', color: '#4f6b7c' },
];
const MODES = ['stack', 'grid', 'carousel'];

// Destroy everything a test built so document/window listeners never leak
// into the next test.
let made = [];
const createFolderGallery = (...args) => { const h = rawCreate(...args); made.push(h); return h; };

let root;
const VALID_TRANSFORM = /^translate3d\(-?[\d.]+(?:e[+-]?\d+)?px,-?[\d.]+(?:e[+-]?\d+)?px,/; // jsdom drops invalid values, so assert presence, not absence of NaN

beforeEach(() => {
  document.body.innerHTML = '';
  root = document.createElement('div');
  document.body.appendChild(root);
});
afterEach(() => {
  made.forEach((h) => h.destroy());
  made = [];
  vi.useRealTimers();
});

const cards = () => [...root.querySelectorAll('.fg-card')];
const dots = () => [...root.querySelectorAll('.fg-dot')];
const scene = () => root.querySelector('.fg-scene');
const key = (target, k, init = {}) => {
  const ev = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(ev);
  return ev;
};

describe.each(MODES)('%s mode: ARIA', (mode) => {
  it('exposes listbox semantics on the scene', () => {
    createFolderGallery(root, { items: ITEMS, mode });
    expect(scene().getAttribute('role')).toBe('listbox');
    expect(scene().getAttribute('aria-roledescription')).toBe('folder gallery');
  });

  it('every card is an option with setsize/posinset and a data index', () => {
    createFolderGallery(root, { items: ITEMS, mode });
    cards().forEach((c, i) => {
      expect(c.getAttribute('role')).toBe('option');
      expect(c.getAttribute('aria-setsize')).toBe('4');
      expect(c.getAttribute('aria-posinset')).toBe(String(i + 1));
      expect(c.getAttribute('data-fg-index')).toBe(String(i));
      expect(c.getAttribute('aria-label')).toBe(ITEMS[i].label);
    });
  });

  it('exactly one card is selected, tabbable and .is-active, and it follows navigation', () => {
    const h = createFolderGallery(root, { items: ITEMS, mode });
    [0, 1, 3, 2].forEach((target) => {
      h.goTo(target);
      const selected = cards().filter((c) => c.getAttribute('aria-selected') === 'true');
      expect(selected).toEqual([cards()[target]]);
      expect(cards().filter((c) => c.tabIndex === 0)).toEqual([cards()[target]]);
      expect(cards().filter((c) => c.classList.contains('is-active'))).toEqual([cards()[target]]);
      cards().filter((c, i) => i !== target).forEach((c) => expect(c.getAttribute('aria-selected')).toBe('false'));
    });
  });

  it('dots are tabs whose aria-selected tracks the active folder', () => {
    const h = createFolderGallery(root, { items: ITEMS, mode });
    expect(root.querySelector('.fg-dots').getAttribute('role')).toBe('tablist');
    dots().forEach((d) => expect(d.getAttribute('role')).toBe('tab'));
    expect(dots().map((d) => d.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false', 'false']);
    h.goTo(2);
    expect(dots().map((d) => d.getAttribute('aria-selected'))).toEqual(['false', 'false', 'true', 'false']);
    expect(dots()[2].classList.contains('is-active')).toBe(true);
  });

  it('announces the position through a polite, atomic live region', () => {
    const h = createFolderGallery(root, { items: ITEMS, mode });
    const live = root.querySelector('[aria-live]');
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(live.getAttribute('aria-atomic')).toBe('true');
    expect(live.textContent).toBe('1 of 4: One');
    h.goTo(3);
    expect(live.textContent).toBe('4 of 4: Four');
  });

  it('announces just the position for an unlabeled folder', () => {
    const h = createFolderGallery(root, { items: [{ color: '#111111' }, { color: '#222222' }], mode });
    h.next();
    expect(root.querySelector('[aria-live]').textContent).toBe('2 of 2');
  });

  it('never leaves a NaN in any transform', () => {
    const h = createFolderGallery(root, { items: ITEMS, mode });
    for (let i = 0; i < 4; i++) {
      h.next();
      cards().forEach((c) => {
        expect(c.style.transform).toMatch(VALID_TRANSFORM);
        expect(c.style.opacity).toMatch(/^[\d.]+$/);
      });
    }
  });
});

describe.each(MODES)('%s mode: keyboard', (mode) => {
  it('ArrowRight/ArrowDown advance and ArrowLeft/ArrowUp go back', () => {
    const h = createFolderGallery(root, { items: ITEMS, mode, defaultActiveIndex: 1 });
    key(cards()[1], 'ArrowRight');
    expect(h.getActiveIndex()).toBe(2);
    key(cards()[2], 'ArrowDown');
    expect(h.getActiveIndex()).toBe(3);
    key(cards()[3], 'ArrowLeft');
    expect(h.getActiveIndex()).toBe(2);
    key(cards()[2], 'ArrowUp');
    expect(h.getActiveIndex()).toBe(1);
  });

  it('Home and End jump to the ends', () => {
    const h = createFolderGallery(root, { items: ITEMS, mode, defaultActiveIndex: 1 });
    key(cards()[1], 'End');
    expect(h.getActiveIndex()).toBe(3);
    key(cards()[3], 'Home');
    expect(h.getActiveIndex()).toBe(0);
  });

  it('moves focus to the newly active card (roving tabindex)', () => {
    createFolderGallery(root, { items: ITEMS, mode });
    cards()[0].focus();
    key(cards()[0], 'ArrowRight');
    expect(document.activeElement).toBe(cards()[1]);
    expect(cards()[1].tabIndex).toBe(0);
    expect(cards()[0].tabIndex).toBe(-1);
    key(cards()[1], 'End');
    expect(document.activeElement).toBe(cards()[3]);
  });

  it('prevents default on handled keys only', () => {
    createFolderGallery(root, { items: ITEMS, mode });
    expect(key(cards()[0], 'ArrowRight').defaultPrevented).toBe(true);
    expect(key(cards()[0], 'Home').defaultPrevented).toBe(true);
    expect(key(cards()[0], 'a').defaultPrevented).toBe(false);
    expect(key(cards()[0], 'Tab').defaultPrevented).toBe(false);
  });

  it('arrow keys on a dot navigate and hand focus to the active card', () => {
    const h = createFolderGallery(root, { items: ITEMS, mode });
    dots()[0].focus();
    key(dots()[0], 'ArrowRight');
    expect(h.getActiveIndex()).toBe(1);
    expect(document.activeElement).toBe(cards()[1]);
  });

  it('wraps at the ends when looping and stops there when not', () => {
    let h = createFolderGallery(root, { items: ITEMS, mode });
    key(cards()[0], 'ArrowLeft');
    expect(h.getActiveIndex()).toBe(3);
    key(cards()[3], 'ArrowRight');
    expect(h.getActiveIndex()).toBe(0);
    h = createFolderGallery(root, { items: ITEMS, mode, loop: false });
    key(cards()[0], 'ArrowLeft');
    expect(h.getActiveIndex()).toBe(0);
    key(cards()[0], 'End');
    key(cards()[3], 'ArrowRight');
    expect(h.getActiveIndex()).toBe(3);
  });

  it('Enter and Space select the focused folder; other keys do not', () => {
    const onSelect = vi.fn();
    createFolderGallery(root, { items: ITEMS, mode, onSelect });
    expect(key(cards()[0], 'Enter').defaultPrevented).toBe(true);
    expect(key(cards()[0], ' ').defaultPrevented).toBe(true);
    key(cards()[0], 'a');
    key(cards()[0], 'Escape');
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelect).toHaveBeenCalledWith(ITEMS[0], 0);
  });

  it('Enter emits a bubbling fg-select', () => {
    createFolderGallery(root, { items: ITEMS, mode });
    const seen = vi.fn();
    document.body.addEventListener('fg-select', seen);
    key(cards()[0], 'Enter');
    document.body.removeEventListener('fg-select', seen);
    expect(seen).toHaveBeenCalledTimes(1);
    expect(seen.mock.calls[0][0].detail).toEqual({ index: 0, item: ITEMS[0] });
  });

  it('clicking a dot jumps to that folder and emits fg-activechange', () => {
    const h = createFolderGallery(root, { items: ITEMS, mode });
    const seen = [];
    root.addEventListener('fg-activechange', (e) => seen.push(e.detail.index));
    dots()[3].click();
    expect(h.getActiveIndex()).toBe(3);
    expect(seen).toEqual([3]);
  });

  it('fg-activechange carries the item and does not fire for a no-op move', () => {
    const h = createFolderGallery(root, { items: ITEMS, mode });
    const seen = [];
    root.addEventListener('fg-activechange', (e) => seen.push(e.detail));
    h.goTo(0);
    expect(seen).toEqual([]);
    h.goTo(2);
    expect(seen).toEqual([{ index: 2, item: ITEMS[2] }]);
  });
});

describe('document-level arrow keys (hover without focus)', () => {
  it('navigates while the pointer is over the gallery and nothing else has focus', () => {
    const h = createFolderGallery(root, { items: ITEMS });
    root.dispatchEvent(new MouseEvent('mouseenter'));
    key(document, 'ArrowRight');
    expect(h.getActiveIndex()).toBe(1);
    key(document, 'End');
    expect(h.getActiveIndex()).toBe(3);
  });

  it('does not steal focus when it navigates', () => {
    createFolderGallery(root, { items: ITEMS });
    root.dispatchEvent(new MouseEvent('mouseenter'));
    key(document, 'ArrowRight');
    expect(document.activeElement).toBe(document.body);
  });

  it('ignores keys when the pointer is not over the gallery', () => {
    const h = createFolderGallery(root, { items: ITEMS });
    key(document, 'ArrowRight');
    expect(h.getActiveIndex()).toBe(0);
  });

  it('stops listening after mouseleave', () => {
    const h = createFolderGallery(root, { items: ITEMS });
    root.dispatchEvent(new MouseEvent('mouseenter'));
    root.dispatchEvent(new MouseEvent('mouseleave'));
    key(document, 'ArrowRight');
    expect(h.getActiveIndex()).toBe(0);
  });

  it('does not hijack arrows while a control elsewhere on the page has focus', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    const h = createFolderGallery(root, { items: ITEMS });
    root.dispatchEvent(new MouseEvent('mouseenter'));
    const ev = key(input, 'ArrowRight');
    expect(h.getActiveIndex()).toBe(0);
    expect(ev.defaultPrevented).toBe(false);
  });

  it('still works when focus is inside the gallery', () => {
    const h = createFolderGallery(root, { items: ITEMS });
    root.dispatchEvent(new MouseEvent('mouseenter'));
    cards()[0].focus();
    key(document, 'ArrowRight');
    expect(h.getActiveIndex()).toBeGreaterThanOrEqual(1);
  });

  it('is removed on destroy', () => {
    const h = createFolderGallery(root, { items: ITEMS });
    root.dispatchEvent(new MouseEvent('mouseenter'));
    h.destroy();
    const ev = key(document, 'ArrowRight');
    expect(ev.defaultPrevented).toBe(false);
  });
});

describe('stack layout', () => {
  it('stacks cards behind the active one: higher z-index and opacity in front', () => {
    createFolderGallery(root, { items: ITEMS });
    const z = cards().map((c) => Number(c.style.zIndex));
    expect(z[0]).toBe(ITEMS.length + 1);
    expect(z[1]).toBeGreaterThan(z[2]);
    expect(z[2]).toBeGreaterThan(z[3]);
    const op = cards().map((c) => Number(c.style.opacity));
    expect(op[0]).toBe(1);
    expect(op[1]).toBeGreaterThan(op[2]);
  });

  it('re-stacks around the new active folder', () => {
    const h = createFolderGallery(root, { items: ITEMS });
    h.goTo(2);
    expect(Number(cards()[2].style.zIndex)).toBe(ITEMS.length + 1);
    // the card right after the active one is next in line (index 3), then wraps to 0
    expect(Number(cards()[3].style.zIndex)).toBeGreaterThan(Number(cards()[0].style.zIndex));
  });

  it('clears the scene height and any grid card width', () => {
    const h = createFolderGallery(root, { items: ITEMS, mode: 'grid' });
    expect(cards()[0].style.width).not.toBe('');
    h.setMode('stack');
    expect(cards().every((c) => c.style.width === '')).toBe(true);
    expect(scene().style.height).toBe('');
  });
});

describe('grid layout', () => {
  it('gives every card an explicit px width and a scale of 1', () => {
    createFolderGallery(root, { items: ITEMS, mode: 'grid' });
    cards().forEach((c) => {
      expect(c.style.width).toMatch(/px$/);
      expect(c.style.transform).toContain('scale(1)');
    });
  });

  it('keeps all folders fully opaque and the active one on top', () => {
    const h = createFolderGallery(root, { items: ITEMS, mode: 'grid' });
    h.goTo(2);
    cards().forEach((c) => expect(c.style.opacity).toBe('1'));
    expect(Number(cards()[2].style.zIndex)).toBeGreaterThan(Number(cards()[0].style.zIndex));
  });

  it('clicking a folder activates it first, then selects it', () => {
    const onSelect = vi.fn();
    const h = createFolderGallery(root, { items: ITEMS, mode: 'grid', onSelect });
    cards()[2].click();
    expect(h.getActiveIndex()).toBe(2);
    expect(onSelect).not.toHaveBeenCalled();
    cards()[2].click();
    expect(onSelect).toHaveBeenCalledWith(ITEMS[2], 2);
  });

  it('does not start a fling drag', () => {
    const h = createFolderGallery(root, { items: ITEMS, mode: 'grid' });
    const PE = typeof window.PointerEvent === 'function' ? window.PointerEvent : window.MouseEvent;
    const pev = (t, x, y) => new PE(t, { clientX: x, clientY: y, button: 0, bubbles: true });
    cards()[0].dispatchEvent(pev('pointerdown', 0, 0));
    window.dispatchEvent(pev('pointermove', 300, 0));
    window.dispatchEvent(pev('pointerup', 300, 0));
    expect(cards()[0].classList.contains('fg-card--dragging')).toBe(false);
    expect(cards()[0].classList.contains('fg-card--flung')).toBe(false);
    expect(h.getActiveIndex()).toBe(0);
  });
});

describe('carousel layout', () => {
  it('centers the active card and fades neighbours by distance', () => {
    const h = createFolderGallery(root, { items: ITEMS, mode: 'carousel', defaultActiveIndex: 1 });
    const op = cards().map((c) => Number(c.style.opacity));
    expect(op[1]).toBe(1);
    expect(op[0]).toBeLessThan(1);
    expect(op[2]).toBeLessThan(1);
    h.goTo(0);
    expect(Number(cards()[0].style.opacity)).toBe(1);
  });

  it('shrinks cards away from the center', () => {
    createFolderGallery(root, { items: ITEMS, mode: 'carousel' });
    const scale = (c) => Number(c.style.transform.match(/scale\(([\d.]+)\)/)[1]);
    expect(scale(cards()[0])).toBeGreaterThan(scale(cards()[1]));
  });

  it('sizes the scene height and removes it when leaving carousel for stack', () => {
    const h = createFolderGallery(root, { items: ITEMS, mode: 'carousel' });
    expect(parseFloat(scene().style.height)).toBeGreaterThanOrEqual(180);
    h.setMode('stack');
    expect(scene().style.height).toBe('');
  });

  it('wheel navigates horizontally-oriented carousel too, with the carousel cooldown', () => {
    vi.useFakeTimers();
    const h = createFolderGallery(root, { items: ITEMS, mode: 'carousel' });
    const wheel = (dy) => new WheelEvent('wheel', { deltaY: dy, bubbles: true, cancelable: true });
    root.dispatchEvent(wheel(60));
    expect(h.getActiveIndex()).toBe(1);
    vi.advanceTimersByTime(250);
    root.dispatchEvent(wheel(60));
    expect(h.getActiveIndex()).toBe(1);
    vi.advanceTimersByTime(100); // past SCROLL_COOLDOWN.carousel (300)
    root.dispatchEvent(wheel(60));
    expect(h.getActiveIndex()).toBe(2);
  });

  it('the active card on the far side wraps to the shortest path', () => {
    const items = [...ITEMS, { label: 'Five' }];
    createFolderGallery(root, { items, mode: 'carousel', defaultActiveIndex: 0 });
    // with 5 items, index 4 is one step left of 0 and so is more visible than index 2
    expect(Number(cards()[4].style.opacity)).toBeGreaterThan(Number(cards()[2].style.opacity));
  });
});

describe('mode switching', () => {
  it('cycles through every mode keeping the active folder and a11y state intact', () => {
    const h = createFolderGallery(root, { items: ITEMS, defaultActiveIndex: 2 });
    const modes = [];
    root.addEventListener('fg-modechange', (e) => modes.push(e.detail.mode));
    ['grid', 'carousel', 'stack', 'grid'].forEach((m) => {
      h.setMode(m);
      expect(h.getMode()).toBe(m);
      expect(root.getAttribute('data-fg-mode')).toBe(m);
      expect(h.getActiveIndex()).toBe(2);
      expect(cards()[2].getAttribute('aria-selected')).toBe('true');
      expect(cards()[2].tabIndex).toBe(0);
    });
    expect(modes).toEqual(['grid', 'carousel', 'stack', 'grid']);
  });

  it('setMode to the current mode is silent', () => {
    const h = createFolderGallery(root, { items: ITEMS });
    const spy = vi.fn();
    root.addEventListener('fg-modechange', spy);
    h.setMode('stack');
    expect(spy).not.toHaveBeenCalled();
  });

  it('keyboard navigation keeps working after a mode switch', () => {
    const h = createFolderGallery(root, { items: ITEMS });
    h.setMode('carousel');
    key(cards()[0], 'ArrowRight');
    expect(h.getActiveIndex()).toBe(1);
    h.setMode('grid');
    key(cards()[1], 'ArrowRight');
    expect(h.getActiveIndex()).toBe(2);
  });
});

describe('events bubble to ancestors', () => {
  it('every fg-* event can be heard on an ancestor of the root', () => {
    const h = createFolderGallery(root, { items: ITEMS });
    const names = [];
    ['fg-select', 'fg-activechange', 'fg-modechange', 'fg-peekchange'].forEach((n) =>
      document.body.addEventListener(n, () => names.push(n)));
    h.next();
    h.setMode('grid');
    h.setPeek('always');
    cards()[1].click();
    expect(names).toEqual(['fg-activechange', 'fg-modechange', 'fg-peekchange', 'fg-select']);
  });
});

describe('fling lifecycle', () => {
  const PE = typeof window.PointerEvent === 'function' ? window.PointerEvent : window.MouseEvent;
  const pev = (t, x, y, extra = {}) => new PE(t, { clientX: x, clientY: y, button: 0, bubbles: true, ...extra });
  const throwCard = (card, dx, dy = 0) => {
    card.dispatchEvent(pev('pointerdown', 0, 0));
    window.dispatchEvent(pev('pointermove', dx, dy));
    window.dispatchEvent(pev('pointerup', dx, dy));
  };

  it('reducedMotion: force flings synchronously: start and end back-to-back, no timers', () => {
    const h = createFolderGallery(root, { items: ITEMS, reducedMotion: 'force' });
    const seen = [];
    ['fg-flingstart', 'fg-activechange', 'fg-flingend'].forEach((n) =>
      root.addEventListener(n, (e) => seen.push([n, e.detail.index, e.detail.direction])));
    throwCard(cards()[0], -200);
    expect(h.getActiveIndex()).toBe(1);
    expect(seen).toEqual([
      ['fg-flingstart', 0, 'next'],
      ['fg-activechange', 1, undefined],
      ['fg-flingend', 1, 'next'],
    ]);
  });

  it('direction: right and down are "prev", left and up are "next"', () => {
    const dirs = [];
    const h = createFolderGallery(root, { items: ITEMS, reducedMotion: 'force', defaultActiveIndex: 1 });
    root.addEventListener('fg-flingstart', (e) => dirs.push(e.detail.direction));
    throwCard(cards()[1], 200); // right → prev
    throwCard(cards()[h.getActiveIndex()], 0, -200); // up → next
    throwCard(cards()[h.getActiveIndex()], 0, 200); // down → prev
    expect(dirs).toEqual(['prev', 'next', 'prev']);
  });

  it('only the active folder can be grabbed, and only with the primary button', () => {
    const h = createFolderGallery(root, { items: ITEMS, reducedMotion: 'force' });
    throwCard(cards()[2], -200); // not active
    expect(h.getActiveIndex()).toBe(0);
    cards()[0].dispatchEvent(pev('pointerdown', 0, 0, { button: 2 }));
    window.dispatchEvent(pev('pointermove', -200, 0));
    window.dispatchEvent(pev('pointerup', -200, 0));
    expect(h.getActiveIndex()).toBe(0);
  });

  it('a pointercancel ends the drag like a release', () => {
    const h = createFolderGallery(root, { items: ITEMS, reducedMotion: 'force' });
    cards()[0].dispatchEvent(pev('pointerdown', 0, 0));
    window.dispatchEvent(pev('pointermove', -200, 0));
    window.dispatchEvent(pev('pointercancel', -200, 0));
    expect(h.getActiveIndex()).toBe(1);
    expect(cards()[0].classList.contains('fg-card--dragging')).toBe(false);
  });

  it('pointer moves with no grab in progress do nothing', () => {
    const h = createFolderGallery(root, { items: ITEMS, reducedMotion: 'force' });
    window.dispatchEvent(pev('pointermove', 500, 500));
    window.dispatchEvent(pev('pointerup', 500, 500));
    expect(h.getActiveIndex()).toBe(0);
  });

  it('destroy mid-flight cancels the choreography: no fg-flingend, no timers left', () => {
    vi.useFakeTimers();
    const h = createFolderGallery(root, { items: ITEMS, reducedMotion: 'off' });
    const ended = vi.fn();
    root.addEventListener('fg-flingend', ended);
    throwCard(cards()[0], -300);
    h.destroy();
    vi.advanceTimersByTime(2000);
    expect(ended).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('the full choreography ends with fg-flingend and clears its transient classes', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (fn) => setTimeout(() => fn(16), 16));
    vi.stubGlobal('cancelAnimationFrame', (id) => clearTimeout(id));
    try {
      const h = createFolderGallery(root, { items: ITEMS, reducedMotion: 'off' });
      const ended = [];
      root.addEventListener('fg-flingend', (e) => ended.push(e.detail));
      const card = cards()[0];
      throwCard(card, -300);
      expect(card.classList.contains('fg-card--flung')).toBe(true);
      vi.advanceTimersByTime(2000);
      expect(ended).toEqual([{ index: 1, direction: 'next' }]);
      ['fg-card--flung', 'fg-card--snap', 'fg-card--entering', 'fg-card--dragging'].forEach((c) =>
        expect(card.classList.contains(c)).toBe(false));
      expect(card.style.transform).toMatch(VALID_TRANSFORM);
      h.destroy();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
