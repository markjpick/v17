# Austral Wash Bay — Application Blueprint

## 1. Purpose

Austral Wash Bay is a single-page car-wash assistant for a Renault Austral. It combines current and 14-day hourly wash-weather information, configurable wash presets, a filtered master wash sequence, timed instructions, product-protection tracking, and a local wash log.

## 2. Application Structure

- `index.html` — page structure, screens and dialogs.
- `constants.js` — product configuration, setup choices and canonical `MASTER_STEPS` instruction list.
- `app.js` — application state, carousel, timers, weather, logbook and persistence. It also retains the generic inline-decision framework for possible future use.
- `coating_logic.js` — current coating-selection, timing, safety and recommendation rules.
- `styles.css` — presentation, responsive layout and colour/status styling.

## 3. Main Flow

```text
Home
  -> Regular Wash or Deep Clean
  -> Wash Setup
  -> adjust selections
  -> Begin Wash
  -> filter MASTER_STEPS
  -> instruction carousel
  -> completion review
  -> save confirmed sections to local wash log
```

Regular Wash and Deep Clean are presets, not separate wash programs.

## 4. Home Screen

The home screen provides current wash conditions, hourly weather for the remaining wash hours today, a 14-day weather calendar, Regular Wash and Deep Clean entry points, product reminders, product protection meters, and Wash Log Book access.

Weather is retrieved from Open-Meteo using the fixed wash location configured in the application.

## 5. Wash Setup

The setup screen contains configurable radio groups and optional extra-attention choices.

### Snow Foam

- Regular Snow Foam
- Deep Snow Foam

### Coating

Exactly one coating option can be selected:

- `noCoating` — no coating applied this wash;
- `turtlewax` — Turtle Wax Ceramic Spray;
- `touchon` — Bilt Hamber Touch-On.

Touch-On is permanently visible as a coating option. It is no longer introduced by a question during the wash.

### Glass

- Regular glass clean
- Rain-X glass protector

### Extra Attention

Optional as-needed operations:

- Deep Wheel Decon
- Deep Sill/Jamb Clean
- Iron Fallout Treatment
- Remove Tar spots with Clay Bar

## 6. Coating Management

Turtle Wax and Touch-On are both treated as coating products with fixed, day-based reapplication cycles.

### Turtle Wax

- Target: 180 days.
- Orange warning: 30 days remaining.
- Red warning: 10 days remaining.
- Due/overdue: 0 days remaining or less.
- Due/overdue status is visually urgent and flashes on the setup option.
- Turtle Wax is the base ceramic coating.

### Touch-On

- Target: 40 days.
- Orange warning: 14 days remaining.
- Red warning: 7 days remaining.
- Due/overdue: 0 days remaining or less.
- Due/overdue status is visually urgent and flashes on the setup option.
- Touch-On is the ceramic top-up coating.

## 7. Coating History Rules

Turtle Wax status is based on the most recent wash-log entry containing `turtlewax`.

Touch-On's displayed cycle is based on the most recent coating event containing either `touchon` or `turtlewax`:

- a Turtle Wax application starts a fresh Touch-On cycle because a new base coating does not need an immediate top-up;
- a Touch-On application starts its own 40-day cycle;
- Turtle Wax's own 180-day timer is reset only when Turtle Wax itself is logged.

## 8. Turtle Wax Safety Rule

Turtle Wax must never be applied until at least 40 days have elapsed since the most recent Touch-On application.

When this safety period is active, the Turtle Wax setup option is visibly marked as unavailable and states how many days remain before it is safe.

## 9. Continuous Protection Recommendation

When Touch-On becomes due:

- if Turtle Wax has more than 30 days remaining, recommend Touch-On;
- if Turtle Wax has 30 days remaining or less, and the 40-day Touch-On safety gap has been satisfied, recommend Turtle Wax early instead;
- the early recommendation is explicitly phrased as **"Just reapply Turtle Wax now, X days early."**;
- this brings the 180-day Turtle Wax cycle back into line with the Touch-On cycle.

Examples:

```text
Touch-On due today
Turtle Wax has 35 days remaining
-> apply Touch-On
-> after the 40-day Touch-On cycle, Turtle Wax is safe to apply
```

```text
Touch-On due today
Turtle Wax has 30 days remaining
-> apply Turtle Wax now, 30 days early
```

The recommendation guides the user but does not silently change a deliberately selected safe coating.

## 10. Coating Status Presentation

The setup boxes use these states:

- green — comfortably within the protection period;
- orange — approaching reapplication;
- red — close to reapplication;
- flashing red — due or overdue.

The boxes show explicit days remaining or overdue status so the timing decision does not depend on visual water beading.

## 11. Conditional Instruction Content

Body text and warning boxes can contain coating-specific variants using:

```js
{
  noCoating: 'Text when no coating is selected.',
  turtle: 'Text when Turtle Wax is selected.',
  touchon: 'Text when Touch-On is selected.'
}
```

`noCoating` is deliberately distinct from negative conditions such as `noRainx`.

The same variant mechanism is available to warning content. Existing inline array conditions such as `turtle`, `noTurtle`, `rainx` and `noRainx` remain supported.

## 12. Master Wash Instructions

`MASTER_STEPS` is the canonical ordered list of wash operations. A step may contain a phase, icon, title, body, warning, timer, section key, conditional `showIf` logic, and optional note or decision behaviour.

The current wash is created by filtering the master list using the setup selections.

The generic inline-decision framework remains in the code as a future extension point, but the old Touch-On decision step is excluded from the active wash schedule.

## 13. Instruction Carousel

The filtered steps are presented as a horizontally swipeable carousel with touch swipe, desktop arrow-key navigation, progress dots, phase/progress display, scrollable long instructions, and full-screen support.

## 14. Timers and Alarms

Timed stages can provide a visual countdown ring, Start/Pause/Resume controls, overtime indication, audible alarm, vibration where supported, and browser notification where permission is available.

## 15. Wash Completion

The completion screen lists tracked sections included in the generated wash. The user can uncheck anything skipped or not actually completed. Only confirmed sections are saved to the log.

## 16. Wash Log

Wash history is stored in browser `localStorage` under `austral_wash_logs`.

Each entry contains a date, display type and confirmed section keys.

The logbook supports viewing history, correcting the wash date, deleting entries, JSON export, JSON import, and duplicate detection during import.

Historical product status is derived from the log rather than from a separate product database.

## 17. Product Tracking

Tracked products are Turtle Wax Ceramic Spray, Rain-X Glass Protector, and Bilt Hamber Touch-On.

Other operations such as Deep Wheel Decon, Deep Sill/Jamb Clean, Iron Fallout Treatment, Clay Bar/Tar Removal and Deep Snow Foam are logged but are not controlled by fixed reapplication dates.

Rain-X retains its existing 90–120 day model.

## 18. Weather System

The application retrieves hourly weather information and classifies wash hours using configured temperature and precipitation thresholds. Wash-hour states are ideal, marginal, or bad. The home screen shows a current-day summary; the calendar covers the next 14 days and each day can be opened for hourly detail.

## 19. Dilution Calculator

The application includes a product dilution calculator for supported Bilt Hamber products. It calculates volume and approximate weight quantities and provides a target total mix weight for use with a scale.

## 20. Theme and Device Features

The application supports light/dark theme, persisted theme preference, responsive touch layout, full-screen mode, browser notifications, and device vibration where available.

## 21. Design Principles

1. Keep the wash as one canonical workflow and use selections to include or exclude steps.
2. Keep historical product applications in the wash log as the source of truth.
3. Keep raw product timer calculations separate from coating recommendation logic.
4. Use explicit status text as well as colour so timing is unambiguous.
5. Keep the generic inline-decision mechanism available for future features, but do not use it for Touch-On.
6. Use `noCoating` for the no-coating content variant so it is not confused with other negative conditions such as `noRainx`.
