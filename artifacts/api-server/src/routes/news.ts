import { Router } from "express";

const router = Router();

const RSS_FEEDS = [
  { url: 'https://www.bfmtv.com/rss/economie/bourse/', category: 'Bourse', source: 'BFM Bourse' },
  { url: 'https://www.lefigaro.fr/rss/figaro_bourse.xml', category: 'Bourse', source: 'Le Figaro' },
  { url: 'https://www.bfmtv.com/rss/economie/patrimoine/', category: 'Épargne', source: 'BFM Patrimoine' },
  { url: 'https://www.lefigaro.fr/rss/figaro_placement.xml', category: 'Épargne', source: 'Le Figaro Placement' },
  { url: 'https://www.lefigaro.fr/rss/figaro_economie.xml', category: 'Finance', source: 'Le Figaro Économie' },
  { url: 'https://coinacademy.fr/feed/', category: 'Crypto', source: 'CoinAcademy' },
];

const CACHE_TTL_MS = 10 * 60 * 1000;

let cachedArticles: ReturnType<typeof buildArticleList> | null = null;
let cacheTimestamp = 0;
let refreshInProgress = false;

function extractTag(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${tag}>`, 's'));
  return m ? m[1].trim() : '';
}

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'").trim();
}

function extractImage(itemXml: string): string | null {
  const enclosure = itemXml.match(/<enclosure[^>]+url="([^"]+)"[^>]*type="image/);
  if (enclosure) return enclosure[1];
  const media = itemXml.match(/<media:(?:content|thumbnail)[^>]+url="([^"]+)"/);
  if (media) return media[1];
  const imgSrc = itemXml.match(/<img[^>]+src="([^"]+)"/);
  if (imgSrc) return imgSrc[1];
  return null;
}

async function fetchFeed(feed: typeof RSS_FEEDS[number]) {
  try {
    const res = await fetch(feed.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items: RegExpMatchArray[] = [...xml.matchAll(/<item>(.*?)<\/item>/gs)];
    return items.slice(0, 20).map(m => {
      const item = m[1];
      const title = stripHtml(extractTag(item, 'title'));
      const link = extractTag(item, 'link') || extractTag(item, 'guid');
      const pubDate = extractTag(item, 'pubDate') || extractTag(item, 'dc:date') || '';
      const description = stripHtml(extractTag(item, 'description')).substring(0, 300);
      const image = extractImage(item);
      return { title, link, pubDate, description, image, category: feed.category, source: feed.source };
    }).filter(a => a.title);
  } catch {
    return [];
  }
}

function buildArticleList(results: Awaited<ReturnType<typeof fetchFeed>>[]) {
  return results.flat().sort((a, b) => {
    const da = new Date(a.pubDate).getTime() || 0;
    const db = new Date(b.pubDate).getTime() || 0;
    return db - da;
  }).slice(0, 100);
}

async function refreshCache() {
  if (refreshInProgress) return;
  refreshInProgress = true;
  try {
    const results = await Promise.all(RSS_FEEDS.map(fetchFeed));
    cachedArticles = buildArticleList(results);
    cacheTimestamp = Date.now();
  } catch {
    // keep stale cache on error
  } finally {
    refreshInProgress = false;
  }
}

// Warm the cache on server start so the first user request is instant
refreshCache();

router.get('/news', async (req, res) => {
  const isStale = Date.now() - cacheTimestamp > CACHE_TTL_MS;

  if (cachedArticles && !isStale) {
    // Fresh cache — respond immediately
    res.json({ articles: cachedArticles });
    return;
  }

  if (cachedArticles && isStale) {
    // Stale cache — serve immediately, refresh in background
    res.json({ articles: cachedArticles });
    refreshCache();
    return;
  }

  // No cache yet (cold start) — wait for the first fetch
  await refreshCache();
  res.json({ articles: cachedArticles ?? [] });
});

export default router;
