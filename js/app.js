// Go-Back-N ARQ — Teaching Simulator (clean build)
// Author: Sunesh & Aravind (guided by Dr. Swaminathan Annadurai)

(function(){
  // ========= Shorthands =========
  const $ = sel => document.querySelector(sel);

  // -------- Grab controls ----------
  const numFramesEl = $("#numFrames");
  const winSizeEl = $("#winSize");
  const timeoutEl = $("#timeout");
  const lossPercentEl = $("#lossPercent");
  const lossPercentVal = $("#lossPercentVal");
  const lossModeEl = $("#lossMode");
  const wrapSpecific = $("#wrapSpecific");
  const specificFramesEl = $("#specificFrames");
  const wrapEveryK = $("#wrapEveryK");
  const everyKEl = $("#everyK");

  const frameDelayModeEl = $("#frameDelayMode");
  const wrapDelaySpec = $("#wrapDelaySpec");
  const wrapDelayMs = $("#wrapDelayMs");
  const frameDelaySpecEl = $("#frameDelaySpec");
  const frameDelayMsEl = $("#frameDelayMs");

  const ackLossPercentEl = $("#ackLossPercent");
  const ackLossVal = $("#ackLossVal");
  const ackLossModeEl = $("#ackLossMode");
  const wrapAckSpec = $("#wrapAckSpec");
  const ackSpecificEl = $("#ackSpecific");
  const wrapAckK = $("#wrapAckK");
  const ackEveryKEl = $("#ackEveryK");

  const ackDelayMsEl = $("#ackDelayMs");
  const simModeEl = $("#simMode");
  const diagramTypeEl = $("#diagramType");
  const diagramModeLabel = $("#diagramModeLabel");

  const startBtn = $("#startBtn"),
        stepBtn=$("#stepBtn"), resetBtn=$("#resetBtn");

  const senderWindow = $("#senderWindow");
  const senderQueue = $("#senderQueue");
  const recvArea = $("#recvArea");
  const liveSvg = $("#liveSvg");
  const channelStage = $("#channelStage");
  const events = $("#events");
  const statsWrap = $("#statsWrap");
  const diagramHost = $("#diagramHost");

  // Modals
  const btnLearn = $("#btnLearn"), btnDev=$("#btnDev"), btnHelp=$("#btnHelp");
  const btnDownload = $("#btnDownload");
  const modalLearn = $("#modalLearn"), modalDev=$("#modalDev"), modalHelp=$("#modalHelp");
  const closeBtns = document.querySelectorAll("[data-close]");

  // ========= Small helpers =========
  const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
  const parseNums = t => !t?[]:t.split(",").map(s=>parseInt(s.trim(),10)).filter(n=>!isNaN(n));
  const sleep = ms => new Promise(r=>setTimeout(r,ms));
  const setTxt = (sel, txt) => { const n=document.querySelector(sel); if(n) n.textContent=txt; };
  const log = m => {
    const row = document.createElement("div");
    row.textContent = `• ${m}`;
    events.appendChild(row);
    events.scrollTop = events.scrollHeight;
  };

  // ========= Live state =========
  let N, timeout, lossProb, ackLossProb;
  let base, nextSeq, seqLimit;
  let running=false, paused=false, timer=null;
  let startTime=0, endTime=0;

  const FRAME_SPEED_MS = 2000;  // ~1 frame per second travel
  const ACK_SPEED_MS = 900;
  const PROC_MS = 600;

  const record = new Map(); // seq -> { sentCount, delivered, acked }

  const stats = {
    totalFrames: 0, totalTrans: 0, totalAcks: 0,
    framesLost: 0, acksLost: 0, framesDelayed: 0,
    framesDelivered: 0
  };
  const diagram = { frames: [], acks: [] };

  // ========= UI visibility logic =========
  function refreshOptionVisibility(){
    // frame loss inputs
    wrapSpecific.classList.toggle("hidden", lossModeEl.value!=="specific");
    wrapEveryK.classList.toggle("hidden",   lossModeEl.value!=="everyk");

    // frame delay inputs
    const delayOn = frameDelayModeEl.value !== "none";
    wrapDelaySpec.classList.toggle("hidden", !delayOn);
    wrapDelayMs.classList.toggle("hidden",   !delayOn);

    // ack loss inputs
    wrapAckSpec.classList.toggle("hidden", ackLossModeEl.value!=="specific");
    wrapAckK.classList.toggle("hidden",     ackLossModeEl.value!=="everyk");
  }
  lossPercentEl.addEventListener("input", ()=> lossPercentVal.textContent = lossPercentEl.value + "%");
  ackLossPercentEl.addEventListener("input", ()=> ackLossVal.textContent = ackLossPercentEl.value + "%");
  lossModeEl.addEventListener("change", refreshOptionVisibility);
  frameDelayModeEl.addEventListener("change", refreshOptionVisibility);
  ackLossModeEl.addEventListener("change", refreshOptionVisibility);
  diagramTypeEl.addEventListener("change", ()=>{
    const map = {vertical:"Vertical two-columns", textbook:"Textbook diagonals", animated:"Animated replay"};
    diagramModeLabel.textContent = map[diagramTypeEl.value]||"Vertical two-columns";
  });

  // ========= Geometry (diagonals show time) =========
  function endpoints(seq){
    const rect = liveSvg.getBoundingClientRect();
    const leftX = 26;
    const rightX = rect.width - 26 - 96;
    const baseY = 60 + (seq % 6) * 70;

    // shift ACK vertically by delay to reflect later-in-time arrival
    const delayOffset = Math.min((parseInt(ackDelayMsEl.value,10)||0)/10, 120);

    return {
      frameStart:{x:leftX,  y:baseY},
      frameEnd:  {x:rightX, y:baseY+22},
      ackStart:  {x:rightX, y:baseY+22+delayOffset},
      ackEnd:    {x:leftX,  y:baseY+22+delayOffset}
    };
  }

  // ========= SVG + motion =========
  function drawLine(svg, x1, y1, x2, y2, color, dashed, durMs) {
  // dedupe identical strokes to avoid stacking
  const exists = [...svg.querySelectorAll('line')].some(l =>
    l.getAttribute('x1') == x1 && l.getAttribute('y1') == y1 &&
    l.getAttribute('x2') == x2 && l.getAttribute('y2') == y2 &&
    l.getAttribute('stroke') == color
  );
  if (exists) return null;

  const ln = document.createElementNS("http://www.w3.org/2000/svg", "line");
  ln.setAttribute("x1", x1);
  ln.setAttribute("y1", y1);
  ln.setAttribute("x2", x2);
  ln.setAttribute("y2", y2);
  ln.setAttribute("stroke", color);
  ln.setAttribute("stroke-width", "3");
  svg.appendChild(ln);

  // reveal animation
  const len = Math.hypot(x2 - x1, y2 - y1);
  ln.setAttribute("stroke-dasharray", `${len} ${len}`);
  ln.setAttribute("stroke-dashoffset", `${len}`);
  ln.style.transition = `stroke-dashoffset ${durMs}ms ease`;
  requestAnimationFrame(() => ln.setAttribute("stroke-dashoffset", "0"));

  // after reveal, if dashed requested, switch to dashed pattern
  if (dashed) {
    setTimeout(() => {
      ln.style.transition = ""; // stop animating
      ln.setAttribute("stroke-dasharray", "10 7");
      ln.removeAttribute("stroke-dashoffset");
    }, durMs + 20);
  } else {
    // keep as solid
    setTimeout(() => {
      ln.style.transition = "";
      ln.removeAttribute("stroke-dasharray");
      ln.removeAttribute("stroke-dashoffset");
    }, durMs + 20);
  }
  return ln;
}

  function mkPacket(text, cls, pos){
    const p=document.createElement("div");
    p.className=`packet ${cls||""}`.trim();
    p.textContent=text;
    p.style.left=pos.x+"px"; p.style.top=pos.y+"px"; p.style.opacity="0";
    channelStage.appendChild(p); 
    return p;
  }

  function animateMove(elm, a, b, ms){
    elm.style.opacity="1";
    return new Promise(res=>{
      const t0=performance.now();
      (function step(t){
        const k=Math.min(1,(t-t0)/ms);
        const e = k<0.5 ? 2*k*k : -1+(4-2*k)*k; // easeInOut-ish
        elm.style.left = (a.x+(b.x-a.x)*e)+"px";
        elm.style.top  = (a.y+(b.y-a.y)*e)+"px";
        if(k<1) requestAnimationFrame(step); else res();
      })(t0);
    });
  }

  // ========= Loss & delay predicates =========
  function frameLost(seq){
    const m = lossModeEl.value;
    if(m==="none") return false;
    if(m==="random") return Math.random() < lossProb;
    if(m==="specific") return parseNums(specificFramesEl.value).includes(seq);
    if(m==="everyk"){ const k=parseInt(everyKEl.value,10)||1; return ((seq+1)%k)===0; }
    return false;
  }
  function frameDelayed(seq){
    const m = frameDelayModeEl.value;
    if(m==="none") return false;
    if(m==="specific") return parseNums(frameDelaySpecEl.value).includes(seq);
    if(m==="everyk"){ const k=parseInt(frameDelaySpecEl.value,10)||1; return ((seq+1)%k)===0; }
    return false;
  }
  function ackLost(ackNum){
    const m = ackLossModeEl.value;
    if(m==="none") return false;
    if(m==="random") return Math.random() < ackLossProb;
    if(m==="specific") return parseNums(ackSpecificEl.value).includes(ackNum);
    if(m==="everyk"){ const k=parseInt(ackEveryKEl.value,10)||1; return ((ackNum+1)%k)===0; }
    return false;
  }

  // ========= Timer helpers =========
  function startTimer(){ clearTimer(); timer=setTimeout(onTimeout, timeout); }
  function clearTimer(){ if(timer){ clearTimeout(timer); timer=null; } }

  // ========= Init =========
  function init(){
    N = clamp(parseInt(winSizeEl.value,10)||4, 1, 32);
    timeout = clamp(parseInt(timeoutEl.value,10)||6000, 2000, 60000);
    lossProb = (parseInt(lossPercentEl.value,10)||0)/100;
    ackLossProb = (parseInt(ackLossPercentEl.value,10)||0)/100;

    base=0; nextSeq=0;
    seqLimit = clamp(parseInt(numFramesEl.value,10)||10, 1, 300);
    running=false; paused=false; clearTimer();
    startTime=0; endTime=0;

    record.clear();
    Object.assign(stats, {
      totalFrames: seqLimit, totalTrans:0, totalAcks:0,
      framesLost:0, acksLost:0, framesDelayed:0, framesDelivered:0
    });
    diagram.frames=[]; diagram.acks=[];

    senderWindow.innerHTML=""; senderQueue.innerHTML=""; recvArea.innerHTML="";
    liveSvg.innerHTML=""; channelStage.innerHTML=""; events.innerHTML="";
    statsWrap.classList.add("hidden"); diagramHost.innerHTML="";

    // sender sliding window slots
    for(let i=0;i<N;i++){
      const d=document.createElement("div");
      d.className="frame"; d.textContent=(i<seqLimit)?`#${i}`:"-";
      senderWindow.appendChild(d);
    }
    refreshOptionVisibility();
    log("Ready — pick your options and press Start.");
  }

  // ========= Timeout: retransmit from base =========
async function onTimeout(){
  if(!running) return;
  clearTimer();
  if(base < nextSeq){
    const start = base, end = nextSeq; // snapshot window
    log(`Timeout at base=${start}. Retransmit ${start}..${Math.min(end-1, seqLimit-1)} (GBN).`);
    for(let s = start; s < end; s++){
      if (s < base) continue; // skip frames already cumulatively ACKed
      await retransmitFrame(s);
    }
    startTimer();
  }
  if(base >= seqLimit) finish();
}


  function refreshWindow(){
    const slots=[...senderWindow.children];
    for(let i=0;i<slots.length;i++){
      const seq = base + i; const el=slots[i];
      el.textContent = seq<seqLimit?`#${seq}`:"-";
      const inflight = seq>=base && seq<nextSeq && seq<seqLimit;
      el.classList.toggle("active", inflight);
    }
  }

  async function pumpWindow(){
    while(running && !paused && nextSeq < base + N && nextSeq < seqLimit){
      await sendFrame(nextSeq);
      nextSeq++; refreshWindow();
      if(base === nextSeq-1) startTimer();
    }
    if(nextSeq >= base + N) log(`Window full (base=${base}, next=${nextSeq}). Waiting…`);
  }

  // ========= SEND / RTX / ACK =========
  async function sendFrame(seq){
    const rec = record.get(seq) || { sentCount:0, delivered:false, acked:false };
    rec.sentCount++; record.set(seq,rec);
    stats.totalTrans++;

    if(!startTime) startTime = performance.now();

    // badge in queue
    const badge=document.createElement("div"); badge.textContent=`F${seq}`; badge.className="packet";
    badge.style.position="static"; badge.style.opacity="1";
    senderQueue.appendChild(badge);

    const geom = endpoints(seq);
    const delayed = frameDelayed(seq);
    const extra = delayed ? Math.max(0, parseInt(frameDelayMsEl.value,10)||0) : 0;
    if(delayed) stats.framesDelayed++;

    const lose = frameLost(seq);
    drawLine(liveSvg, geom.frameStart.x, geom.frameStart.y, geom.frameEnd.x, geom.frameEnd.y,
             lose ? "#ff6b6b" : "#00a3ad", lose, FRAME_SPEED_MS + extra);

    const pkt = mkPacket(`F${seq}`,"", geom.frameStart);
    if(delayed) pkt.style.filter="drop-shadow(0 0 8px #ffd166)";
    await animateMove(pkt, geom.frameStart, geom.frameEnd, FRAME_SPEED_MS + extra);

    if(lose){
      pkt.classList.add("lost");
      log(`Frame ${seq} lost in channel.`);
      stats.framesLost++;
      if (!diagram.frames.some(f=>f.seq===seq)) diagram.frames.push({seq, delivered:false});
      await sleep(280); pkt.remove(); return;
    }

    pkt.remove();
    if (!diagram.frames.some(f=>f.seq===seq)) diagram.frames.push({seq, delivered:true});
    rec.delivered = true;
    await sleep(PROC_MS);
    await receiverHandle(seq, geom); // ACK strictly after arrival
  }

  async function retransmitFrame(seq){
    if(!running || seq < base) return; // skip if already ACKed
    const rec = record.get(seq) || { sentCount:0, delivered:false, acked:false };
    rec.sentCount++; record.set(seq,rec);
    stats.totalTrans++;

    const geom = endpoints(seq);
    const lose = frameLost(seq);
    drawLine(liveSvg, geom.frameStart.x, geom.frameStart.y, geom.frameEnd.x, geom.frameEnd.y,
             lose ? "#ff6b6b" : "#00a3ad", true, FRAME_SPEED_MS);

    const pkt = mkPacket(`F${seq} (RTX)`,"", geom.frameStart);
    await animateMove(pkt, geom.frameStart, geom.frameEnd, FRAME_SPEED_MS);

    if(lose){
      pkt.classList.add("lost");
      log(`(RTX) Frame ${seq} lost again.`);
      stats.framesLost++;
      await sleep(250); pkt.remove(); return;
    }
    pkt.remove();
    await sleep(PROC_MS);
    await receiverHandle(seq, geom);
  }

  async function receiverHandle(seq, geom){
    const expected = recvArea.childElementCount; // next in-order seq expected
    let ackNum;
    if(seq === expected){
      const ok=document.createElement("div");
      ok.className="frame"; ok.textContent=`#${seq}`;
      ok.style.outline="2px solid rgba(42,107,255,.35)";
      recvArea.appendChild(ok);
      stats.framesDelivered++; ackNum = seq;
      log(`Receiver accepted ${seq} ⇒ ACK ${ackNum}`);
    } else {
      ackNum = Math.max(0, expected - 1);
      log(`Receiver discarded ${seq} (expected ${expected}) ⇒ ACK ${ackNum}`);
    }

    // ACK only after arrival:
    stats.totalAcks++;
    const ackDur = ACK_SPEED_MS + (parseInt(ackDelayMsEl.value,10)||0);
    const loseAck = ackLost(ackNum);

    drawLine(liveSvg, geom.ackStart.x, geom.ackStart.y, geom.ackEnd.x, geom.ackEnd.y,
             "#2a6bff", loseAck, ackDur);
    const ackPkt = mkPacket(`ACK${ackNum}`,"ack", geom.ackStart);
    await animateMove(ackPkt, geom.ackStart, geom.ackEnd, ackDur);

    if(loseAck){
      ackPkt.classList.add("lost");
      log(`ACK ${ackNum} lost — sender will wait for timeout.`);
      stats.acksLost++;
      diagram.acks.push({seq:ackNum, delivered:false});
      await sleep(250); ackPkt.remove(); return;
    }

    ackPkt.remove(); diagram.acks.push({seq:ackNum, delivered:true});
    onAck(ackNum);
  }

  function onAck(ackNum){
    log(`Sender received cumulative ACK ${ackNum}.`);
    if(ackNum >= base && ackNum < nextSeq){
      base = ackNum + 1;
      refreshWindow();
      if(base === nextSeq) clearTimer(); else startTimer();
      pumpWindow();
      if(base >= seqLimit) finish();
    }
  }

  // ========= Finish & summary =========
  function finish(){
    running=false; clearTimer();
    endTime = performance.now();
    log("Simulation complete.");

    const delivered = stats.framesDelivered;
    const trans = Math.max(1, stats.totalTrans);
    const eff = (delivered / trans) * 100;
    const secs = Math.max(0.001, (endTime - (startTime||endTime))/1000);
    const fps = (delivered / secs).toFixed(2);

    setTxt("#stat_totalFrames", stats.totalFrames);
    setTxt("#stat_totalTrans", stats.totalTrans);
    setTxt("#stat_delivered", delivered);
    setTxt("#stat_totalAcks", stats.totalAcks);
    setTxt("#stat_framesLost", stats.framesLost);
    setTxt("#stat_acksLost", stats.acksLost);
    setTxt("#stat_framesDelayed", stats.framesDelayed);
    setTxt("#stat_efficiency", eff.toFixed(2) + "%");
    setTxt("#stat_fps", fps);

    diagramHost.innerHTML="";
    const mode = diagramTypeEl.value;
    const lbl = {vertical:"Vertical two-columns", textbook:"Textbook diagonals", animated:"Animated replay"}[mode]||"Vertical two-columns";
    diagramModeLabel.textContent = lbl;
    renderDiagram(diagramHost, diagram, stats.totalFrames, mode);
    statsWrap.classList.remove("hidden");
  }

  // ========= Basic diagram renderers =========
  const NS = n=>document.createElementNS("http://www.w3.org/2000/svg", n);
  const Ssvg = (w,h)=>{ const s=NS("svg"); s.setAttribute("viewBox",`0 0 ${w} ${h}`); s.setAttribute("width","100%"); s.setAttribute("height",h); return s; };
  const line = (x1,y1,x2,y2,c,w)=>{ const l=NS("line"); l.setAttribute("x1",x1);l.setAttribute("y1",y1);l.setAttribute("x2",x2);l.setAttribute("y2",y2);l.setAttribute("stroke",c);l.setAttribute("stroke-width",w);return l; };
  const text = (x,y,t)=>{ const a=NS("text"); a.setAttribute("x",x); a.setAttribute("y",y); a.setAttribute("fill","#dff6ff"); a.setAttribute("font-size","12"); a.textContent=t; return a; };

  function renderVertical(host, diag, rows){
    const w = host.clientWidth || 900, gap=60, h=Math.max(240, rows*gap+60);
    const pad=110, L=pad, R=w-pad, svg=Ssvg(w,h);

    svg.appendChild(line(L,30,L,h-30,"#77dfee",2));
    svg.appendChild(line(R,30,R,h-30,"#77dfee",2));
    svg.appendChild(text(L-24,20,"Sender"));
    svg.appendChild(text(R-30,20,"Receiver"));

    for(let i=0;i<rows;i++){
      const y=40+i*gap;
      svg.appendChild(text(L-38,y+4,`#${i}`));
      svg.appendChild(text(R+10,y+4,`#${i}`));
    }

    diag.frames.forEach(f=>{
      const y=40+f.seq*gap;
      svg.appendChild(line(L,y,R,y,f.delivered?"#00d6dc":"#ff6b6b",3));
    });
    diag.acks.forEach(a=>{
      const y=40+Math.max(0,a.seq)*gap-12;
      svg.appendChild(line(R,y,L,y,a.delivered?"#4faaff":"#4faaff88",3));
    });

    host.appendChild(svg);
  }

  function renderTextbook(host, diag, rows){
    const w = host.clientWidth || 900, gap=60, h=Math.max(240, rows*gap+60);
    const pad=110, L=pad, R=w-pad, svg=Ssvg(w,h);

    svg.appendChild(text(L-24,20,"Sender"));
    svg.appendChild(text(R-30,20,"Receiver"));

    diag.frames.forEach(f=>{
      const y=40+f.seq*gap;
      svg.appendChild(line(L,y,R,y+16,f.delivered?"#00d6dc":"#ff6b6b",3));
    });
    diag.acks.forEach(a=>{
      const y=40+Math.max(0,a.seq)*gap-12;
      svg.appendChild(line(R,y+16,L,y,a.delivered?"#4faaff":"#4faaff88",3));
    });

    host.appendChild(svg);
  }

  function renderDiagram(host, diag, rows, mode){
  // Ensure frames drawn first, ACKs after
  const ordered = {
    frames: diag.frames.slice(),
    acks: diag.acks.slice()
  };
  if(mode === "textbook") {
    renderTextbook(host, ordered, rows);
  } else {
    renderVertical(host, ordered, rows);
  }
}


  // ========= Controls =========
  startBtn.addEventListener("click", async ()=>{
    if(running) return;
    init();
    running=true; paused=false;
    log(`Started — mode: ${simModeEl.value}`);
    await pumpWindow();
  });
  // Step mode — manual single-frame send, no timer
stepBtn.addEventListener("click", async ()=>{
  if(running) return;
  running = true;
  paused = false;

  if(nextSeq < base + N && nextSeq < seqLimit){
    await sendFrame(nextSeq);
    nextSeq++;
    refreshWindow();
  } else {
    log("Step: window full or finished.");
  }
  running = false;
});


  resetBtn.addEventListener("click", ()=>{ init(); log("Reset."); });

  // ========= Header actions =========
  const open = m => m.classList.remove("hidden");
  const close = m => m.classList.add("hidden");
  btnLearn.addEventListener("click", ()=> open(modalLearn));
  btnDev.addEventListener("click", ()=> open(modalDev));
  btnHelp.addEventListener("click", ()=> open(modalHelp));
  closeBtns.forEach(b=> b.addEventListener("click", ()=> close($("#"+b.dataset.close))));

  // ========= Download TXT + PNG as ZIP =========
btnDownload.addEventListener("click", async () => {
  // Check if simulation started
  if (!startTime) {
    alert("Simulation hasn’t started yet. Please start and complete the process before downloading.");
    return;
  }
  // Check if simulation still running
  if (running) {
    alert("Simulation is still running. Please wait until it completes to download the report.");
    return;
  }

  // Collect input settings
  const data = {
    frames: numFramesEl.value,
    window: winSizeEl.value,
    timeout: timeoutEl.value,
    frameLoss: `${lossModeEl.value} (${lossPercentEl.value}%)`,
    frameDelay: `${frameDelayModeEl.value} (${frameDelayMsEl.value} ms)`,
    ackLoss: `${ackLossModeEl.value} (${ackLossPercentEl.value}%)`,
    ackDelay: `${ackDelayMsEl.value} ms`,
  };

  // Text summary
  const summary = `
GO-BACK-N ARQ SIMULATION REPORT
-----------------------------------
Developed by: Sunesh Krishnan N & Aravind G
Guided by: Dr. Swaminathan Annadurai

INPUT PARAMETERS:
-----------------
• Number of frames       : ${data.frames}
• Window size (N)        : ${data.window}
• Timeout (ms)           : ${data.timeout}
• Frame Loss Mode        : ${data.frameLoss}
• Frame Delay Mode       : ${data.frameDelay}
• ACK Loss Mode          : ${data.ackLoss}
• ACK Delay              : ${data.ackDelay}

RESULTS:
---------
• Total Frames           : ${stats.totalFrames}
• Total Transmissions    : ${stats.totalTrans}
• Frames Delivered       : ${stats.framesDelivered}
• Frames Lost            : ${stats.framesLost}
• Frames Delayed         : ${stats.framesDelayed}
• ACKs Sent              : ${stats.totalAcks}
• ACKs Lost              : ${stats.acksLost}
• Efficiency             : ${document.querySelector("#stat_efficiency").textContent}
• Frames per Second      : ${document.querySelector("#stat_fps").textContent}

EVENT LOG:
-----------
${[...document.querySelectorAll("#events div")]
  .map(d => d.textContent)
  .join("\n")}

-----------------------------------
`;

  // Convert diagram SVG → PNG
  const svgEl = diagramHost.querySelector("svg");
  if (!svgEl) {
    alert("No summary diagram found. Please complete a simulation first.");
    return;
  }
  const svgData = new XMLSerializer().serializeToString(svgEl);
  const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.src = svgUrl;

  img.onload = async () => {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);

    canvas.toBlob(async (pngBlob) => {
      const zip = new JSZip();
      zip.file("GBN_Simulation_Report.txt", summary);
      zip.file("GBN_Summary_Diagram.png", pngBlob);

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "GBN_Simulation_Report.zip");
      URL.revokeObjectURL(svgUrl);
    }, "image/png");
  };
});

  // ========= Boot =========
  init();
})();
