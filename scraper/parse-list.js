import * as cheerio from 'cheerio';

export function toIsoDate(s) {
  const m = String(s).trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return '';
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

const TYPES = { haberler: 'haber', duyurular: 'duyuru' };

export function parseList(html, baseUrl) {
  const $ = cheerio.load(html);
  const entries = [];
  $('ul.duyurulari_listele > li').each((_, li) => {
    const $li = $(li);
    const href = $li.find('a.d_devami').attr('href');
    if (!href) return;
    let u;
    try {
      u = new URL(href, baseUrl);
    } catch {
      return;
    }
    if (!/^https?:$/.test(u.protocol) || u.host !== new URL(baseUrl).host) return;
    const url = u.href;
    const id = u.pathname.replace(/^\/+/, '');
    const type = TYPES[id.split('/')[0]];
    if (!type) return;
    entries.push({
      id,
      type,
      title: $li.find('.duyuru_adi').text().replace(/\s+/g, ' ').trim(),
      date: toIsoDate($li.find('.duyuru_tarih').text()),
      url,
    });
  });
  const pg = $('.pagination').text().match(/Sayfa\s*:\s*\d+\s*\/\s*(\d+)/);
  return { entries, totalPages: pg ? Number(pg[1]) : 1 };
}
