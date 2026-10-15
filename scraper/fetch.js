const DEFAULT_UA = 'iaosb-haber-takip/1.0 (+kamuya acik haber panosu)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createFetcher({ delayMs = 500, userAgent = DEFAULT_UA, retries = 2, timeoutMs = 20000 } = {}) {
  return async function fetchHtml(url) {
    await sleep(delayMs);
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': userAgent, Accept: 'text/html' },
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
        return await res.text();
      } catch (err) {
        lastErr = err;
        if (attempt < retries) await sleep(delayMs);
      }
    }
    throw lastErr;
  };
}
