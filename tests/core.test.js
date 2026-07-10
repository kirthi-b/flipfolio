import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFolderGallery } from '../src/folder-gallery.js';

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
