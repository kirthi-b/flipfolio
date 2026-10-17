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
