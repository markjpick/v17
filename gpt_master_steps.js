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