import type { DefineComponent } from 'vue';
import type { FolderItem, GalleryMode, PeekMode, DragMode, FolderGalleryOptions, FolderGalleryHandle } from './index';

export interface FolderGalleryProps {
  items?: FolderItem[];
  mode?: GalleryMode;
  peek?: PeekMode;
  drag?: DragMode;
  contentRenderer?: FolderGalleryOptions['contentRenderer'];
  folderPath?: string;
  loop?: boolean;
  scrollNav?: boolean;
  reducedMotion?: 'auto' | 'off' | 'force';
  defaultActiveIndex?: number;
  label?: string;
}

export interface FolderGalleryEmits {
  (e: 'select', item: FolderItem, index: number): void;
  (e: 'active-change', index: number, item: FolderItem): void;
  (e: 'mode-change', mode: GalleryMode): void;
}

/** The methods exposed via a template ref (`ref="gallery"`). */
export type FolderGalleryExpose = Pick<
  FolderGalleryHandle,
  'next' | 'prev' | 'goTo' | 'setMode' | 'setPeek' | 'getActiveIndex' | 'getMode'
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
