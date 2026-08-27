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
        { touchon: '30ml of <span class="product_BH">Bilt Hamber Touch-On</span> ready if needed, plus a container with 270ml water.' },
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

  
  {
    phase: 'Touch-On', icon: 'spray', title: 'Touch-On application',
    section: 'touchon', showIf: sel => sel.coating === 'touchon',
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
      { noCoating: 'Lightly mist <span class="product_BH">Bilt Hamber Auto-QD</span> (1:20 dilution) onto 1-2 wet panels at a time as a drying aid. Be aware that if <span class="product_BH">Bilt Hamber Touch-On</span> was applied earlier it acts as its own drying aid, and doesn\'t mix well, so NO NEED TO APPLY <span class="product_BH">Bilt Hamber Auto-QD</span>'},
      { turtle: 'You\'re applying <span class="product_turtleWax">Turtle Wax Ceramic Spray</span> after drying, so <b>DO NOT</b> use any <span class="product_BH">Bilt Hamber Auto-QD</span> here. It will negatively affect the bonding of the <span class="product_turtleWax">Turtle Wax Ceramic Spray</span>' },
      { touchon: 'You\'ve applyed <span class="product_BH">Bilt Hamber Touch-On</span> already, so <b>DO NOT</b> use any <span class="product_BH">Bilt Hamber Auto-QD</span> here. These 2 products do NOT work well together, <span class="product_BH">Bilt Hamber Touch-On</span> will already act as a ceramic top-up and a drying aid.' },
      'Use the CarMax XXL Twisted Loop Towel to gently dry all bodywork and alloy wheels in long, smooth passes.'
    ],
    warning: [
      'Remember not to use any <span class="product_BH">Bilt Hamber Auto-QD</span> on ANY glass/mirror',
      { touchon : 'or if used <span class="product_BH">Bilt Hamber Touch-On</span> this wash.'},
      { turtle : 'or if using <span class="product_turtleWax">Turtle Wax Ceramic Spray</span> this wash.'}
    ]
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
