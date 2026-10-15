const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const HOUR = 3600000;

export function normalizeTr(s) {
  return String(s)
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const haystacks = new WeakMap();
function haystack(item) {
  let h = haystacks.get(item);
  if (h === undefined) {
    h = normalizeTr(`${item.title} ${item.text ?? ''}`);
    haystacks.set(item, h);
  }
  return h;
}

export function filterItems(items, { tab, query }) {
  const terms = normalizeTr(query).split(/\s+/).filter(Boolean);
  return items.filter((it) => {
    if (tab !== 'tumu' && it.type !== tab) return false;
    const h = haystack(it);
    return terms.every((t) => h.includes(t));
  });
}

export function isNew(item, now) {
  return now.getTime() - new Date(item.firstSeenAt).getTime() <= 72 * HOUR;
}

export function isStale(lastSuccessAt, now) {
  return now.getTime() - new Date(lastSuccessAt).getTime() > 6 * HOUR;
}

export function formatDateTr(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
