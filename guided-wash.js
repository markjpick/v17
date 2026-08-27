/* Guided Wash Experience — presentation only; preserves existing wash engine. */
(function(){
'use strict';
const phaseIcon={
  'Preparation':'▦','Wheels':'◉','Pre-Wash':'≈','Wash':'✦','Rinse':'◒',
  'Drying':'◐','Touch-On':'⬡','Turtle Wax':'⬡','Rain-X':'◈','Finish':'✓'
};
function $(id){return document.getElementById(id)}
function visible(el){const r=el&&el.getBoundingClientRect();return !!(r&&r.width&&r.height)}
function makeRail(){if($('washRail'))return;const rail=document.createElement('div');rail.id='washRail';rail.className='wash-rail';rail.innerHTML='<div class="wash-rail-label">WASH JOURNEY</div><div id="washRailItems"></div>';const screen=$('stepScreen');if(screen)screen.insertBefore(rail,screen.firstChild)}
function readSteps(){return Array.from(document.querySelectorAll('.step-slide')).filter(visible)}
function currentStep(){const steps=readSteps();if(!steps.length)return null;return steps.reduce((best,s)=>Math.abs(s.getBoundingClientRect().left)<Math.abs(best.getBoundingClientRect().left)?s:best)}
function phaseName(step){if(!step)return 'Wash';const el=step.querySelector('.step-phase');return el?el.textContent.trim():'Wash'}
function buildRail(){makeRail();const host=$('washRailItems'),steps=readSteps();if(!host||!steps.length)return;const phases=[];steps.forEach((s,i)=>{const p=phaseName(s);if(!phases.some(x=>x.name===p))phases.push({name:p,index:i})});host.innerHTML=phases.map((p,i)=>`<button class="rail-item ${i===0?'active':''}" data-index="${p.index}"><span>${phaseIcon[p.name]||'•'}</span><b>${p.name}</b></button>`).join('');host.querySelectorAll('.rail-item').forEach(b=>b.onclick=()=>{const step=steps[Number(b.dataset.index)];if(step)step.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'})})}
function updateActive(){const step=currentStep();if(!step)return;const p=phaseName(step);document.querySelectorAll('.rail-item').forEach(b=>b.classList.toggle('active',b.querySelector('b').textContent===p));const phase=$('guidedPhaseNow');if(phase)phase.textContent=p}
function enhanceCards(){readSteps().forEach((step,i)=>{if(step.dataset.guided)return;step.dataset.guided='1';const card=step.querySelector('.step-card');if(!card)return;const phase=phaseName(step);const header=document.createElement('div');header.className='guided-step-header';header.innerHTML=`<div class="guided-phase-icon">${phaseIcon[phase]||'•'}</div><div><span>NOW IN</span><strong>${phase}</strong></div><div class="guided-step-number">${String(i+1).padStart(2,'0')}</div>`;card.insertBefore(header,card.firstChild);const warning=card.querySelector('.step-warning');if(warning&&!warning.querySelector('.guided-warning-label'))warning.insertAdjacentHTML('afterbegin','<div class="guided-warning-label">⚠ ATTENTION</div>')})}
function addMiniHud(){if($('guidedHud'))return;const hud=document.createElement('div');hud.id='guidedHud';hud.className='guided-hud';hud.innerHTML='<div><small>CURRENT PHASE</small><strong id="guidedPhaseNow">Wash</strong></div><div class="guided-hud-line"></div><div class="guided-hud-tip">Swipe or use navigation to continue</div>';const screen=$('stepScreen');if(screen)screen.appendChild(hud)}
function refresh(){enhanceCards();buildRail();updateActive();addMiniHud()}
const observer=new MutationObserver(()=>setTimeout(refresh,80));
function init(){const track=$('carouselTrack');if(track)observer.observe(track,{childList:true,subtree:true});const viewport=$('carouselViewport');if(viewport)viewport.addEventListener('scroll',updateActive,{passive:true});refresh();setInterval(()=>{const s=$('stepScreen');if(s&&!s.classList.contains('hidden'))updateActive()},700)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();