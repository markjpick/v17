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