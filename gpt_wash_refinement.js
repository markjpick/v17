/* GPT Austral Wash Bay — phone-first wash interaction refinements */
(()=>{'use strict';
  // This layer deliberately decorates the existing GPT wash screen without touching legacy files.
  const root=document.documentElement;
  const phaseNames={
    'before-you-start':'#66d6b3','wheel-pre-wash':'#f0a35b','snow-foam':'#8fd3ff',
    'contact-wash':'#72c7a4','rinse':'#62b6d9','decontamination':'#d59be8',
    'drying':'#f2cc67','glass':'#8ec9ff','coating':'#dca7ff','finishing':'#ef8d9c'
  };
  function phaseClass(name){return String(name||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
  function decorate(){
    const screen=document.querySelector('.wash-screen'); if(!screen)return;
    const phase=(screen.className.match(/phase-([a-z0-9-]+)/)||[])[1]||'';
    root.style.setProperty('--gpt-phase-accent',phaseNames[phase]||'#73d9bd');
    document.querySelectorAll('.journey-phase').forEach((b,i)=>{
      const dot=b.querySelector('i'); if(!dot)return;
      const count=Number(b.querySelector('b')?.textContent)||0;
      const first=[...document.querySelectorAll('.journey-phase')].indexOf(b);
      const current=b.classList.contains('current');
      const fill=current?Math.max(0,Math.min(100,(Number(document.querySelector('.card-mark')?.textContent||1)/Math.max(1,count))*100)):b.classList.contains('done')?100:0;
      dot.style.setProperty('--fill',`${fill}%`);
      dot.setAttribute('aria-label',`${b.querySelector('span')?.textContent||'Phase'}: ${current?Math.round(fill):fill>=100?100:0}%`);
      b.dataset.phaseIndex=first;
    });
    const card=document.querySelector('.instruction-card');
    if(card){card.classList.add('gpt-card-ready'); card.querySelectorAll('.instruction-item,.warning-item,.instruction-group').forEach((el,i)=>{el.style.setProperty('--item-delay',`${Math.min(i*45,180)}ms`);el.classList.add('gpt-item')})}
  }
  const style=document.createElement('style');
  style.textContent=`
    :root{--gpt-phase-accent:#73d9bd}
    .journey-track{align-items:center;gap:.35rem}
    .journey-phase{min-width:0;background:none;border:0;padding:0;display:flex;flex-direction:column;align-items:center;gap:.2rem}
    .journey-phase i{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;position:relative;overflow:hidden;border:2px solid color-mix(in srgb,var(--gpt-phase-accent) 35%,transparent);background:conic-gradient(var(--gpt-phase-accent) var(--fill,0%),rgba(255,255,255,.08) 0);box-shadow:0 0 0 1px rgba(255,255,255,.04) inset,0 5px 16px rgba(0,0,0,.2);font-style:normal;font-weight:800}
    .journey-phase i::after{content:'';position:absolute;inset:4px;border-radius:50%;background:#08110f;z-index:0}.journey-phase i{isolation:isolate}.journey-phase i::after{z-index:-1}
    .journey-phase span{font-size:.58rem;max-width:58px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:.68}
    .journey-phase b{display:none}
    .journey-phase.current i{transform:scale(1.08);border-color:var(--gpt-phase-accent);box-shadow:0 0 20px color-mix(in srgb,var(--gpt-phase-accent) 30%,transparent)}
    .journey-phase.done i{background:conic-gradient(var(--gpt-phase-accent) 100%,rgba(255,255,255,.08) 0)}
    .journey-track em{height:2px;flex:1;background:linear-gradient(90deg,rgba(255,255,255,.18),rgba(255,255,255,.05));margin-bottom:1.15rem}
    .gpt-item{opacity:0;transform:translateX(12px);animation:gptInstructionIn .22s cubic-bezier(.2,.8,.25,1) var(--item-delay,0ms) forwards;border-bottom:1px solid rgba(255,255,255,.08);padding:.72rem 0}.gpt-item:last-child{border-bottom:0}
    @keyframes gptInstructionIn{to{opacity:1;transform:translateX(0)}}
    .instruction-card{transition:transform .22s ease,opacity .22s ease;will-change:transform,opacity}
    .instruction-card.enter-forward{animation:gptCardForward .26s cubic-bezier(.2,.8,.25,1)}
    .instruction-card.enter-back{animation:gptCardBack .26s cubic-bezier(.2,.8,.25,1)}
    @keyframes gptCardForward{from{opacity:.2;transform:translateX(24px) scale(.985)}to{opacity:1;transform:none}}
    @keyframes gptCardBack{from{opacity:.2;transform:translateX(-24px) scale(.985)}to{opacity:1;transform:none}}
    .phase-${'dummy'}{}
    @media(max-width:600px){.journey{margin-inline:-2px}.journey-track{gap:.18rem}.journey-phase i{width:34px;height:34px;font-size:.78rem}.journey-phase span{font-size:.5rem;max-width:46px}.journey-track em{margin-bottom:1rem}.instruction-card{touch-action:pan-y}}
  `;
  document.head.appendChild(style);
  new MutationObserver(decorate).observe(document.querySelector('#view')||document.body,{childList:true,subtree:true});
  setTimeout(decorate,0);
})();
