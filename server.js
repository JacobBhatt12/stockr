const express = require("express");
const cors    = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const FINNHUB_KEY   = process.env.FINNHUB_KEY;
const BASE = "https://finnhub.io/api/v1";

async function finnhub(path) {
  const res = await fetch(`${BASE}${path}&token=${FINNHUB_KEY}`);
  if (!res.ok) throw new Error(`Finnhub ${res.status}`);
  return res.json();
}

// ── Search any stock in the world ───────────────────────────────────────────
app.get("/api/search", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    const data = await finnhub(`/search?q=${encodeURIComponent(q)}`);
    const results = (data.result || [])
      .filter(r => r.type === "Common Stock" && r.symbol && !r.symbol.includes("."))
      .slice(0, 10)
      .map(r => ({ ticker: r.symbol, name: r.description }));
    res.json(results);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Get full profile + quote for one stock ──────────────────────────────────
app.get("/api/quote/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    const [quote, profile] = await Promise.all([
      finnhub(`/quote?symbol=${symbol}`),
      finnhub(`/stock/profile2?symbol=${symbol}`),
    ]);
    res.json({
      ticker:    symbol,
      name:      profile.name || symbol,
      sector:    profile.finnhubIndustry || "Unknown",
      logo:      profile.logo || "",
      exchange:  profile.exchange || "",
      currency:  profile.currency || "USD",
      price:     quote.c  || quote.pc || 0,
      change:    quote.dp || 0,
      high:      quote.h  || 0,
      low:       quote.l  || 0,
      open:      quote.o  || 0,
      prevClose: quote.pc || 0,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Batch refresh prices for watchlist ──────────────────────────────────────
app.post("/api/quotes", async (req, res) => {
  try {
    const { tickers } = req.body;
    if (!tickers?.length) return res.json([]);
    const results = await Promise.all(
      tickers.map(async ticker => {
        try {
          const q = await finnhub(`/quote?symbol=${ticker}`);
          return { ticker, price:q.c||q.pc||0, change:q.dp||0, high:q.h, low:q.l, prevClose:q.pc };
        } catch { return { ticker, price:0, change:0 }; }
      })
    );
    res.json(results);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Company news ─────────────────────────────────────────────────────────────
app.get("/api/news/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    const today = new Date(), week = new Date(today - 7*24*60*60*1000);
    const from  = week.toISOString().split("T")[0];
    const to    = today.toISOString().split("T")[0];
    const data  = await finnhub(`/company-news?symbol=${symbol}&from=${from}&to=${to}`);
    res.json((data||[]).slice(0,10));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Price history for charts (supports 1W/1M/3M/6M/1Y) ──────────────────────
app.get("/api/candles/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    const { timeframe = "1M" } = req.query;
    const to = Math.floor(Date.now()/1000);
    let from, resolution;
    switch (timeframe) {
      case "1W": from = to - 7*24*60*60;   resolution = "60"; break;
      case "3M": from = to - 90*24*60*60;  resolution = "D";  break;
      case "6M": from = to - 180*24*60*60; resolution = "D";  break;
      case "1Y": from = to - 365*24*60*60; resolution = "D";  break;
      default:   from = to - 30*24*60*60;  resolution = "D";  // 1M
    }
    const data = await finnhub(`/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${to}`);
    if (data.s !== "ok" || !data.t?.length) return res.json([]);
    res.json(data.t.map((t,i) => ({
      time:   resolution === "60"
        ? new Date(t*1000).toLocaleString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit",hour12:false})
        : new Date(t*1000).toLocaleDateString("en-US",{month:"short",day:"numeric"}),
      open:   data.o[i],
      high:   data.h[i],
      low:    data.l[i],
      close:  data.c[i],
      volume: data.v[i],
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Market sentiment ─────────────────────────────────────────────────────────
app.get("/api/sentiment", async (req, res) => {
  try {
    const tickers = ["AAPL","MSFT","NVDA","GOOGL","AMZN","TSLA","META","JPM","V","WMT"];
    const quotes  = await Promise.all(tickers.map(t => finnhub(`/quote?symbol=${t}`).catch(()=>({dp:0}))));
    const advancing = quotes.filter(q=>q.dp>0).length;
    const avgChange = quotes.reduce((s,q)=>s+(q.dp||0),0)/quotes.length;
    const score = Math.min(100,Math.max(0,Math.round(50+avgChange*8+(advancing/quotes.length-0.5)*40)));
    const [label,color] = score<=20?["Extreme Fear","#ff5252"]:score<=40?["Fear","#ff9800"]:score<=60?["Neutral","#ffeb3b"]:score<=80?["Greed","#8bc34a"]:["Extreme Greed","#00e676"];
    res.json({ score, label, color, avgChange:+avgChange.toFixed(2), advancing, total:tickers.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✅ STOCKR 2.0 running on http://localhost:${PORT}`));
