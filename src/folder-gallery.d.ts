export interface FolderItem {
  /** Tab / front-panel label, also the default aria-label. */
  label?: string;
  /** Folder color (hex). Drives the tab fill + `--fg-folder-bg`. */
  color?: string;
  /** Image URL for the built-in default content renderer. */
  src?: string;
  /** Arbitrary interior content: an HTML string or a DOM node. */
  content?: string | Node;
  /** Image URL printed on the folder's front panel; back and tab keep their color. */
  decal?: string;
  /** CSS gradient painted across the front panel (e.g. `linear-gradient(...)`),
   *  over the frosted surface but under the label. */
  gradient?: string;
  /** Any extra data - passed through to onSelect. */
  [key: string]: unknown;
}

export type GalleryMode = 'stack' | 'grid' | 'carousel';
export type PeekMode = 'hover' | 'always' | 'off';
export type DragMode = 'fling' | 'off';

export interface FolderGalleryOptions {
  items?: FolderItem[];
  mode?: GalleryMode;
  /** Fills the folder interior. Overrides the built-in polaroid/image preset. */
  contentRenderer?: (card: HTMLElement, item: FolderItem, index: number) => void;
  /** Fired on click/Enter of the active folder. No built-in navigation. */
  onSelect?: (item: FolderItem, index: number) => void;
  /** SVG path `d` for the folder silhouette (viewBox `0 0 480 342`). */
  folderPath?: string;
  loop?: boolean;
  scrollNav?: boolean;
  reducedMotion?: 'auto' | 'off' | 'force';
  /** Contents sliding out of the folder: on hover (default), always, or off. */
  peek?: PeekMode;
  /** Grab the active folder and throw it to navigate (stack mode). Default 'fling'. */
  drag?: DragMode;
  defaultActiveIndex?: number;
  /** aria-label for the listbox. */
  label?: string;
}

export interface FolderGalleryHandle {
  next(): void;
  prev(): void;
  goTo(index: number): void;
  setMode(mode: GalleryMode): void;
  setPeek(peek: PeekMode): void;
  /** Recolor folder `index` from a single hex; re-derives the full palette
   *  (back, frosted + solid fronts, auto-contrast label) like build time. */
  setColor(index: number, hex: string): void;
  /** Paint (or, with a falsy value, clear) a CSS gradient on folder `index`'s front. */
  setGradient(index: number, gradient: string | null): void;
  getActiveIndex(): number;
  getMode(): GalleryMode;
  /** Removes every listener and empties the root element. */
  destroy(): void;
}

/**
 * Create a 3D folder gallery inside `root`. The gallery builds and owns its
 * own DOM; call `handle.destroy()` to tear it down.
 */
export function createFolderGallery(root: HTMLElement, options?: FolderGalleryOptions): FolderGalleryHandle;

export default createFolderGallery;
