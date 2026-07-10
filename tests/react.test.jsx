import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement, createRef, act } from 'react';
import { createRoot } from 'react-dom/client';
import { FolderGallery } from '../src/folder-gallery-react.js';

const ITEMS = [
  { label: 'One', color: '#2a3a3a' },
  { label: 'Two', color: '#3d2e42' },
];

let container, reactRoot;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  reactRoot = createRoot(container);
});
afterEach(() => {
  act(() => reactRoot.unmount());
  container.remove();
});

describe('<FolderGallery /> (React wrapper)', () => {
  it('mounts the core and renders the items', () => {
    act(() => reactRoot.render(createElement(FolderGallery, { items: ITEMS })));
    expect(container.querySelectorAll('.fg-card').length).toBe(2);
    expect(container.querySelector('.fg-root')).toBeTruthy();
  });

  it('exposes the imperative handle via ref', () => {
    const ref = createRef();
    act(() => reactRoot.render(createElement(FolderGallery, { items: ITEMS, ref })));
    expect(ref.current.getActiveIndex()).toBe(0);
    act(() => ref.current.next());
    expect(ref.current.getActiveIndex()).toBe(1);
  });

  it('mode prop changes reuse the instance (setMode, no rebuild)', () => {
    const ref = createRef();
    act(() => reactRoot.render(createElement(FolderGallery, { items: ITEMS, mode: 'stack', ref })));
    const cardBefore = container.querySelector('.fg-card');
    act(() => reactRoot.render(createElement(FolderGallery, { items: ITEMS, mode: 'grid', ref })));
    expect(ref.current.getMode()).toBe('grid');
    expect(container.querySelector('.fg-card')).toBe(cardBefore); // same DOM node → no rebuild
  });

  it('fires onSelect and onActiveChange with fresh (non-stale) callbacks', () => {
    const first = vi.fn();
    const second = vi.fn();
    act(() => reactRoot.render(createElement(FolderGallery, { items: ITEMS, onSelect: first })));
    // swap the callback without changing items — must NOT rebuild, must use the new fn
    act(() => reactRoot.render(createElement(FolderGallery, { items: ITEMS, onSelect: second })));
    act(() => { container.querySelector('.fg-card').click(); });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(ITEMS[0], 0);
  });

  it('cleans up on unmount', () => {
    act(() => reactRoot.render(createElement(FolderGallery, { items: ITEMS })));
    expect(container.querySelectorAll('.fg-card').length).toBe(2);
    act(() => reactRoot.unmount());
    expect(container.querySelectorAll('.fg-card').length).toBe(0);
  });
});
