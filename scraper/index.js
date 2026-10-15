import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { parseList } from './parse-list.js';
import { parseDetail } from './parse-detail.js';
import { selectToFetch, mergeItems } from './merge.js';
import { createFetcher } from './fetch.js';

const BASE_URL = 'https://www.iaosbnedimuysalatl.k12.tr';
const SECTIONS = ['haberler', 'duyurular'];

async function collectEntries(fetchHtml, baseUrl, section) {
  const first = parseList(await fetchHtml(`${baseUrl}/${section}`), baseUrl);
  const entries = [...first.entries];
  for (let page = 2; page <= first.totalPages; page += 1) {
    entries.push(...parseList(await fetchHtml(`${baseUrl}/${section}/${page}`), baseUrl).entries);
  }
  if (entries.length === 0) {
    throw new Error(`/${section} listesinde kayıt bulunamadı (${section === 'duyurular' ? 'duyuru' : 'haber'}); site yapısı değişmiş olabilir`);
  }
  return entries;
}

export async function run({ fetchHtml, readItems, writeItems, writeStatus, now, baseUrl = BASE_URL }) {
  const seen = new Set();
  const entries = [];
  for (const section of SECTIONS) {
    for (const e of await collectEntries(fetchHtml, baseUrl, section)) {
      if (!seen.has(e.id)) {
        seen.add(e.id);
        entries.push(e);
      }
    }
  }

  const existing = await readItems();
  const details = new Map();
  for (const e of selectToFetch(existing, entries, now)) {
    try {
      details.set(e.id, parseDetail(await fetchHtml(e.url), baseUrl));
    } catch (err) {
      console.warn(`Detay alınamadı, sonra yeniden denenecek: ${e.url} (${err.message})`);
    }
  }

  let merged = mergeItems(existing, entries, details, now);
  if (existing.length === 0) {
    // İlk yükleme: geçmiş kayıtlar "YENİ" sayılmasın, yayın tarihi baz alınır.
    merged = merged.map((i) => ({ ...i, firstSeenAt: `${i.date}T00:00:00.000Z` }));
  }
  const changed = JSON.stringify(merged) !== JSON.stringify(existing);
  if (changed) await writeItems(merged);
  await writeStatus({ lastSuccessAt: now.toISOString() });

  const known = new Set(existing.map((i) => i.id));
  return { changed, added: merged.filter((i) => !known.has(i.id)).length };
}

async function main() {
  const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'site', 'data');
  const itemsPath = join(dataDir, 'items.json');
  const statusPath = join(dataDir, 'status.json');
  await mkdir(dataDir, { recursive: true });
  const res = await run({
    fetchHtml: createFetcher(),
    readItems: async () => {
      try {
        return JSON.parse(await readFile(itemsPath, 'utf8')).items;
      } catch (err) {
        if (err.code === 'ENOENT') return [];
        throw err;
      }
    },
    writeItems: (items) => writeFile(itemsPath, `${JSON.stringify({ items }, null, 2)}\n`),
    writeStatus: (s) => writeFile(statusPath, `${JSON.stringify(s)}\n`),
    now: new Date(),
  });
  console.log(`Tamam: ${res.added} yeni kayıt, değişiklik: ${res.changed}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
