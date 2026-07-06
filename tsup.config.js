import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/folder-gallery.js' },
  format: ['esm', 'cjs'], // -> dist/index.js (ESM) + dist/index.cjs (CJS)
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  minify: false, // let the consumer's bundler minify
  // Hand-written types + the stylesheet ride along into dist.
  onSuccess: 'cp src/folder-gallery.d.ts dist/index.d.ts && cp src/folder-gallery.css dist/folder-gallery.css',
});
