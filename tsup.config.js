import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/folder-gallery.js',          // core
    element: 'src/folder-gallery-element.js', // <folder-gallery> web component
    react: 'src/folder-gallery-react.js',     // React wrapper (react = peer dep)
  },
  external: ['react'],
  format: ['esm', 'cjs'], // -> dist/*.js (ESM) + dist/*.cjs (CJS)
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  minify: false, // let the consumer's bundler minify
  // Hand-written types + the stylesheet ride along into dist.
  onSuccess:
    'cp src/folder-gallery.d.ts dist/index.d.ts && cp src/folder-gallery-element.d.ts dist/element.d.ts && cp src/folder-gallery-react.d.ts dist/react.d.ts && cp src/folder-gallery.css dist/folder-gallery.css',
});
