import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType, CandlestickSeries, LineSeries, HistogramSeries } from 'lightweight-charts';
import TradingIndicatorSelector, { INDICATOR_COLORS } from './TradingIndicatorSelector';
import {
  CandleData,
  calcSMA, calcEMA, calcRSI, calcMACD, calcBollinger,
  calcStochastic, calcATR, calcVWAP, calcSupportResistance,
} from '@/lib/tradingIndicators';
import { formatMarketPrice, getBidAskPrices, getSymbolPrecision } from '@/lib/tradingMarketData';

interface Props {
  symbol: string;
  onPriceChange: (price: number) => void;
  spread?: number;
  livePrice?: number;
}

const INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'];

const getPriceFormat = (symbol: string) => {
  const cfg = getSymbolPrecision(symbol);
  return { type: 'price' as const, precision: cfg.precision, minMove: cfg.minMove };
};

const TradingChart = ({ symbol, onPriceChange, spread = 0, livePrice: externalLivePrice = 0 }: Props) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const oscContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const oscChartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const overlaySeriesRef = useRef<Map<string, any>>(new Map());
  const oscSeriesRef = useRef<Map<string, any>>(new Map());
  const candlesRef = useRef<CandleData[]>([]);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const userInteractedRef = useRef<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);
  const loadingOlderRef = useRef<boolean>(false);
  const noMoreHistoryRef = useRef<boolean>(false);
  const oldestLoadedRef = useRef<number | null>(null); // ms
  const loadOlderHistoryRef = useRef<(() => void) | null>(null);

  const [interval, setInterval_] = useState('15m');
  const [livePrice, setLivePrice] = useState<number>(0);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [activeIndicators, setActiveIndicators] = useState<string[]>([]);
  const [wsStatus, setWsStatus] = useState<'live' | 'reconnecting' | 'offline'>('offline');

  // All USDT-suffix symbols use Binance (crypto, forex pairs, commodities).
  // Non-USDT symbols (stocks) use Yahoo Finance via the edge function.
  const isCryptoSymbol = (sym: string) => /USDT$/i.test(sym);

  const displayPrice = externalLivePrice || livePrice;
  const { bid: bidPrice, ask: askPrice } = getBidAskPrices(symbol, displayPrice, spread);

  const formatPrice = (price: number) => {
    if (price === 0) return '0.00';
    return formatMarketPrice(symbol, price);
  };

  const toggleIndicator = useCallback((id: string) => {
    setActiveIndicators(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }, []);

  const hasOscillator = activeIndicators.some(id => ['rsi', 'macd', 'stochastic', 'atr'].includes(id));

  const applyIndicators = useCallback((candles: CandleData[]) => {
    if (!chartRef.current || !candleSeriesRef.current) return;

    overlaySeriesRef.current.forEach((series) => { try { chartRef.current.removeSeries(series); } catch {} });
    overlaySeriesRef.current.clear();
    oscSeriesRef.current.forEach((series) => { try { oscChartRef.current?.removeSeries(series); } catch {} });
    oscSeriesRef.current.clear();

    if (candles.length < 2) return;

    const addOverlay = (id: string, data: { time: any; value: number }[], color: string, lineWidth = 1) => {
      if (data.length === 0) return;
      const series = chartRef.current.addSeries(LineSeries, {
        color, lineWidth, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
      });
      series.setData(data);
      overlaySeriesRef.current.set(id, series);
    };

    for (const id of activeIndicators) {
      const color = INDICATOR_COLORS[id] || '#888';
      switch (id) {
        case 'sma20': addOverlay('sma20', calcSMA(candles, 20), color); break;
        case 'sma50': addOverlay('sma50', calcSMA(candles, 50), color); break;
        case 'sma200': addOverlay('sma200', calcSMA(candles, 200), color); break;
        case 'ema12': addOverlay('ema12', calcEMA(candles, 12), color); break;
        case 'ema26': addOverlay('ema26', calcEMA(candles, 26), color); break;
        case 'ema200': addOverlay('ema200', calcEMA(candles, 200), color, 2); break;
        case 'vwap': addOverlay('vwap', calcVWAP(candles), color, 2); break;
        case 'bollinger': {
          const bb = calcBollinger(candles);
          addOverlay('bb_mid', bb.middle, color);
          addOverlay('bb_upper', bb.upper, `${color}99`);
          addOverlay('bb_lower', bb.lower, `${color}99`);
          break;
        }
        case 'support_resistance': {
          const sr = calcSupportResistance(candles);
          const times = candles.map(c => c.time);
          sr.supports.forEach((lvl, i) => {
            addOverlay(`sup_${i}`, times.map(t => ({ time: t, value: lvl })), '#22c55e', 1);
          });
          sr.resistances.forEach((lvl, i) => {
            addOverlay(`res_${i}`, times.map(t => ({ time: t, value: lvl })), '#ef4444', 1);
          });
          break;
        }
      }
    }

    if (!oscChartRef.current) return;
    const addOscLine = (id: string, data: { time: any; value: number }[], color: string, lw = 1) => {
      if (data.length === 0) return;
      const series = oscChartRef.current.addSeries(LineSeries, {
        color, lineWidth: lw, priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false,
      });
      series.setData(data);
      oscSeriesRef.current.set(id, series);
    };

    for (const id of activeIndicators) {
      const color = INDICATOR_COLORS[id] || '#888';
      switch (id) {
        case 'rsi': {
          const rsi = calcRSI(candles);
          addOscLine('rsi', rsi, color, 2);
          addOscLine('rsi_30', rsi.map(d => ({ time: d.time, value: 30 })), '#6b728044');
          addOscLine('rsi_70', rsi.map(d => ({ time: d.time, value: 70 })), '#6b728044');
          break;
        }
        case 'macd': {
          const macd = calcMACD(candles);
          addOscLine('macd_line', macd.macdLine, '#3b82f6', 2);
          addOscLine('macd_signal', macd.signalLine, '#f59e0b');
          if (macd.histogram.length > 0) {
            const histSeries = oscChartRef.current.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false });
            histSeries.setData(macd.histogram);
            oscSeriesRef.current.set('macd_hist', histSeries);
          }
          break;
        }
        case 'stochastic': {
          const stoch = calcStochastic(candles);
          addOscLine('stoch_k', stoch.kLine, '#f43f5e', 2);
          addOscLine('stoch_d', stoch.dLine, '#818cf8');
          break;
        }
        case 'atr': addOscLine('atr', calcATR(candles), color, 2); break;
      }
    }
  }, [activeIndicators]);

  // Create main chart — fill container
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    const chart = createChart(container, {
      layout: { background: { type: ColorType.Solid, color: '#1b1b2f' }, textColor: '#6b7082', fontSize: 10, attributionLogo: false },
      grid: { vertLines: { color: '#2d2d4422' }, horzLines: { color: '#2d2d4422' } },
      width: container.clientWidth,
      height: container.clientHeight,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#3a3a52',
        rightOffset: 8,
        barSpacing: 8,
        minBarSpacing: 0.5,
      },
      rightPriceScale: { borderColor: '#3a3a52', autoScale: true, scaleMargins: { top: 0.1, bottom: 0.1 } },
      crosshair: { mode: 0 },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
      kineticScroll: { mouse: false, touch: true },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a', downColor: '#ef5350',
      borderDownColor: '#ef5350', borderUpColor: '#26a69a',
      wickDownColor: '#ef5350', wickUpColor: '#26a69a',
      priceFormat: getPriceFormat(symbol),
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    // Detect user interaction + trigger lazy-load when scrolled near left edge
    const ts = chart.timeScale();
    const onRangeChange = (range: any) => {
      userInteractedRef.current = true;
      if (range && range.from < 20) {
        loadOlderHistoryRef.current?.();
      }
    };
    ts.subscribeVisibleLogicalRangeChange(onRangeChange);

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
    });
    ro.observe(container);
    resizeObserverRef.current = ro;

    return () => {
      try { ts.unsubscribeVisibleLogicalRangeChange(onRangeChange); } catch {}
      ro.disconnect();
      chart.remove();
    };
  }, []);

  // Oscillator sub-chart
  useEffect(() => {
    if (!hasOscillator || !oscContainerRef.current) {
      if (oscChartRef.current) { oscChartRef.current.remove(); oscChartRef.current = null; }
      return;
    }
    if (oscChartRef.current) return;

    const container = oscContainerRef.current;
    const oscChart = createChart(container, {
      layout: { background: { type: ColorType.Solid, color: '#1b1b2f' }, textColor: '#6b7082', fontSize: 9, attributionLogo: false },
      grid: { vertLines: { color: '#2d2d4415' }, horzLines: { color: '#2d2d4415' } },
      width: container.clientWidth,
      height: 120,
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: '#3a3a52' },
      rightPriceScale: { borderColor: '#3a3a52' },
      crosshair: { mode: 0 },
    });
    oscChartRef.current = oscChart;

    const ro = new ResizeObserver(() => {
      oscChart.applyOptions({ width: container.clientWidth });
    });
    ro.observe(container);

    applyIndicators(candlesRef.current);

    return () => { ro.disconnect(); oscChart.remove(); oscChartRef.current = null; };
  }, [hasOscillator, applyIndicators]);

  // ---- Helpers ----
  const intervalMs = (iv: string) => {
    const m: Record<string, number> = { '1m': 60_000, '5m': 300_000, '15m': 900_000, '1h': 3_600_000, '4h': 14_400_000, '1d': 86_400_000 };
    return m[iv] || 900_000;
  };

  const mapBinanceKline = (d: any[]): CandleData => ({
    time: Math.floor(Number(d[0]) / 1000) as any,
    open: Number(d[1]),
    high: Number(d[2]),
    low: Number(d[3]),
    close: Number(d[4]),
    volume: Number(d[5]),
  });

  // Initial load: tail only (most recent 1000 candles) → fast, no freeze.
  // Older candles are loaded on demand when the user scrolls left (infinite history).
  const fetchBinanceHistory = useCallback(async (sym: string, iv: string): Promise<CandleData[]> => {
    const URL = 'https://api.binance.com/api/v3/klines';
    try {
      const r = await fetch(`${URL}?symbol=${sym}&interval=${iv}&limit=1000`);
      const j = await r.json();
      if (!Array.isArray(j)) return [];
      return j.map(mapBinanceKline).filter(c => Number.isFinite(c.close));
    } catch { return []; }
  }, []);

  // Lazy load older candles ending strictly before `endTimeMs` (Binance/crypto).
  const fetchOlderBinance = useCallback(async (sym: string, iv: string, endTimeMs: number): Promise<CandleData[]> => {
    const URL = 'https://api.binance.com/api/v3/klines';
    try {
      const r = await fetch(`${URL}?symbol=${sym}&interval=${iv}&endTime=${endTimeMs - 1}&limit=1000`);
      const j = await r.json();
      if (!Array.isArray(j)) return [];
      return j.map(mapBinanceKline).filter(c => Number.isFinite(c.close));
    } catch { return []; }
  }, []);

  // ── Twelve Data helpers ───────────────────────────────────────────────────
  // Recent 500 candles for initial chart load (forex / commodities / stocks).
  const fetchTwelveDataHistory = useCallback(async (sym: string, iv: string): Promise<CandleData[]> => {
    const apiKey = import.meta.env.VITE_TWELVEDATA_API_KEY;
    if (!apiKey) return [];
    const ivMap: Record<string, string> = { '1m': '1min', '5m': '5min', '15m': '15min', '1h': '1h', '4h': '4h', '1d': '1day' };
    const parseTs = (dt: string) => Math.floor(new Date(dt.length === 10 ? `${dt}T00:00:00Z` : `${dt.replace(' ', 'T')}Z`).getTime() / 1000);
    try {
      const r = await fetch(`https://api.twelvedata.com/time_series?symbol=${sym}&interval=${ivMap[iv] || '1h'}&outputsize=500&apikey=${apiKey}`, { cache: 'no-store' });
      if (!r.ok) return [];
      const d = await r.json();
      if (d.status === 'error' || !Array.isArray(d.values)) return [];
      return (d.values as any[]).map(v => ({ time: parseTs(v.datetime) as any, open: +v.open, high: +v.high, low: +v.low, close: +v.close, volume: +(v.volume || 0) })).filter(c => Number.isFinite(c.close) && c.close > 0).reverse();
    } catch { return []; }
  }, []);

  // Lazy load older Twelve Data candles (non-crypto) when user scrolls left.
  const fetchTwelveDataOlder = useCallback(async (sym: string, iv: string, endTimeSec: number): Promise<CandleData[]> => {
    const apiKey = import.meta.env.VITE_TWELVEDATA_API_KEY;
    if (!apiKey) return [];
    const ivMap: Record<string, string> = { '1m': '1min', '5m': '5min', '15m': '15min', '1h': '1h', '4h': '4h', '1d': '1day' };
    const parseTs = (dt: string) => Math.floor(new Date(dt.length === 10 ? `${dt}T00:00:00Z` : `${dt.replace(' ', 'T')}Z`).getTime() / 1000);
    const endDt = new Date(endTimeSec * 1000).toISOString().replace('T', ' ').split('.')[0];
    try {
      const r = await fetch(`https://api.twelvedata.com/time_series?symbol=${sym}&interval=${ivMap[iv] || '1h'}&outputsize=500&end_date=${encodeURIComponent(endDt)}&apikey=${apiKey}`, { cache: 'no-store' });
      if (!r.ok) return [];
      const d = await r.json();
      if (d.status === 'error' || !Array.isArray(d.values)) return [];
      return (d.values as any[]).map(v => ({ time: parseTs(v.datetime) as any, open: +v.open, high: +v.high, low: +v.low, close: +v.close, volume: +(v.volume || 0) })).filter(c => Number.isFinite(c.close) && c.close > 0).reverse();
    } catch { return []; }
  }, []);

  // Triggered when user scrolls near the left edge → prepend older history.
  const loadOlderHistory = useCallback(async () => {
    if (loadingOlderRef.current || noMoreHistoryRef.current) return;
    const arr = candlesRef.current;
    if (arr.length === 0) return;
    loadingOlderRef.current = true;
    try {
      let older: CandleData[] = [];
      if (isCryptoSymbol(symbol)) {
        const oldestMs = oldestLoadedRef.current ?? Number(arr[0].time) * 1000;
        older = await fetchOlderBinance(symbol, interval, oldestMs);
      } else {
        // Yahoo time can be ISO string for 1d — normalize to seconds.
        const first = arr[0].time as any;
        const oldestSec = typeof first === 'string'
          ? Math.floor(new Date(first).getTime() / 1000)
          : Number(first);
        older = await fetchTwelveDataOlder(symbol, interval, oldestSec);
      }
      if (!older.length) { noMoreHistoryRef.current = true; return; }

      const ts = chartRef.current?.timeScale();
      const beforeRange = ts?.getVisibleLogicalRange();

      const keyOf = (c: CandleData) => typeof c.time === 'string' ? c.time : Number(c.time);
      const byTime = new Map<any, CandleData>();
      for (const c of older) byTime.set(keyOf(c), c);
      for (const c of arr) byTime.set(keyOf(c), c);
      const merged = Array.from(byTime.values()).sort((a, b) => {
        const ax = typeof a.time === 'string' ? new Date(a.time).getTime() / 1000 : Number(a.time);
        const bx = typeof b.time === 'string' ? new Date(b.time).getTime() / 1000 : Number(b.time);
        return ax - bx;
      });
      const addedCount = merged.length - arr.length;
      candlesRef.current = merged;
      const firstC = merged[0].time as any;
      oldestLoadedRef.current = (typeof firstC === 'string'
        ? new Date(firstC).getTime()
        : Number(firstC) * 1000);

      try { candleSeriesRef.current?.setData(merged); } catch {}

      if (beforeRange && ts && addedCount > 0) {
        try {
          ts.setVisibleLogicalRange({
            from: beforeRange.from + addedCount,
            to: beforeRange.to + addedCount,
          });
        } catch {}
      }

      applyIndicators(merged);
      if (older.length < 50) noMoreHistoryRef.current = true;
    } finally {
      loadingOlderRef.current = false;
    }
  }, [symbol, interval, fetchOlderBinance, fetchTwelveDataOlder, applyIndicators]);

  // Keep lazy-load callback ref in sync
  useEffect(() => { loadOlderHistoryRef.current = loadOlderHistory; }, [loadOlderHistory]);

  // Load historical data + auto-refresh while preserving user view (zoom/pan)
  useEffect(() => {
    let cancelled = false;
    userInteractedRef.current = false;
    // Reset infinite-history state for the new symbol/interval
    noMoreHistoryRef.current = false;
    oldestLoadedRef.current = null;
    loadingOlderRef.current = false;

    const loadHistorical = async (isInitial = false) => {
      try {
        let candles: CandleData[] = [];
        if (isCryptoSymbol(symbol)) {
          candles = await fetchBinanceHistory(symbol, interval);
        } else {
          candles = await fetchTwelveDataHistory(symbol, interval);
          if (candles.length === 0) return;
        }
        if (cancelled || candles.length === 0) return;

        const ts = chartRef.current?.timeScale();
        const previousRange = !isInitial && userInteractedRef.current ? ts?.getVisibleLogicalRange() : null;

        const timeToMs = (t: any) => typeof t === 'string' ? new Date(t).getTime() : Number(t) * 1000;
        const keyOf = (c: CandleData) => typeof c.time === 'string' ? c.time : Number(c.time);

        if (isInitial) {
          candlesRef.current = candles;
          oldestLoadedRef.current = timeToMs(candles[0].time);
        } else {
          // MERGE refresh — never wipe out older history loaded via lazy-loading
          const arr = candlesRef.current;
          const byTime = new Map<any, CandleData>();
          for (const c of arr) byTime.set(keyOf(c), c);
          for (const c of candles) byTime.set(keyOf(c), c);
          candlesRef.current = Array.from(byTime.values()).sort(
            (a, b) => timeToMs(a.time) - timeToMs(b.time)
          );
        }

        const dataset = candlesRef.current;
        if (candleSeriesRef.current) {
          candleSeriesRef.current.setData(dataset);
          if (previousRange && ts) {
            try { ts.setVisibleLogicalRange(previousRange); } catch {}
          } else if (isInitial && ts) {
            try { ts.fitContent(); } catch {}
          }
          if (dataset.length > 1) {
            const last = dataset[dataset.length - 1];
            const prev = dataset[dataset.length - 2];
            setLivePrice(last.close);
            setPriceChange(((last.close - prev.close) / prev.close) * 100);
            onPriceChange(last.close);
          }
        }
        applyIndicators(dataset);
      } catch (e) { console.error('Error loading klines:', e); }
    };
    loadHistorical(true);
    const refreshMs = interval === '1m' ? 30_000 : interval === '5m' ? 60_000 : 180_000;
    const id = window.setInterval(() => loadHistorical(false), refreshMs);
    return () => { cancelled = true; clearInterval(id); };
  }, [symbol, interval, onPriceChange, applyIndicators, fetchBinanceHistory, fetchTwelveDataHistory]);

  useEffect(() => { applyIndicators(candlesRef.current); }, [activeIndicators, applyIndicators]);

  // Apply per-symbol decimal precision to the price scale
  useEffect(() => {
    if (candleSeriesRef.current) {
      try { candleSeriesRef.current.applyOptions({ priceFormat: getPriceFormat(symbol) }); } catch {}
    }
  }, [symbol]);

  // Gap-fill helper: after a WS reconnect, fetch the most recent candles and merge them
  // so we don't miss any bar that closed while the socket was down.
  const gapFill = useCallback(async (sym: string, iv: string) => {
    if (!isCryptoSymbol(sym)) return;
    try {
      const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${iv}&limit=200`);
      const j = await r.json();
      if (!Array.isArray(j)) return;
      const fresh = j.map(mapBinanceKline).filter(c => Number.isFinite(c.close));
      const arr = candlesRef.current;
      const byTime = new Map<number, CandleData>();
      for (const c of arr) byTime.set(Number(c.time), c);
      let mutated = false;
      for (const c of fresh) {
        const t = Number(c.time);
        const existing = byTime.get(t);
        if (!existing || existing.close !== c.close || existing.high !== c.high || existing.low !== c.low) {
          byTime.set(t, c); mutated = true;
        }
      }
      if (!mutated) return;
      const merged = Array.from(byTime.values()).sort((a, b) => Number(a.time) - Number(b.time));
      candlesRef.current = merged;
      try { candleSeriesRef.current?.setData(merged); } catch {}
    } catch {}
  }, []);

  // ---- LIVE TICKS ----
  // For crypto: Binance kline WebSocket → tick-by-tick OHLC updates for the active interval.
  useEffect(() => {
    if (wsRef.current) { try { wsRef.current.close(); } catch {} wsRef.current = null; }
    if (!isCryptoSymbol(symbol)) { setWsStatus('offline'); return; }

    let cancelled = false;
    let attempt = 0;
    let reconnectTimer: number | undefined;
    let heartbeatTimer: number | undefined;
    let lastTickAt = Date.now();

    const connect = () => {
      if (cancelled) return;
      setWsStatus(attempt === 0 ? 'live' : 'reconnecting');
      const stream = `${symbol.toLowerCase()}@kline_${interval}`;
      const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${stream}`);
      wsRef.current = ws;

      ws.onopen = () => {
        attempt = 0;
        setWsStatus('live');
        // Always gap-fill on (re)connect to catch any candle closed offline.
        gapFill(symbol, interval);
      };
      ws.onmessage = (event) => {
        lastTickAt = Date.now();
        try {
          const msg = JSON.parse(event.data);
          const k = msg?.k;
          if (!k) return;
          const candle: CandleData = {
            time: Math.floor(Number(k.t) / 1000) as any,
            open: Number(k.o),
            high: Number(k.h),
            low: Number(k.l),
            close: Number(k.c),
            volume: Number(k.v),
          };
          if (!Number.isFinite(candle.close)) return;

          const arr = candlesRef.current;
          const last = arr[arr.length - 1];
          if (last && Number(last.time) === Number(candle.time)) {
            arr[arr.length - 1] = candle;
          } else if (!last || Number(candle.time) > Number(last.time)) {
            // If there's a gap larger than one interval, ask for a gap-fill
            if (last && Number(candle.time) - Number(last.time) > intervalMs(interval) / 1000 * 1.5) {
              gapFill(symbol, interval);
            }
            arr.push(candle);
          } else {
            return;
          }
          try { candleSeriesRef.current?.update(candle); } catch {}

          setLivePrice(candle.close);
          if (arr.length > 1) {
            const ref = arr[arr.length - 2].close;
            setPriceChange(((candle.close - ref) / ref) * 100);
          }
          onPriceChange(candle.close);
        } catch {}
      };
      ws.onclose = () => {
        if (cancelled) return;
        setWsStatus('reconnecting');
        const delay = Math.min(15000, 800 * 2 ** attempt++);
        reconnectTimer = window.setTimeout(connect, delay);
      };
      ws.onerror = () => { try { ws.close(); } catch {} };
    };

    // Watchdog: if no tick for >45s, force-reconnect and gap-fill.
    heartbeatTimer = window.setInterval(() => {
      if (Date.now() - lastTickAt > 45_000 && wsRef.current?.readyState === WebSocket.OPEN) {
        try { wsRef.current.close(); } catch {}
      }
    }, 15_000);

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (wsRef.current) { try { wsRef.current.close(); } catch {} wsRef.current = null; }
    };
  }, [symbol, interval, onPriceChange, gapFill]);

  // For non-crypto (forex / commodities) → use externalLivePrice (server polling)
  // to smoothly update the last candle in real time + drive the LIVE indicator.
  const lastForexTickRef = useRef<number>(0);
  useEffect(() => {
    if (isCryptoSymbol(symbol)) return;
    if (!externalLivePrice || candlesRef.current.length === 0) return;
    const candles = candlesRef.current;
    const last = candles[candles.length - 1];
    const updated = {
      ...last,
      high: Math.max(last.high, externalLivePrice),
      low: Math.min(last.low, externalLivePrice),
      close: externalLivePrice,
    };
    candles[candles.length - 1] = updated;
    try { candleSeriesRef.current?.update(updated); } catch {}
    setLivePrice(externalLivePrice);
    lastForexTickRef.current = Date.now();
    setWsStatus('live');
  }, [externalLivePrice, symbol]);

  // Forex freshness watchdog (no real WS): >30s without tick → reconnecting, >90s → offline.
  useEffect(() => {
    if (isCryptoSymbol(symbol)) return;
    setWsStatus('reconnecting');
    lastForexTickRef.current = 0;
    const id = window.setInterval(() => {
      const last = lastForexTickRef.current;
      if (!last) return;
      const age = Date.now() - last;
      if (age > 90_000) setWsStatus('offline');
      else if (age > 30_000) setWsStatus('reconnecting');
      else setWsStatus('live');
    }, 5_000);
    return () => clearInterval(id);
  }, [symbol]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* MT4-style chart toolbar */}
      <div className="h-7 flex items-center gap-0 bg-[#252540] border-b border-[#3a3a52] px-2 shrink-0">
        {/* Symbol & price info */}
        <div className="flex items-center gap-2 pr-3 border-r border-[#3a3a52]">
          <span className="text-[11px] font-bold text-[#c5c8d6]">{symbol.replace('USDT', '/USDT')}</span>
          {(
            <span className="flex items-center gap-1" title={`${isCryptoSymbol(symbol) ? 'Binance WebSocket' : 'Twelve Data'}: ${wsStatus}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${wsStatus === 'live' ? 'bg-emerald-400 animate-pulse' : wsStatus === 'reconnecting' ? 'bg-amber-400 animate-pulse' : 'bg-gray-500'}`} />
              <span className="text-[9px] text-[#6b7082] uppercase">{wsStatus === 'live' ? 'LIVE' : wsStatus === 'reconnecting' ? 'RECO' : 'OFF'}</span>
            </span>
          )}
          {spread > 0 && displayPrice > 0 ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-red-400">{formatPrice(bidPrice)}</span>
              <span className="text-[9px] text-[#6b7082]">/</span>
              <span className="text-[10px] font-mono text-blue-400">{formatPrice(askPrice)}</span>
              <span className="text-[9px] text-[#6b7082]">spd:{spread}</span>
            </div>
          ) : (
            <span className="text-[10px] font-mono text-[#c5c8d6]">{formatPrice(displayPrice)}</span>
          )}
          <span className={`text-[10px] font-mono ${priceChange >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]'}`}>
            {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
          </span>
        </div>

        {/* Timeframe buttons */}
        <div className="flex items-center gap-0 px-2 border-r border-[#3a3a52]">
          {INTERVALS.map(i => (
            <button
              key={i}
              onClick={() => setInterval_(i)}
              className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${
                interval === i
                  ? 'text-[#4a90d9] bg-[#4a90d920]'
                  : 'text-[#6b7082] hover:text-[#8a8fa3]'
              }`}
            >
              {i.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Indicator selector */}
        <div className="px-2">
          <TradingIndicatorSelector activeIndicators={activeIndicators} onToggle={toggleIndicator} />
        </div>

        {/* Active indicator pills */}
        {activeIndicators.length > 0 && (
          <div className="flex items-center gap-1 px-2 overflow-hidden">
            {activeIndicators.map(id => (
              <button
                key={id}
                onClick={() => toggleIndicator(id)}
                className="flex items-center gap-0.5 px-1.5 py-0 rounded text-[9px] font-medium bg-[#2d2d44] text-[#8a8fa3] hover:bg-[#3a3a52] transition-colors"
              >
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: INDICATOR_COLORS[id] }} />
                {id.toUpperCase().replace('BOLLINGER', 'BB')}
                <span className="text-[#6b7082] ml-0.5">×</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chart area — fills remaining space */}
      <div ref={chartContainerRef} className="flex-1 min-h-0" />

      {/* Oscillator sub-chart */}
      {hasOscillator && (
        <div className="h-[120px] shrink-0 border-t border-[#3a3a52]">
          <div ref={oscContainerRef} className="w-full h-full" />
        </div>
      )}
    </div>
  );
};

export default TradingChart;
