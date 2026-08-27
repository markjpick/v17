/*
 * Austral Wash Bay - coating selection and protection logic.
 *
 * This file adapts the existing v17 application to the simplified coating model.
 * The older generic inline-decision machinery remains in app.js for future use;
 * Touch-On simply no longer uses it.
 */
(function () {
  'use strict';

  const COATING_CONFIG = {
    turtlewax: { label: 'Turtle Wax Ceramic Spray', shortLabel: 'Turtle Wax', targetDays: 180, orangeDays: 30, redDays: 10 },
    touchon:   { label: 'Bilt Hamber Touch-On', shortLabel: 'Touch-On', targetDays: 40, orangeDays: 14, redDays: 7 }
  };
  const MIN_DAYS_AFTER_TOUCHON_FOR_TURTLE = 40;
  const TURTLE_EARLY_WINDOW = 30;

  function daysSinceDate(iso) {
    return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
  }

  function lastLogWithSection(logs, key) {
    return logs.find(l => Array.isArray(l.sections) && l.sections.includes(key)) || null;
  }

  function lastCoatingLog(logs) {
    return logs.find(l => Array.isArray(l.sections) &&
      (l.sections.includes('touchon') || l.sections.includes('turtlewax'))) || null;
  }

  function productStatus(key, logs) {
    logs = logs || getLogs();
    const cfg = COATING_CONFIG[key];
    const last = key === 'touchon' ? lastCoatingLog(logs) : lastLogWithSection(logs, key);
    if (!last) return { key, last: null, daysSince: null, daysRemaining: null, state: 'never', anchoredByTurtleWax: false };

    const daysSince = daysSinceDate(last.date);
    const daysRemaining = cfg.targetDays - daysSince;
    let state = 'ok';
    if (daysRemaining <= 0) state = 'overdue';
    else if (daysRemaining <= cfg.redDays) state = 'red';
    else if (daysRemaining <= cfg.orangeDays) state = 'soon';

    const anchoredByTurtleWax = key === 'touchon' &&
      last.sections.includes('turtlewax') && !last.sections.includes('touchon');
    return { key, last: last.date, daysSince, daysRemaining, state, anchoredByTurtleWax };
  }

  const oldGetProductStatus = getProductStatus;
  getProductStatus = function (key, logs) {
    if (COATING_CONFIG[key]) return productStatus(key, logs);
    return oldGetProductStatus(key, logs);
  };

  /* Hard safety rule: a fresh Turtle Wax base coating must not be applied until
     40 complete days have passed since the last Touch-On application. */
  getTurtlewaxBlockInfo = function (logs) {
    logs = logs || getLogs();
    const lastTouch = lastLogWithSection(logs, 'touchon');
    if (!lastTouch) return { blocked: false, daysSinceTouchOn: null, daysUntilSafe: 0 };
    const age = daysSinceDate(lastTouch.date);
    return {
      blocked: age < MIN_DAYS_AFTER_TOUCHON_FOR_TURTLE,
      daysSinceTouchOn: age,
      daysUntilSafe: Math.max(0, MIN_DAYS_AFTER_TOUCHON_FOR_TURTLE - age)
    };
  };

  getTouchOnFullStatus = function (logs) {
    logs = logs || getLogs();
    const st = productStatus('touchon', logs);
    const tw = productStatus('turtlewax', logs);
    const safe = getTurtlewaxBlockInfo(logs);
    return Object.assign({}, st, {
      blocked: false,
      turtlewaxDaysRemaining: tw.daysRemaining,
      turtlewaxState: tw.state,
      turtlewaxBlocked: safe.blocked,
      daysUntilTurtlewaxSafe: safe.daysUntilSafe
    });
  };

  function formatDaysRemaining(days) {
    if (days === null || days === undefined) return 'No application logged yet';
    if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`;
    if (days === 0) return 'Due today';
    return `${days} day${days === 1 ? '' : 's'} until reapplication`;
  }

  function statusClass(st) {
    if (st.state === 'red') return 'urgent';
    if (st.state === 'due') return 'soon';
    return st.state;
  }

  function statusPillHtml(key, st) {
    if (st.state === 'never') return '<span class="due-pill never">Not yet applied</span>';
    const last = new Date(st.last).toLocaleDateString();
    const clockText = key === 'touchon' && st.anchoredByTurtleWax
      ? `clock started ${last} with Turtle Wax`
      : `last applied ${last}`;
    return `<span class="due-pill ${statusClass(st)}">${formatDaysRemaining(st.daysRemaining)} · ${clockText}</span>`;
  }

  /* Decides which coating should be recommended without changing the user's selection.
     If Touch-On is due and Turtle Wax is inside its 30-day early window, use Turtle Wax
     instead. Otherwise use Touch-On. A Turtle Wax choice is only safe after 40 days from
     the last Touch-On. */
  function recommendation(logs) {
    const tw = productStatus('turtlewax', logs);
    const to = productStatus('touchon', logs);
    const turtleSafe = getTurtlewaxBlockInfo(logs);

    if (tw.state === 'never') {
      return { key: 'turtlewax', text: 'No Turtle Wax has been logged yet. Apply the full Turtle Wax coating to establish the base protection.' };
    }

    if (to.state === 'overdue' || to.state === 'red') {
      if (!turtleSafe.blocked && tw.daysRemaining !== null && tw.daysRemaining <= TURTLE_EARLY_WINDOW) {
        const early = Math.max(0, tw.daysRemaining);
        return {
          key: 'turtlewax',
          early: true,
          text: early > 0
            ? `Just reapply Turtle Wax now, ${early} day${early === 1 ? '' : 's'} early.`
            : 'Turtle Wax is due now — reapply the full coating.'
        };
      }
      return {
        key: 'touchon',
        text: turtleSafe.blocked
          ? `Touch-On is due, but Turtle Wax cannot safely be applied until ${turtleSafe.daysUntilSafe} more day${turtleSafe.daysUntilSafe === 1 ? '' : 's'} after the last Touch-On.`
          : 'Touch-On is due — apply the ceramic top-up now.'
      };
    }
    return null;
  }

  dueInfoHtml = function (productKey) {
    if (!COATING_CONFIG[productKey]) return '';
    return statusPillHtml(productKey, productStatus(productKey));
  };

  dueInfoClass = function (productKey) {
    if (!COATING_CONFIG[productKey]) return '';
    return statusClass(productStatus(productKey));
  };

  renderSetupGroups = function () {
    const wrap = $('setupGroups');
    const logs = getLogs();
    const tw = productStatus('turtlewax', logs);
    const to = productStatus('touchon', logs);
    const turtleSafe = getTurtlewaxBlockInfo(logs);
    const rec = recommendation(logs);
    let html = '';

    SETUP_GROUPS.forEach(group => {
      html += `<div class="setup-group"><p class="setup-group-label">${group.label}</p>`;

      if (group.key === 'coating') {
        const options = [
          { value: 'none', title: 'No coating today', sub: 'Leave the existing ceramic protection untouched this wash.' },
          { value: 'turtlewax', title: 'Turtle Wax Ceramic Spray', sub: 'Full ceramic base coating for bodywork, lights and alloys. Reapply every 180 days.', product: 'turtlewax' },
          { value: 'touchon', title: 'Bilt Hamber Touch-On', sub: 'Ceramic top-up coating. Reapply every 40 days.', product: 'touchon' }
        ];

        options.forEach(opt => {
          const checked = setupDraft.coating === opt.value;
          const blocked = opt.value === 'turtlewax' && turtleSafe.blocked;
          const extra = opt.product ? statusPillHtml(opt.product, opt.product === 'turtlewax' ? tw : to) : '';
          let recommendationHtml = '';

          if (rec && rec.key === opt.value) {
            recommendationHtml = `<div class="coating-recommendation">RECOMMENDED — ${rec.text}</div>`;
          }
          if (blocked && opt.value === 'turtlewax') {
            recommendationHtml = `<div class="coating-blocked">Not available yet — wait ${turtleSafe.daysUntilSafe} more day${turtleSafe.daysUntilSafe === 1 ? '' : 's'} after Touch-On before applying Turtle Wax.</div>`;
          }

          html += `
            <label class="radio-row coating-option ${checked ? 'checked' : ''} ${opt.product ? statusClass(opt.product === 'turtlewax' ? tw : to) : ''} ${blocked ? 'blocked' : ''} ${rec && rec.key === opt.value ? 'recommended' : ''}"
              data-group="coating" data-value="${opt.value}">
              <div class="radio-dot"></div>
              <div class="rr-text">
                <p class="rr-title">${opt.title}</p>
                <p class="rr-sub">${opt.sub}</p>
                ${extra}
                ${recommendationHtml}
              </div>
            </label>`;
        });

        if (to.state !== 'never' && tw.daysRemaining !== null && tw.daysRemaining <= TURTLE_EARLY_WINDOW && tw.daysRemaining >= 0) {
          html += `<p class="rr-sub coating-note">Turtle Wax is within its 30-day early-reapplication window. If Touch-On becomes due, use Turtle Wax instead.</p>`;
        }
      } else {
        group.options.forEach(opt => {
          const checked = setupDraft[group.key] === opt.value;
          html += `
            <label class="radio-row ${checked ? 'checked' : ''} ${opt.product ? dueInfoClass(opt.product) : ''}" data-group="${group.key}" data-value="${opt.value}">
              <div class="radio-dot"></div>
              <div class="rr-text">
                <p class="rr-title">${opt.title}</p>
                ${opt.sub ? `<p class="rr-sub">${opt.sub}</p>` : ''}
                ${opt.product ? dueInfoHtml(opt.product) : ''}
              </div>
            </label>`;
        });
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
        const group = row.dataset.group;
        const value = row.dataset.value;
        if (group === 'coating' && value === 'turtlewax' && getTurtlewaxBlockInfo(getLogs()).blocked) {
          const safe = getTurtlewaxBlockInfo(getLogs());
          alert(`Turtle Wax cannot be applied yet. Wait ${safe.daysUntilSafe} more day${safe.daysUntilSafe === 1 ? '' : 's'} after Touch-On.`);
          return;
        }
        setupDraft[group] = value;
        renderSetupGroups();
      });
    });

    wrap.querySelectorAll('[data-addon-cb]').forEach(cb => {
      cb.addEventListener('click', e => e.stopPropagation());
      cb.addEventListener('change', () => {
        const key = cb.dataset.addonCb;
        setupDraft[key] = cb.checked;
        cb.closest('.touchon-row').classList.toggle('checked', cb.checked);
      });
    });
  };

  openWashSelect = function (mode) {
    setupDraft = presetFor(mode);
    setupDraft._touchon = productStatus('touchon', getLogs());
    renderSetupGroups();
    $('home').classList.add('fade-out');
    setTimeout(() => {
      $('home').classList.add('hidden');
      $('home').classList.remove('fade-out');
      $('deepCleanSelect').classList.remove('hidden', 'fade-out');
      $('topTitle').textContent = 'Wash Setup';
    }, 300);
  };

  /* Remove the Touch-On decision slide from the active schedule while retaining the
     generic decision framework and its old code in app.js for possible future features. */
  const oldStepAllowed = stepAllowed;
  stepAllowed = function (step, sel) {
    if (step && step.type === 'decision' && step.title === 'Does the car need Touch-On?') return false;
    return oldStepAllowed(step, sel);
  };

  /* Direct coating variants for body/warning fields. The explicit key is noCoating,
     intentionally distinct from negative conditions such as noRainx. */
  function resolveCoatingVariant(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    const hasVariant = Object.prototype.hasOwnProperty.call(value, 'noCoating') ||
      Object.prototype.hasOwnProperty.call(value, 'turtle') ||
      Object.prototype.hasOwnProperty.call(value, 'touchon');
    if (!hasVariant) return value;
    const key = washSelections.coating === 'turtlewax' ? 'turtle' :
      washSelections.coating === 'touchon' ? 'touchon' : 'noCoating';
    return value[key] ?? '';
  }

  const oldBuildCarousel = buildCarousel;
  buildCarousel = function () {
    if (!currentSchedule) return oldBuildCarousel();
    const originals = currentSchedule.steps.map(step => ({ step, body: step.body, warning: step.warning }));
    currentSchedule.steps.forEach(step => {
      step.body = resolveCoatingVariant(step.body);
      step.warning = resolveCoatingVariant(step.warning);
    });
    try {
      return oldBuildCarousel();
    } finally {
      originals.forEach(x => { x.step.body = x.body; x.step.warning = x.warning; });
    }
  };

  renderProductMeters = function () {
    const wrap = $('productMeters');
    if (!wrap) return;
    const logs = getLogs();
    wrap.innerHTML = ['turtlewax', 'rainx', 'touchon'].map(key => {
      if (key === 'rainx') {
        const st = getProductStatus('rainx', logs);
        if (!st || st.state === 'never') return `<div class="meter-row"><div class="meter-top"><span class="meter-name">Rain-X</span><span class="meter-last">Never logged</span></div><div class="meter-track"><div class="meter-fill" style="width:0%;background:var(--border);"></div></div></div>`;
        const ratio = Math.min(1.15, st.daysSince / 120);
        const pct = Math.max(0, Math.min(100, 100 * (1 - ratio)));
        const cssVar = st.state === 'overdue' ? 'warn' : (st.state === 'soon' || st.state === 'urgent' ? 'amber' : 'good');
        return `<div class="meter-row"><div class="meter-top"><span class="meter-name">Rain-X</span><span class="meter-last">${formatDaysRemaining(st.daysRemaining)}</span></div><div class="meter-track"><div class="meter-fill" style="width:${pct}%;background:var(--${cssVar});"></div></div><p class="meter-tier" style="color:var(--${cssVar});">Last applied ${new Date(st.last).toLocaleDateString()}</p></div>`;
      }
      const st = getProductStatus(key, logs);
      const cfg = COATING_CONFIG[key];
      if (st.state === 'never') return `<div class="meter-row"><div class="meter-top"><span class="meter-name">${cfg.label}</span><span class="meter-last">Never logged</span></div><div class="meter-track"><div class="meter-fill" style="width:0%;background:var(--border);"></div></div></div>`;
      const ratio = st.daysSince / cfg.targetDays;
      const pct = Math.max(0, Math.min(100, 100 * (1 - ratio)));
      const cssVar = st.state === 'overdue' || st.state === 'urgent' ? 'warn' : (st.state === 'red' || st.state === 'soon' ? 'amber' : 'good');
      const sub = st.anchoredByTurtleWax ? `${st.daysSince}d since Turtle Wax` : `${st.daysSince}d since applied`;
      return `<div class="meter-row"><div class="meter-top"><span class="meter-name">${cfg.label}</span><span class="meter-last">${formatDaysRemaining(st.daysRemaining)}</span></div><div class="meter-track"><div class="meter-fill" style="width:${pct}%;background:var(--${cssVar});"></div></div><p class="meter-tier" style="color:var(--${cssVar});">${sub}</p></div>`;
    }).join('');
  };

  updateReminders = function () {
    const wrap = $('remindersWrap');
    if (!wrap) return;
    const logs = getLogs();
    const tw = productStatus('turtlewax', logs);
    const to = productStatus('touchon', logs);
    const rain = getProductStatus('rainx', logs);
    const rec = recommendation(logs);
    const items = [];

    function addStatus(label, st, extra) {
      if (!st || st.state === 'never' || st.state === 'ok') return;
      const cls = st.state === 'overdue' ? 'overdue' : (st.state === 'red' ? 'urgent' : 'soon');
      items.push(bannerHtml(`<b>${label}</b> — ${formatDaysRemaining(st.daysRemaining)}.${extra ? ` ${extra}` : ''}`, cls));
    }

    addStatus('Turtle Wax', tw, rec && rec.key === 'turtlewax' ? rec.text : '');
    addStatus('Touch-On', to, rec && rec.key === 'touchon' ? rec.text : '');
    addStatus('Rain-X', rain, '');

    if (rec && rec.early) items.push(bannerHtml(`<b>${rec.text}</b>`, 'soon'));
    if (tw.state !== 'never' && to.state !== 'never' && getTurtlewaxBlockInfo(logs).blocked && tw.daysRemaining !== null && tw.daysRemaining <= TURTLE_EARLY_WINDOW) {
      items.push(bannerHtml(`<b>Turtle Wax safety gap</b> — Turtle Wax is within its early window, but it cannot be applied until 40 days after the last Touch-On.`, ''));
    }
    wrap.innerHTML = items.join('');
  };

  productMeterModel = function (key, logs) {
    logs = logs || getLogs();
    const st = getProductStatus(key, logs);
    if (!st || st.state === 'never') return { label: key, last: null, ratio: null, sub: null };
    const cfg = COATING_CONFIG[key] || PRODUCTS[key];
    const fullCycle = cfg.targetDays || cfg.maxDays;
    return { label: cfg.shortLabel || cfg.label || key, last: st.last, ratio: st.daysSince / fullCycle, sub: `${st.daysSince}d since applied` };
  };

  if (typeof CONDITIONAL_PREDICATES !== 'undefined') {
    CONDITIONAL_PREDICATES.noCoating = sel => sel.coating === 'none';
    CONDITIONAL_PREDICATES.touchon = sel => sel.coating === 'touchon';
  }

  const style = document.createElement('style');
  style.textContent = `
    .radio-row.urgent, .due-pill.urgent { background:var(--warn-soft); color:var(--warn); border-color:var(--warn); }
    .radio-row.overdue, .due-pill.overdue { background:var(--warn-soft); color:var(--warn); border-color:var(--warn); }
    .radio-row.urgent .radio-dot, .radio-row.overdue .radio-dot { border-color:var(--warn); background:var(--warn-bg); }
    .radio-row.urgent.checked .radio-dot::after, .radio-row.overdue.checked .radio-dot::after { background:var(--warn); }
    .radio-row.urgent, .radio-row.overdue { animation:coatingUrgentPulse 1.15s ease-in-out infinite; }
    @keyframes coatingUrgentPulse { 0%,100%{ box-shadow:var(--shadow); } 50%{ box-shadow:0 0 0 4px var(--warn-bg); } }
    .coating-option.blocked { opacity:.68; }
    .coating-option.recommended { box-shadow:0 0 0 2px var(--accent); }
    .coating-recommendation { margin-top:7px; font-size:10.5px; line-height:1.35; font-weight:800; color:var(--accent); }
    .coating-blocked { margin-top:7px; font-size:10.5px; line-height:1.35; font-weight:700; color:var(--warn); }
    .coating-note { margin:8px 2px 0; }
  `;
  document.head.appendChild(style);

  /* Stale calls from the old Touch-On decision UI become harmless. */
  answerTouchOnDecision = function () { return; };

  window.AustralCoatingLogic = { config: COATING_CONFIG, getStatus: productStatus, getRecommendation: recommendation };
})();
