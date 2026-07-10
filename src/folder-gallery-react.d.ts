import type { ComponentType, CSSProperties, Ref } from 'react';
import type { FolderItem, GalleryMode, FolderGalleryOptions, FolderGalleryHandle } from './index';

export interface FolderGalleryProps {
  items: FolderItem[];
  mode?: GalleryMode;
  contentRenderer?: FolderGalleryOptions['contentRenderer'];
  onSelect?: (item: FolderItem, index: number) => void;
  onActiveChange?: (index: number, item: FolderItem) => void;
  onModeChange?: (mode: GalleryMode) => void;
  folderPath?: string;
  loop?: boolean;
  scrollNav?: boolean;
  reducedMotion?: 'auto' | 'off' | 'force';
  defaultActiveIndex?: number;
  label?: string;
  className?: string;
  style?: CSSProperties;
  ref?: Ref<FolderGalleryHandle>;
}

export declare const FolderGallery: ComponentType<FolderGalleryProps>;
export default FolderGallery;
