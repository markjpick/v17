/* ============================= ICONS ============================= */
const ICONS = {
  spray:'<path d="M18 8V4h6l4 4"/><path d="M18 8h-4l-8 8v18a2 2 0 002 2h10a2 2 0 002-2V16l6-6"/><path d="M12 20h10M11 26h11M12 32h9"/>',
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
  chevL:'<path d="M15 6l-6 6 6 6"/>',fullscreen:'<path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/>'
};
const WASH_RULES={START_HOUR:9,END_HOUR:19,MIN_RAIN:5,MAX_RAIN:15,MIN_TEMP:5,MAX_TEMP:22};
const NONTIMER_SECTIONS={wheelsdeep:'Deep Wheel Decon',sillsdeep:'Deep Sill/Jamb Clean',ironfallout:'Iron Fallout Treatment',claybarTarRemoval:'Remove Tar spots (clay bar)',snowfoamdeep:'Deep Snow Foam'};
const HOW_SOON_DAYS=20;
const PRODUCTS={turtlewax:{label:'Turtle Wax Ceramic Spray',shortLabel:'Turtle Wax',targetDays:180,warnDays:20},rainx:{label:'Rain-X Glass Protector',shortLabel:'Rain-X',minDays:90,maxDays:120},touchon:{label:'Bilt Hamber Touch-On',shortLabel:'Touch-On',targetDays:40,warnDays:10}};
const TOUCHON_BLOCK_DAYS_BEFORE_TURTLEWAX=40;
const RATIOS={bh_touchless:{density:1.08,defaultSize:750,options:[{label:'1:15 (Light road dust/summer 0.6%PIR)',parts:15,water:'warm tap'},{label:'1:9 (Maintenance 1%PIR)',parts:9,water:'warm tap'},{label:'1:5 (Deep Clean 1.6%PIR)',parts:5,water:'warm tap'},{label:'1:4 (Full Dirt Buld-up 2%PIR)',parts:4,water:'warm tap'}]},bh_surfex:{density:1.05,defaultSize:500,options:[{label:'1:10 (Arches, Tyres & Jambs)',parts:10,water:'tap'},{label:'1:100 (Interior & Leather)',parts:100,water:'tap'}]},bh_qd:{density:1.01,defaultSize:500,options:[{label:'1:20 (Drying Aid)',parts:20,water:'distilled'}]},bh_wash:{density:1.02,defaultSize:10000,options:[{label:'1:2000 (Bucket Wash)',parts:2000,water:'warm tap'}]},bh_touchon:{density:1.02,defaultSize:300,options:[{label:'1:9 (Ceramic wax)',parts:9,water:'cool tap'}]}};
/* Existing setup groups, master steps and other application constants continue below. */
