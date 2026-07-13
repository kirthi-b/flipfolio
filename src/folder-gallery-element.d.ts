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
  setColor(index: number, hex: string): void;
  setGradient(index: number, gradient: string | null): void;
  getActiveIndex(): number;
  getMode(): GalleryMode;
  getPeek(): PeekMode;
  getColor(index: number): string | undefined;
  getGradient(index: number): string | undefined;
  getItems(): FolderItem[];
}

/** Registers the <folder-gallery> custom element (default tag: 'folder-gallery'). */
export declare function defineFolderGallery(tag?: string): typeof FolderGalleryElement;

export default FolderGalleryElement;
