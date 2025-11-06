// js/app.js — Cinematic Go-Back-N with Diagram Modes (Textbook, Vertical Columns, Animated)
// Left→Right live sim, slow timing, proper stats, conditional inputs.
(function () {
  // Build UI
  const app = document.getElementById("app");
  app.innerHTML = `
    <header class="glass">
      <h1>Go-Back-N ARQ — Neon Glass</h1>
      <p>Sender (left) → Receiver (right). Packets glide right; ACKs glide left. Results appear after the final ACK.</p>

      <div class="controls">
        <label>Number of frames
          <input id="numFrames" type="number" min="1" max="300" value="12">
        </label>
        <label>Window size (N)
          <input id="winSize" type="number" min="1" max="32" value="4">
        </label>
        <label>Timeout (ms)
          <input id="timeout" type="number" min="800" value="5000">
        </label>

        <label>Loss %
          <input id="lossPercent" type="range" min="0" max="80" value="10">
          <span id="lossPercentVal">10%</span>
        </label>

        <label>Frame Loss Mode
          <select id="lossMode">
            <option value="random">Random (by Loss %)</option>
            <option value="specific">Specific frame(s)</option>
            <option value="everyk">Every k-th</option>
            <option value="none">None</option>
          </select>
        </label>
        <label id="labelSpecific" class="hidden">Specific frames (comma)
          <input id="specificFrames" type="text" placeholder="e.g. 2,7,9">
        </label>
        <label id="labelEveryK" class="hidden">k (every k-th)
          <input id="everyK" type="number" min="1" value="3">
        </label>

        <label>Frame Delay Mode
          <select id="frameDelayMode">
            <option value="none">None</option>
            <option value="specific">Delay specific frame(s)</option>
            <option value="everyk">Delay every k-th</option>
          </select>
        </label>
        <label id="labelDelaySpec" class="hidden">Delay frame # / k
          <input id="frameDelaySpec" type="text" placeholder="e.g. 5 or 3,6">
        </label>
        <label id="labelDelayMs" class="hidden">Frame delay (ms)
          <input id="frameDelayMs" type="number" min="0" value="1500">
        </label>

        <label>ACK Loss %
          <input id="ackLossPercent" type="range" min="0" max="80" value="5">
          <span id="ackLossVal">5%</span>
        </label>
        <label>ACK Delay (ms)
          <input id="ackDelayMs" type="number" min="0" value="1200">
        </label>

        <label>Diagram Type
          <select id="diagramType">
            <option value="vertical">Vertical two-columns</option>
            <option value="textbook">Textbook diagonals</option>
            <option value="animated">Animated replay</option>
          </select>
        </label>
      </div>

      <div class="buttons">
        <button id="startBtn">Start</button>
        <button id="pauseBtn">Pause</button>
        <button id="stepBtn">Step</button>
        <button id="resetBtn">Reset</button>
      </div>
    </header>

    <section class="glass sim-area">
      <div class="lane">
        <h3>Sender</h3>
        <div id="senderWindow" class="window"></div>
        <div id="senderQueue" class="queue"></div>
      </div>
      <div class="channel glass">
        <div id="channelStage"></div>
      </div>
      <div class="lane">
        <h3>Receiver</h3>
        <div id="recvArea" class="recv"></div>
      </div>
    </section>

    <section class="glass">
      <h3 style="text-align:center;color:#00ffff;margin-bottom:6px">Event Log</h3>
      <div id="events" class="log"></div>
    </section>

    <section class="glass hidden" id="statsWrap">
      <h3 style="text-align:center;color:#00ffff;margin-bottom:8px">📊 Simulation Results</h3>
      <div class="stats">
        <div class="stat-card"><div class="stat-label">Total original frames</div><div class="stat-value" id="stat_totalFrames">0</div></div>
        <div class="stat-card"><div class="stat-label">Total transmissions (incl. retransmissions)</div><div class="stat-value" id="stat_totalTrans">0</div></div>
        <div class="stat-card"><div class="stat-label">Frames delivered</div><div class="stat-value" id="stat_delivered">0</div></div>
        <div class="stat-card"><div class="stat-label">Total ACKs generated</div><div class="stat-value" id="stat_totalAcks">0</div></div>
        <div class="stat-card"><div class="stat-label">Frames lost</div><div class="stat-value" id="stat_framesLost">0</div></div>
        <div class="stat-card"><div class="stat-label">ACKs lost</div><div class="stat-value" id="stat_acksLost">0</div></div>
        <div class="stat-card">
          <div class="stat-label">Efficiency</div>
          <div class="stat-value" id="stat_efficiency">0%</div>
          <div class="eff-bar"><div id="eff_fill" class="eff-fill" style="width:0%"></div></div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Loss percent (frames/transmissions)</div>
          <div class="stat-value" id="stat_lossPercent">0%</div>
        </div>
      </div>

      <div style="margin-top:12px">
        <h4 style="color:#a9c2d6;margin-bottom:6px">Flow Diagram (<span id="diagramModeLabel">Vertical two-columns</span>)</h4>
        <div id="diagramHost" class="glass" style="padding:10px"></div>
      </div>
    </section>

    <footer>CN Project • Go-Back-N • neon cinema 😎</footer>
  `;

  // Refs
  const $ = s => document.querySelector(s);
  const numFramesEl = $("#numFrames"), winSizeEl = $("#winSize"), timeoutEl = $("#timeout");
  const lossPercentEl = $("#lossPercent"), lossPercentVal = $("#lossPercentVal");
  const lossModeEl = $("#lossMode"), labelSpecific = $("#labelSpecific"), specificFramesEl = $("#specificFrames");
  const labelEveryK = $("#labelEveryK"), everyKEl = $("#everyK");
  const frameDelayModeEl = $("#frameDelayMode"), labelDelaySpec = $("#labelDelaySpec"), labelDelayMs = $("#labelDelayMs");
  const frameDelaySpecEl = $("#frameDelaySpec"), frameDelayMsEl = $("#frameDelayMs");
  const ackLossPercentEl = $("#ackLossPercent"), ackLossVal = $("#ackLossVal"), ackDelayMsEl = $("#ackDelayMs");
  const diagramTypeEl = $("#diagramType"), diagramModeLabel = $("#diagramModeLabel");

  const startBtn = $("#startBtn"), pauseBtn = $("#pauseBtn"), stepBtn = $("#stepBtn"), resetBtn = $("#resetBtn");
  const senderWindow = $("#senderWindow"), senderQueue = $("#senderQueue"), recvArea = $("#recvArea");
  const channelStage = $("#channelStage"), events = $("#events");
  const statsWrap = $("#statsWrap"), diagramHost = $("#diagramHost");

  // UI visibility (fix)
  const updateLossUI = () => {
    const v = lossModeEl.value;
    labelSpecific.classList.toggle("hidden", v !== "specific");
    labelEveryK.classList.toggle("hidden", v !== "everyk");
  };
  const updateDelayUI = () => {
    const on = frameDelayModeEl.value !== "none";
    labelDelaySpec.classList.toggle("hidden", !on);
    labelDelayMs.classList.toggle("hidden", !on);
  };
  const updateDiagramLabel = () => {
    const map = { vertical: "Vertical two-columns", textbook: "Textbook diagonals", animated: "Animated replay" };
    diagramModeLabel.textContent = map[diagramTypeEl.value] || "Vertical two-columns";
  };

  lossPercentEl.addEventListener("input", ()=> lossPercentVal.textContent = lossPercentEl.value + "%");
  ackLossPercentEl.addEventListener("input", ()=> ackLossVal.textContent = ackLossPercentEl.value + "%");
  lossModeEl.addEventListener("change", updateLossUI);
  frameDelayModeEl.addEventListener("change", updateDelayUI);
  diagramTypeEl.addEventListener("change", updateDiagramLabel);

  // State
  let N, timeout, lossProb, ackLossProb;
  let base, nextseq, seqLimit;
  let sentFrames = []; // {seq, acked, sends, dom}
  let running = false, timer = null;

  // diagram capture
  const diagram = { frames: [], acks: [] }; // frames:{seq, delivered}, acks:{seq, delivered}

  // stats
  const stats = {
    totalFrames: 0, totalTrans: 0, totalAcks: 0,
    framesLost: 0, acksLost: 0, framesDelayed: 0,
    framesDelivered: 0 // in-order accepted at receiver
  };

  function init(){
    N = clamp(parseInt(winSizeEl.value,10)||4, 1, 32);
    timeout = clamp(parseInt(timeoutEl.value,10)||5000, 800, 60000);
    lossProb = (parseInt(lossPercentEl.value,10)||0)/100;
    ackLossProb = (parseInt(ackLossPercentEl.value,10)||0)/100;

    base = 0; nextseq = 0;
    seqLimit = clamp(parseInt(numFramesEl.value,10)||12, 1, 300);
    sentFrames = [];
    running = false; clearTimer();

    stats.totalFrames = seqLimit; stats.totalTrans=0; stats.totalAcks=0;
    stats.framesLost=0; stats.acksLost=0; stats.framesDelayed=0; stats.framesDelivered=0;

    diagram.frames = []; diagram.acks = [];

    senderWindow.innerHTML=""; senderQueue.innerHTML=""; recvArea.innerHTML="";
    channelStage.innerHTML=""; events.innerHTML="";
    statsWrap.classList.add("hidden"); diagramHost.innerHTML="";

    for(let i=0;i<N;i++){
      const f = document.createElement("div");
      f.className="frame";
      f.textContent = (base+i)<seqLimit ? `#${base+i}` : "-";
      senderWindow.appendChild(f);
    }
    updateLossUI(); updateDelayUI(); updateDiagramLabel();
    log("Ready — Start for slow cinematic left→right flow.");
  }

  // helpers
  const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
  const log = msg => events.prepend(Object.assign(document.createElement("div"),{textContent:`[${new Date().toLocaleTimeString()}] ${msg}`}));
  const parseNums = txt => !txt?[]:txt.split(",").map(s=>parseInt(s.trim(),10)).filter(n=>!isNaN(n));

  const shouldLose = seq => {
    const m = lossModeEl.value;
    if(m==="none") return false;
    if(m==="random") return Math.random() < lossProb;
    if(m==="specific") return parseNums(specificFramesEl.value).includes(seq);
    if(m==="everyk"){ const k=parseInt(everyKEl.value,10)||1; return ((seq+1)%k)===0; }
    return false;
  };
  const shouldDelay = seq => {
    const m = frameDelayModeEl.value;
    if(m==="none") return false;
    const arr = parseNums(frameDelaySpecEl.value);
    if(m==="specific") return arr.includes(seq);
    if(m==="everyk"){ const k=parseInt(frameDelaySpecEl.value,10)||1; return ((seq+1)%k)===0; }
    return false;
  };

  function refreshWindow(){
    [...senderWindow.querySelectorAll(".frame")].forEach((f,i)=>{
      const seq = base + i;
      f.textContent = seq < seqLimit ? `#${seq}` : '-';
      f.classList.toggle("active", seq >= base && seq < nextseq && seq < seqLimit);
    });
  }

  // send loop
  function sendIfPossible(){
    while(nextseq < base + N && nextseq < seqLimit){
      sendFrame(nextseq);
      nextseq++;
    }
    refreshWindow();
  }

  // live animation L→R
  function sendFrame(seq, isRetrans=false){
    // badge in queue
    const badge = document.createElement("div");
    badge.className="packet"; badge.style.position="static";
    badge.textContent=`F${seq}`;
    senderQueue.appendChild(badge);

    stats.totalTrans++;

    // geometry
    const W = channelStage.clientWidth, H = channelStage.clientHeight;
    const leftX = 16, rightX = Math.max(120, W - 16 - 84);
    const y = 80 + (seq % 6) * 54;
    const start = {x:leftX, y};
    const end   = {x:rightX, y:y+36};

    // line + packet
    const line = mkLine(start,end,"neon-line");
    const p = mkPacket(`F${seq}`,"packet",start);
    channelStage.appendChild(line); channelStage.appendChild(p);

    const delayed = shouldDelay(seq);
    const extraDelay = delayed ? Math.max(0, parseInt(frameDelayMsEl.value,10)||0) : 0;
    if(delayed){ p.classList.add("delayed"); stats.framesDelayed++; }
    const lose = shouldLose(seq);

    const travel = 3800 + extraDelay; // very slow
    animateLR(p,start,end,travel);

    setTimeout(()=>{
      if(lose){
        p.classList.add("lost");
        line.classList.add("neon-line-lost");
        log(`Frame ${seq} lost in channel.`);
        stats.framesLost++;
        diagram.frames.push({seq, delivered:false});
        setTimeout(()=>{ safeRemove(p); fade(line); }, 700);
      } else {
        safeRemove(p); fade(line);
        diagram.frames.push({seq, delivered:true});
        onReceiverGot(seq);
      }
    }, travel + 100);

    let rec = sentFrames.find(s=>s.seq===seq);
    if(!rec){ rec={seq,acked:false,sends:1,dom:badge}; sentFrames.push(rec); }
    else { rec.sends++; badge.style.opacity="0.9"; }

    if(base===seq) startTimer();
  }

  // receiver / ack
  function onReceiverGot(seq){
    const exp = recvArea.childElementCount;
    if(seq===exp){
      const blk=document.createElement("div"); blk.className="frame active"; blk.textContent=`#${seq}`;
      recvArea.appendChild(blk);
      stats.framesDelivered++;
      log(`Receiver accepted ${seq}. Sending ACK ${seq}.`);
      sendAck(seq);
    } else {
      const a=exp-1;
      log(`Receiver discarded ${seq} (expected ${exp}). Sending ACK ${a}.`);
      sendAck(a);
    }
  }

  function sendAck(ackSeq){
    stats.totalAcks++;
    const W = channelStage.clientWidth;
    const leftX = 16, rightX = Math.max(120, W - 16 - 84);
    const y = 80 + (ackSeq % 6) * 54 + 36;
    const start={x:rightX,y}, end={x:leftX,y:y-36};

    const line = mkLine(start,end,"neon-line neon-line-ack");
    const a = mkPacket(`ACK${ackSeq}`,"packet ack",start);
    channelStage.appendChild(line); channelStage.appendChild(a);

    const loseAck = Math.random() < ackLossProb;
    const travel = 3400 + (parseInt(ackDelayMsEl.value,10)||0);
    animateLR(a,start,end,travel);

    setTimeout(()=>{
      if(loseAck){
        a.classList.add("lost");
        line.classList.add("neon-dash");
        log(`ACK ${ackSeq} lost on return path.`);
        stats.acksLost++;
        diagram.acks.push({seq:ackSeq, delivered:false});
        setTimeout(()=>{ safeRemove(a); fade(line); }, 700);
      } else {
        safeRemove(a); fade(line);
        diagram.acks.push({seq:ackSeq, delivered:true});
        onAckReceived(ackSeq);
      }
    }, travel + 100);
  }

  function onAckReceived(ackSeq){
    log(`Sender received ACK ${ackSeq}.`);
    sentFrames.forEach(s=>{ if(s.seq <= ackSeq) s.acked = true; });
    while(sentFrames.length && sentFrames[0].acked){
      const r=sentFrames.shift(); if(r&&r.dom){ r.dom.style.opacity="1"; r.dom.style.background="linear-gradient(180deg,#eafff7,#bff3e6)"; }
      base++;
    }
    if(sentFrames.length>0) startTimer(); else clearTimer();
    refreshWindow();
    if(running) sendIfPossible();
    if(base >= seqLimit) finish();
  }

  // timer/timeout
  function startTimer(){ clearTimer(); timer=setTimeout(onTimeout, timeout); }
  function clearTimer(){ if(timer){ clearTimeout(timer); timer=null; } }
  function onTimeout(){
    log(`Timeout at base ${base}. Retransmitting ${base}..${Math.min(base+N-1, seqLimit-1)}.`);
    const outstanding = sentFrames.map(s=>s.seq);
    outstanding.forEach(q=>sendFrame(q,true));
    if(sentFrames.length>0) startTimer();
  }

  // finish + stats + diagram
  function finish(){
    clearTimer(); running=false; log("Simulation complete. Preparing summary…");
    const delivered = stats.framesDelivered;
    const trans = Math.max(1, stats.totalTrans);
    const eff = (delivered / trans) * 100;
    const loss = (stats.framesLost / trans) * 100;

    setText("#stat_totalFrames", stats.totalFrames);
    setText("#stat_totalTrans", stats.totalTrans);
    setText("#stat_delivered", delivered);
    setText("#stat_totalAcks", stats.totalAcks);
    setText("#stat_framesLost", stats.framesLost);
    setText("#stat_acksLost", stats.acksLost);
    setText("#stat_efficiency", eff.toFixed(2) + "%");
    setText("#stat_lossPercent", loss.toFixed(2) + "%");
    $("#eff_fill").style.width = `${Math.max(0,Math.min(100,eff))}%`;

    // Render chosen diagram
    diagramHost.innerHTML="";
    const mode = diagramTypeEl.value; // vertical | textbook | animated
    renderDiagram(diagramHost, diagram, stats.totalFrames, mode);

    statsWrap.classList.remove("hidden");
  }
  const setText=(sel,txt)=>{const n=document.querySelector(sel); if(n) n.textContent=txt;};

  // diagram renderers (SVG)
  function renderDiagram(host, diag, framesCount, mode){
    if(mode === "vertical") return renderVertical(host, diag, framesCount, false);
    if(mode === "animated") return renderVertical(host, diag, framesCount, true);
    return renderTextbook(host, diag, framesCount, mode==="animated");
  }

  // Vertical two-columns (exactly like your screenshot): two rails + horizontal links
  function renderVertical(host, diag, rows, animated){
    const w = host.clientWidth || 800, rowGap = 60;
    const h = Math.max(200, rows*rowGap + 60);
    const padX = 90, colL = padX, colR = w - padX;
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS,"svg");
    svg.setAttribute("viewBox",`0 0 ${w} ${h}`); svg.setAttribute("width","100%"); svg.setAttribute("height",h);

    // rails
    svg.appendChild(vline(colL, 30, h-30, "#00ffff"));
    svg.appendChild(vline(colR, 30, h-30, "#4faaff"));
    svg.appendChild(label(colL-25, 20, "Sender"));
    svg.appendChild(label(colR-35, 20, "Receiver"));

    // row nodes + links
    let idx = 0;
    for(let i=0;i<rows;i++){
      const y = 40 + i*rowGap;
      svg.appendChild(node(colL, y, `#${i}`));
      svg.appendChild(node(colR, y, `#${i}`));
    }

    // frame lines (cyan or red dashed if lost)
    diag.frames.forEach(f=>{
      const y = 40 + f.seq*rowGap;
      const ln = hline(colL, y, colR, y, f.delivered ? "#00ffff" : "#ff6b6b", f.delivered ? 0 : 1);
      if(animated) dashDraw(ln, idx++); svg.appendChild(ln);
    });

    // ack lines slightly above the frame line (blue/dashed)
    diag.acks.forEach(a=>{
      const y = 40 + Math.max(0,a.seq)*rowGap - 10;
      const ln = hline(colR, y, colL, y, "#4faaff", a.delivered ? 0 : 1);
      if(animated) dashDraw(ln, idx++); svg.appendChild(ln);
    });

    host.appendChild(svg);

    // helpers
    function vline(x,y1,y2,color){
      const l = document.createElementNS(svgNS,"line");
      l.setAttribute("x1",x); l.setAttribute("y1",y1); l.setAttribute("x2",x); l.setAttribute("y2",y2);
      l.setAttribute("stroke", color); l.setAttribute("stroke-width","3"); l.setAttribute("opacity",".6");
      return l;
    }
    function hline(x1,y1,x2,y2,color,dashed){
      const l = document.createElementNS(svgNS,"line");
      l.setAttribute("x1",x1); l.setAttribute("y1",y1); l.setAttribute("x2",x2); l.setAttribute("y2",y2);
      l.setAttribute("stroke", color); l.setAttribute("stroke-width","3"); l.setAttribute("opacity",".9");
      if(dashed) l.setAttribute("stroke-dasharray","10 7");
      return l;
    }
    function node(x,y,t){
      const g = document.createElementNS(svgNS,"g");
      const c = document.createElementNS(svgNS,"circle");
      c.setAttribute("cx",x); c.setAttribute("cy",y); c.setAttribute("r","7");
      c.setAttribute("fill","rgba(255,255,255,0.1)"); c.setAttribute("stroke","rgba(255,255,255,0.35)");
      const tx = document.createElementNS(svgNS,"text");
      tx.setAttribute("x",x-22); tx.setAttribute("y",y-12); tx.setAttribute("fill","#eafaff");
      tx.setAttribute("font-size","12"); tx.textContent=t;
      g.appendChild(c); g.appendChild(tx); return g;
    }
    function label(x,y,txt){
      const t = document.createElementNS(svgNS,"text");
      t.setAttribute("x",x); t.setAttribute("y",y);
      t.setAttribute("fill","#00ffff"); t.setAttribute("font-size","14"); t.setAttribute("font-weight","700");
      t.textContent = txt; return t;
    }
    function dashDraw(line, i){
      const len = Math.hypot(line.x2.baseVal.value - line.x1.baseVal.value, line.y2.baseVal.value - line.y1.baseVal.value);
      line.setAttribute("stroke-dasharray", `${len}`);
      line.setAttribute("stroke-dashoffset", `${len}`);
      line.style.animation = `drawline 0.9s ${i*0.12}s ease forwards`;
      const style = document.createElement("style");
      style.textContent = `@keyframes drawline{to{stroke-dashoffset:0}}`;
      svg.appendChild(style);
    }
  }

  // Textbook diagonals (slanted)
  function renderTextbook(host, diag, rows, animated){
    const w = host.clientWidth || 800, rowGap = 60, h = Math.max(200, rows*rowGap + 60);
    const pad = 70, colL = pad, colR = w - pad;
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS,"svg");
    svg.setAttribute("viewBox",`0 0 ${w} ${h}`); svg.setAttribute("width","100%"); svg.setAttribute("height",h);

    svg.appendChild(label(colL-25, 20, "Sender"));
    svg.appendChild(label(colR-35, 20, "Receiver"));

    for(let i=0;i<rows;i++){
      const y = 40 + i*rowGap;
      svg.appendChild(node(colL, y, `#${i}`));
      svg.appendChild(node(colR, y, `#${i}`));
    }

    let idx=0;
    diag.frames.forEach(f=>{
      const y = 40 + f.seq*rowGap;
      const ln = seg(colL, y, colR, y+14, f.delivered ? "#00ffff" : "#ff6b6b", f.delivered ? 0 : 1);
      if(animated) dashDraw(ln, idx++); svg.appendChild(ln);
    });
    diag.acks.forEach(a=>{
      const y = 40 + Math.max(0,a.seq)*rowGap - 10;
      const ln = seg(colR, y+14, colL, y, a.delivered ? "#4faaff" : "#4faaff", a.delivered ? 0 : 1);
      if(!a.delivered) ln.setAttribute("stroke-dasharray","10 7");
      if(animated) dashDraw(ln, idx++); svg.appendChild(ln);
    });

    host.appendChild(svg);

    function node(x,y,t){
      const g = document.createElementNS(svgNS,"g");
      const r = document.createElementNS(svgNS,"rect");
      r.setAttribute("x",x-20); r.setAttribute("y",y-12); r.setAttribute("width",40); r.setAttribute("height",24);
      r.setAttribute("rx",6); r.setAttribute("fill","rgba(255,255,255,0.08)"); r.setAttribute("stroke","rgba(255,255,255,0.25)");
      const tx = document.createElementNS(svgNS,"text");
      tx.setAttribute("x",x-13); tx.setAttribute("y",y+4); tx.setAttribute("fill","#eafaff"); tx.setAttribute("font-size","12"); tx.textContent=t;
      g.appendChild(r); g.appendChild(tx); return g;
    }
    function seg(x1,y1,x2,y2,color,dashed){
      const l=document.createElementNS(svgNS,"line");
      l.setAttribute("x1",x1); l.setAttribute("y1",y1); l.setAttribute("x2",x2); l.setAttribute("y2",y2);
      l.setAttribute("stroke",color); l.setAttribute("stroke-width","3"); l.setAttribute("opacity",".9");
      if(dashed) l.setAttribute("stroke-dasharray","10 7");
      return l;
    }
    function label(x,y,txt){
      const t=document.createElementNS(svgNS,"text");
      t.setAttribute("x",x); t.setAttribute("y",y);
      t.setAttribute("fill","#00ffff"); t.setAttribute("font-size","14"); t.setAttribute("font-weight","700");
      t.textContent=txt; return t;
    }
    function dashDraw(line,i){
      const len = Math.hypot(line.x2.baseVal.value - line.x1.baseVal.value, line.y2.baseVal.value - line.y1.baseVal.value);
      line.setAttribute("stroke-dasharray", `${len}`);
      line.setAttribute("stroke-dashoffset", `${len}`);
      line.style.animation = `drawT 0.9s ${i*0.12}s ease forwards`;
      const style = document.createElement("style"); style.textContent = `@keyframes drawT{to{stroke-dashoffset:0}}`;
      svg.appendChild(style);
    }
  }

  // live-sim geometry helpers
  function mkLine(a,b,cls){ const d=document.createElement("div"); d.className=cls||"neon-line"; placeLine(d,a,b); return d; }
  function placeLine(line,a,b){
    const dx=b.x-a.x, dy=b.y-a.y;
    const len=Math.sqrt(dx*dx+dy*dy), ang=Math.atan2(dy,dx)*180/Math.PI;
    line.style.width=`${len}px`; line.style.left=`${a.x}px`; line.style.top=`${a.y}px`;
    line.style.transform=`rotate(${ang}deg)`;
  }
  function mkPacket(text, cls, pos){ const p=document.createElement("div"); p.className=cls; p.textContent=text; p.style.left=`${pos.x}px`; p.style.top=`${pos.y}px`; return p; }
  function animateLR(elm,a,b,ms){
    elm.style.opacity="1";
    const s=performance.now();
    (function step(t){
      const k=Math.min(1,(t-s)/ms), e=ease(k);
      elm.style.left=`${a.x+(b.x-a.x)*e}px`; elm.style.top=`${a.y+(b.y-a.y)*e}px`;
      if(k<1) requestAnimationFrame(step);
    })(s);
  }
  const ease = k => k<0.5 ? 2*k*k : -1 + (4-2*k)*k;
  const fade = el=>{ el.style.transition="opacity .5s"; el.style.opacity="0"; setTimeout(()=>safeRemove(el),520); };
  const safeRemove = el=>{ if(el && el.parentNode) el.parentNode.removeChild(el); };

  // controls
  startBtn.addEventListener("click", ()=>{ if(running) return; running=true; log("Started."); sendIfPossible(); });
  pauseBtn.addEventListener("click", ()=>{ running=false; clearTimer(); log("Paused."); });
  stepBtn.addEventListener("click", ()=>{ if(!running){ const pre=nextseq; sendIfPossible(); if(nextseq===pre) log("Step: window full / finished."); }});
  resetBtn.addEventListener("click", ()=>{ init(); log("Reset."); });

  // timer
  function startTimer(){ clearTimer(); timer=setTimeout(onTimeout, timeout); }
  function clearTimer(){ if(timer){ clearTimeout(timer); timer=null; } }
  function onTimeout(){
    log(`Timeout at base ${base}. Retransmitting ${base}..${Math.min(base+N-1, seqLimit-1)}.`);
    const outstanding=sentFrames.map(s=>s.seq);
    outstanding.forEach(q=>sendFrame(q,true));
    if(sentFrames.length>0) startTimer();
  }

  // boot
  init();
})();
