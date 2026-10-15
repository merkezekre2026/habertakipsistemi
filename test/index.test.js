import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { run } from '../scraper/index.js';
import { createFetcher } from '../scraper/fetch.js';

const BASE = 'https://www.iaosbnedimuysalatl.k12.tr';
const fx = (n) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');

function makeSite({ failing = new Set(), emptyDuyurular = false } = {}) {
  const calls = [];
  const fetchHtml = async (url) => {
    calls.push(url);
    if (failing.has(url)) throw new Error(`HTTP 500 ${url}`);
    const path = new URL(url).pathname;
    if (path === '/haberler' || path === '/haberler/2') return fx('haberler-1.html');
    if (path === '/duyurular') return emptyDuyurular ? '<html></html>' : fx('duyurular-1.html');
    if (path.startsWith('/haberler/')) return fx('haber-detay-cok-gorsel.html');
    if (path.startsWith('/duyurular/')) return fx('duyuru-detay-pdf.html');
    throw new Error(`beklenmeyen URL ${url}`);
  };
  return { fetchHtml, calls };
}

function makeStore(initial = []) {
  const store = { items: initial, writes: 0, status: null };
  return {
    store,
    readItems: async () => store.items,
    writeItems: async (items) => { store.items = items; store.writes += 1; },
    writeStatus: async (s) => { store.status = s; },
  };
}

const NOW = new Date('2026-10-15T12:00:00Z');

test('ilk çalıştırma: tüm kayıtlar tek tek eklenir, status yazılır', async () => {
  const site = makeSite();
  const s = makeStore();
  const res = await run({ fetchHtml: site.fetchHtml, ...s, now: NOW });
  const ids = s.store.items.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length, 'çift kayıt yok');
  assert.equal(ids.length, 24 + 7);
  assert.equal(res.added, 31);
  assert.equal(res.changed, true);
  assert.equal(s.store.status.lastSuccessAt, NOW.toISOString());
  assert.ok(s.store.items.every((i) => i.text || i.images.length || i.attachments.length));
});

test('değişiklik yoksa items yazılmaz ama status yazılır', async () => {
  const first = makeStore();
  await run({ fetchHtml: makeSite().fetchHtml, ...first, now: NOW });
  const later = new Date(NOW.getTime() + 30 * 86400000);
  const s = makeStore(first.store.items);
  const site = makeSite();
  const res = await run({ fetchHtml: site.fetchHtml, ...s, now: later });
  assert.equal(res.changed, false);
  assert.equal(s.store.writes, 0);
  assert.equal(s.store.status.lastSuccessAt, later.toISOString());
  assert.ok(site.calls.every((u) => /\/(haberler|duyurular)(\/2)?$/.test(u)), 'detay yeniden çekilmedi');
});

test('liste sayfası 0 kayıt dönerse run reddedilir, hiçbir şey yazılmaz', async () => {
  const s = makeStore();
  await assert.rejects(
    run({ fetchHtml: makeSite({ emptyDuyurular: true }).fetchHtml, ...s, now: NOW }),
    /duyuru/i,
  );
  assert.equal(s.store.writes, 0);
  assert.equal(s.store.status, null);
});

test('tek detay hatası kaydı boş içerikle ekler; sonraki çalıştırmada dolar', async () => {
  const badUrl = `${BASE}/haberler/gencler-iklim-degisikligiyle-mucadele-icin-bulustu`;
  const s = makeStore();
  await run({ fetchHtml: makeSite({ failing: new Set([badUrl]) }).fetchHtml, ...s, now: NOW });
  const bad = s.store.items.find((i) => i.url === badUrl);
  assert.equal(bad.text, '');
  assert.ok(s.store.items.filter((i) => i.text).length >= 30 - 1);
  await run({ fetchHtml: makeSite().fetchHtml, ...s, now: new Date(NOW.getTime() + 3600000) });
  assert.ok(s.store.items.find((i) => i.url === badUrl).text.length > 0);
});

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

test('createFetcher: 2 kez 500 sonra 200 -> metin döner', async () => {
  let n = 0;
  globalThis.fetch = async () => {
    n += 1;
    return n < 3 ? new Response('hata', { status: 500 }) : new Response('tamam', { status: 200 });
  };
  const get = createFetcher({ delayMs: 0 });
  assert.equal(await get('https://x.test/'), 'tamam');
  assert.equal(n, 3);
});

test('createFetcher: 3 kez 500 -> hata', async () => {
  globalThis.fetch = async () => new Response('hata', { status: 500 });
  await assert.rejects(createFetcher({ delayMs: 0 })('https://x.test/'), /500/);
});

test('createFetcher: User-Agent başlığı gönderilir', async () => {
  let ua;
  globalThis.fetch = async (_u, opts) => { ua = opts.headers['User-Agent']; return new Response('ok'); };
  await createFetcher({ delayMs: 0 })('https://x.test/');
  assert.match(ua, /^iaosb-haber-takip\/1\.0/);
});

test('ilk çalıştırmada firstSeenAt yayın tarihine eşitlenir (hepsi YENİ olmasın)', async () => {
  const s = makeStore();
  await run({ fetchHtml: makeSite().fetchHtml, ...s, now: NOW });
  for (const it of s.store.items) assert.equal(it.firstSeenAt, `${it.date}T00:00:00.000Z`);
});

test('sonraki çalıştırmada yeni kaydın firstSeenAt değeri now olur', async () => {
  const first = makeStore();
  await run({ fetchHtml: makeSite().fetchHtml, ...first, now: NOW });
  const trimmed = first.store.items.filter((i) => i.id !== 'haberler/gencler-iklim-degisikligiyle-mucadele-icin-bulustu');
  const later = new Date(NOW.getTime() + 3600000);
  const s = makeStore(trimmed);
  await run({ fetchHtml: makeSite().fetchHtml, ...s, now: later });
  const added = s.store.items.find((i) => i.id === 'haberler/gencler-iklim-degisikligiyle-mucadele-icin-bulustu');
  assert.equal(added.firstSeenAt, later.toISOString());
});
