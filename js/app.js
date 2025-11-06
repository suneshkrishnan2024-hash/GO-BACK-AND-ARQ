// js/app.js — Go-Back-N ARQ Visual Simulator (Teaching Mode Edition)
// Created by Sunesh Krishnan N & Aravind G | Guided by Dr. Swaminathan Annadurai

(function () {
  const $ = s => document.querySelector(s);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
  const parseNums = t => !t?[]:t.split(",").map(x=>parseInt(x.trim())).filter(x=>!isNaN(x));

  // DOM elements
  const numFramesEl=$("#numFrames"), winSizeEl=$("#winSize"), timeoutEl=$("#timeout");
  const lossPercentEl=$("#lossPercent"), lossPercentVal=$("#lossPercentVal");
  const lossModeEl=$("#lossMode"), specificFramesEl=$("#specificFrames"), everyKEl=$("#everyK");
  const frameDelayModeEl=$("#frameDelayMode"), frameDelaySpecEl=$("#frameDelaySpec"), frameDelayMsEl=$("#frameDelayMs");
  const ackLossPercentEl=$("#ackLossPercent"), ackLossVal=$("#ackLossVal"), ackDelayMsEl=$("#ackDelayMs");
  const simModeEl=$("#simMode"), diagramTypeEl=$("#diagramType"), diagramModeLabel=$("#diagramModeLabel");
  const senderWindow=$("#senderWindow"), senderQueue=$("#senderQueue"), recvArea=$("#recvArea");
  const channelStage=$("#channelStage"), liveSvg=$("#liveSvg"), events=$("#events"), statsWrap=$("#statsWrap"), diagramHost=$("#diagramHost");
  const startBtn=$("#startBtn"), resetBtn=$("#resetBtn");

  // Hide pause/step buttons if present
  const pauseBtn=$("#pauseBtn"), stepBtn=$("#stepBtn");
  if(pauseBtn) pauseBtn.remove();
  if(stepBtn) stepBtn.remove();

  // Display update
  lossPercentEl.addEventListener("input",()=>lossPercentVal.textContent=lossPercentEl.value+"%");
  ackLossPercentEl.addEventListener("input",()=>ackLossVal.textContent=ackLossPercentEl.value+"%");

  const log = m => events.prepend(Object.assign(document.createElement("div"),{textContent:`[${new Date().toLocaleTimeString()}] ${m}`}));

  let N, timeout, lossProb, ackLossProb, seqLimit;
  let base, nextSeq, running=false, timer=null;
  const stats={totalFrames:0,totalTrans:0,totalAcks:0,framesLost:0,acksLost:0,framesDelivered:0};

  // geometry
  function endpoints(seq){
    const w = liveSvg.getBoundingClientRect().width || 800;
    const L=50,R=w-100,Y=100+(seq%6)*60;
    return {
      frameStart:{x:L,y:Y}, frameEnd:{x:R,y:Y},
      ackStart:{x:R,y:Y-14}, ackEnd:{x:L,y:Y-14}
    };
  }

  function drawLine(x1,y1,x2,y2,color,dashed,ms){
    const ln=document.createElementNS("http://www.w3.org/2000/svg","line");
    ln.setAttribute("x1",x1);ln.setAttribute("y1",y1);
    ln.setAttribute("x2",x2);ln.setAttribute("y2",y2);
    ln.setAttribute("stroke",color);ln.setAttribute("stroke-width","3");
    if(dashed) ln.setAttribute("stroke-dasharray","10 7");
    liveSvg.appendChild(ln);
    const len=Math.hypot(x2-x1,y2-y1);
    ln.setAttribute("stroke-dasharray",len);
    ln.setAttribute("stroke-dashoffset",len);
    ln.style.transition=`stroke-dashoffset ${ms}ms ease`;
    requestAnimationFrame(()=>ln.setAttribute("stroke-dashoffset","0"));
  }

  function packet(label,color,pos){
    const p=document.createElement("div");
    p.textContent=label;
    p.style.cssText=`position:absolute;left:${pos.x}px;top:${pos.y}px;width:36px;height:36px;
      border-radius:50%;display:grid;place-items:center;font-weight:700;color:#fff;
      background:${color};opacity:0;transform:scale(0.8);transition:opacity .3s,transform .3s`;
    channelStage.appendChild(p);
    return p;
  }

  function movePacket(el,a,b,ms){
    el.style.opacity="1";el.style.transform="scale(1)";
    return new Promise(res=>{
      const start=performance.now();
      function step(t){
        const k=Math.min(1,(t-start)/ms);
        const e=k<0.5?2*k*k:-1+(4-2*k)*k;
        el.style.left=(a.x+(b.x-a.x)*e)+"px";
        el.style.top=(a.y+(b.y-a.y)*e)+"px";
        if(k<1)requestAnimationFrame(step);else res();
      }
      requestAnimationFrame(step);
    });
  }

  // logic
  function shouldLoseFrame(seq){
    const m=lossModeEl.value;
    if(m==="none")return false;
    if(m==="random")return Math.random()<lossProb;
    if(m==="specific")return parseNums(specificFramesEl.value).includes(seq);
    if(m==="everyk"){const k=parseInt(everyKEl.value,10)||1;return((seq+1)%k)===0;}
    return false;
  }

  function startTimer(){clearTimer();timer=setTimeout(onTimeout,timeout);}
  function clearTimer(){if(timer){clearTimeout(timer);timer=null;}}

  function init(){
    N=clamp(parseInt(winSizeEl.value,10)||4,1,32);
    timeout=clamp(parseInt(timeoutEl.value,10)||6000,2000,60000);
    lossProb=(parseInt(lossPercentEl.value,10)||0)/100;
    ackLossProb=(parseInt(ackLossPercentEl.value,10)||0)/100;
    seqLimit=clamp(parseInt(numFramesEl.value,10)||10,1,300);
    base=0;nextSeq=0;running=false;clearTimer();

    Object.assign(stats,{totalFrames:seqLimit,totalTrans:0,totalAcks:0,framesLost:0,acksLost:0,framesDelivered:0});
    senderWindow.innerHTML="";senderQueue.innerHTML="";recvArea.innerHTML="";
    liveSvg.innerHTML="";channelStage.innerHTML="";events.innerHTML="";statsWrap.classList.add("hidden");diagramHost.innerHTML="";
    for(let i=0;i<N;i++){const d=document.createElement("div");d.textContent=(i<seqLimit)?`#${i}`:"-";d.style.cssText="background:#222;color:#eee;padding:6px 8px;border-radius:8px;margin-bottom:6px;text-align:center";senderWindow.appendChild(d);}
    log("Ready — Teaching Mode initialized.");
  }

  async function onTimeout(){
    if(!running)return;
    log(`Timeout — retransmitting from frame ${base}.`);
    for(let s=base;s<nextSeq;s++) await sendFrame(s);
    startTimer();
  }

  async function sendFrame(seq){
    stats.totalTrans++;
    const geom=endpoints(seq);
    const lost=shouldLoseFrame(seq);
    drawLine(geom.frameStart.x,geom.frameStart.y,geom.frameEnd.x,geom.frameEnd.y,lost?"#ff4c4c":"#1a8cff",lost,2500);
    const f=packet("F"+seq,lost?"#ff4c4c":"#1a8cff",geom.frameStart);
    await movePacket(f,geom.frameStart,geom.frameEnd,2500);
    if(lost){
      f.style.opacity=".4";
      log(`Frame ${seq} lost.`);
      stats.framesLost++;
      await sleep(400);
      f.remove();
      return;
    }
    f.remove();
    await sleep(500);
    await receiveFrame(seq,geom);
  }

  async function receiveFrame(seq,geom){
    const expected=recvArea.childElementCount;
    let ackNum;
    if(seq===expected){
      const ok=document.createElement("div");
      ok.textContent="#"+seq;
      ok.style.cssText="background:#0b1e2b;color:#9ef;border:1px solid #2a6bff;padding:6px 8px;margin-bottom:6px;border-radius:8px";
      recvArea.appendChild(ok);
      stats.framesDelivered++;
      ackNum=seq;
      log(`Receiver accepted ${seq} — sending ACK ${ackNum}`);
    }else{
      ackNum=expected-1;
      log(`Receiver discarded ${seq}, sending ACK ${ackNum}`);
    }

    stats.totalAcks++;
    const ackLost=Math.random()<ackLossProb;
    drawLine(geom.ackStart.x,geom.ackStart.y,geom.ackEnd.x,geom.ackEnd.y,ackLost?"#ff4c4c":"#00cc88",ackLost,2000);
    const ack=packet("A"+ackNum,ackLost?"#ff4c4c":"#00cc88",geom.ackStart);
    await movePacket(ack,geom.ackStart,geom.ackEnd,2000);
    ack.remove();
    if(ackLost){stats.acksLost++;log(`ACK ${ackNum} lost.`);return;}
    onAck(ackNum);
  }

  function onAck(ackNum){
    if(ackNum>=base){base=ackNum+1;if(base===nextSeq)clearTimer();else startTimer();}
  }

  async function teachingFlow(){
    running=true;
    while(base<seqLimit){
      if(nextSeq<base+N && nextSeq<seqLimit){
        await sendFrame(nextSeq);
        nextSeq++;
        startTimer();
      }
      await sleep(1000); // delay before next frame for teaching clarity
    }
    finish();
  }

  function finish(){
    running=false;clearTimer();
    log("Simulation complete — summary ready.");
    const delivered=stats.framesDelivered;
    const trans=Math.max(1,stats.totalTrans);
    const eff=(delivered/trans)*100;
    $("#stat_totalFrames").textContent=stats.totalFrames;
    $("#stat_totalTrans").textContent=stats.totalTrans;
    $("#stat_delivered").textContent=stats.framesDelivered;
    $("#stat_totalAcks").textContent=stats.totalAcks;
    $("#stat_framesLost").textContent=stats.framesLost;
    $("#stat_acksLost").textContent=stats.acksLost;
    $("#stat_efficiency").textContent=eff.toFixed(2)+"%";
    $("#eff_fill").style.width=`${Math.min(100,eff)}%`;
    $("#stat_lossPercent").textContent=((stats.framesLost/trans)*100).toFixed(2)+"%";
    statsWrap.classList.remove("hidden");
  }

  startBtn.addEventListener("click",async()=>{if(!running){log("Teaching simulation started.");teachingFlow();}});
  resetBtn.addEventListener("click",()=>{init();log("Reset.");});
  init();
})();
