/* Austral Wash Bay — Guided Wash Experience
   Presentation layer only. The existing app.js remains responsible for the wash,
   carousel navigation, conditional instructions and timer behaviour. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const ICONS={'Preparation':'▦','Wheels':'◉','Pre-Wash':'≈','Wash':'✦','Rinse':'◒','Drying':'◐','Touch-On':'⬡','Turtle Wax':'⬡','Rain-X':'◈','Finish':'✓'};
function steps(){return Array.from(($('carouselTrack')||document.createElement('div')).querySelectorAll('.step-slide'));}
function phase(s){const e=s&&s.querySelector('.phase-eyebrow');return e?e.textContent.trim():'Wash';}
function active(){return ($('carouselTrack')||document.createElement('div')).querySelector('.step-slide.active');}
function ensureJourney(){
 const screen=$('stepScreen');if(!screen)return;
 if(!$('washJourney')){const j=document.createElement('div');j.id='washJourney';j.className='wash-journey';j.innerHTML='<div class="wj-top"><span class="wj-kicker">WASH JOURNEY</span><span id="wjProgress">01 / 01</span></div><div id="wjRail" class="wj-rail"></div>';screen.insertBefore(j,screen.firstChild)}
 if(!$('guidedHud')){const h=document.createElement('div');h.id='guidedHud';h.className='guided-hud';h.innerHTML='<div class="gh-cell"><span>CURRENT PHASE</span><strong id="guidedPhaseNow">Wash</strong></div><div class="gh-divider"></div><div class="gh-cell right"><span>STEP</span><strong id="guidedStepFraction">01 / 01</strong></div>';screen.appendChild(h)}
}
function rebuild(){
 ensureJourney();const list=steps(),rail=$('wjRail');if(!rail||!list.length)return;
 const phases=[];list.forEach((s,i)=>{const p=phase(s);if(!phases.some(x=>x.name===p))phases.push({name:p,index:i})});
 rail.innerHTML=phases.map((p,i)=>`<button type="button" class="wj-phase" data-index="${p.index}"><span class="wj-icon">${ICONS[p.name]||'•'}</span><span class="wj-name">${p.name}</span></button>`).join('');
 rail.querySelectorAll('.wj-phase').forEach(b=>b.addEventListener('click',()=>{const s=list[Number(b.dataset.index)];if(s)s.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'})}));
 list.forEach((s,i)=>{s.dataset.guidedIndex=i; if(!s.querySelector('.guided-card-head')){const head=document.createElement('div');head.className='guided-card-head';head.innerHTML=`<span class="guided-card-phase">${ICONS[phase(s)]||'•'} ${phase(s)}</span><span class="guided-card-number">${String(i+1).padStart(2,'0')}</span>`;s.insertBefore(head,s.firstChild)}});
 update();
}
function update(){
 const list=steps(),a=active();if(!list.length||!a)return;const i=list.indexOf(a),p=phase(a);
 document.querySelectorAll('.wj-phase').forEach(b=>b.classList.toggle('active',Number(b.dataset.index)<=i&&Number(b.dataset.index)===list.findIndex(s=>phase(s)===p)));
 document.querySelectorAll('.wj-phase').forEach(b=>b.classList.toggle('current',b.querySelector('.wj-name').textContent===p));
 const pn=$('guidedPhaseNow');if(pn)pn.textContent=p;const f=$('guidedStepFraction');if(f)f.textContent=`${String(i+1).padStart(2,'0')} / ${String(list.length).padStart(2,'0')}`;const wp=$('wjProgress');if(wp)wp.textContent=`${String(i+1).padStart(2,'0')} / ${String(list.length).padStart(2,'0')}`;
}
function init(){const track=$('carouselTrack');if(!track)return;const mo=new MutationObserver(()=>{rebuild();update()});mo.observe(track,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});rebuild();setInterval(()=>{if($('stepScreen')&&!$('stepScreen').classList.contains('hidden'))update()},250)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();