// js/app.js — Left→Right Cinematic GBN with Diagram Type (Static/Animated) + Pretty Summary
(function(){
  // Build UI
  const app = document.getElementById("app");
  app.innerHTML = `
    <header class="glass">
      <h1>Go-Back-N ARQ — Neon Glass</h1>
      <p>Sender (left) → Receiver (right). Packets glide right; ACKs glide left. Summary shows after the last ACK.</p>

      <div class="controls">
        <label>Number of frames
          <input id="numFrames" type="number" min="1" max="300" value="12">
        </label>
        <label>Window size (N)
          <input id="winSize" type="number" min="1" max="32" value="4">
        </label>
        <label>Timeout (ms)
          <input id="timeout" type="number" min="1000" value="5000">
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
            <option value="static">Static textbook</option>
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
      <div class="lane" id="senderLane">
        <h3>Sender</h3>
        <div id="senderWindow" class="window"></div>
        <div id="senderQueue" class="queue"></div>
      </div>
      <div class="channel glass" id="channel">
        <div id="channelStage"></div>
      </div>
      <div class="lane" id="receiverLane">
        <h3>Receiver</h3>
        <div id="recvArea" class="recv"></div>
      </div>
    </section>

    <section class="glass">
      <h3 style="text-align:center;color:#00ffff;margin-bottom:6px">Event Log</h3>
      <div id="events" class="log"></div>
    </section>

    <section class="glass hidden" id="statsWrap">
      <h3>📊 Summary</h3>
      <div class="stats">
        <div class="stat-card"><div class="stat-label">Total original frames</div><div class="stat-value" id="stat_totalFrames">0</div></div>
        <div class="stat-card"><div class="stat-label">Total transmissions</div><div class="stat-value" id="stat_totalTrans">0</div></div>
        <div class="stat-card"><div class="stat-label">Total ACKs generated</div><div class="stat-value" id="stat_totalAcks">0</div></div>
        <div class="stat-card"><div class="stat-label">Frames lost</div><div class="stat-value" id="stat_framesLost">0</div></div>
        <div class="stat-card"><div class="stat-label">ACKs lost</div><div class="stat-value" id="stat_acksLost">0</div></div>
        <div class="stat-card"><div class="stat-label">Frames delayed</div><div class="stat-value" id="stat_framesDelayed">0</div></div>
        <div class="stat-card">
          <div class="stat-label">Efficiency</div>
          <div class="stat-value" id="stat_efficiency">0%</div>
          <div class="eff-bar"><div id="eff_fill" class="eff-fill" style="width:0%"></div></div>
        </div>
        <div class="stat-card"><div class="stat-label">Loss percent (frames / transmissions)</div><div class="stat-value" id="stat_lossPercent">0%</div></div>
      </div>

      <div style="margin-top:12px">
        <h4 style="color:#a9c2d6;margin-bottom:6px">Flow Diagram</h4>
        <div id="diagramHost" class="glass" style="padding:10px"></div>
      </div>
    </section>

    <footer>CN Project • Go-Back-N • neon cinema 😎</footer>
  `;

  // --------- Refs
  const $ = s => document.querySelector(s);
  const numFramesEl = $("#numFrames"), winSizeEl = $("#winSize"), timeoutEl = $("#timeout");
  const lossPercentEl = $("#lossPercent"), lossPercentVal = $("#lossPercentVal");
  const lossModeEl = $("#lossMode"), labelSpecific = $("#labelSpecific"), specificFramesEl = $("#specificFrames");
  const labelEveryK = $("#labelEveryK"), everyKEl = $("#everyK");
  const frameDelayModeEl = $("#frameDelayMode"), labelDelaySpec = $("#labelDelaySpec"), labelDelayMs = $("#labelDelayMs");
  const frameDelaySpecEl = $("#frameDelaySpec"), frameDelayMsEl = $("#frameDelayMs");
  const ackLossPercentEl = $("#ackLossPercent"), ackLossVal = $("#ackLossVal"), ackDelayMsEl = $("#ackDelayMs");
  const diagramTypeEl = $("#diagramType");

  const startBtn = $("#startBtn"), pauseBtn = $("#pauseBtn"), stepBtn = $("#stepBtn"), resetBtn = $("#resetBtn");
  const senderWindow = $("#senderWindow"), senderQueue = $("#senderQueue"), recvArea = $("#recvArea");
  const channelStage = $("#channelStage"), events = $("#events");
  const statsWrap = $("#statsWrap"), diagramHost = $("#diagramHost");

  // --------- UI visibility fixes
  const updateLossUI = () => {
    const v = lossModeEl.value;
    labelSpecific.classList.toggle("hidden", v !== "specific");
    labelEveryK.classList.toggle("hidden", v !== "everyk");
  };
  const updateDelayUI = () => {
    const v = frameDelayModeEl.value;
    const on = v !== "none";
    labelDelaySpec.classList.toggle("hidden", !on);
    labelDelayMs.classList.toggle("hidden", !on);
  };
  lossPercentEl.addEventListener("input", ()=> lossPercentVal.textContent = lossPercentEl.value + "%");
  ackLossPercentEl.addEventListener("input", ()=> ackLossVal.textContent = ackLossPercentEl.value + "%");
  lossModeEl.addEventListener("change", updateLossUI);
  frameDelayModeEl.addEventListener("change", updateDelayUI);

  // --------- State
  let N, timeout, lossProb, ackLossProb;
  let base, nextseq, seqLimit;
  let sentFrames = []; // {seq, acked, sends, dom}
  let running = false, timer = null;

  // For diagram snapshot
  const diagram = { frames: [], acks: [] }; // frames: {seq, delivered}, acks: {seq, delivered}

  const stats = { totalFrames:0, totalTrans:0, totalAcks:0, framesLost:0, acksLost:0, framesDelayed:0 };

  // --------- Init/Reset
  function init(){
    N = clamp(parseInt(winSizeEl.value,10)||4, 1, 32);
    timeout = clamp(parseInt(timeoutEl.value,10)||5000, 800, 60000);
    lossProb = (parseInt(lossPercentEl.value,10)||0)/100;
    ackLossProb = (parseInt(ackLossPercentEl.value,10)||0)/100;

    base = 0; nextseq = 0;
    seqLimit = clamp(parseInt(numFramesEl.value,10)||12, 1, 300);
    sentFrames = [];
    running = false; clearTimer();

    stats.totalFrames = seqLimit; stats.totalTrans=0; stats.totalAcks=0; stats.framesLost=0; stats.acksLost=0; stats.framesDelayed=0;
    diagram.frames = []; diagram.acks = [];

    senderWindow.innerHTML=""; senderQueue.innerHTML=""; recvArea.innerHTML="";
    channelStage.innerHTML=""; events.innerHTML=""; diagramHost.innerHTML="";
    statsWrap.classList.add("hidden");

    for(let i=0;i<N;i++){
      const s = document.createElement("div"); s.className="frame";
      s.textContent = (base+i) < seqLimit ? `#${base+i}` : "-";
      senderWindow.appendChild(s);
    }
    updateLossUI(); updateDelayUI();
    log("Ready — Start for slow cinematic left→right flow.");
  }

  // --------- Helpers
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

  // --------- Sender
  function sendIfPossible(){
    while(nextseq < base + N && nextseq < seqLimit){
      sendFrame(nextseq);
      nextseq++;
    }
    refreshWindow();
  }

  function sendFrame(seq, isRetrans=false){
    const badge = document.createElement("div");
    badge.className = "packet"; badge.style.position="static";
    badge.textContent = `F${seq}`;
    senderQueue.appendChild(badge);

    stats.totalTrans++;

    // positions (responsive)
    const W = channelStage.clientWidth, H = channelStage.clientHeight;
    const leftX = 16, rightX = Math.max(120, W - 16 - 84);
    const y = 80 + (seq % 6) * 54;

    const start = {x:leftX, y};
    const end   = {x:rightX, y:y+36};

    // line + packet
    const line = mkLine(start,end,"neon-line");
    const p = mkPacket(`F${seq}`,"packet",start);
    channelStage.appendChild(line); channelStage.appendChild(p);

    // delay/loss
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

  // --------- Receiver / ACKs
  function onReceiverGot(seq){
    const exp = recvArea.childElementCount;
    if(seq===exp){
      const blk=document.createElement("div"); blk.className="frame active"; blk.textContent=`#${seq}`;
      recvArea.appendChild(blk);
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
    const W = channelStage.clientWidth, H = channelStage.clientHeight;
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

  // --------- Timer / Timeout
  function startTimer(){ clearTimer(); timer=setTimeout(onTimeout, timeout); }
  function clearTimer(){ if(timer){ clearTimeout(timer); timer=null; } }
  function onTimeout(){
    log(`Timeout at base ${base}. Retransmitting ${base}..${Math.min(base+N-1, seqLimit-1)}.`);
    const outstanding = sentFrames.map(s=>s.seq);
    outstanding.forEach(q=>sendFrame(q,true));
    if(sentFrames.length>0) startTimer();
  }

  // --------- Finish + Summary + Diagram
  function finish(){
    clearTimer(); running=false; log("Simulation complete. Preparing summary…");
    const eff = stats.totalTrans ? (stats.totalFrames / stats.totalTrans) * 100 : 100;
    const loss = stats.totalTrans ? (stats.framesLost / stats.totalTrans) * 100 : 0;

    setText("#stat_totalFrames", stats.totalFrames);
    setText("#stat_totalTrans", stats.totalTrans);
    setText("#stat_totalAcks", stats.totalAcks);
    setText("#stat_framesLost", stats.framesLost);
    setText("#stat_acksLost", stats.acksLost);
    setText("#stat_framesDelayed", stats.framesDelayed);
    setText("#stat_efficiency", eff.toFixed(2) + "%");
    setText("#stat_lossPercent", loss.toFixed(2) + "%");
    $("#eff_fill").style.width = `${Math.max(0,Math.min(100,eff))}%`;

    // Render diagram like your screenshot (sender left, receiver right)
    diagramHost.innerHTML = "";
    const animated = diagramTypeEl.value === "animated";
    renderFlowDiagram(diagramHost, diagram, stats.totalFrames, animated);

    statsWrap.classList.remove("hidden");
  }
  const setText=(sel,txt)=>{const n=document.querySelector(sel); if(n) n.textContent=txt;};

  // --------- Diagram (SVG)
  function renderFlowDiagram(host, diag, framesCount, animated){
    const rows = framesCount;
    const w = host.clientWidth || 800, h = Math.max(200, rows*40 + 40);
    const pad = 60, colL = pad, colR = w - pad, rowGap = 40;

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS,"svg");
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.setAttribute("width","100%"); svg.setAttribute("height", h);

    // columns titles
    svg.appendChild(label(colL-30, 20, "Sender"));
    svg.appendChild(label(colR-40, 20, "Receiver"));

    // row markers
    for(let i=0;i<rows;i++){
      const y = 40 + i*rowGap;
      svg.appendChild(nodeBox(colL-20, y-12, `F${i}`)); // sender node
      svg.appendChild(nodeBox(colR-20, y-12, `F${i}`)); // receiver node (for symmetry)
    }

    // Draw frame lines
    diag.frames.forEach(f=>{
      const i = f.seq;
      const y = 40 + i*rowGap;
      const line = seg(colL+20, y, colR-20, y+14, f.delivered ? "cyan" : "lost");
      svg.appendChild(line);
    });

    // Draw ACK lines (right→left, above the frame line)
    diag.acks.forEach(a=>{
      const i = Math.max(0, a.seq);
      const y = 40 + i*rowGap - 10;
      const line = seg(colR-20, y+14, colL+20, y, a.delivered ? "ack" : "acklost");
      svg.appendChild(line);
    });

    // Animation (stroke-dash) if chosen
    if(animated){
      [...svg.querySelectorAll("line")].forEach((ln, idx)=>{
        const len = Math.hypot( ln.x2.baseVal.value - ln.x1.baseVal.value, ln.y2.baseVal.value - ln.y1.baseVal.value );
        ln.setAttribute("stroke-dasharray", `${len}`);
        ln.setAttribute("stroke-dashoffset", `${len}`);
        ln.style.animation = `draw 0.9s ${idx*0.12}s ease forwards`;
      });
      const style = document.createElement("style");
      style.textContent = `@keyframes draw{to{stroke-dashoffset:0}}`;
      svg.appendChild(style);
    }

    host.appendChild(svg);

    // helpers for svg
    function nodeBox(x,y,text){
      const g = document.createElementNS(svgNS,"g");
      const r = document.createElementNS(svgNS,"rect");
      r.setAttribute("x",x); r.setAttribute("y",y);
      r.setAttribute("width",40); r.setAttribute("height",24);
      r.setAttribute("rx",6); r.setAttribute("fill","rgba(255,255,255,0.08)");
      r.setAttribute("stroke","rgba(255,255,255,0.25)");
      const t = document.createElementNS(svgNS,"text");
      t.setAttribute("x",x+7); t.setAttribute("y",y+16);
      t.setAttribute("fill","#eafaff"); t.setAttribute("font-size","12"); t.textContent=text;
      g.appendChild(r); g.appendChild(t); return g;
    }
    function label(x,y,txt){
      const t = document.createElementNS(svgNS,"text");
      t.setAttribute("x",x); t.setAttribute("y",y);
      t.setAttribute("fill","#00ffff"); t.setAttribute("font-size","14"); t.setAttribute("font-weight","700");
      t.textContent = txt; return t;
    }
    function seg(x1,y1,x2,y2,type){
      const l = document.createElementNS(svgNS,"line");
      l.setAttribute("x1",x1); l.setAttribute("y1",y1);
      l.setAttribute("x2",x2); l.setAttribute("y2",y2);
      l.setAttribute("stroke-width","3");
      if(type==="cyan"){ l.setAttribute("stroke","#00ffff"); l.setAttribute("opacity","0.9"); }
      if(type==="lost"){ l.setAttribute("stroke","#ff6b6b"); l.setAttribute("opacity","0.9"); l.setAttribute("stroke-dasharray","8 6"); }
      if(type==="ack"){ l.setAttribute("stroke","#4faaff"); l.setAttribute("opacity","0.9"); }
      if(type==="acklost"){ l.setAttribute("stroke","#4faaff"); l.setAttribute("opacity","0.9"); l.setAttribute("stroke-dasharray","8 6"); }
      return l;
    }
  }

  // --------- Geometry + Anim helpers for live sim
  function mkLine(a,b,cls){
    const d = document.createElement("div");
    d.className = cls || "neon-line";
    placeLine(d,a,b); return d;
  }
  function placeLine(line,a,b){
    const dx=b.x-a.x, dy=b.y-a.y;
    const len = Math.sqrt(dx*dx + dy*dy);
    const ang = Math.atan2(dy, dx) * 180/Math.PI;
    line.style.width = `${len}px`; line.style.left = `${a.x}px`; line.style.top = `${a.y}px`;
    line.style.transform = `rotate(${ang}deg)`;
  }
  function mkPacket(text, cls, pos){
    const p = document.createElement("div");
    p.className = cls; p.textContent = text;
    p.style.left = `${pos.x}px`; p.style.top = `${pos.y}px`; return p;
  }
  function animateLR(elm,a,b,ms){
    elm.style.opacity="1";
    const start=performance.now();
    (function step(t){
      const k=Math.min(1,(t-start)/ms), e=ease(k);
      elm.style.left = `${a.x + (b.x-a.x)*e}px`;
      elm.style.top  = `${a.y + (b.y-a.y)*e}px`;
      if(k<1) requestAnimationFrame(step);
    })(start);
  }
  const ease = k => k<0.5 ? 2*k*k : -1 + (4-2*k)*k;
  const fade = el=>{ el.style.transition="opacity .5s"; el.style.opacity="0"; setTimeout(()=>safeRemove(el),520); };
  const safeRemove = el=>{ if(el && el.parentNode) el.parentNode.removeChild(el); };

  // --------- Controls
  startBtn.addEventListener("click", ()=>{ if(running) return; running=true; log("Started."); sendIfPossible(); });
  pauseBtn.addEventListener("click", ()=>{ running=false; clearTimer(); log("Paused."); });
  stepBtn.addEventListener("click", ()=>{ if(!running){ const pre=nextseq; sendIfPossible(); if(nextseq===pre) log("Step: window full / finished."); }});
  resetBtn.addEventListener("click", ()=>{ init(); log("Reset."); });

  // --------- Timer
  function startTimer(){ clearTimer(); timer=setTimeout(onTimeout, timeout); }
  function clearTimer(){ if(timer){ clearTimeout(timer); timer=null; } }
  function onTimeout(){
    log(`Timeout at base ${base}. Retransmitting ${base}..${Math.min(base+N-1, seqLimit-1)}.`);
    const outstanding=sentFrames.map(s=>s.seq);
    outstanding.forEach(q=>sendFrame(q,true));
    if(sentFrames.length>0) startTimer();
  }

  // --------- Completion check inside ACK receive
  function finishIfDone(){ if(base >= seqLimit) finish(); }

  // integrate finish check into ack handler
  function onAckReceived(ackSeq){
    // replaced above (but defined earlier). This placeholder avoids ref errors if re-ordered.
  }

  // override the ack handler now that finish() exists
  const _oldOnAckReceived = function(ackSeq){
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
  };
  // rebind
  eval("onAckReceived = _oldOnAckReceived");

  // --------- Boot
  init();

})();
