import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createApp, h, ref, nextTick } from 'vue';
import { FolderGallery } from '../src/folder-gallery-vue.js';

const ITEMS = [
  { label: 'One', color: '#2a3a3a' },
  { label: 'Two', color: '#3d2e42' },
  { label: 'Three', color: '#2a2d3e' },
];

let container, app;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});
afterEach(() => {
  if (app) app.unmount();
  container.remove();
  app = null;
});

function mount(props = {}) {
  const galleryRef = ref(null);
  app = createApp({ render: () => h(FolderGallery, { ...props, ref: galleryRef }) });
  app.mount(container);
  return galleryRef;
}
const cards = () => [...container.querySelectorAll('.fg-card')];

describe('Vue emits', () => {
  it('mode-change fires with the mode', () => {
    const onModeChange = vi.fn();
    const g = mount({ items: ITEMS, onModeChange });
    g.value.setMode('carousel');
    expect(onModeChange).toHaveBeenCalledWith('carousel');
  });

  it('peek-change fires with the peek', () => {
    const onPeekChange = vi.fn();
    const g = mount({ items: ITEMS, onPeekChange });
    g.value.setPeek('off');
    expect(onPeekChange).toHaveBeenCalledWith('off');
  });

  it('fling-start / fling-end fire with (index, direction)', () => {
    const onFlingStart = vi.fn();
    const onFlingEnd = vi.fn();
    mount({ items: ITEMS, reducedMotion: 'force', onFlingStart, onFlingEnd });
    const PE = typeof window.PointerEvent === 'function' ? window.PointerEvent : window.MouseEvent;
    const pev = (t, x) => new PE(t, { clientX: x, clientY: 0, button: 0, bubbles: true });
    cards()[0].dispatchEvent(pev('pointerdown', 0));
    window.dispatchEvent(pev('pointermove', -200));
    window.dispatchEvent(pev('pointerup', -200));
    expect(onFlingStart).toHaveBeenCalledWith(0, 'next');
    expect(onFlingEnd).toHaveBeenCalledWith(1, 'next');
  });

  it('listeners are detached on unmount (no emit after teardown)', () => {
    const onActiveChange = vi.fn();
    const g = mount({ items: ITEMS, onActiveChange });
    const exposed = g.value;
    app.unmount();
    app = null;
    exposed.next();
    expect(onActiveChange).not.toHaveBeenCalled();
  });
});

describe('Vue props', () => {
  it('unset loop/scrollNav keep the core defaults (wrap, wheel on)', () => {
    const g = mount({ items: ITEMS });
    g.value.prev();
    expect(g.value.getActiveIndex()).toBe(2);
    const ev = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true });
    container.firstElementChild.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  it(':loop="false" and :scrollNav="false" turn them off', () => {
    const g = mount({ items: ITEMS, loop: false, scrollNav: false });
    g.value.prev();
    expect(g.value.getActiveIndex()).toBe(0);
    const ev = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true });
    container.firstElementChild.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });

  it('label, defaultActiveIndex, drag, folderPath and reducedMotion reach the core', () => {
    const g = mount({
      items: ITEMS, label: 'Mine', defaultActiveIndex: 2, drag: 'off', folderPath: 'M0 0 L2 2 Z', reducedMotion: 'force',
    });
    expect(container.querySelector('.fg-scene').getAttribute('aria-label')).toBe('Mine');
    expect(g.value.getActiveIndex()).toBe(2);
    expect(container.firstElementChild.getAttribute('data-fg-drag')).toBe('off');
    expect(container.querySelector('.fg-folder path').getAttribute('d')).toBe('M0 0 L2 2 Z');
    expect(cards()[0].style.transform).toContain('rotateX(0deg)');
  });

  it('contentRenderer prop fills the folders', () => {
    const contentRenderer = vi.fn();
    mount({ items: ITEMS, contentRenderer });
    expect(contentRenderer).toHaveBeenCalledTimes(3);
    expect(contentRenderer.mock.calls[1].slice(1)).toEqual([ITEMS[1], 1]);
  });

  it('no items renders an empty gallery', () => {
    const g = mount({});
    expect(cards()).toHaveLength(0);
    expect(g.value.getActiveIndex()).toBe(-1);
  });

  it('peek prop changes reuse the instance', async () => {
    const galleryRef = ref(null);
    const peek = ref('hover');
    app = createApp({ render: () => h(FolderGallery, { items: ITEMS, peek: peek.value, ref: galleryRef }) });
    app.mount(container);
    const before = cards()[0];
    peek.value = 'always';
    await nextTick();
    expect(galleryRef.value.getPeek()).toBe('always');
    expect(cards()[0]).toBe(before);
  });

  it('structural prop changes rebuild (new items, label)', async () => {
    const galleryRef = ref(null);
    const items = ref(ITEMS);
    const label = ref('A');
    app = createApp({ render: () => h(FolderGallery, { items: items.value, label: label.value, ref: galleryRef }) });
    app.mount(container);
    const before = cards()[0];
    items.value = ITEMS.slice(0, 2);
    await nextTick();
    expect(cards()).toHaveLength(2);
    expect(cards()[0]).not.toBe(before);
    label.value = 'B';
    await nextTick();
    expect(container.querySelector('.fg-scene').getAttribute('aria-label')).toBe('B');
  });

  it('class and id fall through to the root div', () => {
    mount({ items: ITEMS, class: 'mine', id: 'gal' });
    const root = container.firstElementChild;
    expect(root.classList.contains('mine')).toBe(true);
    expect(root.classList.contains('fg-root')).toBe(true);
    expect(root.id).toBe('gal');
  });
});

describe('Vue exposed API', () => {
  it('covers setColor/getColor, setGradient/getGradient, getItems, getPeek, goTo, prev', () => {
    const g = mount({ items: ITEMS });
    g.value.setColor(0, '#00ff00');
    expect(g.value.getColor(0)).toBe('#00ff00');
    g.value.setGradient(0, 'linear-gradient(red, blue)');
    expect(g.value.getGradient(0)).toContain('linear-gradient');
    expect(g.value.getItems()).toEqual(ITEMS);
    expect(g.value.getPeek()).toBe('hover');
    g.value.goTo(2);
    g.value.prev();
    expect(g.value.getActiveIndex()).toBe(1);
  });

  it('is inert after unmount', () => {
    const g = mount({ items: ITEMS });
    const api = g.value;
    app.unmount();
    app = null;
    expect(() => { api.next(); api.setMode('grid'); api.setPeek('off'); api.setColor(0, '#fff'); api.setGradient(0, 'red'); }).not.toThrow();
    expect(api.getActiveIndex()).toBe(-1);
    expect(api.getItems()).toEqual([]);
    expect(api.getColor(0)).toBeUndefined();
    expect(api.getGradient(0)).toBeUndefined();
  });
});
