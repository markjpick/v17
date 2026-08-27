/* Small compatibility layer for the simplified coating model.
   Rain-X keeps its original 90-120 day calculation in app.js; this layer supplies
   the display fields that the new coating UI expects without changing Rain-X rules. */
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

    /* Render the coating meters using the already-overridden model, then replace the
       Rain-X slot with the compatible original 90-120 day display. */
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
    /* Replace only the Rain-X wording that the simplified reminder renderer cannot
       derive from the old status object's min/max representation. */
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

  /* ================= CONDITIONAL INSTRUCTION INFORMATION =================
     A body/warning can be an ordered array of information items. Plain strings are
     always shown. A single-key object such as {wheelsDeep:'...'} is shown only when
     that condition is true. This keeps optional information inline with the ordinary
     instruction instead of replacing or duplicating the whole instruction.

     Coating keys are deliberately named noCoating, turtle and noTouchon. Other
     conditional information keys are independent and may be combined in the same
     instruction: rainx/noRainx, claybarTarRemoval, wheelsDeep, ironFallout,
     snowFoamRegular and snowFoamDeep. */
  if (typeof CONDITIONAL_PREDICATES !== 'undefined') {
    CONDITIONAL_PREDICATES.noCoating = sel => sel.coating === 'none';
    CONDITIONAL_PREDICATES.turtle = sel => sel.coating === 'turtlewax';
    CONDITIONAL_PREDICATES.noTouchon = sel => sel.coating !== 'touchon';
    CONDITIONAL_PREDICATES.rainx = sel => sel.glass === 'rainx';
    CONDITIONAL_PREDICATES.noRainx = sel => sel.glass !== 'rainx';
    CONDITIONAL_PREDICATES.claybarTarRemoval = sel => !!sel.claybarTarRemoval;
    CONDITIONAL_PREDICATES.wheelsDeep = sel => !!sel.wheelsDeep;
    CONDITIONAL_PREDICATES.ironFallout = sel => !!sel.ironFallout;
    CONDITIONAL_PREDICATES.snowFoamRegular = sel => sel.snowFoam === 'regular';
    CONDITIONAL_PREDICATES.snowFoamDeep = sel => sel.snowFoam === 'deep';
  }
})();
