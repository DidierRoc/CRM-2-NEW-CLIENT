export interface TradingSymbolDef {
  symbol: string;
  label: string;
  type: string;
  spreadKey: string;
}

export interface MarketQuote {
  price: number;
  source: 'binance_ws' | 'binance_rest' | 'twelvedata_ws' | 'twelvedata_rest' | 'frankfurter_rest' | 'market_api' | 'yahoo_finance';
  updatedAt: number;
}

export const SYMBOL_PRECISION: Record<string, { precision: number; minMove: number }> = {
  // ── Crypto (Binance USDT) ─────────────────────────────────────────────
  BTCUSDT:      { precision: 2, minMove: 0.01 },
  ETHUSDT:      { precision: 2, minMove: 0.01 },
  BNBUSDT:      { precision: 2, minMove: 0.01 },
  LTCUSDT:      { precision: 2, minMove: 0.01 },
  MKRUSDT:      { precision: 2, minMove: 0.01 },
  AAVEUSDT:     { precision: 2, minMove: 0.01 },
  SOLUSDT:      { precision: 2, minMove: 0.01 },
  AVAXUSDT:     { precision: 2, minMove: 0.01 },
  APTUSDT:      { precision: 3, minMove: 0.001 },
  ATOMUSDT:     { precision: 3, minMove: 0.001 },
  NEARUSDT:     { precision: 3, minMove: 0.001 },
  LINKUSDT:     { precision: 3, minMove: 0.001 },
  DOTUSDT:      { precision: 3, minMove: 0.001 },
  UNIUSDT:      { precision: 3, minMove: 0.001 },
  INJUSDT:      { precision: 3, minMove: 0.001 },
  FILUSDT:      { precision: 3, minMove: 0.001 },
  RENDERUSDT:   { precision: 3, minMove: 0.001 },
  SUIUSDT:      { precision: 3, minMove: 0.001 },
  XRPUSDT:      { precision: 4, minMove: 0.0001 },
  ADAUSDT:      { precision: 4, minMove: 0.0001 },
  TRXUSDT:      { precision: 4, minMove: 0.0001 },
  ARBUSDT:      { precision: 4, minMove: 0.0001 },
  OPUSDT:       { precision: 4, minMove: 0.0001 },
  FETUSDT:      { precision: 4, minMove: 0.0001 },
  ENAUSDT:      { precision: 4, minMove: 0.0001 },
  JUPUSDT:      { precision: 4, minMove: 0.0001 },
  WLDUSDT:      { precision: 4, minMove: 0.0001 },
  JTOUSDT:      { precision: 4, minMove: 0.0001 },
  MANAUSDT:     { precision: 4, minMove: 0.0001 },
  SANDUSDT:     { precision: 4, minMove: 0.0001 },
  DOGEUSDT:     { precision: 5, minMove: 0.00001 },
  GALAUSDT:     { precision: 5, minMove: 0.00001 },
  SHIBUSDT:     { precision: 8, minMove: 0.00000001 },
  PEPEUSDT:     { precision: 8, minMove: 0.00000001 },
  // ── Forex majors (Twelve Data format) ────────────────────────────────
  'EUR/USD':    { precision: 5, minMove: 0.00001 },
  'GBP/USD':    { precision: 5, minMove: 0.00001 },
  'AUD/USD':    { precision: 5, minMove: 0.00001 },
  'NZD/USD':    { precision: 5, minMove: 0.00001 },
  'USD/CHF':    { precision: 5, minMove: 0.00001 },
  'USD/CAD':    { precision: 5, minMove: 0.00001 },
  'EUR/GBP':    { precision: 5, minMove: 0.00001 },
  'EUR/CHF':    { precision: 5, minMove: 0.00001 },
  'EUR/AUD':    { precision: 5, minMove: 0.00001 },
  'EUR/CAD':    { precision: 5, minMove: 0.00001 },
  'GBP/CHF':    { precision: 5, minMove: 0.00001 },
  'GBP/AUD':    { precision: 5, minMove: 0.00001 },
  'GBP/CAD':    { precision: 5, minMove: 0.00001 },
  'AUD/CAD':    { precision: 5, minMove: 0.00001 },
  'NZD/CAD':    { precision: 5, minMove: 0.00001 },
  'AUD/NZD':    { precision: 5, minMove: 0.00001 },
  // JPY pairs — 3 decimal places
  'USD/JPY':    { precision: 3, minMove: 0.001 },
  'EUR/JPY':    { precision: 3, minMove: 0.001 },
  'GBP/JPY':    { precision: 3, minMove: 0.001 },
  'AUD/JPY':    { precision: 3, minMove: 0.001 },
  'CAD/JPY':    { precision: 3, minMove: 0.001 },
  'CHF/JPY':    { precision: 3, minMove: 0.001 },
  'NZD/JPY':    { precision: 3, minMove: 0.001 },
  // Exotic
  'USD/MXN':    { precision: 4, minMove: 0.0001 },
  'USD/SGD':    { precision: 5, minMove: 0.00001 },
  'USD/NOK':    { precision: 4, minMove: 0.0001 },
  'USD/SEK':    { precision: 4, minMove: 0.0001 },
  'USD/ZAR':    { precision: 4, minMove: 0.0001 },
  // ── Commodities (Twelve Data format) ─────────────────────────────────
  'XAU/USD':    { precision: 2, minMove: 0.01 },
  'XAG/USD':    { precision: 3, minMove: 0.001 },
  'WTI/USD':    { precision: 2, minMove: 0.01 },
  'BRENT/USD':  { precision: 2, minMove: 0.01 },
  'XPT/USD':    { precision: 2, minMove: 0.01 },
  'XPD/USD':    { precision: 2, minMove: 0.01 },
  'NG/USD':     { precision: 3, minMove: 0.001 },
  'COPPER/USD': { precision: 4, minMove: 0.0001 },
  // ── Stocks — default precision 2 covers all equities & ETFs ──────────
};

export const getSymbolPrecision = (symbol: string) =>
  SYMBOL_PRECISION[symbol] || { precision: 2, minMove: 0.01 };

export const roundMarketPrice = (symbol: string, price: number) => {
  const { precision } = getSymbolPrecision(symbol);
  return Number(price.toFixed(precision));
};

export const spreadPointsToPriceDelta = (symbol: string, spreadPoints = 0) => {
  if (!Number.isFinite(spreadPoints) || spreadPoints <= 0) return 0;
  return spreadPoints * getSymbolPrecision(symbol).minMove;
};

export const getBidAskPrices = (symbol: string, midPrice: number, spreadPoints = 0) => {
  if (!Number.isFinite(midPrice) || midPrice <= 0) return { bid: 0, ask: 0, delta: 0 };
  const delta = spreadPointsToPriceDelta(symbol, spreadPoints);
  return {
    bid: roundMarketPrice(symbol, midPrice - delta / 2),
    ask: roundMarketPrice(symbol, midPrice + delta / 2),
    delta,
  };
};

export const formatMarketPrice = (symbol: string, price: number) => {
  if (!Number.isFinite(price) || price <= 0) return '—';
  const { precision } = getSymbolPrecision(symbol);
  return price.toLocaleString('en-US', { minimumFractionDigits: precision, maximumFractionDigits: precision });
};
