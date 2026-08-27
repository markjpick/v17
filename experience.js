/* Austral Wash Bay — experience layer.
   Enhances the existing working app without replacing its wash engine. */
(function(){
  'use strict';
  const $ = id => document.getElementById(id);

  function icon(name){
    const icons={spark:'✦',drop:'◒',shield:'⬡',timer:'◷',wind:'≈'};
    return icons[name]||'•';
  }

  function buildCommandCentre(){
    const home=$('home'); if(!home || $('commandCentre')) return;
    const hero=document.createElement('section');
    hero.id='commandCentre'; hero.className='command-centre';
    hero.innerHTML=`<div class="cc-main"><div class="cc-kicker"><span></span> WASH COMMAND CENTRE</div><h2>Ready when<br><em>the conditions are.</em></h2><p>Plan the next wash around the weather, protection cycle and products already on the car.</p><div class="cc-actions"><button class="cc-primary" id="ccNewWash">Start a wash <b>→</b></button><button class="cc-secondary" id="ccLog">View history</button></div></div><div class="cc-orbit"><div class="cc-ring r1"></div><div class="cc-ring r2"></div><div class="cc-core">${icon('spark')}<small>DETAIL</small></div><div class="cc-chip chip-weather">${icon('wind')} Weather</div><div class="cc-chip chip-protection">${icon('shield')} Protection</div></div>`;
    home.insertBefore(hero, home.firstChild);
    $('ccNewWash').onclick=()=>{ const b=$('cardTen'); if(b) b.click(); };
    $('ccLog').onclick=()=>{ const b=$('logBookBtn'); if(b) b.click(); };

    const strip=document.createElement('div'); strip.id='quickStatus'; strip.className='quick-status';
    strip.innerHTML=`<div class="quick-head"><span>AT A GLANCE</span><span class="live-dot">LIVE</span></div><div class="quick-grid" id="quickGrid"></div>`;
    const reminders=$('remindersWrap');
    if(reminders && reminders.parentNode) reminders.parentNode.insertBefore(strip, reminders.nextSibling);
  }

  function productState(key,label){
    try{
      const s=getProductStatus(key);
      if(!s || s.state==='never') return {label,value:'Not logged',state:'never'};
      if(s.state==='overdue') return {label,value:`${Math.max(0,s.daysSince-(key==='touchon'?40:180))}d overdue`,state:'overdue'};
      const cycle=key==='touchon'?40:180;
      return {label,value:`${Math.max(0,cycle-s.daysSince)} days left`,state:s.state||'ok'};
    }catch(e){ return {label,value:'—',state:'never'}; }
  }

  function renderQuickStatus(){
    const grid=$('quickGrid'); if(!grid) return;
    const items=[productState('turtlewax','Turtle Wax'),productState('touchon','Touch-On')];
    grid.innerHTML=items.map((x,i)=>`<div class="quick-item ${x.state}"><div class="quick-icon">${i?'◉':'⬡'}</div><div><small>${x.label}</small><strong>${x.value}</strong></div><span class="state-dot"></span></div>`).join('');
  }

  function addTimerDock(){
    if($('timerDock')) return;
    const dock=document.createElement('div'); dock.id='timerDock'; dock.className='timer-dock hidden';
    dock.innerHTML=`<div class="timer-dock-glow"></div><div class="timer-dock-main"><div class="timer-symbol">◷</div><div><small>DWELL TIMER</small><strong id="timerDockTitle">Product working</strong></div></div><div class="timer-digits" id="timerDockDigits">00:00</div><button class="timer-dock-toggle" id="timerDockToggle">⌄</button>`;
    document.body.appendChild(dock);
    $('timerDockToggle').onclick=()=>dock.classList.toggle('collapsed');
  }

  function watchTimers(){
    addTimerDock();
    const dock=$('timerDock'), digits=$('timerDockDigits');
    if(!dock || !digits) return;
    setInterval(()=>{
      const candidates=Array.from(document.querySelectorAll('.timer-display,.timer-value,[data-timer-display]'));
      const visible=candidates.find(el=>{const r=el.getBoundingClientRect(); return r.width&&r.height&&getComputedStyle(el).visibility!=='hidden';});
      if(visible && /\d/.test(visible.textContent)){
        digits.textContent=visible.textContent.trim(); dock.classList.remove('hidden');
        const card=visible.closest('.timer-wrap,.timer-box,.timer-card,.step-card');
        const title=card&&card.querySelector('h1,h2,h3,.step-title,.timer-title');
        if(title) $('timerDockTitle').textContent=title.textContent.trim().slice(0,34);
      }else dock.classList.add('hidden');
    },500);
  }

  function decorateSetup(){
    const setup=$('deepCleanSelect'); if(!setup || setup.querySelector('.setup-progress')) return;
    const progress=document.createElement('div'); progress.className='setup-progress';
    progress.innerHTML='<span class="active">1 <small>WASH</small></span><i></i><span>2 <small>TREAT</small></span><i></i><span>3 <small>COATING</small></span>';
    setup.insertBefore(progress, setup.firstChild);
  }

  function init(){ buildCommandCentre(); renderQuickStatus(); addTimerDock(); watchTimers(); decorateSetup(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
  window.AustralExperience={refresh:renderQuickStatus};
})();