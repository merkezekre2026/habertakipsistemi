# Haber Takip Sistemi — Tasarım (Spec)

Tarih: 2026-10-15

## Amaç

`iaosbnedimuysalatl.k12.tr` (Özel İzmir Atatürk OSB Nedim Uysal MTAL) sitesindeki **haberleri** (`/haberler`) ve **duyuruları** (`/duyurular`) otomatik izleyen, herkese açık, Türkçe bir web sitesi. Yeni içerik çıktığında en geç ~1 saat içinde sitede görünür; yeni kayıtlar "YENİ" rozetiyle işaretlenir.

## Kararlar (kullanıcı onaylı)

| Konu | Karar |
|---|---|
| Ana amaç | Haber panosu (bildirim yok, çoklu kaynak yok) |
| Yayın | İnternette herkese açık: GitHub Pages + GitHub Actions |
| Güncelleme sıklığı | Saatlik |
| Görseller | Bütün görseller gösterilir (haber gövdesindeki ve galerideki) |

## Kaynak sitenin yapısı (incelendi 2026-10-15)

- RSS/feed yok (`/rss`, `/feed` → 404). HTML taranacak.
- Liste: `/haberler` (sayfalama: `/haberler/2`, "Sayfa : 1 / 2" metni ile toplam sayfa sayısı okunur), `/duyurular`.
- Liste öğesi: `ul.duyurulari_listele > li` içinde `.duyuru_adi` (başlık), `.duyuru_tarih` (`GG.AA.YYYY`), `a.d_devami[href]` (detay adresi). Liste özetleri ve küçük resimler boş; içerik detay sayfasından alınır.
- Detay: `article` içinde `<p>` gövdesi (satır içi `<img src="/Uploads/...">` görselleri), ayrıca `.gorsellistele a[href]` galeri görselleri, `em` içinde uzun tarih (`14 Ekim 2026`). Duyurularda gövde bazen sadece PDF/dosya bağlantısıdır (`/Uploads/....pdf`).
- Site ASP.NET; yanıtlar UTF-8.

## Mimari

```
GitHub Actions (saatlik cron)
   └─ scraper (Node.js) ──> data/items.json ──commit──> GitHub Pages
                                                 │
                              site/ (statik HTML/CSS/JS) okur: data/items.json
```

Depo yapısı:

```
scraper/
  fetch.js        # HTTP: nazik istek, User-Agent, zaman aşımı, yeniden deneme
  parse-list.js   # liste HTML -> [{url, title, date}] + toplam sayfa sayısı
  parse-detail.js # detay HTML -> {text, images[], attachments[]}
  index.js        # orkestrasyon: çek, birleştir, items.json yaz
  test/           # kayıtlı örnek HTML (fixture) + node:test testleri
site/
  index.html, style.css, app.js
  data/items.json # yayınlanan veri (scraper yazar)
.github/workflows/update.yml  # cron + deploy
```

Birimler tek amaçlıdır: parser'lar saf fonksiyondur (HTML string → veri), ağa dokunmaz; yalnızca `fetch.js` ağa çıkar. Parser'lar fixture'larla bağımsız test edilir.

## Veri modeli (`items.json`)

```json
{
  "items": [
    {
      "id": "haberler/gencler-iklim-degisikligiyle-mucadele-icin-bulustu",
      "type": "haber",              
      "title": "…",
      "date": "2026-10-14",
      "url": "https://www.iaosbnedimuysalatl.k12.tr/haberler/…",
      "excerpt": "ilk ~200 karakter, düz metin",
      "text": "tam metin, düz metin",
      "images": ["https://www.iaosbnedimuysalatl.k12.tr/Uploads/…jpeg"],
      "attachments": [{"name": "…", "url": "https://…/Uploads/ic-tuzuk-2026.pdf"}],
      "firstSeenAt": "2026-10-15T15:00:00Z"
    }
  ]
}
```

- `id` = adres yolu (kalıcı anahtar). `type`: `haber` | `duyuru`.
- Görseller **depoya kopyalanmaz**; okul sitesinin mutlak adresleriyle gösterilir (hotlink). Görsel adresleri mutlak URL'ye çevrilir, tekrarlar atılır, logo/banner/`/static/` görselleri hariç tutulur.
- `type` ve `id` kaynak tarama konumundan, `date` liste sayfasından gelir (ISO'ya çevrilir).

`lastSuccessAt` ayrı `site/data/status.json` dosyasındadır (git'e girmez, her çalıştırmada üretilip Pages'e yüklenir); böylece veri değişmedikçe saatlik boş commit oluşmaz. Testler dağıtılan siteye girmesin diye kökte `test/` altındadır.

## Scraper akışı

1. `/haberler` ve `/duyurular` ilk sayfasından toplam sayfa sayısını oku; tüm liste sayfalarını gez.
2. Liste öğelerini mevcut `items.json` ile `id` üzerinden karşılaştır.
3. **Yeni** kayıtlar için detay sayfasını çek ve ayrıştır; `firstSeenAt` = şimdi. Mevcut kayıtlar yeniden çekilmez (başlık/tarih liste verisiyle güncellenir). Son 14 günde eklenen kayıtlar içerik düzenlemelerini yakalamak için her çalıştırmada yeniden çekilir.
4. Okul sitesinden kaldırılan kayıtlar listeden **silinmez** (arşiv korunur); site yalnızca mevcut olanları değil tüm kayıtları gösterir.
5. Tarihe göre (yeni → eski) sırala, `items.json`'u yaz. Değişiklik yoksa commit atılmaz.
6. İlk çalıştırma tüm geçmişi çeker (~2 sayfa haber + duyurular; ~birkaç düzine istek). İstekler arası 500 ms bekleme, tek eşzamanlılık, tanımlayıcı User-Agent.

## Hata yönetimi

- Liste sayfası alınamaz/ayrıştırılamazsa (0 öğe, HTTP hatası, yapı değişikliği): işlem hata ile biter, `items.json`'a dokunulmaz, eski veri yayında kalır. Actions başarısız görünür (GitHub e-posta ile haber verir).
- Tek bir detay sayfası başarısız olursa: o kayıt yalnızca liste verisiyle (başlık/tarih/url) eklenir, `text` boş kalır; sonraki çalıştırmada eksik içerikli kayıtlar yeniden denenir.
- Sayfa, `lastSuccessAt` saatini gösterir; 6 saatten eskiyse "veriler güncel olmayabilir" uyarısı görünür.

## Web sitesi

- Saf HTML/CSS/JS (framework/derleme yok), mobil uyumlu, Türkçe, açık/koyu temaya duyarlı.
- Üstte okul adı + son güncelleme saati. Sekmeler: **Tümü / Haberler / Duyurular**. Arama kutusu (başlık + metin, Türkçe karakterden bağımsız: `ı/i`, `ş/s` vb. normalize). Sıralama: yeni → eski.
- Kart: ilk görsel (varsa), başlık, tarih, kısa özet, tür etiketi, `firstSeenAt` son 72 saatteyse **YENİ** rozeti.
- Karta tıklayınca detay görünümü (iletişim kutusu): tam metin, **tüm görseller** galeri olarak (büyütülebilir), ekler (PDF vb.) bağlantıları ve "Orijinal sayfada aç" bağlantısı. Görseller `loading="lazy"`; yüklenemeyen görsel gizlenir.
- Altbilgide kaynak belirtilir: içerik okulun sitesinden alınmıştır, resmi site bağlantısı verilir; bu site okulla bağlantılı resmi bir site değildir.

## Otomasyon (`update.yml`)

- Tetikleyiciler: `schedule` (saatlik, `17 * * * *`), `workflow_dispatch` (elle), `push`.
- Adımlar: checkout → Node kurulumu → `node scraper/index.js` → değişiklik varsa `site/data/items.json` commit → GitHub Pages'e `site/` yayını.
- `permissions`: `contents: write`, `pages: write`, `id-token: write`. Gizli anahtar gerekmez.
- Not: GitHub, 60 gün hareketsiz kalan depolarda zamanlanmış çalıştırmaları durdurur; veri değiştikçe commit olduğu için normalde sorun olmaz, durursa elle başlatmak yeterli.

## Test

- `parse-list` ve `parse-detail` için `node:test` ile fixture testleri (gerçek sayfalardan kaydedilmiş HTML: haber, duyuru, PDF'li duyuru, çok görselli haber, boş sonuç).
- Birleştirme mantığı (yeni/mevcut/silinmiş kayıt, 14 gün yeniden çekme) için birim testleri.
- Elle doğrulama: yerelde scraper çalıştır, `items.json`'u incele, siteyi tarayıcıda aç (arama, sekmeler, detay, mobil genişlik).

## Kapsam dışı (YAGNI)

Bildirimler (e-posta/Telegram), birden çok kaynak site, yönetim paneli, kullanıcı hesabı, görsellerin depoya kopyalanması, RSS çıktısı.

## Riskler / varsayımlar

- Okul sitesi HTML'i değişirse ayrıştırıcı güncellenmeli (hata durumunda eski veri korunur, Actions kırmızı olur).
- Görseller okulun sunucusundan yüklenir; okul görsel adreslerini değiştirir/kaldırırsa görsel kaybolur (kabul edilen takas).
- Yayın için bir GitHub hesabı ve depo oluşturulması gerekir (uygulama sırasında kullanıcı onayıyla).
- Okul içeriğinin (ve öğrenci fotoğraflarının) herkese açık yeniden gösterimi için okul yönetiminin bilgisi/izni önerilir; site kaynağı açıkça belirtir ve her kayıttan orijinal sayfaya bağlantı verir.
