// js/app.js
(() => {
  // UI refs
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const numFramesEl = $('#numFrames');
  const winSizeEl = $('#winSize');
  const timeoutEl = $('#timeout');
  const lossPercentEl = $('#lossPercent');
  const lossPercentVal = $('#lossPercentVal');
  const lossModeEl = $('#lossMode');
  const specificFrameLabel = $('#specificFrameLabel');
  const specificFramesEl = $('#specificFrames');
  const everyKLabel = $('#everyKLabel');
  const everyKEl = $('#everyK');
  const frameDelayModeEl = $('#frameDelayMode');
  const frameDelayLabel = $('#frameDelayLabel');
  const frameDelaySpec = $('#frameDelaySpec');
  const frameDelayMsEl = $('#frameDelayMs');
  const ackLossPercent = $('#ackLossPercent');
  const ackLossVal = $('#ackLossVal');
  const ackDelayMsEl = $('#ackDelayMs');

  const startBtn = $('#startBtn');
  const pauseBtn = $('#pauseBtn');
  const stepBtn = $('#stepBtn');
  const resetBtn = $('#resetBtn');
  const autoSendEl = $('#autoSend');

  const senderWindow = $('#senderWindow');
  const senderQueue = $('#senderQueue');
  const recvArea = $('#recvArea');
  const channelTrack = $('#channelTrack');
  const events = $('#events');
  const statsWrap = $('#statsWrap');

  // stats nodes
  const stat_totalFrames = $('#stat_totalFrames');
  const stat_totalTrans = $('#stat_totalTrans');
  const stat_totalAcks = $('#stat_totalAcks');
  const stat_framesLost = $('#stat_framesLost');
  const stat_acksLost = $('#stat_acksLost');
  const stat_framesDelayed = $('#stat_framesDelayed');
  const stat_efficiency = $('#stat_efficiency');
  const stat_lossPercent = $('#stat_lossPercent');
  const flowDiagram = $('#flowDiagram');

  // dynamic UI show/hide
  function updateLossModeUI(){
    const v = lossModeEl.value;
    specificFrameLabel.classList.toggle('hidden', v !== 'specific');
    everyKLabel.classList.toggle('hidden', v !== 'everyk');
  }
  function updateFrameDelayUI(){
    const v = frameDelayModeEl.value;
    frameDelayLabel.classList.toggle('hidden', v === 'none');
  }
  lossModeEl.addEventListener('change', updateLossModeUI);
  frameDelayModeEl.addEventListener('change', updateFrameDelayUI);

  // reflect range labels
  lossPercentEl.addEventListener('input', ()=> lossPercentVal.textContent = lossPercentEl.value + '%');
  ackLossPercent.addEventListener('input', ()=> ackLossVal.textContent = ackLossPercent.value + '%');

  // simulation state
  let N = parseInt(winSizeEl.value,10);
  let timeout = parseInt(timeoutEl.value,10);
  let lossProb = parseInt(lossPercentEl.value,10)/100;
  let ackLossProb = parseInt(ackLossPercent.value,10)/100;
  let base = 0, nextseq = 0;
  let seqLimit = parseInt(numFramesEl.value,10);
  let sentFrames = []; // objects {seq, sentTimes, acked}
  let running = false;
  let autoSend = autoSendEl.checked;
  let mainTimer = null;
  let stats = {}; // counters

  function resetState(){
    N = parseInt(winSizeEl.value,10);
    timeout = parseInt(timeoutEl.value,10);
    lossProb = parseInt(lossPercentEl.value,10)/100;
    ackLossProb = parseInt(ackLossPercent.value,10)/100;
    base = 0; nextseq = 0; seqLimit = parseInt(numFramesEl.value,10);
    sentFrames = [];
    running = false; autoSend = autoSendEl.checked;
    clearTimer();
    senderWindow.innerHTML=''; senderQueue.innerHTML=''; recvArea.innerHTML=''; channelTrack.innerHTML='';
    events.innerHTML=''; statsWrap.classList.add('hidden'); flowDiagram.innerHTML='';
    stats = {totalFrames: seqLimit, totalTrans:0, totalAcks:0, framesLost:0, acksLost:0, framesDelayed:0};
    buildWindow();
    log('Ready. Configure options and press Start.');
  }

  function buildWindow(){
    senderWindow.innerHTML='';
    for(let i=0;i<N;i++){
      const f = document.createElement('div');
      f.className = 'frame';
      f.dataset.idx = i;
      f.textContent = (base + i) < seqLimit ? `#${base+i}` : '-';
      senderWindow.appendChild(f);
    }
  }

  function refreshWindow(){
    const frames = senderWindow.querySelectorAll('.frame');
    frames.forEach((f,i)=>{
      const seq = base + i;
      f.textContent = seq < seqLimit ? `#${seq}` : '-';
      f.classList.toggle('active', seq >= base && seq < nextseq);
    });
  }

  function log(msg){
    const d = document.createElement('div');
    d.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    events.prepend(d);
  }

  // helpers for loss/delay rules
  function parseSpecificFrames(text){
    if(!text) return [];
    return text.split(',').map(s => parseInt(s.trim(),10)).filter(n=>!isNaN(n) && n>=0);
  }
  function shouldLoseFrame(seq){
    const mode = lossModeEl.value;
    if(mode === 'none') return false;
    if(mode === 'random'){
      // base random probability + global percent slider
      return Math.random() < lossProb;
    }
    if(mode === 'specific'){
      const arr = parseSpecificFrames(specificFramesEl.value);
      return arr.includes(seq);
    }
    if(mode === 'everyk'){
      const k = parseInt(everyKEl.value,10) || 1;
      return ((seq+1) % k) === 0; // every k-th (1-based)
    }
    return false;
  }
  function shouldDelayFrame(seq){
    const mode = frameDelayModeEl.value;
    if(mode === 'none') return false;
    if(mode === 'specific'){
      const spec = frameDelaySpec.value.split(',').map(s=>s.trim()).filter(Boolean);
      // allow single number or list
      const nums = spec.map(s=>parseInt(s,10)).filter(n=>!isNaN(n));
      return nums.includes(seq);
    }
    if(mode === 'everyk'){
      const k = parseInt(frameDelaySpec.value,10) || 1;
      return ((seq+1) % k) === 0;
    }
    return false;
  }

  // main send logic
  function sendIfPossible(){
    while(nextseq < base + N && nextseq < seqLimit){
      sendFrame(nextseq);
      nextseq++;
    }
    refreshWindow();
  }

  function sendFrame(seq, isRetrans=false){
    // DOM packet in sender queue (keeps record)
    const pack = document.createElement('div');
    pack.className = 'packet';
    pack.textContent = `F${seq}`;
    senderQueue.appendChild(pack);

    // stats
    stats.totalTrans++;

    // create travel element in channel
    const slot = document.createElement('div');
    slot.className = 'slot';
    const channelLine = document.createElement('div');
    channelLine.className = 'track-line';
    channelLine.style.width = '6px';
    slot.appendChild(channelLine);

    const travel = document.createElement('div');
    travel.className = 'packet';
    travel.textContent = `F${seq}`;
    slot.appendChild(travel);
    channelTrack.appendChild(slot);

    // check delay
    const frameDelayMs = parseInt(frameDelayMsEl.value,10) || 0;
    const delayed = shouldDelayFrame(seq);
    if(delayed) { travel.classList.add('delayed'); stats.framesDelayed++; }

    // decide loss (frame)
    const lose = shouldLoseFrame(seq);

    // animation: move down (we'll simulate by CSS animation with setTimeout)
    // compute time based on delay flags
    const baseTravel = 700;
    const travelTime = delayed ? baseTravel + frameDelayMs : baseTravel;

    travel.style.animation = `downTravel ${travelTime}ms linear forwards`;

    // after travelTime + small buffer => delivered or lost
    setTimeout(()=> {
      if(lose){
        travel.classList.add('lost');
        log(`Frame ${seq} lost on the way to receiver.`);
        stats.framesLost++;
        // remove after small fade
        setTimeout(()=> slot.remove(), 700);
        // no ACK will be sent
      } else {
        // delivered: append into receiver if in-order
        receiveAtReceiver(seq);
        slot.remove();
      }
    }, travelTime + 60);

    // track the sent frame record if first time
    let rec = sentFrames.find(s => s.seq === seq);
    if(!rec){
      rec = {seq, acked:false, sends:1, dom:pack};
      sentFrames.push(rec);
    } else {
      rec.sends += 1;
      // highlight resend
      pack.style.opacity = '0.85';
    }

    // if base frame started, ensure timer
    if(base === seq){
      startTimer();
    }
  }

  function receiveAtReceiver(seq){
    const expected = recvArea.childElementCount;
    if(seq === expected){
      const r = document.createElement('div');
      r.className = 'packet';
      r.textContent = `F${seq}`;
      recvArea.appendChild(r);
      log(`Receiver accepted frame ${seq}. Sending ACK ${seq}.`);
      sendAck(seq);
    } else {
      log(`Receiver discarded frame ${seq} (expected ${expected}). Sending ACK ${Math.max(-1, expected-1)}.`);
      sendAck(expected - 1);
    }
  }

  function sendAck(ackSeq){
    // build ack element traveling upwards
    const slot = document.createElement('div');
    slot.className = 'slot';
    const channelLine = document.createElement('div');
    channelLine.className = 'track-line';
    channelLine.style.width = '6px';
    slot.appendChild(channelLine);

    const ack = document.createElement('div');
    ack.className = 'packet ack';
    ack.textContent = `ACK${ackSeq}`;
    slot.appendChild(ack);

    channelTrack.appendChild(slot);

    // ack delay
    const ackDelay = parseInt(ackDelayMsEl.value,10) || 0;
    const ackTravel = 480 + ackDelay;
    ack.style.animation = `upTravel ${ackTravel}ms linear forwards`;

    // ack loss random by ackLossProb
    const loseAck = Math.random() < ackLossProb || (Math.random() < (parseInt(lossPercentEl.value,10)/100) && false); // primarily ackLossProb

    setTimeout(()=> {
      if(loseAck){
        ack.classList.add('lost');
        log(`ACK ${ackSeq} lost on return path.`);
        stats.acksLost++;
        setTimeout(()=> slot.remove(), 600);
      } else {
        // ack reaches sender
        slot.remove();
        onAckReceived(ackSeq);
      }
    }, ackTravel + 40);

    stats.totalAcks++;
  }

  function onAckReceived(ackSeq){
    log(`Sender received ACK ${ackSeq}.`);
    // mark acked frames cumulative
    sentFrames.forEach(s => { if(s.seq <= ackSeq) s.acked = true; });
    // slide window removing acked frames from the front
    while(sentFrames.length && sentFrames[0].acked){
      const r = sentFrames.shift();
      r.dom.classList.add('acked');
      base++;
    }
    if(sentFrames.length > 0) startTimer(); else clearTimer();
    refreshWindow();
    if(autoSendEl.checked) sendIfPossible();

    // if all done (base reached seqLimit)
    checkCompletion();
  }

  // timer mechanics
  function startTimer(){
    clearTimer();
    mainTimer = setTimeout(onTimeout, parseInt(timeoutEl.value,10));
  }
  function clearTimer(){
    if(mainTimer){ clearTimeout(mainTimer); mainTimer = null; }
  }

  function onTimeout(){
    log(`Timeout at base ${base}. Go-Back-N retransmitting from ${base}..${Math.min(base + N -1, seqLimit-1)}.`);
    // retransmit all outstanding frames starting from base
    const outstanding = sentFrames.map(s => s.seq);
    // retransmit in order
    outstanding.forEach(seq => {
      sendFrame(seq, true);
    });
    // restart timer
    if(sentFrames.length>0) startTimer();
  }

  // completion check & stats
  function checkCompletion(){
    if(base >= seqLimit){
      clearTimer();
      running = false;
      log('Simulation complete. Generating summary...');
      setTimeout(()=> showStats(), 300);
    }
  }

  function showStats(){
    // compute stats
    const totalTrans = stats.totalTrans;
    const totalFrames = stats.totalFrames;
    const totalAcks = stats.totalAcks;
    const framesLost = stats.framesLost;
    const acksLost = stats.acksLost;
    const framesDelayed = stats.framesDelayed;
    const efficiency = totalFrames > 0 ? ((totalFrames / totalTrans) * 100).toFixed(2) : '100.00';
    const lossPerc = totalTrans > 0 ? ((framesLost / totalTrans) * 100).toFixed(2) : '0.00';

    stat_totalFrames.textContent = totalFrames;
    stat_totalTrans.textContent = totalTrans;
    stat_totalAcks.textContent = totalAcks;
    stat_framesLost.textContent = framesLost;
    stat_acksLost.textContent = acksLost;
    stat_framesDelayed.textContent = framesDelayed;
    stat_efficiency.textContent = efficiency;
    stat_lossPercent.textContent = lossPerc;

    // Build a final flow diagram (simple textual vertical list replicating what happened)
    buildFlowDiagram();

    statsWrap.classList.remove('hidden');
    log('Summary displayed below.');
  }

  function buildFlowDiagram(){
    // produce vertical timeline of sent frames & ack events from logged events (simple)
    flowDiagram.innerHTML = '';
    // We'll construct a vertical list from the recorded events nodes
    const lines = [];
    // Use the events content to construct a simple flow display (most recent at top)
    const evs = Array.from(events.querySelectorAll('div')).reverse();
    evs.forEach(e => {
      const row = document.createElement('div');
      row.textContent = e.textContent;
      row.style.color = 'var(--muted)';
      row.style.fontSize = '0.95rem';
      row.style.marginBottom = '6px';
      flowDiagram.appendChild(row);
    });
  }

  // UI button wiring
  startBtn.addEventListener('click', ()=>{
    if(running) return;
    // refresh parameters
    seqLimit = parseInt(numFramesEl.value,10);
    N = Math.max(1, parseInt(winSizeEl.value,10));
    lossProb = parseInt(lossPercentEl.value,10)/100;
    ackLossProb = parseInt(ackLossPercent.value,10)/100;
    base = base || 0;
    running = true;
    log('Started simulation.');
    sendIfPossible();
  });

  pauseBtn.addEventListener('click', ()=>{
    running = false;
    clearTimer();
    log('Paused.');
  });

  stepBtn.addEventListener('click', ()=>{
    // single step send
    sendIfPossible();
    log('Step executed.');
  });

  resetBtn.addEventListener('click', ()=>{
    resetState();
  });

  // initialize
  resetState();

  // expose for debugging
  window.GBN = {
    resetState,
    sendIfPossible,
    getState: () => ({base,nextseq,seqLimit,sentFrames})
  };
})();
