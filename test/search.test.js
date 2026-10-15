import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTr, filterItems, isNew, isStale, formatDateTr } from '../site/search.js';

const mk = (type, title, text = '') => ({ id: `${type}/${title}`, type, title, text });
const ITEMS = [
  mk('haber', 'Üniversite Tanıtım Günümüz Gerçekleşti', 'Öğrenciler katıldı'),
  mk('haber', 'Erasmus Projemizde İspanyol Ortaklarımızla İlk Adımı Attık', 'Erasmus+ ortakları İspanya ekibi'),
  mk('duyuru', 'Siberay Dijital Afiş', 'Işık ve ses'),
  mk('haber', 'Erasmus Başvuru Sonuçları Açıklandı', 'Sonuçlar yayınlandı'),
];

test('normalizeTr: Türkçe büyük/küçük harf ve aksan eşitlemesi', () => {
  assert.equal(normalizeTr('IŞIK'), normalizeTr('ışık'));
  assert.equal(normalizeTr('ışık'), normalizeTr('isik'));
  assert.equal(normalizeTr('İzmir'), 'izmir');
  assert.equal(normalizeTr('Millî Eğitim Çalıştayı'), 'milli egitim calistayi');
});

test('filterItems: Türkçe karaktersiz arama eşleşir', () => {
  const r = filterItems(ITEMS, { tab: 'tumu', query: 'universite tanitim' });
  assert.deepEqual(r.map((i) => i.title), ['Üniversite Tanıtım Günümüz Gerçekleşti']);
  assert.equal(filterItems(ITEMS, { tab: 'tumu', query: 'ISIK' }).length, 1);
});

test('filterItems: tüm terimler geçmeli (VE)', () => {
  const r = filterItems(ITEMS, { tab: 'tumu', query: 'erasmus ispanya' });
  assert.equal(r.length, 1);
  assert.ok(r[0].title.startsWith('Erasmus Projemizde'));
});

test('filterItems: sekme süzer, boş sorgu hepsini döndürür, sıra korunur', () => {
  assert.deepEqual(filterItems(ITEMS, { tab: 'duyuru', query: '' }).map((i) => i.type), ['duyuru']);
  assert.equal(filterItems(ITEMS, { tab: 'tumu', query: '   ' }).length, 4);
  assert.deepEqual(
    filterItems(ITEMS, { tab: 'haber', query: '' }).map((i) => i.title),
    [ITEMS[0].title, ITEMS[1].title, ITEMS[3].title],
  );
});

test('isNew: 72 saat sınırı', () => {
  const now = new Date('2026-10-15T12:00:00Z');
  const ago = (min) => new Date(now.getTime() - min * 60000).toISOString();
  assert.equal(isNew({ firstSeenAt: ago(71 * 60 + 59) }, now), true);
  assert.equal(isNew({ firstSeenAt: ago(72 * 60 + 1) }, now), false);
});

test('isStale: 6 saat sınırı', () => {
  const now = new Date('2026-10-15T12:00:00Z');
  const ago = (min) => new Date(now.getTime() - min * 60000).toISOString();
  assert.equal(isStale(ago(5 * 60 + 59), now), false);
  assert.equal(isStale(ago(6 * 60 + 1), now), true);
});

test('formatDateTr', () => {
  assert.equal(formatDateTr('2026-10-14'), '14 Ekim 2026');
  assert.equal(formatDateTr('2026-01-05'), '5 Ocak 2026');
});
