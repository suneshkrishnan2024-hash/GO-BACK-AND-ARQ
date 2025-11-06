// js/app.js — Go-Back-N ARQ Visual Simulator (Sunesh Ultimate Edition)
// Created by Sunesh Krishnan N & Aravind G | Guided by Dr. Swaminathan Annadurai

(function() {
  const $ = s => document.querySelector(s);
  let root = $("#app");
  if (!root) { root = document.createElement("div"); root.id = "app"; document.body.appendChild(root); }

  // --- UI scaffold ---
  root.innerHTML = `
  <header style="background:rgba(255,255,255,.8);padding:16px;border-radius:16px;margin:12px auto;max-width:1100px;border:1px solid rgba(0,0,0,.1)">
    <h1 style="margin:0 0 4px;">Go-Back-N ARQ — Visual Simulator</h1>
    <p style="margin:0 0 8px;color:#314a5a">Sliding window protocol with retransmissions and ACK logic.</p>
    <div class="controls" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">
      <label>Frames <input id="numFrames" type="number" value="10" min="1" max="200"></label>
      <label>Window N <input id="winSize" type="number" value="4" min="1" max="16"></label>
      <label>Timeout (ms) <input id="timeout" type="number" value="6000"></label>
      <label>Loss % <input id="lossPercent" type="range" min="0" max="50" value="10"><span id="lossPercentVal">10%</span></label>
      <label>Frame Loss Mode
        <select id="lossMode">
          <option value="none">None</option>
          <option value="random">Random</option>
          <option value="specific">Specific</option>
          <option value="everyk">Every k-th</option>
        </select>
      </label>
      <label id="wrapSpecific" class="hidden">Specific frames <input id="specificFrames" type="text" placeholder="2,4,7"></label>
      <label id="wrapEveryK" class="hidden">Every k-th <input id="everyK" type="number" min="1" value="3"></label>
      <label>Frame Delay Mode
        <select id="frameDelayMode">
          <option value="none">None</option>
          <option value="specific">Specific</option>
          <option value="everyk">Every k-th</option>
        </select>
      </label>
      <label id="wrapDelaySpec" class="hidden">Delay frames <input id="frameDelaySpec" type="text" placeholder="3 or 5"></label>
      <label id="wrapDelayMs" class="hidden">Delay (ms) <input id="frameDelayMs" type="number" min="0" value="1000"></label>
      <label>ACK Loss % <input id="ackLossPercent" type="range" min="0" max="50" value="5"><span id="ackLossVal">5%</span></label>
      <label>ACK Delay (ms) <input id="ackDelayMs" type="number" value="800"></label>
    </div>
    <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
      <button id="startBtn">Start</button>
      <button id="pauseBtn">Pause</button>
      <button id="stepBtn">Step</button>
      <button id="resetBtn">Reset</button>
    </div>
  </header>

  <section style="background:rgba(255,255,255,.7);border:1px solid rgba(0,0,0,.1);border-radius:16px;padding:10px;margin:12px auto;max-width:1100px">
    <div id="simArea" style="position:relative;overflow-y:auto;height:750px;">
      <svg id="liveSvg" width="100%" height="750"></svg>
      <div id="channelStage" style="position:absolute;inset:0;"></div>
    </div>
  </section>

  <section style="background:rgba(255,255,255,.7);border:1px solid rgba(0,0,0,.1);border-radius:16px;padding:10px;margin:12px auto;max-width:1100px">
    <h3 style="text-align:center">Event Log</h3>
    <div id="events" style="height:160px;overflow:auto;font-family:monospace;"></div>
  </section>

  <footer>Created by Sunesh Krishnan N & Aravind G | Guided by Dr. Swaminathan Annadurai</footer>
  `;

  // --- references ---
  const numFramesEl = $("#numFrames"),
    winSizeEl = $("#winSize"),
    timeoutEl = $("#timeout"),
    lossPercentEl = $("#lossPercent"),
    lossPercentVal = $("#lossPercentVal"),
    lossModeEl = $("#lossMode"),
    wrapSpecific = $("#wrapSpecific"),
    wrapEveryK = $("#wrapEveryK"),
    specificFramesEl = $("#specificFrames"),
    everyKEl = $("#everyK"),
    frameDelayModeEl = $("#frameDelayMode"),
    wrapDelaySpec = $("#wrapDelaySpec"),
    wrapDelayMs = $("#wrapDelayMs"),
    frameDelaySpecEl = $("#frameDelaySpec"),
    frameDelayMsEl = $("#frameDelayMs"),
    ackLossPercentEl = $("#ackLossPercent"),
    ackLossVal = $("#ackLossVal"),
    ackDelayMsEl = $("#ackDelayMs"),
    startBtn = $("#startBtn"),
    pauseBtn = $("#pauseBtn"),
    stepBtn = $("#stepBtn"),
    resetBtn = $("#resetBtn"),
    liveSvg = $("#liveSvg"),
    channelStage = $("#channelStage"),
    events = $("#events"),
    simArea = $("#simArea");

  // --- utilities ---
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const parseNums = t => t.split(",").map(x => parseInt(x.trim(), 10)).filter(x => !isNaN(x));
  const log = msg => {
    const div = document.createElement("div");
    div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    events.prepend(div);
  };

  // --- visibility toggles ---
  function applyVisibility() {
    const lm = lossModeEl.value;
    wrapSpecific.classList.toggle("hidden", lm !== "specific");
    wrapEveryK.classList.toggle("hidden", lm !== "everyk");
    const dm = frameDelayModeEl.value;
    const on = dm !== "specific" && dm !== "everyk";
    wrapDelaySpec.classList.toggle("hidden", dm === "none");
    wrapDelayMs.classList.toggle("hidden", dm === "none");
  }
  lossPercentEl.oninput = () => (lossPercentVal.textContent = `${lossPercentEl.value}%`);
  ackLossPercentEl.oninput = () => (ackLossVal.textContent = `${ackLossPercentEl.value}%`);
  lossModeEl.onchange = applyVisibility;
  frameDelayModeEl.onchange = applyVisibility;

  // --- globals ---
  let running = false,
    paused = false,
    stepMode = false,
    base = 0,
    nextSeq = 0,
    N = 4,
    total = 10,
    seqLimit = 10,
    timeout = 6000,
    lossProb = 0.1,
    ackLossProb = 0.05,
    timer = null;

  let stats = { sent: 0, lost: 0, acks: 0, delivered: 0 };

  // --- animation utils ---
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function animate(el, a, b, ms) {
    const start = performance.now();
    const diffX = b.x - a.x,
      diffY = b.y - a.y;
    return new Promise(res => {
      function step(t) {
        if (paused) return requestAnimationFrame(step);
        const k = Math.min(1, (t - start) / ms);
        el.style.left = a.x + diffX * k + "px";
        el.style.top = a.y + diffY * k + "px";
        if (k >= 1) res();
        else requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  // --- core functions ---
  function init() {
    running = false;
    paused = false;
    stepMode = false;
    clearTimeout(timer);
    base = 0;
    nextSeq = 0;
    total = parseInt(numFramesEl.value);
    seqLimit = total;
    N = parseInt(winSizeEl.value);
    timeout = parseInt(timeoutEl.value);
    lossProb = parseInt(lossPercentEl.value) / 100;
    ackLossProb = parseInt(ackLossPercentEl.value) / 100;
    stats = { sent: 0, lost: 0, acks: 0, delivered: 0 };
    events.innerHTML = "";
    channelStage.innerHTML = "";
    liveSvg.innerHTML = "";
    liveSvg.setAttribute("height", "750");
    simArea.scrollTop = 0;
    log("Reset complete.");
  }

  function pauseSim() {
    if (!running) return;
    paused = !paused;
    log(paused ? "Simulation paused." : "Simulation resumed.");
  }

  function expandAreaIfNeeded(seq) {
    const newHeight = 750 + seq * 70;
    liveSvg.setAttribute("height", newHeight);
    simArea.scrollTop = newHeight;
  }

  async function sendFrame(seq) {
    expandAreaIfNeeded(seq);
    stats.sent++;
    const geom = {
      sx: 60,
      sy: 80 + seq * 70,
      rx: 850,
      ry: 80 + seq * 70,
    };

    const lose = Math.random() < lossProb;
    const bubble = document.createElement("div");
    bubble.className = "pkt";
    bubble.textContent = "F" + seq;
    bubble.style.cssText =
      "position:absolute;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;color:white;font-size:11px;left:" +
      geom.sx +
      "px;top:" +
      geom.sy +
      "px;background:" +
      (lose ? "#ff6b6b" : "#2a6bff");
    channelStage.appendChild(bubble);

    await animate(bubble, { x: geom.sx, y: geom.sy }, { x: geom.rx, y: geom.ry }, 3500);

    if (lose) {
      bubble.style.opacity = 0.5;
      log(`Frame ${seq} lost.`);
      stats.lost++;
      await sleep(300);
      bubble.remove();
      return;
    }

    bubble.remove();
    await sleep(800);
    await ackFrame(seq, geom);
  }

  async function ackFrame(seq, geom) {
    const lose = Math.random() < ackLossProb;
    const ack = document.createElement("div");
    ack.className = "pkt";
    ack.textContent = "A" + seq;
    ack.style.cssText =
      "position:absolute;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;color:white;font-size:11px;left:" +
      geom.rx +
      "px;top:" +
      geom.ry +
      "px;background:" +
      (lose ? "#ff6b6b" : "#1faa8a");
    channelStage.appendChild(ack);

    await animate(ack, { x: geom.rx, y: geom.ry }, { x: geom.sx, y: geom.sy }, 2500);

    if (lose) {
      ack.style.opacity = 0.5;
      log(`ACK ${seq} lost.`);
      stats.lost++;
      ack.remove();
      return;
    }

    stats.acks++;
    log(`ACK ${seq} received.`);
    ack.remove();
    base++;
    if (base >= seqLimit) {
      finish();
    }
  }

  function finish() {
    running = false;
    log("Simulation complete!");
    log(`Frames sent: ${stats.sent}, ACKs: ${stats.acks}, Lost: ${stats.lost}`);
  }

  async function startSim() {
    if (running) return;
    running = true;
    paused = false;
    for (let seq = 0; seq < seqLimit && running; seq++) {
      while (paused) await sleep(100);
      await sendFrame(seq);
    }
  }

  async function stepSim() {
    if (running) return;
    running = true;
    stepMode = true;
    if (nextSeq < seqLimit) {
      await sendFrame(nextSeq);
      nextSeq++;
    }
    running = false;
  }

  // --- buttons ---
  startBtn.onclick = startSim;
  pauseBtn.onclick = pauseSim;
  stepBtn.onclick = stepSim;
  resetBtn.onclick = init;

  // --- boot ---
  applyVisibility();
  init();
})();
