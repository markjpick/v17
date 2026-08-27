/* Compatibility layer for coating status plus ordered conditional information items. */
(function(){
  'use strict';

  const oldDueInfoHtml = dueInfoHtml;
  const oldDueInfoClass = dueInfoClass;

  function rainxDisplay(productKey){
    if(productKey !== 'rainx') return null;
    const st = getProductStatus('rainx');
    if(!st || st.state === 'never') return '<span class="due-pill never">Not yet applied</span>';
    if(st.state === 'overdue') {
      const over = st.daysSince - 120;
      return `<span class="due-pill overdue">Overdue · ${over} day${over === 1 ? '' : 's'} past 120 days</span>`;
    }
    if(st.state === 'due') return '<span class="due-pill soon">Due now · within the 90-120 day window</span>';
    if(st.state === 'soon') return `<span class="due-pill soon">Due in ~${90 - st.daysSince} days · last applied ${new Date(st.last).toLocaleDateString()}</span>`;
    return `<span class="due-pill ok">${90 - st.daysSince} days until the 90-day window · last applied ${new Date(st.last).toLocaleDateString()}</span>`;
  }

  dueInfoHtml = function(productKey){
    const rain = rainxDisplay(productKey);
    return rain !== null ? rain : oldDueInfoHtml(productKey);
  };

  dueInfoClass = function(productKey){
    if(productKey === 'rainx') {
      const st = getProductStatus('rainx');
      return st.state === 'due' ? 'soon' : st.state;
    }
    return oldDueInfoClass(productKey);
  };

  const oldMeters = renderProductMeters;
  renderProductMeters = function(){
    const wrap = $('productMeters');
    if(!wrap) return;
    const logs = getLogs();
    const rain = getProductStatus('rainx', logs);
    const rainHtml = rain.state === 'never'
      ? `<div class="meter-row"><div class="meter-top"><span class="meter-name">Rain-X</span><span class="meter-last">Never logged</span></div><div class="meter-track"><div class="meter-fill" style="width:0%;background:var(--border);"></div></div></div>`
      : `<div class="meter-row"><div class="meter-top"><span class="meter-name">Rain-X</span><span class="meter-last">${rain.state === 'overdue' ? `${rain.daysSince - 120}d overdue` : `${Math.max(0, 90 - rain.daysSince)}d to window`}</span></div><div class="meter-track"><div class="meter-fill" style="width:${Math.max(0, Math.min(100, 100 * (1 - rain.daysSince / 120)))}%;background:var(--${rain.state === 'overdue' ? 'warn' : rain.state === 'soon' || rain.state === 'due' ? 'amber' : 'good'});"></div></div><p class="meter-tier" style="color:var(--text-dim);">Last applied ${new Date(rain.last).toLocaleDateString()}</p></div>`;
    oldMeters();
    const rows = wrap.querySelectorAll('.meter-row');
    const labels = Array.from(rows).map(r => r.querySelector('.meter-name')?.textContent);
    const idx = labels.indexOf('Rain-X');
    if(idx >= 0) rows[idx].outerHTML = rainHtml;
    else wrap.insertAdjacentHTML('beforeend', rainHtml);
  };

  const oldReminders = updateReminders;
  updateReminders = function(){
    oldReminders();
    const wrap = $('remindersWrap');
    if(!wrap) return;
    const rain = getProductStatus('rainx');
    if(!rain || rain.state === 'never' || rain.state === 'ok') return;
    const blocks = Array.from(wrap.querySelectorAll('.overdue-banner'));
    const rainBlock = blocks.find(b => /Rain-X/.test(b.textContent));
    if(!rainBlock) return;
    const cls = rain.state === 'overdue' ? 'overdue' : 'soon';
    rainBlock.className = `overdue-banner ${cls}`;
    rainBlock.querySelector('p').innerHTML = rain.state === 'overdue'
      ? `<b>Rain-X overdue</b> — ${rain.daysSince - 120} day${rain.daysSince - 120 === 1 ? '' : 's'} past the 120-day maximum window.`
      : rain.state === 'due'
        ? '<b>Rain-X due</b> — it is now inside the 90-120 day reapplication window.'
        : `<b>Rain-X coming up</b> — around ${90 - rain.daysSince} days until the 90-day reapplication window.`;
  };

  /* ================= CONDITIONAL INFORMATION =================
     An instruction body or warning may be an ordered array.
     - Plain strings are always displayed.
     - A one-key object is displayed only when that condition is true.
     - Multiple conditional objects may appear together and in any order.

     Coating conditions are intentionally only:
       noCoating  = no coating selected
       turtle     = Turtle Wax selected
       touchon    = Touch-On selected

     There is deliberately NO noTurtle and NO noTouchon condition. If neither coating
     is selected, use noCoating. This avoids contradictory information when one coating
     is selected and the other is not. */
  const predicates = {
    noCoating: sel => sel.coating === 'none',
    turtle: sel => sel.coating === 'turtlewax',
    touchon: sel => sel.coating === 'touchon',
    rainx: sel => sel.glass === 'rainx',
    noRainx: sel => sel.glass !== 'rainx',
    claybarTarRemoval: sel => !!sel.claybarTarRemoval,
    wheelsDeep: sel => !!sel.wheelsDeep,
    ironFallout: sel => !!sel.ironFallout,
    snowFoamRegular: sel => sel.snowFoam === 'regular',
    snowFoamDeep: sel => sel.snowFoam === 'deep'
  };

  /* app.js declares this object before this compatibility file loads. Replace its
     coating vocabulary with the final vocabulary agreed for the application. */
  Object.keys(CONDITIONAL_PREDICATES).forEach(key => {
    if(key === 'noTurtle' || key === 'noTouchon') delete CONDITIONAL_PREDICATES[key];
  });
  Object.assign(CONDITIONAL_PREDICATES, predicates);

  function resolveInfoArray(value, sel){
    if(!Array.isArray(value)) return value;
    return value
      .map(item => {
        if(item && typeof item === 'object' && !Array.isArray(item)) {
          const keys = Object.keys(item);
          if(keys.length === 1 && predicates[keys[0]]) {
            return predicates[keys[0]](sel) ? item[keys[0]] : null;
          }
        }
        return item;
      })
      .filter(item => item !== null && item !== undefined && item !== '');
  }

  /* app.js already handles body arrays. Its warning renderer expects a single string,
     so resolve warning arrays temporarily before buildCarousel renders them. */
  const oldBuildCarousel = buildCarousel;
  buildCarousel = function(){
    if(!currentSchedule) return oldBuildCarousel();
    const originals = currentSchedule.steps.map(step => ({ step, warning: step.warning }));
    currentSchedule.steps.forEach(step => {
      if(Array.isArray(step.warning)) {
        const items = resolveInfoArray(step.warning, washSelections);
        step.warning = items.map(item => `<div>${item}</div>`).join('');
      }
    });
    try {
      return oldBuildCarousel();
    } finally {
      originals.forEach(x => { x.step.warning = x.warning; });
    }
  };

  window.AustralConditionalInfo = {
    keys: Object.keys(predicates),
    resolve: resolveInfoArray
  };
})();
