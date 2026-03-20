import { useState, useEffect, useRef, useCallback } from "react";

const SERVER = "http://localhost:4000";
const fmt      = (n) => (+(n ?? 0)).toFixed(2);
const fmtMoney = (n) => "$" + (+(n ?? 0)).toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 });
const timeAgo  = (ts) => { const m = Math.floor((Date.now()-ts*1000)/60000); return m<60?`${m}m ago`:`${Math.floor(m/60)}h ago`; };

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

// ── Mini TradingView chart (live, per row) ──────────────────────────────────
const MiniChart = ({ ticker }) => {
  const id = useRef(`mc_${ticker}_${Math.random().toString(36).slice(2)}`).current;
  useEffect(() => {
    const container = document.getElementById(id);
    if (!container) return;
    container.innerHTML = "";
    const widgetEl = document.createElement("div");
    widgetEl.className = "tradingview-widget-container__widget";
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js";
    script.async = true;
    script.text = JSON.stringify({
      symbol: ticker, width: 200, height: 150, locale: "en",
      dateRange: "1M", colorTheme: "dark",
      trendLineColor: "#00e676", underLineColor: "#0a0c0f",
      underLineTopColor: "#0a0c0f", isTransparent: true, autosize: false,
    });
    container.appendChild(widgetEl);
    container.appendChild(script);
    return () => { container.innerHTML = ""; };
  }, [ticker]);
  return <div id={id} className="tradingview-widget-container" style={{width:200,height:150,overflow:"hidden"}}/>;
};

// ── Helper: always returns a safe array from any API response ──────────────
const safeArray = (data) => Array.isArray(data) ? data : [];

// ── Full-screen chart (TradingView live widget) ────────────────────────────
const ChartScreen = ({ stock, onClose }) => {
  const containerId = useRef(`tv_${stock.ticker}_${Date.now()}`).current;
  const isUp = (stock.change || 0) >= 0;

  useEffect(() => {
    const initWidget = () => {
      if (!window.TradingView) return;
      new window.TradingView.widget({
        autosize:            true,
        symbol:              stock.ticker,
        interval:            "D",
        timezone:            "America/New_York",
        theme:               "dark",
        style:               "1",
        locale:              "en",
        toolbar_bg:          "#0d1017",
        enable_publishing:   false,
        withdateranges:      true,
        hide_side_toolbar:   false,
        allow_symbol_change: false,
        details:             true,
        container_id:        containerId,
      });
    };

    if (window.TradingView) {
      initWidget();
    } else {
      const script = document.createElement("script");
      script.src   = "https://s3.tradingview.com/tv.js";
      script.async = true;
      script.onload = initWidget;
      document.head.appendChild(script);
    }
  }, [stock.ticker]);

  return (
    <div style={{position:"fixed",inset:0,background:"#0a0c0f",zIndex:600,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      {/* Header */}
      <div style={{background:"#0d1017",borderBottom:"1px solid #1e2535",padding:"14px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#556",cursor:"pointer",fontSize:22}}>←</button>
          <div>
            <div style={{display:"flex",alignItems:"baseline",gap:10}}>
              <span style={{fontSize:22,fontWeight:700,color:"#00e676"}}>{stock.ticker}</span>
              <span style={{fontSize:13,color:"#8899aa"}}>{stock.name}</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginTop:3}}>
              <span style={{fontSize:22,fontWeight:700,color:"#fff"}}>${fmt(stock.price)}</span>
              <span style={{fontSize:13,color:isUp?"#00e676":"#ff5252",fontWeight:600}}>
                {isUp?"▲":"▼"} {Math.abs(stock.change||0).toFixed(2)}%
              </span>
              <span style={{fontSize:10,color:"#445",marginLeft:4}}>Live via TradingView</span>
            </div>
          </div>
        </div>
        <button onClick={onClose}
          style={{background:"none",border:"1px solid #2a2e3a",color:"#556",cursor:"pointer",
            fontFamily:"'IBM Plex Mono',monospace",fontSize:12,padding:"6px 14px",borderRadius:6}}>
          ✕ Close
        </button>
      </div>
      {/* TradingView live chart */}
      <div style={{flex:1,minHeight:0,position:"relative"}}>
        <div id={containerId} style={{position:"absolute",inset:0}}/>
      </div>
    </div>
  );
};


// ── Main App ───────────────────────────────────────────────────────────────
export default function StockApp() {
  const [tab, setTab]             = useState("tracker");
  const [chartStock, setChartStock] = useState(null);
  const [watchlist, setWatchlist] = useState(() => {
    try {
      const s = localStorage.getItem("stockr_watchlist");
      const parsed = s ? JSON.parse(s) : null;
      return Array.isArray(parsed) ? parsed.map(s=>({...s,price:0,change:0,history:[]})) : DEFAULT_STOCKS.map(s=>({...s,price:0,change:0,history:[]}));
    } catch { return DEFAULT_STOCKS.map(s=>({...s,price:0,change:0,history:[]})); }
  });
  const [cash, setCash]           = useState(() => { try { return parseFloat(localStorage.getItem("stockr_cash")||"10000"); } catch { return 10000; } });
  const [portfolio, setPortfolio] = useState(() => { try { return JSON.parse(localStorage.getItem("stockr_portfolio")||"{}"); } catch { return {}; } });
  const [trades, setTrades]       = useState(() => { try { return JSON.parse(localStorage.getItem("stockr_trades")||"[]"); } catch { return []; } });
  const [dollarAmt, setDollarAmt] = useState({});
  const [toast, setToast]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [serverOk, setServerOk]   = useState(null);
  const [searchQuery, setSearchQuery]     = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]         = useState(false);
  const searchTimeout                     = useRef(null);
  const [newsStock, setNewsStock]     = useState(null);
  const [news, setNews]               = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [priceAlerts, setPriceAlerts]       = useState([]);
  const [alertTicker, setAlertTicker]       = useState("AAPL");
  const [alertPrice, setAlertPrice]         = useState("");
  const [alertDir, setAlertDir]             = useState("above");
  const triggeredAlerts                     = useRef(new Set());
  const [sentiment, setSentiment]     = useState(null);
  const [sentLoading, setSentLoading] = useState(false);
  const [sortBy, setSortBy]           = useState("ticker");
  const [minChange, setMinChange]     = useState("");
  const [maxPrice, setMaxPrice]       = useState("");
  const [sectorFilter, setSectorFilter] = useState("All");

  // Persist state
  useEffect(() => { try { localStorage.setItem("stockr_watchlist", JSON.stringify(watchlist.map(s=>({ticker:s.ticker,name:s.name,sector:s.sector})))); } catch {} }, [watchlist]);
  useEffect(() => { try { localStorage.setItem("stockr_cash", cash.toString()); } catch {} }, [cash]);
  useEffect(() => { try { localStorage.setItem("stockr_portfolio", JSON.stringify(portfolio)); } catch {} }, [portfolio]);
  useEffect(() => { try { localStorage.setItem("stockr_trades", JSON.stringify(safeArray(trades).slice(0,50))); } catch {} }, [trades]);

  // Check server
  useEffect(() => {
    fetch(`${SERVER}/api/quotes`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({tickers:["AAPL"]}) })
      .then(r => r.ok ? setServerOk(true) : setServerOk(false))
      .catch(() => setServerOk(false));
  }, []);

  // Fetch prices
  const fetchPrices = useCallback(async () => {
    if (!watchlist.length) return;
    try {
      const r    = await fetch(`${SERVER}/api/quotes`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ tickers: watchlist.map(s=>s.ticker) }) });
      const data = await r.json();
      if (!Array.isArray(data)) { setServerOk(false); setLoading(false); return; }
      setWatchlist(prev => prev.map(s => {
        const q = data.find(d => d.ticker===s.ticker);
        if (!q) return s;
        const price = q.price || s.price || 0;
        return { ...s, price, change:q.change||0, history: safeArray(s.history).concat(price).slice(-30) };
      }));
      setServerOk(true);
    } catch { setServerOk(false); }
    setLoading(false);
  }, [watchlist.length]);

  useEffect(() => { fetchPrices(); const t=setInterval(fetchPrices,30000); return ()=>clearInterval(t); }, [watchlist.length]);

  // Search
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    clearTimeout(searchTimeout.current);
    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const r = await fetch(`${SERVER}/api/search?q=${encodeURIComponent(searchQuery)}`);
        const d = await r.json();
        setSearchResults(Array.isArray(d) ? d : []);
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 500);
  }, [searchQuery]);

  const addStock = async (ticker, name) => {
    if (watchlist.find(s=>s.ticker===ticker)) { notify(`${ticker} already in watchlist`,"info"); setSearchQuery(""); setSearchResults([]); return; }
    try {
      const r = await fetch(`${SERVER}/api/quote/${ticker}`);
      const d = await r.json();
      setWatchlist(prev=>[...prev, { ticker:d.ticker||ticker, name:d.name||name, sector:d.sector||"Unknown", price:d.price||0, change:d.change||0, history:[] }]);
    } catch {
      setWatchlist(prev=>[...prev, { ticker, name, sector:"Unknown", price:0, change:0, history:[] }]);
    }
    notify(`Added ${ticker} ✅`);
    setSearchQuery(""); setSearchResults([]);
  };

  const removeStock = (ticker) => { setWatchlist(prev=>prev.filter(s=>s.ticker!==ticker)); notify(`Removed ${ticker}`,"info"); };

  const fetchNews = async (ticker) => {
    setNewsStock(ticker); setNewsLoading(true); setTab("news");
    try { const r=await fetch(`${SERVER}/api/news/${ticker}`); const d=await r.json(); setNews(Array.isArray(d)?d:[]); } catch { setNews([]); }
    setNewsLoading(false);
  };

  const fetchSentiment = async () => {
    setSentLoading(true);
    try { const r=await fetch(`${SERVER}/api/sentiment`); setSentiment(await r.json()); } catch { setSentiment(null); }
    setSentLoading(false);
  };
  useEffect(() => { if(tab==="sentiment") fetchSentiment(); }, [tab]);


  useEffect(() => {
    priceAlerts.forEach(a => {
      const s = watchlist.find(x=>x.ticker===a.ticker);
      if (!s || triggeredAlerts.current.has(a.id)) return;
      const hit = a.dir==="above" ? s.price>=a.price : s.price<=a.price;
      if (hit) { triggeredAlerts.current.add(a.id); notify(`🚨 ${a.ticker} hit $${fmt(s.price)}!`,"alert"); }
    });
  }, [watchlist, priceAlerts]);

  const notify = (msg, type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),3500); };

  const buy = (ticker) => {
    const s=watchlist.find(x=>x.ticker===ticker);
    if (!s.price) return notify("Price not loaded. Is server running?","error");
    const dollars=parseFloat(dollarAmt[ticker]||0);
    if (!dollars||dollars<=0) return notify("Enter a dollar amount!","error");
    const n=Math.floor(dollars/s.price);
    if (n<1) return notify(`Need at least ${fmtMoney(s.price)} to buy 1 share`,"error");
    const cost=+(s.price*n).toFixed(2);
    if (cost>cash) return notify("Not enough cash!","error");
    setCash(c=>+(c-cost).toFixed(2));
    setPortfolio(p=>({...p,[ticker]:{shares:(p[ticker]?.shares||0)+n,avgCost:(((p[ticker]?.shares||0)*(p[ticker]?.avgCost||0))+cost)/((p[ticker]?.shares||0)+n)}}));
    setTrades(t=>[{type:"BUY",ticker,shares:n,price:s.price,dollars:cost,time:new Date().toLocaleTimeString()},...safeArray(t).slice(0,49)]);
    notify(`Bought ${n} share${n>1?"s":""} of ${ticker} for ${fmtMoney(cost)}`);
  };

  const sell = (ticker) => {
    const s=watchlist.find(x=>x.ticker===ticker);
    if (!s.price) return notify("Price not loaded.","error");
    const dollars=parseFloat(dollarAmt[ticker]||0);
    if (!dollars||dollars<=0) return notify("Enter a dollar amount!","error");
    const n=Math.floor(dollars/s.price);
    if (n<1) return notify(`Need at least ${fmtMoney(s.price)} to sell 1 share`,"error");
    const owned=portfolio[ticker]?.shares||0;
    if (n>owned) return notify(`You only own ${owned} share${owned!==1?"s":""}!`,"error");
    const proceeds=+(s.price*n).toFixed(2);
    setCash(c=>+(c+proceeds).toFixed(2));
    setPortfolio(p=>{const ns=p[ticker].shares-n;if(!ns){const{[ticker]:_,...r}=p;return r;}return{...p,[ticker]:{...p[ticker],shares:ns}};});
    setTrades(t=>[{type:"SELL",ticker,shares:n,price:s.price,dollars:proceeds,time:new Date().toLocaleTimeString()},...safeArray(t).slice(0,49)]);
    notify(`Sold ${n} share${n>1?"s":""} of ${ticker} for ${fmtMoney(proceeds)}`);
  };

  const portfolioValue = Object.entries(portfolio).reduce((sum,[ticker,{shares}])=>sum+(watchlist.find(s=>s.ticker===ticker)?.price||0)*shares,0);
  const totalValue=cash+portfolioValue, pnl=totalValue-10000;
  const sectors = ["All",...new Set(watchlist.map(s=>s.sector).filter(Boolean))];
  const filtered = watchlist
    .filter(s=>sectorFilter==="All"||s.sector===sectorFilter)
    .filter(s=>!minChange||s.change>=parseFloat(minChange))
    .filter(s=>!maxPrice||s.price<=parseFloat(maxPrice))
    .sort((a,b)=>sortBy==="price"?b.price-a.price:sortBy==="change"?b.change-a.change:a.ticker.localeCompare(b.ticker));

  const TABS=[{id:"tracker",label:"📈 Tracker"},{id:"trade",label:"💼 Trade"},{id:"news",label:"📰 News"},{id:"sentiment",label:"😱 Sentiment"}];

  return (
    <div style={{fontFamily:"'IBM Plex Mono',monospace",background:"#0a0c0f",minHeight:"100vh",color:"#e0e6ed"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .tab-btn{background:transparent;border:none;cursor:pointer;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:600;padding:12px 18px;color:#445;border-bottom:2px solid transparent;transition:all .15s;white-space:nowrap;letter-spacing:.05em}
        .tab-btn.active{color:#00e676;border-bottom-color:#00e676}
        .tab-btn:hover:not(.active){color:#8899aa}
        .btn{border:none;cursor:pointer;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:600;padding:7px 16px;border-radius:6px;transition:all .15s}
        .btn-g{background:#00e676;color:#0a0c0f}.btn-g:hover{background:#00ff88}.btn-g:disabled{opacity:.35;cursor:not-allowed}
        .btn-r{background:transparent;color:#ff5252;border:1px solid #ff525244}.btn-r:hover{background:#ff525215}
        .btn-b{background:transparent;color:#445;border:1px solid #1e2535;font-size:10px;padding:4px 9px;border-radius:5px}.btn-b:hover{border-color:#00e676;color:#00e676}
        .inp{background:#141820;border:1px solid #1e2535;color:#e0e6ed;font-family:'IBM Plex Mono',monospace;font-size:11px;padding:7px 10px;border-radius:6px;transition:border .15s}
        .inp:focus{outline:none;border-color:#00e676}
        .scard{background:#111520;border:1px solid #1e2535;border-radius:10px;overflow:hidden;transition:border .15s,transform .15s}
        .scard:hover{border-color:#2a3a4a;transform:translateY(-1px);cursor:pointer}
        .chip{background:#141820;border:1px solid #1e2535;color:#445;cursor:pointer;font-family:'IBM Plex Mono',monospace;font-size:10px;padding:4px 12px;border-radius:20px;transition:all .15s}
        .chip:hover,.chip.on{border-color:#00e676;color:#00e676}
        .sbox{position:relative}
        .sdrop{position:absolute;top:calc(100% + 6px);left:0;right:0;background:#111520;border:1px solid #1e2535;border-radius:10px;z-index:300;overflow:hidden;box-shadow:0 12px 32px rgba(0,0,0,0.6)}
        .si{padding:10px 16px;cursor:pointer;border-bottom:1px solid #131720;transition:background .1s;display:flex;align-items:center;gap:10}
        .si:hover{background:#161c28}
        .row:hover{background:#141820!important}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:#0a0c0f}::-webkit-scrollbar-thumb{background:#1e2535;border-radius:3px}
      `}</style>

      {chartStock && <ChartScreen stock={chartStock} onClose={()=>setChartStock(null)}/>}

      {toast && <div style={{position:"fixed",top:20,right:20,zIndex:998,background:toast.type==="error"?"#ff5252":toast.type==="alert"?"#ff9800":toast.type==="info"?"#378ADD":"#00e676",color:"#0a0c0f",padding:"10px 18px",borderRadius:8,fontWeight:600,fontSize:12,boxShadow:"0 4px 24px rgba(0,0,0,0.6)",maxWidth:340}}>{toast.msg}</div>}

      {serverOk===false && (
        <div style={{background:"#1a1000",borderBottom:"1px solid #ff980044",padding:"7px 24px",fontSize:10,color:"#ff9800",letterSpacing:".05em"}}>
          ⚠ SERVER OFFLINE — run <code style={{background:"#2a1800",padding:"1px 6px",borderRadius:3,marginLeft:4}}>node server.js</code>
        </div>
      )}

      {/* Header */}
      <div style={{background:"#0d1017",borderBottom:"1px solid #1a2030",padding:"14px 28px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:20}}>
        <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
          <div style={{width:32,height:32,background:"#00e676",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>📊</div>
          <div>
            <div style={{fontSize:16,fontWeight:700,color:"#fff",letterSpacing:".05em"}}>STOCKR</div>
            {loading&&serverOk!==false&&<div style={{fontSize:9,color:"#334",letterSpacing:".08em"}}>LOADING...</div>}
          </div>
        </div>
        <div className="sbox" style={{flex:1,maxWidth:480}}>
          <input className="inp" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
            placeholder="Search stocks — AAPL, Tesla, NVDA..."
            style={{width:"100%",fontSize:12,padding:"9px 14px"}}/>
          {(searchResults.length>0||searching) && (
            <div className="sdrop">
              {searching && <div style={{padding:"12px 16px",color:"#445",fontSize:11}}>Searching...</div>}
              {searchResults.map(r=>(
                <div key={r.ticker} className="si" onClick={()=>addStock(r.ticker,r.name)}>
                  <span style={{color:"#00e676",fontWeight:700,fontSize:12,minWidth:52}}>{r.ticker}</span>
                  <span style={{color:"#667",fontSize:11,flex:1}}>{r.name}</span>
                  <span style={{color:"#334",fontSize:10}}>+ Add</span>
                </div>
              ))}
              {!searching&&searchResults.length===0&&searchQuery&&<div style={{padding:"12px 16px",color:"#445",fontSize:11}}>No results</div>}
            </div>
          )}
        </div>
        <div style={{display:"flex",gap:24,flexShrink:0}}>
          {[["TOTAL",fmtMoney(totalValue),"#e0e6ed"],["P&L",(pnl>=0?"+":"")+fmtMoney(pnl),pnl>=0?"#00e676":"#ff5252"],["CASH",fmtMoney(cash),"#667"]].map(([l,v,c])=>(
            <div key={l}>
              <div style={{color:"#334",fontSize:9,letterSpacing:".1em",marginBottom:2}}>{l}</div>
              <div style={{color:c,fontWeight:700,fontSize:14}}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{background:"#0d1017",borderBottom:"1px solid #1a2030",padding:"0 28px",display:"flex"}}>
        {TABS.map(t=><button key={t.id} className={`tab-btn ${tab===t.id?"active":""}`} onClick={()=>setTab(t.id)}>{t.label}</button>)}
      </div>

      <div style={{padding:"24px 28px",paddingBottom:80}}>

        {tab==="tracker" && <>
          {/* Compact filter bar */}
          <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
            <select className="inp" value={sectorFilter} onChange={e=>setSectorFilter(e.target.value)} style={{padding:"5px 8px",fontSize:10}}>
              {sectors.map(s=><option key={s}>{s}</option>)}
            </select>
            <input className="inp" placeholder="Min %" value={minChange} onChange={e=>setMinChange(e.target.value)} style={{width:72,padding:"5px 8px",fontSize:10}}/>
            <input className="inp" placeholder="Max $" value={maxPrice} onChange={e=>setMaxPrice(e.target.value)} style={{width:72,padding:"5px 8px",fontSize:10}}/>
            <select className="inp" value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{padding:"5px 8px",fontSize:10}}>
              <option value="ticker">A–Z</option>
              <option value="price">Price ↓</option>
              <option value="change">Change ↓</option>
            </select>
            <span style={{color:"#334",fontSize:10,marginLeft:4}}>{filtered.length} stocks</span>
          </div>

          {/* Stock cards grid */}
          {filtered.length===0
            ? <div style={{textAlign:"center",color:"#334",fontSize:12,padding:"60px 0"}}>{watchlist.length===0?"Search above to add stocks":"No stocks match your filters"}</div>
            : <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))",gap:14}}>
              {filtered.map(s=>(
                <div key={s.ticker} className="scard" onClick={()=>setChartStock(s)}>
                  <div style={{padding:"14px 14px 8px",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div>
                      <div style={{fontSize:16,fontWeight:700,color:"#00e676",letterSpacing:".03em"}}>{s.ticker}</div>
                      <div style={{fontSize:10,color:"#445",marginTop:2,maxWidth:110,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:14,fontWeight:700,color:"#e0e6ed"}}>{s.price>0?`$${fmt(s.price)}`:"—"}</div>
                      <div style={{fontSize:11,fontWeight:600,color:s.change>=0?"#00e676":"#ff5252",marginTop:1}}>
                        {s.price>0?`${s.change>=0?"▲":"▼"} ${Math.abs(s.change).toFixed(2)}%`:"—"}
                      </div>
                    </div>
                  </div>
                  <MiniChart ticker={s.ticker}/>
                  <div style={{padding:"8px 10px",borderTop:"1px solid #131720",display:"flex",gap:5,justifyContent:"flex-end"}} onClick={e=>e.stopPropagation()}>
                    <button className="btn btn-b" style={{fontSize:9,padding:"3px 8px"}} onClick={()=>fetchNews(s.ticker)}>news</button>
                    <button className="btn btn-b" style={{fontSize:9,padding:"3px 8px",color:"#ff525288",borderColor:"#ff525222"}} onClick={()=>removeStock(s.ticker)}>remove</button>
                  </div>
                </div>
              ))}
            </div>
          }
        </>}


        {tab==="trade" && <>
          <div style={{display:"grid",gridTemplateColumns:"1fr 280px",gap:20,marginBottom:24}}>
            <div style={{background:"#111520",border:"1px solid #1e2535",borderRadius:10,overflow:"hidden"}}>
              <div style={{padding:"14px 18px",borderBottom:"1px solid #1a2030",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:10,color:"#445",letterSpacing:".1em",fontWeight:600}}>PAPER TRADING</span>
                <span style={{fontSize:10,color:"#334"}}>{fmtMoney(cash)} cash available</span>
              </div>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead><tr>{["TICKER","PRICE","CHANGE","OWNED","INVEST $",""].map(h=><th key={h} style={{padding:"8px 14px",textAlign:"left",color:"#334",fontSize:9,letterSpacing:".1em",borderBottom:"1px solid #1a2030"}}>{h}</th>)}</tr></thead>
                <tbody>{watchlist.length===0
                  ? <tr><td colSpan={6} style={{padding:40,textAlign:"center",color:"#334",fontSize:11}}>Add stocks from the Tracker tab first</td></tr>
                  : watchlist.map(s=>{
                    const owned=portfolio[s.ticker]?.shares||0;
                    const dollars=parseFloat(dollarAmt[s.ticker]||0);
                    const approxShares=s.price>0?Math.floor(dollars/s.price):0;
                    return <tr key={s.ticker} className="row" style={{borderBottom:"1px solid #0e1016"}}>
                      <td style={{padding:"10px 14px",color:"#00e676",fontWeight:700}}>{s.ticker}</td>
                      <td style={{padding:"10px 14px",color:"#e0e6ed",fontWeight:600}}>{s.price>0?`$${fmt(s.price)}`:"—"}</td>
                      <td style={{padding:"10px 14px",color:s.change>=0?"#00e676":"#ff5252",fontSize:11}}>{s.price>0?`${s.change>=0?"▲":"▼"}${Math.abs(s.change).toFixed(2)}%`:"—"}</td>
                      <td style={{padding:"10px 14px",color:owned>0?"#8899aa":"#2a2e3a",fontSize:11}}>{owned>0?`${owned} sh`:"—"}</td>
                      <td style={{padding:"8px 14px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <div style={{position:"relative"}}>
                            <span style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",color:"#445",fontSize:11,pointerEvents:"none"}}>$</span>
                            <input className="inp" type="number" min="0" step="1" placeholder="0"
                              value={dollarAmt[s.ticker]||""}
                              onChange={e=>setDollarAmt(d=>({...d,[s.ticker]:e.target.value}))}
                              style={{width:80,textAlign:"right",padding:"5px 8px",paddingLeft:16,fontSize:11}}/>
                          </div>
                          {dollars>0&&s.price>0&&<span style={{fontSize:9,color:"#334",whiteSpace:"nowrap"}}>≈{approxShares}sh</span>}
                        </div>
                      </td>
                      <td style={{padding:"8px 14px"}}>
                        <div style={{display:"flex",gap:5}}>
                          <button className="btn btn-g" style={{padding:"5px 12px",fontSize:10}} onClick={()=>buy(s.ticker)} disabled={!s.price}>BUY</button>
                          {owned>0&&<button className="btn btn-r" style={{padding:"5px 12px",fontSize:10}} onClick={()=>sell(s.ticker)}>SELL</button>}
                        </div>
                      </td>
                    </tr>;
                  })
                }</tbody>
              </table>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{background:"#111520",border:"1px solid #1e2535",borderRadius:10,padding:18}}>
                <div style={{fontSize:9,color:"#334",letterSpacing:".1em",fontWeight:600,marginBottom:14}}>HOLDINGS</div>
                {Object.keys(portfolio).length===0
                  ? <div style={{color:"#2a2e3a",fontSize:11,textAlign:"center",padding:"12px 0"}}>No positions yet</div>
                  : <>{Object.entries(portfolio).map(([ticker,{shares,avgCost}])=>{
                    const stock=watchlist.find(s=>s.ticker===ticker);
                    const val=(stock?.price||0)*shares, gain=val-avgCost*shares;
                    return <div key={ticker} style={{borderBottom:"1px solid #0e1016",paddingBottom:8,marginBottom:8}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                        <span style={{color:"#00e676",fontWeight:700,fontSize:12}}>{ticker}</span>
                        <span style={{color:"#e0e6ed",fontSize:12,fontWeight:600}}>{fmtMoney(val)}</span>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#445"}}>
                        <span>{shares}sh @ ${fmt(avgCost)}</span>
                        <span style={{color:gain>=0?"#00e676":"#ff5252",fontWeight:600}}>{gain>=0?"+":""}{fmtMoney(gain)}</span>
                      </div>
                    </div>;
                  })}
                  <div style={{borderTop:"1px solid #1a2030",paddingTop:8,marginTop:4,display:"flex",flexDirection:"column",gap:4}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:10}}><span style={{color:"#445"}}>Stocks</span><span style={{color:"#e0e6ed",fontWeight:600}}>{fmtMoney(portfolioValue)}</span></div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:10}}><span style={{color:"#445"}}>Cash</span><span style={{color:"#667"}}>{fmtMoney(cash)}</span></div>
                  </div>
                  </>
                }
              </div>
              <div style={{background:"#111520",border:"1px solid #1e2535",borderRadius:10,padding:18}}>
                <div style={{fontSize:9,color:"#334",letterSpacing:".1em",fontWeight:600,marginBottom:14}}>HISTORY</div>
                {!safeArray(trades).length
                  ? <div style={{color:"#2a2e3a",fontSize:11,textAlign:"center",padding:"12px 0"}}>No trades yet</div>
                  : safeArray(trades).slice(0,14).map((t,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:10,borderBottom:"1px solid #0e1016",paddingBottom:5,marginBottom:5}}>
                      <div style={{display:"flex",gap:6,alignItems:"center"}}>
                        <span style={{color:t.type==="BUY"?"#00e676":"#ff5252",fontWeight:700,fontSize:9}}>{t.type}</span>
                        <span style={{color:"#8899aa"}}>{t.ticker}</span>
                        <span style={{color:"#334"}}>{t.shares}sh</span>
                      </div>
                      <span style={{color:"#556"}}>{t.dollars?fmtMoney(t.dollars):`$${fmt(t.price)}`}</span>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>

          {/* Price Alerts */}
          <div style={{background:"#111520",border:"1px solid #1e2535",borderRadius:10,overflow:"hidden"}}>
            <div style={{padding:"14px 18px",borderBottom:"1px solid #1a2030",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
              <span style={{fontSize:9,color:"#334",letterSpacing:".1em",fontWeight:600}}>🔔 PRICE ALERTS</span>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                <select className="inp" value={alertTicker} onChange={e=>setAlertTicker(e.target.value)} style={{padding:"4px 8px",fontSize:10}}>{watchlist.map(s=><option key={s.ticker}>{s.ticker}</option>)}</select>
                <select className="inp" value={alertDir} onChange={e=>setAlertDir(e.target.value)} style={{padding:"4px 8px",fontSize:10}}><option value="above">above</option><option value="below">below</option></select>
                <input className="inp" placeholder="Target $" value={alertPrice} onChange={e=>setAlertPrice(e.target.value)} style={{width:90,padding:"4px 8px",fontSize:10}}/>
                <button className="btn btn-g" style={{padding:"5px 14px",fontSize:10}} onClick={()=>{
                  if(!alertPrice) return notify("Enter a target price!","error");
                  setPriceAlerts(a=>[...a,{id:Date.now(),ticker:alertTicker,dir:alertDir,price:parseFloat(alertPrice)}]);
                  setAlertPrice(""); notify(`Alert: ${alertTicker} ${alertDir} $${alertPrice}`);
                  if("Notification"in window) Notification.requestPermission();
                }}>+ Set</button>
              </div>
            </div>
            {!priceAlerts.length
              ? <div style={{padding:"20px",textAlign:"center",color:"#2a2e3a",fontSize:11}}>No alerts set</div>
              : <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead><tr>{["STOCK","CONDITION","TARGET","CURRENT","STATUS",""].map(h=><th key={h} style={{padding:"7px 14px",textAlign:"left",color:"#334",fontSize:9,letterSpacing:".1em",borderBottom:"1px solid #1a2030"}}>{h}</th>)}</tr></thead>
                <tbody>{priceAlerts.map(a=>{
                  const s=watchlist.find(x=>x.ticker===a.ticker);
                  const isTrig=triggeredAlerts.current.has(a.id);
                  const isClose=s&&s.price>0&&Math.abs(s.price-a.price)/a.price<0.02;
                  return <tr key={a.id} style={{borderBottom:"1px solid #0e1016"}}>
                    <td style={{padding:"9px 14px",color:"#00e676",fontWeight:700}}>{a.ticker}</td>
                    <td style={{padding:"9px 14px",color:"#445"}}>goes {a.dir}</td>
                    <td style={{padding:"9px 14px",color:"#e0e6ed",fontWeight:600}}>${fmt(a.price)}</td>
                    <td style={{padding:"9px 14px",color:"#667"}}>{s?.price>0?`$${fmt(s.price)}`:"—"}</td>
                    <td style={{padding:"9px 14px"}}>{isTrig?<span style={{color:"#00e676"}}>✓ Triggered</span>:isClose?<span style={{color:"#ff9800"}}>⚡ Close</span>:<span style={{color:"#334"}}>watching</span>}</td>
                    <td style={{padding:"9px 14px"}}><button onClick={()=>setPriceAlerts(a2=>a2.filter(x=>x.id!==a.id))} style={{background:"none",border:"none",color:"#ff525255",cursor:"pointer",fontSize:16,lineHeight:1}}>×</button></td>
                  </tr>;
                })}</tbody>
              </table>
            }
          </div>
        </>}

        {tab==="news" && <>
          <div style={{display:"flex",gap:6,marginBottom:18,flexWrap:"wrap",alignItems:"center"}}>
            <span style={{fontSize:9,color:"#334",letterSpacing:".1em",fontWeight:600,marginRight:4}}>NEWS</span>
            {watchlist.map(s=><button key={s.ticker} className={`chip ${newsStock===s.ticker?"on":""}`} onClick={()=>fetchNews(s.ticker)}>{s.ticker}</button>)}
          </div>
          {newsLoading
            ? <div style={{color:"#334",fontSize:11,padding:48,textAlign:"center"}}>Loading...</div>
            : !safeArray(news).length
              ? <div style={{color:"#334",fontSize:11,padding:48,textAlign:"center"}}>Select a ticker above</div>
              : <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {safeArray(news).map((a,i)=>(
                  <a key={i} href={a.url} target="_blank" rel="noreferrer" style={{background:"#111520",border:"1px solid #1a2030",borderRadius:10,padding:"14px 18px",display:"block",textDecoration:"none",transition:"border .15s"}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor="#2a3a4a"}
                    onMouseLeave={e=>e.currentTarget.style.borderColor="#1a2030"}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                      <span style={{fontSize:9,color:"#00e676",letterSpacing:".08em",fontWeight:600}}>{a.source}</span>
                      <span style={{fontSize:9,color:"#334"}}>{timeAgo(a.datetime)}</span>
                    </div>
                    <div style={{fontSize:13,color:"#e0e6ed",fontWeight:500,marginBottom:5,lineHeight:1.55}}>{a.headline}</div>
                    <div style={{fontSize:11,color:"#445",lineHeight:1.6}}>{(a.summary||"").slice(0,200)}{(a.summary||"").length>200?"…":""}</div>
                  </a>
                ))}
              </div>
          }
        </>}

        {tab==="sentiment" && <>
          {sentLoading
            ? <div style={{color:"#334",textAlign:"center",padding:64,fontSize:11}}>Calculating...</div>
            : !sentiment
              ? <div style={{color:"#334",textAlign:"center",padding:64,fontSize:11}}>Could not load — is your server running?</div>
              : <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:16}}>
                <div style={{background:"#111520",border:"1px solid #1e2535",borderRadius:12,padding:"36px 40px",textAlign:"center",width:"100%",maxWidth:480}}>
                  <div style={{fontSize:9,color:"#334",letterSpacing:".12em",fontWeight:600,marginBottom:20}}>MARKET SENTIMENT</div>
                  <div style={{background:"#0e1016",borderRadius:20,height:10,width:"100%",marginBottom:8,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${sentiment.score}%`,background:"linear-gradient(90deg,#ff5252,#ff9800,#ffeb3b,#8bc34a,#00e676)",borderRadius:20,transition:"width 1.2s ease"}}/>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:8,color:"#2a2e3a",marginBottom:32,letterSpacing:".06em"}}>
                    <span>FEAR</span><span>NEUTRAL</span><span>GREED</span>
                  </div>
                  <div style={{fontSize:72,fontWeight:700,color:sentiment.color,lineHeight:1,marginBottom:8}}>{sentiment.score}</div>
                  <div style={{fontSize:20,color:sentiment.color,fontWeight:700,marginBottom:28,letterSpacing:".04em"}}>{sentiment.label}</div>
                  <div style={{display:"flex",justifyContent:"center",gap:40,fontSize:11}}>
                    <div><div style={{color:"#334",fontSize:9,marginBottom:4,letterSpacing:".08em"}}>AVG CHANGE</div><div style={{color:sentiment.avgChange>=0?"#00e676":"#ff5252",fontWeight:700}}>{sentiment.avgChange>=0?"+":""}{sentiment.avgChange}%</div></div>
                    <div><div style={{color:"#334",fontSize:9,marginBottom:4,letterSpacing:".08em"}}>RISING</div><div style={{color:"#00e676",fontWeight:700}}>{sentiment.advancing}/{sentiment.total}</div></div>
                  </div>
                </div>
                <button className="btn btn-g" style={{padding:"8px 24px",fontSize:11}} onClick={fetchSentiment}>↻ Refresh</button>
              </div>
          }
        </>}
      </div>

    </div>
  );
}
