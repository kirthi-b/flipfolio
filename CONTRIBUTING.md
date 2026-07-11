# Contributing

Thanks for looking at flipfolio. Issues and pull requests are welcome.

## Setup

```sh
git clone https://github.com/kirthi-b/flipfolio
cd flipfolio
npm install
```

Useful commands:

```sh
npm test          # vitest, 40 tests across core / element / react / vue
npm run check     # syntax check on the source entry points
npm run build     # tsup -> dist (ESM + CJS + types + css)
npm run serve     # static server; open /docs/index.html for the playground
```

The playground at `docs/index.html` imports straight from `src/`, so you can see changes without a build step.

## Layout

- `src/folder-gallery.js` is the core. It owns the DOM, the three layouts, navigation, and events. Everything else wraps it.
- `src/folder-gallery-element.js` is the `<folder-gallery>` custom element.
- `src/folder-gallery-react.js` and `src/folder-gallery-vue.js` are thin wrappers. They are written without JSX or SFCs on purpose, so the package builds with no framework toolchain.
- Hand-written type definitions live next to each source file and are copied into `dist` at build time. If you change an API, update the matching `.d.ts`.

## Ground rules

- Keep the core dependency-free. Framework code belongs in the wrappers.
- New options need: the core change, the element attribute, the React prop, the Vue prop, types, a test, and a row in the README API table.
- Run `npm test` before opening a PR. CI runs the same suite plus a build artifact check.
- Visual changes deserve a screenshot in the PR description. The playground is the quickest way to produce one.

## Reporting bugs

Open an issue with the browser, the mode (stack, grid, carousel), and the smallest items array that reproduces it. A playground link or short clip helps a lot.
