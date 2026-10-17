import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { defineFolderGallery, FolderGalleryElement } from '../src/folder-gallery-element.js';

const ITEMS = [
  { label: 'One', color: '#2a3a3a' },
  { label: 'Two', color: '#3d2e42' },
  { label: 'Three', color: '#2a2d3e' },
];

beforeAll(() => { defineFolderGallery(); });
beforeEach(() => { document.body.innerHTML = ''; });

function make(attrs = {}, items = ITEMS) {
  const el = document.createElement('folder-gallery');
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  if (items) el.items = items;
  document.body.appendChild(el);
  return el;
}

describe('observed attributes', () => {
  it('lists exactly the documented attributes', () => {
    expect(FolderGalleryElement.observedAttributes).toEqual([
      'mode', 'peek', 'drag', 'loop', 'scroll-nav', 'reduced-motion', 'default-active-index', 'label', 'folder-path',
    ]);
  });
});

describe('initial attribute -> option mapping', () => {
  it('mode', () => {
    expect(make({ mode: 'carousel' }).getMode()).toBe('carousel');
  });

  it('peek', () => {
    expect(make({ peek: 'off' }).getPeek()).toBe('off');
  });

  it('drag', () => {
    expect(make({ drag: 'off' }).getAttribute('data-fg-drag')).toBe('off');
  });

  it('label', () => {
    const el = make({ label: 'My folders' });
    expect(el.querySelector('.fg-scene').getAttribute('aria-label')).toBe('My folders');
  });

  it('folder-path', () => {
    const el = make({ 'folder-path': 'M0 0 L9 9 Z' });
    expect(el.querySelector('.fg-folder path').getAttribute('d')).toBe('M0 0 L9 9 Z');
  });

  it('default-active-index', () => {
    expect(make({ 'default-active-index': '2' }).getActiveIndex()).toBe(2);
  });

  it('default-active-index: garbage falls back to 0', () => {
    expect(make({ 'default-active-index': 'abc' }).getActiveIndex()).toBe(0);
  });

  it('reduced-motion', () => {
    const el = make({ 'reduced-motion': 'force' });
    expect(el.querySelectorAll('.fg-card')[1].style.transform).toContain('rotateX(0deg)');
  });

  it('loop="false" clamps; bare loop and loop="true" wrap', () => {
    const clamp = make({ loop: 'false' });
    clamp.prev();
    expect(clamp.getActiveIndex()).toBe(0);
    document.body.innerHTML = '';
    const wrap = make({ loop: '' });
    wrap.prev();
    expect(wrap.getActiveIndex()).toBe(2);
    document.body.innerHTML = '';
    const wrap2 = make({ loop: 'true' });
    wrap2.prev();
    expect(wrap2.getActiveIndex()).toBe(2);
  });

  it('scroll-nav="false" ignores the wheel; default takes it', () => {
    const wheel = () => new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true });
    const off = make({ 'scroll-nav': 'false' });
    off.dispatchEvent(wheel());
    expect(off.getActiveIndex()).toBe(0);
    document.body.innerHTML = '';
    const on = make();
    on.dispatchEvent(wheel());
    expect(on.getActiveIndex()).toBe(1);
  });
});

describe('attribute changes after mount', () => {
  it.each([
    ['drag', 'off'],
    ['loop', 'false'],
    ['scroll-nav', 'false'],
    ['reduced-motion', 'force'],
    ['label', 'Renamed'],
    ['folder-path', 'M0 0 L1 1 Z'],
    ['default-active-index', '1'],
  ])('%s rebuilds the gallery with the new value', (attr, value) => {
    const el = make();
    const before = el.querySelector('.fg-card');
    el.setAttribute(attr, value);
    expect(el.querySelector('.fg-card')).not.toBe(before);
    expect(el.querySelectorAll('.fg-card').length).toBe(3);
  });

  it('default-active-index applies on rebuild', () => {
    const el = make();
    el.setAttribute('default-active-index', '2');
    expect(el.getActiveIndex()).toBe(2);
  });

  it('setMode / setPeek write the attribute and reach the core', () => {
    const el = make();
    el.setMode('grid');
    expect(el.getAttribute('mode')).toBe('grid');
    expect(el.getMode()).toBe('grid');
    el.setPeek('always');
    expect(el.getAttribute('peek')).toBe('always');
    expect(el.getPeek()).toBe('always');
  });

  it('an invalid mode attribute is ignored by the core', () => {
    const el = make({ mode: 'grid' });
    el.setAttribute('mode', 'shelf');
    expect(el.getMode()).toBe('grid');
  });

  it('mode changes emit fg-modechange', () => {
    const el = make();
    const spy = vi.fn();
    el.addEventListener('fg-modechange', spy);
    el.setAttribute('mode', 'carousel');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].detail).toEqual({ mode: 'carousel' });
  });
});

describe('items', () => {
  it('setting items after mount rebuilds', () => {
    const el = make();
    el.items = ITEMS.slice(0, 2);
    expect(el.querySelectorAll('.fg-card').length).toBe(2);
    expect(el.items).toHaveLength(2);
  });

  it('a non-array falls back to empty without throwing', () => {
    const el = make();
    expect(() => { el.items = 'nope'; }).not.toThrow();
    expect(el.items).toEqual([]);
    expect(el.querySelectorAll('.fg-card').length).toBe(0);
    expect(el.getActiveIndex()).toBe(-1);
  });

  it('a malformed JSON items attribute yields an empty gallery', () => {
    document.body.innerHTML = `<folder-gallery items='[{"label":'></folder-gallery>`;
    const el = document.body.querySelector('folder-gallery');
    expect(el.querySelectorAll('.fg-card').length).toBe(0);
    expect(el.classList.contains('fg-root')).toBe(true);
  });

  it('no items at all: methods are safe no-ops', () => {
    const el = make({}, null);
    expect(() => { el.next(); el.prev(); el.goTo(1); el.setColor(0, '#fff'); el.setGradient(0, 'red'); }).not.toThrow();
    expect(el.getItems()).toEqual([]);
    expect(el.getColor(0)).toBeUndefined();
    expect(el.getGradient(0)).toBeUndefined();
  });

  it('items set before it is connected render once on connect', () => {
    const el = document.createElement('folder-gallery');
    el.items = ITEMS;
    expect(el.querySelectorAll('.fg-card').length).toBe(0);
    document.body.appendChild(el);
    expect(el.querySelectorAll('.fg-card').length).toBe(3);
  });
});

describe('before connect / after disconnect', () => {
  it('accessors return safe defaults with no live handle', () => {
    const el = document.createElement('folder-gallery');
    expect(el.getActiveIndex()).toBe(-1);
    expect(el.getMode()).toBe('stack');
    expect(el.getPeek()).toBe('hover');
    expect(el.getItems()).toEqual([]);
    expect(() => { el.next(); el.prev(); el.goTo(0); }).not.toThrow();
  });

  it('before connect, accessors reflect attributes already set', () => {
    const el = document.createElement('folder-gallery');
    el.setAttribute('mode', 'grid');
    el.setAttribute('peek', 'off');
    expect(el.getMode()).toBe('grid');
    expect(el.getPeek()).toBe('off');
  });

  it('reconnecting renders again', () => {
    const el = make();
    el.remove();
    expect(el.querySelectorAll('.fg-card').length).toBe(0);
    document.body.appendChild(el);
    expect(el.querySelectorAll('.fg-card').length).toBe(3);
  });

  it('disconnect removes document listeners (no stray key handling)', () => {
    const el = make();
    el.dispatchEvent(new MouseEvent('mouseenter'));
    el.remove();
    const ev = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
    document.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });
});

describe('callback and renderer properties', () => {
  it('onSelect property is called on select', () => {
    const el = document.createElement('folder-gallery');
    el.items = ITEMS;
    el.onSelect = vi.fn();
    document.body.appendChild(el);
    el.querySelector('.fg-card').click();
    expect(el.onSelect).toHaveBeenCalledWith(ITEMS[0], 0);
  });

  it('contentRenderer property fills the folders', () => {
    const el = document.createElement('folder-gallery');
    el.items = ITEMS;
    el.contentRenderer = (card, item) => {
      const d = document.createElement('i');
      d.className = 'custom';
      d.textContent = item.label;
      card.appendChild(d);
    };
    document.body.appendChild(el);
    expect([...el.querySelectorAll('.custom')].map((n) => n.textContent)).toEqual(['One', 'Two', 'Three']);
    expect(el.querySelector('.fg-content')).toBeNull();
  });

  it('non-function values are ignored', () => {
    const el = document.createElement('folder-gallery');
    el.items = [{ label: 'x', content: '<b>b</b>' }];
    el.onSelect = 'nope';
    el.contentRenderer = 42;
    document.body.appendChild(el);
    expect(el.querySelector('.fg-content b')).toBeTruthy();
    expect(() => el.querySelector('.fg-card').click()).not.toThrow();
  });
});

describe('imperative API', () => {
  it('setColor/getColor and setGradient/getGradient delegate to the core', () => {
    const el = make();
    el.setColor(1, '#ff0000');
    expect(el.getColor(1)).toBe('#ff0000');
    el.setGradient(1, 'linear-gradient(red, blue)');
    expect(el.getGradient(1)).toContain('linear-gradient');
    el.setGradient(1, null);
    expect(el.getGradient(1)).toBeUndefined();
  });

  it('getItems returns the items; goTo/prev move', () => {
    const el = make();
    expect(el.getItems()).toEqual(ITEMS);
    el.goTo(2);
    expect(el.getActiveIndex()).toBe(2);
    el.prev();
    expect(el.getActiveIndex()).toBe(1);
  });
});

describe('defineFolderGallery', () => {
  it('returns the element class', () => {
    expect(defineFolderGallery()).toBe(FolderGalleryElement);
  });
});
