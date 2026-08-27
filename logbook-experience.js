/* Austral Wash Bay — Logbook experience layer.
   Presentation only: reads the existing localStorage wash history and never changes it. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  function readLogs(){
    const keys=['washLog','washLogs','australWashLog','carWashLog'];
    for(const key of keys){
      try{const v=JSON.parse(localStorage.getItem(key)||'null');if(Array.isArray(v))return v;}catch(e){}
    }
    try{
      for(let i=0;i<localStorage.length;i++){
        const k=localStorage.key(i),raw=localStorage.getItem(k);
        if(!raw||!k.toLowerCase().includes('wash'))continue;
        const v=JSON.parse(raw);if(Array.isArray(v))return v;
      }
    }catch(e){}
    return [];
  }
  function formatDate(v){try{return new Intl.DateTimeFormat(undefined,{day:'numeric',month:'short',year:'numeric'}).format(new Date(v));}catch(e){return String(v||'Unknown date')}}
  function ageDays(v){const d=new Date(v);if(Number.isNaN(+d))return null;return Math.max(0,Math.floor((Date.now()-d)/86400000))}
  function buildSummary(){
    const modal=$('logModal');if(!modal||$('logbookSummary'))return;
    const card=modal.querySelector('.modal-card');if(!card)return;
    const summary=document.createElement('section');summary.id='logbookSummary';summary.className='logbook-summary';
    const logs=readLogs();const latest=logs[0]||logs[logs.length-1];const age=latest&&ageDays(latest.date||latest.completedAt||latest.timestamp);
    summary.innerHTML=`<div class="logbook-kicker">WASH ARCHIVE</div><div class="logbook-stats"><div><small>LOGGED WASHES</small><strong>${logs.length}</strong></div><div><small>LAST WASH</small><strong>${latest?(age===0?'Today':age===1?'1 day ago':age!==null?age+' days ago':'Logged'):'—'}</strong></div></div>${latest?`<div class="logbook-last">Latest entry <b>${formatDate(latest.date||latest.completedAt||latest.timestamp)}</b></div>`:''}`;
    const list=$('logList');card.insertBefore(summary,list);
  }
  function observe(){const modal=$('logModal');if(!modal)return;const mo=new MutationObserver(()=>{if(!modal.classList.contains('hidden')){const old=$('logbookSummary');if(old)old.remove();buildSummary()}});mo.observe(modal,{attributes:true,attributeFilter:['class']});}
  function init(){buildSummary();observe();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();