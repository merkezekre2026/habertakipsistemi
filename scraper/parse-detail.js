import * as cheerio from 'cheerio';

const SITE_IMAGE_PREFIXES = ['/static/', '/Uploads/diller/', '/Uploads/banner/', '/Uploads/anasayfa/'];
const ATTACHMENT_EXT = /\.(pdf|docx?|xlsx?|pptx?|zip|rar)$/i;

export function makeExcerpt(text, max = 200) {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

function absolute(src, baseUrl) {
  try {
    return new URL(src, baseUrl);
  } catch {
    return null;
  }
}

function extractText($, $article) {
  const $c = $article.clone();
  $c.find('h2, em, script, style, noscript, .gorsellistele').remove();
  $c.find('br').replaceWith('\n');
  $c.find('p, div, li, tr').each((_, el) => {
    $(el).append('\n');
  });
  return $c
    .text()
    .split('\n')
    .map((l) => l.replace(/[ \t\u00a0]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function parseDetail(html, baseUrl) {
  const $ = cheerio.load(html);
  const $article = $('article').first();
  if (!$article.length) return { text: '', excerpt: '', images: [], attachments: [] };

  const text = extractText($, $article);

  const images = [];
  $article.find('img[src]').each((_, el) => {
    const u = absolute($(el).attr('src'), baseUrl);
    if (!u || SITE_IMAGE_PREFIXES.some((p) => u.pathname.startsWith(p))) return;
    if (!images.includes(u.href)) images.push(u.href);
  });

  const attachments = [];
  $article.find('a[href]').each((_, el) => {
    const u = absolute($(el).attr('href'), baseUrl);
    if (!u || !u.pathname.startsWith('/Uploads/') || !ATTACHMENT_EXT.test(u.pathname)) return;
    if (attachments.some((a) => a.url === u.href)) return;
    const name = $(el).text().replace(/\s+/g, ' ').trim() || decodeURIComponent(u.pathname.split('/').pop());
    attachments.push({ name, url: u.href });
  });

  return { text, excerpt: makeExcerpt(text), images, attachments };
}
