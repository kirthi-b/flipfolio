import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement, createRef, act } from 'react';
import { createRoot } from 'react-dom/client';
import { FolderGallery } from '../src/folder-gallery-react.js';

const ITEMS = [
  { label: 'One', color: '#2a3a3a' },
  { label: 'Two', color: '#3d2e42' },
  { label: 'Three', color: '#2a2d3e' },
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

const render = (props) => act(() => reactRoot.render(createElement(FolderGallery, props)));
const cards = () => [...container.querySelectorAll('.fg-card')];

describe('React event props', () => {
  it('onModeChange fires with the mode', () => {
    const onModeChange = vi.fn();
    const ref = createRef();
    render({ items: ITEMS, onModeChange, ref });
    act(() => ref.current.setMode('carousel'));
    expect(onModeChange).toHaveBeenCalledWith('carousel');
  });

  it('onPeekChange fires with the peek', () => {
    const onPeekChange = vi.fn();
    const ref = createRef();
    render({ items: ITEMS, onPeekChange, ref });
    act(() => ref.current.setPeek('always'));
    expect(onPeekChange).toHaveBeenCalledWith('always');
  });

  it('onFlingStart / onFlingEnd fire with (index, direction)', () => {
    const onFlingStart = vi.fn();
    const onFlingEnd = vi.fn();
    render({ items: ITEMS, reducedMotion: 'force', onFlingStart, onFlingEnd });
    const PE = typeof window.PointerEvent === 'function' ? window.PointerEvent : window.MouseEvent;
    const pev = (t, x) => new PE(t, { clientX: x, clientY: 0, button: 0, bubbles: true });
    act(() => {
      cards()[0].dispatchEvent(pev('pointerdown', 0));
      window.dispatchEvent(pev('pointermove', -200));
      window.dispatchEvent(pev('pointerup', -200));
    });
    expect(onFlingStart).toHaveBeenCalledWith(0, 'next');
    expect(onFlingEnd).toHaveBeenCalledWith(1, 'next');
  });

  it('swapped event callbacks are used without a rebuild', () => {
    const a = vi.fn();
    const b = vi.fn();
    const ref = createRef();
    render({ items: ITEMS, onActiveChange: a, ref });
    const before = cards()[0];
    render({ items: ITEMS, onActiveChange: b, ref });
    expect(cards()[0]).toBe(before);
    act(() => ref.current.next());
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledWith(1, ITEMS[1]);
  });
});

describe('React props', () => {
  it('className, style and extra DOM props land on the root div', () => {
    render({ items: ITEMS, className: 'mine', style: { width: '321px' }, id: 'gal', 'data-x': '1' });
    const root = container.firstElementChild;
    expect(root.classList.contains('mine')).toBe(true);
    expect(root.classList.contains('fg-root')).toBe(true);
    expect(root.style.width).toBe('321px');
    expect(root.id).toBe('gal');
    expect(root.getAttribute('data-x')).toBe('1');
  });

  it('label, defaultActiveIndex, loop, drag and folderPath reach the core', () => {
    const ref = createRef();
    render({ items: ITEMS, label: 'Mine', defaultActiveIndex: 2, loop: false, drag: 'off', folderPath: 'M0 0 L2 2 Z', ref });
    expect(container.querySelector('.fg-scene').getAttribute('aria-label')).toBe('Mine');
    expect(ref.current.getActiveIndex()).toBe(2);
    act(() => ref.current.next());
    expect(ref.current.getActiveIndex()).toBe(2); // loop: false clamps
    expect(container.firstElementChild.getAttribute('data-fg-drag')).toBe('off');
    expect(container.querySelector('.fg-folder path').getAttribute('d')).toBe('M0 0 L2 2 Z');
  });

  it('unset loop/scrollNav keep the core defaults (wrap, wheel on)', () => {
    const ref = createRef();
    render({ items: ITEMS, ref });
    act(() => ref.current.prev());
    expect(ref.current.getActiveIndex()).toBe(2);
    const ev = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true });
    act(() => { container.firstElementChild.dispatchEvent(ev); });
    expect(ev.defaultPrevented).toBe(true);
  });

  it('scrollNav={false} turns the wheel off', () => {
    render({ items: ITEMS, scrollNav: false });
    const ev = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true });
    container.firstElementChild.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });

  it('reducedMotion="force" flattens the stack tilt', () => {
    render({ items: ITEMS, reducedMotion: 'force' });
    expect(cards()[1].style.transform).toContain('rotateX(0deg)');
  });

  it('peek prop changes reuse the instance', () => {
    const ref = createRef();
    render({ items: ITEMS, peek: 'hover', ref });
    const before = cards()[0];
    render({ items: ITEMS, peek: 'always', ref });
    expect(ref.current.getPeek()).toBe('always');
    expect(cards()[0]).toBe(before);
  });

  it('contentRenderer prop fills the folders and sees the latest function', () => {
    const first = vi.fn();
    render({ items: ITEMS, contentRenderer: first });
    expect(first).toHaveBeenCalledTimes(3);
    expect(first).toHaveBeenCalledWith(cards()[0], ITEMS[0], 0);
  });

  it('structural prop changes rebuild (new items)', () => {
    render({ items: ITEMS });
    const before = cards()[0];
    render({ items: ITEMS.slice(0, 2) });
    expect(cards()).toHaveLength(2);
    expect(cards()[0]).not.toBe(before);
  });

  it('no items renders an empty gallery without throwing', () => {
    expect(() => render({})).not.toThrow();
    expect(cards()).toHaveLength(0);
  });
});

describe('React imperative handle', () => {
  it('covers setColor/getColor, setGradient/getGradient, getItems, getPeek, goTo, prev', () => {
    const ref = createRef();
    render({ items: ITEMS, ref });
    act(() => ref.current.setColor(0, '#00ff00'));
    expect(ref.current.getColor(0)).toBe('#00ff00');
    act(() => ref.current.setGradient(0, 'linear-gradient(red, blue)'));
    expect(ref.current.getGradient(0)).toContain('linear-gradient');
    expect(ref.current.getItems()).toEqual(ITEMS);
    expect(ref.current.getPeek()).toBe('hover');
    act(() => ref.current.goTo(2));
    act(() => ref.current.prev());
    expect(ref.current.getActiveIndex()).toBe(1);
  });

  it('is inert after unmount', () => {
    const ref = createRef();
    render({ items: ITEMS, ref });
    const handle = ref.current;
    act(() => reactRoot.unmount());
    reactRoot = createRoot(container); // so afterEach can unmount cleanly
    expect(() => { handle.next(); handle.setMode('grid'); handle.setColor(0, '#fff'); }).not.toThrow();
    expect(handle.getActiveIndex()).toBe(-1);
    expect(handle.getItems()).toEqual([]);
    expect(handle.getColor(0)).toBeUndefined();
    expect(handle.getGradient(0)).toBeUndefined();
  });
});
