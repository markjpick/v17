/* Austral Wash Bay — completion experience layer.
   Presentation only. It does not alter completion, logging or wash selections. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
function add(){const done=$('doneScreen');if(!done||$('completionJourney'))return;const badge=done.querySelector('.dbadge');const text=$('doneText');const wrap=document.createElement('div');wrap.id='completionJourney';wrap.className='completion-journey';const now=new Date();const time=now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});wrap.innerHTML='<div class="completion-kicker">DETAILING SESSION COMPLETE</div><div class="completion-row"><div><small>STATUS</small><strong>Protected</strong></div><div><small>FINISHED</small><strong>'+time+'</strong></div></div><div class="completion-tip">Your completed wash has been recorded in the Wash Log Book.</div>';if(text)text.insertAdjacentElement('afterend',wrap);else if(badge)badge.insertAdjacentElement('afterend',wrap);}
function observe(){const done=$('doneScreen');if(!done)return;const mo=new MutationObserver(()=>{if(!done.classList.contains('hidden'))add();});mo.observe(done,{attributes:true,attributeFilter:['class']});}
function init(){add();observe();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();