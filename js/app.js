// js/app.js — Go-Back-N ARQ Visual Simulator (Light Theme, Final)
// Created by Sunesh Krishnan N & Aravind G | Guided by Dr. Swaminathan Annadurai
// Features:
// • True Go-Back-N: window N, pipelined sends, timeout → retransmit base..nextSeq-1
// • ACK only after arrival
// • Animations are PAUSABLE (lines + bubbles) with Pause/Resume logs
// • Step mode: one full frame cycle incl. retransmissions (faster @ 4s)
// • Strict dropdown visibility for Specific/Every-k/Delay fields
// • Packet bubbles with tooltips; Palette A: Blue=Frame, Green=ACK, Red=Lost

(function () {
  // ===== mount root (in case index.html only has <div id="app"></div>) =====
  let root = document.getElementById("app");
  if (!root) {
    root = document.createElement("div");
    root.id = "app";
    document.body.appendChild(root);
  }

  // ===== UI scaffold (light theme, no guide line in header; footer handled by HTML) =====
  root.innerHTML = `
    <header class="glass" style="background:rgba(255,255,255,.7);border:1px solid rgba(0,0,0,.06);padding:14px 16px;border-radius:16px;margin:12px auto;max-width:1100px">
      <h1 style="margin:0 0 4px;color:#0b1e2b;font-size:24px">Go-Back-N ARQ — Visual Simulator</h1>
      <p style="margin:0 0 8px;color:#314a5a">Sliding window up to N. Timeout → retransmit from base. ACKs only after arrival.</p>

      <div class="controls" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">
        <label>Number of frames
          <input id="numFrames" type="number" min="1" max="300" value="12">
        </label>

        <label>Window size (N)
          <input id="winSize" type="number" min="1" max="32" value="4">
        </label>

        <label>Timeout (ms)
          <input id="timeout" type="number" min="2000" value="6000">
        </label>

        <label>Loss %
          <input id="lossPercent" type="range" min="0" max="80" value="15">
          <span id="lossPercentVal">15%</span>
        </label>

        <label>Frame Loss Mode
          <select id="lossMode">
            <option value="random">Random (by Loss %)</option>
            <option value="specific">Specific frame(s)</option>
            <option value="everyk">Every k-th</option>
            <option value="none">None</option>
          </select>
        </label>

        <label id="wrapSpecific" class="hidden">Specific frames (comma)
          <input id="specificFrames" type="text" placeholder="e.g. 2,7,9">
        </label>

        <label id="wrapEveryK" class="hidden">k (every k-th)
          <input id="everyK" type="number" min="1" value="3">
        </label>

        <label>Frame Delay Mode
          <select id="frameDelayMode">
            <option value="none">None</option>
            <option value="specific">Delay specific frame(s)</option>
            <option value="everyk">Delay every k-th</option>
          </select>
        </label>

        <label id="wrapDelaySpec" class="hidden">Delay frame # / k
          <input id="frameDelaySpec" type="text" placeholder="e.g. 5 or 3">
        </label>

        <label id="wrapDelayMs" class="hidden">Frame delay (ms)
          <input id="frameDelayMs" type="number" min="0" value="1200">
        </label>

        <label>ACK Loss %
          <input id="ackLossPercent" type="range" min="0" max="80" value="5">
          <span id="ackLossVal">5%</span>
        </label>

        <label>ACK Delay (ms)
          <input id="ackDelayMs" type="number" min="0" value="800">
        </label>

        <label>Simulation Mode
          <select id="simMode">
            <option value="textbook">Textbook 2D (draw + move)</option>
            <option value="vertical">Vertical columns (draw + move)</option>
            <option value="replay">Animated replay (summary only)</option>
          </select>
        </label>

        <label>Summary Diagram
          <select id="diagramType">
            <option value="vertical">Vertical two-columns</option>
            <option value="textbook">Textbook diagonals</option>
            <option value="animated">Animated replay</option>
          </select>
        </label>
      </div>

      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
        <button id="startBtn">Start</button>
        <button id="pauseBtn">Pause</button>
        <button id="stepBtn">Step</button>
        <button id="resetBtn">Reset</button>
      </div>
    </header>

    <section class="glass" style="background:rgba(255,255,255,.65);border:1px solid rgba(0,0,0,.06);padding:12px;border-radius:16px;margin:12px auto;max-width:1100px">
      <div class="sim-area" style="display:grid;grid-template-columns:1fr 2fr 1fr;gap:12px;align-items:start">
        <div class="lane">
          <h3 style="margin:0 0 6px;color:#0b1e2b">Sender</h3>
          <div id="senderWindow" class="window"></div>
          <div id="senderQueue" class="queue"></div>
        </div>

        <div class="channel glass" style="background:rgba(255,255,255,.85);border:1px solid rgba(0,0,0,.06);border-radius:14px;padding:6px;position:relative;height:480px">
          <svg id="liveSvg" width="100%" height="100%" style="position:absolute;inset:0;"></svg>
          <div id="channelStage" style="position:absolute;inset:0;"></div>
        </div>

        <div class="lane">
          <h3 style="margin:0 0 6px;color:#0b1e2b">Receiver</h3>
          <div id="recvArea" class="recv"></div>
        </div>
      </div>
    </section>

    <section class="glass" style="background:rgba(255,255,255,.6);border:1px solid rgba(0,0,0,.06);padding:12px;border-radius:16px;margin:12px auto;max-width:1100px">
      <h3 style="text-align:center;margin:0 0 6px;color:#0b1e2b">Event Log</h3>
      <div id="events" class="log" style="height:170px;overflow:auto;font-family:ui-monospace,monospace;color:#324a59"></div>
    </section>

    <section class="glass hidden" id="statsWrap" style="background:rgba(255,255,255,.7);border:1px solid rgba(0,0,0,.06);padding:12px;border-radius:16px;margin:12px auto;max-width:1100px">
      <h3 style="text-align:center;margin:0 0 10px;color:#0b1e2b">📊 Simulation Results</h3>
      <div class="stats" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px">
        <div class="stat-card"><div class="stat-label">Total original frames</div><div class="stat-value" id="stat_totalFrames">0</div></div>
        <div class="stat-card"><div class="stat-label">Total transmissions</div><div class="stat-value" id="stat_totalTrans">0</div></div>
        <div class="stat-card"><div class="stat-label">Frames delivered</div><div class="stat-value" id="stat_delivered">0</div></div>
        <div class="stat-card"><div class="stat-label">Total ACKs generated</div><div class="stat-value" id="stat_totalAcks">0</div></div>
        <div class="stat-card"><div class="stat-label">Frames lost</div><div class="stat-value" id="stat_framesLost">0</div></div>
        <div class="stat-card"><div class="stat-label">ACKs lost</div><div class="stat-value" id="stat_acksLost">0</div></div>
        <div class="stat-card">
          <div class="stat-label">Efficiency</div>
          <div class="stat-value" id="stat_efficiency">0%</div>
          <div class="eff-bar" style="height:6px;background:#e6f4ef;border-radius:999px;margin-top:6px"><div id="eff_fill" style="height:6px;width:0%;background:#1faa8a;border-radius:999px"></div></div>
        </div>
        <div class="stat-card"><div class="stat-label">Loss percent</div><div class="stat-value" id="stat_lossPercent">0%</div></div>
      </div>

      <div style="margin-top:12px">
        <h4 style="margin:0 0 6px;color:#3e5566">Flow Diagram (<span id="diagramModeLabel">Vertical two-columns</span>)</h4>
        <div id="diagramHost" class="glass" style="padding:10px;background:rgba(255,255,255,.65);border:1px solid rgba(0,0,0,.06);border-radius:12px"></div>
      </div>
    </section>
  `;

  // ===== Inputs styling =====
  document.querySelectorAll(".controls input, .controls select").forEach(el=>{
    el.style.background = "rgba(255,255,255,.95)";
    el.style.color = "#0b1e2b";
    el.style.border = "1px solid rgba(0,0,0,.2)";
    el.style.padding = "6px 8px";
    el.style.borderRadius = "10px";
    el.style.width = "100%";
    el.style.boxSizing = "border-box";
    el.style.opacity = "1";
  });

  // ===== Refs =====
  const $ = s => document.querySelector(s);
  const numFramesEl = $("#numFrames"), winSizeEl = $("#winSize"), timeoutEl = $("#timeout");
  const lossPercentEl = $("#lossPercent"), lossPercentVal = $("#lossPercentVal");
  const lossModeEl = $("#lossMode"), wrapSpecific = $("#wrapSpecific"), specificFramesEl = $("#specificFrames");
  const wrapEveryK = $("#wrapEveryK"), everyKEl = $("#everyK");
  const frameDelayModeEl = $("#frameDelayMode"), wrapDelaySpec = $("#wrapDelaySpec"), wrapDelayMs = $("#wrapDelayMs");
  const frameDelaySpecEl = $("#frameDelaySpec"), frameDelayMsEl = $("#frameDelayMs");
  const ackLossPercentEl = $("#ackLossPercent"), ackLossVal = $("#ackLossVal"), ackDelayMsEl = $("#ackDelayMs");
  const simModeEl = $("#simMode");
  const diagramTypeEl = $("#diagramType"), diagramModeLabel = $("#diagramModeLabel");

  const startBtn = $("#startBtn"), pauseBtn = $("#pauseBtn"), stepBtn = $("#stepBtn"), resetBtn = $("#resetBtn");
  const senderWindow = $("#senderWindow"), senderQueue = $("#senderQueue"), recvArea = $("#recvArea");
  const channelStage = $("#channelStage"), liveSvg = $("#liveSvg"), events = $("#events");
  const statsWrap = $("#statsWrap"), diagramHost = $("#diagramHost");

  // ===== Strict dropdown visibility =====
  function applyStrictVisibility(){
    const lm = lossModeEl.value;
    wrapSpecific.classList.toggle("hidden", lm !== "specific");
    wrapEveryK.classList.toggle("hidden", lm !== "everyk");

    const dm = frameDelayModeEl.value;
    const on = dm !== "none";
    wrapDelaySpec.classList.toggle("hidden", !on);
    wrapDelayMs.classList.toggle("hidden", !on);
  }
  function updateDiagramLabel(){
    const map = { vertical:"Vertical two-columns", textbook:"Textbook diagonals", animated:"Animated replay" };
    diagramModeLabel.textContent = map[diagramTypeEl.value] || "Vertical two-columns";
  }
  lossPercentEl.addEventListener("input", ()=> lossPercentVal.textContent = lossPercentEl.value + "%");
  ackLossPercentEl.addEventListener("input", ()=> ackLossVal.textContent = ackLossPercentEl.value + "%");
  lossModeEl.addEventListener("change", applyStrictVisibility);
  frameDelayModeEl.addEventListener("change", applyStrictVisibility);
  diagramTypeEl.addEventListener("change", updateDiagramLabel);

  // ===== Utils =====
  const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
  const parseNums = t => !t?[]:t.split(",").map(s=>parseInt(s.trim(),10)).filter(n=>!isNaN(n));
  const sleep = ms => new Promise(r=>setTimeout(r,ms));
  const setTxt = (sel, txt) => { const n=document.querySelector(sel); if(n) n.textContent=txt; };
  const log = m => events.prepend(Object.assign(document.createElement("div"), { textContent: `[${new Date().toLocaleTimeString()}] ${m}` }));

  // ===== Animation framework (pausable RAF for lines + bubbles) =====
  let PAUSED = false;
  function pauseAll(){ PAUSED = true; log("Simulation paused."); }
  function resumeAll(){ PAUSED = false; log("Simulation resumed."); }

  async function rafProgress(durationMs){
    // returns a promise that resolves when elapsed=durationMs; respects PAUSED
    return new Promise(resolve=>{
      const start = performance.now();
      let pausedAt = null;
      function tick(t){
        if(PAUSED){
          if(pausedAt === null) pausedAt = t;
          requestAnimationFrame(tick);
          return;
        }
        if(pausedAt !== null){
          // shift start by paused duration
          const pausedDelta = t - pausedAt;
          pausedAt = null;
          // adjust start forward so elapsed ignores paused time
          startTimeShift += pausedDelta;
        }
        const elapsed = t - start - startTimeShift;
        const k = Math.min(1, elapsed / durationMs);
        if(k >= 1) resolve(); else requestAnimationFrame(tick);
      }
      let startTimeShift = 0;
      requestAnimationFrame(tick);
    });
  }

  function animateLinePausable(x1,y1,x2,y2,color,dashed,durationMs){
    const ln = document.createElementNS("http://www.w3.org/2000/svg","line");
    ln.setAttribute("x1",x1); ln.setAttribute("y1",y1);
    ln.setAttribute("x2",x2); ln.setAttribute("y2",y2);
    ln.setAttribute("stroke", color); ln.setAttribute("stroke-width","3");
    if(dashed) ln.setAttribute("stroke-dasharray","10 7");
    liveSvg.appendChild(ln);

    const len = Math.hypot(x2-x1,y2-y1);
    ln.setAttribute("stroke-dasharray", `${len}`);
    ln.setAttribute("stroke-dashoffset", `${len}`);

    return new Promise(resolve=>{
      const start = performance.now();
      let pausedAt = null, shift = 0;
      function step(t){
        if(PAUSED){
          if(pausedAt===null) pausedAt=t;
          requestAnimationFrame(step); return;
        }
        if(pausedAt!==null){ shift += (t - pausedAt); pausedAt=null; }
        const elapsed = t - start - shift;
        const k = Math.min(1, elapsed/durationMs);
        const off = (1-k)*len;
        ln.setAttribute("stroke-dashoffset", `${off}`);
        if(k>=1) resolve(ln); else requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  function animateBubbleMove(el, a, b, durationMs){
    el.style.opacity="1";
    return new Promise(resolve=>{
      const start = performance.now();
      let pausedAt = null, shift = 0;
      function step(t){
        if(PAUSED){
          if(pausedAt===null) pausedAt=t;
          requestAnimationFrame(step); return;
        }
        if(pausedAt!==null){ shift += (t - pausedAt); pausedAt=null; }
        const elapsed = t - start - shift;
        const k = Math.min(1, elapsed/durationMs);
        const e = k<0.5 ? 2*k*k : -1 + (4-2*k)*k;
        el.style.left = (a.x + (b.x-a.x)*e) + "px";
        el.style.top  = (a.y + (b.y-a.y)*e) + "px";
        if(k>=1) resolve(); else requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  function bubble(text, title, pos, type){
    // type: "frame" (blue), "ack" (green), "lost" (red tint)
    const d = document.createElement("div");
    d.className = "pkt";
    d.title = title;
    d.textContent = text;
    d.style.position = "absolute";
    d.style.left = pos.x + "px";
    d.style.top  = pos.y + "px";
    d.style.width = "26px";
    d.style.height = "26px";
    d.style.borderRadius = "50%";
    d.style.display = "grid";
    d.style.placeItems = "center";
    d.style.color = "#fff";
    d.style.fontSize = "11px";
    d.style.userSelect = "none";
    d.style.opacity = "0";

    if(type === "frame"){ d.style.background = "#2a6bff"; d.style.boxShadow = "0 2px 10px rgba(42,107,255,.25)"; }
    else if(type === "ack"){ d.style.background = "#1faa8a"; d.style.boxShadow = "0 2px 10px rgba(31,170,138,.25)"; }
    else if(type === "lost"){ d.style.background = "#ff6b6b"; d.style.boxShadow = "0 2px 10px rgba(255,107,107,.25)"; }

    channelStage.appendChild(d);
    return d;
  }

  // ===== GBN state =====
  let N, timeout, lossProb, ackLossProb;
  let base, nextSeq, seqLimit;
  let running=false;
  let timer=null;
  let stepMode=false;

  const record = new Map(); // seq -> {sentCount, delivered, acked}
  const stats = { totalFrames:0, totalTrans:0, totalAcks:0, framesLost:0, acksLost:0, framesDelayed:0, framesDelivered:0 };
  const diagram = { frames:[], acks:[] };

  // ===== Geometry =====
  function endpoints(seq){
    const cont = liveSvg.getBoundingClientRect();
    const width = cont.width || 800;
    const leftX = 22, rightX = Math.max(140, width - 22 - 96);
    const baseY = 90 + (seq % 6) * 58;

    if (simModeEl.value === "vertical") {
      return { frameStart:{x:leftX, y:baseY}, frameEnd:{x:rightX, y:baseY},
               ackStart:{x:rightX, y:baseY-14}, ackEnd:{x:leftX, y:baseY-14} };
    }
    // textbook slight diagonal
    return { frameStart:{x:leftX, y:baseY}, frameEnd:{x:rightX, y:baseY+16},
             ackStart:{x:rightX, y:baseY},  ackEnd:{x:leftX, y:baseY-2} };
  }

  // ===== probabilities =====
  function shouldLoseFrame(seq){
    const m = lossModeEl.value;
    if(m==="none") return false;
    if(m==="random") return Math.random() < lossProb;
    if(m==="specific") return parseNums(specificFramesEl.value).includes(seq);
    if(m==="everyk"){ const k=parseInt(everyKEl.value,10)||1; return ((seq+1)%k)===0; }
    return false;
  }
  function shouldDelayFrame(seq){
    const m = frameDelayModeEl.value;
    if(m==="none") return false;
    if(m==="specific") return parseNums(frameDelaySpecEl.value).includes(seq);
    if(m==="everyk"){ const k=parseInt(frameDelaySpecEl.value,10)||1; return ((seq+1)%k)===0; }
    return false;
  }

  // ===== timings (normal vs step) =====
  const NORMAL = { DOWN:2000, PROC:600, ACK:2000 };
  const STEP   = { DOWN:1600, PROC:400, ACK:1600 }; // ≈4s per cycle
  function T() { return stepMode ? STEP : NORMAL; }

  // ===== timer helpers =====
  function startTimer(){ clearTimer(); timer = setTimeout(onTimeout, timeout); }
  function clearTimer(){ if(timer){ clearTimeout(timer); timer=null; } }

  // ===== init =====
  function init(){
    N = clamp(parseInt(winSizeEl.value,10)||4, 1, 32);
    timeout = clamp(parseInt(timeoutEl.value,10)||6000, 2000, 60000);
    lossProb = (parseInt(lossPercentEl.value,10)||0)/100;
    ackLossProb = (parseInt(ackLossPercentEl.value,10)||0)/100;

    base = 0; nextSeq = 0;
    seqLimit = clamp(parseInt(numFramesEl.value,10)||12, 1, 300);
    running = false; stepMode = false; PAUSED = false; clearTimer();
    record.clear();

    Object.assign(stats, { totalFrames:seqLimit, totalTrans:0,totalAcks:0,framesLost:0,acksLost:0,framesDelayed:0,framesDelivered:0 });
    diagram.frames = []; diagram.acks = [];

    senderWindow.innerHTML = ""; senderQueue.innerHTML = ""; recvArea.innerHTML = "";
    liveSvg.innerHTML = ""; events.innerHTML = ""; statsWrap.classList.add("hidden"); diagramHost.innerHTML="";

    for(let i=0;i<N;i++){
      const d=document.createElement("div");
      d.textContent=(i<seqLimit)?`#${i}`:"-";
      d.style.cssText="background:rgba(0,0,0,.04);border:1px solid rgba(0,0,0,.12);padding:6px 8px;border-radius:10px;margin-bottom:6px";
      senderWindow.appendChild(d);
    }
    applyStrictVisibility();
    updateDiagramLabel();
    log("Ready — true Go-Back-N. Pick your options and Start.");
  }

  // ===== GBN core =====
  async function onTimeout(){
    if(!running) return;
    if(base < nextSeq){
      log(`Timeout at base ${base} — retransmit ${base}..${Math.min(nextSeq-1,seqLimit-1)} (GBN).`);
      for(let s=base; s<nextSeq; s++) await retransmitFrame(s);
      startTimer();
    }
  }

  function refreshWindow(){
    const slots=[...senderWindow.children];
    for(let i=0;i<slots.length;i++){
      const seq = base + i; const el=slots[i];
      el.textContent = seq<seqLimit?`#${seq}`:"-";
      const inflight = seq>=base && seq<nextSeq && seq<seqLimit;
      el.style.outline = inflight ? "2px solid rgba(42,107,255,.40)" : "none";
    }
  }

  async function pumpWindow(){
    while(running && nextSeq < base + N && nextSeq < seqLimit){
      await sendFrame(nextSeq);
      nextSeq++; refreshWindow();
      if(base === nextSeq-1) startTimer();
      if(stepMode) break; // in normal start, we fill; in step we send only target seq
    }
  }

  async function sendFrame(seq){
    const rec = record.get(seq) || { sentCount:0, delivered:false, acked:false }; rec.sentCount++; record.set(seq,rec);
    stats.totalTrans++;

    const badge=document.createElement("div");
    badge.textContent=`F${seq}`;
    badge.style.cssText="display:inline-block;padding:4px 8px;background:#e8f0ff;border:1px solid #c7d6ff;border-radius:999px;margin:0 6px 6px 0;color:#0b1e2b";
    senderQueue.appendChild(badge);

    const geom = endpoints(seq);
    const delayed = shouldDelayFrame(seq);
    const extra = delayed ? Math.max(0, parseInt(frameDelayMsEl.value,10)||0) : 0;
    if(delayed) stats.framesDelayed++;

    const lose = shouldLoseFrame(seq);
    await animateLinePausable(geom.frameStart.x, geom.frameStart.y, geom.frameEnd.x, geom.frameEnd.y,
                              lose ? "#ff6b6b" : "#2a6bff", lose, T().DOWN + extra);

    const pkt = bubble(`F${seq}`, `Frame ${seq}`, geom.frameStart, lose ? "lost" : "frame");
    await animateBubbleMove(pkt, geom.frameStart, geom.frameEnd, T().DOWN + extra);

    if(lose){
      pkt.style.opacity=".55";
      log(`Frame ${seq} lost in channel.`);
      stats.framesLost++; diagram.frames.push({seq, delivered:false});
      await sleep(250); pkt.remove(); return;
    }

    pkt.remove(); diagram.frames.push({seq, delivered:true}); rec.delivered = true;
    await sleep(T().PROC);
    await receiverHandle(seq, geom); // ACK after arrival only
  }

  async function retransmitFrame(seq){
    if(!running) return;
    const rec = record.get(seq) || { sentCount:0, delivered:false, acked:false }; rec.sentCount++; record.set(seq,rec);
    stats.totalTrans++;

    const geom = endpoints(seq);
    const lose = shouldLoseFrame(seq);

    await animateLinePausable(geom.frameStart.x, geom.frameStart.y, geom.frameEnd.x, geom.frameEnd.y,
                              lose ? "#ff6b6b" : "#2a6bff", lose, T().DOWN);

    const pkt = bubble(`F${seq}`, `Frame ${seq} (RTX)`, geom.frameStart, lose ? "lost" : "frame");
    await animateBubbleMove(pkt, geom.frameStart, geom.frameEnd, T().DOWN);

    if(lose){
      pkt.style.opacity=".55";
      log(`(RTX) Frame ${seq} lost again.`);
      stats.framesLost++; diagram.frames.push({seq, delivered:false});
      await sleep(200); pkt.remove(); return;
    }

    pkt.remove(); diagram.frames.push({seq, delivered:true});
    await sleep(T().PROC);
    await receiverHandle(seq, geom);
  }

  async function receiverHandle(seq, geom){
    const expected = recvArea.childElementCount;
    let ackNum;
    if(seq === expected){
      const ok=document.createElement("div");
      ok.textContent=`#${seq}`;
      ok.style.cssText="background:rgba(0,0,0,.04);border:1px solid rgba(0,0,0,.12);padding:6px 8px;border-radius:10px;margin-bottom:6px;outline:2px solid rgba(31,170,138,.35)";
      recvArea.appendChild(ok);
      stats.framesDelivered++; ackNum = seq;
      log(`Receiver accepted ${seq} → ACK ${ackNum}`);
    } else {
      ackNum = expected - 1;
      log(`Receiver discarded ${seq} (expected ${expected}) → ACK ${ackNum}`);
    }

    stats.totalAcks++;
    const ackLose = Math.random() < ackLossProb;

    await animateLinePausable(geom.ackStart.x, geom.ackStart.y, geom.ackEnd.x, geom.ackEnd.y,
                              "#1faa8a", ackLose, T().ACK + (parseInt(ackDelayMsEl.value,10)||0));

    const ackPkt = bubble(`A${ackNum}`, `ACK ${ackNum}`, geom.ackStart, ackLose ? "lost" : "ack");
    await animateBubbleMove(ackPkt, geom.ackStart, geom.ackEnd, T().ACK + (parseInt(ackDelayMsEl.value,10)||0));

    if(ackLose){
      ackPkt.style.opacity=".55";
      log(`ACK ${ackNum} lost — sender will timeout.`);
      stats.acksLost++; diagram.acks.push({seq:ackNum, delivered:false});
      await sleep(200); ackPkt.remove(); return;
    }

    ackPkt.remove(); diagram.acks.push({seq:ackNum, delivered:true});
    onAck(ackNum);
  }

  function onAck(ackNum){
    if(ackNum >= base){
      base = ackNum + 1;
      refreshWindow();
      if(base === nextSeq) clearTimer(); else startTimer();

      // pump more in normal mode
      if(!stepMode) pumpWindow();

      if(base >= seqLimit) finish();
    }
  }

  // ===== Summary diagram render =====
  function finish(){
    running=false; clearTimer(); log("Simulation complete — composing summary…");
    const delivered = stats.framesDelivered;
    const trans = Math.max(1, stats.totalTrans);
    const eff = (delivered/trans)*100;
    const loss = (stats.framesLost/trans)*100;

    setTxt("#stat_totalFrames", stats.totalFrames);
    setTxt("#stat_totalTrans", stats.totalTrans);
    setTxt("#stat_delivered", delivered);
    setTxt("#stat_totalAcks", stats.totalAcks);
    setTxt("#stat_framesLost", stats.framesLost);
    setTxt("#stat_acksLost", stats.acksLost);
    setTxt("#stat_efficiency", eff.toFixed(2)+"%");
    setTxt("#stat_lossPercent", loss.toFixed(2)+"%");
    $("#eff_fill").style.width = `${Math.max(0,Math.min(100,eff))}%`;

    diagramHost.innerHTML = "";
    const mode = diagramTypeEl.value;
    const lbl = {vertical:"Vertical two-columns", textbook:"Textbook diagonals", animated:"Animated replay"}[mode] || "Vertical two-columns";
    diagramModeLabel.textContent = lbl;
    renderDiagram(diagramHost, diagram, stats.totalFrames, mode);
    statsWrap.classList.remove("hidden");
  }

  function renderDiagram(host, diag, rows, mode){
    if(mode==="vertical" || mode==="animated") return renderVertical(host, diag, rows, mode==="animated");
    return renderTextbook(host, diag, rows, mode==="animated");
  }

  // Simple SVG helpers
  const ns = n=>document.createElementNS("http://www.w3.org/2000/svg", n);
  function svgEl(w,h){ const s=ns("svg"); s.setAttribute("viewBox",`0 0 ${w} ${h}`); s.setAttribute("width","100%"); s.setAttribute("height",h); return s; }
  function vline(x,y1,y2,c){ const l=line(x,y1,x,y2,c,2); l.setAttribute("opacity",".6"); return l; }
  function hline(x1,y1,x2,y2,c,d){ const l=line(x1,y1,x2,y2,c,3); l.setAttribute("opacity",".95"); if(d) l.setAttribute("stroke-dasharray","10 7"); return l; }
  function seg(x1,y1,x2,y2,c,d){ const l=line(x1,y1,x2,y2,c,3); if(d) l.setAttribute("stroke-dasharray","10 7"); return l; }
  function nodeCircle(x,y,t){ const g=ns("g"); const c=ns("circle"); c.setAttribute("cx",x); c.setAttribute("cy",y); c.setAttribute("r",6); c.setAttribute("fill","rgba(0,0,0,0)"); c.setAttribute("stroke","rgba(0,0,0,.35)"); const tx=txt(x-26,y-10,"#0b1e2b",12,t); g.appendChild(c); g.appendChild(tx); return g; }
  function nodeRect(x,y,t){ const g=ns("g"); const r=ns("rect"); r.setAttribute("x",x-20); r.setAttribute("y",y-12); r.setAttribute("width",40); r.setAttribute("height",24); r.setAttribute("rx",6); r.setAttribute("fill","rgba(0,0,0,.05)"); r.setAttribute("stroke","rgba(0,0,0,.2)"); const tx=txt(x-15,y+4,"#0b1e2b",12,t); g.appendChild(r); g.appendChild(tx); return g; }
  function label(x,y,txtc){ return txt(x,y,"#0b1e2b",14,txtc,true); }
  function txt(x,y,fill,size,txtc,bold){ const t=ns("text"); t.setAttribute("x",x); t.setAttribute("y",y); t.setAttribute("fill",fill); t.setAttribute("font-size",size); if(bold) t.setAttribute("font-weight","700"); t.textContent=txtc; return t; }
  function line(x1,y1,x2,y2,c,w){ const l=ns("line"); l.setAttribute("x1",x1); l.setAttribute("y1",y1); l.setAttribute("x2",x2); l.setAttribute("y2",y2); l.setAttribute("stroke",c); l.setAttribute("stroke-width",w); return l; }
  function dash(l,i){ const len=Math.hypot(l.x2.baseVal.value-l.x1.baseVal.value,l.y2.baseVal.value-l.y1.baseVal.value); l.setAttribute("stroke-dasharray",`${len}`); l.setAttribute("stroke-dashoffset",`${len}`); l.style.animation=`drawline .9s ${i*0.12}s ease forwards`; l.parentNode.appendChild(styleOnce()); }
  function styleOnce(){ const st=ns("style"); st.textContent=`@keyframes drawline{to{stroke-dashoffset:0}}`; return st; }

  function renderVertical(host, diag, rows, animated){
    const w = host.clientWidth || 900, gap = 60, h = Math.max(240, rows*gap+60);
    const pad = 110, L=pad, R=w-pad, svg=svgEl(w,h);
    svg.appendChild(vline(L,30,h-30,"#0b1e2b"));
    svg.appendChild(vline(R,30,h-30,"#0b1e2b"));
    svg.appendChild(label(L-25,20,"Sender"));
    svg.appendChild(label(R-35,20,"Receiver"));
    for(let i=0;i<rows;i++){ const y=40+i*gap; svg.appendChild(nodeCircle(L,y,`#${i}`)); svg.appendChild(nodeCircle(R,y,`#${i}`)); }
    let idx=0;
    diag.frames.forEach(f=>{ const y=40+f.seq*gap; const ln=hline(L,y,R,y,f.delivered?"#2a6bff":"#ff6b6b",f.delivered?0:1); if(animated) dash(ln,idx++); svg.appendChild(ln); });
    diag.acks.forEach(a=>{ const y=40+Math.max(0,a.seq)*gap-12; const ln=hline(R,y,L,y,"#1faa8a",a.delivered?0:1); if(animated) dash(ln,idx++); svg.appendChild(ln); });
    host.appendChild(svg);
  }

  function renderTextbook(host, diag, rows, animated){
    const w = host.clientWidth || 900, gap = 60, h = Math.max(240, rows*gap+60);
    const pad = 90, L=pad, R=w-pad, svg=svgEl(w,h);
    svg.appendChild(label(L-25,20,"Sender"));
    svg.appendChild(label(R-35,20,"Receiver"));
    for(let i=0;i<rows;i++){ const y=40+i*gap; svg.appendChild(nodeRect(L,y,`#${i}`)); svg.appendChild(nodeRect(R,y,`#${i}`)); }
    let idx=0;
    diag.frames.forEach(f=>{ const y=40+f.seq*gap; const ln=seg(L,y,R,y+16,f.delivered?"#2a6bff":"#ff6b6b",f.delivered?0:1); if(animated) dash(ln,idx++); svg.appendChild(ln); });
    diag.acks.forEach(a=>{ const y=40+Math.max(0,a.seq)*gap-12; const ln=seg(R,y+16,L,y,"#1faa8a",a.delivered?0:1); if(animated) dash(ln,idx++); svg.appendChild(ln); });
    host.appendChild(svg);
  }

  // ===== Controls =====
  startBtn.addEventListener("click", async ()=>{
    if(!running){ running=true; stepMode=false; log(`Started — mode: ${simModeEl.value}`); await pumpWindow(); }
    // if paused, resume
    if(PAUSED) resumeAll();
  });

  pauseBtn.addEventListener("click", ()=>{ if(!PAUSED) pauseAll(); });

  stepBtn.addEventListener("click", async ()=>{
    if(running && !PAUSED) return; // avoid stepping mid-run
    running = true; stepMode = true;
    // Unpause if paused, but don't start window pump beyond one frame
    if(PAUSED) resumeAll();
    // In step mode: run exactly one target seq (with retransmissions until acked)
    const startSeq = nextSeq;
    if(startSeq >= seqLimit){ log("Step: all frames completed."); running=false; return; }
    // send first attempt
    if(startSeq < base + N) {
      await sendFrame(startSeq); nextSeq++; refreshWindow();
      if(base === nextSeq-1) startTimer();
    }
    // wait until this specific frame gets cumulatively acked
    while(base <= startSeq){
      await sleep(80);
      if(!running) break;
    }
    running = false; // stop after this frame's cycle completes
  });

  resetBtn.addEventListener("click", ()=>{ init(); log("Reset."); });

  // ===== Boot =====
  init();
})();
