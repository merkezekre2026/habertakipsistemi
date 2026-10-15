import { filterItems, isNew, isStale, formatDateTr } from './search.js';

const $ = (id) => document.getElementById(id);
const state = { items: [], tab: 'tumu', query: '' };

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) if (c != null) node.append(c);
  return node;
}

function metaRow(item, now) {
  const row = el('p', { class: 'meta' });
  row.append(el('span', { class: 'chip' }, item.type === 'haber' ? 'Haber' : 'Duyuru'));
  row.append(el('span', {}, formatDateTr(item.date)));
  if (isNew(item, now)) row.append(el('span', { class: 'new' }, 'YENİ'));
  return row;
}

function card(item, now) {
  const thumb = el('div', { class: 'thumb' });
  if (item.images.length) {
    const img = el('img', { src: item.images[0], alt: '', loading: 'lazy' });
    img.addEventListener('error', () => img.remove());
    thumb.append(img);
  } else {
    thumb.append(item.attachments.length ? '📎' : '📰');
  }
  const body = el('div', { class: 'card-body' }, metaRow(item, now), el('h3', {}, item.title));
  if (item.excerpt) body.append(el('p', { class: 'ex' }, item.excerpt));
  const btn = el('button', { class: 'card', type: 'button' }, thumb, body);
  btn.addEventListener('click', () => openDetail(item));
  return btn;
}

function openDetail(item) {
  $('d-meta').replaceChildren(...metaRow(item, new Date()).childNodes);
  $('d-title').textContent = item.title;
  $('d-text').textContent = item.text;
  $('d-files').replaceChildren(
    ...item.attachments.map((a) => el('a', { href: a.url, target: '_blank', rel: 'noopener noreferrer' }, `📎 ${a.name}`)),
  );
  $('d-gallery').replaceChildren(
    ...item.images.map((src) => {
      const img = el('img', { src, alt: '', loading: 'lazy' });
      const b = el('button', { type: 'button', 'aria-label': 'Görseli büyüt' }, img);
      img.addEventListener('error', () => b.remove());
      b.addEventListener('click', () => {
        $('lb-img').src = src;
        $('lightbox').showModal();
      });
      return b;
    }),
  );
  $('d-orig').href = item.url;
  $('detail').showModal();
}

function render() {
  const now = new Date();
  const shown = filterItems(state.items, state);
  $('list').replaceChildren(...shown.map((i) => card(i, now)));
  $('count').textContent = `${shown.length} kayıt`;
  $('empty').hidden = shown.length > 0;
}

async function load() {
  try {
    const res = await fetch('data/items.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(String(res.status));
    state.items = (await res.json()).items;
  } catch {
    $('error').hidden = false;
    return;
  }
  try {
    const res = await fetch('data/status.json', { cache: 'no-cache' });
    if (res.ok) {
      const { lastSuccessAt } = await res.json();
      const d = new Date(lastSuccessAt);
      $('updated').textContent = `Son güncelleme: ${d.toLocaleString('tr-TR', { dateStyle: 'long', timeStyle: 'short' })}`;
      $('stale').hidden = !isStale(lastSuccessAt, new Date());
    }
  } catch {
    // status.json yoksa bayat uyarısı gösterilmez
  }
  render();
}

document.querySelectorAll('.tab').forEach((b) =>
  b.addEventListener('click', () => {
    state.tab = b.dataset.tab;
    document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t === b)));
    render();
  }),
);
$('q').addEventListener('input', (e) => {
  state.query = e.target.value;
  render();
});
for (const id of ['detail', 'lightbox']) {
  $(id).addEventListener('click', (e) => {
    if (e.target === $(id)) $(id).close();
  });
}
load();
