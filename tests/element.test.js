import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { defineFolderGallery } from '../src/folder-gallery-element.js';

const ITEMS = [
  { label: 'One', color: '#2a3a3a' },
  { label: 'Two', color: '#3d2e42' },
];

// Braces matter: defineFolderGallery returns the class, and a function
// returned from a vitest hook is treated as a teardown callback (which would
// then be *called* - invoking the class constructor without `new`).
beforeAll(() => { defineFolderGallery(); });
beforeEach(() => { document.body.innerHTML = ''; });

describe('<folder-gallery> custom element', () => {
  it('registers once and tolerates repeat registration', () => {
    expect(customElements.get('folder-gallery')).toBeTruthy();
    expect(() => defineFolderGallery()).not.toThrow();
  });

  it('renders items set via property', () => {
    const el = document.createElement('folder-gallery');
    el.items = ITEMS;
    document.body.appendChild(el);
    expect(el.querySelectorAll('.fg-card').length).toBe(2);
  });

  it('parses a declarative JSON items attribute', () => {
    document.body.innerHTML =
      `<folder-gallery items='[{"label":"A"},{"label":"B"},{"label":"C"}]'></folder-gallery>`;
    const el = document.body.querySelector('folder-gallery');
    expect(el.querySelectorAll('.fg-card').length).toBe(3);
  });

  it('warns instead of silently swallowing malformed items JSON', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    document.body.innerHTML = `<folder-gallery items='not valid json'></folder-gallery>`;
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/malformed items attribute/);
    warnSpy.mockRestore();
  });

  it('mode attribute drives the core without a rebuild', () => {
    const el = document.createElement('folder-gallery');
    el.items = ITEMS;
    document.body.appendChild(el);
    el.setAttribute('mode', 'carousel');
    expect(el.getMode()).toBe('carousel');
    expect(el.getAttribute('data-fg-mode')).toBe('carousel');
  });

  it('bubbles core events and exposes the imperative API', () => {
    const el = document.createElement('folder-gallery');
    el.items = ITEMS;
    document.body.appendChild(el);
    let seen = -1;
    el.addEventListener('fg-activechange', (e) => { seen = e.detail.index; });
    el.next();
    expect(el.getActiveIndex()).toBe(1);
    expect(seen).toBe(1);
  });

  it('tears down on disconnect', () => {
    const el = document.createElement('folder-gallery');
    el.items = ITEMS;
    document.body.appendChild(el);
    expect(el.querySelectorAll('.fg-card').length).toBe(2);
    el.remove();
    expect(el.children.length).toBe(0);
  });
});

describe('peek attribute', () => {
  it('drives the core without a rebuild', () => {
    const el = document.createElement('folder-gallery');
    el.items = ITEMS;
    document.body.appendChild(el);
    const cardBefore = el.querySelector('.fg-card');
    el.setAttribute('peek', 'always');
    expect(el.getAttribute('data-fg-peek')).toBe('always');
    expect(el.querySelector('.fg-card')).toBe(cardBefore);
  });
});
