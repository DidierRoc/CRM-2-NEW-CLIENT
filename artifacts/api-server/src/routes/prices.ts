import { Router, type IRouter } from "express";

const router: IRouter = Router();

const YF_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Map our commodity symbols → Yahoo Finance futures symbols
const COMMODITY_TO_YF: Record<string, string> = {
  "XAU/USD":    "GC=F",
  "XAG/USD":    "SI=F",
  "WTI/USD":    "CL=F",
  "BRENT/USD":  "BZ=F",
  "XPT/USD":    "PL=F",
  "XPD/USD":    "PA=F",
  "NG/USD":     "NG=F",
  "COPPER/USD": "HG=F",
};

// Reverse map for remapping response keys
const YF_TO_COMMODITY: Record<string, string> = Object.fromEntries(
  Object.entries(COMMODITY_TO_YF).map(([ours, yf]) => [yf, ours]),
);

async function fetchSparkPrices(yfSymbols: string[]): Promise<Record<string, number>> {
  if (!yfSymbols.length) return {};
  const url =
    `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${yfSymbols.join(",")}&range=1d&interval=5m`;
  const res = await fetch(url, { headers: { "User-Agent": YF_UA } });
  if (!res.ok) return {};
  const data = (await res.json()) as Record<string, { close?: number[] }>;
  const out: Record<string, number> = {};
  for (const [sym, val] of Object.entries(data)) {
    const closes = val?.close;
    if (Array.isArray(closes) && closes.length > 0) {
      const price = closes[closes.length - 1];
      if (typeof price === "number" && price > 0) out[sym] = price;
    }
  }
  return out;
}

// GET /api/prices?symbols=AAPL,MSFT,XAU/USD,...
// Returns { AAPL: 297.8, MSFT: 394.2, "XAU/USD": 4345.3, ... }
router.get("/prices", async (req, res) => {
  try {
    const raw = (req.query["symbols"] as string | undefined) ?? "";
    if (!raw.trim()) { res.json({}); return; }

    const ourSymbols = raw.split(",").map(s => s.trim()).filter(Boolean);

    // Map commodity symbols to Yahoo Finance equivalents; stocks stay the same
    const yfSymbols = ourSymbols.map(s => COMMODITY_TO_YF[s] ?? s);

    // Yahoo Finance spark supports max ~8 symbols per request.
    // Run all batches in parallel for speed.
    const BATCH = 8;
    const batches: string[][] = [];
    for (let i = 0; i < yfSymbols.length; i += BATCH) {
      batches.push(yfSymbols.slice(i, i + BATCH));
    }
    const batchResults = await Promise.all(batches.map(fetchSparkPrices));
    const yfPrices: Record<string, number> = {};
    for (const result of batchResults) Object.assign(yfPrices, result);

    // Remap Yahoo Finance symbols back to our canonical symbols
    const mapped: Record<string, number> = {};
    for (const [ours, yf] of Object.entries(COMMODITY_TO_YF)) {
      if (yfPrices[yf] !== undefined) mapped[ours] = yfPrices[yf]!;
    }
    for (const [sym, price] of Object.entries(yfPrices)) {
      if (!YF_TO_COMMODITY[sym]) mapped[sym] = price; // stock symbols pass through
    }

    res.json(mapped);
  } catch (err) {
    req.log.error({ err }, "prices proxy error");
    res.status(500).json({ error: "Failed to fetch prices" });
  }
});

export default router;
