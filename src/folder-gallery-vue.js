/* ============================================================================
 * flipfolio/vue - thin Vue 3 wrapper over the framework-agnostic core.
 *
 *   import { FolderGallery } from 'flipfolio/vue';
 *   import 'flipfolio/styles.css';
 *
 *   <FolderGallery
 *     :items="items"
 *     mode="stack"
 *     @select="(item, i) => ..."
 *     ref="gallery"            // -> { next, prev, goTo, setMode, setPeek, getActiveIndex, getMode }
 *   />
 *
 * Written as a plain render function (no SFC / template compilation) so the
 * package builds with no Vue toolchain; vue is an optional peer dependency,
 * resolved only in the consumer's app. class/style/id fall through to the
 * root <div> via Vue's normal attribute inheritance.
 * ========================================================================== */

import { defineComponent, h, ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { createFolderGallery } from './folder-gallery.js';

export const FolderGallery = defineComponent({
  name: 'FolderGallery',
  props: {
    items: { type: Array, default: () => [] },
    mode: { type: String, default: 'stack' },
    peek: { type: String, default: 'hover' },
    drag: { type: String, default: 'fling' },
    contentRenderer: { type: Function, default: undefined },
    folderPath: { type: String, default: undefined },
    // No `type: Boolean` on purpose: a Boolean prop that is absent casts to
    // false, which would silently flip the core's loop/scrollNav defaults
    // (both true) to off. Left untyped, an unpassed prop stays undefined and
    // the core keeps its default; `:loop="false"` still turns it off.
    loop: { default: undefined },
    scrollNav: { default: undefined },
    reducedMotion: { type: String, default: undefined },
    defaultActiveIndex: { type: Number, default: undefined },
    label: { type: String, default: undefined },
  },
  // emit('select', ...) dispatches to the current @select handler, so there is
  // no stale-closure problem the React wrapper has to work around with refs.
  emits: ['select', 'active-change', 'mode-change', 'peek-change', 'fling-start', 'fling-end'],
  setup(props, { emit, expose }) {
    const rootRef = ref(null);
    let handle = null;

    function onActive(e) { emit('active-change', e.detail.index, e.detail.item); }
    function onModeEv(e) { emit('mode-change', e.detail.mode); }
    function onPeekEv(e) { emit('peek-change', e.detail.peek); }
    function onFlingStartEv(e) { emit('fling-start', e.detail.index, e.detail.direction); }
    function onFlingEndEv(e) { emit('fling-end', e.detail.index, e.detail.direction); }

    function build() {
      const root = rootRef.value;
      if (!root) return;
      handle = createFolderGallery(root, {
        items: props.items,
        mode: props.mode,
        peek: props.peek,
        drag: props.drag,
        folderPath: props.folderPath,
        loop: props.loop,
        scrollNav: props.scrollNav,
        reducedMotion: props.reducedMotion,
        defaultActiveIndex: props.defaultActiveIndex,
        label: props.label,
        // Read props.contentRenderer at call time so a swapped renderer is
        // picked up on the next (structural) rebuild without a stale ref.
        contentRenderer: props.contentRenderer
          ? (card, item, i) => props.contentRenderer(card, item, i)
          : undefined,
        onSelect: (item, i) => emit('select', item, i),
      });
      root.addEventListener('fg-activechange', onActive);
      root.addEventListener('fg-modechange', onModeEv);
      root.addEventListener('fg-peekchange', onPeekEv);
      root.addEventListener('fg-flingstart', onFlingStartEv);
      root.addEventListener('fg-flingend', onFlingEndEv);
    }

    function teardown() {
      const root = rootRef.value;
      if (root) {
        root.removeEventListener('fg-activechange', onActive);
        root.removeEventListener('fg-modechange', onModeEv);
        root.removeEventListener('fg-peekchange', onPeekEv);
        root.removeEventListener('fg-flingstart', onFlingStartEv);
        root.removeEventListener('fg-flingend', onFlingEndEv);
      }
      if (handle) { handle.destroy(); handle = null; }
    }

    onMounted(build);
    onBeforeUnmount(teardown);

    // Structural inputs rebuild; mode and peek reuse the live instance.
    watch(
      [
        () => props.items,
        () => props.drag,
        () => props.folderPath,
        () => props.loop,
        () => props.scrollNav,
        () => props.reducedMotion,
        () => props.defaultActiveIndex,
        () => props.label,
      ],
      () => { teardown(); build(); },
    );
    watch(() => props.mode, (m) => { if (handle && handle.getMode() !== m) handle.setMode(m); });
    watch(() => props.peek, (p) => { if (handle) handle.setPeek(p); });

    expose({
      next: () => handle && handle.next(),
      prev: () => handle && handle.prev(),
      goTo: (i) => handle && handle.goTo(i),
      setMode: (m) => handle && handle.setMode(m),
      setPeek: (p) => handle && handle.setPeek(p),
      setColor: (i, hex) => handle && handle.setColor(i, hex),
      setGradient: (i, gradient) => handle && handle.setGradient(i, gradient),
      getActiveIndex: () => (handle ? handle.getActiveIndex() : -1),
      getMode: () => (handle ? handle.getMode() : props.mode),
      getPeek: () => (handle ? handle.getPeek() : props.peek),
      getColor: (i) => (handle ? handle.getColor(i) : undefined),
      getGradient: (i) => (handle ? handle.getGradient(i) : undefined),
      getItems: () => (handle ? handle.getItems() : []),
    });

    return () => h('div', { ref: rootRef });
  },
});

export default FolderGallery;
