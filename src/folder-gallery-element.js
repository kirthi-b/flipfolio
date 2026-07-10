/* ============================================================================
 * <folder-gallery> - Custom Element wrapper around the framework-agnostic core.
 *
 *   import { defineFolderGallery } from 'folder-gallery/element';
 *   defineFolderGallery();               // registers <folder-gallery>
 *
 *   <folder-gallery mode="grid"></folder-gallery>
 *   el.items = [{ label, color, src }, ...];   // set items via property
 *   el.addEventListener('fg-select', e => ...); // events bubble from the core
 *
 * Uses the element itself as the light-DOM root, so the shared
 * folder-gallery.css styles it. (Shadow-DOM encapsulation is a later option.)
 * ========================================================================== */

import { createFolderGallery } from './folder-gallery.js';

const asBool = (v) => v !== null && v !== 'false';

export class FolderGalleryElement extends HTMLElement {
  static get observedAttributes() {
    return ['mode', 'peek', 'loop', 'scroll-nav', 'reduced-motion', 'default-active-index', 'label', 'folder-path'];
  }

  constructor() {
    super();
    this._handle = null;
    this._items = [];
  }

  /** Items are an array - set via property (attributes can't hold objects). */
  get items() { return this._items; }
  set items(value) {
    this._items = Array.isArray(value) ? value : [];
    if (this.isConnected) this._render();
  }

  connectedCallback() {
    // Optional declarative items via a JSON `items` attribute.
    if (!this._items.length && this.getAttribute('items')) {
      try { this._items = JSON.parse(this.getAttribute('items')); } catch (_) { /* ignore malformed */ }
    }
    this._render();
  }

  disconnectedCallback() { this._destroy(); }

  attributeChangedCallback(name, _oldValue, newValue) {
    if (!this._handle) return;
    if (name === 'mode') { this._handle.setMode(newValue); return; }
    if (name === 'peek') { this._handle.setPeek(newValue); return; }
    this._render(); // any other observed attribute → rebuild
  }

  _options() {
    const opts = { items: this._items };
    if (this.hasAttribute('mode')) opts.mode = this.getAttribute('mode');
    if (this.hasAttribute('peek')) opts.peek = this.getAttribute('peek');
    if (this.hasAttribute('loop')) opts.loop = asBool(this.getAttribute('loop'));
    if (this.hasAttribute('scroll-nav')) opts.scrollNav = asBool(this.getAttribute('scroll-nav'));
    if (this.hasAttribute('reduced-motion')) opts.reducedMotion = this.getAttribute('reduced-motion');
    if (this.hasAttribute('default-active-index')) opts.defaultActiveIndex = parseInt(this.getAttribute('default-active-index'), 10) || 0;
    if (this.hasAttribute('label')) opts.label = this.getAttribute('label');
    if (this.hasAttribute('folder-path')) opts.folderPath = this.getAttribute('folder-path');
    if (typeof this.contentRenderer === 'function') opts.contentRenderer = this.contentRenderer;
    if (typeof this.onSelect === 'function') opts.onSelect = this.onSelect;
    return opts;
  }

  _render() {
    this._destroy();
    this._handle = createFolderGallery(this, this._options());
  }
  _destroy() {
    if (this._handle) { this._handle.destroy(); this._handle = null; }
  }

  /* Imperative API - delegate to the core handle. */
  next() { this._handle && this._handle.next(); }
  prev() { this._handle && this._handle.prev(); }
  goTo(i) { this._handle && this._handle.goTo(i); }
  setMode(m) { this.setAttribute('mode', m); }
  setPeek(p) { this.setAttribute('peek', p); }
  getActiveIndex() { return this._handle ? this._handle.getActiveIndex() : -1; }
  getMode() { return this._handle ? this._handle.getMode() : (this.getAttribute('mode') || 'stack'); }
}

export function defineFolderGallery(tag = 'folder-gallery') {
  if (typeof customElements !== 'undefined' && !customElements.get(tag)) {
    customElements.define(tag, FolderGalleryElement);
  }
  return FolderGalleryElement;
}

export default FolderGalleryElement;
