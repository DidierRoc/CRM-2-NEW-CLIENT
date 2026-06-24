import { Router } from "express";

const router = Router();

// ── French RSS feeds ──────────────────────────────────────────────────────────
const FR_FEEDS = [
  { url: 'https://www.bfmtv.com/rss/economie/bourse/', category: 'Bourse', source: 'BFM Bourse' },
  { url: 'https://www.lefigaro.fr/rss/figaro_bourse.xml', category: 'Bourse', source: 'Le Figaro Bourse' },
  { url: 'https://www.bfmtv.com/rss/economie/patrimoine/', category: 'Épargne', source: 'BFM Patrimoine' },
  { url: 'https://www.lefigaro.fr/rss/figaro_placement.xml', category: 'Épargne', source: 'Le Figaro Placements' },
  { url: 'https://www.lefigaro.fr/rss/figaro_economie.xml', category: 'Finance', source: 'Le Figaro Économie' },
  { url: 'https://coinacademy.fr/feed/', category: 'Crypto', source: 'CoinAcademy' },
];

// ── English RSS feeds ─────────────────────────────────────────────────────────
const EN_FEEDS = [
  { url: 'https://feeds.marketwatch.com/marketwatch/topstories/', category: 'Finance', source: 'MarketWatch' },
  { url: 'https://www.cnbc.com/id/10000664/device/rss/rss.html', category: 'Finance', source: 'CNBC Finance' },
  { url: 'https://www.cnbc.com/id/15839069/device/rss/rss.html', category: 'Markets', source: 'CNBC Markets' },
  { url: 'https://feeds.reuters.com/reuters/businessNews', category: 'Finance', source: 'Reuters Business' },
  { url: 'https://finance.yahoo.com/news/rssindex', category: 'Markets', source: 'Yahoo Finance' },
  { url: 'https://cointelegraph.com/rss', category: 'Crypto', source: 'CoinTelegraph' },
];

const CATEGORY_COLORS_EN: Record<string, string> = {
  Finance: 'Finance',
  Markets: 'Markets',
  Crypto:  'Crypto',
  Savings: 'Savings',
};

const CACHE_TTL_MS = 10 * 60 * 1000;

type Feed = { url: string; category: string; source: string };
type Article = { title: string; link: string; pubDate: string; description: string; image: string | null; category: string; source: string };

// Separate caches per language
const cache: Record<'fr' | 'en', { articles: Article[] | null; timestamp: number; inProgress: boolean }> = {
  fr: { articles: null, timestamp: 0, inProgress: false },
  en: { articles: null, timestamp: 0, inProgress: false },
};

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

async function fetchFeed(feed: Feed): Promise<Article[]> {
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

function buildArticleList(results: Article[][]): Article[] {
  return results.flat().sort((a, b) => {
    const da = new Date(a.pubDate).getTime() || 0;
    const db = new Date(b.pubDate).getTime() || 0;
    return db - da;
  }).slice(0, 100);
}

async function refreshCache(lang: 'fr' | 'en') {
  if (cache[lang].inProgress) return;
  cache[lang].inProgress = true;
  try {
    const feeds = lang === 'fr' ? FR_FEEDS : EN_FEEDS;
    const results = await Promise.all(feeds.map(fetchFeed));
    cache[lang].articles = buildArticleList(results);
    cache[lang].timestamp = Date.now();
  } catch {
    // keep stale cache on error
  } finally {
    cache[lang].inProgress = false;
  }
}

// Warm both caches on server start
refreshCache('fr');
refreshCache('en');

router.get('/news', async (req, res) => {
  const lang: 'fr' | 'en' = req.query.lang === 'en' ? 'en' : 'fr';
  const c = cache[lang];
  const isStale = Date.now() - c.timestamp > CACHE_TTL_MS;

  if (c.articles && !isStale) {
    res.json({ articles: c.articles });
    return;
  }

  if (c.articles && isStale) {
    res.json({ articles: c.articles });
    refreshCache(lang);
    return;
  }

  // Cold start — wait for first fetch
  await refreshCache(lang);
  res.json({ articles: c.articles ?? [] });
});

export default router;
