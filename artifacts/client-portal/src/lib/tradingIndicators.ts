// ─── Technical Indicators Calculator ───

export interface CandleData {
  time: any;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

// Simple Moving Average
export function calcSMA(data: CandleData[], period: number): { time: any; value: number }[] {
  const result: { time: any; value: number }[] = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += data[i - j].close;
    result.push({ time: data[i].time, value: sum / period });
  }
  return result;
}

// Exponential Moving Average
export function calcEMA(data: CandleData[], period: number): { time: any; value: number }[] {
  if (data.length < period) return [];
  const k = 2 / (period + 1);
  const result: { time: any; value: number }[] = [];
  
  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[i].close;
  let ema = sum / period;
  result.push({ time: data[period - 1].time, value: ema });

  for (let i = period; i < data.length; i++) {
    ema = data[i].close * k + ema * (1 - k);
    result.push({ time: data[i].time, value: ema });
  }
  return result;
}

// RSI (Relative Strength Index)
export function calcRSI(data: CandleData[], period: number = 14): { time: any; value: number }[] {
  if (data.length < period + 1) return [];
  const result: { time: any; value: number }[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  result.push({ time: data[period].time, value: rsi });

  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    const val = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    result.push({ time: data[i + 1].time, value: val });
  }
  return result;
}

// MACD
export function calcMACD(data: CandleData[], fast = 12, slow = 26, signal = 9) {
  const emaFast = calcEMA(data, fast);
  const emaSlow = calcEMA(data, slow);

  const macdLine: { time: any; value: number }[] = [];
  const slowMap = new Map(emaSlow.map(d => [String(d.time), d.value]));

  for (const f of emaFast) {
    const s = slowMap.get(String(f.time));
    if (s !== undefined) {
      macdLine.push({ time: f.time, value: f.value - s });
    }
  }

  // Signal line (EMA of MACD)
  const signalData: CandleData[] = macdLine.map(d => ({
    time: d.time, open: d.value, high: d.value, low: d.value, close: d.value,
  }));
  const signalLine = calcEMA(signalData, signal);

  // Histogram
  const signalMap = new Map(signalLine.map(d => [String(d.time), d.value]));
  const histogram: { time: any; value: number; color: string }[] = [];
  for (const m of macdLine) {
    const s = signalMap.get(String(m.time));
    if (s !== undefined) {
      const val = m.value - s;
      histogram.push({ time: m.time, value: val, color: val >= 0 ? '#22c55e' : '#ef4444' });
    }
  }

  return { macdLine, signalLine, histogram };
}

// Bollinger Bands
export function calcBollinger(data: CandleData[], period = 20, stdDev = 2) {
  const middle = calcSMA(data, period);
  const upper: { time: any; value: number }[] = [];
  const lower: { time: any; value: number }[] = [];

  for (let i = 0; i < middle.length; i++) {
    const idx = i + period - 1;
    let sumSq = 0;
    for (let j = 0; j < period; j++) {
      const diff = data[idx - j].close - middle[i].value;
      sumSq += diff * diff;
    }
    const std = Math.sqrt(sumSq / period);
    upper.push({ time: middle[i].time, value: middle[i].value + stdDev * std });
    lower.push({ time: middle[i].time, value: middle[i].value - stdDev * std });
  }
  return { middle, upper, lower };
}

// Stochastic Oscillator
export function calcStochastic(data: CandleData[], kPeriod = 14, dPeriod = 3) {
  const kLine: { time: any; value: number }[] = [];

  for (let i = kPeriod - 1; i < data.length; i++) {
    let high = -Infinity, low = Infinity;
    for (let j = 0; j < kPeriod; j++) {
      high = Math.max(high, data[i - j].high);
      low = Math.min(low, data[i - j].low);
    }
    const k = high === low ? 50 : ((data[i].close - low) / (high - low)) * 100;
    kLine.push({ time: data[i].time, value: k });
  }

  // %D is SMA of %K
  const dLine: { time: any; value: number }[] = [];
  for (let i = dPeriod - 1; i < kLine.length; i++) {
    let sum = 0;
    for (let j = 0; j < dPeriod; j++) sum += kLine[i - j].value;
    dLine.push({ time: kLine[i].time, value: sum / dPeriod });
  }

  return { kLine, dLine };
}

// ATR (Average True Range)
export function calcATR(data: CandleData[], period = 14): { time: any; value: number }[] {
  if (data.length < 2) return [];
  const trueRanges: { time: any; value: number }[] = [];

  for (let i = 1; i < data.length; i++) {
    const tr = Math.max(
      data[i].high - data[i].low,
      Math.abs(data[i].high - data[i - 1].close),
      Math.abs(data[i].low - data[i - 1].close)
    );
    trueRanges.push({ time: data[i].time, value: tr });
  }

  const result: { time: any; value: number }[] = [];
  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b.value, 0) / period;
  result.push({ time: trueRanges[period - 1].time, value: atr });

  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i].value) / period;
    result.push({ time: trueRanges[i].time, value: atr });
  }
  return result;
}

// Support / Resistance — detects pivot highs (resistance) and pivot lows (support)
// using a left/right window, then clusters nearby levels and returns the most recent ones.
export function calcSupportResistance(
  data: CandleData[],
  lookback = 5,
  maxLevels = 3,
  clusterPct = 0.005,
): { supports: number[]; resistances: number[] } {
  if (data.length < lookback * 2 + 1) return { supports: [], resistances: [] };

  const pivotHighs: { idx: number; price: number }[] = [];
  const pivotLows: { idx: number; price: number }[] = [];

  for (let i = lookback; i < data.length - lookback; i++) {
    const h = data[i].high;
    const l = data[i].low;
    let isHigh = true, isLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (data[i - j].high >= h || data[i + j].high >= h) isHigh = false;
      if (data[i - j].low <= l || data[i + j].low <= l) isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh) pivotHighs.push({ idx: i, price: h });
    if (isLow) pivotLows.push({ idx: i, price: l });
  }

  const refPrice = data[data.length - 1].close;
  const cluster = (pivots: { idx: number; price: number }[]) => {
    // Most recent first
    const sorted = [...pivots].sort((a, b) => b.idx - a.idx);
    const levels: number[] = [];
    for (const p of sorted) {
      if (levels.some(lv => Math.abs(lv - p.price) / refPrice < clusterPct)) continue;
      levels.push(p.price);
      if (levels.length >= maxLevels) break;
    }
    return levels;
  };

  return { supports: cluster(pivotLows), resistances: cluster(pivotHighs) };
}

// VWAP (simplified using close*volume proxy)
export function calcVWAP(data: CandleData[]): { time: any; value: number }[] {
  const result: { time: any; value: number }[] = [];
  let cumPV = 0;
  let cumVol = 0;

  for (const d of data) {
    const typicalPrice = (d.high + d.low + d.close) / 3;
    const vol = d.volume || 1;
    cumPV += typicalPrice * vol;
    cumVol += vol;
    result.push({ time: d.time, value: cumPV / cumVol });
  }
  return result;
}

// Indicator definitions for the UI
export interface IndicatorDef {
  id: string;
  label: string;
  category: 'overlay' | 'oscillator';
  description: string;
  defaultActive?: boolean;
}

export const AVAILABLE_INDICATORS: IndicatorDef[] = [
  { id: 'sma20', label: 'SMA 20', category: 'overlay', description: 'Moyenne mobile simple 20 périodes' },
  { id: 'sma50', label: 'SMA 50', category: 'overlay', description: 'Moyenne mobile simple 50 périodes' },
  { id: 'sma200', label: 'SMA 200', category: 'overlay', description: 'Moyenne mobile simple 200 périodes' },
  { id: 'ema12', label: 'EMA 12', category: 'overlay', description: 'Moyenne mobile exponentielle 12' },
  { id: 'ema26', label: 'EMA 26', category: 'overlay', description: 'Moyenne mobile exponentielle 26' },
  { id: 'ema200', label: 'EMA 200', category: 'overlay', description: 'Moyenne mobile exponentielle 200 (tendance long terme)' },
  { id: 'bollinger', label: 'Bandes de Bollinger', category: 'overlay', description: 'Bandes de Bollinger (20, 2)' },
  { id: 'support_resistance', label: 'Support / Résistance', category: 'overlay', description: 'Niveaux clés (pivots récents)' },
  { id: 'vwap', label: 'VWAP', category: 'overlay', description: 'Prix moyen pondéré par volume' },
  { id: 'rsi', label: 'RSI (14)', category: 'oscillator', description: 'Indice de force relative' },
  { id: 'macd', label: 'MACD', category: 'oscillator', description: 'Convergence/Divergence des MM' },
  { id: 'stochastic', label: 'Stochastique', category: 'oscillator', description: 'Oscillateur stochastique (14, 3)' },
  { id: 'atr', label: 'ATR (14)', category: 'oscillator', description: 'Average True Range' },
];
