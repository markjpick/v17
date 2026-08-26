# Austral Wash Bay — Architecture Blueprint (v17)

HTML app (`car_wash_schedule_v17.html`). No build step, uses Open-Meteo API for weather. 
Read this before making changes — it explains *why* the app is shaped the way it is, 
not just what's in it.

---

## 1. Mental model

There is **one wash**, not two. "Regular Wash" and "Deep Clean" are just
**presets** that pre-fill a selection screen — they are not separate code
paths. Every wash is built from the same `MASTER_STEPS` list, filtered down
by whatever the person picked on the setup screen (`washSelections`).

If you're about to add an `if (currentSchedule.key === 'deep')` anywhere,
stop — that's the pre-v15 model. The right lever is almost always a new key
on `washSelections` plus a `showIf` on the relevant step(s).

---

## 2. Data flow, end to end

```
tap Regular/Deep
   → presetFor(mode) fills setupDraft
   → renderSetupGroups() draws radio groups + toggles from setupDraft
   → person edits → setupDraft mutated in place, re-rendered
   → "Begin Wash" → washSelections = copy of setupDraft
   → MASTER_STEPS.filter(stepAllowed) → currentSchedule.steps
   → buildCarousel() + buildProgressTrack() draw the slides/dots
   → mid-wash: Touch-On decision slide can mutate washSelections.touchon
     → rebuildFromCurrentStep() re-filters MASTER_STEPS, current position
       forward only, carousel/progress rebuilt in place
   → finishWash() → sectionsInThisWash() scans the ACTUAL steps used
     → done screen shows one checkbox per optional section
   → "Done" → only checked sections passed to saveLog()
   → saveLog() writes {date, type, sections[]} to localStorage
   → renderLogs() / buildCalendar() / updateReminders() re-read from storage
```

Everything downstream (home reminders, log modal, due-pills on the setup
screen) is derived by re-scanning `getLogs()` — there's no separate "state"
for product timers. **The wash log is the single source of truth.** If a
reminder is showing something wrong, the bug is almost always in how a log
entry's `sections` array got written, not in the reminder code itself.

---

## 3. The step model (`MASTER_STEPS`)

One flat array, in the exact order steps must physically happen. Each entry:

```js
{
  phase: 'Snow Foam Pre-Wash',   // groups steps into progress-dot phases
  icon: 'foam',                  // key into ICONS
  title: 'Mix the snow foam',
  body: [...] | 'string' | {category: [...]},  // see renderBodyContent
  warning: '...',                // optional red callout
  section: 'snowfoamdeep',       // optional — ties step to a tracked product
                                  // or a NONTIMER_SECTIONS entry
  showIf: sel => sel.snowFoam === 'deep',  // optional — omit to always show
  timerSec: 180, timerLabel: '...', timerRange: '3-5 MINS',  // optional dwell timer
  type: 'decision', yesLabel, noLabel, yesSub, noSub  // only for the Touch-On gate
}
```

**Ordering is the array order** — there is no separate sort step. To move a
step (like Mirrors moved before Wipers in v15), just move its object in the
array. To add a whole new optional block (e.g. a future "Clay Bar" step),
insert it in the right physical position with its own `showIf`.

**`showIf(sel)`** receives the live `washSelections` object. Always write it
against the *selection keys*, not against `currentSchedule` or step index —
that's what makes `rebuildFromCurrentStep()` safe to call mid-wash.

**`section`** is only set on steps that should appear on the done-screen
review list and/or be tracked in the wash log. Always-run steps (Contact
Wash, Drying, Mirrors, Wipers, Tyres, Final Check) have no `section` — they
always happened, there's nothing to confirm or reset.

---

## 4. Conditional content *inside* a step (`CONDITIONAL_PREDICATES`)

Some steps are always shown but have a line or two that changes based on
selections (e.g. the equipment checklist listing different Touch-Less
quantities for regular vs deep snow foam). Rather than duplicating the whole
step, individual list items can be wrapped as a single-key object:

```js
{ snowFoamDeep: 'Mix 135g(125ml) of Touch-Less with 625g of warm tap water...' }
```

`resolveConditionalList()` runs every item in a body array through
`conditionalItemText()`, which checks the key against
`CONDITIONAL_PREDICATES` (`turtle`, `noTurtle`, `rainx`, `noRainx`,
`wheelsDeep`, `sillsDeep`, `ironFallout`, `claybarTarRemoval`, `snowFoamRegular`, `snowFoamDeep`)
and drops the line entirely if the predicate fails. Plain strings pass
through unchanged. **Add new predicates here** if a future product needs
inline conditional bullets rather than a whole new step.

`renderBodyContent()` handles three body shapes: a plain string, a flat
array (→ `<ul>`), or a `{category: [...]}` object (→ nested `<ul>` per
category, used only by the two "Checklist" steps).

---

## 5. Product tracking (`PRODUCTS`, `NONTIMER_SECTIONS`)

Two registries, both keyed by the same `section` strings used in
`MASTER_STEPS`:

- **`PRODUCTS`** — has a real re-application window (`minDays`/`maxDays`).
  Drives: due-pills on the setup screen, home-screen reminder banners,
  `getProductStatus()`. Currently: `turtlewax`, `rainx`, `touchon`,
  `snowfoamdeep`.
- **`NONTIMER_SECTIONS`** — as-needed, visual-judgement only (`wheelsdeep`,
  `sillsdeep`, `ironfallout`). No due-date logic, but still logged and shown
  in the log-modal detail so you can eyeball spacing between chemical-heavy
  treatments.

**To add a new tracked product** (say, a future interior protectant):
1. Add a `section: 'newproduct'` to the relevant step(s) in `MASTER_STEPS`.
2. Add an entry to `PRODUCTS` (or `NONTIMER_SECTIONS` if it's visual-only).
3. If it needs its own radio/toggle on the setup screen, add it to
   `SETUP_GROUPS` or `ADDONS`.
4. That's it — `sectionsInThisWash()`, the done-screen review list, log
   saving, home reminders, and the log-modal detail all pick it up
   automatically because they iterate the registries, not hardcoded lists.

`getProductStatus(key)` states: `never` (no log has this section) → `ok` →
`soon` (within `HOW_SOON_DAYS`, currently 20, of `minDays`) → `due` (past
`minDays`) → `overdue` (past `maxDays`).

---

## 6. The wash log (localStorage key `austral_wash_logs`)

```js
{ date: ISOString, type: 'Wash + Turtle Wax + Rain-X', sections: ['turtlewax','rainx'] }
```

`type` is a **display label only**, computed at save time from
`SECTION_SHORT_LABEL` — never parsed back. All logic reads `sections`.

**Backward compatibility**: pre-v15 logs used flat booleans
(`touchOn`/`turtle`/`rainx`) instead of a `sections` array.
`normalizeLog()` converts these on every read inside `getLogs()` — old data
is never migrated in storage, just translated in memory. If you change the
log shape again, add the translation here rather than writing a migration
script.

`daysSincePreviousSection(logs, index, key)` walks *older* entries to find
the previous occurrence of the same section — this is what powers the
"63d since previous" detail in the log modal. It only looks backward from
a given index, so it's safe to call while iterating `logs` in render order
(newest first).

---

## 7. Screens (all siblings inside `#app`, toggled via `.hidden`)

| id | shown by | purpose |
|---|---|---|
| `#home` | `goHome()` | landing screen: reminders, two preset buttons, weather, calendar, log-book entry |
| `#deepCleanSelect` | `openWashSelect(mode)` | generic setup screen (name kept from v14, now used by both presets) |
| `#stepScreen` | `startSchedule()` | swipeable carousel of steps |
| `#doneScreen` | `finishWash()` | completion + review checklist |
| `#logModal` / `#dayModal` / `#calcModal` / `#infoModal` | respective buttons | overlays, all follow the same `.hidden` + backdrop-click-to-close pattern |

`showFullScreen()` is called once, right when a wash begins — not on every
screen change.

---

## 8. Carousel mechanics

- `buildCarousel()` renders **all** steps in `currentSchedule.steps` as
  `.step-slide` divs inside `#carouselTrack`, then positions via
  `transform: translateX()`. Only one slide is `.active` at a time (opacity),
  but all are in the DOM — there's no virtualization.
- Swipe handling is continuous drag-follow (`touchstart`/`touchmove`/`touchend`
  on `#carouselViewport`), separate from `goToStep()`, which is used for
  taps on progress dots, keyboard arrows, and the Touch-On decision jump.
- **Mid-wash step-list changes** (only the Touch-On gate today) go through
  `rebuildFromCurrentStep()`: re-filter `MASTER_STEPS`, rebuild the DOM,
  restore `currentIndex` (steps *before* the decision point never change
  index), then `goToStep(currentIndex + 1)`. If you add another mid-wash
  decision in future, reuse this function rather than writing a new one —
  it already handles progress-dot rebuilding and position restoration.
- The `type: 'decision'` step renders Yes/No buttons instead of a finish
  button, even if it happens to be the last step in a filtered list (it
  never should be, but `buildCarousel()` guards this explicitly).

---

## 9. Weather / calendar (unchanged from v14)

- `HOME_LOCATION` hardcoded, single Open-Meteo fetch on load
  (`fetchWashWeather()`), cached on `window.cachedWeatherData` so the
  calendar and day-modal don't refetch.
- `hourlyRowsForDate()` / `classifyHour()` / `buildWeatherSummary()` are pure
  functions over the fetched hourly arrays — safe to unit-test in isolation
  (see §11).
- Calendar markers are now just the 10-day target (`10D`). The old `DC`
  (deep-clean-window) marker was removed in v15 since "deep clean" is no
  longer a fixed 3–4 month cycle — that information now lives in the
  home-screen reminder banners instead, generalized across all `PRODUCTS`.

---

## 10. Things that are genuinely global vs. reset per wash

**Global, persists across washes (localStorage):** `austral_wash_logs`,
`austral-theme`.

**Reset every wash:** `washSelections`, `setupDraft`, `pendingLogSections`,
`currentSchedule`, `currentIndex`, `visited`, all timer state.

**`setupDraft` vs `washSelections`** — deliberately separate. `setupDraft` is
a scratch copy the setup screen mutates freely while the person is still
deciding; `washSelections` is only assigned (as a copy) once "Begin Wash" is
pressed. Don't read `washSelections` from inside `renderSetupGroups()` — it
won't reflect in-progress edits.

---

## 11. Testing without a browser

Because the data/logic layer (`MASTER_STEPS`, `PRODUCTS`, `stepAllowed`,
`getProductStatus`, `normalizeLog`, `daysSincePreviousSection`,
`resolveConditionalList`) is written as pure functions over plain objects,
it can be extracted from the `<script>` block and run under plain Node with
a small shim (mock `getLogs`, no `window`/`document`) to sanity-check step
ordering, gating, and reminder math before touching the DOM/CSS at all.
This is how the wash-combination matrix and timer thresholds were verified
when v15 was built — worth doing again for any change to `showIf` logic or
the `PRODUCTS` thresholds.

---

## 12. Common change recipes

- **New optional product/step** → §5, step 1–4 above.
- **Reorder steps** → move the object in `MASTER_STEPS`; nothing else
  references array position.
- **New setup-screen radio group** (mutually exclusive, like Coating) → add
  to `SETUP_GROUPS`; `renderSetupGroups()` handles arbitrary group counts.
- **New setup-screen toggle** (independent, like Iron Fallout) → add to
  `ADDONS`.
- **Change a reminder threshold** → edit `minDays`/`maxDays` in `PRODUCTS`,
  or `HOW_SOON_DAYS` for the global lookahead window.
- **New mid-wash decision** → copy the Touch-On decision step + gating
  pattern (§8), reuse `rebuildFromCurrentStep()`.

---

## 13. v16 changes

**Bug fix:** `goHome()` was adding `.fade-out` to `#deepCleanSelect` and never
removing it. `openWashSelect()` only ever removed `.hidden`, so on a second
visit the setup screen was present in the DOM but still had `opacity:0` and
`pointer-events:none` from the leftover class — it looked blank/dead until a
full page refresh. Fixed by having `goHome()` only add `.hidden` (no
fade-out needed going home) and having `openWashSelect()` defensively strip
`.fade-out` before revealing the screen.

**Turtle Wax is now a single 6-month target, not a range.** `PRODUCTS.turtlewax`
dropped `minDays`/`maxDays` for `targetDays: 180` + `warnDays: 20`.
`getProductStatus()` branches on whether `cfg.targetDays` is present: if so,
it's `ok` until `targetDays - warnDays`, `soon` (the 20-day warning) until
`targetDays`, then `overdue` — with dedicated "you really need to do this
now" wording in `updateReminders()`. Any future product that should behave
this way (a fixed date rather than a min/max window) just needs
`targetDays`/`warnDays` instead of `minDays`/`maxDays` — the rest of the
generic day-based machinery (`dueInfoHtml`, the meters, `updateReminders`)
already understands both shapes.



**How `phase`/`blocked` flow into the UI:**

- `openWashSelect()` snapshots `getTouchOnStatus()` onto
  `setupDraft._touchon` once, and pre-checks `setupDraft.touchon = true`
  immediately if it's due, not blocked, and Turtle Wax isn't selected as
  today's coating.
- `renderSetupGroups()` reads `setupDraft._touchon` (not a fresh call —
  logs don't change while the setup screen is open) to decide whether to
  render nothing, a checked toggle ("Apply Touch-On today"), or a warning
  banner (blocked case, which also forces `setupDraft.touchon = false`).
  Switching Coating to Turtle Wax always resets `setupDraft.touchon` back
  to `null` since the toggle disappears.
- `washSelections = Object.assign({}, setupDraft)` at "Begin Wash" carries
  `_touchon` and the resolved `touchon` boolean into the wash itself.
- The mid-wash Touch-On decision step's `showIf` now also requires
  `sel.touchon !== true && sel.touchon !== false` — i.e. it only asks when
  still undecided (phases `notyet`/`reminder`). If the setup screen already
  resolved it (`due` or blocked), the decision step is skipped entirely.
- Both the decision step and the application step gained a `noteFn(sel)` —
  a new optional step field, rendered by `buildCarousel()` just above the
  step body — that shows the "3rd wash, nearly due" or "Nth wash, applying
  today" callout by reading `sel._touchon`. `noteFn` is generic (any step
  can use it going forward for cheap dynamic context text without needing
  a whole new conditional predicate).

**Product protection meters** — new home-screen card (`#productMetersCard`,
under the log book button) rendered by `renderProductMeters()`, called
everywhere `renderLogs()` already is. `productMeterModel(key, logs)`
returns a `ratio` (0 = just applied, 1 = right at the due point, >1 =
overdue) for `turtlewax`/`rainx` (`daysSince / (targetDays || maxDays)`) and
for `touchon` (`washesSince / dueAtWash`). `meterTierFor(ratio)` buckets
that into 5 tiers (`METER_TIERS`): Fully protected → Medium protection →
Low protection → Needs reapplying → Overdue, each with its own colour, used
for both the tier label and the bar's fill colour/width. This is
deliberately a *separate*, simpler ratio model from the `ok/soon/due/overdue`
state machine used for reminders — the meter is a continuous "how worn is
it" visual, the reminder state machine is a discrete "should I say
something" decision. Don't try to unify them; they answer different
questions.


---

## 14. v17 changes

**Touch-On reverted from wash-count tracking back to day-based tracking.** The v16
wash-count model (`getTouchOnCycleInfo`/`getTouchOnStatus`, `TOUCHON_RULES.dueAtWash`
etc) is gone. Touch-On is now a normal entry in `PRODUCTS`
(`targetDays: 40, warnDays: 10`) and goes through the exact same `getProductStatus()`
machinery as Turtle Wax and Rain-X — `ok` → `soon` (last 10 of the 40 days) → `overdue`.
This was a straight simplification, not a compromise: at the roughly-10-day wash cadence
the app already assumes, 40 days ≈ 4 washes, so the day-based and wash-count numbers
were always approximating the same thing. Reasons for the revert:

- It gives Touch-On the same 40-day **fallback** as every other product for free: if
  actual washes fall behind (bad weather, life gets in the way), `daysSince` keeps
  counting regardless of how many washes did or didn't happen, so the reminder banner,
  the setup-screen Coating option, and the protection meter all correctly reach
  `overdue`/"Needs reapplying" on their own after 40 real days — no separate fallback
  code path needed, it's just what a day-based model does.

**`getProductStatus(key, logs)` gained a Touch-On special case.** When `key ===
'touchon'`, the "last applied" lookup matches a log containing `touchon` **or**
`turtlewax` — a fresh Turtle Wax application resets the top-coat clock too, since
there's nothing to top up yet on a brand-new base coat. The returned status object now
also carries `anchoredByTurtleWax: true` when that's what actually happened, so the
meter (below) can adjust its wording. `getTurtlewaxBlockInfo()` is unchanged.
`getTouchOnCycleInfo()`/`getTouchOnStatus()` are replaced by a single
`getTouchOnFullStatus(logs)` = `getProductStatus('touchon', logs)` merged with
`getTurtlewaxBlockInfo(logs)`.

**Touch-On moved into the Coating radio group, not a separate toggle.** `SETUP_GROUPS`
still only declares `none`/`turtlewax` statically — `renderSetupGroups()` injects a
third `touchon` radio row into the Coating group at render time, but *only* when
`getTouchOnFullStatus()` is `overdue` and not `blocked`. This directly fixes the bug
where the mid-wash "Does the car need Touch-On?" decision was appearing on washes 1–2:
that decision step's `showIf` now requires `sel._touchon.state === 'soon' && !blocked`
specifically (the pre-overdue warning window), so it's silent while state is
`ok`/`never` and disappears again once `overdue` because by then Touch-On is already
resolved via the Coating radio instead. Being a radio option also gets mutual exclusion
with Turtle Wax for free — no separate guard code needed, a radio group can only hold
one value.

- `openWashSelect()` pre-selects `setupDraft.coating = 'touchon'` when eligible
  (`overdue`, not `blocked`, and today's preset isn't already `turtlewax`).
- `renderSetupGroups()` re-validates eligibility on every render and resets
  `setupDraft.coating` back to `'none'` if it was `'touchon'` but eligibility has since
  gone away (defensive — shouldn't normally change mid-screen, but keeps state honest).
- When `overdue` but `blocked`, an inline warning banner renders under the Coating
  group instead of the radio option (same message as before, day-phrased).
- When `soon`, a short inline hint renders under the Coating group instead ("getting
  due… it'll appear here as an option once due"), and the mid-wash decision step is
  what's actually offered that wash.
- `washSelections.touchon` is now derived, not copied: at "Begin Wash",
  `washSelections.touchon = (setupDraft.coating === 'touchon') ? true : null`. The
  Touch-On application/rinse steps' `showIf` still just checks `sel.touchon === true`,
  same as before — they don't care whether that became true via the Coating radio or
  via the mid-wash decision.

**Deep Snow Foam is no longer day-tracked.** Dropped from `PRODUCTS` entirely and
moved to `NONTIMER_SECTIONS` (visual/as-needed, like Wheels Deep or Iron Fallout) —
whether it's needed depends on how dirty the car actually got (e.g. a month of
motorway driving), not a calendar interval, so a `minDays`/`maxDays` due-pill on the
Snow Foam setup option was actively misleading. The `product: 'snowfoamdeep'` key was
removed from that setup option; it's still logged and still shows up in the wash-log
detail and done-screen review list (via `NONTIMER_SECTIONS`), just with no due-date
machinery anywhere.

**Product protection meter: Touch-On is now day-ratio-based** like Turtle Wax/Rain-X
(`ratio = daysSince / 40`), so it degrades continuously rather than in four wash-sized
steps — same `METER_TIERS` bucketing as everything else. The one remaining special
case is presentation, not math: when `productMeterModel()` reports
`anchoredByTurtleWax: true`, `renderProductMeters()`:
- drops the "Last: `<date>`" text entirely (it isn't Touch-On's date, showing it would
  be false), leaving just the `Nd since Turtle Wax applied` sub-line;
- swaps the tier label via `touchOnTurtleWaxTierLabel(ratio)` — "Turtle wax protecting
  paint" (early/ok+soon-not-yet), "Turtle wax top layer fading" (in the `soon` warning
  window), "Needs reapplying" (`overdue`, unchanged wording since by that point it
  doesn't matter which product last touched the paint). The bar's width/colour still
  come from the normal `meterTierFor(ratio)` — only the *label* is swapped.

**Reminder banners generalized.** `updateReminders()`'s fixed-date (`targetDays`)
wording branch used to be hardcoded to `key === 'turtlewax'`; it's now keyed off
`cfg.targetDays` being present, so it applies to any current or future `targetDays`
product automatically. Touch-On is excluded from that generic loop
(`if(key === 'touchon') return`) and handled just after it with its own block, since it
needs the extra `blocked`/`anchoredByTurtleWax` phrasing the generic branch doesn't
know about.

**Housekeeping:** `TOUCHON_META` is gone — Touch-On's `label`/`shortLabel` now live
directly on its `PRODUCTS` entry like every other product, so `ALL_SECTION_LABELS` and
`SECTION_SHORT_LABEL` no longer need a special-cased merge for it. `TOUCHON_RULES` is
reduced to a single constant, `TOUCHON_BLOCK_DAYS_BEFORE_TURTLEWAX = 40` (the
`dueAtWash`/`reminderAtWash` wash-count fields are gone, superseded by
`targetDays`/`warnDays` on the `touchon` `PRODUCTS` entry itself). `ordinal()` is no
longer called anywhere (it existed only to phrase "3rd wash"/"4th wash") but is left
defined in case a future wash-count-based feature wants it again.

**If you add another `targetDays`-style product in future**, the reminder banner and
due-pill wording already generalize for free — just add the `PRODUCTS` entry. If it
also needs a Turtle-Wax-style "something else can reset my clock" relationship, copy
the `anchoredByTurtleWax` pattern in `getProductStatus()`/`productMeterModel()` rather
than reinventing the wash-count machinery this version removed.

