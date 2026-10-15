import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseList, toIsoDate } from '../scraper/parse-list.js';

const BASE = 'https://www.iaosbnedimuysalatl.k12.tr';
const fx = (n) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');

test('toIsoDate GG.AA.YYYY -> ISO', () => {
  assert.equal(toIsoDate('14.10.2026'), '2026-10-14');
  assert.equal(toIsoDate(' 02.10.2026 '), '2026-10-02');
  assert.equal(toIsoDate('5.1.2026'), '2026-01-05');
});

test('haber listesi: 24 kayıt, 2 sayfa', () => {
  const { entries, totalPages } = parseList(fx('haberler-1.html'), BASE);
  assert.equal(entries.length, 24);
  assert.equal(totalPages, 2);
});

test('ilk haber kaydı tam olarak beklenen alanlara sahip', () => {
  const { entries } = parseList(fx('haberler-1.html'), BASE);
  assert.deepEqual(entries[0], {
    id: 'haberler/gencler-iklim-degisikligiyle-mucadele-icin-bulustu',
    type: 'haber',
    title: 'Gençler İklim Değişikliğiyle Mücadele İçin Buluştu',
    date: '2026-10-14',
    url: 'https://www.iaosbnedimuysalatl.k12.tr/haberler/gencler-iklim-degisikligiyle-mucadele-icin-bulustu',
  });
});

test('duyuru listesi: 7 kayıt, tek sayfa, type duyuru', () => {
  const { entries, totalPages } = parseList(fx('duyurular-1.html'), BASE);
  assert.equal(entries.length, 7);
  assert.equal(totalPages, 1);
  assert.equal(entries[0].type, 'duyuru');
  assert.equal(entries[0].date, '2026-10-02');
});

test('başlıktaki çift tırnak öğe metninden okunur', () => {
  const { entries } = parseList(fx('haberler-1.html'), BASE);
  const e = entries.find((x) => x.id === 'haberler/okulumuz-2025-2026-egitim-ogretim-yilina-coskuyla-merhaba-dedi');
  assert.equal(e.title, 'Okulumuz 2025-2026 Eğitim Öğretim Yılına Coşkuyla "Merhaba" Dedi');
});

test('boş HTML hata atmaz, 0 kayıt döner', () => {
  assert.deepEqual(parseList('<html></html>', BASE), { entries: [], totalPages: 1 });
});
