# Haber Takip Sistemi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `iaosbnedimuysalatl.k12.tr` haber ve duyurularını saatlik tarayıp GitHub Pages'te yayınlayan, aranabilir Türkçe bir haber panosu kurmak.

**Architecture:** Saf fonksiyonlardan oluşan Node.js scraper (liste ayrıştırıcı, detay ayrıştırıcı, birleştirici) `site/data/items.json` dosyasını üretir; ağa yalnızca `fetch.js` çıkar. Framework'süz statik site bu JSON'u okur. GitHub Actions saatlik çalıştırıp değişen veriyi commit'ler ve `site/` klasörünü Pages'e yayınlar.

**Tech Stack:** Node.js ≥ 20 (ES modules, `node:test`, yerleşik `fetch`), `cheerio` (HTML ayrıştırma), saf HTML/CSS/JS, GitHub Actions + GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-15-haber-takip-sistemi-design.md`

## Global Constraints

- Kaynak: `https://www.iaosbnedimuysalatl.k12.tr`; yalnızca `/haberler` (`type: "haber"`) ve `/duyurular` (`type: "duyuru"`).
- `id` = adres yolu, başında `/` olmadan (`haberler/<slug>`, `duyurular/<slug>`); `date` ISO `YYYY-MM-DD` (kaynak `GG.AA.YYYY`).
- Görseller depoya kopyalanmaz; okul sitesinin **mutlak** adresleriyle gösterilir. `/static/`, `/Uploads/diller/`, `/Uploads/banner/`, `/Uploads/anasayfa/` altındaki site görselleri hariç tutulur; tekrarlar atılır.
- `excerpt` = düz metnin ilk ~200 karakteri (kelime sınırında kesilir, kesildiyse `…` eklenir).
- Okul sitesine nazik davran: istekler sıralı, aralarında 500 ms, `User-Agent: iaosb-haber-takip/1.0 (+kamuya acik haber panosu)`, 20 sn zaman aşımı, en çok 2 yeniden deneme.
- Silinmiş (kaynaktan kalkmış) kayıtlar `items.json`'dan silinmez. Son 14 günde `firstSeenAt` almış kayıtlar ve `text` alanı boş kalmış kayıtlar her çalıştırmada detaydan yeniden çekilir.
- Liste sayfası alınamaz/ayrıştırılamaz ya da 0 kayıt dönerse çalıştırma hata ile biter ve `items.json`'a dokunulmaz.
- "YENİ" rozeti: `firstSeenAt` son 72 saat içinde. Veri bayat uyarısı: `lastSuccessAt` 6 saatten eski.
- Site, uzak veriyi DOM'a **asla** `innerHTML` ile yazmaz (`textContent`/`createElement`/`setAttribute`); dış bağlantılar `rel="noopener noreferrer"`.
- Site Türkçe, mobil uyumlu, açık/koyu temaya duyarlı (`prefers-color-scheme`); framework ve derleme adımı yok.
- Dosya düzeni (spec'ten küçük sapma: testler dağıtılan `site/` dışında, kökte `test/`): `scraper/`, `site/`, `test/`, `.github/workflows/update.yml`.
- `site/data/items.json` biçimi `{"items": Item[]}`; `lastSuccessAt` ayrı `site/data/status.json` dosyasındadır (`{"lastSuccessAt": ISO}`), **git'e girmez** (`.gitignore`), her çalıştırmada üretilip Pages'e yüklenir — böylece veri değişmedikçe saatlik boş commit oluşmaz.

## Review Focus

1. Liste sayfası yapı değişikliği/hata yüzünden 0 kayıt döner → çalıştırma hata verir, eldeki `items.json` değişmez (Task 5).
2. Yalnızca PDF eki olan, görseli ve metni olmayan duyuru → kayıt oluşur, `images: []`, `attachments` dolu, kart görselsiz çizilir (Task 3, 6).
3. Türkçe arama: `IŞIK`, `ışık`, `isik` aynı kayıtla eşleşir; `İ`/`ı` normalizasyonu (Task 6).
4. Tek bir detay sayfası başarısız olur → kayıt liste verisiyle eklenir, `text` boş, sonraki çalıştırmada yeniden denenir (Task 4, 5).
5. Başlıkta tırnak/özel karakter (`title="… "Merhaba" Dedi"` gibi bozuk öznitelik) ve görsel adreslerinde boşluk/Türkçe karakter/göreli yol → başlık öğe metninden alınır, görsel adresleri geçerli mutlak URL'ye dönüşür (Task 2, 3).

---

### Task 1: Proje iskeleti ve fixture'lar

**Files:**
- Create: `package.json`, `.gitignore`, `README.md` (iskelet), `test/fixtures/haberler-1.html`, `test/fixtures/duyurular-1.html`, `test/fixtures/haber-detay-cok-gorsel.html`, `test/fixtures/duyuru-detay-pdf.html`

**Interfaces:**
- Produces: `npm test` (`node --test test/`), `npm run scrape` (`node scraper/index.js`); fixture dosyaları aşağıdaki adlarla.

- [ ] **Step 1: `git init`, `package.json` (`"type": "module"`, `"engines": {"node": ">=20"}`, `dependencies: {"cheerio": "<güncel kararlı sürüm, tam sürüm sabitle>"}`, scripts: `test`, `scrape`) ve `.gitignore` (`node_modules/`, `site/data/status.json`) oluştur; `npm install` çalıştır.**

- [ ] **Step 2: Fixture'ları canlı siteden kaydet**

```bash
B=https://www.iaosbnedimuysalatl.k12.tr; F=test/fixtures; mkdir -p $F
curl -sL $B/haberler -o $F/haberler-1.html
curl -sL $B/duyurular -o $F/duyurular-1.html
curl -sL $B/haberler/gencler-iklim-degisikligiyle-mucadele-icin-bulustu -o $F/haber-detay-cok-gorsel.html
curl -sL $B/duyurular/kurum-ic-tuzugu -o $F/duyuru-detay-pdf.html
```

Beklenen: `haberler-1.html` içinde 24, `duyurular-1.html` içinde 7 adet `class="duyuru_adi"`; `haberler-1.html` "Sayfa : 1 / 2" içerir (`grep -c` ile doğrula).

- [ ] **Step 3: `README.md` iskeleti (amaç, `npm test`, `npm run scrape`) yaz ve commit et**

```bash
git add -A && git commit -m "chore: proje iskeleti ve fixture'lar"
```

---

### Task 2: Liste ayrıştırıcı (`parse-list`)

**Files:**
- Create: `scraper/parse-list.js`
- Test: `test/parse-list.test.js`

**Interfaces:**
- Produces: `parseList(html: string, baseUrl: string): { entries: ListEntry[], totalPages: number }` ve `ListEntry = { id: string, type: "haber" | "duyuru", title: string, date: string /* ISO */, url: string /* mutlak */ }`.
- `type`, href'in `haberler/` ya da `duyurular/` ile başlamasından; `totalPages` "Sayfa : X / Y" metninden (yoksa 1).

- [ ] **Step 1: Testleri yaz** (`node:test`, fixture'ları `fs.readFileSync` ile oku):
  - `haberler-1.html` → `entries.length === 24`, `totalPages === 2`.
  - İlk kayıt tam olarak: `{ id: "haberler/gencler-iklim-degisikligiyle-mucadele-icin-bulustu", type: "haber", title: "Gençler İklim Değişikliğiyle Mücadele İçin Buluştu", date: "2026-10-14", url: "https://www.iaosbnedimuysalatl.k12.tr/haberler/gencler-iklim-degisikligiyle-mucadele-icin-bulustu" }`.
  - `duyurular-1.html` → `entries.length === 7`, `totalPages === 1`, ilk kayıt `type: "duyuru"`, `date: "2026-10-02"`.
  - Başlığında çift tırnak olan kayıt (`okulumuz-2025-2026-egitim-ogretim-yilina-coskuyla-merhaba-dedi`) için `title === 'Okulumuz 2025-2026 Eğitim Öğretim Yılına Coşkuyla "Merhaba" Dedi'` (başlık `.duyuru_adi` metninden, `title=` özniteliğinden değil; boşluklar kırpılır).
  - `parseList("<html></html>", base)` → `{ entries: [], totalPages: 1 }` (hata atmaz; 0 kayıt kararını çağıran verir).

- [ ] **Step 2: Çalıştır, başarısız olduğunu doğrula** — `npm test` → `parseList` bulunamadı.

- [ ] **Step 3: `parseList` uygula** — cheerio ile `ul.duyurulari_listele > li`; bağlantı `a.d_devami[href]`; göreli href'ler `new URL(href, baseUrl)` ile mutlaklaştırılır; `GG.AA.YYYY` → ISO dönüşümü ayrı küçük yardımcı (`toIsoDate(s: string): string`, export edilir ve kendi testine sahip).

- [ ] **Step 4: `npm test` geçer.**

- [ ] **Step 5: Commit** — `git add scraper test && git commit -m "feat: liste ayrıştırıcı"`

---

### Task 3: Detay ayrıştırıcı (`parse-detail`)

**Files:**
- Create: `scraper/parse-detail.js`
- Test: `test/parse-detail.test.js`

**Interfaces:**
- Produces: `parseDetail(html: string, baseUrl: string): Detail` ve `Detail = { text: string, excerpt: string, images: string[], attachments: { name: string, url: string }[] }`.
- Produces: `makeExcerpt(text: string, max = 200): string` (export).

- [ ] **Step 1: Testleri yaz**:
  - `haber-detay-cok-gorsel.html`: `text` "Millî Eğitim Bakanımız Sayın Yusuf Tekin" ile başlar ve `<br>` yerine satır sonları korunur (art arda 3'ten fazla boş satır yok); `images` tam olarak 5 mutlak URL: gövdedeki 4 (`…/Uploads/whatsapp-image-2026-10-09-at-234347-1-1.jpeg`, `…234346-3-1.jpeg`, `…/Uploads/dsc_2671-1.JPG`, `…/Uploads/dsc_2677-1.JPG`) + `eda-1.jpeg`, `edaab-2.jpg` + galeri `…/Uploads/gencler-iklim-degisikligiyle-mucadele-icin-bulustu-2.JPG` — **sayıyı fixture'a bakarak doğrula** (gövdede 6, galeride 1 → 7 olabilir; test gerçek sayıyı sabitler); logo/banner/`/static/`/`/Uploads/anasayfa/` görselleri listede yok; tekrar yok.
  - `duyuru-detay-pdf.html`: `images` boş; `attachments` = `[{ name: "Okulumuzun İç Tüzüğüne ulaşmak için tıklayınız.", url: "https://www.iaosbnedimuysalatl.k12.tr/Uploads/ic-tuzuk-2026.pdf" }]`. (Ek = `article` içindeki `/Uploads/` altı `.pdf/.doc/.docx/.xls/.xlsx/.ppt/.pptx/.zip/.rar` bağlantıları; görünen metin `name` olur.)
  - Sentetik HTML: `<img src="/Uploads/Bir Resim ş.JPG">` → `images[0] === "https://www.iaosbnedimuysalatl.k12.tr/Uploads/Bir%20Resim%20%C5%9F.JPG"`; `src` protokolsüz `//host/x.jpg` ve göreli `Uploads/x.jpg` mutlaklaştırılır; `<script>`/`<style>` içeriği `text`'e girmez.
  - `makeExcerpt`: 200 karakterden kısa metin aynen döner; uzun metin kelime sınırında kesilir ve `…` ile biter, uzunluk ≤ 201.

- [ ] **Step 2: Çalıştır, başarısız olduğunu doğrula.**

- [ ] **Step 3: Uygula** — `article` kapsamı; metin `article` içindeki ilk `<h2>` ve `<em>` (tarih) hariç gövde bloğundan; blok öğeleri/`<br>` satır sonuna çevrilir, boşluklar normalize edilir. Görseller `article img[src]` + `.gorsellistele a[href]`/`img[src]`; adresler `new URL(src, baseUrl).href` ile mutlaklaştırılıp kodlanır.

- [ ] **Step 4: `npm test` geçer.**

- [ ] **Step 5: Commit** — `git commit -m "feat: detay ayrıştırıcı"`

---

### Task 4: Birleştirici (`merge`)

**Files:**
- Create: `scraper/merge.js`
- Test: `test/merge.test.js`

**Interfaces:**
- Consumes: `ListEntry` (Task 2), `Detail` (Task 3).
- Produces: `Item = ListEntry & Detail & { firstSeenAt: string /* ISO */ }`.
- Produces: `selectToFetch(existing: Item[], entries: ListEntry[], now: Date): ListEntry[]` — listede olup (a) `existing`'te bulunmayan, (b) `firstSeenAt` son 14 günde olan veya (c) `text === ""` ve `images`/`attachments` boş olan kayıtlar.
- Produces: `mergeItems(existing: Item[], entries: ListEntry[], details: Map<string, Detail>, now: Date): Item[]` — `details` anahtarı `id`; yeni kayıt `firstSeenAt = now.toISOString()`; mevcut kayıtta başlık/tarih/url liste verisiyle güncellenir, `details`'te varsa içerik alanları yenilenir, `firstSeenAt` korunur; detayı olmayan yeni kayıt `{ text: "", excerpt: "", images: [], attachments: [] }` alır; listede olmayan mevcut kayıtlar korunur; sonuç `date` azalan, eşitse `firstSeenAt` azalan, sonra `id` ile sıralı.

- [ ] **Step 1: Testleri yaz** (küçük sentetik veriyle): yeni kayıt eklenir ve `firstSeenAt` atanır; mevcut kaydın `firstSeenAt`'i değişmez; kaynaktan kalkan kayıt korunur; `selectToFetch` 14 günden eski ve içeriği dolu kaydı seçmez, 13 günlük kaydı seçer, boş içerikli eski kaydı seçer; detayı başarısız (details'te yok) yeni kayıt boş içerikle eklenir ve bir sonraki `selectToFetch`'te yeniden seçilir; sıralama kuralı.

- [ ] **Step 2: Başarısızlığı doğrula.**

- [ ] **Step 3: Uygula** (saf fonksiyonlar, girdileri değiştirmez).

- [ ] **Step 4: `npm test` geçer.**

- [ ] **Step 5: Commit** — `git commit -m "feat: birleştirme mantığı"`

---

### Task 5: Çekici ve orkestrasyon (`fetch`, `index`)

**Files:**
- Create: `scraper/fetch.js`, `scraper/index.js`
- Test: `test/index.test.js`

**Interfaces:**
- Consumes: `parseList`, `parseDetail`, `selectToFetch`, `mergeItems`.
- Produces: `createFetcher(opts?: { delayMs?: number, userAgent?: string, retries?: number, timeoutMs?: number }): (url: string) => Promise<string>` — her çağrı önce `delayMs` (varsayılan 500) bekler, 4xx/5xx ve ağ hatasında `retries` (2) kez yeniden dener, sonunda hata fırlatır.
- Produces: `run(deps: { fetchHtml: (url) => Promise<string>, readItems: () => Promise<Item[]>, writeItems: (items: Item[]) => Promise<void>, writeStatus: (s: { lastSuccessAt: string }) => Promise<void>, now: Date, baseUrl?: string }): Promise<{ changed: boolean, added: number }>`.
- CLI (`import.meta.url` ana modülse): gerçek `fetchHtml`, `site/data/items.json` okuma/yazma (dosya yoksa `[]`; yazım `{ "items": [...] }`, 2 boşluk girinti, sonda satır sonu), `site/data/status.json` yazma; hatada `process.exit(1)`.

Akış: her tür için `/haberler`, `/duyurular` ilk sayfasını çek → `totalPages` kadar `/<tür>/<n>` sayfalarını çek → tüm kayıtlar; **bir türün toplamı 0 ise** hata fırlat (yazma yok) → `selectToFetch` → her biri için detay çek (tek tek başarısız olabilir, kayıt boş içerikle kalır, hata `console.warn` ile loglanır) → `mergeItems` → sonuç mevcut `items` ile `JSON` olarak birebir aynıysa `writeItems` çağrılmaz (`changed: false`); her **başarılı** çalıştırmada `writeStatus` çağrılır.

- [ ] **Step 1: Testleri yaz** (sahte `fetchHtml`: URL → fixture eşlemesi; bellek içi `readItems/writeItems/writeStatus`):
  - İlk çalıştırma: haberler 2 sayfa (2. sayfa için `haberler-1.html` yeniden kullanılabilir, aynı `id`'ler tekrar edilirse kayıt çiftlenmemeli) + duyurular → `writeItems`, `id` başına tek kayıt; `added` doğru; `writeStatus` çağrıldı.
  - İkinci çalıştırma (aynı fixture, `now` 30 gün sonra, tüm içerik dolu): `changed === false`, `writeItems` çağrılmadı, `writeStatus` çağrıldı.
  - **Review Focus 1:** `/duyurular` boş HTML döndürür → `run` reddedilir, `writeItems` ve `writeStatus` çağrılmadı.
  - **Review Focus 4:** bir detay URL'si hata fırlatır → o kayıt `text: ""` ile eklenir, diğerleri dolu, `run` başarılı; sonraki çalıştırmada (detay artık çalışıyor) aynı kayıt dolar.
  - `createFetcher`: sahte global `fetch` ile 2 kez 500 sonra 200 → metin döner (`delayMs: 0`); 3 kez 500 → hata.

- [ ] **Step 2: Başarısızlığı doğrula.**

- [ ] **Step 3: Uygula** (`fetch.js` Node'un yerleşik `fetch` + `AbortSignal.timeout`; `index.js` yukarıdaki akış).

- [ ] **Step 4: `npm test` geçer.**

- [ ] **Step 5: Canlı deneme** — `npm run scrape` çalıştır. Beklenen: hata yok; `site/data/items.json` yaklaşık 24+(1–24 sayfa 2)+7 kayıt içerir; rastgele 3 kaydı elle aç: başlık/tarih/görseller okul sitesiyle uyuşuyor. Aynı komutu tekrar çalıştır: `items.json` bayt bayt değişmez (`git diff --stat` boş).

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: çekici, orkestrasyon ve ilk veri"`

---

### Task 6: Web sitesi

**Files:**
- Create: `site/index.html`, `site/style.css`, `site/search.js`, `site/app.js`
- Test: `test/search.test.js`

**Interfaces:**
- Produces (`site/search.js`, ES module, DOM'a bağımlı değil): `normalizeTr(s: string): string` (küçük harfe çevir — Türkçe `İ→i`, `I→ı`, sonra `ı→i`, `ş→s`, `ğ→g`, `ü→u`, `ö→o`, `ç→c`; diakritikleri sil), `filterItems(items: Item[], opts: { tab: "tumu" | "haber" | "duyuru", query: string }): Item[]` (sorgu boşluklarla bölünür, **tüm** terimler `başlık + text` içinde `normalizeTr` sonrası geçmeli; sıra korunur), `isNew(item: Item, now: Date): boolean` (72 saat), `isStale(lastSuccessAt: string, now: Date): boolean` (6 saat), `formatDateTr(iso: string): string` (`"14 Ekim 2026"`).
- `app.js`: `data/items.json` ve `data/status.json` okur (`status.json` yoksa bayat uyarısı gösterme), sekme/arama durumunu çizer.

- [ ] **Step 1: `search.js` için testleri yaz**: **Review Focus 3:** `normalizeTr("IŞIK") === normalizeTr("ışık") === normalizeTr("isik")`; `normalizeTr("İzmir") === "izmir"`; `filterItems` ile `"universite tanitim"` sorgusu başlığı `"Üniversite Tanıtım Günümüz Gerçekleşti"` olan kaydı bulur, `"erasmus ispanya"` yalnızca ikisini de içeren kaydı bulur; `tab: "duyuru"` yalnızca duyuruları döndürür; boş sorgu hepsini döndürür; `isNew`/`isStale` sınır değerleri (71 sa 59 dk → yeni, 72 sa 1 dk → değil; 5 sa 59 dk → bayat değil, 6 sa 1 dk → bayat); `formatDateTr("2026-10-14") === "14 Ekim 2026"`.

- [ ] **Step 2: Başarısızlığı doğrula, `search.js`'i uygula, geçtiğini doğrula** (`npm test`).

- [ ] **Step 3: `index.html`/`style.css`/`app.js` uygula** — spec'teki "Web sitesi" bölümüne göre: başlık + son güncelleme (bayatsa uyarı bandı), sekmeler, arama kutusu (yazdıkça süzer), kart ızgarası (ilk görsel `loading="lazy"` — yoksa görselsiz kart; **Review Focus 2**: yalnızca eki olan kayıt kartı hata vermeden çizilir, kartta ek simgesi/etiketi görünür), tür etiketi, YENİ rozeti, `<dialog>` detay görünümü (tam metin `white-space: pre-line`, tüm görseller galeri ızgarası ve tıklayınca büyütme, ek bağlantıları, "Orijinal sayfada aç"), `img` `onerror` ile gizleme, boş sonuç mesajı, altbilgide kaynak/yasal not. Tüm uzak veri `textContent`/`setAttribute` ile yazılır. Renkler `:root` değişkenleri; koyu tema `@media (prefers-color-scheme: dark)`; 375 px genişlikte yatay kaydırma yok.

- [ ] **Step 4: Elle doğrulama** — `npx --yes serve site` (veya `python -m http.server -d site`) ile aç; masaüstü ve 375 px genişlikte: sekmeler, arama (`isik`, `universite`), detay kutusu (çok görselli haber: tüm görseller görünüyor; PDF'li duyuru: ek bağlantısı çalışıyor), koyu tema, konsolda hata yok. Tarayıcı aracıyla ekran görüntüsü al.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: haber panosu sitesi"`

---

### Task 7: Otomasyon ve yayın

**Files:**
- Create: `.github/workflows/update.yml`
- Modify: `README.md` (kurulum, GitHub Pages ayarı, elle çalıştırma, bakım notları)

**Interfaces:**
- Consumes: `npm run scrape`, `site/` klasörü.

- [ ] **Step 1: `update.yml` yaz** — tetikleyiciler `schedule: [{cron: "17 * * * *"}]`, `workflow_dispatch`, `push` (branch `main`); `permissions: contents: write, pages: write, id-token: write`; `concurrency: group: pages, cancel-in-progress: false`. İş sırası: `actions/checkout` → `actions/setup-node` (Node 22, npm cache) → `npm ci` → `npm test` → `npm run scrape` → `site/data/items.json` değiştiyse `github-actions[bot]` olarak `git add site/data/items.json && git commit -m "veri: yeni haberler" && git push` (değişiklik yoksa atla) → `actions/configure-pages` → `actions/upload-pages-artifact` (`path: site`) → `actions/deploy-pages`. Action sürümlerini yazarken güncel majör sürümlere sabitle. Push ile tetiklenen koşuda bot commit'i yeniden tetiklemez (GITHUB_TOKEN), bu istenen davranıştır.

- [ ] **Step 2: Yerelde doğrula** — YAML'ı bir doğrulayıcıyla (`npx --yes yaml-lint` veya `python -c "import yaml…"`) ayrıştır; `npm test` ve `npm run scrape` yeşil.

- [ ] **Step 3: README'yi tamamla ve commit et** — `git add -A && git commit -m "ci: saatlik güncelleme ve Pages yayını"`

- [ ] **Step 4: Yayına alma (kullanıcıyla birlikte, dış işlem — onay gerekir)**: `gh` kurulu değil; kullanıcı github.com'da boş bir **public** depo oluşturur (örn. `iaosb-haber-takip`), `git remote add origin <url> && git branch -M main && git push -u origin main` komutlarını yerelde çalıştırırız; depoda Settings → Pages → Source: **GitHub Actions** seçilir; Actions sekmesinde "Run workflow" ile ilk koşu elle başlatılır. Beklenen: koşu yeşil; `https://<kullanıcı>.github.io/<depo>/` adresinde site açılır, haberler ve görseller görünür. Bu adım, depoyu oluşturmadan ve kullanıcının açık onayı olmadan yapılmaz.

- [ ] **Step 5: Yayın sonrası kontrol** — canlı adreste arama, detay ve mobil görünüm kontrol edilir; bir saat sonra zamanlanmış koşunun çalıştığı Actions sekmesinden doğrulanır.
