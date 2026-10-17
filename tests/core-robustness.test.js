import { describe, it, expect, beforeEach } from 'vitest';
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

describe('grid.columns with a non-finite value', () => {
  it.each([['abc'], [Infinity], [-Infinity], [{}]])('columns: %s falls back to the default heuristic', (columns) => {
    createFolderGallery(root, { items: [...ITEMS, ...ITEMS], mode: 'grid', grid: { columns } });
    root.querySelectorAll('.fg-card').forEach((c) => {
      // jsdom drops invalid values, so assert a well-formed value is present
      expect(c.style.transform).toMatch(/^translate3d\(-?[\d.]+(?:e[+-]?\d+)?px,/);
      expect(c.style.width).toMatch(/^[\d.]+px$/);
    });
    expect(root.querySelector('.fg-scene').style.height).toMatch(/^[\d.]+px$/);
  });
});

describe('a build that throws leaves the root untouched', () => {
  it('a throwing contentRenderer: root is clean and reusable', () => {
    const boom = () => { throw new Error('render failed'); };
    expect(() => createFolderGallery(root, { items: ITEMS, contentRenderer: boom })).toThrow('render failed');
    expect(root.classList.contains('fg-root')).toBe(false);
    expect(root.hasAttribute('data-fg-mode')).toBe(false);
    expect(root.childNodes.length).toBe(0);
    // a retry on the same root works and yields exactly one gallery
    const h = createFolderGallery(root, { items: ITEMS });
    expect(root.querySelectorAll('.fg-scene').length).toBe(1);
    expect(h.getActiveIndex()).toBe(0);
    h.destroy();
  });

  it('a null entry in items: root is clean', () => {
    expect(() => createFolderGallery(root, { items: [ITEMS[0], null] })).toThrow();
    expect(root.classList.contains('fg-root')).toBe(false);
    expect(root.childNodes.length).toBe(0);
  });

  it('a failed re-init on a live root tears the old gallery down too', () => {
    createFolderGallery(root, { items: ITEMS });
    expect(() => createFolderGallery(root, { items: [null] })).toThrow();
    expect(root.childNodes.length).toBe(0);
    expect(root.classList.contains('fg-root')).toBe(false);
  });
});
