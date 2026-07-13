import type { DefineComponent } from 'vue';
import type { FolderItem, GalleryMode, PeekMode, DragMode, FolderGalleryOptions, FolderGalleryHandle } from './index';

export interface FolderGalleryProps {
  items?: FolderItem[];
  mode?: GalleryMode;
  peek?: PeekMode;
  drag?: DragMode;
  contentRenderer?: FolderGalleryOptions['contentRenderer'];
  folderPath?: string;
  loop?: boolean | undefined;
  scrollNav?: boolean | undefined;
  reducedMotion?: 'auto' | 'off' | 'force';
  defaultActiveIndex?: number;
  label?: string;
}

export interface FolderGalleryEmits {
  (e: 'select', item: FolderItem, index: number): void;
  (e: 'active-change', index: number, item: FolderItem): void;
  (e: 'mode-change', mode: GalleryMode): void;
  (e: 'peek-change', peek: PeekMode): void;
  (e: 'fling-start', index: number, direction: 'next' | 'prev'): void;
  (e: 'fling-end', index: number, direction: 'next' | 'prev'): void;
}

/** The methods exposed via a template ref (`ref="gallery"`). */
export type FolderGalleryExpose = Pick<
  FolderGalleryHandle,
  | 'next'
  | 'prev'
  | 'goTo'
  | 'setMode'
  | 'setPeek'
  | 'setColor'
  | 'setGradient'
  | 'getActiveIndex'
  | 'getMode'
  | 'getPeek'
  | 'getColor'
  | 'getGradient'
  | 'getItems'
>;

export declare const FolderGallery: DefineComponent<
  FolderGalleryProps,
  FolderGalleryExpose,
  {},
  {},
  {},
  {},
  {},
  FolderGalleryEmits
>;
export default FolderGallery;
