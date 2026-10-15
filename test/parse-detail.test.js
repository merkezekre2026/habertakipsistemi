import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseDetail, makeExcerpt } from '../scraper/parse-detail.js';

const BASE = 'https://www.iaosbnedimuysalatl.k12.tr';
const U = `${BASE}/Uploads/`;
const fx = (n) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');

test('çok görselli haber: metin ve 7 mutlak, tekrarsız görsel', () => {
  const d = parseDetail(fx('haber-detay-cok-gorsel.html'), BASE);
  assert.ok(d.text.startsWith('Millî Eğitim Bakanımız Sayın Yusuf Tekin'));
  assert.ok(!/\n{4,}/.test(d.text), 'art arda 3 boş satırdan fazlası yok');
  assert.ok(!d.text.includes('<'), 'etiket kalıntısı yok');
  assert.deepEqual(d.images, [
    `${U}whatsapp-image-2026-10-09-at-234347-1-1.jpeg`,
    `${U}whatsapp-image-2026-10-09-at-234346-3-1.jpeg`,
    `${U}dsc_2671-1.JPG`,
    `${U}dsc_2677-1.JPG`,
    `${U}eda-1.jpeg`,
    `${U}edaab-2.jpg`,
    `${U}gencler-iklim-degisikligiyle-mucadele-icin-bulustu-2.JPG`,
  ]);
  assert.deepEqual(d.attachments, []);
});

test('yalnızca PDF eki olan duyuru: görsel yok, ek var', () => {
  const d = parseDetail(fx('duyuru-detay-pdf.html'), BASE);
  assert.deepEqual(d.images, []);
  assert.deepEqual(d.attachments, [
    { name: 'Okulumuzun İç Tüzüğüne ulaşmak için tıklayınız.', url: `${U}ic-tuzuk-2026.pdf` },
  ]);
});

test('boşluklu/Türkçe karakterli, protokolsüz ve göreli görsel adresleri mutlaklaşır', () => {
  const html = `<article><h2>x</h2><p>Metin
    <img src="/Uploads/Bir Resim ş.JPG"><img src="//cdn.example.com/x.jpg"><img src="Uploads/y.png">
    <img src="/Uploads/Bir Resim ş.JPG"></p></article>`;
  const d = parseDetail(html, BASE);
  assert.deepEqual(d.images, [
    `${U}Bir%20Resim%20%C5%9F.JPG`,
    'https://cdn.example.com/x.jpg',
    `${U}y.png`,
  ]);
});

test('site görselleri (static, diller, banner, anasayfa) hariç tutulur', () => {
  const html = `<article><p>m<img src="/static/img/a.png"><img src="/Uploads/diller/l.png">
    <img src="/Uploads/banner/b.jpg"><img src="/Uploads/anasayfa/e.png"><img src="/Uploads/ok.jpg"></p></article>`;
  assert.deepEqual(parseDetail(html, BASE).images, [`${U}ok.jpg`]);
});

test('script/style içeriği metne girmez; br satır sonu olur', () => {
  const html = `<article><h2>Baş</h2><p>Bir<br>İki<script>evil()</script><style>.a{}</style></p><em>1 Ocak 2026</em></article>`;
  const d = parseDetail(html, BASE);
  assert.equal(d.text, 'Bir\nİki');
});

test('article yoksa boş detay döner', () => {
  assert.deepEqual(parseDetail('<html></html>', BASE), { text: '', excerpt: '', images: [], attachments: [] });
});

test('makeExcerpt: kısa metin aynen, uzun metin kelime sınırında kesilir', () => {
  assert.equal(makeExcerpt('kısa metin'), 'kısa metin');
  const long = 'kelime '.repeat(100).trim();
  const ex = makeExcerpt(long);
  assert.ok(ex.endsWith('…'));
  assert.ok(ex.length <= 201);
  assert.ok(!ex.slice(0, -1).endsWith(' ') && /kelime…$/.test(ex));
});
