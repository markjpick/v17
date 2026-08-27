/*
 * GPT MASTER STEPS DATA BOUNDARY
 *
 * The new application reads GPT_MASTER_STEPS only.  During this migration period the
 * existing constants.js is loaded first and copied here at runtime.  This deliberately
 * isolates the new UI from the old application API.  Once the complete canonical step
 * list has been copied into this file, constants.js can be removed from gpt_index.html
 * without changing gpt_app.js.
 */
(function(){
  'use strict';
  try {
    if (typeof MASTER_STEPS !== 'undefined' && Array.isArray(MASTER_STEPS)) {
      window.GPT_MASTER_STEPS = MASTER_STEPS.map(step => ({...step}));
    } else {
      window.GPT_MASTER_STEPS = [];
    }
  } catch (e) {
    window.GPT_MASTER_STEPS = [];
    console.error('GPT master-step migration boundary could not initialise', e);
  }
})();
