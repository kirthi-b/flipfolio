import type { FolderItem, GalleryMode, PeekMode, FolderGalleryOptions } from './index';

export declare class FolderGalleryElement extends HTMLElement {
  items: FolderItem[];
  contentRenderer?: FolderGalleryOptions['contentRenderer'];
  onSelect?: FolderGalleryOptions['onSelect'];
  next(): void;
  prev(): void;
  goTo(index: number): void;
  setMode(mode: GalleryMode): void;
  setPeek(peek: PeekMode): void;
  getActiveIndex(): number;
  getMode(): GalleryMode;
}

/** Registers the <folder-gallery> custom element (default tag: 'folder-gallery'). */
export declare function defineFolderGallery(tag?: string): typeof FolderGalleryElement;

export default FolderGalleryElement;
