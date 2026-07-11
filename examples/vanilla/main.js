import { createFolderGallery } from 'flipfolio';
import 'flipfolio/styles.css';

const gallery = createFolderGallery(document.getElementById('gallery'), {
  items: [
    { label: 'Tokyo', color: '#2a3a3a', content: '<p style="padding:1rem">Any HTML or a DOM node goes inside.</p>' },
    { label: 'Nairobi', color: '#3d2e42' },
    { label: 'São Paulo', color: '#2a2d3e' },
    { label: 'Copenhagen', color: '#3a3d2f' },
    { label: 'Mexico City', color: '#4a3030' },
  ],
  mode: 'stack',
  onSelect: (item, i) => console.log('selected', item.label, i),
});

document.getElementById('modes').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-mode]');
  if (!btn) return;
  gallery.setMode(btn.dataset.mode);
  document.querySelectorAll('#modes button').forEach((b) => b.classList.toggle('active', b === btn));
});
