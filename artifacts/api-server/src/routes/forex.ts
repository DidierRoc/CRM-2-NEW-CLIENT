import { Router, type IRouter } from "express";

const router: IRouter = Router();

// GET /api/forex
// Proxies Frankfurter.dev (ECB rates, free, no key) — avoids CORS issues from browser.
// Returns { rates: { EUR: 0.86, GBP: 0.74, ... }, base: "USD", date: "2026-06-16" }
router.get("/forex", async (req, res) => {
  try {
    const response = await fetch("https://api.frankfurter.dev/v1/latest?from=USD", {
      headers: { "Accept": "application/json" },
    });
    if (!response.ok) {
      res.status(502).json({ error: "Upstream forex API error" });
      return;
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "forex proxy error");
    res.status(500).json({ error: "Failed to fetch forex rates" });
  }
});

export default router;
