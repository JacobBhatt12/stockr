import { useState, useEffect } from "react";

const STOCKS = [
  { ticker: "AAPL", name: "Apple Inc.", sector: "Technology", price: 189.5, change: 1.23 },
  { ticker: "MSFT", name: "Microsoft Corp.", sector: "Technology", price: 415.2, change: 0.87 },
  { ticker: "NVDA", name: "NVIDIA Corp.", sector: "Technology", price: 875.6, change: 3.41 },
  { ticker: "GOOGL", name: "Alphabet Inc.", sector: "Technology", price: 172.3, change: -0.54 },
  { ticker: "AMZN", name: "Amazon.com Inc.", sector: "Consumer", price: 198.7, change: 1.92 },
  { ticker: "TSLA", name: "Tesla Inc.", sector: "Automotive", price: 174.1, change: -2.31 },
  { ticker: "META", name: "Meta Platforms", sector: "Technology", price: 527.8, change: 2.15 },
  { ticker: "JPM", name: "JPMorgan Chase", sector: "Finance", price: 208.4, change: 0.43 },
  { ticker: "V", name: "Visa Inc.", sector: "Finance", price: 279.9, change: 0.61 },
  { ticker: "WMT", name: "Walmart Inc.", sector: "Consumer", price: 68.3, change: -0.22 },
  { ticker: "JNJ", name: "Johnson & Johnson", sector: "Healthcare", price: 147.6, change: -0.89 },
  { ticker: "PFE", name: "Pfizer Inc.", sector: "Healthcare", price: 28.4, change: -1.44 },
  { ticker: "XOM", name: "ExxonMobil Corp.", sector: "Energy", price: 112.7, change: 0.76 },
  { ticker: "CVX", name: "Chevron Corp.", sector: "Energy", price: 156.3, change: 0.34 },
  { ticker: "KO", name: "Coca-Cola Co.", sector: "Consumer", price: 63.1, change: 0.12 },
];

const SECTORS = ["All", "Technology", "Finance", "Consumer", "Healthcare", "Energy", "Automotive"];

const fmt = (n) => n.toFixed(2);
const fmtMoney = (n) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const Spark = ({ history, up }) => {
  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min || 1;
  const pts = history
    .map((v, i) => `${(i / (history.length - 1)) * 80},${20 - ((v - min) / range) * 18}`)
    .join(" ");
  return (
    <svg width="80" height="20" style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={up ? "#00e676" : "#ff5252"} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
};

export default function StockApp() {
  const [tab, setTab] = useState("tracker");
  const [stocks, setStocks] = useState(() =>
    STOCKS.map((s) => ({
      ...s,
      history: Array.from({ length: 20 }, () => +(s.price * (1 + (Math.random() - 0.5) * 0.04)).toFixed(2)),
    }))
  );
  const [cash, setCash] = useState(10000);
  const [portfolio, setPortfolio] = useState({});
  const [trades, setTrades] = useState([]);
  const [qty, setQty] = useState({});
  const [sector, setSector] = useState("All");
  const [sortBy, setSortBy] = useState("ticker");
  const [minChange, setMinChange] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [flash, setFlash] = useState({});
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setStocks((prev) => {
        const newFlash = {};
        const updated = prev.map((s) => {
          const delta = (Math.random() - 0.498) * 0.8;
          const newPrice = Math.max(1, +(s.price + delta).toFixed(2));
          const newChange = +(s.change + (Math.random() - 0.5) * 0.05).toFixed(2);
          newFlash[s.ticker] = newPrice > s.price ? "up" : "down";
          return { ...s, price: newPrice, change: newChange, history: [...s.history.slice(1), newPrice] };
        });
        setFlash(newFlash);
        setTimeout(() => setFlash({}), 600);
        return updated;
      });
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const notify = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 2500);
  };

  const buy = (ticker) => {
    const stock = stocks.find((s) => s.ticker === ticker);
    const amount = parseInt(qty[ticker] || 1);
    const cost = stock.price * amount;
    if (cost > cash) return notify("Not enough cash!", "error");
    setCash((c) => +(c - cost).toFixed(2));
    setPortfolio((p) => ({
      ...p,
      [ticker]: {
        shares: (p[ticker]?.shares || 0) + amount,
        avgCost: (((p[ticker]?.shares || 0) * (p[ticker]?.avgCost || 0)) + cost) / ((p[ticker]?.shares || 0) + amount),
      },
    }));
    setTrades((t) => [{ type: "BUY", ticker, shares: amount, price: stock.price, time: new Date().toLocaleTimeString() }, ...t.slice(0, 19)]);
    notify(`Bought ${amount} share${amount > 1 ? "s" : ""} of ${ticker}`);
  };

  const sell = (ticker) => {
    const stock = stocks.find((s) => s.ticker === ticker);
    const amount = parseInt(qty[ticker] || 1);
    const owned = portfolio[ticker]?.shares || 0;
    if (amount > owned) return notify("Not enough shares!", "error");
    setCash((c) => +(c + stock.price * amount).toFixed(2));
    setPortfolio((p) => {
      const newShares = p[ticker].shares - amount;
      if (newShares === 0) { const { [ticker]: _, ...rest } = p; return rest; }
      return { ...p, [ticker]: { ...p[ticker], shares: newShares } };
    });
    setTrades((t) => [{ type: "SELL", ticker, shares: amount, price: stock.price, time: new Date().toLocaleTimeString() }, ...t.slice(0, 19)]);
    notify(`Sold ${amount} share${amount > 1 ? "s" : ""} of ${ticker}`);
  };

  const portfolioValue = Object.entries(portfolio).reduce((sum, [ticker, { shares }]) => {
    const stock = stocks.find((s) => s.ticker === ticker);
    return sum + (stock?.price || 0) * shares;
  }, 0);

  const totalValue = cash + portfolioValue;
  const pnl = totalValue - 10000;

  const filtered = stocks
    .filter((s) => sector === "All" || s.sector === sector)
    .filter((s) => !minChange || s.change >= parseFloat(minChange))
    .filter((s) => !maxPrice || s.price <= parseFloat(maxPrice))
    .sort((a, b) => {
      if (sortBy === "price") return b.price - a.price;
      if (sortBy === "change") return b.change - a.change;
      return a.ticker.localeCompare(b.ticker);
    });

  const tdStyle = { padding: "11px 16px", borderBottom: "1px solid #131720" };
  const thStyle = { padding: "12px 16px", textAlign: "left", color: "#445", fontSize: 10, letterSpacing: "0.1em", fontWeight: 500, borderBottom: "1px solid #1e2535" };
  const cardStyle = { background: "#111520", border: "1px solid #1e2535", borderRadius: 8, overflow: "hidden" };

  return (
    <div style={{ fontFamily: "'IBM Plex Mono', monospace", background: "#0a0c0f", minHeight: "100vh", color: "#e0e6ed" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .flash-up   { animation: fup 0.6s ease; }
        .flash-down { animation: fdn 0.6s ease; }
        @keyframes fup { 0%,100%{background:transparent} 40%{background:#00e67622} }
        @keyframes fdn { 0%,100%{background:transparent} 40%{background:#ff525222} }
        .row:hover { background: #141820 !important; }
        .tab-btn { background:transparent; border:none; cursor:pointer; font-family:'IBM Plex Mono',monospace; font-size:13px; padding:10px 20px; color:#556; border-bottom:2px solid transparent; transition:all 0.15s; }
        .tab-btn.active { color:#00e676; border-bottom-color:#00e676; }
        .tab-btn:hover:not(.active) { color:#aaa; }
        .btn-buy { background:#00e676; color:#0a0c0f; border:none; cursor:pointer; font-family:'IBM Plex Mono',monospace; font-size:11px; font-weight:600; padding:6px 14px; border-radius:4px; }
        .btn-buy:hover { background:#00ff88; }
        .btn-sell { background:transparent; color:#ff5252; border:1px solid #ff5252; cursor:pointer; font-family:'IBM Plex Mono',monospace; font-size:11px; font-weight:600; padding:6px 14px; border-radius:4px; }
        .btn-sell:hover { background:#ff525218; }
        .qty-input { background:#1a1e26; border:1px solid #2a2e3a; color:#e0e6ed; font-family:'IBM Plex Mono',monospace; font-size:12px; padding:5px 8px; border-radius:4px; width:60px; text-align:center; }
        .qty-input:focus { outline:none; border-color:#00e676; }
        select,.filter-input { background:#1a1e26; border:1px solid #2a2e3a; color:#e0e6ed; font-family:'IBM Plex Mono',monospace; font-size:12px; padding:6px 10px; border-radius:4px; }
        select:focus,.filter-input:focus { outline:none; border-color:#00e676; }
        ::-webkit-scrollbar{width:6px} ::-webkit-scrollbar-track{background:#111} ::-webkit-scrollbar-thumb{background:#333;border-radius:3px}
      `}</style>

      {notification && (
        <div style={{ position:"fixed", top:20, right:20, zIndex:999, background: notification.type==="error"?"#ff5252":"#00e676", color:"#0a0c0f", padding:"10px 20px", borderRadius:6, fontWeight:600, fontSize:13, boxShadow:"0 4px 20px rgba(0,0,0,0.4)" }}>
          {notification.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ background:"#0d1017", borderBottom:"1px solid #1e2535", padding:"14px 28px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:28, height:28, background:"#00e676", borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>📊</div>
          <span style={{ fontSize:18, fontWeight:700, color:"#fff" }}>STOCKR</span>
          <span style={{ fontSize:10, color:"#556", letterSpacing:"0.1em" }}>PAPER TRADING</span>
        </div>
        <div style={{ display:"flex", gap:24 }}>
          {[["TOTAL VALUE", fmtMoney(totalValue), "#fff"], ["P&L", (pnl>=0?"+":"")+fmtMoney(pnl), pnl>=0?"#00e676":"#ff5252"], ["CASH", fmtMoney(cash), "#e0e6ed"]].map(([label, value, color]) => (
            <div key={label} style={{ textAlign:"right" }}>
              <div style={{ color:"#556", fontSize:10, letterSpacing:"0.08em" }}>{label}</div>
              <div style={{ color, fontWeight:600, fontSize:16 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom:"1px solid #1e2535", padding:"0 28px", display:"flex" }}>
        {[["tracker","📈 Tracker"],["screener","🔍 Screener"],["trade","💼 Trade"]].map(([id, label]) => (
          <button key={id} className={`tab-btn ${tab===id?"active":""}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      <div style={{ padding:"24px 28px" }}>

        {/* TRACKER */}
        {tab === "tracker" && (
          <div>
            <div style={{ fontSize:11, color:"#556", letterSpacing:"0.08em", marginBottom:16 }}>LIVE MARKET · PRICES UPDATE EVERY 1.5s</div>
            <div style={cardStyle}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                <thead><tr>{["TICKER","COMPANY","SECTOR","PRICE","CHANGE","CHART"].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                <tbody>
                  {stocks.map(s => (
                    <tr key={s.ticker} className={`row ${flash[s.ticker]==="up"?"flash-up":flash[s.ticker]==="down"?"flash-down":""}`}>
                      <td style={{...tdStyle, color:"#00e676", fontWeight:600}}>{s.ticker}</td>
                      <td style={{...tdStyle, color:"#8899aa", fontSize:12}}>{s.name}</td>
                      <td style={tdStyle}><span style={{ background:"#1a2030", color:"#6688aa", fontSize:10, padding:"2px 8px", borderRadius:3 }}>{s.sector}</span></td>
                      <td style={{...tdStyle, fontWeight:600, color:"#fff"}}>${fmt(s.price)}</td>
                      <td style={{...tdStyle, color:s.change>=0?"#00e676":"#ff5252"}}>{s.change>=0?"▲":"▼"} {Math.abs(s.change).toFixed(2)}%</td>
                      <td style={{...tdStyle, padding:"8px 16px"}}><Spark history={s.history} up={s.change>=0} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SCREENER */}
        {tab === "screener" && (
          <div>
            <div style={{ fontSize:11, color:"#556", letterSpacing:"0.08em", marginBottom:16 }}>STOCK SCREENER · FILTER & SORT</div>
            <div style={{ display:"flex", gap:12, marginBottom:20, flexWrap:"wrap", alignItems:"flex-end" }}>
              <div>
                <div style={{ fontSize:10, color:"#556", marginBottom:4 }}>SECTOR</div>
                <select value={sector} onChange={e => setSector(e.target.value)}>{SECTORS.map(s => <option key={s}>{s}</option>)}</select>
              </div>
              <div>
                <div style={{ fontSize:10, color:"#556", marginBottom:4 }}>MIN CHANGE %</div>
                <input className="filter-input" placeholder="e.g. 1" value={minChange} onChange={e => setMinChange(e.target.value)} style={{ width:90 }} />
              </div>
              <div>
                <div style={{ fontSize:10, color:"#556", marginBottom:4 }}>MAX PRICE $</div>
                <input className="filter-input" placeholder="e.g. 200" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} style={{ width:90 }} />
              </div>
              <div>
                <div style={{ fontSize:10, color:"#556", marginBottom:4 }}>SORT BY</div>
                <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
                  <option value="ticker">Ticker A–Z</option>
                  <option value="price">Price ↓</option>
                  <option value="change">Change ↓</option>
                </select>
              </div>
              <div style={{ color:"#556", fontSize:12 }}>{filtered.length} results</div>
            </div>
            <div style={cardStyle}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                <thead><tr>{["TICKER","COMPANY","SECTOR","PRICE","CHANGE"].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                <tbody>
                  {filtered.length === 0
                    ? <tr><td colSpan={5} style={{ padding:32, textAlign:"center", color:"#556" }}>No stocks match your filters</td></tr>
                    : filtered.map(s => (
                      <tr key={s.ticker} className="row" style={{ borderBottom:"1px solid #131720" }}>
                        <td style={{...tdStyle, color:"#00e676", fontWeight:600}}>{s.ticker}</td>
                        <td style={{...tdStyle, color:"#8899aa", fontSize:12}}>{s.name}</td>
                        <td style={tdStyle}><span style={{ background:"#1a2030", color:"#6688aa", fontSize:10, padding:"2px 8px", borderRadius:3 }}>{s.sector}</span></td>
                        <td style={{...tdStyle, fontWeight:600, color:"#fff"}}>${fmt(s.price)}</td>
                        <td style={{...tdStyle, color:s.change>=0?"#00e676":"#ff5252"}}>{s.change>=0?"▲":"▼"} {Math.abs(s.change).toFixed(2)}%</td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TRADE */}
        {tab === "trade" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 320px", gap:20 }}>
            <div>
              <div style={{ fontSize:11, color:"#556", letterSpacing:"0.08em", marginBottom:16 }}>PAPER TRADING · YOU START WITH $10,000 FAKE CASH</div>
              <div style={cardStyle}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                  <thead><tr>{["TICKER","PRICE","CHANGE","OWNED","QTY","ACTION"].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                  <tbody>
                    {stocks.map(s => {
                      const owned = portfolio[s.ticker]?.shares || 0;
                      return (
                        <tr key={s.ticker} className="row" style={{ borderBottom:"1px solid #131720" }}>
                          <td style={{...tdStyle, color:"#00e676", fontWeight:600}}>{s.ticker}</td>
                          <td style={{...tdStyle, fontWeight:600, color:"#fff"}}>${fmt(s.price)}</td>
                          <td style={{...tdStyle, color:s.change>=0?"#00e676":"#ff5252", fontSize:12}}>{s.change>=0?"▲":"▼"}{Math.abs(s.change).toFixed(2)}%</td>
                          <td style={{...tdStyle, color:owned>0?"#e0e6ed":"#334", fontSize:12}}>{owned>0?`${owned} sh`:"—"}</td>
                          <td style={tdStyle}>
                            <input className="qty-input" type="number" min="1" value={qty[s.ticker]||1} onChange={e => setQty(q => ({...q,[s.ticker]:e.target.value}))} />
                          </td>
                          <td style={tdStyle}>
                            <div style={{ display:"flex", gap:6 }}>
                              <button className="btn-buy" onClick={() => buy(s.ticker)}>BUY</button>
                              {owned > 0 && <button className="btn-sell" onClick={() => sell(s.ticker)}>SELL</button>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              {/* Holdings */}
              <div style={{...cardStyle, padding:20}}>
                <div style={{ fontSize:10, color:"#556", letterSpacing:"0.1em", marginBottom:14 }}>YOUR HOLDINGS</div>
                {Object.keys(portfolio).length === 0
                  ? <div style={{ color:"#334", fontSize:12, textAlign:"center", padding:"20px 0" }}>No positions yet.<br/>Buy a stock to start!</div>
                  : <>
                    {Object.entries(portfolio).map(([ticker, { shares, avgCost }]) => {
                      const stock = stocks.find(s => s.ticker === ticker);
                      const currentVal = stock.price * shares;
                      const gain = currentVal - avgCost * shares;
                      return (
                        <div key={ticker} style={{ borderBottom:"1px solid #1e2535", paddingBottom:10, marginBottom:10 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                            <span style={{ color:"#00e676", fontWeight:600, fontSize:13 }}>{ticker}</span>
                            <span style={{ color:"#fff", fontSize:13 }}>{fmtMoney(currentVal)}</span>
                          </div>
                          <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#556" }}>
                            <span>{shares} sh @ ${fmt(avgCost)}</span>
                            <span style={{ color:gain>=0?"#00e676":"#ff5252" }}>{gain>=0?"+":""}{fmtMoney(gain)}</span>
                          </div>
                        </div>
                      );
                    })}
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginTop:4 }}>
                      <span style={{ color:"#556" }}>Portfolio</span>
                      <span style={{ color:"#fff", fontWeight:600 }}>{fmtMoney(portfolioValue)}</span>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginTop:6 }}>
                      <span style={{ color:"#556" }}>Cash</span>
                      <span style={{ color:"#e0e6ed" }}>{fmtMoney(cash)}</span>
                    </div>
                  </>
                }
              </div>

              {/* Trade History */}
              <div style={{...cardStyle, padding:20}}>
                <div style={{ fontSize:10, color:"#556", letterSpacing:"0.1em", marginBottom:14 }}>TRADE HISTORY</div>
                {trades.length === 0
                  ? <div style={{ color:"#334", fontSize:12, textAlign:"center", padding:"20px 0" }}>No trades yet.</div>
                  : trades.slice(0,10).map((t,i) => (
                    <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:11, borderBottom:"1px solid #131720", paddingBottom:6, marginBottom:6 }}>
                      <span>
                        <span style={{ color:t.type==="BUY"?"#00e676":"#ff5252", fontWeight:600 }}>{t.type}</span>{" "}
                        <span style={{ color:"#e0e6ed" }}>{t.shares}x {t.ticker}</span>
                      </span>
                      <span style={{ color:"#556" }}>${fmt(t.price)}</span>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}