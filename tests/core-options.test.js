import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createFolderGallery as rawCreate } from '../src/folder-gallery.js';

const ITEMS = [
  { label: 'One', color: '#2a3a3a' },
  { label: 'Two', color: '#3d2e42' },
  { label: 'Three', color: '#2a2d3e' },
];

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
  vi.unstubAllGlobals();
});

const cards = () => [...root.querySelectorAll('.fg-card')];
const dots = () => [...root.querySelectorAll('.fg-dot')];
const txMatch = (card) => card.style.transform.match(/translate3d\(([-\d.e]+)px,([-\d.e]+)px/);

describe('option: defaultActiveIndex', () => {
  it('starts on the given index and roves tabindex to it', () => {
    const h = createFolderGallery(root, { items: ITEMS, defaultActiveIndex: 2 });
    expect(h.getActiveIndex()).toBe(2);
    expect(cards().map((c) => c.tabIndex)).toEqual([-1, -1, 0]);
    expect(cards()[2].getAttribute('aria-selected')).toBe('true');
  });

  it('clamps out-of-range and negative values', () => {
    expect(createFolderGallery(root, { items: ITEMS, defaultActiveIndex: 99 }).getActiveIndex()).toBe(2);
    expect(createFolderGallery(root, { items: ITEMS, defaultActiveIndex: -4 }).getActiveIndex()).toBe(0);
  });

  it('falls back to 0 for NaN', () => {
    expect(createFolderGallery(root, { items: ITEMS, defaultActiveIndex: NaN }).getActiveIndex()).toBe(0);
  });
});

describe('option: label', () => {
  it('defaults the listbox aria-label to "Folder gallery"', () => {
    createFolderGallery(root, { items: ITEMS });
    expect(root.querySelector('.fg-scene').getAttribute('aria-label')).toBe('Folder gallery');
  });

  it('uses a custom label', () => {
    createFolderGallery(root, { items: ITEMS, label: 'Projects' });
    expect(root.querySelector('.fg-scene').getAttribute('aria-label')).toBe('Projects');
  });
});

describe('option: scrollNav', () => {
  const wheel = (dy) => new WheelEvent('wheel', { deltaY: dy, bubbles: true, cancelable: true });

  it('scrollNav: false leaves the wheel alone (no navigation, no preventDefault)', () => {
    const h = createFolderGallery(root, { items: ITEMS, scrollNav: false });
    const ev = wheel(120);
    root.dispatchEvent(ev);
    expect(h.getActiveIndex()).toBe(0);
    expect(ev.defaultPrevented).toBe(false);
  });

  it('default (true) takes the wheel and prevents page scroll', () => {
    createFolderGallery(root, { items: ITEMS });
    const ev = wheel(5);
    root.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('is ignored in grid mode so the page can scroll', () => {
    const h = createFolderGallery(root, { items: ITEMS, mode: 'grid' });
    const ev = wheel(120);
    root.dispatchEvent(ev);
    expect(h.getActiveIndex()).toBe(0);
    expect(ev.defaultPrevented).toBe(false);
  });

  it('with loop off, lets the wheel through at either end', () => {
    const h = createFolderGallery(root, { items: ITEMS, loop: false });
    const up = wheel(-120);
    root.dispatchEvent(up);
    expect(up.defaultPrevented).toBe(false);
    h.goTo(2);
    const down = wheel(120);
    root.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(false);
    expect(h.getActiveIndex()).toBe(2);
  });

  it('accumulates small deltas until the threshold', () => {
    const h = createFolderGallery(root, { items: ITEMS });
    root.dispatchEvent(wheel(10));
    root.dispatchEvent(wheel(10));
    expect(h.getActiveIndex()).toBe(0);
    root.dispatchEvent(wheel(15));
    expect(h.getActiveIndex()).toBe(1);
  });

  it('scrolling up goes to the previous folder', () => {
    const h = createFolderGallery(root, { items: ITEMS, defaultActiveIndex: 1 });
    root.dispatchEvent(wheel(-60));
    expect(h.getActiveIndex()).toBe(0);
  });
});

describe('option: reducedMotion', () => {
  const behindTilt = () => cards()[1].style.transform.match(/rotateX\(([-\d.]+)deg\)/)[1];

  function stubMatchMedia(matches) {
    const listeners = new Set();
    const mql = {
      matches,
      addEventListener: (_t, fn) => listeners.add(fn),
      removeEventListener: (_t, fn) => listeners.delete(fn),
    };
    vi.stubGlobal('matchMedia', vi.fn(() => mql));
    return { mql, listeners, fire: (m) => { mql.matches = m; listeners.forEach((fn) => fn({ matches: m })); } };
  }

  it('"off" keeps the stack tilt', () => {
    createFolderGallery(root, { items: ITEMS, reducedMotion: 'off' });
    expect(Number(behindTilt())).toBeLessThan(0);
  });

  it('"force" drops the stack tilt', () => {
    createFolderGallery(root, { items: ITEMS, reducedMotion: 'force' });
    expect(Number(behindTilt())).toBe(0);
  });

  it('"auto" follows prefers-reduced-motion, and live changes re-sync the layout', () => {
    const mm = stubMatchMedia(true);
    createFolderGallery(root, { items: ITEMS });
    expect(mm.listeners.size).toBe(1);
    expect(Number(behindTilt())).toBe(0);
    mm.fire(false);
    expect(Number(behindTilt())).toBeLessThan(0);
  });

  it('"auto" detaches the media-query listener on destroy', () => {
    const mm = stubMatchMedia(false);
    const h = createFolderGallery(root, { items: ITEMS });
    h.destroy();
    expect(mm.listeners.size).toBe(0);
  });

  it('only "auto" consults matchMedia', () => {
    const mm = stubMatchMedia(true);
    createFolderGallery(root, { items: ITEMS, reducedMotion: 'off' });
    expect(globalThis.matchMedia).not.toHaveBeenCalled();
    expect(mm.listeners.size).toBe(0);
  });
});

describe('option: folderPath', () => {
  it('paints a custom path string on every card', () => {
    createFolderGallery(root, { items: ITEMS, folderPath: 'M0 0 L10 10 Z' });
    const ds = [...root.querySelectorAll('.fg-folder path')].map((p) => p.getAttribute('d'));
    expect(ds).toEqual(['M0 0 L10 10 Z', 'M0 0 L10 10 Z', 'M0 0 L10 10 Z']);
  });

  it('keeps the 480x342 viewBox and hides the svg from AT', () => {
    createFolderGallery(root, { items: ITEMS });
    const svg = root.querySelector('.fg-folder');
    expect(svg.getAttribute('viewBox')).toBe('0 0 480 342');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('option: grid { columns, gap }', () => {
  const five = [...ITEMS, { label: 'Four' }, { label: 'Five' }];
  const left = (c) => Number(txMatch(c)[1]);
  const top = (c) => Number(txMatch(c)[2]);

  it('default: 2 columns for four or fewer items, 3 for more', () => {
    createFolderGallery(root, { items: ITEMS.concat({ label: 'Four' }), mode: 'grid' });
    let cs = cards();
    expect(top(cs[1])).toBe(top(cs[0]));
    expect(top(cs[2])).toBeGreaterThan(top(cs[0]));
    createFolderGallery(root, { items: five, mode: 'grid' });
    cs = cards();
    expect(top(cs[2])).toBe(top(cs[0]));
    expect(top(cs[3])).toBeGreaterThan(top(cs[0]));
  });

  it('columns pins the column count', () => {
    createFolderGallery(root, { items: five, mode: 'grid', grid: { columns: 1 } });
    const cs = cards();
    expect(new Set(cs.map(left)).size).toBe(1);
    expect(top(cs[1])).toBeGreaterThan(top(cs[0]));
  });

  it('gap sets the spacing between cells (px)', () => {
    createFolderGallery(root, { items: five, mode: 'grid', grid: { columns: 3, gap: 40 } });
    const cs = cards();
    const cellW = parseFloat(cs[0].style.width);
    expect(left(cs[1]) - left(cs[0])).toBeCloseTo(cellW + 40, 3);
    createFolderGallery(root, { items: five, mode: 'grid', grid: { columns: 3, gap: 0 } });
    const cs0 = cards();
    expect(left(cs0[1]) - left(cs0[0])).toBeCloseTo(parseFloat(cs0[0].style.width), 3);
  });

  it('centers a short last row', () => {
    createFolderGallery(root, { items: five, mode: 'grid', grid: { columns: 3 } });
    const cs = cards();
    // two cards in the last row sit inside the first row's span, centered
    const mid = (left(cs[3]) + left(cs[4]) + parseFloat(cs[4].style.width)) / 2;
    const rowMid = (left(cs[0]) + left(cs[2]) + parseFloat(cs[2].style.width)) / 2;
    expect(mid).toBeCloseTo(rowMid, 3);
  });

  it('sizes the scene height to the rows', () => {
    createFolderGallery(root, { items: five, mode: 'grid', grid: { columns: 3, gap: 10 } });
    const cellH = (parseFloat(cards()[0].style.width)) * (2 / 3);
    expect(parseFloat(root.querySelector('.fg-scene').style.height)).toBeCloseTo(2 * cellH + 10, 3);
  });
});

describe('option: mode', () => {
  it('falls back to stack for an unknown mode', () => {
    const h = createFolderGallery(root, { items: ITEMS, mode: 'shelf' });
    expect(h.getMode()).toBe('stack');
    expect(root.getAttribute('data-fg-mode')).toBe('stack');
  });

  it.each(['stack', 'grid', 'carousel'])('starts in %s', (m) => {
    const h = createFolderGallery(root, { items: ITEMS, mode: m });
    expect(h.getMode()).toBe(m);
    expect(root.getAttribute('data-fg-mode')).toBe(m);
  });
});

describe('option: drag (invalid value)', () => {
  it('reflects "fling" for an unknown value', () => {
    createFolderGallery(root, { items: ITEMS, drag: 'wild' });
    expect(root.getAttribute('data-fg-drag')).toBe('fling');
  });
});

describe('option: onSelect', () => {
  it('is called with (item, index) when the active folder is clicked', () => {
    const onSelect = vi.fn();
    createFolderGallery(root, { items: ITEMS, onSelect, defaultActiveIndex: 1 });
    cards()[1].click();
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(ITEMS[1], 1);
  });

  it('is not called for the click that merely activates a folder', () => {
    const onSelect = vi.fn();
    createFolderGallery(root, { items: ITEMS, onSelect });
    cards()[2].click();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('a non-function onSelect is ignored but fg-select still fires', () => {
    createFolderGallery(root, { items: ITEMS, onSelect: 'nope' });
    const seen = [];
    root.addEventListener('fg-select', (e) => seen.push(e.detail.index));
    expect(() => cards()[0].click()).not.toThrow();
    expect(seen).toEqual([0]);
  });

  it('fg-select detail carries the original item (extra data passes through)', () => {
    const items = [{ label: 'A', id: 'a-1' }, { label: 'B', id: 'b-2' }];
    createFolderGallery(root, { items });
    let detail;
    root.addEventListener('fg-select', (e) => { detail = e.detail; });
    cards()[0].click();
    expect(detail.item).toBe(items[0]);
    expect(detail.item.id).toBe('a-1');
  });
});

describe('option: contentRenderer', () => {
  it('is called per card with (card, item, index)', () => {
    const calls = [];
    createFolderGallery(root, { items: ITEMS, contentRenderer: (card, item, i) => calls.push([card.className, item.label, i]) });
    expect(calls).toEqual([['fg-card', 'One', 0], ['fg-card', 'Two', 1], ['fg-card', 'Three', 2]]);
  });

  it('a non-function contentRenderer falls back to the built-in renderer', () => {
    createFolderGallery(root, { items: [{ label: 'x', content: '<b>hi</b>' }], contentRenderer: 'nope' });
    expect(root.querySelector('.fg-content b').textContent).toBe('hi');
  });
});

describe('item content (built-in renderer)', () => {
  it('src renders a lazy image with the label as alt', () => {
    createFolderGallery(root, { items: [{ label: 'Pic', src: '/a.jpg' }] });
    const img = root.querySelector('.fg-content img.fg-image');
    expect(img.getAttribute('src')).toBe('/a.jpg');
    expect(img.alt).toBe('Pic');
    expect(img.loading).toBe('lazy');
  });

  it('content accepts a DOM node', () => {
    const node = document.createElement('p');
    node.textContent = 'node body';
    createFolderGallery(root, { items: [{ label: 'n', content: node }] });
    expect(root.querySelector('.fg-content p')).toBe(node);
  });

  it('content wins over src', () => {
    createFolderGallery(root, { items: [{ label: 'n', content: '<i>c</i>', src: '/a.jpg' }] });
    expect(root.querySelector('.fg-content i')).toBeTruthy();
    expect(root.querySelector('.fg-image')).toBeNull();
  });

  it('an item with neither still gets an empty content wrapper', () => {
    createFolderGallery(root, { items: [{ label: 'bare' }] });
    const wrap = root.querySelector('.fg-content');
    expect(wrap).toBeTruthy();
    expect(wrap.childNodes.length).toBe(0);
  });
});

describe('items: labels and fallbacks', () => {
  it('unlabeled items get positional aria-labels, no label element, and numbered dots', () => {
    createFolderGallery(root, { items: [{ color: '#111111' }, { label: 'Named' }] });
    expect(cards().map((c) => c.getAttribute('aria-label'))).toEqual(['Item 1', 'Named']);
    expect(root.querySelectorAll('.fg-label').length).toBe(1);
    expect(dots().map((d) => d.getAttribute('aria-label'))).toEqual(['Go to 1', 'Named']);
  });

  it('the label is set as text, never parsed as HTML', () => {
    createFolderGallery(root, { items: [{ label: '<img src=x onerror=alert(1)>' }] });
    expect(root.querySelector('.fg-label img')).toBeNull();
    expect(root.querySelector('.fg-label').textContent).toBe('<img src=x onerror=alert(1)>');
  });
});

describe('error paths: invalid container', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a selector string', '#gallery'],
    ['a text node', () => document.createTextNode('x')],
    ['a plain object', {}],
    ['a document', () => document],
  ])('throws a clear error for %s', (_name, v) => {
    const arg = typeof v === 'function' ? v() : v;
    expect(() => createFolderGallery(arg, { items: ITEMS })).toThrow('a root element is required');
  });

  it('throws before touching anything', () => {
    expect(() => createFolderGallery(null, { items: ITEMS })).toThrow();
    expect(document.body.querySelectorAll('.fg-root, .fg-scene').length).toBe(0);
  });

  it('works with a detached element', () => {
    const el = document.createElement('div');
    const h = createFolderGallery(el, { items: ITEMS });
    expect(el.querySelectorAll('.fg-card').length).toBe(3);
    h.destroy();
  });
});

describe('error paths: empty and invalid items', () => {
  it.each([
    ['[]', []],
    ['undefined', undefined],
    ['null', null],
    ['a string', 'abc'],
    ['an object', { length: 2 }],
  ])('items: %s builds an empty gallery', (_n, items) => {
    const h = createFolderGallery(root, { items });
    expect(root.classList.contains('fg-root')).toBe(true);
    expect(root.querySelectorAll('.fg-card').length).toBe(0);
    expect(root.querySelectorAll('.fg-dot').length).toBe(0);
    expect(h.getActiveIndex()).toBe(-1);
    expect(h.getItems()).toEqual([]);
  });

  it('an empty gallery has no tabbable card and ignores keys, wheel and clicks', () => {
    const h = createFolderGallery(root, { items: [] });
    const scene = root.querySelector('.fg-scene');
    expect(() => {
      scene.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      root.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }));
      scene.click();
    }).not.toThrow();
    expect(h.getActiveIndex()).toBe(-1);
  });

  it('an empty gallery still reports mode and peek, and destroy cleans the root', () => {
    const h = createFolderGallery(root, { items: [], mode: 'grid', peek: 'always' });
    expect(h.getMode()).toBe('grid');
    expect(h.getPeek()).toBe('always');
    h.destroy();
    expect(root.classList.contains('fg-root')).toBe(false);
    expect(root.childNodes.length).toBe(0);
  });

  it('an empty gallery re-initialised with items replaces the old one', () => {
    createFolderGallery(root, { items: [] });
    createFolderGallery(root, { items: ITEMS });
    expect(root.querySelectorAll('.fg-scene').length).toBe(1);
    expect(root.querySelectorAll('.fg-card').length).toBe(3);
  });

  it('a single item: navigation is a quiet no-op and the lone folder stays active', () => {
    const h = createFolderGallery(root, { items: [{ label: 'Solo' }] });
    const seen = [];
    root.addEventListener('fg-activechange', () => seen.push(1));
    h.next(); h.prev(); h.goTo(5);
    expect(h.getActiveIndex()).toBe(0);
    expect(seen).toEqual([]);
    ['grid', 'carousel', 'stack'].forEach((m) => {
      h.setMode(m);
      expect(cards()[0].style.transform).toMatch(VALID_TRANSFORM);
    });
  });

  it('two items: carousel and stack layouts never produce NaN', () => {
    const h = createFolderGallery(root, { items: ITEMS.slice(0, 2), mode: 'carousel' });
    h.next();
    h.setMode('stack');
    h.setMode('grid');
    cards().forEach((c) => expect(c.style.transform).toMatch(VALID_TRANSFORM));
  });
});

describe('error paths: invalid option values', () => {
  it('invalid peek values fall back to hover', () => {
    createFolderGallery(root, { items: ITEMS, peek: 'sometimes' });
    expect(root.getAttribute('data-fg-peek')).toBe('hover');
  });

  it('setPeek and setMode reject unknown values without emitting', () => {
    const h = createFolderGallery(root, { items: ITEMS });
    const seen = [];
    root.addEventListener('fg-peekchange', () => seen.push('peek'));
    root.addEventListener('fg-modechange', () => seen.push('mode'));
    h.setPeek('nope'); h.setPeek(undefined); h.setPeek('hover');
    h.setMode('nope'); h.setMode(undefined); h.setMode('stack');
    expect(seen).toEqual([]);
    expect(h.getPeek()).toBe('hover');
    expect(h.getMode()).toBe('stack');
  });

  it('a fractional defaultActiveIndex is truncated', () => {
    expect(createFolderGallery(root, { items: ITEMS, defaultActiveIndex: 1.9 }).getActiveIndex()).toBe(1);
  });

  it('goTo accepts numeric strings and truncates fractions', () => {
    const h = createFolderGallery(root, { items: ITEMS });
    h.goTo('2');
    expect(h.getActiveIndex()).toBe(2);
    h.goTo(0.9);
    expect(h.getActiveIndex()).toBe(0);
  });

  it('goTo wraps far out-of-range and negative indices when looping', () => {
    const h = createFolderGallery(root, { items: ITEMS });
    h.goTo(-1);
    expect(h.getActiveIndex()).toBe(2);
    h.goTo(7);
    expect(h.getActiveIndex()).toBe(1);
  });

  it('goTo clamps far out-of-range indices when not looping', () => {
    const h = createFolderGallery(root, { items: ITEMS, loop: false });
    h.goTo(99);
    expect(h.getActiveIndex()).toBe(2);
    h.goTo(-99);
    expect(h.getActiveIndex()).toBe(0);
  });

  it('getColor/getGradient/setColor/setGradient tolerate bad indices', () => {
    const h = createFolderGallery(root, { items: ITEMS });
    [-1, 99, NaN, undefined, 'x'].forEach((i) => {
      expect(h.getColor(i)).toBeUndefined();
      expect(h.getGradient(i)).toBeUndefined();
      expect(() => { h.setColor(i, '#fff'); h.setGradient(i, 'linear-gradient(red, blue)'); }).not.toThrow();
    });
  });

  it('setColor with a non-string color is a no-op', () => {
    const h = createFolderGallery(root, { items: ITEMS });
    const before = h.getColor(0);
    [undefined, null, 42, {}].forEach((bad) => expect(() => h.setColor(0, bad)).not.toThrow());
    expect(h.getColor(0)).toBe(before);
  });

  it('a malformed item.color never paints NaN', () => {
    createFolderGallery(root, { items: [{ label: 'x', color: 'banana' }] });
    const card = cards()[0];
    expect(card.getAttribute('style') || '').not.toContain('NaN');
    expect(card.style.getPropertyValue('--fg-folder-bg')).toBe('');
  });

  it('odd-but-numeric grid values still lay out valid transforms and sizes', () => {
    [{ columns: -3 }, { columns: 0 }, { columns: '3' }, { gap: 'x' }, { gap: -10 }, null, 'nope'].forEach((grid) => {
      createFolderGallery(root, { items: [...ITEMS, ...ITEMS], mode: 'grid', grid });
      cards().forEach((c) => {
        expect(c.style.transform).toMatch(VALID_TRANSFORM);
        expect(c.style.width).toMatch(/^[\d.]+px$/);
      });
      expect(root.querySelector('.fg-scene').style.height).toMatch(/^[\d.]+px$/);
    });
  });
});

describe('resize', () => {
  it('re-lays out after the 150ms debounce, once', () => {
    vi.useFakeTimers();
    const h = createFolderGallery(root, { items: ITEMS, mode: 'grid' });
    const scene = root.querySelector('.fg-scene');
    scene.style.height = '1px';
    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('resize'));
    vi.advanceTimersByTime(100);
    expect(scene.style.height).toBe('1px');
    vi.advanceTimersByTime(60);
    expect(scene.style.height).not.toBe('1px');
    h.destroy();
  });

  it('destroy cancels a pending resize layout', () => {
    vi.useFakeTimers();
    const h = createFolderGallery(root, { items: ITEMS, mode: 'grid' });
    window.dispatchEvent(new Event('resize'));
    h.destroy();
    expect(() => vi.advanceTimersByTime(500)).not.toThrow();
    expect(root.childNodes.length).toBe(0);
  });
});
