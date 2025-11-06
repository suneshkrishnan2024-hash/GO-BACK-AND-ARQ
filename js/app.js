// js/app.js — Cinematic Neon Go-Back-N ARQ Simulator (slow, with lines + stats)
// Folder layout: index.html, css/style.css, js/app.js

(function () {
  // ---------- DOM bootstrap (we build the whole UI into #app) ----------
  const app = document.getElementById("app");
  app.innerHTML = `
    <header class="glass">
      <h1>Go-Back-N ARQ — Neon Glass Simulator</h1>
      <p>Vertical flow • packets fall (down) • ACKs rise (up) • summary appears after the final ACK</p>
      <div class="controls">
        <label>Number of frames
          <input id="numFrames" type="number" min="1" max="200" value="12">
        </label>
        <label>Window size (N)
          <input id="winSize" type="number" min="1" max="20" value="4">
        </label>
        <label>Timeout (ms)
          <input id="timeout" type="number" min="200" value="2000">
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
        <label id="specificFrameLabel" style="display:none">Specific frames (comma)
          <input id="specificFrames" type="text" placeholder="e.g. 2,7,9">
        </label>
        <label id="everyKLabel" style="display:none">k (every k-th)
          <input id="everyK" type="number" min="1" value="3">
        </label>

        <label>Frame Delay Mode
          <select id="frameDelayMode">
            <option value="none">None</option>
            <option value="specific">Delay specific frame(s)</option>
            <option value="everyk">Delay every k-th</option>
          </select>
        </label>
        <label id="frameDelayLabel" style="display:none">Delay frame # / k
          <input id="frameDelaySpec" type="text" placeholder="e.g. 5 or 3,6">
        </label>
        <label>Frame delay (ms)
          <input id="frameDelayMs" type="number" min="0" value="800">
        </label>

        <label>ACK Loss %
          <input id="ackLossPercent" type="range" min="0" max="80" value="5">
          <span id="ackLossVal">5%</span>
        </label>
        <label>ACK Delay (ms)
          <input id="ackDelayMs" type="number" min="0" value="500">
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
        <div class="window" id="senderWindow"></div>
        <div class="queue" id="senderQueue"></div>
      </div>

      <div class="channel" id="channelLane">
        <h3 style="margin-bottom:10px">Channel</h3>
        <!-- We’ll draw animated packets, ACKs and neon lines inside this container -->
        <div id="channelStage" style="position:relative;width:100%;height:360px;"></div>
      </div>

      <div class="lane" id="receiverLane">
        <h3>Receiver</h3>
        <div class="recv" id="recvArea"></div>
      </div>
    </section>

    <section class="glass">
      <h3 style="text-align:center;margin-bottom:8px;color:#00ffff">Event Log</h3>
      <div class="log" id="events"></div>
    </section>

    <section class="glass" id="statsWrap" style="display:none">
      <h3 style="text-align:center;margin-bottom:8px;color:#00ffff">Summary & Statistics</h3>
      <div class="stats">
        <div>Total original frames: <span id="stat_totalFrames">0</span></div>
        <div>Total transmissions (incl. retransmissions): <span id="stat_totalTrans">0</span></div>
        <div>Total ACKs generated: <span id="stat_totalAcks">0</span></div>
        <div>Frames lost: <span id="stat_framesLost">0</span></div>
        <div>ACKs lost: <span id="stat_acksLost">0</span></div>
        <div>Frames delayed: <span id="stat_framesDelayed">0</span></div>
        <div>Efficiency: <span id="stat_efficiency">0%</span></div>
        <div>Loss percent (frames/transmissions): <span id="stat_lossPercent">0%</span></div>
      </div>
      <div style="margin-top:14px">
        <h4 style="margin-bottom:6px;color:#8ba2b7">Flow Diagram (final timeline)</h4>
        <div class="log" id="flowDiagram" style="max-height:260px"></div>
      </div>
    </section>

    <footer>Made for CN project — slow cinematic Go-Back-N with neon lines ✨</footer>
  `;

  // ---------- Element refs ----------
  const numFramesEl = $("#numFrames");
  const winSizeEl = $("#winSize");
  const timeoutEl = $("#timeout");
  const lossPercentEl = $("#lossPercent");
  const lossPercentVal = $("#lossPercentVal");
  const lossModeEl = $("#lossMode");
  const specificFrameLabel = $("#specificFrameLabel");
  const specificFramesEl = $("#specificFrames");
  const everyKLabel = $("#everyKLabel");
  const everyKEl = $("#everyK");

  const frameDelayModeEl = $("#frameDelayMode");
  const frameDelayLabel = $("#frameDelayLabel");
  const frameDelaySpecEl = $("#frameDelaySpec");
  const frameDelayMsEl = $("#frameDelayMs");

  const ackLossPercentEl = $("#ackLossPercent");
  const ackLossVal = $("#ackLossVal");
  const ackDelayMsEl = $("#ackDelayMs");

  const startBtn = $("#startBtn");
  const pauseBtn = $("#pauseBtn");
  const stepBtn = $("#stepBtn");
  const resetBtn = $("#resetBtn");

  const senderWindow = $("#senderWindow");
  const senderQueue = $("#senderQueue");
  const recvArea = $("#recvArea");
  const channelStage = $("#channelStage");
  const events = $("#events");
  const statsWrap = $("#statsWrap");
  const flowDiagram = $("#flowDiagram");

  // ---------- Helpers ----------
  function $(q) { return document.querySelector(q); }
  function el(tag, cls, txt) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function log(msg) {
    const d = el("div", null, `[${new Date().toLocaleTimeString()}] ${msg}`);
    events.prepend(d);
  }
  function parseNumList(txt) {
    if (!txt) return [];
    return txt.split(",").map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
  }

  // UI reactions
  lossPercentEl.addEventListener("input", () => (lossPercentVal.textContent = lossPercentEl.value + "%"));
  ackLossPercentEl.addEventListener("input", () => (ackLossVal.textContent = ackLossPercentEl.value + "%"));
  lossModeEl.addEventListener("change", () => {
    const v = lossModeEl.value;
    specificFrameLabel.style.display = v === "specific" ? "" : "none";
    everyKLabel.style.display = v === "everyk" ? "" : "none";
  });
  frameDelayModeEl.addEventListener("change", () => {
    const v = frameDelayModeEl.value;
    frameDelayLabel.style.display = v === "none" ? "none" : "";
  });

  // ---------- Simulation State ----------
  let N, timeout, lossProb, ackLossProb;
  let base, nextseq, seqLimit;
  let sentFrames; // [{seq, acked, dom, sends}]
  let running = false;
  let mainTimer = null;

  const stats = {
    totalFrames: 0, totalTrans: 0, totalAcks: 0,
    framesLost: 0, acksLost: 0, framesDelayed: 0
  };

  // ---------- Init / Reset ----------
  function init() {
    N = clamp(parseInt(winSizeEl.value, 10) || 4, 1, 50);
    timeout = clamp(parseInt(timeoutEl.value, 10) || 2000, 200, 60000);
    lossProb = (parseInt(lossPercentEl.value, 10) || 0) / 100;
    ackLossProb = (parseInt(ackLossPercentEl.value, 10) || 0) / 100;

    base = 0; nextseq = 0;
    seqLimit = clamp(parseInt(numFramesEl.value, 10) || 12, 1, 500);
    sentFrames = [];
    running = false;
    clearTimer();

    stats.totalFrames = seqLimit;
    stats.totalTrans = 0; stats.totalAcks = 0;
    stats.framesLost = 0; stats.acksLost = 0; stats.framesDelayed = 0;

    // wipe UI
    senderWindow.innerHTML = "";
    senderQueue.innerHTML = "";
    recvArea.innerHTML = "";
    channelStage.innerHTML = "";
    events.innerHTML = "";
    statsWrap.style.display = "none";
    flowDiagram.innerHTML = "";

    // build window slots
    for (let i = 0; i < N; i++) {
      const f = el("div", "frame", (base + i) < seqLimit ? `#${base + i}` : "-");
      senderWindow.appendChild(f);
    }
    log("Ready — press Start for cinematic Go-Back-N.");
  }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  // ---------- Loss / Delay Rules ----------
  function shouldLoseFrame(seq) {
    const mode = lossModeEl.value;
    if (mode === "none") return false;
    if (mode === "random") return Math.random() < lossProb;
    if (mode === "specific") return parseNumList(specificFramesEl.value).includes(seq);
    if (mode === "everyk") {
      const k = parseInt(everyKEl.value, 10) || 1;
      return ((seq + 1) % k) === 0; // 1-based
    }
    return false;
  }
  function shouldDelayFrame(seq) {
    const mode = frameDelayModeEl.value;
    if (mode === "none") return false;
    const spec = frameDelaySpecEl.value;
    if (mode === "specific") return parseNumList(spec).includes(seq);
    if (mode === "everyk") {
      const k = parseInt(spec, 10) || 1;
      return ((seq + 1) % k) === 0;
    }
    return false;
  }

  // ---------- Window UI ----------
  function refreshWindow() {
    const frames = [...senderWindow.querySelectorAll(".frame")];
    for (let i = 0; i < frames.length; i++) {
      const seq = base + i;
      const f = frames[i];
      f.textContent = seq < seqLimit ? `#${seq}` : "-";
      f.classList.toggle("active", seq >= base && seq < nextseq && seq < seqLimit);
    }
  }

  // ---------- Sending Logic ----------
  function sendIfPossible() {
    while (nextseq < base + N && nextseq < seqLimit) {
      sendFrame(nextseq);
      nextseq++;
    }
    refreshWindow();
  }

  function sendFrame(seq, isRetrans = false) {
    // add packet badge in queue (for history)
    const badge = el("div", "packet", `F${seq}`);
    badge.style.position = "static";
    senderQueue.appendChild(badge);

    // stats
    stats.totalTrans++;

    // draw neon line + packet element in channel
    const laneH = channelStage.clientHeight || 360;
    const travelTime = slowTravelTime(seq); // cinematic
    const startY = 10;           // near top (sender side)
    const endY = laneH - 60;     // near bottom (receiver side)

    // line
    const line = el("div");
    line.style.position = "absolute";
    line.style.left = "50%";
    line.style.transform = "translateX(-50%)";
    line.style.top = startY + "px";
    line.style.width = "4px";
    line.style.height = (endY - startY) + "px";
    line.style.background = "linear-gradient(180deg, rgba(0,255,255,0.5), rgba(0,255,255,0.08))";
    line.style.boxShadow = "0 0 12px rgba(0,255,255,0.3)";
    line.style.borderRadius = "8px";
    line.style.opacity = "0.55";

    const pack = el("div", "packet", `F${seq}`);
    pack.style.left = "50%";
    pack.style.transform = "translateX(-50%) translateY(-40px)";
    pack.style.top = startY + "px";

    channelStage.appendChild(line);
    channelStage.appendChild(pack);

    // delay / loss decisions
    const delayed = shouldDelayFrame(seq);
    const extraDelay = delayed ? Math.max(0, parseInt(frameDelayMsEl.value, 10) || 0) : 0;
    if (delayed) stats.framesDelayed++;

    const lose = shouldLoseFrame(seq);

    // animate down
    const totalDown = travelTime + extraDelay;
    animateDown(pack, startY, endY, totalDown);

    // arrival / loss resolution
    setTimeout(() => {
      if (lose) {
        pack.classList.add("lost");
        log(`Frame ${seq} lost in channel.`);
        setTimeout(() => {
          channelStage.removeChild(pack);
          // keep line for a bit for cinematic trail
          fadeOut(line, 500);
        }, 600);
        // no ACK generated
      } else {
        // deliver to receiver
        channelStage.removeChild(pack);
        fadeOut(line, 500);
        onReceiverGot(seq);
      }
    }, totalDown + 60);

    // record sent frame if first time
    let rec = sentFrames.find(s => s.seq === seq);
    if (!rec) {
      rec = { seq, acked: false, sends: 1, dom: badge };
      sentFrames.push(rec);
    } else {
      rec.sends += 1;
      badge.style.opacity = "0.9";
    }

    // timer: if we sent the base frame, (re)start timer
    if (base === seq) {
      startTimer();
    }
  }

  function slowTravelTime(seq) {
    // Cinematic: base 1400ms + tiny per-seq offset for variety
    return 1400 + (seq % 3) * 150;
  }

  // ---------- Receiver Logic ----------
  function onReceiverGot(seq) {
    const expected = recvArea.childElementCount;
    if (seq === expected) {
      const block = el("div", "frame", `#${seq}`);
      block.classList.add("active");
      recvArea.appendChild(block);
      log(`Receiver accepted frame ${seq}. Sending ACK ${seq}.`);
      sendAck(seq);
    } else {
      const ackFor = expected - 1;
      log(`Receiver discarded frame ${seq} (expected ${expected}). Sending ACK ${ackFor}.`);
      sendAck(ackFor);
    }
  }

  // ---------- ACK Logic ----------
  function sendAck(ackSeq) {
    stats.totalAcks++;

    const laneH = channelStage.clientHeight || 360;
    const startY = laneH - 60; // from bottom (receiver)
    const endY = 10;           // to top (sender)
    const ackDelay = Math.max(0, parseInt(ackDelayMsEl.value, 10) || 0);
    const travelTime = 1300 + ackDelay; // cinematic up

    // line for ACK (blue)
    const line = el("div");
    line.style.position = "absolute";
    line.style.left = "50%";
    line.style.transform = "translateX(-50%)";
    line.style.top = endY + "px";
    line.style.width = "4px";
    line.style.height = (startY - endY) + "px";
    line.style.background = "linear-gradient(180deg, rgba(0,107,255,0.08), rgba(0,107,255,0.55))";
    line.style.boxShadow = "0 0 12px rgba(0,107,255,0.3)";
    line.style.borderRadius = "8px";
    line.style.opacity = "0.55";

    const ack = el("div", "packet ack", `ACK${ackSeq}`);
    ack.style.left = "50%";
    ack.style.transform = "translateX(-50%) translateY(40px)";
    ack.style.top = startY + "px";

    channelStage.appendChild(line);
    channelStage.appendChild(ack);

    // simulate ACK loss
    const loseAck = Math.random() < ackLossProb;

    animateUp(ack, startY, endY, travelTime);

    setTimeout(() => {
      if (loseAck) {
        ack.classList.add("lost");
        log(`ACK ${ackSeq} lost on return path.`);
        stats.acksLost++;
        setTimeout(() => {
          channelStage.removeChild(ack);
          fadeOut(line, 500);
        }, 600);
      } else {
        channelStage.removeChild(ack);
        fadeOut(line, 500);
        onAckReceived(ackSeq);
      }
    }, travelTime + 60);
  }

  function onAckReceived(ackSeq) {
    log(`Sender received ACK ${ackSeq}.`);
    // cumulative ack
    sentFrames.forEach(s => { if (s.seq <= ackSeq) s.acked = true; });

    // slide window forward
    while (sentFrames.length && sentFrames[0].acked) {
      const removed = sentFrames.shift();
      if (removed && removed.dom) {
        removed.dom.style.background = "linear-gradient(180deg,#eafff7,#bff3e6)";
        removed.dom.style.opacity = "1";
      }
      base++;
    }

    if (sentFrames.length > 0) startTimer(); else clearTimer();
    refreshWindow();

    // send next frames if window has room
    if (running) sendIfPossible();

    // completion check
    if (base >= seqLimit) {
      completeSimulation();
    }
  }

  // ---------- Timer / Timeout ----------
  function startTimer() {
    clearTimer();
    mainTimer = setTimeout(onTimeout, timeout);
  }
  function clearTimer() {
    if (mainTimer) { clearTimeout(mainTimer); mainTimer = null; }
  }
  function onTimeout() {
    log(`Timeout at base ${base}. Go-Back-N: retransmitting ${base}..${Math.min(base + N - 1, seqLimit - 1)}.`);
    const outstanding = sentFrames.map(s => s.seq);
    outstanding.forEach(seq => sendFrame(seq, true));
    if (sentFrames.length > 0) startTimer();
  }

  // ---------- Completion / Stats ----------
  function completeSimulation() {
    clearTimer();
    running = false;
    log("Simulation complete. Preparing summary…");

    // compute stats
    const eff = stats.totalTrans > 0 ? (stats.totalFrames / stats.totalTrans) * 100 : 100;
    const lostPerc = stats.totalTrans > 0 ? (stats.framesLost / stats.totalTrans) * 100 : 0;

    // write stats
    $("#stat_totalFrames").textContent = stats.totalFrames;
    $("#stat_totalTrans").textContent = stats.totalTrans;
    $("#stat_totalAcks").textContent = stats.totalAcks;
    $("#stat_framesLost").textContent = stats.framesLost;
    $("#stat_acksLost").textContent = stats.acksLost;
    $("#stat_framesDelayed").textContent = stats.framesDelayed;
    $("#stat_efficiency").textContent = eff.toFixed(2) + "%";
    $("#stat_lossPercent").textContent = lostPerc.toFixed(2) + "%";

    // build flow diagram from log (older → newer)
    flowDiagram.innerHTML = "";
    const evs = Array.from(events.children).reverse();
    evs.forEach(e => flowDiagram.appendChild(el("div", null, e.textContent)));

    statsWrap.style.display = "";
  }

  // ---------- Animations (down/up + fade) ----------
  function animateDown(elm, startY, endY, ms) {
    elm.style.opacity = "1";
    const start = performance.now();
    function step(t) {
      const k = Math.min(1, (t - start) / ms);
      const y = startY + (endY - startY) * easeCinematic(k);
      elm.style.transform = `translateX(-50%) translateY(${y - startY - 40}px)`;
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function animateUp(elm, startY, endY, ms) {
    elm.style.opacity = "1";
    const start = performance.now();
    function step(t) {
      const k = Math.min(1, (t - start) / ms);
      const y = startY + (endY - startY) * easeCinematic(k);
      elm.style.transform = `translateX(-50%) translateY(${y - startY + 40}px)`;
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function easeCinematic(k) {
    // slow in-out curve for cinematic motion
    return k < 0.5 ? 2 * k * k : -1 + (4 - 2 * k) * k;
  }
  function fadeOut(elm, ms) {
    const start = performance.now();
    function step(t) {
      const k = Math.min(1, (t - start) / ms);
      elm.style.opacity = String(1 - k);
      if (k < 1) requestAnimationFrame(step);
      else if (elm.parentNode) elm.parentNode.removeChild(elm);
    }
    requestAnimationFrame(step);
  }

  // ---------- Controls ----------
  startBtn.addEventListener("click", () => {
    if (running) return;
    running = true;
    log("Started.");
    sendIfPossible();
  });
  pauseBtn.addEventListener("click", () => {
    running = false;
    clearTimer();
    log("Paused.");
  });
  stepBtn.addEventListener("click", () => {
    // Single step: send whatever fits now (one pass)
    if (!running) {
      const pre = nextseq;
      sendIfPossible();
      if (nextseq === pre) log("Step: no frame could be sent (window full or done).");
      else log("Step: sent available frame(s).");
    }
  });
  resetBtn.addEventListener("click", () => {
    init();
    log("Reset.");
  });

  // ---------- Boot ----------
  init();
})();
