import { useEffect, useMemo, useRef, useState } from 'react';
import { MarketQuote, TradingSymbolDef, roundMarketPrice } from '@/lib/tradingMarketData';

const BINANCE_WS_URL = 'wss://stream.binance.com:9443/stream?streams=';
const PRICE_CACHE_KEY = 'mt4_market_quotes_v8';

const MAX_MOVE: Record<string, number> = {
  forex: 0.005, commodities: 0.05, crypto: 0.08, stocks: 0.15,
};

const isBinance = (sym: string) => /USDT$/i.test(sym);

const updateQuote = (symbol: string, price: number, source: MarketQuote['source']): MarketQuote => ({
  price: roundMarketPrice(symbol, price),
  source,
  updatedAt: Date.now(),
});

const isValidMove = (prev: MarketQuote | undefined, p: number, type: string): boolean => {
  if (!prev?.price) return true;
  const ratio = Math.abs(p - prev.price) / prev.price;
  return ratio <= (MAX_MOVE[type] ?? 0.10) || Date.now() - prev.updatedAt > 120_000;
};

const mergeQuote = (
  prev: Record<string, MarketQuote>,
  symbol: string,
  price: number,
  source: MarketQuote['source'],
  type: string,
): Record<string, MarketQuote> => {
  if (!Number.isFinite(price) || price <= 0 || !isValidMove(prev[symbol], price, type)) return prev;
  return { ...prev, [symbol]: updateQuote(symbol, price, source) };
};

// Frankfurter rates are relative to USD: rates[X] = amount of X per 1 USD.
// price(BASE/QUOTE) = rates[QUOTE] / rates[BASE]   (USD counts as 1)
const forexPrice = (base: string, quote: string, rates: Record<string, number>): number | null => {
  const bRate = base === 'USD' ? 1 : rates[base];
  const qRate = quote === 'USD' ? 1 : rates[quote];
  if (!bRate || !qRate) return null;
  return qRate / bRate;
};

export const useRealtimeMarketPrices = (symbols: TradingSymbolDef[]) => {
  const [quotes, setQuotes] = useState<Record<string, MarketQuote>>(() => {
    try { return JSON.parse(localStorage.getItem(PRICE_CACHE_KEY) || '{}'); } catch { return {}; }
  });

  const symbolTypeMap = useMemo(
    () => Object.fromEntries(symbols.map(s => [s.symbol, s.type])),
    [symbols],
  );
  const cryptoSymbols    = useMemo(() => symbols.filter(s =>  isBinance(s.symbol)).map(s => s.symbol), [symbols]);
  const forexSymbols     = useMemo(() => symbols.filter(s => s.type === 'forex').map(s => s.symbol), [symbols]);
  const commoditySymbols = useMemo(() => symbols.filter(s => s.type === 'commodities').map(s => s.symbol), [symbols]);
  const stockSymbols     = useMemo(() => symbols.filter(s => s.type === 'stocks').map(s => s.symbol), [symbols]);

  const cryptoKey    = cryptoSymbols.join(',');
  const forexKey     = forexSymbols.join(',');
  const pricesKey    = [...commoditySymbols, ...stockSymbols].join(',');

  // Persist cache to localStorage
  useEffect(() => {
    try { localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify(quotes)); } catch {}
  }, [quotes]);

  // ── 1. Binance WebSocket — real-time crypto ──────────────────────────────
  useEffect(() => {
    if (!cryptoSymbols.length) return;
    let cancelled = false;
    let attempts = 0;
    let ws: WebSocket | null = null;
    let timer: number | undefined;

    const connect = () => {
      if (cancelled) return;
      const streams = cryptoSymbols.map(s => `${s.toLowerCase()}@trade`).join('/');
      ws = new WebSocket(`${BINANCE_WS_URL}${streams}`);
      ws.onopen = () => { attempts = 0; };
      ws.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data)?.data;
          const p = Number(d?.p);
          if (d?.s && Number.isFinite(p))
            setQuotes(prev => mergeQuote(prev, d.s, p, 'binance_ws', symbolTypeMap[d.s] || 'crypto'));
        } catch {}
      };
      ws.onclose = () => {
        if (cancelled) return;
        timer = window.setTimeout(connect, Math.min(30_000, 1_000 * 2 ** attempts++));
      };
      ws.onerror = () => ws?.close();
    };

    connect();
    return () => { cancelled = true; ws?.close(); clearTimeout(timer); };
  }, [cryptoKey]);

  // ── 2. Binance REST — crypto snapshot every 10s ──────────────────────────
  useEffect(() => {
    if (!cryptoSymbols.length) return;
    let cancelled = false;
    const fetch_ = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(
          `https://api.binance.com/api/v3/ticker/price?symbols=${JSON.stringify(cryptoSymbols)}`,
          { cache: 'no-store' },
        );
        if (!res.ok || cancelled) return;
        const items: { symbol: string; price: string }[] = await res.json();
        setQuotes(prev => {
          let next = prev;
          for (const it of items) {
            const p = parseFloat(it.price);
            if (Number.isFinite(p))
              next = mergeQuote(next, it.symbol, p, 'binance_rest', symbolTypeMap[it.symbol] || 'crypto');
          }
          return next;
        });
      } catch {}
    };
    fetch_();
    const t = window.setInterval(fetch_, 10_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [cryptoKey]);

  // ── 3. Frankfurter.app — forex (free, no key, CORS OK) ──────────────────
  // ECB rates updated each business day. 1 call covers all pairs.
  useEffect(() => {
    if (!forexSymbols.length) return;
    let cancelled = false;

    const fetch_ = async () => {
      if (cancelled) return;
      try {
        const res = await fetch('/api/forex', { cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const rates: Record<string, number> = { ...data.rates, USD: 1 };
        setQuotes(prev => {
          let next = prev;
          for (const sym of forexSymbols) {
            const [base, quote] = sym.split('/');
            if (!base || !quote) continue;
            const price = forexPrice(base, quote, rates);
            if (price !== null)
              next = mergeQuote(next, sym, price, 'frankfurter_rest', 'forex');
          }
          return next;
        });
      } catch {}
    };

    fetch_();
    const t = window.setInterval(fetch_, 10 * 60_000); // every 10 min (ECB updates once/day anyway)
    return () => { cancelled = true; clearInterval(t); };
  }, [forexKey]);

  // ── 4. /api/prices proxy — stocks + commodities via Yahoo Finance ────────
  // Our own backend proxies Yahoo Finance (free, no API key, no credits).
  // Poll every 5 min — suitable for both asset classes.
  const pricesKeyRef = useRef(pricesKey);
  pricesKeyRef.current = pricesKey;
  const symbolTypeMapRef = useRef(symbolTypeMap);
  symbolTypeMapRef.current = symbolTypeMap;

  useEffect(() => {
    const allSymbols = [...commoditySymbols, ...stockSymbols];
    if (!allSymbols.length) return;
    let cancelled = false;

    const fetch_ = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(
          `/api/prices?symbols=${encodeURIComponent(pricesKeyRef.current)}`,
          { cache: 'no-store' },
        );
        if (!res.ok || cancelled) return;
        const data: Record<string, number> = await res.json();
        setQuotes(prev => {
          let next = prev;
          for (const [sym, price] of Object.entries(data)) {
            const type = symbolTypeMapRef.current[sym] || 'stocks';
            if (Number.isFinite(price) && price > 0)
              next = mergeQuote(next, sym, price, 'market_api', type);
          }
          return next;
        });
      } catch {}
    };

    fetch_();
    const t = window.setInterval(fetch_, 5 * 60_000); // every 5 min
    return () => { cancelled = true; clearInterval(t); };
  }, [pricesKey]);

  return useMemo(() => ({
    quotes,
    prices: Object.fromEntries(
      Object.entries(quotes).map(([s, q]) => [s, q.price])
    ) as Record<string, number>,
  }), [quotes]);
};
