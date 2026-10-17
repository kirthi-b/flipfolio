// Static server for the e2e smoke test. Serves examples/ as-is, except that
// the vanilla example (which imports the package by name and a CSS file from
// JS, so it needs a bundler) is bundled on startup against the built dist/.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const examples = path.join(root, 'examples');
const dist = path.join(root, 'dist');
const port = Number(process.env.E2E_PORT || 4173);

for (const f of ['index.js', 'folder-gallery.css']) {
  if (!fs.existsSync(path.join(dist, f))) {
    console.error(`dist/${f} is missing - run "npm run build" first`);
    process.exit(1);
  }
}

const bundle = await build({
  entryPoints: [path.join(examples, 'vanilla/main.js')],
  bundle: true,
  format: 'esm',
  write: false,
  outdir: 'out',
  alias: {
    flipfolio: path.join(dist, 'index.js'),
    'flipfolio/styles.css': path.join(dist, 'folder-gallery.css'),
  },
});
const built = Object.fromEntries(bundle.outputFiles.map((f) => [path.basename(f.path), f.text]));

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';

  const send = (body, type) => { res.writeHead(200, { 'content-type': type }); res.end(body); };
  if (rel === '/vanilla/main.js') return send(built['main.js'], TYPES['.js']);
  if (rel === '/vanilla/main.css') return send(built['main.css'], TYPES['.css']);
  if (rel === '/vanilla/index.html') {
    const html = fs.readFileSync(path.join(examples, 'vanilla/index.html'), 'utf8');
    return send(html.replace('</head>', '<link rel="stylesheet" href="./main.css">\n</head>'), TYPES['.html']);
  }

  const file = path.join(examples, rel);
  if (!file.startsWith(examples + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404); res.end('not found'); return;
  }
  send(fs.readFileSync(file), TYPES[path.extname(file)] || 'application/octet-stream');
});

server.listen(port, '127.0.0.1', () => console.log(`e2e server on http://127.0.0.1:${port}`));
