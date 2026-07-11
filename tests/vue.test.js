import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createApp, h, ref, nextTick } from 'vue';
import { FolderGallery } from '../src/folder-gallery-vue.js';

const ITEMS = [
  { label: 'One', color: '#2a3a3a' },
  { label: 'Two', color: '#3d2e42' },
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

/* Mount FolderGallery with the given props and return a ref to its exposed
   API (Vue surfaces expose() through a template ref on the component). */
function mount(props = {}) {
  const galleryRef = ref(null);
  app = createApp({ render: () => h(FolderGallery, { ...props, ref: galleryRef }) });
  app.mount(container);
  return galleryRef;
}

describe('<FolderGallery /> (Vue wrapper)', () => {
  it('mounts the core and renders the items', () => {
    mount({ items: ITEMS });
    expect(container.querySelectorAll('.fg-card').length).toBe(2);
    expect(container.querySelector('.fg-root')).toBeTruthy();
  });

  it('exposes the imperative API via a template ref', () => {
    const g = mount({ items: ITEMS });
    expect(g.value.getActiveIndex()).toBe(0);
    g.value.next();
    expect(g.value.getActiveIndex()).toBe(1);
  });

  it('mode prop changes reuse the instance (setMode, no rebuild)', async () => {
    const galleryRef = ref(null);
    const mode = ref('stack');
    app = createApp({ render: () => h(FolderGallery, { items: ITEMS, mode: mode.value, ref: galleryRef }) });
    app.mount(container);
    const cardBefore = container.querySelector('.fg-card');
    mode.value = 'grid';
    await nextTick();
    expect(galleryRef.value.getMode()).toBe('grid');
    expect(container.querySelector('.fg-card')).toBe(cardBefore); // same DOM node -> no rebuild
  });

  it('emits select with the item and index', () => {
    const onSelect = vi.fn();
    mount({ items: ITEMS, onSelect });
    container.querySelector('.fg-card').click();
    expect(onSelect).toHaveBeenCalledWith(ITEMS[0], 0);
  });

  it('emits active-change on navigation', () => {
    const onActiveChange = vi.fn();
    const g = mount({ items: ITEMS, onActiveChange });
    g.value.next();
    expect(onActiveChange).toHaveBeenCalledWith(1, ITEMS[1]);
  });

  it('cleans up on unmount', () => {
    mount({ items: ITEMS });
    expect(container.querySelectorAll('.fg-card').length).toBe(2);
    app.unmount();
    app = null;
    expect(container.querySelectorAll('.fg-card').length).toBe(0);
  });
});
