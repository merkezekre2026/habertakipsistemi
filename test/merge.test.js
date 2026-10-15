import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectToFetch, mergeItems } from '../scraper/merge.js';

const NOW = new Date('2026-10-15T12:00:00Z');
const daysAgo = (n) => new Date(NOW.getTime() - n * 86400000).toISOString();
const entry = (slug, date = '2026-10-01', type = 'haber') => ({
  id: `${type === 'haber' ? 'haberler' : 'duyurular'}/${slug}`,
  type,
  title: `Başlık ${slug}`,
  date,
  url: `https://x.test/${slug}`,
});
const full = { text: 'metin', excerpt: 'metin', images: ['https://x.test/a.jpg'], attachments: [] };
const empty = { text: '', excerpt: '', images: [], attachments: [] };
const item = (slug, firstSeenAt, detail = full, date = '2026-10-01') => ({
  ...entry(slug, date),
  ...detail,
  firstSeenAt,
});

test('yeni kayıt eklenir ve firstSeenAt now olur', () => {
  const e = entry('a');
  const out = mergeItems([], [e], new Map([[e.id, full]]), NOW);
  assert.equal(out.length, 1);
  assert.equal(out[0].firstSeenAt, NOW.toISOString());
  assert.equal(out[0].text, 'metin');
});

test('mevcut kaydın firstSeenAt değeri korunur, başlık/tarih listeden güncellenir', () => {
  const old = item('a', daysAgo(30));
  const e = { ...entry('a'), title: 'Yeni Başlık', date: '2026-10-05' };
  const [out] = mergeItems([old], [e], new Map(), NOW);
  assert.equal(out.firstSeenAt, daysAgo(30));
  assert.equal(out.title, 'Yeni Başlık');
  assert.equal(out.date, '2026-10-05');
  assert.equal(out.text, 'metin');
});

test('detay varsa mevcut kaydın içeriği yenilenir', () => {
  const old = item('a', daysAgo(3));
  const e = entry('a');
  const [out] = mergeItems([old], [e], new Map([[e.id, { ...full, text: 'güncel' }]]), NOW);
  assert.equal(out.text, 'güncel');
});

test('kaynaktan kalkan kayıt korunur', () => {
  const gone = item('gone', daysAgo(40));
  const e = entry('a');
  const out = mergeItems([gone], [e], new Map([[e.id, full]]), NOW);
  assert.deepEqual(out.map((i) => i.id).sort(), ['haberler/a', 'haberler/gone']);
});

test('detayı alınamayan yeni kayıt boş içerikle eklenir ve tekrar seçilir', () => {
  const e = entry('a');
  const out = mergeItems([], [e], new Map(), NOW);
  assert.equal(out[0].text, '');
  assert.deepEqual(out[0].images, []);
  const later = new Date(NOW.getTime() + 30 * 86400000);
  assert.deepEqual(selectToFetch(out, [e], later).map((x) => x.id), [e.id]);
});

test('selectToFetch: yeni, 13 günlük ve boş içerikli eski kayıt seçilir; 15 günlük dolu seçilmez', () => {
  const entries = [entry('yeni'), entry('on3'), entry('bos'), entry('eski')];
  const existing = [
    item('on3', daysAgo(13)),
    item('bos', daysAgo(60), empty),
    item('eski', daysAgo(15)),
  ];
  assert.deepEqual(
    selectToFetch(existing, entries, NOW).map((e) => e.id).sort(),
    ['haberler/bos', 'haberler/on3', 'haberler/yeni'],
  );
});

test('yalnızca ekli (görselsiz, metinsiz) eski kayıt "boş" sayılmaz', () => {
  const pdfOnly = item('pdf', daysAgo(60), { ...empty, attachments: [{ name: 'n', url: 'https://x.test/a.pdf' }] });
  assert.deepEqual(selectToFetch([pdfOnly], [entry('pdf')], NOW), []);
});

test('sıralama: date azalan, eşitse firstSeenAt azalan, sonra id', () => {
  const a = item('a', daysAgo(5), full, '2026-10-01');
  const b = item('b', daysAgo(1), full, '2026-10-01');
  const c = item('c', daysAgo(9), full, '2026-10-10');
  const out = mergeItems([a, b, c], [], new Map(), NOW);
  assert.deepEqual(out.map((i) => i.id), ['haberler/c', 'haberler/b', 'haberler/a']);
});

test('girdiler değiştirilmez', () => {
  const old = item('a', daysAgo(3));
  const snapshot = JSON.stringify(old);
  mergeItems([old], [{ ...entry('a'), title: 'X' }], new Map(), NOW);
  assert.equal(JSON.stringify(old), snapshot);
});
