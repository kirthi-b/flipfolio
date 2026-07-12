import { createFolderGallery } from 'flipfolio';
import 'flipfolio/styles.css';

/* City photos ride along from the repo's demo assets via CDN, so this
   example stays a two-file consumer with nothing to download. */
const PHOTOS = 'https://cdn.jsdelivr.net/gh/kirthi-b/flipfolio@master/docs/photos';

const CITIES = [
  { label: 'Tokyo', slug: 'tokyo', color: '#13303f',
    fact: 'The largest metro area on earth: about 37 million people.' },
  { label: 'Nairobi', slug: 'nairobi', color: '#75754f',
    fact: 'The only capital city with a national park inside its limits.' },
  { label: 'São Paulo', slug: 'sao-paulo', color: '#8a7259',
    fact: 'The largest Portuguese speaking city in the world.' },
  { label: 'Copenhagen', slug: 'copenhagen', color: '#4f6b7c',
    fact: 'Bikes outnumber cars in the city center.' },
  { label: 'Mexico City', slug: 'mexico-city', color: '#3d7dae',
    fact: 'Built on a drained lake bed, and still slowly sinking.' },
];

let photosOn = false;
let peekOn = false;

function buildItems() {
  return CITIES.map((c) => ({
    label: c.label,
    color: c.color,
    // Photos mode prints each city's photo on the folder's front panel.
    ...(photosOn && { decal: `${PHOTOS}/${c.slug}.jpg` }),
    // Peek gives the folder contents to slide out of the mouth on hover.
    ...(peekOn && {
      content: `<div class="fact-card"><h4>${c.label}</h4><p>${c.fact}</p></div>`,
    }),
  }));
}

const root = document.getElementById('gallery');
let gallery;

function rebuild(mode) {
  const current = gallery ? gallery.getMode() : 'stack';
  if (gallery) gallery.destroy();
  gallery = createFolderGallery(root, {
    items: buildItems(),
    mode: mode || current,
    // Hover-capable devices peek on hover, touch keeps contents out.
    peek: peekOn ? (matchMedia('(hover: hover)').matches ? 'hover' : 'always') : 'off',
    onSelect: (item, i) => console.log('selected', item.label, i),
  });
}
rebuild('stack');

document.getElementById('controls').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  if (btn.dataset.mode) {
    gallery.setMode(btn.dataset.mode);
    document.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('active', b === btn));
  }
  if (btn.id === 'photosBtn') {
    photosOn = !photosOn;
    btn.classList.toggle('active', photosOn);
    rebuild();
  }
  if (btn.id === 'peekBtn') {
    peekOn = !peekOn;
    btn.classList.toggle('active', peekOn);
    rebuild();
  }
});
