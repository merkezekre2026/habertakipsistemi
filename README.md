# İAOSB Haber Takip

`iaosbnedimuysalatl.k12.tr` sitesindeki haber ve duyuruları saatlik tarayıp GitHub Pages'te yayınlayan haber panosu.

- `npm test` — testleri çalıştırır
- `npm run scrape` — okul sitesini tarar ve `site/data/items.json` dosyasını günceller

## Nasıl çalışır?

1. `scraper/` okul sitesindeki `/haberler` ve `/duyurular` sayfalarını gezer, yeni kayıtların detay sayfalarını çeker ve `site/data/items.json` dosyasını günceller.
2. `site/` framework'süz statik sitedir; `data/items.json` dosyasını okuyup listeler (arama, sekmeler, detay görünümü).
3. `.github/workflows/update.yml` her saat başı (UTC, :17) tarayıcıyı çalıştırır, veri değiştiyse commit eder ve `site/` klasörünü GitHub Pages'e yayınlar. Elle başlatmak için Actions → "Haberleri güncelle ve yayınla" → Run workflow.

## Yayına alma (bir kez)

1. GitHub'da boş bir **public** depo oluşturun.
2. `git remote add origin <depo-url>` ve `git push -u origin main`.
3. Depoda Settings → Pages → Source: **GitHub Actions**.
4. Actions sekmesinden iş akışını elle çalıştırın; site `https://<kullanıcı>.github.io/<depo>/` adresinde açılır.

## Bakım notları

- Okul sitesinin HTML yapısı değişirse tarayıcı 0 kayıt bulur ve iş akışı hata verir; eski veri yayında kalır. `scraper/parse-list.js` ve `scraper/parse-detail.js` güncellenmelidir (`test/fixtures` altındaki örnekleri yenileyin).
- Görseller okulun sunucusundan yüklenir (depoya kopyalanmaz).
- GitHub, 60 gün hareketsiz depolarda zamanlanmış çalıştırmaları durdurur; durursa Actions'tan elle başlatın.
- `site/data/status.json` git'e girmez; her çalıştırmada üretilip Pages'e yüklenir.
