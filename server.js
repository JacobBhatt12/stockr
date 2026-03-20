const express = require("express");
const cors    = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const FINNHUB_KEY   = process.env.FINNHUB_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
const BASE = "https://finnhub.io/api/v1";

async function finnhub(path) {
  const res = await fetch(`${BASE}${path}&token=${FINNHUB_KEY}`);
  if (!res.ok) throw new Error(`Finnhub ${res.status}`);
  return res.json();
}

async function claudeAI(system, message, maxTokens = 400) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type":"application/json", "x-api-key":ANTHROPIC_KEY, "anthropic-version":"2023-06-01" },
    body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:maxTokens, system, messages:[{ role:"user", content:message }] }),
  });
  const d = await res.json();
  return d.content?.[0]?.text || "";
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
      price:     quote.c  || 0,
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
          return { ticker, price:q.c||0, change:q.dp||0, high:q.h, low:q.l, prevClose:q.pc };
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

// ── 30-day price history for charts ─────────────────────────────────────────
app.get("/api/candles/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    const to   = Math.floor(Date.now()/1000);
    const from = to - 30*24*60*60;
    const data = await finnhub(`/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${to}`);
    if (data.s !== "ok") return res.json([]);
    res.json(data.t.map((t,i) => ({
      time:  new Date(t*1000).toLocaleDateString("en-US",{month:"short",day:"numeric"}),
      close: data.c[i],
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

// ── AI Chat ──────────────────────────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  try {
    const { question, stockContext } = req.body;
    const system = `You are a friendly stock market assistant inside STOCKR, a paper trading app.
Current market data: ${JSON.stringify(stockContext)}.
Keep answers to 2-4 sentences. Always note this is for educational purposes, not real financial advice.`;
    const answer = await claudeAI(system, question, 350);
    res.json({ answer });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── AI Smart Alerts ───────────────────────────────────────────────────────────
app.post("/api/ai-alerts", async (req, res) => {
  try {
    const { portfolio, stocks, sentiment } = req.body;
    const system = `You are an AI financial analyst for a paper trading app called STOCKR.
Analyze the user's portfolio and market conditions. Generate 2-4 short, specific, actionable alerts.
Return ONLY a valid JSON array with this exact shape, nothing else:
[{"type":"warning|opportunity|info","title":"Short title max 5 words","message":"One clear sentence.","ticker":"SYMBOL or null"}]`;
    const raw    = await claudeAI(system,
      `Portfolio: ${JSON.stringify(portfolio)}\nStocks: ${JSON.stringify(stocks)}\nSentiment: ${JSON.stringify(sentiment)}`,
      500
    );
    const alerts = JSON.parse(raw.replace(/```json|```/g,"").trim());
    res.json({ alerts });
  } catch {
    res.json({ alerts:[{ type:"info", title:"Market Open", message:"AI alerts are ready — add stocks to your watchlist to get personalized insights!", ticker:null }] });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✅ STOCKR 2.0 running on http://localhost:${PORT}`));
