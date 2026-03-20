import { useState, useEffect, useRef, useCallback } from "react";

const SERVER = "http://localhost:4000";
const fmt      = (n) => (+(n??0)).toFixed(2);
const fmtMoney = (n) => "$" + (+(n??0)).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const timeAgo  = (ts) => { const m=Math.floor((Date.now()-ts*1000)/60000); return m<60?`${m}m ago`:`${Math.floor(m/60)}h ago`; };

// Default watchlist to start with
const DEFAULT_STOCKS = [
  { ticker:"AAPL",  name:"Apple Inc.",        sector:"Technology" },
  { ticker:"MSFT",  name:"Microsoft Corp.",   sector:"Technology" },
  { ticker:"NVDA",  name:"NVIDIA Corp.",      sector:"Technology" },
  { ticker:"GOOGL", name:"Alphabet Inc.",     sector:"Technology" },
  { ticker:"AMZN",  name:"Amazon.com Inc.",   sector:"Consumer"   },
  { ticker:"TSLA",  name:"Tesla Inc.",        sector:"Automotive" },
  { ticker:"META",  name:"Meta Platforms",    sector:"Technology" },
  { ticker:"JPM",   name:"JPMorgan Chase",    sector:"Finance"    },
  { ticker:"V",     name:"Visa Inc.",         sector:"Finance"    },
  { ticker:"WMT",   name:"Walmart Inc.",      sector:"Consumer"   },
];

// Mini sparkline
const Spark = ({ history, up, width=80, height=24 }) => {
  if (!history?.length) return <div style={{width,height}}/>;
  const min=Math.min(...history), max=Math.max(...history), range=max-min||1;
  const pts=history.map((v,i)=>`${(i/(history.length-1))*width},${height-2-((v-min)/range)*(height-4)}`).join(" ");
  return <svg width={width} height={height} style={{display:"block"}}><polyline points={pts} fill="none" stroke={up?"#00e676":"#ff5252"} strokeWidth="1.5" strokeLinejoin="round"/></svg>;
};

// Floating chat widget
const FloatingChat = ({ stocks }) => {
  const [open, setOpen]       = useState(false);
  const [messages, setMessages] = useState([{ role:"assistant", text:"Hi! Ask me anything about any stock or the market 📈" }]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const endRef                = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages, open]);

  const send = async () => {
    const q = input.trim(); if (!q||loading) return;
    setInput("");
    setMessages(m=>[...m,{ role:"user", text:q }]);
    setLoading(true);
    try {
      const r = await fetch(`${SERVER}/api/chat`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ question:q, stockContext: stocks.map(s=>({ ticker:s.ticker, price:s.price, change:s.change })) }),
      });
      const d = await r.json();
      setMessages(m=>[...m,{ role:"assistant", text:d.answer||"No response." }]);
    } catch {
      setMessages(m=>[...m,{ role:"assistant", text:"Couldn't connect. Is your server running?" }]);
    }
    setLoading(false);
  };

  return (
    <div style={{ position:"fixed", bottom:24, right:24, zIndex:1000 }}>
      {open && (
        <div style={{ position:"absolute", bottom:68, right:0, width:340, background:"#111520", border:"1px solid #1e2535", borderRadius:16, boxShadow:"0 8px 40px rgba(0,0,0,0.6)", display:"flex", flexDirection:"column", overflow:"hidden" }}>
          <div style={{ background:"#0d1017", padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:"1px solid #1e2535" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:"#00e676" }}/>
              <span style={{ color:"#fff", fontSize:13, fontWeight:600 }}>AI Stock Assistant</span>
            </div>
            <button onClick={()=>setOpen(false)} style={{ background:"none", border:"none", color:"#556", cursor:"pointer", fontSize:18, lineHeight:1 }}>×</button>
          </div>
          <div style={{ height:280, overflowY:"auto", padding:14, display:"flex", flexDirection:"column", gap:10 }}>
            {messages.map((m,i)=>(
              <div key={i} style={{ display:"flex", justifyContent:m.role==="user"?"flex-end":"flex-start" }}>
                <div style={{ maxWidth:"85%", padding:"8px 12px", borderRadius:10, fontSize:12, lineHeight:1.6,
                  background:m.role==="user"?"#00e676":"#1a1e26",
                  color:m.role==="user"?"#0a0c0f":"#e0e6ed",
                  borderBottomRightRadius:m.role==="user"?2:10,
                  borderBottomLeftRadius:m.role==="assistant"?2:10 }}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && <div style={{ display:"flex", justifyContent:"flex-start" }}><div style={{ background:"#1a1e26", padding:"8px 12px", borderRadius:10, borderBottomLeftRadius:2, color:"#556", fontSize:12 }}>Thinking...</div></div>}
            <div ref={endRef}/>
          </div>
          <div style={{ padding:"10px 12px", borderTop:"1px solid #1e2535", display:"flex", gap:8 }}>
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}
              placeholder="Ask about any stock..."
              style={{ flex:1, background:"#1a1e26", border:"1px solid #2a2e3a", color:"#e0e6ed", fontFamily:"'IBM Plex Mono',monospace", fontSize:11, padding:"7px 10px", borderRadius:8, outline:"none" }}/>
            <button onClick={send} disabled={loading||!input.trim()} style={{ background:"#00e676", color:"#0a0c0f", border:"none", cursor:"pointer", fontFamily:"'IBM Plex Mono',monospace", fontSize:11, fontWeight:600, padding:"7px 12px", borderRadius:8, opacity:loading||!input.trim()?0.4:1 }}>↑</button>
          </div>
        </div>
      )}
      <button onClick={()=>setOpen(o=>!o)} style={{ width:56, height:56, borderRadius:"50%", background:open?"#1a1e26":"#00e676", border:open?"2px solid #00e676":"none", color:open?"#00e676":"#0a0c0f", fontSize:24, cursor:"pointer", boxShadow:"0 4px 20px rgba(0,230,118,0.3)", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.2s" }}>
        {open ? "×" : "💬"}
      </button>
    </div>
  );
};

export default function StockApp() {
  const [tab, setTab]           = useState("tracker");
  const [watchlist, setWatchlist] = useState(() => {
    try { const saved = localStorage.getItem("stockr_watchlist"); return saved ? JSON.parse(saved) : DEFAULT_STOCKS.map(s=>({...s,price:0,change:0,history:[]})); }
    catch { return DEFAULT_STOCKS.map(s=>({...s,price:0,change:0,history:[]})); }
  });

  const [cash, setCash]         = useState(() => { try { return parseFloat(localStorage.getItem("stockr_cash")||"10000"); } catch { return 10000; } });
  const [portfolio, setPortfolio] = useState(() => { try { return JSON.parse(localStorage.getItem("stockr_portfolio")||"{}"); } catch { return {}; } });
  const [trades, setTrades]     = useState(() => { try { return JSON.parse(localStorage.getItem("stockr_trades")||"[]"); } catch { return []; } });
  const [qty, setQty]           = useState({});
  const [toast, setToast]       = useState(null);
  const [loading, setLoading]   = useState(true);

  // Search
  const [searchQuery, setSearchQuery]   = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]         = useState(false);
  const searchTimeout                     = useRef(null);

  // News
  const [newsStock, setNewsStock]   = useState(null);
  const [news, setNews]             = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);

  // Alerts
  const [priceAlerts, setPriceAlerts]   = useState([]);
  const [aiAlerts, setAiAlerts]         = useState([]);
  const [aiAlertsLoading, setAiAlertsLoading] = useState(false);
  const [alertTicker, setAlertTicker]   = useState("AAPL");
  const [alertPrice, setAlertPrice]     = useState("");
  const [alertDir, setAlertDir]         = useState("above");
  const triggeredAlerts                 = useRef(new Set());

  // Sentiment
  const [sentiment, setSentiment]       = useState(null);
  const [sentLoading, setSentLoading]   = useState(false);

  // Screener filters
  const [sortBy, setSortBy]     = useState("ticker");
  const [minChange, setMinChange] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sectorFilter, setSectorFilter] = useState("All");

  // Stock detail modal
  const [detailStock, setDetailStock] = useState(null);
  const [candles, setCandles]         = useState([]);
  const [candleLoading, setCandleLoading] = useState(false);

  // Persist to localStorage
  useEffect(() => { try { localStorage.setItem("stockr_watchlist", JSON.stringify(watchlist.map(s=>({ticker:s.ticker,name:s.name,sector:s.sector})))); } catch {} }, [watchlist]);
  useEffect(() => { try { localStorage.setItem("stockr_cash", cash.toString()); } catch {} }, [cash]);
  useEffect(() => { try { localStorage.setItem("stockr_portfolio", JSON.stringify(portfolio)); } catch {} }, [portfolio]);
  useEffect(() => { try { localStorage.setItem("stockr_trades", JSON.stringify(trades.slice(0,50))); } catch {} }, [trades]);

  // Fetch prices for all watchlist stocks
  const fetchPrices = useCallback(async () => {
    if (!watchlist.length) return;
    try {
      const tickers = watchlist.map(s=>s.ticker);
      const r = await fetch(`${SERVER}/api/quotes`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({tickers}) });
      const data = await r.json();
      setWatchlist(prev => prev.map(s => {
        const q = data.find(d=>d.ticker===s.ticker);
        if (!q) return s;
        return { ...s, price:q.price||0, change:q.change||0, history:[...(s.history||[]).slice(-29), q.price||0] };
      }));
    } catch {}
    setLoading(false);
  }, [watchlist.length]);

  useEffect(() => { fetchPrices(); const t=setInterval(fetchPrices,30000); return ()=>clearInterval(t); }, [watchlist.length]);

  // Search with debounce
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    clearTimeout(searchTimeout.current);
    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const r = await fetch(`${SERVER}/api/search?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(await r.json());
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 500);
  }, [searchQuery]);

  // Add stock to watchlist
  const addStock = async (ticker, name) => {
    if (watchlist.find(s=>s.ticker===ticker)) { notify(`${ticker} is already in your watchlist`,"info"); setSearchQuery(""); setSearchResults([]); return; }
    try {
      const r = await fetch(`${SERVER}/api/quote/${ticker}`);
      const data = await r.json();
      setWatchlist(prev=>[...prev,{ ticker:data.ticker, name:data.name||name, sector:data.sector||"Unknown", price:data.price||0, change:data.change||0, history:[] }]);
      notify(`Added ${ticker} to your watchlist ✅`);
    } catch {
      setWatchlist(prev=>[...prev,{ ticker, name, sector:"Unknown", price:0, change:0, history:[] }]);
      notify(`Added ${ticker} to your watchlist ✅`);
    }
    setSearchQuery(""); setSearchResults([]);
  };

  const removeStock = (ticker) => {
    setWatchlist(prev=>prev.filter(s=>s.ticker!==ticker));
    notify(`Removed ${ticker} from watchlist`,"info");
  };

  // Open stock detail
  const openDetail = async (stock) => {
    setDetailStock(stock); setCandleLoading(true);
    try { const r=await fetch(`${SERVER}/api/candles/${stock.ticker}`); setCandles(await r.json()); } catch { setCandles([]); }
    setCandleLoading(false);
  };

  // News
  const fetchNews = async (ticker) => {
    setNewsStock(ticker); setNewsLoading(true); setTab("news");
    try { const r=await fetch(`${SERVER}/api/news/${ticker}`); setNews(await r.json()); } catch { setNews([]); }
    setNewsLoading(false);
  };

  // Sentiment
  const fetchSentiment = async () => {
    setSentLoading(true);
    try { const r=await fetch(`${SERVER}/api/sentiment`); setSentiment(await r.json()); } catch { setSentiment(null); }
    setSentLoading(false);
  };
  useEffect(() => { if(tab==="sentiment") fetchSentiment(); }, [tab]);

  // AI Alerts
  const fetchAiAlerts = async () => {
    setAiAlertsLoading(true);
    try {
      const r = await fetch(`${SERVER}/api/ai-alerts`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ portfolio, stocks:watchlist.map(s=>({ticker:s.ticker,price:s.price,change:s.change})), sentiment }),
      });
      const d = await r.json();
      setAiAlerts(d.alerts||[]);
    } catch { setAiAlerts([]); }
    setAiAlertsLoading(false);
  };

  // Price alert checks
  useEffect(() => {
    priceAlerts.forEach(a => {
      const s=watchlist.find(x=>x.ticker===a.ticker);
      if (!s||triggeredAlerts.current.has(a.id)) return;
      const hit = a.dir==="above" ? s.price>=a.price : s.price<=a.price;
      if (hit) {
        triggeredAlerts.current.add(a.id);
        notify(`🚨 ${a.ticker} hit $${fmt(s.price)} — alert triggered!`,"alert");
        if("Notification"in window&&Notification.permission==="granted") new Notification(`STOCKR: ${a.ticker}`,{body:`Price is ${a.dir} $${fmt(a.price)}`});
      }
    });
  }, [watchlist, priceAlerts]);

  // Trading
  const notify = (msg, type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),3500); };

  const buy = (ticker) => {
    const s=watchlist.find(x=>x.ticker===ticker);
    const n=parseInt(qty[ticker]||1), cost=s.price*n;
    if (!s.price) return notify("Price not loaded yet!","error");
    if (cost>cash) return notify("Not enough cash!","error");
    setCash(c=>+(c-cost).toFixed(2));
    setPortfolio(p=>({ ...p, [ticker]:{ shares:(p[ticker]?.shares||0)+n, avgCost:(((p[ticker]?.shares||0)*(p[ticker]?.avgCost||0))+cost)/((p[ticker]?.shares||0)+n) } }));
    setTrades(t=>[{ type:"BUY", ticker, shares:n, price:s.price, time:new Date().toLocaleTimeString() }, ...t.slice(0,49)]);
    notify(`Bought ${n} share${n>1?"s":""} of ${ticker} @ $${fmt(s.price)}`);
  };

  const sell = (ticker) => {
    const s=watchlist.find(x=>x.ticker===ticker);
    const n=parseInt(qty[ticker]||1), owned=portfolio[ticker]?.shares||0;
    if (n>owned) return notify("Not enough shares!","error");
    setCash(c=>+(c+s.price*n).toFixed(2));
    setPortfolio(p=>{ const ns=p[ticker].shares-n; if(!ns){const{[ticker]:_,...r}=p;return r;} return{...p,[ticker]:{...p[ticker],shares:ns}}; });
    setTrades(t=>[{ type:"SELL", ticker, shares:n, price:s.price, time:new Date().toLocaleTimeString() }, ...t.slice(0,49)]);
    notify(`Sold ${n} share${n>1?"s":""} of ${ticker} @ $${fmt(s.price)}`);
  };

  const portfolioValue = Object.entries(portfolio).reduce((sum,[ticker,{shares}])=>sum+(watchlist.find(s=>s.ticker===ticker)?.price||0)*shares,0);
  const totalValue=cash+portfolioValue, pnl=totalValue-10000;

  const sectors = ["All",...new Set(watchlist.map(s=>s.sector).filter(Boolean))];
  const filtered = watchlist
    .filter(s=>sectorFilter==="All"||s.sector===sectorFilter)
    .filter(s=>!minChange||s.change>=parseFloat(minChange))
    .filter(s=>!maxPrice||s.price<=parseFloat(maxPrice))
    .sort((a,b)=>sortBy==="price"?b.price-a.price:sortBy==="change"?b.change-a.change:a.ticker.localeCompare(b.ticker));

  const td = {padding:"10px 16px",borderBottom:"1px solid #131720"};
  const th = {padding:"10px 16px",textAlign:"left",color:"#445",fontSize:10,letterSpacing:"0.1em",fontWeight:500,borderBottom:"1px solid #1e2535"};
  const card = {background:"#111520",border:"1px solid #1e2535",borderRadius:8,overflow:"hidden"};

  const TABS = [
    {id:"tracker",   label:"📈 Tracker"},
    {id:"screener",  label:"🔍 Screener"},
    {id:"trade",     label:"💼 Trade"},
    {id:"news",      label:"📰 News"},
    {id:"alerts",    label:"🚨 Alerts"},
    {id:"sentiment", label:"😱 Sentiment"},
  ];

  return (
    <div style={{fontFamily:"'IBM Plex Mono',monospace",background:"#0a0c0f",minHeight:"100vh",color:"#e0e6ed"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .row:hover{background:#141820!important;cursor:pointer}
        .tab-btn{background:transparent;border:none;cursor:pointer;font-family:'IBM Plex Mono',monospace;font-size:12px;padding:10px 16px;color:#556;border-bottom:2px solid transparent;transition:all .15s;white-space:nowrap}
        .tab-btn.active{color:#00e676;border-bottom-color:#00e676}
        .tab-btn:hover:not(.active){color:#aaa}
        .btn{border:none;cursor:pointer;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:600;padding:6px 14px;border-radius:4px;transition:all .15s}
        .btn-g{background:#00e676;color:#0a0c0f}.btn-g:hover{background:#00ff88}.btn-g:disabled{opacity:.4;cursor:not-allowed}
        .btn-r{background:transparent;color:#ff5252;border:1px solid #ff5252}.btn-r:hover{background:#ff525218}
        .btn-b{background:transparent;color:#6688aa;border:1px solid #2a3a4a;font-size:10px;padding:4px 8px}.btn-b:hover{border-color:#00e676;color:#00e676}
        .inp{background:#1a1e26;border:1px solid #2a2e3a;color:#e0e6ed;font-family:'IBM Plex Mono',monospace;font-size:12px;padding:7px 10px;border-radius:6px}
        .inp:focus{outline:none;border-color:#00e676}
        .chip{background:#1a1e26;border:1px solid #2a2e3a;color:#6688aa;cursor:pointer;font-family:'IBM Plex Mono',monospace;font-size:10px;padding:4px 12px;border-radius:20px;transition:all .15s}
        .chip:hover,.chip.on{border-color:#00e676;color:#00e676;background:#0a1a0a}
        .search-box{position:relative}
        .search-dropdown{position:absolute;top:calc(100% + 4px);left:0;right:0;background:#111520;border:1px solid #1e2535;border-radius:8px;z-index:200;overflow:hidden}
        .search-item{padding:10px 14px;cursor:pointer;border-bottom:1px solid #131720;transition:background .1s}
        .search-item:hover{background:#1a1e26}
        .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:500;display:flex;align-items:center;justify-content:center;padding:20px}
        .modal{background:#0d1017;border:1px solid #1e2535;border-radius:12px;width:100%;max-width:600px;max-height:80vh;overflow-y:auto}
        .alert-badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600}
        ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:#111}::-webkit-scrollbar-thumb{background:#333;border-radius:3px}
      `}</style>

      {/* Toast */}
      {toast && <div style={{position:"fixed",top:20,right:20,zIndex:999,background:toast.type==="error"?"#ff5252":toast.type==="alert"?"#ff9800":toast.type==="info"?"#378ADD":"#00e676",color:"#0a0c0f",padding:"12px 20px",borderRadius:6,fontWeight:600,fontSize:13,boxShadow:"0 4px 20px rgba(0,0,0,0.5)",maxWidth:360}}>{toast.msg}</div>}

      {/* Stock Detail Modal */}
      {detailStock && (
        <div className="modal-bg" onClick={()=>setDetailStock(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div style={{padding:"20px 24px",borderBottom:"1px solid #1e2535",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:20,fontWeight:700,color:"#00e676"}}>{detailStock.ticker}</div>
                <div style={{fontSize:12,color:"#8899aa"}}>{detailStock.name}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:24,fontWeight:700,color:"#fff"}}>{detailStock.price>0?`$${fmt(detailStock.price)}`:"—"}</div>
                <div style={{color:detailStock.change>=0?"#00e676":"#ff5252",fontSize:13}}>{detailStock.price>0?`${detailStock.change>=0?"▲":"▼"} ${Math.abs(detailStock.change).toFixed(2)}%`:"—"}</div>
              </div>
              <button onClick={()=>setDetailStock(null)} style={{background:"none",border:"none",color:"#556",cursor:"pointer",fontSize:24,marginLeft:16}}>×</button>
            </div>
            <div style={{padding:"20px 24px"}}>
              {/* Mini chart from history */}
              <div style={{marginBottom:20}}>
                <div style={{fontSize:10,color:"#556",marginBottom:8,letterSpacing:"0.08em"}}>PRICE HISTORY (30 DAYS)</div>
                {candleLoading
                  ? <div style={{color:"#445",fontSize:12,padding:"20px 0"}}>Loading chart...</div>
                  : candles.length===0
                    ? <Spark history={detailStock.history} up={detailStock.change>=0} width={540} height={80}/>
                    : (() => {
                        const prices=candles.map(c=>c.close);
                        const min=Math.min(...prices),max=Math.max(...prices),range=max-min||1;
                        const pts=prices.map((v,i)=>`${(i/(prices.length-1))*540},${78-((v-min)/range)*70}`).join(" ");
                        return <svg width="540" height="80" style={{display:"block"}}>
                          <polyline points={pts} fill="none" stroke={detailStock.change>=0?"#00e676":"#ff5252"} strokeWidth="2" strokeLinejoin="round"/>
                        </svg>;
                      })()
                }
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
                {[["Sector",detailStock.sector],["Today High",detailStock.high?`$${fmt(detailStock.high)}`:"—"],["Today Low",detailStock.low?`$${fmt(detailStock.low)}`:"—"],["Prev Close",detailStock.prevClose?`$${fmt(detailStock.prevClose)}`:"—"]].map(([l,v])=>(
                  <div key={l} style={{background:"#1a1e26",borderRadius:6,padding:"10px 14px"}}>
                    <div style={{fontSize:10,color:"#556",marginBottom:4}}>{l}</div>
                    <div style={{color:"#e0e6ed",fontSize:13,fontWeight:500}}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:8}}>
                <button className="btn btn-b" onClick={()=>{fetchNews(detailStock.ticker);setDetailStock(null);}}>📰 View News</button>
                <button className="btn btn-r" style={{fontSize:11,padding:"6px 12px"}} onClick={()=>{removeStock(detailStock.ticker);setDetailStock(null);}}>Remove from watchlist</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{background:"#0d1017",borderBottom:"1px solid #1e2535",padding:"12px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:16}}>
        <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
          <div style={{width:28,height:28,background:"#00e676",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>📊</div>
          <span style={{fontSize:18,fontWeight:700,color:"#fff"}}>STOCKR</span>
          {loading && <span style={{fontSize:10,color:"#334"}}>loading...</span>}
        </div>

        {/* Search bar */}
        <div className="search-box" style={{flex:1,maxWidth:480}}>
          <input className="inp" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
            placeholder="🔍  Search any stock in the world... (AAPL, Tesla, Samsung...)"
            style={{width:"100%",fontSize:13,padding:"8px 14px"}}/>
          {(searchResults.length>0||searching) && (
            <div className="search-dropdown">
              {searching && <div style={{padding:"12px 14px",color:"#556",fontSize:12}}>Searching...</div>}
              {searchResults.map(r=>(
                <div key={r.ticker} className="search-item" onClick={()=>addStock(r.ticker,r.name)}>
                  <span style={{color:"#00e676",fontWeight:600,fontSize:13,marginRight:10}}>{r.ticker}</span>
                  <span style={{color:"#8899aa",fontSize:12}}>{r.name}</span>
                  <span style={{float:"right",color:"#445",fontSize:11}}>+ Add</span>
                </div>
              ))}
              {!searching&&searchResults.length===0&&searchQuery&&<div style={{padding:"12px 14px",color:"#556",fontSize:12}}>No results found</div>}
            </div>
          )}
        </div>

        <div style={{display:"flex",gap:20,flexShrink:0}}>
          {[["TOTAL",fmtMoney(totalValue),"#fff"],["P&L",(pnl>=0?"+":"")+fmtMoney(pnl),pnl>=0?"#00e676":"#ff5252"],["CASH",fmtMoney(cash),"#e0e6ed"]].map(([l,v,c])=>(
            <div key={l} style={{textAlign:"right"}}>
              <div style={{color:"#556",fontSize:9,letterSpacing:"0.08em"}}>{l}</div>
              <div style={{color:c,fontWeight:600,fontSize:15}}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{borderBottom:"1px solid #1e2535",padding:"0 24px",display:"flex",overflowX:"auto"}}>
        {TABS.map(t=><button key={t.id} className={`tab-btn ${tab===t.id?"active":""}`} onClick={()=>setTab(t.id)}>{t.label}</button>)}
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",padding:"0 8px",fontSize:11,color:"#445"}}>{watchlist.length} stocks in watchlist</div>
      </div>

      <div style={{padding:"20px 24px",paddingBottom:100}}>

        {/* ══ TRACKER ══ */}
        {tab==="tracker" && <>
          <div style={{fontSize:11,color:"#556",letterSpacing:"0.08em",marginBottom:14}}>WATCHLIST · REAL PRICES · REFRESHES EVERY 30s · CLICK A ROW FOR DETAILS</div>
          <div style={card}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr>{["TICKER","COMPANY","SECTOR","PRICE","CHANGE","30D CHART",""].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>{watchlist.length===0
                ? <tr><td colSpan={7} style={{padding:40,textAlign:"center",color:"#556"}}>Your watchlist is empty. Search for a stock above to add it!</td></tr>
                : watchlist.map(s=>(
                <tr key={s.ticker} className="row" onClick={()=>openDetail(s)}>
                  <td style={{...td,color:"#00e676",fontWeight:600}}>{s.ticker}</td>
                  <td style={{...td,color:"#8899aa",fontSize:12,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</td>
                  <td style={td}><span style={{background:"#1a2030",color:"#6688aa",fontSize:10,padding:"2px 8px",borderRadius:3}}>{s.sector||"—"}</span></td>
                  <td style={{...td,fontWeight:600,color:"#fff"}}>{s.price>0?`$${fmt(s.price)}`:"—"}</td>
                  <td style={{...td,color:s.change>=0?"#00e676":"#ff5252"}}>{s.price>0?`${s.change>=0?"▲":"▼"} ${Math.abs(s.change).toFixed(2)}%`:"—"}</td>
                  <td style={{...td,padding:"6px 16px"}}><Spark history={s.history} up={s.change>=0}/></td>
                  <td style={{...td}} onClick={e=>e.stopPropagation()}>
                    <div style={{display:"flex",gap:4}}>
                      <button className="btn btn-b" onClick={()=>fetchNews(s.ticker)}>news</button>
                      <button className="btn btn-b" style={{color:"#ff5252",borderColor:"#ff522244"}} onClick={()=>removeStock(s.ticker)}>×</button>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>}

        {/* ══ SCREENER ══ */}
        {tab==="screener" && <>
          <div style={{fontSize:11,color:"#556",letterSpacing:"0.08em",marginBottom:14}}>SCREENER · FILTER YOUR WATCHLIST</div>
          <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"flex-end"}}>
            <div><div style={{fontSize:10,color:"#556",marginBottom:4}}>SECTOR</div>
              <select className="inp" value={sectorFilter} onChange={e=>setSectorFilter(e.target.value)}>
                {sectors.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div><div style={{fontSize:10,color:"#556",marginBottom:4}}>MIN CHANGE %</div><input className="inp" placeholder="e.g. 1" value={minChange} onChange={e=>setMinChange(e.target.value)} style={{width:90}}/></div>
            <div><div style={{fontSize:10,color:"#556",marginBottom:4}}>MAX PRICE $</div><input className="inp" placeholder="e.g. 200" value={maxPrice} onChange={e=>setMaxPrice(e.target.value)} style={{width:90}}/></div>
            <div><div style={{fontSize:10,color:"#556",marginBottom:4}}>SORT</div>
              <select className="inp" value={sortBy} onChange={e=>setSortBy(e.target.value)}>
                <option value="ticker">Ticker A–Z</option><option value="price">Price ↓</option><option value="change">Change ↓</option>
              </select>
            </div>
            <div style={{color:"#556",fontSize:12}}>{filtered.length} results</div>
          </div>
          <div style={card}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr>{["TICKER","COMPANY","SECTOR","PRICE","CHANGE","CHART"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>{filtered.length===0
                ? <tr><td colSpan={6} style={{padding:32,textAlign:"center",color:"#556"}}>No stocks match your filters</td></tr>
                : filtered.map(s=>(
                <tr key={s.ticker} className="row" onClick={()=>openDetail(s)}>
                  <td style={{...td,color:"#00e676",fontWeight:600}}>{s.ticker}</td>
                  <td style={{...td,color:"#8899aa",fontSize:12}}>{s.name}</td>
                  <td style={td}><span style={{background:"#1a2030",color:"#6688aa",fontSize:10,padding:"2px 8px",borderRadius:3}}>{s.sector}</span></td>
                  <td style={{...td,fontWeight:600,color:"#fff"}}>{s.price>0?`$${fmt(s.price)}`:"—"}</td>
                  <td style={{...td,color:s.change>=0?"#00e676":"#ff5252"}}>{s.price>0?`${s.change>=0?"▲":"▼"} ${Math.abs(s.change).toFixed(2)}%`:"—"}</td>
                  <td style={{...td,padding:"6px 16px"}}><Spark history={s.history} up={s.change>=0}/></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>}

        {/* ══ TRADE ══ */}
        {tab==="trade" && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 300px",gap:20}}>
            <div>
              <div style={{fontSize:11,color:"#556",letterSpacing:"0.08em",marginBottom:14}}>PAPER TRADING · $10,000 FAKE CASH · TRADE ANY STOCK IN YOUR WATCHLIST</div>
              <div style={card}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                  <thead><tr>{["TICKER","PRICE","CHANGE","OWNED","QTY","ACTION"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
                  <tbody>{watchlist.length===0
                    ? <tr><td colSpan={6} style={{padding:40,textAlign:"center",color:"#556"}}>Add stocks to your watchlist to trade them!</td></tr>
                    : watchlist.map(s=>{
                      const owned=portfolio[s.ticker]?.shares||0;
                      return <tr key={s.ticker} className="row" style={{borderBottom:"1px solid #131720"}}>
                        <td style={{...td,color:"#00e676",fontWeight:600}}>{s.ticker}</td>
                        <td style={{...td,fontWeight:600,color:"#fff"}}>{s.price>0?`$${fmt(s.price)}`:"—"}</td>
                        <td style={{...td,color:s.change>=0?"#00e676":"#ff5252",fontSize:12}}>{s.price>0?`${s.change>=0?"▲":"▼"}${Math.abs(s.change).toFixed(2)}%`:"—"}</td>
                        <td style={{...td,color:owned>0?"#e0e6ed":"#334",fontSize:12}}>{owned>0?`${owned} sh`:"—"}</td>
                        <td style={td}><input className="inp" type="number" min="1" value={qty[s.ticker]||1} onChange={e=>setQty(q=>({...q,[s.ticker]:e.target.value}))} style={{width:56,textAlign:"center",padding:"5px 6px"}}/></td>
                        <td style={td}><div style={{display:"flex",gap:6}}>
                          <button className="btn btn-g" onClick={()=>buy(s.ticker)} disabled={!s.price}>BUY</button>
                          {owned>0&&<button className="btn btn-r" onClick={()=>sell(s.ticker)}>SELL</button>}
                        </div></td>
                      </tr>;
                    })
                  }</tbody>
                </table>
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{...card,padding:18}}>
                <div style={{fontSize:10,color:"#556",letterSpacing:"0.1em",marginBottom:12}}>YOUR HOLDINGS</div>
                {Object.keys(portfolio).length===0
                  ? <div style={{color:"#334",fontSize:12,textAlign:"center",padding:"16px 0"}}>No positions yet.</div>
                  : <>{Object.entries(portfolio).map(([ticker,{shares,avgCost}])=>{
                    const stock=watchlist.find(s=>s.ticker===ticker);
                    const val=(stock?.price||0)*shares, gain=val-avgCost*shares;
                    return <div key={ticker} style={{borderBottom:"1px solid #1e2535",paddingBottom:8,marginBottom:8}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                        <span style={{color:"#00e676",fontWeight:600,fontSize:12}}>{ticker}</span>
                        <span style={{color:"#fff",fontSize:12}}>{fmtMoney(val)}</span>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#556"}}>
                        <span>{shares} sh @ ${fmt(avgCost)}</span>
                        <span style={{color:gain>=0?"#00e676":"#ff5252"}}>{gain>=0?"+":""}{fmtMoney(gain)}</span>
                      </div>
                    </div>;
                  })}
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,paddingTop:8,borderTop:"1px solid #1e2535"}}><span style={{color:"#556"}}>Stocks</span><span style={{color:"#fff",fontWeight:600}}>{fmtMoney(portfolioValue)}</span></div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginTop:4}}><span style={{color:"#556"}}>Cash</span><span style={{color:"#e0e6ed"}}>{fmtMoney(cash)}</span></div>
                  </>
                }
              </div>
              <div style={{...card,padding:18}}>
                <div style={{fontSize:10,color:"#556",letterSpacing:"0.1em",marginBottom:12}}>TRADE HISTORY</div>
                {trades.length===0
                  ? <div style={{color:"#334",fontSize:12,textAlign:"center",padding:"16px 0"}}>No trades yet.</div>
                  : trades.slice(0,12).map((t,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:11,borderBottom:"1px solid #131720",paddingBottom:5,marginBottom:5}}>
                    <span><span style={{color:t.type==="BUY"?"#00e676":"#ff5252",fontWeight:600}}>{t.type}</span>{" "}<span style={{color:"#e0e6ed"}}>{t.shares}x {t.ticker}</span></span>
                    <span style={{color:"#556"}}>${fmt(t.price)}</span>
                  </div>)
                }
              </div>
            </div>
          </div>
        )}

        {/* ══ NEWS ══ */}
        {tab==="news" && <>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
            <div style={{fontSize:11,color:"#556",letterSpacing:"0.08em"}}>LIVE NEWS {newsStock?`· ${newsStock}`:""}</div>
            {watchlist.map(s=><button key={s.ticker} className={`chip ${newsStock===s.ticker?"on":""}`} onClick={()=>fetchNews(s.ticker)}>{s.ticker}</button>)}
          </div>
          {newsLoading
            ? <div style={{color:"#556",fontSize:13,padding:40,textAlign:"center"}}>Loading news...</div>
            : news.length===0
              ? <div style={{color:"#556",fontSize:13,padding:40,textAlign:"center"}}>Select a ticker above to see the latest news.</div>
              : <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {news.map((a,i)=>(
                  <a key={i} href={a.url} target="_blank" rel="noreferrer" style={{...card,padding:16,display:"block",textDecoration:"none"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                      <span style={{fontSize:10,color:"#00e676",letterSpacing:"0.05em"}}>{a.source}</span>
                      <span style={{fontSize:10,color:"#445"}}>{timeAgo(a.datetime)}</span>
                    </div>
                    <div style={{fontSize:14,color:"#e0e6ed",fontWeight:500,marginBottom:6,lineHeight:1.5}}>{a.headline}</div>
                    <div style={{fontSize:11,color:"#8899aa",lineHeight:1.6}}>{a.summary?.slice(0,220)}{a.summary?.length>220?"...":""}</div>
                  </a>
                ))}
              </div>
          }
        </>}

        {/* ══ ALERTS ══ */}
        {tab==="alerts" && <>
          <div style={{fontSize:11,color:"#556",letterSpacing:"0.08em",marginBottom:16}}>ALERTS · PRICE ALERTS + AI-POWERED SMART ALERTS</div>

          {/* AI Alerts section */}
          <div style={{...card,padding:20,marginBottom:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontSize:10,color:"#556",letterSpacing:"0.1em"}}>🤖 AI SMART ALERTS</div>
              <button className="btn btn-g" style={{fontSize:10,padding:"5px 14px"}} onClick={fetchAiAlerts} disabled={aiAlertsLoading}>{aiAlertsLoading?"Analyzing...":"Generate AI Alerts"}</button>
            </div>
            {aiAlerts.length===0
              ? <div style={{color:"#334",fontSize:12,textAlign:"center",padding:"16px 0"}}>Click "Generate AI Alerts" to get Claude's analysis of your portfolio and the market.</div>
              : aiAlerts.map((a,i)=>(
                <div key={i} style={{background:"#1a1e26",borderRadius:6,padding:"12px 16px",marginBottom:8,borderLeft:`3px solid ${a.type==="warning"?"#ff9800":a.type==="opportunity"?"#00e676":"#378ADD"}`}}>
                  <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
                    <span style={{fontSize:18}}>{a.type==="warning"?"⚠️":a.type==="opportunity"?"🟢":"ℹ️"}</span>
                    <span style={{color:"#fff",fontWeight:600,fontSize:13}}>{a.title}</span>
                    {a.ticker&&<span style={{background:"#1e2535",color:"#00e676",fontSize:10,padding:"2px 8px",borderRadius:3}}>{a.ticker}</span>}
                  </div>
                  <div style={{color:"#8899aa",fontSize:12,lineHeight:1.6,paddingLeft:26}}>{a.message}</div>
                </div>
              ))
            }
          </div>

          {/* Price Alerts */}
          <div style={{...card,padding:20,marginBottom:16}}>
            <div style={{fontSize:10,color:"#556",letterSpacing:"0.1em",marginBottom:14}}>🔔 CREATE PRICE ALERT</div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end"}}>
              <div><div style={{fontSize:10,color:"#556",marginBottom:4}}>STOCK</div>
                <select className="inp" value={alertTicker} onChange={e=>setAlertTicker(e.target.value)}>
                  {watchlist.map(s=><option key={s.ticker}>{s.ticker}</option>)}
                </select>
              </div>
              <div><div style={{fontSize:10,color:"#556",marginBottom:4}}>DIRECTION</div>
                <select className="inp" value={alertDir} onChange={e=>setAlertDir(e.target.value)}>
                  <option value="above">Goes above</option><option value="below">Goes below</option>
                </select>
              </div>
              <div><div style={{fontSize:10,color:"#556",marginBottom:4}}>TARGET PRICE $</div><input className="inp" placeholder="e.g. 200" value={alertPrice} onChange={e=>setAlertPrice(e.target.value)} style={{width:110}}/></div>
              <button className="btn btn-g" style={{padding:"8px 18px"}} onClick={()=>{
                if(!alertPrice) return notify("Enter a target price!","error");
                setPriceAlerts(a=>[...a,{id:Date.now(),ticker:alertTicker,dir:alertDir,price:parseFloat(alertPrice)}]);
                setAlertPrice(""); notify(`Alert set: ${alertTicker} ${alertDir} $${alertPrice}`);
                if("Notification"in window) Notification.requestPermission();
              }}>+ Add Alert</button>
            </div>
          </div>

          <div style={card}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr>{["STOCK","CONDITION","TARGET","CURRENT","STATUS",""].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>{priceAlerts.length===0
                ? <tr><td colSpan={6} style={{padding:32,textAlign:"center",color:"#556"}}>No price alerts yet.</td></tr>
                : priceAlerts.map(a=>{
                  const s=watchlist.find(x=>x.ticker===a.ticker);
                  const isTriggered=triggeredAlerts.current.has(a.id);
                  const isClose=s&&s.price>0&&Math.abs(s.price-a.price)/a.price<0.02;
                  return <tr key={a.id} className="row" style={{borderBottom:"1px solid #131720"}}>
                    <td style={{...td,color:"#00e676",fontWeight:600}}>{a.ticker}</td>
                    <td style={{...td,color:"#8899aa"}}>goes {a.dir}</td>
                    <td style={{...td,color:"#fff",fontWeight:600}}>${fmt(a.price)}</td>
                    <td style={{...td,color:"#e0e6ed"}}>{s?.price>0?`$${fmt(s.price)}`:"—"}</td>
                    <td style={td}>{isTriggered?<span style={{color:"#00e676",fontSize:11}}>✅ Triggered</span>:isClose?<span style={{color:"#ff9800",fontSize:11}}>⚡ Almost!</span>:<span style={{color:"#445",fontSize:11}}>⏳ Watching</span>}</td>
                    <td style={td}><button onClick={()=>setPriceAlerts(a2=>a2.filter(x=>x.id!==a.id))} style={{background:"none",border:"none",color:"#ff5252",cursor:"pointer",fontSize:18}}>×</button></td>
                  </tr>;
                })
              }</tbody>
            </table>
          </div>
        </>}

        {/* ══ SENTIMENT ══ */}
        {tab==="sentiment" && <>
          <div style={{fontSize:11,color:"#556",letterSpacing:"0.08em",marginBottom:20}}>MARKET SENTIMENT · FEAR & GREED INDEX</div>
          {sentLoading
            ? <div style={{color:"#556",textAlign:"center",padding:64}}>Calculating...</div>
            : !sentiment
              ? <div style={{color:"#556",textAlign:"center",padding:64}}>Could not load. Is your server running?</div>
              : <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:20}}>
                <div style={{...card,padding:40,textAlign:"center",width:"100%",maxWidth:500}}>
                  <div style={{fontSize:11,color:"#556",letterSpacing:"0.1em",marginBottom:20}}>CURRENT MARKET MOOD</div>
                  <div style={{background:"#1a1e26",borderRadius:20,height:28,width:"100%",marginBottom:10,overflow:"hidden",border:"1px solid #2a2e3a"}}>
                    <div style={{height:"100%",width:`${sentiment.score}%`,background:"linear-gradient(90deg,#ff5252,#ff9800,#ffeb3b,#8bc34a,#00e676)",borderRadius:20,transition:"width 1.2s ease"}}/>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"#445",marginBottom:32,letterSpacing:"0.05em"}}>
                    <span>EXTREME FEAR</span><span>FEAR</span><span>NEUTRAL</span><span>GREED</span><span>EXTREME GREED</span>
                  </div>
                  <div style={{fontSize:80,fontWeight:700,color:sentiment.color,lineHeight:1}}>{sentiment.score}</div>
                  <div style={{fontSize:24,color:sentiment.color,marginTop:8,marginBottom:24,fontWeight:600}}>{sentiment.label}</div>
                  <div style={{display:"flex",justifyContent:"center",gap:40,fontSize:12}}>
                    <div><div style={{color:"#556",fontSize:10,marginBottom:4}}>AVG CHANGE</div><div style={{color:sentiment.avgChange>=0?"#00e676":"#ff5252",fontWeight:600}}>{sentiment.avgChange>=0?"+":""}{sentiment.avgChange}%</div></div>
                    <div><div style={{color:"#556",fontSize:10,marginBottom:4}}>STOCKS RISING</div><div style={{color:"#00e676",fontWeight:600}}>{sentiment.advancing}/{sentiment.total}</div></div>
                  </div>
                </div>
                <button className="btn btn-g" style={{padding:"10px 28px"}} onClick={fetchSentiment}>↻ Refresh</button>
                <div style={{color:"#445",fontSize:11,textAlign:"center",maxWidth:400,lineHeight:1.8}}>Score is based on real-time prices across top stocks.<br/>Under 40 = fear (potential opportunity). Over 60 = greed (be cautious).</div>
              </div>
          }
        </>}

      </div>

      {/* Floating Chat Button — always visible */}
      <FloatingChat stocks={watchlist}/>
    </div>
  );
}
