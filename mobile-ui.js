/* jp004 Folio 0.6: progressive, mobile-only view of the ORIGINAL calculations. */
(() => {
  'use strict';
  const get=id=>document.getElementById(id);
  const fmt=n=>new Intl.NumberFormat('id-ID',{maximumFractionDigits:0}).format(n);
  const pct=n=>(n>0?'+':'')+new Intl.NumberFormat('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n)+'%';
  const node=(tag,cl,txt)=>{const e=document.createElement(tag);if(cl)e.className=cl;if(txt!==undefined)e.textContent=String(txt);return e;};
  const icon={
    refresh:'<path d="M20 11a8 8 0 0 0-14.2-4.8L3 9m0-6v6h6"/><path d="M4 13a8 8 0 0 0 14.2 4.8L21 15m0 6v-6h-6"/>',
    home:'<path d="m3 10 9-7 9 7v11H3z"/><path d="M9 21v-7h6v7"/>',
    chart:'<path d="M3 18V6"/><path d="M3 18h18"/><path d="m7 14 4-4 3 3 6-7"/>',
    insight:'<circle cx="12" cy="12" r="8"/><path d="M12 6v6l4 3"/>',
    menu:'<path d="M4 7h16M4 12h16M4 17h16"/>'
  };
  const svg=name=>`<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${icon[name]}</svg>`;
  const escMoney=(n)=>{if(!Number.isFinite(n))return '—';try{return formatMoney(n,baseSymbol());}catch(_){return 'Rp '+fmt(n);}};
  const readOriginal=(id)=>{const v=get(id)?.textContent?.trim();return v||'—'};
  const state={mood:'',expanded:false,lastQuoteCheck:null,ready:false,nav:'fb-overview'};
  function content(){
    return `<header class="fb-topbar">
      <div class="fb-brand"><span class="fb-brand-mark">jp</span><div><strong class="fb-brand-name">jp004</strong><span class="fb-brand-sub">Portfolio companion</span></div></div>
      <div class="fb-actions-head"><button type="button" id="fb-font" class="fb-icon-button fb-type-button" aria-label="Perbesar huruf" aria-pressed="false">Aa</button><button type="button" id="fb-refresh" class="fb-icon-button" aria-label="Perbarui harga">${svg('refresh')}</button></div>
    </header>
    <main class="fb-main" id="fb-main">
      <section id="fb-overview" class="fb-page fb-overview" aria-label="Ringkasan portofolio">
        <div class="fb-bot-card fb-hero" id="fb-mood-card" data-mood="unknown">
          <div class="fb-hero-copy"><div class="fb-status-tag" id="fb-status-tag">MENUNGGU DATA</div><h2 id="fb-position-count">Posisi portofolio</h2><p class="fb-hero-status" id="fb-status-title">Belum ada data</p><p class="fb-hero-detail" id="fb-status-body">Perbarui harga untuk melihat kondisi.</p></div>
          <div class="fb-robot" id="fb-robot"></div>
        </div>
        <div class="fb-primary-asset">
          <div class="fb-overline">TOTAL EQUITY</div>
          <div class="fb-equity" id="fb-equity">—</div>
          <div class="fb-equity-note" id="fb-equity-note">Nilai kas dan portofolio</div>
        </div>
        <div class="fb-metrics-grid" aria-label="Enam indikator utama portofolio">
          <div class="fb-metric-item"><div class="fb-small-label">BALANCE</div><div class="fb-metric-value" id="fb-cash">—</div><div class="fb-metric-sub">Saldo kas</div></div>
          <div class="fb-metric-item"><div class="fb-small-label">INVESTED</div><div class="fb-metric-value" id="fb-invested">—</div><div class="fb-metric-sub">Modal posisi</div></div>
          <div class="fb-metric-item"><div class="fb-small-label">UNREALIZED P&amp;L</div><div class="fb-metric-value" id="fb-pnl">—</div><div class="fb-metric-percent" id="fb-pnl-rate">—</div><div class="fb-metric-sub" id="fb-pnl-note">Terhadap modal aktif</div></div>
          <div class="fb-metric-item"><div class="fb-small-label">REALIZED P&amp;L</div><div class="fb-metric-value" id="fb-realized">—</div><div class="fb-metric-percent" id="fb-realized-rate">—</div><div class="fb-metric-sub" id="fb-realized-note">% jual tanpa dividen</div></div>
          <div class="fb-metric-item fb-metric-wide"><div><div class="fb-small-label">XIRR</div><div class="fb-metric-sub">Imbal hasil tahunan</div></div><div class="fb-metric-value" id="fb-xirr">—</div></div>
        </div>
        <p class="fb-update-stamp" id="fb-date">Informasi berdasarkan data terakhir</p>
      </section>
      <section id="fb-holdings-section" class="fb-page fb-section fb-holdings-section" aria-label="Posisi saham">
        <div class="fb-section-heading"><h2>Posisi saham</h2><button type="button" id="fb-see-all" class="fb-subaction">Lihat semua</button></div>
        <p class="fb-section-description">Nilai pasar dan imbal hasil saham yang sedang dimiliki.</p>
        <div class="fb-holdings" id="fb-holdings"><p class="fb-muted">Belum ada posisi.</p></div>
      </section>
      <section id="fb-insights" class="fb-page fb-section fb-insights" aria-label="Insight dan peringkat">
        <div class="fb-section-heading"><h2>Pantauan</h2><button type="button" class="fb-subaction" id="fb-detail-action">Lihat detail</button></div>
        <div class="fb-digest" id="fb-digest"><div class="fb-digest-row"><span class="fb-digest-number">01</span><div class="fb-digest-content"><strong>Belum ada insight</strong><p>Insight dihitung dari posisi yang tersimpan.</p></div></div></div>
        <section id="fb-ranking-section" class="fb-ranking-section"><div class="fb-section-heading"><h2>Peringkat emiten</h2></div>
          <p class="fb-section-description">Berdasarkan unrealized return (%) dari modal posisi. Peringkat bukan rekomendasi beli/jual.</p>
          <div class="fb-ranking-block"><div class="fb-ranking-header"><h3>10 terbaik</h3><span id="fb-best-count">0 emiten</span></div><div class="fb-rank-list" id="fb-best"><p class="fb-muted">Belum tersedia.</p></div></div>
          <div class="fb-ranking-block"><div class="fb-ranking-header"><h3>10 terburuk</h3><span id="fb-worst-count">0 emiten</span></div><div class="fb-rank-list" id="fb-worst"><p class="fb-muted">Belum tersedia.</p></div></div>
          <p class="fb-ranking-note" id="fb-ranking-note"></p>
        </section>
        <p class="fb-disclaimer">Sumber: jurnal jp004 dalam browser ini. Harga dapat tertunda. Angka belum tersinkron ke cloud.</p>
      </section>
    </main>
    <nav class="fb-bottom-nav" aria-label="Navigasi">
      <button type="button" data-target="fb-overview" aria-current="page">${svg('home')}Beranda</button>
      <button type="button" data-target="fb-holdings-section">${svg('chart')}Posisi</button>
      <button type="button" data-target="fb-insights">${svg('insight')}Insight</button>
      <button type="button" id="fb-original">${svg('menu')}Menu asli</button>
    </nav>`;
  }
  function start(){
    const app=document.querySelector('body > .app') || document.querySelector('.app');
    if(!app||get('fb-shell'))return;
    const shell=node('div','fb-shell');shell.id='fb-shell';shell.innerHTML=content();app.prepend(shell);
    const ret=node('button','fb-return','← Kembali ke mobile');ret.id='fb-return';ret.type='button';document.body.append(ret);
    const pages=[...shell.querySelectorAll('.fb-page')];
    const selectTab=target=>{
      if(target===state.nav && shell.dataset.view===target)return;
      state.nav=target;
      shell.dataset.view=target;
      pages.forEach(page=>{
        const active=page.id===target;
        page.inert=!active;
        page.setAttribute('aria-hidden',String(!active));
      });
      shell.querySelectorAll('[data-target]').forEach(button=>{
        if(button.dataset.target===target)button.setAttribute('aria-current','page');
        else button.removeAttribute('aria-current');
      });
      // Each page has its own persistent overflow container. No scrollTop,
      // scrollIntoView, anchor jump, animation or window scroll on tab change.
    };
    const showOriginal=()=>{
      app.classList.add('fb-original-mode');document.documentElement.classList.add('fb-original-active');
      // Only switching to the legacy page can require a top reset.
      window.scrollTo(0,0);
    };
    const hideOriginal=()=>{
      app.classList.remove('fb-original-mode');document.documentElement.classList.remove('fb-original-active');
      render();
    };
    ret.addEventListener('click',hideOriginal);
    get('fb-original').addEventListener('click',showOriginal);
    get('fb-detail-action').addEventListener('click',showOriginal);
    get('fb-refresh').addEventListener('click',()=>get('refreshPricesBtn')?.click());
    get('fb-font').addEventListener('click',()=>{const big=shell.classList.toggle('fb-large');get('fb-font').textContent=big?'A−':'Aa';get('fb-font').setAttribute('aria-pressed',String(big));});
    get('fb-see-all').addEventListener('click',()=>{state.expanded=!state.expanded;get('fb-see-all').textContent=state.expanded?'Ringkas':'Lihat semua';render();});
    shell.classList.add('fb-tabs-enabled');
    selectTab('fb-overview');
    shell.querySelectorAll('[data-target]').forEach(button=>button.addEventListener('click',()=>selectTab(button.dataset.target)));
    get('fb-date').textContent='Data lokal · '+new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'long',year:'numeric'}).format(new Date());
    document.documentElement.classList.add('fb-ready');
    window.JPBot3D?.mount(get('fb-robot'),'unknown');
    render();
    const grid=get('summaryGrid');if(grid){let scheduled=false;new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;render();});}).observe(grid,{childList:true,subtree:true,characterData:true});}
    window.addEventListener('pageshow',render);
    window.addEventListener('resize',()=>{if(matchMedia('(max-width:820px)').matches)render();},{passive:true});
  }
  function snapshot(){
    if(typeof calculatePositions!=='function'||typeof prices==='undefined')return null;
    const calculated=Object.values(calculatePositions());
    const positions=calculated.filter(p=>p.qty>1e-7||p.shortQty>1e-7);
    const priced=[];const unpriced=[];let special=0,old=0;
    for(const p of positions){
      if(typeof isDerivativeTicker==='function'&&isDerivativeTicker(p.ticker)){special++;continue;}
      const q=prices[getYahooSymbol(p.ticker,p.mic)];const quote=Number(q?.price);
      if(!q||!Number.isFinite(quote)||quote<=0){unpriced.push(p.ticker);continue;}
      // Weekends do not invalidate the most recent exchange close.
      const d=q.timestamp ? new Date(q.timestamp).getTime():NaN;
      if(Number.isFinite(d)&&Date.now()-d>7*86400e3){old++;unpriced.push(p.ticker);continue;}
      const market=(p.qty-p.shortQty)*quote*fxRate(p.currency);
      const cost=p.totalBuyCostBase-p.shortProceedsBase;
      if(!Number.isFinite(market)||!Number.isFinite(cost)||cost<=0){unpriced.push(p.ticker);continue;}
      priced.push({ticker:p.ticker,mic:p.mic,company:q.companyName||p.ticker,market,cost,pnl:market-cost,pct:100*(market-cost)/cost,
        avgCostBase:p.avgBuyPriceBase ?? cost/Math.max(1,p.qty), currentPriceBase:quote*fxRate(p.currency),quoteTimestamp:q.timestamp || null});
    }
    const sum=(key)=>priced.reduce((t,p)=>t+p[key],0);
    const totalCost=sum('cost'),totalMarket=sum('market');
    return {positions,calculated,priced,unpriced,special,old,totalCost,totalMarket,pnl:totalMarket-totalCost,pct:totalCost>0?100*(totalMarket-totalCost)/totalCost:0,
      complete:positions.length>0&&positions.length===priced.length,};
  }
  function realizedSaleReturn(s){
    // Original jp004 computes realizedTradingOnlyBase and totalSellGrossBase
    // for both open and fully closed tickers. Recover the SOLD COST BASIS as
    // net sales proceeds minus realized trading profit, then divide profit by
    // that basis. Dividends are excluded from this percentage deliberately:
    // the nominal REALIZED P&L in jp004 also includes dividends, but there is
    // no single meaningful sold-cost denominator for dividends on open stocks.
    let profit=0, soldCost=0, n=0;
    for(const p of s.calculated){
      const proceeds=p.totalSellGrossBase;
      const tradingPnl=p.realizedTradingOnlyBase;
      if(!Number.isFinite(proceeds)||!Number.isFinite(tradingPnl))continue;
      if(!(proceeds>0))continue; // expiry/dividend without a sale has no sold-cost base
      if(p.oversold||p.shortQty>1e-7)return {pct:null,reason:'Posisi short/oversold: persentase belum tersedia'};
      const cost=proceeds-tradingPnl;
      if(!(cost>0)||!Number.isFinite(cost))return {pct:null,reason:'Basis modal penjualan tidak valid'};
      profit+=tradingPnl;
      soldCost+=cost;
      n++;
    }
    if(!n||soldCost<=0)return {pct:null,reason:'Belum ada transaksi jual dengan basis modal valid'};
    return {pct:profit/soldCost*100,reason:'Return jual · tanpa dividen'};
  }
  function setPercent(id,n){
    const el=get(id);if(!el)return;
    el.textContent=Number.isFinite(n)?pct(n):'—';
    el.classList.toggle('fb-gain',Number.isFinite(n)&&n>0);
    el.classList.toggle('fb-loss',Number.isFinite(n)&&n<0);
    el.classList.toggle('fb-flat',!Number.isFinite(n)||n===0);
  }

  function mood(s){
    if(!s.positions.length)return {type:'unknown',label:'Belum ada posisi',title:'Mulai dari jurnal.',description:'Tambahkan transaksi dari menu asli.'};
    if(!s.complete)return {type:'unknown',label:'DATA BELUM LENGKAP',title:'Ada harga yang perlu dicek.',description:'Sebagian posisi belum memiliki harga valid.'};
    if(s.pct>1)return {type:'happy',label:'PORTOFOLIO POSITIF',title:'Posisi sedang untung.',description:'Kinerja agregat posisi saham positif.'};
    if(s.pct< -1)return {type:'sad',label:'PORTOFOLIO NEGATIF',title:'Posisi sedang tertekan.',description:'Periksa saham dengan penurunan terbesar.'};
    return {type:'neutral',label:'PORTOFOLIO STABIL',title:'Pergerakan relatif datar.',description:'Pergerakan posisi mendekati modal.'};
  }

  function renderRankings(s){
    // Sort by UNREALIZED return (%) rather than share-price change or absolute P/L.
    // A position with no usable quote is never given a fabricated rank.
    const good=[...s.priced].sort((a,b)=>b.pct-a.pct || a.ticker.localeCompare(b.ticker));
    const bad=[...s.priced].sort((a,b)=>a.pct-b.pct || a.ticker.localeCompare(b.ticker));
    const draw=(target,arr,countId)=>{
      const holder=get(target);holder.replaceChildren();
      const shown=arr.slice(0,10);get(countId).textContent=`${shown.length} emiten`;
      if(!shown.length){holder.append(node('p','fb-muted','Belum ada posisi dengan harga yang dapat dinilai.'));return;}
      shown.forEach((p,i)=>{
        const row=node('div','fb-rank-row');row.tabIndex=0;row.setAttribute('role','button');
        row.setAttribute('aria-label',`Lihat ${p.ticker}, return ${pct(p.pct)}`);
        const head=node('div','fb-rank-top');
        const name=node('div','fb-rank-name');name.append(node('span','fb-rank-no',String(i+1).padStart(2,'0')));
        const stock=node('div','fb-rank-stock');stock.append(node('strong','',p.ticker),node('span','',p.company));name.append(stock);
        head.append(name,node('span',p.pct>0?'fb-rank-return fb-gain':p.pct<0?'fb-rank-return fb-loss':'fb-rank-return fb-flat',pct(p.pct)));
        const data=node('div','fb-rank-data');
        data.append(node('span','',`Modal ${escMoney(p.avgCostBase)}`),node('span','',`Harga ${escMoney(p.currentPriceBase)}`));
        const pl=node('span',p.pnl>0?'fb-rank-pl fb-gain':p.pnl<0?'fb-rank-pl fb-loss':'fb-rank-pl fb-flat',`P/L ${escMoney(p.pnl)}`);
        data.append(pl);row.append(head,data);
        const open=()=>{if(typeof openTickerModal==='function')openTickerModal(p.ticker,p.mic);};
        row.addEventListener('click',open);row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
        holder.append(row);
      });
    };
    draw('fb-best',good,'fb-best-count');draw('fb-worst',bad,'fb-worst-count');
    const note=[];
    if(good.length<10)note.push(`Hanya ${good.length} emiten dapat diperingkat. Daftar tidak ditambah dengan data perkiraan.`);
    if(good.length>0 && good.length<20)note.push('Sebagian emiten bisa muncul di kedua daftar karena jumlah posisi yang tersedia kurang dari 20.');
    if(good.length)note.push('Terburuk berarti return terendah, tidak selalu merugi.');
    if(s.unpriced.length)note.push(`${s.unpriced.length} posisi dikecualikan karena harga tidak tersedia atau terlalu lama.`);
    if(s.special)note.push(`${s.special} posisi derivatif dikecualikan dari peringkat.`);
    get('fb-ranking-note').textContent=note.join(' ');
  }
  function render(){
    if(!get('fb-shell'))return;
    let s;try{s=snapshot();}catch(e){console.info('[jp004 mobile] data belum siap',e);return;}if(!s)return;
    const mm=mood(s);
    get('fb-equity').textContent=readOriginal('accountValue');
    get('fb-equity-note').textContent=s.complete?'Kas + nilai pasar berdasarkan harga tersimpan':`Estimasi parsial · ${s.priced.length}/${s.positions.length} posisi memiliki harga`;
    get('fb-pnl').textContent=readOriginal('unrealizedPnl');
    setPercent('fb-pnl-rate',s.complete&&s.totalCost>0?s.pct:null);
    get('fb-pnl-note').textContent=s.complete?'Terhadap modal aktif':'Harga belum lengkap';
    get('fb-cash').textContent=readOriginal('cashBalance');
    get('fb-invested').textContent=readOriginal('portfolioValue');
    get('fb-realized').textContent=readOriginal('realizedPnl');
    const soldReturn=realizedSaleReturn(s);
    setPercent('fb-realized-rate',soldReturn.pct);
    get('fb-realized-note').textContent=Number.isFinite(soldReturn.pct)?'% jual · tanpa dividen':soldReturn.reason;
    get('fb-xirr').textContent=readOriginal('irrValue');
    get('fb-pnl').classList.toggle('fb-gain',s.complete && s.pnl>0);
    get('fb-pnl').classList.toggle('fb-loss',s.complete && s.pnl<0);
    get('fb-pnl').classList.toggle('fb-flat',!s.complete || s.pnl===0);
    const realizedEl=get('fb-realized'),realizedText=realizedEl.textContent;
    const rNegative=/[−-]\s*[0-9]/.test(realizedText);
    const rPositive=!rNegative && /[1-9]/.test(realizedText);
    realizedEl.classList.toggle('fb-gain',rPositive);
    realizedEl.classList.toggle('fb-loss',rNegative);
    realizedEl.classList.toggle('fb-flat',!rPositive && !rNegative);
    get('fb-mood-card').dataset.mood=mm.type;
    get('fb-status-tag').textContent=mm.label;
    get('fb-position-count').textContent=s.positions.length?`${s.positions.length} posisi aktif`:'Belum ada posisi';
    get('fb-status-title').textContent=mm.title;
    get('fb-status-body').textContent=mm.description;
    if(state.mood!==mm.type){state.mood=mm.type;window.JPBot3D?.setMood(get('fb-robot'),mm.type);}
    const hints=[];
    const prc=s.priced.length,all=s.positions.length;
    hints.push(['Data harga',`${prc} dari ${all} posisi dapat dinilai.${s.special?' '+s.special+' derivatif belum dinilai.':''}${s.unpriced.length?' '+s.unpriced.length+' harga belum tersedia/terlalu lama.':''}`]);
    if(prc){
      const w=[...s.priced].sort((a,b)=>b.market-a.market)[0];
      const concentration=s.totalMarket>0?100*w.market/s.totalMarket:0;
      hints.push(['Konsentrasi aset',`${w.ticker} merupakan ${pct(concentration)} dari nilai saham yang memiliki harga.${concentration>35?' Porsi ini cukup terkonsentrasi.':''}`]);
      const perf=[...s.priced].sort((a,b)=>b.pct-a.pct);
      hints.push(['Posisi terkuat & terlemah',`${perf[0].ticker} ${pct(perf[0].pct)} · ${perf.at(-1).ticker} ${pct(perf.at(-1).pct)}. Perbandingan P/L terhadap modal.`]);
    } else if(!all){hints.push(['Belum ada transaksi','Buka Menu asli, lalu tambahkan deposit dan transaksi beli.']);}
    const digest=get('fb-digest');digest.replaceChildren();
    hints.forEach(([title,description],idx)=>{const r=node('article','fb-digest-row');r.append(node('span','fb-digest-number',String(idx+1).padStart(2,'0')));const d=node('div','fb-digest-content');d.append(node('strong','',title),node('p','',description));r.append(d);digest.append(r);});
    renderRankings(s);
    const holdings=get('fb-holdings');holdings.replaceChildren();
    const sorted=[...s.priced].sort((a,b)=>b.market-a.market);
    if(!sorted.length){holdings.append(node('p','fb-muted',all?'Belum ada posisi dengan harga yang valid.':'Posisi saham akan muncul setelah transaksi pertama.'));return;}
    const limit=state.expanded?sorted.length:4;
    for(const p of sorted.slice(0,limit)){
      const r=node('div','fb-holding');r.tabIndex=0;r.setAttribute('role','button');r.setAttribute('aria-label','Lihat posisi '+p.ticker);
      r.append(node('div','fb-holding-symbol',p.ticker.slice(0,3)));
      const info=node('div','fb-holding-info');info.append(node('strong','',p.ticker),node('span','',`Modal ${escMoney(p.cost)}`));r.append(info);
      const right=node('div','fb-holding-right');right.append(node('strong','',escMoney(p.market)),node('span',p.pnl>0?'fb-gain':p.pnl<0?'fb-loss':'fb-flat',pct(p.pct)));r.append(right);
      const go=()=>{if(typeof openTickerModal==='function')openTickerModal(p.ticker,p.mic);};
      r.addEventListener('click',go);r.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}});
      holdings.append(r);
    }
    get('fb-see-all').style.display=sorted.length>4?'':'none';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
