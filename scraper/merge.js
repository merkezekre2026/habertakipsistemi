const FOURTEEN_DAYS = 14 * 86400000;
const EMPTY_DETAIL = { text: '', excerpt: '', images: [], attachments: [] };

const isEmptyContent = (it) => !it.text && !it.images.length && !it.attachments.length;

export function selectToFetch(existing, entries, now) {
  const byId = new Map(existing.map((i) => [i.id, i]));
  return entries.filter((e) => {
    const it = byId.get(e.id);
    if (!it) return true;
    if (now.getTime() - new Date(it.firstSeenAt).getTime() < FOURTEEN_DAYS) return true;
    return isEmptyContent(it);
  });
}

export function mergeItems(existing, entries, details, now) {
  const byId = new Map(existing.map((i) => [i.id, { ...i }]));
  for (const e of entries) {
    const detail = details.get(e.id);
    const prev = byId.get(e.id);
    if (prev) {
      byId.set(e.id, { ...prev, ...e, ...(detail ?? {}) });
    } else {
      byId.set(e.id, { ...e, ...(detail ?? EMPTY_DETAIL), firstSeenAt: now.toISOString() });
    }
  }
  return [...byId.values()].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      b.firstSeenAt.localeCompare(a.firstSeenAt) ||
      a.id.localeCompare(b.id),
  );
}
