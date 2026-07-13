/* ============================================================================
 * folder-gallery/react - thin React wrapper over the framework-agnostic core.
 *
 *   import { FolderGallery } from 'folder-gallery/react';
 *   import 'folder-gallery/styles.css';
 *
 *   <FolderGallery
 *     items={items}
 *     mode="stack"
 *     onSelect={(item, i) => ...}
 *     ref={galleryRef}          // -> { next, prev, goTo, setMode, getActiveIndex, getMode }
 *   />
 *
 * Written without JSX so the package builds with no React toolchain;
 * React is a peer dependency and only resolved in the consumer's app.
 * ========================================================================== */

import { createElement, forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { createFolderGallery } from './folder-gallery.js';

export const FolderGallery = forwardRef(function FolderGallery(props, ref) {
  const {
    items,
    mode = 'stack',
    peek = 'hover',
    drag = 'fling',
    contentRenderer,
    onSelect,
    onActiveChange,
    onModeChange,
    folderPath,
    loop,
    scrollNav,
    reducedMotion,
    defaultActiveIndex,
    label,
    className,
    style,
    ...rest
  } = props;

  const rootRef = useRef(null);
  const handleRef = useRef(null);

  // Callbacks live in refs so a new inline closure per render doesn't force a
  // full gallery rebuild (and the core never holds a stale reference).
  const callbacksRef = useRef({});
  callbacksRef.current = { onSelect, onActiveChange, onModeChange, contentRenderer };

  // (Re)build when the structural inputs change.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const handle = createFolderGallery(root, {
      items,
      mode,
      peek,
      drag,
      folderPath,
      loop,
      scrollNav,
      reducedMotion,
      defaultActiveIndex,
      label,
      contentRenderer: callbacksRef.current.contentRenderer
        ? (card, item, i) => callbacksRef.current.contentRenderer(card, item, i)
        : undefined,
      onSelect: (item, i) => {
        const fn = callbacksRef.current.onSelect;
        if (fn) fn(item, i);
      },
    });
    handleRef.current = handle;

    const onActive = (e) => {
      const fn = callbacksRef.current.onActiveChange;
      if (fn) fn(e.detail.index, e.detail.item);
    };
    const onModeEv = (e) => {
      const fn = callbacksRef.current.onModeChange;
      if (fn) fn(e.detail.mode);
    };
    root.addEventListener('fg-activechange', onActive);
    root.addEventListener('fg-modechange', onModeEv);

    return () => {
      root.removeEventListener('fg-activechange', onActive);
      root.removeEventListener('fg-modechange', onModeEv);
      handle.destroy();
      handleRef.current = null;
    };
    // mode and peek are handled by the effects below without a rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, drag, folderPath, loop, scrollNav, reducedMotion, defaultActiveIndex, label]);

  // Mode changes reuse the live instance.
  useEffect(() => {
    if (handleRef.current && handleRef.current.getMode() !== mode) {
      handleRef.current.setMode(mode);
    }
  }, [mode]);

  // Peek changes reuse the live instance too.
  useEffect(() => {
    if (handleRef.current) handleRef.current.setPeek(peek);
  }, [peek]);

  useImperativeHandle(ref, () => ({
    next: () => handleRef.current && handleRef.current.next(),
    prev: () => handleRef.current && handleRef.current.prev(),
    goTo: (i) => handleRef.current && handleRef.current.goTo(i),
    setMode: (m) => handleRef.current && handleRef.current.setMode(m),
    setPeek: (p) => handleRef.current && handleRef.current.setPeek(p),
    setColor: (i, hex) => handleRef.current && handleRef.current.setColor(i, hex),
    setGradient: (i, gradient) => handleRef.current && handleRef.current.setGradient(i, gradient),
    getActiveIndex: () => (handleRef.current ? handleRef.current.getActiveIndex() : -1),
    getMode: () => (handleRef.current ? handleRef.current.getMode() : mode),
  }), [mode]);

  return createElement('div', { ref: rootRef, className, style, ...rest });
});

export default FolderGallery;
