# FILE: .\app.js
```
function iconSvg(key, vb){
  return '<svg viewBox="0 0 '+(vb||48)+' '+(vb||48)+'" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">'+ICONS[key]+'</svg>';
}

function toggleFullScreen() {
  const isFullScreen = document.fullscreenElement || document.webkitFullscreenElement;

  if (!isFullScreen) {
    const element = document.documentElement;
    if (element.requestFullscreen) {
      element.requestFullscreen();
    } else if (element.webkitRequestFullscreen) {
      element.webkitRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  }
}
function showFullScreen() {
    const element = document.documentElement;
    if (element.requestFullscreen) {
      element.requestFullscreen();
    } else if (element.webkitRequestFullscreen) {
      element.webkitRequestFullscreen();
    }
}

function ordinal(n){
  const rem100 = n % 100;
  if(rem100 >= 11 && rem100 <= 13) return n + 'th';
  switch(n % 10){
    case 1: return n + 'st';
    case 2: return n + 'nd';
    case 3: return n + 'rd';
    default: return n + 'th';
  }
}

/* ============================= STATE ============================= */
let currentSchedule = null;
let currentIndex = 0;
let visited = new Set();
let timerInterval = null;
let timerRemaining = 0;
let timerTotal = 0;
let timerRunning = false;
let overtimeTriggered = false;
let hasShownSwipeHint = false;
/* snowFoam: 'regular'|'deep'  coating: 'none'|'turtlewax'  glass: 'regular'|'rainx'
   touchon: null until decided mid-wash (true/false)  wheelsDeep/sillsDeep/ironFallout: bool */
let washSelections = { snowFoam: 'regular', coating: 'none', glass: 'regular', touchon: null, wheelsDeep: false, sillsDeep: false, ironFallout: false, claybarTarRemoval: false };
let setupDraft = null; /* working copy while the setup screen is open */
let pendingLogSections = []; /* sections actually confirmed on the done-screen review */

const $ = id => document.getElementById(id);

/* ---------- alarm sound ---------- */
let audioCtx = null;
let alarmInterval = null;

function ensureAudioCtx(){
  try{
    if(!audioCtx){
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if(audioCtx.state === 'suspended') audioCtx.resume();
  }catch(e){}
  return audioCtx;
}

function beep(){
  try{
    const ctx = ensureAudioCtx();
    if(!ctx) return;
    [0, 0.001].forEach((delay, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = i === 0 ? 880 : 1175;
      const t0 = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.32, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.35);
    });
  }catch(e){}
}

/* Request Notification Permissions */
if ("Notification" in window && Notification.permission !== "granted") {
  Notification.requestPermission();
}

/* Enhanced Alarm Functionality */
function startAlarm() {
  stopAlarm();
  beep();
  if (navigator.vibrate) navigator.vibrate([500, 250, 500, 250, 500]);

  // Display System Level Notification for Lockscreen/Cover window
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("Austral Wash Bay", {
      body: "⏱️ Dwell time complete! Proceed to the next rinse step.",
      icon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%231E8A9B'><circle cx='12' cy='12' r='10'/></svg>",
      requireInteraction: true
    });
  }

  alarmInterval = setInterval(() => {
    beep();
    if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
  }, 1200);
}

function stopAlarm(){
  if(alarmInterval){ clearInterval(alarmInterval); alarmInterval = null; }
}

/* ---------- info modal logic ---------- */
const infoModal = $('infoModal');

$('infoBtn').addEventListener('click', () => {
  infoModal.classList.remove('hidden');
});

// Tap anywhere on the overlay/popup to hide it and reveal current step
infoModal.addEventListener('click', () => {
  infoModal.classList.add('hidden');
});

/* ---------- theme ---------- */
function applyTheme(t){
  document.documentElement.setAttribute('data-theme', t);
  $('themeBtn').innerHTML = iconSvg(t === 'dark' ? 'sun' : 'moon', 24);
  try{ localStorage.setItem('austral-theme', t); }catch(e){}
}
(function initTheme(){
  let saved = null;
  try{ saved = localStorage.getItem('austral-theme'); }catch(e){}
  if(!saved){ saved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
  applyTheme(saved);
})();
$('themeBtn').addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme');
  applyTheme(cur === 'dark' ? 'light' : 'dark');
});

/* ---------- home ---------- */
$('backIcon').outerHTML = iconSvg('home', 24);
$('backBtn').addEventListener('click', goHome);
$('fullscreenBtn').innerHTML = iconSvg('fullscreen', 24);
$('cardTen').addEventListener('click', () => openWashSelect('regular'));
$('cardDeep').addEventListener('click', () => openWashSelect('deep'));
$('reviewBtn').addEventListener('click', () => { showStepScreen(); goToStep(currentSchedule.steps.length - 1, false); });

/* ---------- wash setup / selection screen ---------- */
function stepAllowed(step, sel){
  return step.showIf ? !!step.showIf(sel) : true;
}

function presetFor(mode){
  if(mode === 'deep'){
    return { snowFoam: 'deep', coating: 'turtlewax', glass: 'rainx', touchon: null, wheelsDeep: true, sillsDeep: true, ironFallout: false, claybarTarRemoval: false };
  }
  return { snowFoam: 'regular', coating: 'none', glass: 'regular', touchon: null, wheelsDeep: false, sillsDeep: false, ironFallout: false, claybarTarRemoval: false };
}

function openWashSelect(mode){
  setupDraft = presetFor(mode);
  setupDraft._touchon = getTouchOnFullStatus();
  /* Touch-On is a third Coating radio value ('touchon'), mutually exclusive with
     Turtle Wax by construction (it's a radio group). Only pre-select it when it's actually
     overdue and not blocked by an imminent Turtle Wax reapplication. */
  if(setupDraft.coating !== 'turtlewax' && setupDraft._touchon.state === 'overdue' && !setupDraft._touchon.blocked){
    setupDraft.coating = 'touchon';
  }
  renderSetupGroups();

  $('home').classList.add('fade-out');
  setTimeout(() => {
    $('home').classList.add('hidden');
    $('home').classList.remove('fade-out');
    /* deepCleanSelect can be left with a stale .fade-out class from a previous goHome()
       call (opacity:0, pointer-events:none), which made the setup screen appear
       blank/unusable on a second attempt. Always clear it before revealing it again. */
    $('deepCleanSelect').classList.remove('hidden', 'fade-out');
    $('topTitle').textContent = 'Wash Setup';
  }, 300);
}

/* Human-readable "since applied" phrase for a product status. Touch-On is special-cased:
   when its clock was actually reset by a Turtle Wax application (anchoredByTurtleWax),
   showing Touch-On's own "last applied" date would be misleading, since it isn't
   Touch-On's date. Used by the setup-screen due-pills and mirrors the wording already
   used in updateReminders()/renderProductMeters() so the whole app is consistent about it. */
function productLastAppliedPhrase(productKey, st){
  if(productKey === 'touchon' && st.anchoredByTurtleWax){
    return `${st.daysSince} days since Turtle Wax was applied`;
  }
  return `last applied ${st.daysSince} days ago`;
}

function dueInfoHtml(productKey){
  if(!productKey) return '';
  const st = getProductStatus(productKey);
  const cfg = PRODUCTS[productKey];
  if(st.state === 'never'){
    return `<span class="due-pill never">Never logged</span>`;
  }
  const lastPhrase = productLastAppliedPhrase(productKey, st);
  if(st.state === 'overdue'){
    return `<span class="due-pill overdue">Overdue - ${lastPhrase}</span>`;
  }
  if(st.state === 'due'){
    return `<span class="due-pill soon">Due now - ${lastPhrase}</span>`;
  }
  if(st.state === 'soon'){
    const target = cfg.targetDays || cfg.minDays;
    return `<span class="due-pill soon">Due in ~${target - st.daysSince} days<br>${lastPhrase.charAt(0).toUpperCase() + lastPhrase.slice(1)}</span>`;
  }
    const target = cfg.targetDays || cfg.minDays;
  return `<span class="due-pill ok">${lastPhrase.charAt(0).toUpperCase() + lastPhrase.slice(1)}.<br>No need to reapply for another ${target - st.daysSince} days.</span>`;
}

function dueInfoClass(productKey){
  if(!productKey) return '';
  const st = getProductStatus(productKey);
  return st.state
}

function renderSetupGroups(){
  const wrap = $('setupGroups');
  let html = '';

  /* Touch-On is a third Coating radio value, only ever shown once it's actually
     overdue (day-based, targetDays:40) and only while Turtle Wax isn't blocking it (a
     fresh Turtle Wax base coat is coming up too soon to bother topping up first). Not
     eligible right now? Make sure a stale 'touchon' selection from a previous render
     doesn't linger. */
  const touchInfo = setupDraft._touchon || (setupDraft._touchon = getTouchOnFullStatus());
  const touchOnEligible = (touchInfo.state === 'soon' || touchInfo.state === 'overdue') && !touchInfo.blocked;
  if(setupDraft.coating === 'touchon' && !touchOnEligible){
    setupDraft.coating = 'none';
  }

  SETUP_GROUPS.forEach(group => {
    html += `<div class="setup-group"><p class="setup-group-label">${group.label}</p>`;
    group.options.forEach(opt => {
      const checked = setupDraft[group.key] === opt.value;
      html += `
        <label class="radio-row${checked ? ' checked' : ''} ${opt.product ? dueInfoClass(opt.product) : ''}" data-group="${group.key}" data-value="${opt.value}">
          <div class="radio-dot"></div>
          <div class="rr-text">
            <p class="rr-title">${opt.title}</p>
            ${opt.sub ? `<p class="rr-sub">${opt.sub}</p>` : ''}
            ${opt.product ? dueInfoHtml(opt.product) : ''}
          </div>
        </label>`;
    });

    if(group.key === 'coating'){
      if(touchOnEligible){
        const checked = setupDraft.coating === 'touchon';
        html += `
          <label class="radio-row${checked ? ' checked' : ''}" data-group="coating" data-value="touchon">
            <div class="radio-dot"></div>
            <div class="rr-text">
              <p class="rr-title">Bilt Hamber Touch-On (top-up)</p>
              <p class="rr-sub">Refreshes the ceramic top layer. This improves the quality/protection of the Turtle Wax coating.</p>
              ${dueInfoHtml('touchon')}
            </div>
          </label>`;
      } else if(touchInfo.state === 'overdue' && touchInfo.blocked){
        html += `<div class="overdue-banner" style="margin:10px 0 0;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9L2.6 18a1.7 1.7 0 001.5 2.5h16a1.7 1.7 0 001.5-2.5L13.7 3.9a1.7 1.7 0 00-3.4 0z"/><path d="M12 9.5v4.2"/><circle cx="12" cy="16.7" r="0.4" fill="currentColor" stroke="none"/></svg>
          <p>Touch-On is overdue but on hold. DO NOT APPLY - A full Turtle Wax reapplication will be done in ${touchInfo.daysUntilTarget} days. </p>
        </div>`;
      } else if(touchInfo.state === 'soon'){
        const sinceText = touchInfo.anchoredByTurtleWax
          ? `${touchInfo.daysSince}d since Turtle Wax applied`
          : (touchInfo.daysSince !== null ? touchInfo.daysSince + 'd ago' : 'never');
        html += `<p class="rr-sub" style="margin:8px 2px 0;">Touch-On getting due (last applied ${sinceText}) - it'll appear here as an option once due. You may still be asked about it mid-wash based on how the water beads.</p>`;
      }
    }

    html += `</div>`;
  });

  html += `<div class="setup-group"><p class="setup-group-label">Extra Attention (as needed)</p>`;
  ADDONS.forEach(addon => {
    const checked = !!setupDraft[addon.key];
    html += `
      <label class="touchon-row select-toggle-row${checked ? ' checked' : ''}" data-addon="${addon.key}">
        <input type="checkbox" ${checked ? 'checked' : ''} data-addon-cb="${addon.key}">
        <div class="touchon-text">
          <p class="touchon-title">${addon.title}</p>
          <p class="touchon-sub">${addon.sub}</p>
        </div>
      </label>`;
  });
  html += `</div>`;

  wrap.innerHTML = html;

  wrap.querySelectorAll('.radio-row').forEach(row => {
    row.addEventListener('click', () => {
      const group = row.dataset.group, value = row.dataset.value;
      setupDraft[group] = value;
      renderSetupGroups();
    });
  });
  wrap.querySelectorAll('[data-addon-cb]').forEach(cb => {
    cb.addEventListener('click', (e) => e.stopPropagation());
    cb.addEventListener('change', () => {
      const key = cb.dataset.addonCb;
      setupDraft[key] = cb.checked;
      cb.closest('.touchon-row').classList.toggle('checked', cb.checked);
    });
  });
}

$('beginDeepCleanBtn').addEventListener('click', () => {
  washSelections = Object.assign({}, setupDraft);
  /* Touch-On selected as today's Coating choice on the setup screen -> already resolved.
     Otherwise leave it null/undecided so the mid-wash decision step can still offer it
     during the 'soon' window (see MASTER_STEPS). */
  washSelections.touchon = (setupDraft.coating === 'touchon') ? true : null;
  $('deepCleanSelect').classList.add('hidden');
  showFullScreen();
  const filteredSteps = MASTER_STEPS.filter(s => stepAllowed(s, washSelections));
  startSchedule({ key: 'wash', label: 'Car Wash', steps: filteredSteps });
});

function goHome(){
  stopTimer();
  currentSchedule = null;
  $('home').classList.remove('hidden', 'fade-out');
  $('deepCleanSelect').classList.add('hidden');
  $('deepCleanSelect').classList.remove('fade-out');
  $('stepScreen').classList.add('hidden');
  $('doneScreen').classList.add('hidden');
  $('topTitle').textContent = 'Austral Wash Bay';
}

function startSchedule(sch){
  currentSchedule = sch;
  currentIndex = 0;
  visited = new Set([0]);

  // Homescreen fade out, then first instruction slides in from right
  $('home').classList.add('fade-out');
  
  setTimeout(() => {
    $('home').classList.add('hidden');
    $('home').classList.remove('fade-out');
    
    showStepScreen();
    buildCarousel();
    buildProgressTrack();
    updateStepUI()

    // Position track at right first to slide in
    const track = $('carouselTrack');
    track.style.transition = 'none';
    track.style.transform = 'translateX(100%)';
    
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        track.style.transition = 'transform .4s cubic-bezier(.22,.61,.36,1)';
        updateCarouselPosition();
      });
    });
  }, 300);
if(!hasShownSwipeHint){
    hasShownSwipeHint = true;
    setTimeout(() => {
      const inner = $('carouselTrack');
      inner.classList.add('swipe-hint');
      setTimeout(() => inner.classList.remove('swipe-hint'), 1500);
    }, 250);
  }
}

/* Rebuilds the remaining carousel after a mid-wash decision (Touch-On yes/no) changes
   which later steps should show. Steps before currentIndex are untouched, since only
   steps after the decision point can be affected. */
function rebuildFromCurrentStep(){
  const newSteps = MASTER_STEPS.filter(s => stepAllowed(s, washSelections));
  currentSchedule.steps = newSteps;
  buildCarousel();
  buildProgressTrack();
  const track = $('carouselTrack');
  track.style.transition = 'none';
  updateCarouselPosition();
  updateStepUI();
}

function showStepScreen(){
  $('doneScreen').classList.add('hidden');
  $('stepScreen').classList.remove('hidden');
  $('topTitle').textContent = currentSchedule.label;
}

/* ---------- progress track ---------- */
function buildProgressTrack(){
  const track = $('progressTrack');
  track.innerHTML = '';
  
  let lastPhase = null;
  currentSchedule.steps.forEach((s, i) => {
    if(s.phase !== lastPhase && lastPhase !== null){
      const gap = document.createElement('div');
      gap.className = 'phase-gap';
      track.appendChild(gap);
    }
    lastPhase = s.phase;
    const dot = document.createElement('button');
    dot.className = 'dot';
    dot.dataset.idx = i;
    dot.addEventListener('click', () => { visited.add(i); goToStep(i); });
    track.appendChild(dot);
  });
  updateProgressTrack();
}

function updateProgressTrack(){
  const dots = $('progressTrack').querySelectorAll('.dot');
  dots.forEach(d => {
    const i = Number(d.dataset.idx);
    d.classList.toggle('current', i === currentIndex);
    d.classList.toggle('visited', visited.has(i) && i !== currentIndex);
  });
  const cur = $('progressTrack').querySelector('.dot.current');
  if(cur) cur.scrollIntoView({inline:'center', block:'nearest', behavior:'smooth'});
}

/* ---------- carousel & step rendering ---------- */
/* Conditional body items: a plain string is always shown. A single-key object like
   {turtle:'...'} / {noTurtle:'...'} / {rainx:'...'} / {noRainx:'...'} is only shown when
   that condition matches the current wash's product selections (washSelections). This lets
   conditional lines live inline, in order, inside the normal body: [...] array instead of
   being split into separate body_no_turtle/body_yes_turtle style lists. */
const CONDITIONAL_PREDICATES = {
  turtle: sel => sel.coating === 'turtlewax',
  noTurtle: sel => sel.coating !== 'turtlewax',
  rainx: sel => sel.glass === 'rainx',
  noRainx: sel => sel.glass !== 'rainx',
  wheelsDeep: sel => !!sel.wheelsDeep,
  sillsDeep: sel => !!sel.sillsDeep,
  ironFallout: sel => !!sel.ironFallout,
  claybarTarRemoval: sel => !!sel.claybarTarRemoval,
  snowFoamRegular: sel => sel.snowFoam !== 'deep',
  snowFoamDeep: sel => sel.snowFoam === 'deep'
};
function conditionalItemText(item, sel){
  if(item && typeof item === 'object' && !Array.isArray(item)){
    const keys = Object.keys(item);
    if(keys.length === 1 && CONDITIONAL_PREDICATES[keys[0]]){
      const key = keys[0];
      return CONDITIONAL_PREDICATES[key](sel) ? item[key] : null;
    }
  }
  return item;
}
function resolveConditionalList(items, sel){
  return items.map(item => conditionalItemText(item, sel)).filter(item => item !== null && item !== undefined);
}

function renderBodyContent(bodyData) {
  const sel = washSelections;
  if (Array.isArray(bodyData)) {
    const resolved = resolveConditionalList(bodyData, sel);
    return '<ul>' + resolved.map(item => `<li>${item}</li>`).join('') + '</ul>';
  } 
  if (typeof bodyData === 'object' && bodyData !== null) {
    let html = '<ul>';
    for (const [category, items] of Object.entries(bodyData)) {
      const resolved = resolveConditionalList(items, sel);
      html += `<li><b>${category}</b><ul>`;
      html += resolved.map(item => `<li>${item}</li>`).join('');
      html += '</ul></li>';
    }
    return html + '</ul>';
  }
  return bodyData;
}

function buildCarousel(){
  const track = $('carouselTrack');
  track.innerHTML = '';
  
  currentSchedule.steps.forEach((s, i) => {
    const slide = document.createElement('div');
    slide.className = 'step-slide' + (i === 0 ? ' active' : '');
    slide.dataset.index = i;

    let timerHtml = '';
    if(s.timerSec){
      timerHtml = `
        <div class="timer-box" id="timerBox-${i}">
          <div class="timer-ring">
            <svg viewBox="0 0 46 46">
              <circle class="bg" cx="23" cy="23" r="19"></circle>
              <circle class="fg" id="timerFg-${i}" cx="23" cy="23" r="19"></circle>
            </svg>
            <div class="tlabel num" id="timerLabelSmall-${i}">${fmt(s.timerSec)}</div>
          </div>
          <div class="timer-info">
            <div class="tname-row">
              <p class="tname" id="timerName-${i}">${s.timerLabel || 'Dwell time'}</p>
              ${s.timerRange ? `<span class="timer-range-badge">${s.timerRange}</span>` : ''}
            </div>
            <p class="tdur num" id="timerDur-${i}">${fmt(s.timerSec)} remaining</p>
          </div>
          <button class="timer-btn" id="timerBtn-${i}">Start</button>
          <button class="timer-dismiss hidden" id="timerDismiss-${i}">Dismiss</button>
        </div>`;
    }

    let warningHtml = '';
    if(s.warning){
      warningHtml = `
        <div class="callout">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9L2.6 18a1.7 1.7 0 001.5 2.5h16a1.7 1.7 0 001.5-2.5L13.7 3.9a1.7 1.7 0 00-3.4 0z"/><path d="M12 9.5v4.2"/><circle cx="12" cy="16.7" r="0.4" fill="currentColor" stroke="none"/></svg>
          <p>${s.warning}</p>
        </div>`;
    }

    const isLastStep = (i === currentSchedule.steps.length - 1);
    let finishHtml = '';
    if(isLastStep && s.type !== 'decision'){
      finishHtml = `<button class="finish-btn" id="finishBtn">Complete Wash ${iconSvg('check', 24)}</button>`;
    }

    let decisionHtml = '';
    if(s.type === 'decision'){
      decisionHtml = `
        <div class="decision-btns">
          <button class="decision-btn no" id="decisionNo-${i}">${s.noLabel || 'No'}<br><span style="font-size:11px; font-weight:500; opacity:.75;">${s.noSub || ''}</span></button>
          <button class="decision-btn yes" id="decisionYes-${i}">${s.yesLabel || 'Yes'}<br><span style="font-size:11px; font-weight:500; opacity:.75;">${s.yesSub || ''}</span></button>
        </div>`;
    }

    let noteHtml = '';
    if(typeof s.noteFn === 'function'){
      noteHtml = s.noteFn(washSelections) || '';
    }

    slide.innerHTML = `
      <div class="phase-eyebrow">${s.phase}</div>
      <div class="step-head">
        <div class="step-icon">${iconSvg(s.icon, 48)}</div>
        <div class="step-title">${s.title}</div>
      </div>
      ${noteHtml}
      <div class="step-body">${renderBodyContent(s.body)}</div>
      ${decisionHtml}
      ${timerHtml}
      ${warningHtml}
      ${finishHtml}
    `;

    if(isLastStep && s.type !== 'decision'){
      slide.querySelector('#finishBtn').addEventListener('click', finishWash);
    }

    if(s.type === 'decision'){
      slide.querySelector(`#decisionYes-${i}`).addEventListener('click', () => answerTouchOnDecision(true));
      slide.querySelector(`#decisionNo-${i}`).addEventListener('click', () => answerTouchOnDecision(false));
    }

    slide.addEventListener('scroll', checkScrollCue);
    track.appendChild(slide);
  });
  
  setupCurrentSlideTimer();
}

/* Answers the mid-wash Touch-On decision, rebuilds the remaining carousel to insert/omit
   the Touch-On steps, then lands on the first step after the decision point.

   IMPORTANT: the decision step itself is REMOVED from the rebuilt list (its showIf now
   requires washSelections.touchon to still be null, which it no longer is). That means
   every step from the old decision index onward shifts back by one position in the new
   array - the step that's physically next after the decision (the Touch-On application
   step if answer=true, or the next regular step if answer=false) now SITS AT the old
   decision index, not decisionIndex + 1. Landing on decisionIndex + 1 after the rebuild
   skips over it (this was the bug where tapping "Yes" jumped straight to "Rinse off" and
   skipped the "Touch-On application" step) - so we land on decisionIndex itself. */
function answerTouchOnDecision(answer){
  washSelections.touchon = answer;
  const decisionIndex = currentIndex;
  rebuildFromCurrentStep();
  currentIndex = decisionIndex;
  goToStep(Math.min(decisionIndex, currentSchedule.steps.length - 1), false);
}

/* All section keys that could plausibly be part of a wash, for the done-screen review list. */
const ALL_SECTION_LABELS = Object.assign({},
  Object.fromEntries(Object.entries(PRODUCTS).map(([k, v]) => [k, v.label])),
  NONTIMER_SECTIONS
);

function sectionsInThisWash(){
  const present = new Set();
  currentSchedule.steps.forEach(s => { if(s.section) present.add(s.section); });
  return Array.from(present);
}

function finishWash(){
  stopTimer();
  $('stepScreen').classList.add('hidden');
  $('doneScreen').classList.remove('hidden');
  $('doneText').textContent = 'Nice work. Confirm what was actually applied below, then hit Done to log this wash.';

  pendingLogSections = sectionsInThisWash();
  const wrap = $('reviewList');

  if(pendingLogSections.length === 0){
    $('reviewListNote').textContent = '';
    wrap.innerHTML = '';
    return;
  }
  $('reviewListNote').textContent = 'Uncheck anything you skipped or didn\'t need - it won\'t be logged or reset its timer.';
  wrap.innerHTML = pendingLogSections.map(key => `
    <label class="review-item checked" data-section="${key}">
      <input type="checkbox" checked data-review-cb="${key}">
      <p class="ri-title">${ALL_SECTION_LABELS[key] || key}</p>
    </label>`).join('');

  wrap.querySelectorAll('[data-review-cb]').forEach(cb => {
    cb.addEventListener('click', e => e.stopPropagation());
    cb.addEventListener('change', () => {
      cb.closest('.review-item').classList.toggle('checked', cb.checked);
    });
  });
}

function updateCarouselPosition(offsetPx = 0){
  const track = $('carouselTrack');
  const slideWidth = $('carouselViewport').offsetWidth || window.innerWidth;
  const targetX = -(currentIndex * slideWidth) + offsetPx;
  
  track.style.transform = `translateX(${targetX}px)`;
  
  const slides = track.querySelectorAll('.step-slide');
  slides.forEach((slide, idx) => {
    slide.classList.toggle('active', idx === currentIndex);
  });
}

function updateStepUI(){
  const s = currentSchedule.steps[currentIndex];
  //$('stepCounter').textContent = 'Step ' + (currentIndex + 1) + ' of ' + currentSchedule.steps.length;

  // $('prevBtn').disabled = (currentIndex === 0);
  // const nextBtn = $('nextBtn');
  // const isLast = (currentIndex === currentSchedule.steps.length - 1);
  // nextBtn.classList.toggle('finish', isLast);
  // nextBtn.innerHTML = isLast
  //   ? 'Finish ' + iconSvg('check', 24)
  //   : 'Next ' + iconSvg('chevL', 24).replace('<svg', '<svg style="transform:rotate(180deg)"');

  $('progPhase').textContent = s.phase;
  $('progFrac').textContent = (currentIndex + 1) + ' / ' + currentSchedule.steps.length;
  updateProgressTrack();
  
  // Scroll current slide to top
  const activeSlide = $('carouselTrack').children[currentIndex];
  if(activeSlide) activeSlide.scrollTop = 0;
  
  checkScrollCue();
  setupCurrentSlideTimer();
}

function goToStep(index, animate = true){
  if(index < 0 || index >= currentSchedule.steps.length) return;
  stopTimer();
  currentIndex = index;
  visited.add(index);
  
  const track = $('carouselTrack');
  if(animate){
    track.style.transition = 'transform .35s cubic-bezier(.22,.61,.36,1)';
  } else {
    track.style.transition = 'none';
  }
  
  updateCarouselPosition();
  updateStepUI();
}

function checkScrollCue(){
  const activeSlide = $('carouselTrack').children[currentIndex];
  if(!activeSlide) return;
  const needsScroll = activeSlide.scrollHeight > activeSlide.clientHeight + 12;
  const atBottom = activeSlide.scrollTop + activeSlide.clientHeight >= activeSlide.scrollHeight - 10;
  $('scrollCue').classList.toggle('hidden', !needsScroll || atBottom);
}

//$('prevBtn').addEventListener('click', () => { if(currentIndex > 0) goToStep(currentIndex - 1); });
// $('nextBtn').addEventListener('click', () => {
//   if(currentIndex < currentSchedule.steps.length - 1){
//     goToStep(currentIndex + 1);
//   } else {
//     stopTimer();
//     $('stepScreen').classList.add('hidden');
//     $('doneScreen').classList.remove('hidden');
//     $('doneText').textContent = currentSchedule.label + ' - all ' + currentSchedule.steps.length + ' steps done. Nice work.';
//   }
// });

/* ---------- continuous swipe setup ---------- */
(function setupContinuousSwipe(){
  const viewport = $('carouselViewport');
  const track = $('carouselTrack');
  let startX = 0, startY = 0, dx = 0, dy = 0;
  let dragging = false, intentDecided = false, isHorizontal = false;

  viewport.addEventListener('touchstart', e => {
    if(!currentSchedule) return;
    if(e.target.closest('button, .dot, .timer-btn, .timer-dismiss')) return;
    const t = e.touches[0];
    startX = t.clientX; startY = t.clientY; dx = 0; dy = 0;
    dragging = true; intentDecided = false; isHorizontal = false;
    track.style.transition = 'none';
  }, {passive:true});

  viewport.addEventListener('touchmove', e => {
    if(!dragging) return;
    const t = e.touches[0];
    dx = t.clientX - startX; dy = t.clientY - startY;
    
    if(!intentDecided && (Math.abs(dx) > 8 || Math.abs(dy) > 8)){
      isHorizontal = Math.abs(dx) > Math.abs(dy);
      intentDecided = true;
    }
    
    if(isHorizontal){
      if(e.cancelable) e.preventDefault();
      let damped = dx;
      const atStart = currentIndex === 0 && dx > 0;
      const atEnd = currentIndex === currentSchedule.steps.length - 1 && dx < 0;
      if(atStart || atEnd) damped = dx * 0.28;
      
      updateCarouselPosition(damped);
    }
  }, {passive:false});

  function endSwipe(){
    if(!dragging) return;
    dragging = false;
    if(!isHorizontal) return;
    
    const threshold = viewport.offsetWidth * 0.22;
    track.style.transition = 'transform .32s cubic-bezier(.22,.61,.36,1)';
    
    if(dx <= -threshold && currentIndex < currentSchedule.steps.length - 1){
      goToStep(currentIndex + 1);
    } else if(dx >= threshold && currentIndex > 0){
      goToStep(currentIndex - 1);
    } else {
      updateCarouselPosition(0);
    }
  }

  viewport.addEventListener('touchend', endSwipe);
  viewport.addEventListener('touchcancel', endSwipe);
})();

/* ---------- dwell timer ---------- */
function fmt(sec){
  const m = Math.floor(sec / 60), s = sec % 60;
  return m + ':' + String(s).padStart(2, '0');
}

function setupCurrentSlideTimer(){
  const s = currentSchedule.steps[currentIndex];
  if(!s || !s.timerSec) return;
  
  const i = currentIndex;
  timerTotal = s.timerSec;
  timerRemaining = s.timerSec;
  timerRunning = false;
  overtimeTriggered = false;
  stopAlarm();

  const btn = $(`timerBtn-${i}`);
  if(!btn) return;

  $(`timerLabelSmall-${i}`).textContent = fmt(timerTotal);
  $(`timerDur-${i}`).textContent = fmt(timerRemaining) + ' remaining';

  const fg = $(`timerFg-${i}`);
  const r = 19, circ = 2 * Math.PI * r;
  fg.style.strokeDasharray = circ;
  fg.style.strokeDashoffset = 0;

  btn.textContent = 'Start';
  btn.classList.remove('running', 'done');
  btn.onclick = toggleTimer;

  $(`timerBox-${i}`).classList.remove('alarm');
  $(`timerDismiss-${i}`).classList.add('hidden');
  $(`timerDismiss-${i}`).onclick = () => {
    stopAlarm();
    $(`timerBox-${i}`).classList.remove('alarm');
    $(`timerDismiss-${i}`).classList.add('hidden');
  };
}

function toggleTimer(){
  if(timerRunning){ pauseTimer(); } else { playTimer(); }
}

function playTimer(){
  ensureAudioCtx();
  timerRunning = true;
  const i = currentIndex;
  const btn = $(`timerBtn-${i}`);
  btn.textContent = 'Pause';
  btn.classList.add('running');
  btn.classList.remove('done');

  const r = 19, circ = 2 * Math.PI * r;

  timerInterval = setInterval(() => {
    timerRemaining--;

    if (timerRemaining <= 0 && !overtimeTriggered) {
      overtimeTriggered = true;
      $(`timerBox-${i}`).classList.add('alarm');
      $(`timerDismiss-${i}`).classList.remove('hidden');
      startAlarm();
    }

    if (timerRemaining >= 0) {
      $(`timerDur-${i}`).textContent = fmt(timerRemaining) + ' remaining';
      $(`timerFg-${i}`).style.strokeDashoffset = circ * (1 - timerRemaining / timerTotal);
    } else {
      const overtimeSec = Math.abs(timerRemaining);
      $(`timerDur-${i}`).textContent = '+' + fmt(overtimeSec) + ' overtime';
      $(`timerFg-${i}`).style.strokeDashoffset = circ;
      btn.classList.add('done');
    }
  }, 1000);
}

function pauseTimer(){
  timerRunning = false;
  clearInterval(timerInterval);
  const btn = $(`timerBtn-${currentIndex}`);
  if(btn){
    btn.textContent = 'Resume';
    btn.classList.remove('running');
  }
}

function stopTimer(){
  clearInterval(timerInterval);
  timerInterval = null;
  timerRunning = false;
  stopAlarm();
}

window.addEventListener('resize', () => { 
  if(currentSchedule) {
    updateCarouselPosition();
    checkScrollCue(); 
  }
});

/* ---------- keyboard arrow navigation (desktop) ---------- */
document.addEventListener('keydown', (e) => {
  if(!currentSchedule) return;
  if($('stepScreen').classList.contains('hidden')) return;
  const tag = (e.target && e.target.tagName || '').toLowerCase();
  if(tag === 'input' || tag === 'textarea' || tag === 'select') return;

  if(e.key === 'ArrowRight'){
    e.preventDefault();
    if(currentIndex < currentSchedule.steps.length - 1){
      goToStep(currentIndex + 1);
    } else {
      finishWash();
    }
  } else if(e.key === 'ArrowLeft'){
    e.preventDefault();
    if(currentIndex > 0) goToStep(currentIndex - 1);
  }
});





const calcProduct = $('calcProduct');
const calcRatio = $('calcRatio');
const calcSize = $('calcSize');
const calcResult = $('calcResult');

function updateRatioOptions() {
  const selected = calcProduct.value;
  const productData = RATIOS[selected];

  // Pre-populate container size based on selected product
  if (productData && productData.defaultSize) {
    calcSize.value = productData.defaultSize;
  }

  calcRatio.innerHTML = productData.options.map((r, i) => `<option value="${i}">${r.label}</option>`).join('');
  calculateDilution();
}

function calculateDilution() {
  const prod = calcProduct.value;
  const ratioIdx = calcRatio.value || 0;
  const totalMl = parseFloat(calcSize.value) || 0;
  
  const productData = RATIOS[prod];
  const ratioConfig = productData.options[ratioIdx];

  if (totalMl <= 0) {
    calcResult.innerHTML = "<em>Enter a valid container size.</em>";
    return;
  }

  // 1. Calculate precise volume allocations (ml)
  const totalParts = ratioConfig.parts + 1;
  const exactProductMl = totalMl / totalParts;
  const exactWaterMl = totalMl - exactProductMl;

  // 2. Convert to exact weights (grams)
  const exactProductGrams = exactProductMl * productData.density;
  const exactWaterGrams = exactWaterMl; // Water density is 1.0

  // 3. Round everything to the nearest whole number for the UI
  const productMl = Math.round(exactProductMl);
  const waterMl = Math.round(exactWaterMl);
  const productGrams = Math.round(exactProductGrams);
  const waterGrams = Math.round(exactWaterGrams);
  
  // 4. Calculate Total Mix Weight Tracker
  const totalWeightGrams = productGrams + waterGrams;

  calcResult.innerHTML = `
    <strong>Required Mix:</strong><br>
    • Product: <b>${productGrams} g</b> (${productMl} ml)<br>
    • Water: <b>${waterGrams} g</b> (${waterMl} ml of ${ratioConfig.water} water)<br>
    <hr style="margin: 8px 0; border: 0; border-top: 1px solid #ccc;">
    ⚖️ <b>Total Target Mix Weight: ${totalWeightGrams} g</b><br>
    <small style="color: #666;">(Put empty bottle on scale, tare to 0g, and fill until scale reads this total number)</small>
  `;
}

$('calcBtn').addEventListener('click', () => $('calcModal').classList.remove('hidden'));
$('calcModal').addEventListener('click', (e) => { if (e.target === $('calcModal')) $('calcModal').classList.add('hidden'); });
calcProduct.addEventListener('change', updateRatioOptions);
calcRatio.addEventListener('change', calculateDilution);
calcSize.addEventListener('input', calculateDilution);
updateRatioOptions();



//--------------


/* ============================= LOCATION (hard-coded) ============================= */
/* The car is only ever washed at the same spot, so the coordinates are fixed here
   rather than requested from the browser (which also can't work when this file is
   opened locally, without HTTPS). */
const HOME_LOCATION = { lat: 53.59573, lon: -1.32076 };

/* ============================= WEATHER CLASSIFICATION HELPERS ============================= */
function classifyHour(rain, temp){
  if(rain < WASH_RULES.MIN_RAIN && temp >= WASH_RULES.MIN_TEMP && temp <= WASH_RULES.MAX_TEMP) return 'ideal';
  if(rain < WASH_RULES.MAX_RAIN && temp >= WASH_RULES.MIN_TEMP && temp <= WASH_RULES.MAX_TEMP) return 'marginal';
  return 'bad';
}
function fmtDateKey(d){
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function weatherIcon(cls){
  return cls === 'ideal' ? '✅' : (cls === 'marginal' ? '⚠️' : '❌');
}

/* Maps an Open-Meteo/WMO weather code (+ day/night flag) to a colour emoji glyph.
   Native emoji render in full colour with no extra assets or network requests,
   which also makes "cloudy" clearly distinct from "rain" at a glance. */
function weatherEmoji(code, isDay){
  const day = isDay !== 0;
  const map = {
    0: day ? '☀️' : '🌙',
    1: day ? '🌤️' : '🌙',
    2: day ? '⛅' : '☁️',
    3: '☁️',
    45: '🌫️', 48: '🌫️',
    51: '🌦️', 53: '🌦️', 55: '🌦️',
    56: '🌧️', 57: '🌧️',
    61: '🌧️', 63: '🌧️', 65: '🌧️',
    66: '🌧️', 67: '🌧️',
    71: '🌨️', 73: '🌨️', 75: '❄️',
    77: '❄️',
    80: '🌦️', 81: '🌧️', 82: '🌧️',
    85: '🌨️', 86: '🌨️',
    95: '⛈️', 96: '⛈️', 99: '⛈️'
  };
  return map[code] || (day ? '⛅' : '☁️');
}

/* Build hourly rows (array of {hour, rain, temp, code, isDay, cls}) for a given date, hours 9-18,
   excluding hours before "now" when the date is today. */
function hourlyRowsForDate(hourlyData, dateObj, restrictToNow){
  const dateKey = fmtDateKey(dateObj);
  const nowHour = new Date().getHours();
  const rows = [];
  hourlyData.time.forEach((t, idx) => {
    const [dPart, tPart] = t.split('T');
    if(dPart !== dateKey) return;
    const hour = parseInt(tPart.slice(0,2), 10);
    if(hour < WASH_RULES.START_HOUR || hour >= WASH_RULES.END_HOUR) return;
    if(restrictToNow && hour < nowHour) return;
    const rain = hourlyData.precipitation_probability[idx];
    const temp = hourlyData.temperature_2m[idx];
    const code = hourlyData.weathercode ? hourlyData.weathercode[idx] : 0;
    const isDay = hourlyData.is_day ? hourlyData.is_day[idx] : 1;
    rows.push({ hour, rain, temp, code, isDay, cls: classifyHour(rain, temp) });
  });
  return rows;
}

/* Builds the two-line headline/subline status text shown at the top of the weather card.
   "isToday" switches between live "right now" phrasing and a day-level summary for future dates. */
function buildWeatherSummary(rows, isToday){
  const pad = h => String(h).padStart(2, '0') + ':00';

  if(rows.length === 0){
    return {
      headline: isToday ? 'No wash hours remaining today' : 'No forecast data for this date',
      subline: ''
    };
  }

  function runLengthFrom(idx, cls){
    let n = 0;
    for(let i = idx; i < rows.length; i++){ if(rows[i].cls === cls) n++; else break; }
    return n;
  }

  // Longest consecutive run of a given class anywhere in the day, with its start index.
  // Used to fall back to "acceptable" (marginal) hours on days with no ideal window at all -
  // this is what drives the messaging on orange calendar days.
  function bestRun(cls){
    let bestStart = -1, bestLen = 0, i = 0;
    while(i < rows.length){
      if(rows[i].cls === cls){
        let j = i;
        while(j < rows.length && rows[j].cls === cls) j++;
        if(j - i > bestLen){ bestLen = j - i; bestStart = i; }
        i = j;
      } else i++;
    }
    return { start: bestStart, len: bestLen };
  }

  const rainVals = rows.map(r => r.rain);
  const rainRange = `Rain chance ranges from ${Math.min(...rainVals)}% to ${Math.max(...rainVals)}% over the day`;

  if(isToday){
    if(rows[0].cls === 'ideal'){
      const streak = runLengthFrom(0, 'ideal');
      const nextIdx = streak;
      let subline = 'Conditions stay good for the rest of the day';
      if(nextIdx < rows.length){
        const t = rows[nextIdx];
        const dir = t.rain > rows[0].rain ? 'increases' : (t.rain < rows[0].rain ? 'decreases' : 'changes to');
        subline = `Rain chance ${dir} to ${t.rain}% at ${pad(t.hour)}`;
      }
      return { headline: `Perfect conditions for car washing for the next ${streak} hour${streak === 1 ? '' : 's'}`, subline };
    }
    const idx = rows.findIndex(r => r.cls === 'ideal');
    if(idx === -1){
      const marginal = bestRun('marginal');
      if(marginal.len > 0){
        return {
          headline: `Poor conditions right now, but it may be acceptable from ${pad(rows[marginal.start].hour)}`,
          subline: rainRange
        };
      }
      return {
        headline: 'Today there is no good time to wash the car',
        subline: rainRange
      };
    }
    const run = runLengthFrom(idx, 'ideal');
    const dir = rows[idx].rain < rows[0].rain ? 'decreases' : (rows[idx].rain > rows[0].rain ? 'increases' : 'changes to');
    return {
      headline: `Wait until ${pad(rows[idx].hour)} for ${run}+ hour${run === 1 ? '' : 's'} of perfect conditions`,
      subline: `Rain chance ${dir} to ${rows[idx].rain}% at ${pad(rows[idx].hour)}`
    };
  }

  // Future day - day-level summary, no "right now"/"wait until" language.
  const ideal = bestRun('ideal');
  if(ideal.len > 0){
    return { headline: `Good conditions from ${pad(rows[ideal.start].hour)} for ${ideal.len}+ hour${ideal.len === 1 ? '' : 's'}`, subline: rainRange };
  }
  const marginal = bestRun('marginal');
  if(marginal.len > 0){
    return {
      headline: `Poor conditions today, but at ${pad(rows[marginal.start].hour)} it might be acceptable`,
      subline: rainRange
    };
  }
  return { headline: 'No good time to wash the car this day', subline: rainRange };
}

/* Renders the summary header + horizontal hour strip. Used for both the home "Wash Conditions"
   card and the calendar day pop-up. */
function renderWeatherCard(rows, opts){
  opts = opts || {};
  const summary = buildWeatherSummary(rows, !!opts.isToday);
  const first = rows[0];

  const nowIconHtml = first
    ? `<span class="wx-now-icon">${weatherEmoji(first.code, first.isDay)}</span>`
    : `<span class="wx-now-icon">❓</span>`;
  const nowTempHtml = first ? `${Math.round(first.temp)}<sup>°C</sup>` : '--';

  const stripHtml = rows.length
    ? `<div class="wx-strip">` + rows.map((r, idx) => `
      <div class="weather-card ${r.cls}${(opts.isToday && idx === 0) ? ' now' : ''}">
      <div class="card-sidebar">
        <div class="status-icon ${r.cls}">${weatherIcon(r.cls)}</div>
        <div class="time-text"><b>${String(r.hour).padStart(2, '0')}</b>00</div>
      </div>
      <div class="card-content ${r.cls}">
        <div class="weather-icon">${weatherEmoji(r.code, r.isDay)}</div>
        <div class="temperature-wrapper">
          <span class="temp-text">${Math.round(r.temp)}<span class="degree-symbol">°c</span></span>
        </div>
        <div class="rain-probability">
          <div class="drop-icon"></div>
          <span>${r.rain}%</span>
        </div>
      </div>
    </div>`).join('') + `</div>`
    : '';

  return `
    <div class="wx-summary-row">
      <div class="wx-now-block">${nowIconHtml}<span class="wx-now-temp num">${nowTempHtml}</span></div>
      <div class="wx-location-block">South Kirkby</div>
      <div class="wx-day-block">
        <p class="wx-day-eyebrow">Weather</p>
        <p class="wx-day-name">${opts.dayLabel || ''}</p>
      </div>
    </div>
    <div class="wx-headline-row">
      <p class="wx-headline">${summary.headline}</p>
      ${summary.subline ? `<p class="wx-subline">${summary.subline}</p>` : ''}
    </div>
    ${stripHtml}
  `;
}

function dayStatusForDate(hourlyData, dateObj, isToday){
  const rows = hourlyRowsForDate(hourlyData, dateObj, isToday);
  if(rows.length === 0) return 'unknown';
  if(rows.some(r => r.cls === 'ideal')) return 'green';
  if(rows.some(r => r.cls === 'marginal')) return 'orange';
  return 'red';
}

/* ============================= WEATHER FETCH ============================= */
async function fetchWashWeather(){
  $('weatherDetails').innerHTML = '<div class="wx-empty-msg">Loading wash conditions...</div>';

  try{
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${HOME_LOCATION.lat}&longitude=${HOME_LOCATION.lon}&hourly=temperature_2m,precipitation_probability,weathercode,is_day&forecast_days=16&timezone=auto`);
    const data = await res.json();
    window.cachedWeatherData = data;

    const now = new Date();
    const rows = hourlyRowsForDate(data.hourly, now, true);
    const dayLabel = now.toLocaleDateString([], { weekday: 'long' });

    $('weatherDetails').innerHTML = renderWeatherCard(rows, { isToday: true, dayLabel });

    buildCalendar(data.hourly);
    updateReminders();

  }catch(e){
    $('weatherDetails').innerHTML = '<div class="wx-empty-msg">Could not load forecast data.</div>';
  }
}

/* ============================= WASH CYCLE LOGIC ============================= */
function addDays(date, n){ const d = new Date(date); d.setDate(d.getDate() + n); return d; }
function addMonths(date, n){ const d = new Date(date); d.setMonth(d.getMonth() + n); return d; }

function getMostRecentLog(logs){ return logs.length ? logs[0] : null; }

/* Next 10-day target: 10 days after the most recent wash of ANY kind
   (any wash - including add-on products - counts and refreshes this cycle). */
function getNext10DayTarget(logs){
  const last = getMostRecentLog(logs);
  return last ? addDays(new Date(last.date), 10) : null;
}

/* ============================= PRODUCT REMINDER TRACKING ============================= */
/* Normalises a stored log entry to always have a `.sections` array, converting older
   flat touchOn/turtle/rainx boolean formats. */
function normalizeLog(l){
  if(l.sections) return l;
  const sections = [];
  if(l.touchOn) sections.push('touchon');
  if(l.turtle) sections.push('turtlewax');
  if(l.rainx) sections.push('rainx');
  return Object.assign({}, l, { sections });
}

/* Status for a tracked product: when it was last applied, days since, and whether it's
   ok / coming up soon (~2 washes / HOW_SOON_DAYS out) / due / overdue.
   Touch-On ('touchon') is special-cased - its "last applied" also counts the most
   recent Turtle Wax application, since a fresh base coat resets the top-coat clock too
   (nothing to top up yet). `anchoredByTurtleWax` flags when that's what actually happened,
   so callers (the product meter, due-pills, mid-wash notes) can adjust their wording. */
function getProductStatus(key, logs){
  logs = (logs || getLogs());
  const cfg = PRODUCTS[key];
  const last = (key === 'touchon')
    ? logs.find(l => l.sections.includes('touchon') || l.sections.includes('turtlewax'))
    : logs.find(l => l.sections.includes(key));
  if(!last) return { key, last: null, daysSince: null, state: 'never', anchoredByTurtleWax: false };
  const daysSince = Math.floor((new Date() - new Date(last.date)) / 86400000);
  let state;
  if(cfg.targetDays){
    /* Single fixed-date model (Turtle Wax, Touch-On): a warning window `warnDays`
       before the target, and overdue after it. */
    if(daysSince > cfg.targetDays) state = 'overdue';
    else if(daysSince >= cfg.targetDays - cfg.warnDays) state = 'soon';
    else state = 'ok';
  } else {
    if(daysSince > cfg.maxDays) state = 'overdue';
    else if(daysSince >= cfg.minDays) state = 'due';
    else if(daysSince >= cfg.minDays - HOW_SOON_DAYS) state = 'soon';
    else state = 'ok';
  }
  const anchoredByTurtleWax = key === 'touchon' && last.sections.includes('turtlewax') && !last.sections.includes('touchon');
  return { key, last: last.date, daysSince, state, anchoredByTurtleWax };
}

/* ============================= TOUCH-ON DAY-BASED TRACKING ============================= */
/* Whether Touch-On should be blocked because Turtle Wax reapplication is coming up
   within the block window - applying a fresh top-coat right before stripping/redoing
   the base coat defeats the point. */
function getTurtlewaxBlockInfo(logs){
  logs = logs || getLogs();
  const st = getProductStatus('turtlewax', logs);
  if(st.state === 'never') return { blocked: false, daysUntilTarget: null };
  const daysUntilTarget = PRODUCTS.turtlewax.targetDays - st.daysSince;
  return { blocked: daysUntilTarget <= TOUCHON_BLOCK_DAYS_BEFORE_TURTLEWAX, daysUntilTarget };
}

/* Combines Touch-On's own day-based status with the Turtle Wax block check into the
   single status object the UI needs (setup screen, mid-wash decision, reminders). */
function getTouchOnFullStatus(logs){
  logs = logs || getLogs();
  const st = getProductStatus('touchon', logs);
  const twBlock = getTurtlewaxBlockInfo(logs);
  return Object.assign({}, st, twBlock);
}

/* Last-applied info for a non-timer section (Wheels Deep, Sills Deep, Iron Fallout,
   Clay Bar) - shown in the wash-log detail only, no home-screen reminder. */
function getSectionLastApplied(key, logs){
  logs = (logs || getLogs());
  const last = logs.find(l => l.sections.includes(key));
  if(!last) return null;
  const daysSince = Math.floor((new Date() - new Date(last.date)) / 86400000);
  return { last: last.date, daysSince };
}

function bannerHtml(text, cls){
  return `
    <div class="overdue-banner ${cls || ''}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9L2.6 18a1.7 1.7 0 001.5 2.5h16a1.7 1.7 0 001.5-2.5L13.7 3.9a1.7 1.7 0 00-3.4 0z"/><path d="M12 9.5v4.2"/><circle cx="12" cy="16.7" r="0.4" fill="currentColor" stroke="none"/></svg>
      <p>${text}</p>
    </div>`;
}

function updateReminders(){
  const logs = getLogs();
  const wrap = $('remindersWrap');
  let html = '';

  Object.keys(PRODUCTS).forEach(key => {
    if(key === 'touchon') return; /* handled separately below - interacts with the Turtle Wax block */
    const st = getProductStatus(key, logs);
    if(st.state !== 'soon' && st.state !== 'due' && st.state !== 'overdue') return;
    const cfg = PRODUCTS[key];
    const cls = st.state === 'soon' ? 'soon' : '';
    let text;
    if(cfg.targetDays){
      /* Fixed-date model (Turtle Wax): warning window before the target, urgent past it. */
      if(st.state === 'overdue'){
        const daysOver = st.daysSince - cfg.targetDays;
        text = `<b>${cfg.shortLabel} overdue - you really need to do this now.</b> It's ${daysOver} day${daysOver === 1 ? '' : 's'} past the ${cfg.targetDays}-day mark (last applied ${st.daysSince} days ago).`;
      } else {
        const daysUntil = cfg.targetDays - st.daysSince;
        text = `<b>${cfg.shortLabel} coming up</b> - due for reapplication in around ${daysUntil} day${daysUntil === 1 ? '' : 's'}.`;
      }
    } else if(st.state === 'overdue'){
      const daysOver = st.daysSince - cfg.maxDays;
      text = `<b>${cfg.shortLabel} overdue</b> - last applied ${st.daysSince} days ago (${daysOver}d past the recommended window).`;
    } else if(st.state === 'due'){
      text = `<b>${cfg.shortLabel} due</b> - it's been ${st.daysSince} days since it was last applied.`;
    } else {
      const daysUntil = cfg.minDays - st.daysSince;
      text = `<b>${cfg.shortLabel} coming up</b> - due in around ${daysUntil} day${daysUntil === 1 ? '' : 's'}. Worth checking this wash if it can wait a little longer.`;
    }
    html += bannerHtml(text, st.state);
  });

  /* Touch-On: same day-based model as everything else, but the message needs to account
     for the Turtle Wax block, and for a fresh Turtle Wax application having reset its
     clock (rather than Touch-On itself). This is also the "fallback": if washes fall
     behind schedule (weather, etc), daysSince keeps counting regardless, so this reaches
     'overdue' on its own after 40 days even with no wash logged in between. */
  const touchSt = getTouchOnFullStatus(logs);
  if(touchSt.state === 'soon' || touchSt.state === 'overdue'){
    const lastLabel = touchSt.anchoredByTurtleWax ? 'since Turtle Wax was applied' : 'since it was last applied';
    if(touchSt.blocked){
      html += bannerHtml(`<b>Touch-On on hold</b> - it would normally be due soon (${touchSt.daysSince}d ${lastLabel}), but Turtle Wax reapplication is due in around ${touchSt.daysUntilTarget}d. Hold off on Touch-On until the new coating is applied.`, '');
    } else if(touchSt.state === 'overdue'){
      const daysOver = touchSt.daysSince - PRODUCTS.touchon.targetDays;
      html += bannerHtml(`<b>Touch-On overdue - you really need to do this now.</b> It's ${daysOver} day${daysOver === 1 ? '' : 's'} past the ${PRODUCTS.touchon.targetDays}-day mark (${touchSt.daysSince}d ${lastLabel}). It'll be pre-selected as a Coating option on the wash setup screen.`, '');
    } else {
      const daysUntil = PRODUCTS.touchon.targetDays - touchSt.daysSince;
      html += bannerHtml(`<b>Touch-On coming up</b> - due for reapplication in around ${daysUntil} day${daysUntil === 1 ? '' : 's'} (${touchSt.daysSince}d ${lastLabel}).`, 'soon');
    }
  }

  wrap.innerHTML = html;
}

/* ============================= CALENDAR ============================= */
/* Returns which schedule targets apply to a given date. Shared between the calendar
   grid cells and the day detail modal so the labelling always stays in sync. */
function getDateMarkers(dateObj, logs){
  logs = logs || getLogs();
  const next10 = getNext10DayTarget(logs);
  const markers = [];
  if(next10 && fmtDateKey(next10) === fmtDateKey(dateObj)){
    markers.push({ code: 'ten', label: '10-Day Wash Target' });
  }
  return markers;
}

function buildCalendar(hourlyData){
  const grid = $('calGrid');
  grid.innerHTML = '';

  const logs = getLogs();
  const next10 = getNext10DayTarget(logs);

  const today = new Date(); today.setHours(0,0,0,0);
  const realDays = [];
  for(let i = 0; i < 14; i++) realDays.push(addDays(today, i));

  const firstDow = (today.getDay() + 6) % 7; // 0=Mon .. 6=Sun
  const lastReal = realDays[13];
  const lastDow = (lastReal.getDay() + 6) % 7;
  const endPad = 6 - lastDow;

  const cells = [];
  for(let i = firstDow; i > 0; i--) cells.push({ date: addDays(today, -i), pad: true });
  realDays.forEach(d => cells.push({ date: d, pad: false }));
  for(let i = 1; i <= endPad; i++) cells.push({ date: addDays(lastReal, i), pad: true });

  cells.forEach(c => {
    const cell = document.createElement('div');
    const dayNum = c.date.getDate();

    if(c.pad){
      cell.className = 'cal-cell pad';
      cell.textContent = dayNum;
      grid.appendChild(cell);
      return;
    }

    const isToday = fmtDateKey(c.date) === fmtDateKey(today);
    const status = dayStatusForDate(hourlyData, c.date, isToday);
    cell.className = 'cal-cell ' + status + (isToday ? ' cal-today-ring' : '');
    cell.textContent = dayNum;

    let markers = '';
    if(next10 && fmtDateKey(next10) === fmtDateKey(c.date)){
      markers += '<span class="m ten">10D</span>';
    }
    if(markers) cell.insertAdjacentHTML('beforeend', `<div class="cal-marker">${markers}</div>`);

    cell.addEventListener('click', () => openDayModal(c.date, hourlyData));
    grid.appendChild(cell);
  });

  let note = next10 ? '10D = next 10-day wash target. Product reminders (Turtle Wax, Rain-X, etc) show above on the home screen when due.' : 'Log a wash to see target dates highlighted here.';
  $('calFootNote').textContent = note;
}

function openDayModal(dateObj, hourlyData){
  const today = new Date(); today.setHours(0,0,0,0);
  const isToday = fmtDateKey(dateObj) === fmtDateKey(today);
  const rows = hourlyRowsForDate(hourlyData, dateObj, isToday);

  const dateLabel = dateObj.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  const dayNameOnly = dateObj.toLocaleDateString([], { weekday: 'long' });
  const markers = getDateMarkers(dateObj);
  const badgeColor = { ten: 'var(--accent)', deep: 'var(--amber)' };
  const badgesHtml = markers.map(m => `
    <span style="display:inline-block; font-size:10.5px; font-weight:800; letter-spacing:.02em; padding:3px 8px; border-radius:7px; background:${badgeColor[m.code]}; color:#fff; margin:4px 6px 0 0; vertical-align:middle;">${m.label}</span>
  `).join('');

  $('dayModalTitle').innerHTML = `${dateLabel}${badgesHtml ? '<br>' + badgesHtml : ''}`;
  $('dayModalBody').innerHTML = renderWeatherCard(rows, { isToday, dayLabel: dayNameOnly });
  $('dayModal').classList.remove('hidden');
}

$('dayModal').addEventListener('click', (e) => { if(e.target === $('dayModal')) $('dayModal').classList.add('hidden'); });

/* ============================= LOG BOOK ============================= */
const SECTION_SHORT_LABEL = Object.assign({},
  Object.fromEntries(Object.entries(PRODUCTS).map(([k, v]) => [k, v.shortLabel])),
  NONTIMER_SECTIONS
);

function getLogs() {
  try {
    const raw = JSON.parse(localStorage.getItem('austral_wash_logs')) || [];
    return raw.map(normalizeLog);
  }
  catch(e) { return []; }
}

/* sections: array of confirmed section keys actually carried out this wash
   (already filtered by whatever the person unchecked on the review screen). */
function saveLog(sections) {
  const logs = getLogs();
  const typeLabel = sections.length
    ? 'Wash + ' + sections.map(k => SECTION_SHORT_LABEL[k] || k).join(' + ')
    : 'Wash';
  logs.unshift({ date: new Date().toISOString(), type: typeLabel, sections: sections.slice() });
  localStorage.setItem('austral_wash_logs', JSON.stringify(logs));
  renderLogs();
  renderProductMeters();
  if(window.cachedWeatherData){
    buildCalendar(window.cachedWeatherData.hourly);
  }
  updateReminders();
}

function deleteLog(index) {
  const logs = getLogs();
  logs.splice(index, 1);
  localStorage.setItem('austral_wash_logs', JSON.stringify(logs));
  renderLogs();
  renderProductMeters();
  if(window.cachedWeatherData){
    buildCalendar(window.cachedWeatherData.hourly);
  }
  updateReminders();
}

/* Corrects the date on an already-logged wash - the intended workflow for logging a wash
   that happened before the app was updated (or was just forgotten on the day) is: run it
   through as a completely normal wash today, then fix the date here afterwards.
   Deliberately a plain YYYY-MM-DD prompt, no date picker widget - single-file/no-dependency
   constraint, and this is a rare correction, not a everyday input. The original time-of-day
   is kept (only the calendar date moves), and getLogs() re-sorts on every read, so a
   backdated entry slots into its correct chronological position automatically - nothing
   downstream (reminders, meters, calendar, daysSincePreviousSection) needs to know an edit
   happened. */
function editLog(index) {
  const logs = getLogs();
  const entry = logs[index];
  if(!entry) return;

  const current = new Date(entry.date);
  const input = prompt('When did this wash actually happen? (YYYY-MM-DD)', fmtDateKey(current));
  if(input === null) return; // cancelled

  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
  if(!m){
    alert('Please enter the date as YYYY-MM-DD, e.g. 2026-07-15.');
    return;
  }
  const year = Number(m[1]), month = Number(m[2]), day = Number(m[3]);
  const updated = new Date(year, month - 1, day, current.getHours(), current.getMinutes(), current.getSeconds());
  // getMonth() check catches silent rollover from an invalid day (e.g. 2026-02-30 -> March)
  if(isNaN(updated.getTime()) || updated.getMonth() !== month - 1){
    alert('That doesn\'t look like a valid date - please check it and try again.');
    return;
  }

  entry.date = updated.toISOString();
  localStorage.setItem('austral_wash_logs', JSON.stringify(logs));
  renderLogs();
  renderProductMeters();
  if(window.cachedWeatherData){
    buildCalendar(window.cachedWeatherData.hourly);
  }
  updateReminders();
}

/* Days between this log entry's date and the next-older entry that also includes `key` -
   lets the log modal show real spacing between repeat treatments (chemical safety check). */
function daysSincePreviousSection(logs, index, key){
  for(let j = index + 1; j < logs.length; j++){
    if(logs[j].sections.includes(key)){
      return Math.floor((new Date(logs[index].date) - new Date(logs[j].date)) / 86400000);
    }
  }
  return null;
}

function renderLogs() {
  const logs = getLogs();
  const listEl = $('logList');

  if (logs.length === 0) {
    $('lastWashMeta').textContent = "No recent washes logged";
    listEl.innerHTML = "<p style='font-size:12px; color:var(--text-dim);'>No wash history found.</p>";
    return;
  }

  const lastWash = logs[0];
  const lastDate = new Date(lastWash.date);
  $('lastWashMeta').innerHTML = `Last: ${lastWash.type} (${lastDate.toLocaleDateString()})`;

  listEl.innerHTML = logs.map((l, index) => {
    const detail = l.sections.length
      ? l.sections.map(key => {
          const label = SECTION_SHORT_LABEL[key] || key;
          const gap = daysSincePreviousSection(logs, index, key);
          return `${label}${gap !== null ? ` - ${gap}d since previous` : ' - first time logged'}`;
        }).join(' &middot; ')
      : '';
    return `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; font-size:12px; padding:8px; background:var(--surface-2); border-radius:8px; border:1px solid var(--border);">
      <div>
        <b>${l.type}</b><br>
        <span class="num" style="color:var(--text-dim);">${new Date(l.date).toLocaleDateString()}</span>
        ${detail ? `<p class="log-detail-line">${detail}</p>` : ''}
      </div>
      <div style="display:flex; flex-direction:column; gap:6px; flex-shrink:0; margin-left:8px;">
        <button onclick="editLog(${index})" style="background:var(--accent-soft); color:var(--accent); border:1px solid var(--accent); border-radius:6px; padding:4px 8px; cursor:pointer; font-weight:bold; font-size:11px;">
          Edit
        </button>
        <button onclick="deleteLog(${index})" style="background:var(--warn-soft); color:var(--warn); border:1px solid var(--warn); border-radius:6px; padding:4px 8px; cursor:pointer; font-weight:bold; font-size:11px;">
          Delete
        </button>
      </div>
    </div>`;
  }).join('');
}

/* ============================= LOG EXPORT / IMPORT (backup) ============================= */
/* localStorage is the only place wash history lives - if it's ever cleared (browser data
   wipe, reinstalling as a PWA under a new origin, clearing site data to fix something
   unrelated, switching phones) the whole log is gone with no way to recover it. Export
   writes it out as a plain .json file the person can save anywhere they like (cloud
   drive, email to self, etc); Import reads that file back in. Both use plain browser
   APIs (Blob/FileReader) rather than any dependency, so they work the same on Samsung
   Internet (phone) and desktop browsers, and only need the page to be served over
   HTTPS (or from localhost) - which is already the case now the app runs from a local
   web server rather than a bare file:// path. */
function exportLogs(){
  const logs = getLogs();
  const payload = {
    app: 'Austral Wash Bay',
    exportedAt: new Date().toISOString(),
    version: 1,
    logs
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `austral-wash-logs-${fmtDateKey(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* Merges an imported log array into the existing one. Entries are de-duplicated on exact
   ISO date match (the only thing guaranteed unique per wash) so re-importing the same
   backup file twice, or importing a backup that overlaps with washes already logged
   since, doesn't create duplicate entries. Returns null (and shows nothing) on a
   structurally invalid file rather than throwing, since this runs straight off
   unvalidated user-supplied JSON. */
function parseImportedLogs(rawText){
  let parsed;
  try{
    parsed = JSON.parse(rawText);
  }catch(e){
    return { error: 'invalid_json' };
  }
  const incoming = Array.isArray(parsed) ? parsed : parsed.logs;
  if(!Array.isArray(incoming)){
    return { error: 'no_logs_array' };
  }
  const cleaned = incoming
    .map(normalizeLog)
    .filter(l => l && typeof l.date === 'string' && !isNaN(new Date(l.date).getTime()) && Array.isArray(l.sections));
  if(cleaned.length === 0){
    return { error: 'no_valid_entries' };
  }
  return { logs: cleaned };
}

function importLogsFromFile(file){
  const reader = new FileReader();
  reader.onload = () => {
    const result = parseImportedLogs(reader.result);
    if(result.error === 'invalid_json'){
      alert('That file isn\'t valid JSON - make sure you picked a file exported from this app.');
      return;
    }
    if(result.error === 'no_logs_array' || result.error === 'no_valid_entries'){
      alert('This doesn\'t look like an Austral Wash Bay export - no valid wash entries were found in it.');
      return;
    }

    const existing = getLogs();
    const existingDates = new Set(existing.map(l => l.date));
    const newOnes = result.logs.filter(l => !existingDates.has(l.date));
    const skipped = result.logs.length - newOnes.length;

    if(newOnes.length === 0){
      alert(`Every wash in that file (${result.logs.length}) is already in your log book - nothing to import.`);
      return;
    }

    const proceed = confirm(`Found ${newOnes.length} new wash${newOnes.length === 1 ? '' : 'es'} to import${skipped ? ` (${skipped} already in your log book, skipped)` : ''}. Add ${newOnes.length === 1 ? 'it' : 'them'} to your log book?`);
    if(!proceed) return;

    const combined = existing.concat(newOnes).sort((a, b) => new Date(b.date) - new Date(a.date));
    localStorage.setItem('austral_wash_logs', JSON.stringify(combined));
    renderLogs();
    renderProductMeters();
    if(window.cachedWeatherData){
      buildCalendar(window.cachedWeatherData.hourly);
    }
    updateReminders();
    alert(`Imported ${newOnes.length} wash${newOnes.length === 1 ? '' : 'es'}.`);
  };
  reader.onerror = () => alert('Could not read that file.');
  reader.readAsText(file);
}

$('exportLogsBtn').addEventListener('click', exportLogs);
$('importLogsBtn').addEventListener('click', () => $('importLogsInput').click());
$('importLogsInput').addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  if(file) importLogsFromFile(file);
  e.target.value = ''; // allow re-selecting the same file next time
});

/* ============================= PRODUCT PROTECTION METERS ============================= */
/* Turns a product's day-based status into a 0-1 "ratio worn through" value plus a 5-tier
   readable label, so the home screen shows a fading bar from full protection down to
   overdue - independent of the exact day-count math used for reminders above. */
const METER_TIERS = [
  { max: 0.55, label: 'Fully protected', color: 'var(--good)' },
  { max: 0.75, label: 'Medium protection', color: 'var(--good)' },
  { max: 0.9,  label: 'Low protection',    color: 'var(--amber)' },
  { max: 1.0,  label: 'Needs reapplying',  color: 'var(--amber)' },
  { max: Infinity, label: 'Overdue',       color: 'var(--warn)' }
];
function meterTierFor(ratio){
  return METER_TIERS.find(t => ratio <= t.max) || METER_TIERS[METER_TIERS.length - 1];
}

/* Touch-On's tier label reads differently when its clock was actually reset by a Turtle
   Wax application rather than Touch-On itself - "Last: <date>" would be misleading (it
   wasn't Touch-On that was applied that day), and "protected"/"fading" reads more
   naturally than "protection" tiers when talking about the ceramic base coat itself. */
function touchOnTurtleWaxTierLabel(ratio){
  const warnRatio = (PRODUCTS.touchon.targetDays - PRODUCTS.touchon.warnDays) / PRODUCTS.touchon.targetDays;
  if(ratio <= warnRatio) return 'Turtle wax protecting paint';
  if(ratio <= 1) return 'Turtle wax top layer fading';
  return 'Needs reapplying';
}

function productMeterModel(key, logs){
  logs = logs || getLogs();
  const cfg = PRODUCTS[key];
  const st = getProductStatus(key, logs);
  if(st.state === 'never') return { label: cfg.shortLabel, last: null, ratio: null, sub: null };
  const fullCycle = cfg.targetDays || cfg.maxDays;
  const ratio = st.daysSince / fullCycle;
  if(key === 'touchon' && st.anchoredByTurtleWax){
    return {
      label: cfg.shortLabel, last: null, ratio, anchoredByTurtleWax: true,
      sub: `${st.daysSince}d since Turtle Wax applied`
    };
  }
  return { label: cfg.shortLabel, last: st.last, ratio, sub: `${st.daysSince}d since applied` };
}

function renderProductMeters(){
  const wrap = $('productMeters');
  if(!wrap) return;
  const logs = getLogs();
  const keys = ['turtlewax', 'rainx', 'touchon'];

  wrap.innerHTML = keys.map(key => {
    const m = productMeterModel(key, logs);
    if(m.ratio === null){
      return `
        <div class="meter-row">
          <div class="meter-top"><span class="meter-name">${m.label}</span><span class="meter-last">Never logged</span></div>
          <div class="meter-track"><div class="meter-fill full-width" style="width:0%; background:var(--border);"></div></div>
        </div>`;
    }
    const tier = meterTierFor(m.ratio);
    const tierLabel = m.anchoredByTurtleWax ? touchOnTurtleWaxTierLabel(m.ratio) : tier.label;
    const pct = Math.max(0, Math.min(100, 100 * (1 - m.ratio)));
    const lastLine = m.last ? `Last: ${new Date(m.last).toLocaleDateString()}${m.sub ? ` &middot; ${m.sub}` : ''}` : (m.sub || '');
    return `
      <div class="meter-row">
        <div class="meter-top">
          <span class="meter-name">${m.label}</span>
          <span class="meter-last">${lastLine}</span>
        </div>
        <div class="meter-track"><div class="meter-fill" style="width:${pct}%; background:${tier.color};"></div></div>
        <p class="meter-tier" style="color:${tier.color};">${tierLabel}</p>
      </div>`;
  }).join('');
}

// Save wash automatically when user finishes, using whatever survived the review checklist
$('doneHomeBtn').addEventListener('click', () => {
  if (currentSchedule) {
    const confirmedSections = pendingLogSections.filter(key => {
      const cb = document.querySelector(`[data-review-cb="${key}"]`);
      return !cb || cb.checked;
    });
    saveLog(confirmedSections);
  }
  goHome();
});

$('logBookBtn').addEventListener('click', () => $('logModal').classList.remove('hidden'));
$('logModal').addEventListener('click', (e) => { if (e.target === $('logModal')) $('logModal').classList.add('hidden'); });
```


# FILE: .\constants.js
```
/* ============================= ICONS ============================= */
const ICONS = {
  spray:'<path d="M18 8V4h6l4 4"/><path d="M18 8h-4l-8 8v18a2 2 0 002 2h10a2 2 0 002-2V16l6-6"/><path d="M12 20h10M11 26h11M12 32h9"/><path d="M27 6l4-4M31 9l4-3M28 11l5 1"/>',
  brush:'<rect x="18" y="6" width="12" height="18" rx="2"/><path d="M18 24l-4 14M30 24l4 14M20 24l1 14M28 24l-1 14M24 24v14"/>',
  rinse:'<path d="M14 16a10 10 0 0120 0"/><path d="M10 16h28"/><path d="M16 22l-2 6M24 22v7M32 22l2 6"/><path d="M18 34l-1 4M30 34l1 4M24 34v4"/>',
  foam:'<circle cx="18" cy="20" r="7"/><circle cx="29" cy="16" r="6"/><circle cx="24" cy="28" r="6.5"/><circle cx="33" cy="27" r="4.5"/>',
  bucket:'<path d="M12 14h24l-3 22a3 3 0 01-3 2.6H18a3 3 0 01-3-2.6L12 14z"/><path d="M9 14h30"/><path d="M17 14a7 7 0 0114 0"/>',
  mitt:'<path d="M14 26c0-9 4-16 10-16s10 7 10 16v6a6 6 0 01-6 6H20a6 6 0 01-6-6v-6z"/><path d="M14 24c-3-1-6 0-6 4s3 6 7 5"/>',
  towel:'<path d="M8 12h32v10a4 4 0 01-4 4H12a4 4 0 01-4-4V12z"/><path d="M12 26q2 8 0 14M20 26q2 8 0 14M28 26q2 8 0 14M36 26q-2 8 0 14"/>',
  mirror:'<rect x="12" y="8" width="24" height="30" rx="9"/><path d="M18 14l12 20"/>',
  door:'<rect x="12" y="6" width="18" height="36" rx="1.5"/><circle cx="26" cy="24" r="1.4" fill="currentColor" stroke="none"/><path d="M30 6a24 24 0 016 18" stroke-dasharray="3 4"/>',
  timer:'<circle cx="24" cy="26" r="14"/><path d="M24 26V17M24 26l7 4"/><path d="M19 6h10M24 6v5"/>',
  polish:'<circle cx="24" cy="24" r="11"/><path d="M24 13a11 11 0 0111 11"/><path d="M24 35a11 11 0 01-11-11" stroke-dasharray="4 4"/><path d="M33 12l2 3-3 1M15 36l-2-3 3-1"/>',
  coating:'<path d="M24 5l15 8v14l-15 8-15-8V13l15-8z"/><circle cx="24" cy="20" r="4"/>',
  wiper:'<path d="M24 40V10"/><path d="M12 40a12 12 0 0124 0" stroke-dasharray="4 4"/><rect x="20" y="8" width="8" height="5" rx="1.5"/>',
  equipment:'<path d="M31 10a7 7 0 00-9.9 8L9 30v6h6l12-12a7 7 0 007-9.9L28 19l-3-3 5-5z" stroke-linejoin="round"/>',
  warning:'<path d="M20.5 8.5L4.3 36a3.4 3.4 0 003 5h33.4a3.4 3.4 0 003-5L27.5 8.5a3.4 3.4 0 00-7 0z"/><path d="M24 19v8.4"/><circle cx="24" cy="33.4" r="0.9" fill="currentColor" stroke="none"/>',
  check:'<circle cx="24" cy="24" r="16"/><path d="M17 24l5 5 10-11"/>',
  sun:'<circle cx="12" cy="12" r="5"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3M4 4l2 2M18 18l2 2M4 20l2-2M18 6l2-2"/>',
  moon:'<path d="M20 13.5A8.5 8.5 0 1110.5 4 6.8 6.8 0 0020 13.5z"/>',
  home:'<path d="M4 11l8-7 8 7v9a2 2 0 01-2 2H6a2 2 0 01-2-2v-9z"/><path d="M9 22v-6h6v6"/>',
  chevL:'<path d="M15 6l-6 6 6 6"/>',
  fullscreen: '<path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/>'
};

const WASH_RULES = {
  START_HOUR: 9,
  END_HOUR: 19,
  MIN_RAIN: 5,
  MAX_RAIN: 15,
  MIN_TEMP: 5,
  MAX_TEMP: 22
};

/* Sections that get logged & shown in wash-history detail, but have no fixed cadence -
   purely "as needed, check visually". No home-screen reminder for these. */
const NONTIMER_SECTIONS = {
  wheelsdeep:   'Deep Wheel Decon',
  sillsdeep:    'Deep Sill/Jamb Clean',
  ironfallout:  'Iron Fallout Treatment',
  claybarTarRemoval: 'Remove Tar spots (clay bar)',
  snowfoamdeep: 'Deep Snow Foam'
};
const HOW_SOON_DAYS = 20; /* home-screen "coming up" warning window, ~2 washes out */

/* ============================= PRODUCT TRACKING CONFIG ============================= */
/* Sections with a real re-application cadence. Each is tracked independently: last-applied
   date comes from the most recent log that includes this key in its `sections` array. */
/* v16: Turtle Wax is now a single fixed 6-month (180d) target rather than a 4-6 month
   range - `targetDays` + `warnDays` replace `minDays`/`maxDays` for this entry.
   v17: Touch-On is back to being a normal day-tracked product (targetDays:40) - see the
   v17 blueprint notes for why the wash-count model was dropped. Its "last applied" date
   is special-cased in getProductStatus()/productMeterModel() to also count a Turtle Wax
   application as resetting the clock (a fresh base coat has nothing to top up yet).
   Deep Snow Foam is no longer day-tracked here at all - whether it's needed depends on
   how dirty the car actually is (e.g. motorway grime), not a calendar interval, so it's
   a NONTIMER_SECTIONS entry (logged, but no due-date machinery). */
const PRODUCTS = {
  turtlewax: { label: 'Turtle Wax Ceramic Spray', shortLabel: 'Turtle Wax', targetDays: 180, warnDays: 20 },
  rainx:     { label: 'Rain-X Glass Protector',    shortLabel: 'Rain-X',    minDays: 90,  maxDays: 120 },
  touchon:   { label: 'Bilt Hamber Touch-On',      shortLabel: 'Touch-On',  targetDays: 40,  warnDays: 10 }
};
/* Touch-On is blocked when Turtle Wax reapplication is due within `blockDaysBeforeTurtlewax`
   days, since a fresh Touch-On top-coat needs to be worn off before the base layer goes
   back on. This is the only Touch-On-specific rule left now it's day-tracked like everything
   else in PRODUCTS. */
const TOUCHON_BLOCK_DAYS_BEFORE_TURTLEWAX = 40;

// NEW GEMINI CODE UPDATES
/* JavaScript for Dilution Calculator */
/* JavaScript for Dilution Calculator with Product Weight */
/* JavaScript for Dilution Calculator (Whole Numbers & Total Weight Tracker) */
// touchless was - 1:15 (Maintenance), 1:5 (Deep Clean)
const RATIOS = {
  bh_touchless: {
    density: 1.08, // Estimated density in g/ml
    defaultSize: 750,
    options: [
      { label: "1:15 (Light road dust/summer 0.6%PIR)", parts: 15, water: "warm tap" },
      { label: "1:9 (Maintenance 1%PIR)", parts: 9, water: "warm tap" },
      { label: "1:5 (Deep Clean 1.6%PIR)", parts: 5, water: "warm tap" },
      { label: "1:4 (Full Dirt Buld-up 2%PIR)", parts: 4, water: "warm tap" }
    ]
  },
  bh_surfex: {
    density: 1.05, // Estimated density in g/ml
    defaultSize: 500,
    options: [
      { label: "1:10 (Arches, Tyres & Jambs)", parts: 10, water: "tap" },
      { label: "1:100 (Interior & Leather)", parts: 100, water: "tap" }
    ]
  },
  bh_qd: {
    density: 1.01, // Estimated density in g/ml
    defaultSize: 500,
    options: [
      { label: "1:20 (Drying Aid)", parts: 20, water: "distilled" }
    ]
  },
  bh_wash: {
    density: 1.02, // Estimated density in g/ml
    defaultSize: 10000,
    options: [
      { label: "1:2000 (Bucket Wash)", parts: 2000, water: "warm tap" }
    ]
  },
  bh_touchon: {
    density: 1.02, // Estimated density in g/ml
    defaultSize: 300,
    options: [
      { label: "1:9 (Ceramic wax)", parts: 9, water: "cool tap" }
    ]
  }
};

/* ============================= WASH SETUP SCREEN CONFIG ============================= */
const SETUP_GROUPS = [
  {
    key: 'snowFoam', label: 'Snow Foam', type: 'radio',
    options: [
      { value: 'regular', title: 'Regular Snow Foam', sub: 'Standard pre-wash strength (1:15), good for maintenence washes.' },
      { value: 'deep', title: 'Deep Snow Foam', sub: 'Stronger mix (1:5), use for heavy dirt build-up.' }
    ]
  },
  {
    key: 'coating', label: 'Coating', type: 'radio',
    options: [
      { value: 'none', title: 'No coating today', sub: 'BH Touch-On instructions can still be added later in the wash if a top-up is required.' },
      { value: 'turtlewax', title: 'Turtle Wax Ceramic Spray', sub: 'Full ceramic coating to protect bodywork, lights &amp; alloys. Apply every 180 days (6 months).', product: 'turtlewax' }
    ]
  },
  {
    key: 'glass', label: 'Glass', type: 'radio',
    options: [
      { value: 'regular', title: 'Regular glass clean', sub: 'Maintenence clean for streak free glass' },
      { value: 'rainx', title: 'Rain-X glass protector', sub: 'Fully protect windscreen and glass. Apply every 90 - 120 days (3 to 4 months) for total protection', product: 'rainx' }
    ]
  }
];
const ADDONS = [
  { key: 'wheelsDeep', title: 'Deep Wheel Decon', sub: 'Select if wheels are show heavy brake-dust or road grime/salt' },
  { key: 'sillsDeep', title: 'Deep Sill/Jamb Clean', sub: 'Only needed if door jambs look dirty, greasy, or oily' },
  { key: 'ironFallout', title: 'Iron Fallout Treatment', sub: 'Only select if the car has any iron specks. Don\'t use too often' },
  { key: 'claybarTarRemoval', title: 'Remove Tar spots with Clay Bar', sub: 'Select if the car has any black/dark raised tar spots. This will remove all protective coatings, so best to add to a wash with either a fresh coating or top-up.' }
];

/* ============================= MASTER STEP LIST ============================= */
/* Single canonical, ordered step list for every wash. Each step's showIf(sel) decides
   whether it appears for the current washSelections. `section` tags a step as belonging to
   an optional/tracked group, used for the done-screen review list and wash-log detail. */
const CHEM_RULES_BODY = {
  'Park the vehicle in the shade with all bodywork and wheels cool to the touch before you begin.': [],
  'DO NOT USE:': [
    '<span class="product_BH">Bilt Hamber Auto-QD (1:20)</span> on Glass, mirrors, or alloy wheels',
    '<span class="product_rainx">Rain-X</span> on Side mirrors, unpainted black plastics, or bodywork',
    '<span class="product_BH">Bilt Hamber Auto-Korrosol</span> on Grill meshes, badges, seals, or hot surfaces',
    '<span class="product_Autoglym_carGlass">Autoglym Car Glass Polish</span> on Plastic trim, window surrounds, or screens'
  ],
  'ALWAYS DILUTE THE FOLLOWING:': [
    '<span class="product_BH">Bilt Hamber Auto-QD</span>:</b> ALWAYS 1:20 (24ml/25g for 476ml/476g Distilled water)',
    '<span class="product_BH">Bilt Hamber Surfex-HD</span>:</b> ALWAYS 1:10  (45ml/48g for 455ml/455g tap water) for arches, tyres &amp; jambs, Can be diluted further 1:100 to be used on interior vinyl, dashboard plastics, steering wheels, leather (spot testing first), and light fabric upholstery stains',
    '<span class="product_BH">Bilt Hamber Touch-Less</span>:</b> 1:15 for weekly (51g/47ml with 703ml warm tap water), 1:5 for deep clean (135g/125ml for 625ml warm tap water)',
    '<span class="product_BH">Bilt Hamber Auto-Wash</span>:</b> 1:2000 (1 tsp/5ml/5g per 10L/10kg warm tap water)',
    '<span class="product_BH">Bilt Hamber Touch-On</span>:</b> 1:9 (30g/30ml per 270ml cool tap water)'
  ],
  'NEVER DILUTE THE FOLLOWING:': [
    '<span class="product_Autoglym_fastGlass">Autoglym Fast Glass</span>',
    '<span class="product_Autoglym_carGlass">Autoglym Car Glass Polish</span>',
    '<span class="product_rainx">Rain-X</span>',
    '<span class="product_Autoglym_tyreDressing">Autoglym Instant Tyre Dressing</span>',
    '<span class="product_BH">Bilt Hamber Auto-Wheel</span>',
    '<span class="product_BH">Bilt Hamber Auto-Korrosol</span>'
  ]
};

const MASTER_STEPS = [
  {
    phase: 'Before You Start', icon: 'warning', title: 'Get set up',
    body: CHEM_RULES_BODY,
    warning: 'Some products used in deep-clean steps aren\'t nice on skin for extended periods - gloves recommended for most chemical tasks.'
  },
  {
    phase: 'Before You Start', icon: 'equipment', title: 'Checklist for things to prepare now',
    body: {
      'Liquids/chemicals needed': [
        'Spray bottle with <span class="product_BH">Bilt Hamber Surfex-HD</span> (diluted 1:10)',
        '<span class="product_Autoglym_tyreDressing">Autoglym Instant Tyre Dressing</span>',
        { wheelsDeep: '<span class="product_BH">Bilt Hamber Auto-Wheel</span>' },
        { ironFallout: '<span class="product_BH">Bilt Hamber Auto-Korrosol</span>' },
        { snowFoamRegular: 'Mix 51g(47ml) of <span class="product_BH">Bilt Hamber Touch-Less</span> with 703g (1:15) of warm tap water in foam lance bottle' },
        { snowFoamDeep: 'Mix 135g(125ml) of <span class="product_BH">Bilt Hamber Touch-Less</span> with 625g (1:5) of warm tap water in foam lance bottle' },
        'Fill 1 bucket with 9.5 liters of warm tap water (wash bucket) and grit guard.',
        'Fill 1 bucket with about 5-6 liters of luke warm tap water (rinse bucket) and grit guard.',
        '<span class="product_BH">Bilt Hamber Auto-Wash</span> with a 5ml measure (will mix with water later)',
        'Spray bottle with <span class="product_BH">Bilt Hamber Auto-QD</span> (diluted 1:20)',
        { noTurtle: '30ml of <span class="product_BH">Bilt Hamber Touch-On</span> ready if needed, plus a container with 270ml water.' },
        { rainx: '<span class="product_Autoglym_carGlass">Autoglym Car Glass Polish</span>' },
        { rainx: '<span class="product_rainx">Rain-X</span>' }
      ]
    }
  },
  {
    phase: 'Before You Start', icon: 'equipment', title: 'Checklist for things to prepare now',
    body: {
      'Other things needed': [
        'Karcher K2 washer',
        'Stubby spray gun, white nozzle, foam gun attachment',
        'Power extension cable.',
        'Hose rolled to near car.',
        'Wheel/body detail brushes',
        '3 x Wash Mitts',
        '5(+) x microfibre cloths',
        '1 x CarMax XXL Twisted Loop Towel',
        '1 x Large towel (for glass)',
        { claybarTarRemoval: '<span class="product_BH">Bilt Hamber Clay Bar</span>' },
        { noRainx: '1 x Glass cloth (for mirrors)' },
        { rainx: '3+ x Glass cloth (for mirrors and glass)' }
      ]
    }
  },

  /* ---------- wheels ---------- */
  {
    phase: 'Wheel Pre-Wash', icon: 'spray', title: 'Pre-spray the wheels',
    showIf: sel => !sel.wheelsDeep,
    body: [
      'Spray <span class="product_BH">Bilt Hamber Surfex-HD</span> (1:10 dilution) onto tyres, wheel faces, and lower wheel arches.',
      'Give the spokes a quick pass with your detail brush to loosen traffic film and brake dust.',
      'Give the tyres a good scrub with a hard bristled brush.',
      'Pressure-rinse the wheels and arches thoroughly (using white spray head).',
      'If there is a LOT of dirt/brake dust, repeat, or consider changing to a deep wheel clean option.'
    ],
    warning: 'Remember to stay 12" away when using the jet washer. This is especially important for under the arches as these could be dislodged with heavy/hard spray.'
  },
  {
    phase: 'Wheels & Decontamination', icon: 'spray', title: 'Degrease the wheels',
    section: 'wheelsdeep', showIf: sel => sel.wheelsDeep,
    body: [
      'Spray <b><span class="product_BH">Bilt Hamber Auto-Wheel</span></b> liberally across the cool, dry alloy wheel faces and barrels.',
      'Spray <b><span class="product_BH">Bilt Hamber Surfex-HD</span></b> (1:10 dilution) onto the rubber tyre sidewalls, and give a good scrub and inner wheel arches.',
      'Spray <b><span class="product_BH">Bilt Hamber Surfex-HD</span></b> (1:10 dilution) onto inner wheel arches to help remove dirt build-up.',
      'Allow the products to dwell (3-5 mins) until the Auto-Wheel turns deep purple as it dissolves embedded brake dust.',
      'Start the timer after finishing the first wheel, by the time the timer goes off it should be time to rinse the first wheel.'
    ],
    timerSec: 180, timerLabel: 'Dwell time', timerRange: '3-5 MINS'
  },
  {
    phase: 'Wheels & Decontamination', icon: 'brush', title: 'Agitate',
    section: 'wheelsdeep', showIf: sel => sel.wheelsDeep,
    body: [
      'Agitate the wheel spokes thoroughly using your detail brush.',
      'Pressure rinse the wheels, tyres, and wheel arches <b>thoroughly</b> using white spray head.',
      'If there is a LOT of dirt/brake dust, use the <b>green</b> (25&deg;) spray head for more force. If you do, be more careful of overspray/damage to other components. Use with *Caution*.'
    ]
  },

  /* ---------- Rear textured plastic trim ---------- */
  {
    phase: 'Rear trim & exhaust', icon: 'spray', title: 'Clean the black textured plastic and exhast tips',
    body: [
      'Spray <b><span class="product_BH">Bilt Hamber Surfex-HD</span></b> (1:10 dilution) on the textured plastic.',
      'If the plastic is close to paint consider applying the product to a rag and applying.',
      'Agitate the product with a brush (like the wheels) to remove heavy carbon soot, exhaust oil and road grime.',
      'Then rinse off thouroughly.'      
    ],
  warning: 'This process can also be used on the exhaust tips if needed.'
  },

  /* ---------- deep sills ---------- */
  {
    phase: 'Door & Boot Sills/Jams', icon: 'mitt', title: 'Wipe down the jambs',
    section: 'sillsdeep', showIf: sel => sel.sillsDeep,
    warning: 'Only needed if the door jambs look especially dirty, greasy, or oily. Doing this too regularly could degrade rubber seals.',
    body: [
        'Spray a microfibre cloth with <span class="product_BH">Bilt Hamber Surfex-HD</span> (diluted 1:10)',
        'wipe down the inner door jambs, boot lip and rubber seals using a rag',
        'Wet a clean rag and wipe off all product/dirt suds. This is just a pre-clean for this area, it will be cleaned again with Auto-Wash.',
        'Remember to shut ALL doors once finished.'
    ]
  },

  /* ---------- snow foam ---------- */
  {
    phase: 'Snow Foam Pre-Wash', icon: 'foam', title: 'Mix the snow foam',
    body: [
      'Attach pre-mixed <span class="product_BH">Bilt Hamber Touch-Less</span> foam lance bottle and connect to pressure washer.',
      'Make sure the foam lance is fully closed (all way to minus) for thicker foam',
      'Twist the front so the spray is vertical, and close the aperature nearly all the way to create a \'fan\' of foam',
      'Foam the entire car from the <b>bottom</b> up. Spray the wheels, sills, and lower body panels first, then move up to the roof and windows.',
      'Use all the product in the bottle, go over any areas that were particularly \'grimy\' with any remaining foam.',
      'Once finished spraying car fully, <b>swipe left and IMMEDIATELY start dwell timer</b> (3-5 mins).'
    ]
  },
  {
    phase: 'Snow Foam Pre-Wash', icon: 'foam', title: 'Wait and clean gun',
    body: [
      'Start dwell timer NOW! (3-5 mins)',
      'The <span class="product_BH">Bilt Hamber Touch-Less</span> dissolves grime and static film. Dirt should be seen running down the car.',
      'During dwelling time, empty out the foam lance bottle, top up with clean water and reattach to the K2. Run through some water for ~15secs to flush and clean the brass foam head, repeat if still \'suddy\'.'
    ],
    timerSec: 180, timerLabel: 'Dwell time', timerRange: '3-5 MINS',
    warning: 'DO NOT exceed 5 minutes. DO NOT LET IT DRY OUT! Sunny/hot days may dry out the foam too quickly, rinse off sooner if starting to dry too fast.'
  },
  {
    phase: 'Snow Foam Pre-Wash', icon: 'rinse', title: 'Rinse the entire vehicle',
    body: [
      'Pressure rinse the entire vehicle thoroughly, <b>top-to-bottom</b> (white spray head), nozzle roughly 12" from the bodywork.',
      'Start with the roof and completely clear it of suds, then go round the car moving the suds down and off the car and wheels.',
      'Make sure to remove ALL suds'
    ]
  },

  /* ---------- iron fallout ---------- */
  {
    phase: 'Iron Fallout', icon: 'spray', title: 'Iron fallout treatment',
    section: 'ironfallout', showIf: sel => sel.ironFallout,
    body: [
      'Mist <span class="product_BH">Bilt Hamber Auto-Korrosol</span> onto the lower body panels and bonnet, avoiding grill mesh, badges, and rubber seals.',
      'Let it bleed purple for 2-3 mins on cool, shaded panels, then pressure rinse thoroughly top-to-bottom (white spray head) before your Contact Wash.',
      'If this doesn\'t shift the tough stains consider investigating using a clay bar after the Contact Wash.'
    ],
    warning: 'Roughly a once-a-year step, not every wash.',
    timerSec: 120, timerLabel: 'Dwell time', timerRange: '2-3 MINS'
  },

  /* ---------- contact wash ---------- */
  {
    phase: 'Contact Wash', icon: 'bucket', title: 'Set up your buckets',
    body: [
      '<b>Bucket 1 (Wash)</b>: Filled 9.5 litres of warm water. Add 1 teaspoon (~5ml) of <span class="product_BH">Bilt Hamber Auto-Wash</span>, spray the pressure washer into the bucket to create bubbles/foam (try and get the head under the water, near the bottom).',
      'Since it is under filled by 500ml you can add quite a lot to make sure fully agitated.',
      '<b>Bucket 2 (Rinse)</b>: Filled with plain water with your grit guard inserted.'
    ],
    warning: 'Make sure grit guards are in both buckets.'
  },
  {
    phase: 'Contact Wash', icon: 'mitt', title: 'Wash car with wash mitts',
    body: {
      '<b>Before starting, set the windscreen wipers in their \'UP\' position away from the windscreen</b>':[],
      'Process for loading/rinsing':[
        'Dip wash Mitt in auto-wash bucket, then squeeze to remove some water (so it stays wet, not pouring/dripping water).',
        'Run the Mitt with the shampoo over a small section/1-2 panels at a time.',
        'Submerge the Mitt in the rinse bucket, and rub back-and-forth against grit guard.',
        'Wring out fully over the ground/rinse bucket, it should be damp/dry not wet.',
        'Repeat.'
      ],
      'Using <b>Green Mitt</b> start washing at the roof then upper door panels/glass -> boot panels/glass -> windscreen -> bonnet -> lower panels. Wash the entire side.':[],
      'Use the <b>Orange Mitt</b> for the wheels. Don\'t miss this step! Since the wheels could still be dirty, make double sure to remove all grit before putting the Mitt into the wash bucket.':[],
      'Switch to the <b>Grey Mitt</b> for the other side of the car and repeat same process. Don\'t forget the wheels on this side!':[]
    },
    warning: 'Rinse ALL mitts in clean water bucket, against the grit guard, wring dry, before reloading shampoo. This should be done REGULARLY to avoid scratching dirt across the panels.<br><br>Keep <b>Orange Mitt</b> for the Wheels ONLY.'
  },
  {
    phase: 'Contact Wash', icon: 'rinse', title: 'Rinse the entire vehicle',
    body: 'Pressure rinse the entire vehicle thoroughly, <b>top-to-bottom</b> (white spray head), nozzle roughly 12" from the bodywork.  Again start at top, and rinse all suds from the car, working downwards.'
  },
  {
    phase: 'Contact Wash', icon: 'mitt', title: 'Clean door & boot shuts',
    body: [
      'Open all doors and the boot.',
      'Clean the door and boot shuts, including door frames and boot gutters, with the same <span class="product_BH">Bilt Hamber Auto-Wash</span> mixture.',
      'Dampen a microfiber cloth with clean water, and wipe off all suds.',
      'Shut all doors.'
    ]
  },
  /* ---------- Tar spot removal ---------- */
  {
    phase: 'Tar Removal', icon: 'mitt', title: 'Remove any Tar spots',
    section: 'claybarTarRemoval', showIf: sel => sel.claybarTarRemoval,
    body: [
      'Use a small (50g) block of Clay Bar. Warm it up in a cup of warm water for 1 min to make plyable',
      'Flatten into a pancake shape',
      'Heavily wet the target area with a spray bottle filled with cool tap water',
      'Gently  \'Glide\' the clay back and forth over the black spots/tar using straight lines',
      'As the clay picks up the grime/tar/spots fold it in half and knead it into a clean face.',
      'Repeat as needed, drying any panels that have been completed before moving on.',
      'If the piece of clay is EVER dropped on the floor, throw it away instantly. It will pick up grit off the ground that will scratch'
    ],
    warning: 'Keep it really wet with water to help it glide, and only ever apply gentle pressure.<br><br>After using a clay bar, the paint is \'Exposed\' and needs to be sealed. Use Touch-On or Turtle Wax to seal it, or do before a full Turtle Wax/Touch-On application.'
  },

  /* ---------- touch-on decision (skipped entirely if turtle wax chosen) ---------- */
  {
    phase: 'Touch-On', icon: 'spray', title: 'Does the car need Touch-On?',
    type: 'decision',
    /* v17: Touch-On is day-tracked (targetDays:40) like the other products. This mid-wash
       decision is only offered during the 'soon' warning window (last ~10 of the 40 days)
       and only when it isn't blocked by an imminent Turtle Wax reapplication - i.e. roughly
       the situation that used to be called "3rd wash, nearly due". Once it's fully 'overdue'
       it's pre-selected as a Coating option on the setup screen instead (sel.touchon is
       already true by the time the wash starts), and this step is skipped. Too early
       ('ok'/'never') also skips it - nothing to ask about yet. */
    showIf: sel => sel.coating !== 'turtlewax' && sel.touchon !== true && sel.touchon !== false
      && sel._touchon && (sel._touchon.state === 'soon' || sel._touchon.state === 'overdue') && !sel._touchon.blocked,
    noteFn: sel => (sel._touchon && sel._touchon.state === 'soon')
      ? `<div class="overdue-banner soon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9L2.6 18a1.7 1.7 0 001.5 2.5h16a1.7 1.7 0 001.5-2.5L13.7 3.9a1.7 1.7 0 00-3.4 0z"></path><path d="M12 9.5v4.2"></path><circle cx="12" cy="16.7" r="0.4" fill="currentColor" stroke="none"></circle></svg><p><b>Touch-On is nearly due</b> (last applied ${sel._touchon.daysSince !== null ? sel._touchon.daysSince + 'd ago' : 'never'})<br>Worth checking and applying now if the water isn't beading well.</p></div>`
      : '',
    noteFn: sel => (sel._touchon && sel._touchon.state === 'overdue')
      ? `<div class="overdue-banner "><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9L2.6 18a1.7 1.7 0 001.5 2.5h16a1.7 1.7 0 001.5-2.5L13.7 3.9a1.7 1.7 0 00-3.4 0z"></path><path d="M12 9.5v4.2"></path><circle cx="12" cy="16.7" r="0.4" fill="currentColor" stroke="none"></circle></svg><p><b>Touch-On reapplication due now</b><br>Last applied ${sel._touchon.daysSince !== null ? sel._touchon.daysSince + 'd ago' : 'never'}.<br>You should reapply today!</p></div>`
      : '',

    body: 'Look at how the water rinsed off the bodywork just now.',
    yesLabel: 'Yes, apply it', noLabel: 'No, skip it',
    yesSub: 'Water is beading wide, misshapen, or struggling to roll off',
    noSub: 'Water is still beading tightly or running straight off'
  },
  {
    phase: 'Touch-On', icon: 'spray', title: 'Touch-On application',
    section: 'touchon', showIf: sel => sel.coating !== 'turtlewax' && sel.touchon === true,
    noteFn: sel => (sel.coating === 'touchon' && sel._touchon)
      ? `<div class="overdue-banner "><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9L2.6 18a1.7 1.7 0 001.5 2.5h16a1.7 1.7 0 001.5-2.5L13.7 3.9a1.7 1.7 0 00-3.4 0z"></path><path d="M12 9.5v4.2"></path><circle cx="12" cy="16.7" r="0.4" fill="currentColor" stroke="none"></circle></svg><p><b>Touch-On reapplication due now</b><br>Last applied ${sel._touchon.daysSince !== null ? sel._touchon.daysSince + 'd ago' : 'never'}, applying today as scheduled.</p></div>`
      : '',
    body: [
      'Add 270ml of clean water to the lance foam bottle.',
      'Take the 30ml of <span class="product_BH">Bilt Hamber Touch-On</span> and pour it into the bottle, mix slightly. This is the diluted <span class="product_BH">Bilt Hamber Touch-On</span> coating',
      '<b>Change the settings of the foam sprayer</b> : turn the top dial more to the + (unknown amount at the moment).  This dilutes the mixture more (gives more time spraying), and doesn\'t create a thick foam.',
      'The gun setting should create a light \'mist\' across the car, adjust the front fan accordingly to reduce any frothy/foamy output.',
      'Spray lightly all over the car, starting at the top.',
      'Be aware that 300ml of liquid will run out fairly quickly (not as quick as the Touch-Less due to changing settings). Make sure to get a good even coverage over the entire car before running out of product.',
      'It doesn\'t need to be applied fully to the windscreen, or glass. It will be removed later anyway with Fast Glass.'
    ],
    warning: 'Make sure to alter the gun settings - this is not the same as the foam output. The product should form a light \'mist\'.'
  },
  {
    phase: 'Touch-On', icon: 'rinse', title: 'Rinse off',
    section: 'touchon', showIf: sel => sel.coating !== 'turtlewax' && sel.touchon === true,
    body: [
      'After applying, Rinse with the K2 and white spray head all over the car.',
      '<span class="product_BH">Bilt Hamber Touch-On</span> relies on the pressure washer\'s impact force to bond to the paint/wheels.',
      'The water should really run off the body work leaving barely any behind.',
      'Dry the car, as detailed next. But <b>DO NOT</b> use any additional <span class="product_BH">Bilt Hamber Auto-QD</span>.'
    ],
    warning: 'The <span class="product_BH">Bilt Hamber Touch-On</span> should have removed most of the water, and also acts as its own drying aid - NO NEED TO APPLY ANY <span class="product_BH">Bilt Hamber Auto-QD</span>. The 2 products do not react well together.'
  },

  /* ---------- drying ---------- */
  {
    phase: 'Drying', icon: 'towel', title: 'Dry the glass first',
    body: 'Dry the windows and mirrors first with the Large towel, before any <span class="product_BH">Bilt Hamber Auto-QD</span> goes near the car.',
    warning: 'Never use <span class="product_BH">Bilt Hamber Auto-QD</span> on any glass or mirrors. It will affect the <span class="product_rainx">Rain-X</span> and cause streaks and smears from the wipers.'
  },
  {
    phase: 'Drying', icon: 'spray', title: 'Dry panels with Mist aid',
    body: [
      { noTurtle: 'Lightly mist <span class="product_BH">Bilt Hamber Auto-QD</span> (1:20 dilution) onto 1-2 wet panels at a time as a drying aid. Be aware that if <span class="product_BH">Bilt Hamber Touch-On</span> was applied earlier it acts as its own drying aid, and doesn\'t mix well, so NO NEED TO APPLY <span class="product_BH">Bilt Hamber Auto-QD</span>'},
      { turtle: 'You\'re applying <span class="product_turtleWax">Turtle Wax Ceramic Spray</span> after drying, so <b>DO NOT</b> use any <span class="product_BH">Bilt Hamber Auto-QD</span> here. It will negatively affect the bonding of the <span class="product_turtleWax">Turtle Wax Ceramic Spray</span>' },
      'Use the CarMax XXL Twisted Loop Towel to gently dry all bodywork and alloy wheels in long, smooth passes.'
    ],
    warning: 'Remember not to use any <span class="product_BH">Bilt Hamber Auto-QD</span> on ANY glass/mirrors, or if used <span class="product_BH">Bilt Hamber Touch-On</span> this wash.'
  },
  {
    phase: 'Drying', icon: 'towel', title: 'Dry Alloy Wheels',
    body: [
      'Using a new, clean Microfibre cloth or Towel, dry the wheels.',
      { noTurtle: 'Misting <span class="product_BH">Bilt Hamber Auto-QD</span> onto the alloys will help with the drying process. Be aware that if <span class="product_BH">Bilt Hamber Touch-On</span> was applied earlier it acts as its own drying aid, and the 2 products don\'t react well together, so NO NEED TO APPLY <span class="product_BH">Bilt Hamber Auto-QD</span>'},
      { turtle: 'You\'re applying <span class="product_turtleWax">Turtle Wax Ceramic Spray</span> after drying, so <b>DO NOT</b> use any <span class="product_BH">Bilt Hamber Auto-QD</span> on the alloys. It will negatively affect the bonding of the <span class="product_turtleWax">Turtle Wax Ceramic Spray</span>' }

    ],
    warning: [
        'Do not spray <span class="product_BH">Bilt Hamber Auto-QD</span> directly onto the exposed brake discs or pads. Only mist it onto the outer face and spokes of the alloy wheel itself before wiping dry.'
    ]
  },
  {
    phase: 'Drying', icon: 'door', title: 'Wipe interior door shuts',
    body: 'Open all doors and wipe down the internal door shuts, rubber seals, and sill lips with a clean edge of the drying towel.',
    warning: 'This is the last drying step, the Twisted Loop Towel can be put aside.'
  },

  /* ---------- turtle wax coating ---------- */
  {
    phase: 'Turtle Wax Ceramic Coating', icon: 'coating', title: 'Start with Bodywork',
    section: 'turtlewax', showIf: sel => sel.coating === 'turtlewax',
    body: [
      'Spray 1-2 mists of <span class="product_turtleWax">Turtle Wax Ceramic Spray</span> directly onto a fresh, folded microfibre cloth - never spray directly onto panels or wheels, to avoid overspray.',
      'Wipe evenly over one panel at a time using straight lines.',
      'Flip the cloth over and give a first immediate buff',
      'Then take a second dry, clean microfibre towel and gently buff (no pressure) until high-gloss and streak-free.',
      'Repeat across the entire car, doing 1 panel at a time.'
    ],
    warning: 'Never apply <span class="product_turtleWax">Turtle Wax Ceramic Spray</span> to the windows or mirrors - it\'s designed for bodywork, plastics and alloys only.'
  },
  {
    phase: 'Turtle Wax Ceramic Coating', icon: 'coating', title: 'Light clusters & Alloys',
    section: 'turtlewax', showIf: sel => sel.coating === 'turtlewax',
    body: [
      'Repeat the process across the front and rear light clusters.',
      'REMEMBER: spray some on the cloth, wipe over surface, turn cloth over and lightly buff. Grab the other cloth and give it a full light buff.',
      'Repeat the process for the alloy wheel faces and spokes - work it in well, since it helps protect against brake dust build-up.'
    ]
  },

  /* ---------- glass: rain-x branch ---------- */
  {
    phase: 'Rain-X: Glass Prep', icon: 'polish', title: 'Apply glass polish',
    section: 'rainx', showIf: sel => sel.glass === 'rainx',
    body: [
      'Spray 1-2 mists of <span class="product_Autoglym_carGlass">Autoglym Car Glass Polish</span> directly onto a fresh, folded microfibre cloth - never spray directly onto glass, to avoid overspray.',
      'Work <span class="product_Autoglym_carGlass">Autoglym Car Glass Polish</span> in firm, overlapping circular motions using a microfibre or applicator pad on all windows.',
      'Let it haze - Wait for 1-2 mins for the polish to dry to a white, chalky haze.',
      'Then buff the haze off completely using a clean, dry microfibre cloth until the glass looks clear.'
    ],
    timerSec: 60, timerLabel: 'Haze time', timerRange: '1-2 MINS'
  },
  {
    phase: 'Rain-X: Glass Prep', icon: 'polish', title: 'Wipe with Fast Glass',
    section: 'rainx', showIf: sel => sel.glass === 'rainx',
    body: [
      'Spray <span class="product_Autoglym_fastGlass">Autoglym Fast Glass</span> onto a fresh microfibre cloth and wipe down the panel - this strips away any microscopic oils or residual dusting left by the polish.',
      'Flip the microfibre to a dry side and wipe until 100% streak-free and squeaky clean.',
      'Can always use a <b>glass cloth</b> to give that final buff.'
    ],
    warning: 'Ensure the glass is completely buffed, dry and no <span class="product_Autoglym_carGlass">Autoglym Car Glass Polish</span> is remaining.'
  },
  {
    phase: 'Rain-X: Application', icon: 'warning', title: 'Check the glass',
    section: 'rainx', showIf: sel => sel.glass === 'rainx',
    body: 'Ensure all the glass is completely clean and dry before you start. There should be no residue or oil on it.',
    warning: 'Never apply <span class="product_rainx">Rain-X</span> in direct hot sunlight or on a warm windscreen - it bakes on before it can bond, making it harder to buff off and more likely to smear. Always apply in the shade, on cool glass.'
  },
  {
    phase: 'Rain-X: Application', icon: 'polish', title: 'Apply <span class="product_rainx">Rain-X</span>',
    section: 'rainx', showIf: sel => sel.glass === 'rainx',
    body: [
      'Spray 3-4 squirts of <span class="product_rainx">Rain-X</span> onto a folded new <b>microfibre cloth</b> or foam applicator - <b>NOT</b> a glass cloth, since it needs to absorb the product for even application.',
      'Avoid applying Rain-X to the top center trapezoidal glass section where the ADAS safety camera sits. This could obstruct camera in med/heavy rain situations.',
      'Work in firm, overlapping circular motions across half the windscreen, rear/small windows.',
      'Apply a second coat in the same way to get any missed spots.',
      'Wait until the windscreen/window has a light, dry, chalky white haze over it. Anywhere from 2-5 mins'
    ],
    warning: 'Start on windscreen, then do 1 pair of side windows, then back window, then next side (buffing in between, see next step).<br><br>**NEVER APPLY TO MIRRORS**',
    timerSec: 120, timerLabel: 'Haze time', timerRange: '2-5 MINS'
  },
  {
    phase: 'Rain-X: Application', icon: 'polish', title: 'Buff off in circular passes',
    section: 'rainx', showIf: sel => sel.glass === 'rainx',
    body: [
      'For this use a new, clean, <b>glass cloth</b>.',
      '<b>Lightly</b> dampen the <b>glass cloth</b> (best), or Spray a <b>very fine</b> mist of plain water directly onto the dry haze.',
      'Wipe/buff the glass with light-to-medium pressure in small overlapping circular motions. The water dissolves the carrier haze and the glass cloth lifts it away.',
      'Once one window is done, go back 1 step and do the next one.'
    ],
    warning: 'Always remember to use a very small amount of water to help.<br>DON\'T RUB IT DRY!.'
  },
  {
    phase: 'Rain-X: Application', icon: 'towel', title: 'Final straight sweep',
    section: 'rainx', showIf: sel => sel.glass === 'rainx',
    body: [
      'Use a new, fully clean glass cloth.',
      'Go around the entire car, checking all windows and do one quick, straight sweep across the glass to remove any remaining microscopic moisture.',
      'Look at the glass from an angle, or from inside the car looking out. It should look completely transparent, like it isn\'t even there.'
    ]
  },

  /* ---------- glass: regular branch ---------- */
  {
    phase: 'Glass Clean', icon: 'polish', title: 'Wipe with Fast Glass',
    showIf: sel => sel.glass !== 'rainx',
    body: [
      'Spray <span class="product_Autoglym_fastGlass">Autoglym Fast Glass</span> onto a fresh microfibre cloth and go over all windows - this strips away any microscopic oils or residual dusting left.',
      'Most important windows to get are the windscreen and rear window (to help wipers)',
      'Use a <b>glass cloth</b> to Immediately buff off until 100% streak-free and squeaky clean.'
    ]
  },

  /* ---------- always-run tail ---------- */
  {
    phase: 'Wiper Blades', icon: 'wiper', title: 'Wipe the wiper blades',
    body: [
      'Wipe down the edge of your wiper blades (front and back!) with a damp microfibre cloth carrying a little <span class="product_Autoglym_fastGlass">Autoglym Fast Glass</span>.',
      'The wipers can be put back into their default position'
    ],
    warning: 'Dirty rubber will smear even a perfectly treated windscreen - don\'t skip this one.'
  },
  {
    phase: 'External Mirrors', icon: 'mirror', title: 'Clean the mirror glass',
    body: 'Spray a small amount of <span class="product_Autoglym_fastGlass">Autoglym Fast Glass</span> onto a dedicated <b>glass cloth</b> and wipe the mirror face clean. It evaporates instantly and strips away any stray quick detailer or shampoo oils.',
    warning: 'Keep hydrophobics off mirrors - Never let <span class="product_BH">Bilt Hamber Auto-QD</span> touch your mirror glass. If a hydrophobic product gets onto the mirror, rain forms tiny beads that sit stationary and distort your view of traffic behind you, especially at night or in heavy rain.'
  },
  {
    phase: 'Dress Tyres & plastic trim', icon: 'equipment', title: 'Deep black tyres and plastics',
    body: [
      'Using a brush dipped in <span class="product_Autoglym_tyreDressing">Autoglym Instant Tyre Dressing</span>, spread a small amount around the tyre wall.',
      'Avoid the Alloys and any bodywork.',
      'Wait a few seconds and remove any excess with a microfibre cloth.',
      'Repeat for each wheel.',
      'Repeat on the black plastic trim just above the exhaust tips. Spread on, wait and buff off.'
    ]
  },
  {
    phase: 'Final check', icon: 'equipment', title: 'Final check around car',
    body: [
      'Walk around car with a new microfibre cloth and check all panels are clean and dry.',
      'Empty buckets.',
      'Split out the Orange wash mitt (wheels only), lower sill/door jamb microfibres, tyre dressing cloths - basically anything that can contain hardened grit.',
      'Use the pressure washer to get ALL of the brake dust, and surface grit out of them (IMPORTANT!).',
      'Then put all cloths/towels/mitts used in the washing machine (30-40deg, no powder, no fabric softener).'
    ],
    warning: 'High heat melts the synthetic polyester/polyamide blend, hardening the edges, so keep the wash cool.'
  }
];
```

# FILE: .\index.html
```
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<meta name="theme-color" content="#1E8A9B">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<title>Austral Wash Bay</title>
	<link href="styles.css" rel="stylesheet">

</head>
<body>
<div id="app">

  <div class="topbar">
  <button class="iconbtn" id="backBtn" aria-label="Back to menu">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" id="backIcon"></svg>
  </button>
  <h1 id="topTitle">Car Wash Routine</h1>
  <div style="display: flex; gap: 8px;">
    <button class="iconbtn" id="infoBtn" aria-label="Chemical Cheat Sheet">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
    </button>
    <button class="iconbtn" id="calcBtn" aria-label="Dilution Calculator">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10 2v7.31a2 2 0 0 1-.29.98L4.14 19.4A2 2 0 0 0 5.81 22h12.38a2 2 0 0 0 1.67-2.6l-5.57-9.11a2 2 0 0 1-.29-.98V2"/>
        <path d="M8.5 2h7M7 16h10"/>
      </svg>
    </button>
    <button class="iconbtn" id="fullscreenBtn" aria-label="Toggle fullscreen" onclick="toggleFullScreen()"></button>

    <button class="iconbtn" id="themeBtn" aria-label="Toggle theme"></button>
  </div>
</div>

  <div id="home">
    <div class="hero-eyebrow">Renault Austral · YA24UGM</div>
    <h2 class="hero-title">Car Wash routine</h2>
    <!--p class="hero-sub">Pick a schedule below;</p-->

    <div id="remindersWrap"></div>

    <div class="schedule-row">
      <button class="schedule-card sc-a" id="cardTen">
        <div class="badge">
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="24" r="16"/><path d="M24 15v9l6 4"/></svg>
        </div>
        <p class="sc-title">Regular Wash</p>
      </button>

      <button class="schedule-card sc-b" id="cardDeep">
        <div class="badge">
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M24 6l14 6v10c0 10-6 17-14 20-8-3-14-10-14-20V12l14-6z"/></svg>
        </div>
        <p class="sc-title">Deep Clean</p>
      </button>
    </div>

    <div id="weatherCard" class="wx-card">
      <div id="weatherDetails">
        <div class="wx-empty-msg">Loading wash conditions...</div>
      </div>
    </div>

    <div class="cal-card">
      <div class="cal-head">
        <p class="section-label">Next 14 Days</p>
        <div class="cal-legend">
          <span><i class="cal-dot green"></i>Good</span>
          <span><i class="cal-dot orange"></i>OK</span>
          <span><i class="cal-dot red"></i>Poor</span>
        </div>
      </div>
      <div class="cal-weekdays"><div>M</div><div>T</div><div>W</div><div>T</div><div>F</div><div>S</div><div>S</div></div>
      <div class="cal-grid" id="calGrid"></div>
      <p class="cal-foot-note" id="calFootNote"></p>
    </div>

    <!-- Add Log Book trigger on home screen -->
    <button class="schedule-card" id="logBookBtn" style="border-style:dashed;">
      <div class="badge" style="background:var(--surface-2); color:var(--text);">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
      </div>
      <div>
        <p class="sc-title">Wash Log Book</p>
        <p class="sc-meta" id="lastWashMeta">No recent washes logged</p>
      </div>
    </button>

    <div class="cal-card" id="productMetersCard">
      <p class="section-label" style="margin-bottom:10px;">Product Protection</p>
      <div id="productMeters"></div>
    </div>

  </div>

  <div id="deepCleanSelect" class="hidden">
    <div class="hero-eyebrow">Wash Setup</div>
    <h2 class="hero-title">What are you doing today?</h2>
    <p class="hero-sub">Adjust anything below - steps you don't need are skipped automatically.</p>

    <div id="setupGroups"></div>

    <div id="deepCleanSelectFoot">
      <button class="finish-btn" id="beginDeepCleanBtn">Begin Wash</button>
    </div>
  </div>

  <div id="stepScreen" class="hidden">
    <div class="progress-wrap">
      <div class="progress-track" id="progressTrack"></div>
      <div class="progress-label"><span id="progPhase">Phase</span><span id="progFrac" class="num">1 / 1</span></div>
    </div>

    <div class="carousel-viewport" id="carouselViewport">
      <div class="carousel-track" id="carouselTrack"></div>
    </div>
    
    <div class="scroll-cue hidden" id="scrollCue">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
    </div>

    <!--div class="step-counter num" id="stepCounter">Step 1 of 20</div>
    <div class="navbar">
      <button class="navbtn" id="prevBtn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
        Back
      </button>
      <button class="navbtn primary" id="nextBtn">
        Next
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
      </button>
    </div-->
  </div>

  <div id="doneScreen" class="hidden">
    <div class="dbadge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg></div>
    <h2>Wash completed</h2>
    <p id="doneText">Nice work - every step in this schedule is done.</p>
    <div id="reviewListWrap">
      <p class="cal-foot-note" id="reviewListNote" style="text-align:center; margin:0 0 8px;"></p>
      <div id="reviewList"></div>
    </div>
    <div class="navbar" style="border:none; padding:0; width:100%; max-width:280px;">
      <button class="navbtn" id="reviewBtn">Review steps</button>
      <button class="navbtn primary" id="doneHomeBtn">Done</button>
    </div>
  </div>

</div>

<!-- Log Book Modal -->
<div id="logModal" class="hidden">
  <div class="modal-card">
    <h3>Wash Log</h3>

    <div style="display:flex; gap:8px; margin:14px 0 4px;">
      <button class="navbtn" id="exportLogsBtn" style="flex:1;">Export JSON</button>
      <button class="navbtn" id="importLogsBtn" style="flex:1;">Import JSON</button>
      <input type="file" id="importLogsInput" accept="application/json,.json" class="hidden">
    </div>
    <p style="font-size:10.5px; color:var(--text-dim); margin:4px 0 0; line-height:1.4;">Export saves a backup .json file you can keep somewhere safe (cloud drive, email to self). Import adds washes from a backup file back into this log - duplicates are skipped automatically.</p>

    <p style="font-size:12px; font-weight:700; margin-bottom:6px; margin-top:14px;">PAST WASHES</p>
    <div id="logList" style="max-height:260px; overflow-y:auto; display:flex; flex-direction:column; gap:8px;"></div>
    
    <p style="text-align:center; font-size:12px; color:var(--text-dim); margin-top:15px; margin-bottom:0;">Tap anywhere outside to close</p>
  </div>
</div>

<!-- Day Hourly Modal -->
<div id="dayModal" class="hidden">
  <div class="modal-card">
    <h3 id="dayModalTitle">Hourly outlook</h3>
    <div id="dayModalBody" style="margin-top:12px;"></div>
    <p style="text-align:center; font-size:12px; color:var(--text-dim); margin-top:15px; margin-bottom:0;">Tap anywhere outside to close</p>
  </div>
</div>

<!-- Dilution Modal -->
<div id="calcModal" class="hidden">
  <div class="modal-card">
    <h3>Dilution Calculator</h3>
    <div style="display:flex; flex-direction:column; gap:12px; margin-top:12px;">
      <label style="font-size:12px; font-weight:700;">PRODUCT
        <select id="calcProduct" style="width:100%; padding:8px; border-radius:8px; border:1px solid var(--border); background:var(--surface-2); color:var(--text); margin-top:4px;">
          <option value="bh_touchless">Bilt Hamber Touch-Less</option>
          <option value="bh_surfex">Bilt Hamber Surfex-HD</option>
          <option value="bh_qd">Bilt Hamber Auto-QD</option>
          <option value="bh_wash">Bilt Hamber Auto-Wash</option>
          <option value="bh_touchon">Bilt Hamber Touch-On</option>
        </select>
      </label>

      <label style="font-size:12px; font-weight:700;">RATIO
        <select id="calcRatio" style="width:100%; padding:8px; border-radius:8px; border:1px solid var(--border); background:var(--surface-2); color:var(--text); margin-top:4px;"></select>
      </label>

      <label style="font-size:12px; font-weight:700;">CONTAINER SIZE (ml)
        <input type="number" id="calcSize" value="400" style="width:100%; padding:8px; border-radius:8px; border:1px solid var(--border); background:var(--surface-2); color:var(--text); margin-top:4px;">
      </label>

      <div id="calcResult" style="padding:12px; background:var(--surface-2); border-radius:10px; border:1px solid var(--border); font-size:13.5px; line-height:1.5; margin-top:6px;"></div>
    </div>
    <p style="text-align:center; font-size:12px; color:var(--text-dim); margin-top:15px; margin-bottom:0;">Tap anywhere outside to close</p>
  </div>
</div>

<div id="infoModal" class="hidden">
  <div class="modal-card">
    <h3>Chemical Usage Rules</h3>
    <div class="step-body">
      <p><b>DO NOT USE:</b></p>
      <ul>
        <li><span class="product_BH">Bilt Hamber Auto-QD (1:20)</span> on Glass, mirrors, or alloy wheels</li>
        <li><span class="product_rainx">Rain-X</span> on Side mirrors, unpainted black plastics, or bodywork</li>
        <li><span class="product_BH">Bilt Hamber Auto-Korrosol</span> on Grill meshes, badges, seals, or hot surfaces</li>
        <li><span class="product_Autoglym_carGlass">Autoglym Car Glass Polish</span> on Plastic trim, window surrounds, or screens</li>
      </ul>
      <p><b>ALWAYS DILUTE:</b></p>
      <ul>
          <li><span class="product_BH">Bilt Hamber Auto-QD</span>: ALWAYS 1:20 (24ml/25g for 476ml/476g Distilled water)</li>
          <li><span class="product_BH">Bilt Hamber Surfex-HD</span>: ALWAYS 1:10 (45ml/48g for 455ml/455g tap water) for arches, tyres &amp; jambs, Can be diluted further 1:100 to be used on interior vinyl, dashboard plastics, steering wheels, leather (spot testing first), and light fabric upholstery stains</li>
          <li><span class="product_BH">Bilt Hamber Touch-Less</span>: 1:15 for weekly (25ml for 375ml warm tap water), 1:5 for deep clean (67ml for 333ml warm tap water)</li>
          <li><span class="product_BH">Bilt Hamber Auto-Wash</span>: 1:2000 (1 tsp/5ml/5g per 10L/10kg warm tap water)</li>
      </ul>
      <p><b>NEVER DILUTE:</b></p>
      <ul>
        <li><span class="product_Autoglym_fastGlass">Autoglym Fast Glass</span></li>
        <li><span class="product_Autoglym_carGlass">Autoglym Car Glass Polish</span></li>
        <li><span class="product_rainx">Rain-X</span></li>
        <li><span class="product_Autoglym_tyreDressing">Autoglym Instant Tyre Dressing</span></li>
        <li><span class="product_BH">Bilt Hamber Auto-Wheel</span></li>
        <li><span class="product_BH">Bilt Hamber Auto-Korrosol</span></li>
      </ul>
    </div>
    <p style="text-align:center; font-size:12px; color:var(--text-dim); margin-top:15px; margin-bottom:0;">Tap anywhere to close</p>
  </div>
</div>


    <script src="constants.js"></script>
    <script src="app.js"></script>

<script>


// Initialise
renderLogs();
renderProductMeters();
updateReminders();
fetchWashWeather();

</script>
</body>
</html>
```


# FILE: .\styles.css
```

  :root{
    --bg:#EFF2F1; --surface:#FFFFFF; --surface-2:#F5F7F6;
    --text:#1B2226; --text-dim:#5C6A72;
    --accent:#1E8A9B; --accent-soft:#DCEEEF;
    --amber:#C77D1E; --amber-bg:#C77D1E7A; --amber-soft:#F6E7D2;
    --warn:#C43D33;--warn-bg:#C43D337A; --warn-soft:#FBE2DF;
    --good:#2E9E5B;--good-bg:#2E9E5B7A; --good-soft:#DCF0E3;
    --border:#D8DEDC; --shadow:0 2px 10px rgba(20,30,32,0.08);
    --shadow-lg:0 10px 30px rgba(20,30,32,0.12), 0 2px 8px rgba(20,30,32,0.06);
    --ease:cubic-bezier(.22,.61,.36,1);
  }
  [data-theme="dark"]{
    --bg:#14181C; --surface:#1E252B; --surface-2:#262E35;
    --text:#E8EDF0; --text-dim:#8B98A3;
    --accent:#54C2D1; --accent-soft:#1E3A3F;
    --amber:#E8A33D; --amber-bg:#E8A33D7A; --amber-soft:#3A2E17;
    --warn:#E0524A; --warn-bg:#E0524A7A; --warn-soft:#3A1F1D;
    --good:#49C57E; --good-bg:#49C57E7A; --good-soft:#1B3626;
    --border:#2E3841; --shadow:0 2px 14px rgba(0,0,0,0.4);
    --shadow-lg:0 14px 34px rgba(0,0,0,0.5), 0 2px 10px rgba(0,0,0,0.3);
  }
  *{box-sizing:border-box; -webkit-tap-highlight-color:transparent;}
  html,body{height:100%;}
  body{
    margin:0; background:var(--bg); color:var(--text);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,ui-sans-serif,sans-serif;
    overscroll-behavior:none; transition:background .25s ease,color .25s ease;
  }
  .num{font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace; font-variant-numeric:tabular-nums;}
  button{font-family:inherit;}
  #app{max-width:360px; margin:0 auto; height:100vh; height:100dvh; display:flex; flex-direction:column; overflow:hidden; position:relative;}

  @media (prefers-reduced-motion: reduce){
    *, *::before, *::after{
      animation-duration:.001ms !important; animation-iteration-count:1 !important;
      transition-duration:.001ms !important; scroll-behavior:auto !important;
    }
  }

  /* ---------- top bar ---------- */
  .topbar{
    display:flex; align-items:center; justify-content:space-between;
    padding:14px 2px calc(10px + env(safe-area-inset-top,0px));
    padding-top:calc(14px + env(safe-area-inset-top,0px));
    border-bottom:1px solid var(--border); flex-shrink:0;
    height: 60px;
  }
  .topbar h1{font-size:13px; font-weight:700; letter-spacing:.02em; margin:0;}
  .iconbtn{
    width:38px; height:38px; border-radius:10px; border:1px solid var(--border);
    background:var(--surface); color:var(--text); display:flex; align-items:center; justify-content:center;
    cursor:pointer; transition:transform .15s var(--ease), background .15s ease;
  }
  .iconbtn:active{transform:scale(.88);}
  .iconbtn svg{width:19px; height:19px;}

  /* ---------- home screen ---------- */
  #home{
    flex:1; display:flex; flex-direction:column; padding:22px 20px 20px; overflow-y:auto;
    transition: opacity .32s var(--ease), transform .32s var(--ease);
  }
  #home.fade-out{
    opacity:0;
    transform:scale(0.96);
    pointer-events:none;
  }
  .hero-eyebrow{font-size:11px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:var(--accent);}
  .hero-title{font-size:clamp(23px,6.6vw,27px); font-weight:800; letter-spacing:-.015em; /*margin:6px 0 2px;*/ line-height:1.16;text-align: center;}
  .hero-sub{font-size:13.5px; color:var(--text-dim); margin:0 0 26px; line-height:1.5;}

  .hero-eyebrow, .hero-title, .hero-sub, .schedule-card, .home-foot{
    opacity:0; transform:translateY(14px);
    animation:riseIn .6s var(--ease) forwards;
  }
  .hero-eyebrow{animation-delay:.02s;}
  .hero-title{animation-delay:.08s;}
  .hero-sub{animation-delay:.14s;}
  #cardTen{animation-delay:.2s; background: #4aacba69;}
  #cardDeep{animation-delay:.28s; background: #c38a3466;}
  .home-foot{animation-delay:.36s;}
  @keyframes riseIn{ to{opacity:1; transform:translateY(0);} }

  .schedule-card{
    position:relative; overflow:hidden;
    display:flex; align-items:center; gap:14px; background:var(--surface);
    border:1px solid var(--border); border-radius:16px; padding:18px; margin-bottom:14px;
    cursor:pointer; box-shadow:var(--shadow); text-align:left; width:100%; color:var(--text);
    transition:transform .16s var(--ease), box-shadow .16s var(--ease);
    min-height: 74px;
  }
  .schedule-card:active{transform:scale(.97); box-shadow:var(--shadow);}
  .schedule-card::after{
    content:''; position:absolute; top:0; left:-60%; width:35%; height:100%;
    background:linear-gradient(115deg, transparent, rgba(255,255,255,.4), transparent);
    transform:skewX(-18deg); pointer-events:none;
    animation:sheen 1.1s ease-out 1.05s 1;
  }
  #cardDeep::after{animation-delay:1.2s;}
  [data-theme="dark"] .schedule-card::after{background:linear-gradient(115deg, transparent, rgba(255,255,255,.14), transparent);}
  @keyframes sheen{ from{left:-60%;} to{left:130%;} }
  .schedule-card .badge{
    width:52px; height:52px; border-radius:13px; flex-shrink:0;
    display:flex; align-items:center; justify-content:center;
  }
  .schedule-card .badge svg{width:26px; height:26px;}
  .sc-a .badge{background:var(--accent-soft); color:var(--accent);}
  .sc-b .badge{background:var(--amber-soft); color:var(--amber);}
  .schedule-card .sc-title{font-size:17.5px; font-weight:700; margin:0 0 3px;}
  .schedule-card .sc-meta{font-size:12.5px; color:var(--text-dim); margin:0;}
  .schedule-card .chev{margin-left:auto; color:var(--text-dim); flex-shrink:0; transition:transform .16s var(--ease);}
  .schedule-card:active .chev{transform:translateX(3px);}
  .schedule-card .chev svg{width:16px; height:16px;}
  .home-foot{margin-top:auto; padding-top:20px; font-size:11.5px; color:var(--text-dim); text-align:center;}

  /* ---------- progress strip ---------- */
  .progress-wrap{border-bottom:1px solid var(--border); background:var(--surface); flex-shrink:0; z-index:5;}
  .progress-track{display:flex; align-items:center; gap:5px; padding:11px 12px; overflow-x:auto; scrollbar-width:none;}
  .progress-track::-webkit-scrollbar{display:none;}
  .dot{
    flex-shrink:0; width:9px; height:9px; border-radius:50%; background:var(--border);
    border:none; padding:0; cursor:pointer;
    transition:width .28s var(--ease), border-radius .28s var(--ease), background .28s ease, transform .15s var(--ease);
  }
  .dot:active{transform:scale(.8);}
  .dot.visited{background:var(--text-dim);}
  .dot.current{width:22px; border-radius:5px; background:var(--accent);}
  .phase-gap{width:1px; height:14px; background:var(--border); flex-shrink:0; margin:0 2px;}
  .progress-label{padding:0 16px 9px; font-size:11px; color:var(--text-dim); display:flex; justify-content:space-between;}

  /* ---------- step screen ---------- */
  #stepScreen{
    flex:1; display:flex; flex-direction:column; min-height:0; overflow:hidden; position:relative;
    opacity:1; transition:opacity .35s var(--ease);
  }
  
  .carousel-viewport{
    flex:1; width:100%; height:100%; overflow:hidden; position:relative; touch-action:pan-y;
  }

  .carousel-track{
    display:flex; height:100%; width:100%; will-change:transform;
  }

  .step-slide{
    min-width:100%; width:100%; height:100%; overflow-y:auto; padding:22px 20px 14px;
    flex-shrink:0; opacity:0.3; transition:opacity .25s ease;
    box-sizing:border-box;
  }
  .step-slide.active{
    opacity:1;
  }

  .phase-eyebrow{
    font-size: 18px;
    font-weight: 700;
    letter-spacing: .12em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 14px;
    justify-content: center;
    text-align: center;
    background: var(--surface-2);
    min-height: 48px;
    display: flex;
    align-items: center;
    border-radius: 10px;
    border: 1px solid var(--border);
  }
  .step-head{display:flex; align-items:flex-start; gap:14px; margin-bottom:18px;}
  .step-icon{
    width:56px; height:56px; border-radius:15px; background:var(--surface-2); border:1px solid var(--border);
    display:flex; align-items:center; justify-content:center; flex-shrink:0; color:var(--accent);
  }
  .step-icon svg{width:28px; height:28px;}
  .step-title{font-size:clamp(19px,5.4vw,21px); font-weight:800; line-height:1.2; letter-spacing:-.01em; margin:2px 0 0;}
  .step-body{font-size:15.5px; line-height:1.6; color:var(--text); margin:0 0 16px;}
  .step-body ul{margin:0; padding-left:20px;}
  .step-body li{margin-bottom:8px;}
  .callout{
    display:flex; gap:10px; padding:13px 14px; border-radius:13px; margin:0 0 16px;
    border:1px solid var(--warn); background:var(--warn-soft);
  }
  .callout svg{width:19px; height:19px; color:var(--warn); flex-shrink:0; margin-top:1px;}
  .callout p{margin:0; font-size:13.5px; line-height:1.5; font-weight:600; color:var(--text);}

  /* Enhanced Dwell Timer Box with Range Tag */
  .timer-box{
    display:flex; align-items:center; flex-wrap:wrap; gap:14px; padding:14px; border-radius:14px;
    background:var(--amber-soft); border:1px solid var(--amber); margin-bottom:16px;
    transition:background .25s ease, border-color .25s ease;
  }
  .timer-box.alarm{
    border-color:var(--warn); background:var(--warn-soft);
    animation:alarmPulse 1s ease-in-out infinite;
  }
  @keyframes alarmPulse{
    0%,100%{box-shadow:0 0 0 0 rgba(196,61,51,.35);}
    50%{box-shadow:0 0 0 9px rgba(196,61,51,0);}
  }
  .timer-box.alarm .tname{color:var(--warn);}
  .timer-ring{position:relative; width:46px; height:46px; flex-shrink:0;}
  .timer-ring svg{width:46px; height:46px; transform:rotate(-90deg);}
  .timer-ring circle{fill:none; stroke-width:4;}
  .timer-ring .bg{stroke:rgba(199,125,30,.25);}
  [data-theme="dark"] .timer-ring .bg{stroke:rgba(232,163,61,.22);}
  .timer-ring .fg{stroke:var(--amber); stroke-linecap:round; transition:stroke-dashoffset 1s linear, stroke .25s ease;}
  .timer-box.alarm .timer-ring .fg{stroke:var(--warn);}
  .timer-ring .tlabel{
    position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
    font-size:11px; font-weight:700; color:var(--amber);
  }
  .timer-box.alarm .timer-ring .tlabel{color:var(--warn);}
  .timer-info{flex:1; min-width:0;}
  .timer-info .tname-row{display:flex; align-items:center; gap:6px; margin-bottom:2px;}
  .timer-info .tname{font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--amber); margin:0;}
  .timer-range-badge{
    font-size:10.5px; font-weight:800; padding:2px 6px; border-radius:6px;
    background:var(--amber); color:#fff; letter-spacing:0;
  }
  .timer-info .tdur{font-size:13px; color:var(--text-dim); margin:0;}
  .timer-btn{
    border:none; background:var(--amber); color:#fff; font-weight:700; font-size:13px;
    padding:9px 14px; border-radius:10px; cursor:pointer; flex-shrink:0;
    transition:transform .14s var(--ease), background .2s ease;
  }
  .timer-btn:active{transform:scale(.93);}
  .timer-btn.running{background:transparent; border:1.5px solid var(--amber); color:var(--amber);}
  .timer-btn.done{background:var(--warn);}
  .timer-dismiss{
    border:none; background:var(--warn); color:#fff; font-weight:700; font-size:12.5px;
    padding:9px 13px; border-radius:10px; cursor:pointer; flex-shrink:0;
    transition:transform .14s var(--ease), opacity .2s ease;
    animation:dismissPop .3s var(--ease);
  }
  .timer-dismiss:active{transform:scale(.93);}
  @keyframes dismissPop{ from{opacity:0; transform:scale(.7);} to{opacity:1; transform:scale(1);} }

  .finish-btn{
    display:flex; align-items:center; justify-content:center; gap:8px; width:100%;
    border:none; background:var(--accent); color:#fff; font-weight:800; font-size:16px;
    padding:15px; border-radius:14px; cursor:pointer; margin:6px 0 16px;
    box-shadow:var(--shadow); transition:transform .14s var(--ease), background .2s ease;
  }
  .finish-btn svg{width:20px; height:20px;}
  .finish-btn:active{transform:scale(.96);}

  .scroll-cue{
    position:sticky; bottom:0; left:0; right:0; height:34px; margin-top:-34px;
    background:linear-gradient(to bottom, transparent, var(--bg) 78%);
    display:flex; align-items:flex-end; justify-content:center; pointer-events:none; z-index:8;
  }
  .scroll-cue svg{width:20px; height:20px; color:var(--text-dim); animation:bob 1.4s ease-in-out infinite;}
  @keyframes bob{0%,100%{transform:translateY(0);}50%{transform:translateY(4px);}}

  .swipe-hint{ animation:swipeHint 1s var(--ease) .35s; }
  @keyframes swipeHint{
    0%,100%{transform:translateX(0);}
    28%{transform:translateX(-16px);}
    55%{transform:translateX(7px);}
    78%{transform:translateX(-5px);}
  }

  /* ---------- nav bar ---------- */
  .navbar{
    display:flex; gap:10px; padding:12px 16px calc(14px + env(safe-area-inset-bottom,0px));
    border-top:1px solid var(--border); /*background:var(--surface);*/ flex-shrink:0; z-index:10;
  }
  .navbtn{
    flex:1; display:flex; align-items:center; justify-content:center; gap:6px;
    padding:4px 10px; border-radius:13px; border:1px solid var(--border); background:var(--surface-2);
    color:var(--text); font-size:14.5px; font-weight:700; cursor:pointer;
    transition:transform .13s var(--ease), background .2s ease;
  }
  .navbtn:active:not(:disabled){transform:scale(.95);}
  .navbtn svg{width:17px; height:17px;}
  .navbtn.primary{background:var(--accent); border-color:var(--accent); color:#fff;}
  .navbtn:disabled{opacity:.35; cursor:default;}
  .navbtn.finish{background:var(--accent);}

  .step-counter{font-size:12px; color:var(--text-dim); text-align:center; padding:0 0 8px; flex-shrink:0; z-index:10;}

  .hidden{display:none !important;}

  .product_BH, .product_rainx, .product_turtleWax, .product_Autoglym_fastGlass, .product_Autoglym_carGlass,.product_Autoglym_tyreDressing {
    border-radius: 5px;
    padding: 0px 5px;
  }
  .product_BH { background-color: #0a7ef299; }
  .product_rainx { background-color: #F5CE0D99; color: black; }
  .product_turtleWax { background-color: #02643399; }
  .product_Autoglym_fastGlass { background-color: #B15F2C99; }
  .product_Autoglym_carGlass { background-color: #B15F2C99; }
  .product_Autoglym_tyreDressing { background-color: #B15F2C99; }

  /* ---------- compact schedule row (2-col) ---------- */
  .schedule-row{display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:16px;}
  .schedule-row .schedule-card{
    /* flex-direction:column;*/ align-items:flex-start; gap:8px; padding:13px; margin-bottom:0; text-align:left; justify-content: center; align-items: center; }
  .schedule-row .schedule-card .badge{width:38px; height:38px; border-radius:10px;}
  .schedule-row .schedule-card .badge svg{width:19px; height:19px;}
  .schedule-row .schedule-card .sc-title{font-size:17.5px; margin:0; line-height:1.25;}
  .schedule-row .schedule-card .sc-meta{display:none;}
  .schedule-row .schedule-card .chev{display:none;}

  /* ---------- v15: wash setup / selection screen ---------- */
  .setup-group{margin-bottom:18px;}
  .setup-group-label{font-size:11px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--text-dim); margin:0 0 8px;}
  .radio-row{
    display:flex; align-items:center; gap:14px; width:100%;
    background:var(--surface); border:1.5px solid var(--border); border-radius:15px;
    padding:13px 15px; margin:0 0 8px; cursor:pointer; user-select:none;
    box-shadow:var(--shadow); transition:border-color .18s ease, background .18s ease;
  }
  .radio-row.checked{border-color:var(--accent); background:var(--accent-soft);}
  .radio-row.overdue.checked{border-color:var(--warn); background:var(--warn-bg);}
  .radio-row.soon.checked{border-color:var(--amber); background:var(--amber-bg);}
  .radio-row.ok.checked{border-color:var(--good); background:var(--good-bg);}
  .radio-row .radio-dot{
    flex-shrink:0; width:22px; height:22px; border-radius:50%; border:2px solid var(--border);
    background:var(--surface-2); position:relative; transition:border-color .16s ease;
  }
  .radio-row.overdue .radio-dot{
    border:2px solid var(--warn);
    background:var(--warn-bg); position:relative; transition:border-color .16s ease;
  }
  .radio-row.soon .radio-dot{
    border:2px solid var(--amber);
    background:var(--amber-bg); position:relative; transition:border-color .16s ease;
  }
  .radio-row.ok .radio-dot{
    border:2px solid var(--good);
    background:var(--good-bg); position:relative; transition:border-color .16s ease;
  }
  .radio-row.checked .radio-dot{border-color:var(--accent);}
  .radio-row.checked .radio-dot::after{
    content:''; position:absolute; inset:4px; border-radius:50%; background:var(--accent);
  }
  .radio-row.overdue.checked .radio-dot{border-color:var(--warn-soft);}
  .radio-row.overdue.checked .radio-dot::after{
    background:var(--warn-soft);
  }
  .radio-row.soon.checked .radio-dot{border-color:var(--amber-soft);}
  .radio-row.soon.checked .radio-dot::after{
    background:var(--amber-soft);
  }
  .radio-row.ok.checked .radio-dot{border-color:var(--good-soft);}
  .radio-row.ok.checked .radio-dot::after{
    background:var(--good-soft);
  }
  .radio-row .rr-text{flex:1; min-width:0;}
  .radio-row .rr-title{font-size:14.5px; font-weight:700; color:var(--text); margin:0;}
  .radio-row .rr-sub{font-size:11.5px; color:var(--text-dim); margin:2px 0 0; line-height:1.4;}
  .due-pill{
    display:inline-block; font-size:10.5px; font-weight:800; padding:2px 7px; border-radius:6px;
    margin-top:5px; letter-spacing:.01em;
  }
  .due-pill.ok, .radio-row.ok {background:var(--good-soft); color:var(--good);}
  .radio-row.ok {border:1.5px solid var(--good);}
  .due-pill.soon, .radio-row.soon {background:var(--amber-soft); color:var(--amber);}
  .radio-row.soon {border:1.5px solid var(--amber);}
  .due-pill.overdue, .radio-row.overdue {background:var(--warn-soft); color:var(--warn);}
  .radio-row.overdue {border:1.5px solid var(--warn);}
  .due-pill.never, .radio-row.never {background:var(--surface-2); color:var(--text-dim);}

  /* ---------- v15: reminders on home ---------- */
  #remindersWrap .overdue-banner:last-child{margin-bottom:14px;}
  .overdue-banner.soon, .overdue-banner.due{background:var(--amber-soft); border-color:var(--amber);}
  .overdue-banner.soon svg, .overdue-banner.due svg{color:var(--amber);}
  .overdue-banner.soon b, .overdue-banner.due b{color:var(--amber);}

  /* ---------- v15: done screen review list ---------- */
  .review-item{
    display:flex; align-items:center; gap:12px; width:100%; max-width:280px;
    background:var(--surface); border:1.5px solid var(--border); border-radius:13px;
    padding:11px 13px; margin:0 0 8px; cursor:pointer; user-select:none; text-align:left;
    transition:border-color .16s ease, background .16s ease;
  }
  .review-item.checked{border-color:var(--accent); background:var(--accent-soft);}
  .review-item input[type="checkbox"]{
    -webkit-appearance:none; appearance:none; margin:0; flex-shrink:0;
    width:24px; height:24px; border-radius:7px; border:2px solid var(--border);
    background:var(--surface-2); cursor:pointer; position:relative;
  }
  .review-item input[type="checkbox"]:checked{background:var(--accent); border-color:var(--accent);}
  .review-item input[type="checkbox"]:checked::after{
    content:''; position:absolute; left:7px; top:3px; width:6px; height:11px;
    border:solid #fff; border-width:0 2.5px 2.5px 0; transform:rotate(40deg);
  }
  .review-item .ri-title{font-size:13.5px; font-weight:700; color:var(--text); margin:0;}
  #reviewListWrap{width:100%; max-width:280px;}

  /* ---------- v15: touch-on decision slide ---------- */
  .decision-btns{display:flex; gap:10px; margin:4px 0 16px;}
  .decision-btn{
    flex:1; padding:16px 10px; border-radius:14px; border:1.5px solid var(--border);
    background:var(--surface); color:var(--text); font-weight:800; font-size:15px; cursor:pointer;
    transition:transform .14s var(--ease), border-color .16s ease, background .16s ease;
  }
  .decision-btn:active{transform:scale(.96);}
  .decision-btn.yes.picked{border-color:var(--accent); background:var(--accent-soft); color:var(--accent);}
  .decision-btn.no.picked{border-color:var(--text-dim); background:var(--surface-2);}

  /* ---------- v15: log entry detail ---------- */
  .log-detail-line{font-size:10.5px; color:var(--text-dim); margin:3px 0 0; line-height:1.5;}
  .section-label{
    font-size:11px; font-weight:700; letter-spacing:.1em; text-transform:uppercase;
    color:var(--text-dim); margin:2px 0 8px;
  }

  /* ---------- weather card v3 ---------- */
  .wx-card{
    background:var(--surface); border:1px solid var(--border); border-radius:16px;
    padding:14px; margin-bottom:14px; box-shadow:var(--shadow);
  }
  .wx-summary-row{display:grid; grid-template-columns: 1fr auto 1fr; align-items:center; justify-content:space-between; gap:12px;}
  .wx-now-icon{
    width:40px; height:40px; flex-shrink:0; display:flex; align-items:center; justify-content:center;
    font-size:30px; line-height:1;
  }
  .wx-now-temp{font-size:26px; font-weight:800; line-height:1; white-space:nowrap;}
  .wx-now-temp sup{font-size:14px; font-weight:700; margin-left:1px;}
  .wx-now-block{display:flex; align-items:center; gap:8px; flex-shrink:0;}
  .wx-location-block{font-size:11.5px; font-weight:600; color:var(--text-dim); text-align:center; white-space:nowrap;}
  .wx-day-block{flex-shrink:0; text-align:right;}
  .wx-day-eyebrow{font-size:10px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--accent); margin:0;}
  .wx-day-name{font-size:11.5px; color:var(--text-dim); margin:2px 0 0;}
  .wx-headline-row{margin-top:12px; padding-top:11px; border-top:1px solid var(--border);}
  .wx-headline{font-size:13.5px; font-weight:700; color:var(--text); line-height:1.4; margin:0;}
  .wx-subline{font-size:12px; color:var(--text-dim); line-height:1.4; margin:3px 0 0;}

  .wx-strip{
    display:grid; gap:8px; overflow-x:auto; margin-top:13px; padding-bottom:2px;
    scroll-snap-type:x proximity; scrollbar-width:none;
    grid: auto;
    grid-template-columns: repeat(5, 1fr);
  }
  .wx-strip::-webkit-scrollbar{display:none;}
  .wx-empty-msg{font-size:12px; color:var(--text-dim); padding:10px 2px 2px; text-align:center;}

  /* ---------- deep clean overdue banner ---------- */
  .overdue-banner{
    display:flex; align-items:center; gap:10px; padding:12px 13px; border-radius:13px;
    background:var(--warn-soft); border:1px solid var(--warn); margin-bottom:14px;
  }
  .overdue-banner svg{width:20px; height:20px; color:var(--warn); flex-shrink:0;}
  .overdue-banner p{margin:0; font-size:12.5px; font-weight:600; line-height:1.4; color:var(--text);}
  .overdue-banner b{color:var(--warn);}

  /* ---------- product protection meters (v16) ---------- */
  .meter-row{margin-bottom:14px;}
  .meter-row:last-child{margin-bottom:0;}
  .meter-top{display:flex; justify-content:space-between; align-items:baseline; margin-bottom:5px; gap:8px;}
  .meter-name{font-size:13px; font-weight:700; color:var(--text);}
  .meter-last{font-size:10.5px; color:var(--text-dim); text-align:right;}
  .meter-track{
    position:relative; height:9px; border-radius:5px; background:var(--surface-2);
    border:1px solid var(--border); overflow:hidden;
  }
  .meter-fill{
    position:absolute; left:0; top:0; bottom:0; border-radius:5px 0 0 5px;
    transition:width .4s var(--ease), background .3s ease;
  }
  .meter-fill.full-width{border-radius:5px;}
  .meter-tier{font-size:10.5px; font-weight:700; margin-top:5px;}

  /* ---------- calendar ---------- */
  .cal-card{
    background:var(--surface); border:1px solid var(--border); border-radius:16px;
    padding:16px 14px; margin-bottom:14px; box-shadow:var(--shadow);
  }
  .cal-head{display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;}
  .cal-head .section-label{margin:0;}
  .cal-legend{display:flex; gap:9px; font-size:10px; color:var(--text-dim); align-items:center;}
  .cal-legend span{display:flex; align-items:center; gap:3px;}
  .cal-dot{width:7px; height:7px; border-radius:50%; display:inline-block;}
  .cal-dot.green{background:var(--good);}
  .cal-dot.orange{background:var(--amber);}
  .cal-dot.red{background:var(--warn);}
  .cal-weekdays{
    display:grid; grid-template-columns:repeat(7,1fr); gap:5px; margin:10px 0 5px;
    font-size:10px; font-weight:700; color:var(--text-dim); text-align:center; text-transform:uppercase;
  }
  .cal-grid{display:grid; grid-template-columns:repeat(7,1fr); gap:5px;}
  .cal-cell{
    aspect-ratio:1; border-radius:9px; display:flex; flex-direction:column; align-items:center;
    justify-content:center; position:relative; font-size:12.5px; font-weight:700; cursor:pointer;
    border:1px solid var(--border); background:var(--surface-2); color:var(--text);
    transition:transform .13s var(--ease);
  }
  .cal-cell:active{transform:scale(.9);}
  .cal-cell.pad{
    opacity:.32; cursor:default; pointer-events:none; background:transparent; border-color:transparent;
  }
  .cal-cell.green{background:var(--good-soft); border-color:var(--good); color:var(--text);}
  .cal-cell.orange{background:var(--amber-soft); border-color:var(--amber);}
  .cal-cell.red{background:var(--warn-soft); border-color:var(--warn);}
  .cal-cell.unknown{background:var(--surface-2);}
  .cal-marker{
    position:absolute; bottom:3px; display:flex; gap:2px;
  }
  .cal-marker .m{
    font-size:7px; font-weight:800; letter-spacing:.02em; padding:1px 3px; border-radius:4px;
    color:#fff; line-height:1.3;
  }
  .cal-marker .m.ten{background:var(--accent);}
  .cal-marker .m.deep{background:var(--amber);}
  .cal-today-ring{box-shadow:0 0 0 2px var(--accent) inset;}
  .cal-foot-note{font-size:11px; color:var(--text-dim); margin:10px 0 0; line-height:1.4;}

  /* ---------- hourly day modal ---------- */
  #dayModal{
    position:fixed; inset:0; background:rgba(0,0,0,0.7); backdrop-filter:blur(4px); z-index:999;
    display:flex; align-items:center; justify-content:center; padding:20px;
  }
  #dayModal.hidden{display:none !important;}

  /* done screen */
  #doneScreen{flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:32px; text-align:center;}
  #doneScreen .dbadge{
    width:74px; height:74px; border-radius:20px; background:var(--accent-soft); color:var(--accent);
    display:flex; align-items:center; justify-content:center; margin-bottom:18px;
    animation:popIn .45s var(--ease);
  }
  @keyframes popIn{ from{transform:scale(.5); opacity:0;} to{transform:scale(1); opacity:1;} }
  #doneScreen .dbadge svg{width:36px; height:36px;}
  #doneScreen .dbadge svg path{
    stroke-dasharray:30; stroke-dashoffset:30;
    animation:draw .5s var(--ease) .2s forwards;
  }
  @keyframes draw{ to{stroke-dashoffset:0;} }
  #doneScreen h2{
    font-size:22px; font-weight:800; margin:0 0 8px;
    opacity:0; animation:riseIn .5s var(--ease) .25s forwards;
  }
  #doneScreen p{
    font-size:14px; color:var(--text-dim); max-width:280px; line-height:1.5;
    opacity:0; animation:riseIn .5s var(--ease) .32s forwards;
  }
  #doneScreen .navbar{
    opacity:0; animation:riseIn .5s var(--ease) .4s forwards;
  }

  /* ---------- touch-on checkbox (done screen) ---------- */
  .touchon-row{
    display:flex; align-items:center; gap:14px; width:100%; max-width:280px;
    background:var(--surface); border:1.5px solid var(--border); border-radius:15px;
    padding:15px 16px; margin:0 0 18px; cursor:pointer; user-select:none;
    box-shadow:var(--shadow); transition:border-color .18s ease, background .18s ease;
    opacity:0; animation:riseIn .5s var(--ease) .36s forwards;
  }
  .touchon-row.checked{border-color:var(--accent); background:var(--accent-soft);}
  .touchon-row input[type="checkbox"]{
    -webkit-appearance:none; appearance:none; margin:0; flex-shrink:0;
    width:30px; height:30px; border-radius:9px; border:2px solid var(--border);
    background:var(--surface-2); cursor:pointer; position:relative;
    transition:background .16s ease, border-color .16s ease, transform .12s var(--ease);
  }
  .touchon-row input[type="checkbox"]:active{transform:scale(.9);}
  .touchon-row input[type="checkbox"]:checked{background:var(--accent); border-color:var(--accent);}
  .touchon-row input[type="checkbox"]:checked::after{
    content:''; position:absolute; left:9px; top:4px; width:7px; height:13px;
    border:solid #fff; border-width:0 3px 3px 0; transform:rotate(40deg);
  }
  .touchon-row .touchon-text{flex:1; min-width:0;}
  .touchon-row .touchon-title{font-size:14.5px; font-weight:700; color:var(--text); margin:0;}
  .touchon-row .touchon-sub{font-size:11.5px; color:var(--text-dim); margin:2px 0 0;}

  /* ---------- deep clean product selection screen ---------- */
  #deepCleanSelect{
    flex:1; display:flex; flex-direction:column; padding:22px 20px 20px; overflow-y:auto;
    transition: opacity .32s var(--ease), transform .32s var(--ease);
  }
  #deepCleanSelect.fade-out{ opacity:0; transform:scale(0.96); pointer-events:none; }
  .select-toggle-row{ max-width:none; width:100%; margin:0 0 14px; opacity:1; animation:none; }
  #deepCleanSelectFoot{margin-top:auto; padding-top:6px;}

  /* ---------- info modal ---------- */
  #infoModal, #logModal, #calcModal {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    z-index: 999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    opacity:1;
    transition:opacity .22s var(--ease);
  }
  #infoModal.hidden, #logModal.hidden, #calcModal.hidden{
    display:flex !important;
    opacity:0;
    pointer-events:none;
  }
  .modal-card {
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 16px;
    max-width: 350px;
    width: 100%;
    max-height: 85vh;
    overflow-y: auto;
    padding: 10px;
    box-shadow: var(--shadow-lg);
    transform:scale(1) translateY(0);
    transition:transform .22s var(--ease);
  }
  #infoModal.hidden .modal-card, #logModal.hidden .modal-card, #calcModal.hidden .modal-card{
    transform:scale(.94) translateY(10px);
  }
  .modal-card h3 {
    margin-top: 0;
    font-size: 18px;
    border-bottom: 1px solid var(--border);
    padding-bottom: 10px;
  }


  
    /* Individual Card Styles */
    .weather-card {
      background-color: #0b1a10;
      border-radius: 8px 8px 8px 8px;
      display: flex;
      overflow: hidden;
      /*! width: 140px; */
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
      flex-shrink: 0;
      border: 1px solid;
      opacity:1;
      height: 75px;
      overflow: hidden;
      position: relative;
    }

  .weather-card.ideal{background:var(--good-soft); border-color:var(--good);}
  .weather-card.ideal .card-sidebar{background:var(--good-bg);}
  .weather-card.marginal{background:var(--amber-soft); border-color:var(--amber);}
  .weather-card.marginal .card-sidebar{background:var(--amber-bg);}
  .weather-card.bad{background:var(--warn-soft); border-color:var(--warn);}
  .weather-card.bad .card-sidebar{background:var(--warn-bg);}
  .weather-card.now{opacity:1;}
  .weather-card .weather-icon{font-size:26px; line-height:1;padding-bottom: 5px;/*! position: absolute; */}
  .weather-card .weather-icon.ideal{color:var(--good);}
  .weather-card .weather-icon.marginal{color:var(--amber);}
  .weather-card .weather-icon.bad{color:var(--warn);}
  .weather-card .time-text{font-size:14px; color:var(--text);}
  .weather-card .temperature-wrapper{font-size:7.5px; /*! font-weight:800; */ color:var(--text);}
  .weather-card .temperature-wrapper .temp-text {
      font-size: 14px;
      font-weight: bold;
      line-height: 1;
    }

    /* Green Left Sidebar */
  .weather-card .card-sidebar {
      width: 15px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      padding: 5px 0;
    }

    /* Checkmark box at top of sidebar */
    .weather-card .status-icon {
      font-size: 11px;
      /*! background-color: rgba(255, 255, 255, 0.17); */
      border-radius: 3px;
      width: 12px;
      height: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 11px 13px 14px 12px;
      position: absolute;
      top: -1px;
      left: -5px;
    }

    /* Rotated Text ("11 00") inside sidebar */
    .time-text {
      writing-mode: vertical-lr;
      transform: rotate(180deg);
      font-size: 14px;
      font-weight: 500;
      letter-spacing: 0.5px;
      opacity: 0.6;
      position: absolute;
      bottom: 4px;
      left: -3px;
    }

    /* Main Content Section on the Right side */
    .card-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 10px 5px 12px 6px;
      color: #ffffff;
      overflow: hidden;
    }

    /* Main Temperature Area */
    .temperature-wrapper {
      text-align: center;
      width: 100%;
      border-bottom: 1.5px solid rgba(255, 255, 255, 0.22);
      padding-bottom: 4px;
      margin-bottom: 1px;
    }



    .degree-symbol {
      font-size: 11px;
      font-weight: normal;
      vertical-align: super;
    }

    /* Rain/Humidity Probability Percentage Info */
    .rain-probability {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 9px;
      color: #bfbfc7;
    }

    /* Built-in css droplet shape */
    .drop-icon {
      width: 5px;
      height: 5px;
      background-color: #55aaff;
      border-radius: 0 50% 50% 50%;
      transform: rotate(45deg);
      margin-top: 3px;
    }
```

