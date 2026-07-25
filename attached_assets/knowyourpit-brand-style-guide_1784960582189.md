# knowyourpit — Brand Style Guide

**Version 1.0**

> The brand name is always written **knowyourpit** — all lowercase, no spaces. Never "Know Your Pit" or "KnowYourPit."

**Tagline:** knowyourpit. own your cook.

The identity system for the AI BBQ coach that reads your live cook and calls the next move — from fire-up to serve.

---

## 01 · Foundation

Everything else in this guide serves what's on this page. The mission is why we exist, the positioning is who we're for and why we're different, and the values are how we show up. When a decision is unclear, it's answered here.

### Mission

> **Turn your live cook data into real-time pitmaster feedback — making the right call at the right time.**

Not another readout. The value isn't the number — it's the decision. We read the cook as it happens and tell you what to do about it.

### Positioning

> **Whether BBQ is your summer or your life, knowyourpit is the AI BBQ coach in your corner — reading your cook in real time and telling you exactly when to make the next move. Other apps show you temperatures; we turn them into a pitmaster's call.**

The audience isn't a place or a skill level — it's a spectrum of devotion. We never call anyone a beginner. From the summer-weekend cook to the every-day-is-BBQ-season pitmaster, the coach meets you where you are.

**Category / descriptor:** AI BBQ coach. Never "grilling app," never just "planner."

### Values — how we show up

1. **Coach, never lecture.** We talk like the friend who happens to be an award-winning pitmaster — direct, generous, on your side. We assume you're capable, explain the why, and never talk down, no matter how new you are.

2. **Respect the craft.** BBQ is patience, fire, and feel. We're here to sharpen that, not replace it. The cook stays the pitmaster; we're the coach in the corner — we never pretend the app does the cooking.

3. **Built for the fire, not the showroom.** Every choice serves someone standing at a smoker at 5am: dark, legible, calm, one thing at a time. If it looks good in a portfolio but fails by the pit, it loses.

---

## 02 · Logo & Icon

The mark is a kettle grill whose interior temperature graph doubles as the product's core idea. The ember-gradient flame rises above it. The wordmark sets **know** and **pit** in charcoal with **your** in ember — the personal middle, the part that's *yours*. Use the variant whose linework contrasts with its surface.

### Variants

The logo comes as a full lockup (grill + wordmark) and an icon (glyph only, for app tile and avatars). Each has three legitimate treatments:

| Treatment | Mark | Surface | Use |
|---|---|---|---|
| Primary | White | Smoke (#393532) | The default brand field |
| Light surfaces | Dark | Bone / white | Print, light UI, light contexts |
| Dark surfaces | White | Charcoal (#0E0E10) | The dark app, dark backgrounds |

> Dark-mark-on-smoke is **not** a valid treatment — the contrast is too low. On any smoke surface, use the white mark.

### Clear space

Keep a margin equal to the height of the flame on all sides. Nothing — type, edges, other logos — enters that zone. Clear space scales with the mark at any size.

### Minimum sizes

The graph line inside the grill is the first detail to collapse when the mark shrinks. Below its floor, the nodes merge into a smudge and the "data inside the grill" idea is lost — so the icon and the full lockup have different limits.

| Element | Minimum | Below the floor |
|---|---|---|
| Icon | 40px / 0.4in | Use the simplified fallback (grill + flame, no graph) |
| Full lockup | 120px / 1in wide | Drop the wordmark, use the icon alone |
| Clear space | Always one flame-height on every side, at any size | — |

### App icon spec

- **Master:** 1024×1024px, no transparency, no rounding — iOS applies the mask.
- **Field:** Smoke #393532 with the white-linework mark, so it reads on both light and dark home screens.
- **Safe area:** Keep the mark within the center ~80%; corners get clipped by the platform mask.
- **Small renders:** Notification and Settings sizes fall below the graph's floor — ship the simplified fallback for these slots.

### Don't

- Recolor the flame or swap the ember gradient for a flat fill.
- Set the full lockup on a busy photo — use the glyph or add a scrim.
- Stretch, rotate, or add a drop shadow to the mark.
- Make **your** charcoal or **know / pit** ember — the split is fixed.
- Rebuild the wordmark in a different typeface.

---

## 03 · Color

Charcoal is the foundation — the app is always dark, by design, for readability beside a live fire. Two accents carry meaning, and each means one thing: **ember** is *now* (live cooks, primary actions, the flame); **indigo** is *planned* (scheduling, sequencing, the timeline). Never swap them. The signal colors are separate again, reserved for status. Bone and ash carry the type.

### Ember — the signature gradient (live / now)

A linear gradient, roughly 160°:

| Stop | Hex |
|---|---|
| Orange | `#D3642D` |
| Mid | `#C14931` |
| Red | `#A72831` |

### Indigo — secondary accent (planned / scheduled)

| Name | Hex | Role |
|---|---|---|
| Indigo | `#6C3BF6` | Planning, sequencing, timeline, "you are here" |
| Indigo dim | `#3A2A6E` | Timeline dots, muted tints, upcoming states |

### Charcoal — surfaces

| Name | Hex | Role |
|---|---|---|
| char 900 | `#0E0E10` | Splash & deepest surface |
| char 800 | `#161618` | Card & sheet base |
| char 600 | `#26262A` | Borders & dividers |
| smoke | `#393532` | Logo field, warm dark |

### Neutrals & signals

| Name | Hex | Role |
|---|---|---|
| bone | `#F4F1EA` | Primary text on dark |
| ash | `#B4B0A9` | Secondary text |
| on time | `#4E9E6A` | all_good · early / on time |
| behind | `#D69A2B` | running_behind · late drift |
| flare | `#C14931` | flare_up · alerts |

**Contrast:** bone on char-900 = 15.8:1 · ash on char-900 = 8.4:1 · ember-orange on char-900 = 4.9:1 (large / UI only).

---

## 04 · Typography

A condensed display face gives the brand its confident, all-lowercase voice — echoing the wordmark. Inter handles the interface. A mono face carries the thing this app is actually about: temperatures, timers, and drift.

| Role | Typeface | Usage |
|---|---|---|
| Display | **Barlow Semi Condensed** | Headlines. Always lowercase. Weights 700–800. Used with restraint — one big statement per screen. |
| Body | **Inter** | Body, labels, buttons. Sentence case in the UI. Weights 400–600. The neutral workhorse. |
| Mono | **JetBrains Mono** | Data, temps, timers, drift, IDs. Tabular figures so numbers never jump. |

**Specimens:**

- Display: *low & slow.*
- Body: *Your brisket hit 165°F at 4:12 — right on schedule. Wrap now and you'll rest by 6.*
- Mono: `203°F · 06:41:22 · +12 min late · pit 225°F`

---

## 05 · Voice

Talk like the best pitmaster you know coaching a friend: specific, encouraging, and honest about what the numbers say. Name what happened and what to do next. Never hype, never apologize for the fire.

### Sounds like us

- "165°F reached — wrap now to stay on schedule."
- "Running 12 minutes behind. Bump the pit to 250°F to catch up."
- "You're in the stall. Hold steady — the next move is to wrap in about 20 minutes."
- "Your bark scored a 4. The stall ran long — try wrapping earlier next time."
- "knowyourpit. own your cook."

### Not us

- "Oops! Something went wrong 😅"
- "Get ready for the ULTIMATE grilling experience!!!"
- "Your meat is probably done soon-ish."
- "Sorry to bother you, but maybe check the temp?"

---

## 06 · In the App

The product is dark-only and status-driven. Cook state and step drift map to a fixed set of signal colors so a pitmaster can read a screen at a glance from across the yard.

### Check-in & drift states

| State | Signal color |
|---|---|
| all good | on time (`#4E9E6A`) |
| running behind | behind (`#D69A2B`) |
| flare up | flare (`#C14931`) |
| low fuel | behind (`#D69A2B`) |
| on time / early | on time (`#4E9E6A`) |

### Surfaces

Stack char-900 base → char-800 cards → char-600 hairline borders. No pure black, no pure white.

### Two accents, each with a job

Ember means now — the active cook, the primary action, the flame. Indigo means planned — scheduling, sequencing, the timeline. Keep them in their lanes; a screen's color tells you at a glance whether you're looking at something live or something scheduled. Signal colors stay separate, for status only.

### Spacing — a 4px base

The app is built on Tailwind, so spacing steps in multiples of 4px. Pick from the scale; don't invent in-between values.

| Step | Token | Use |
|---|---|---|
| 4 | space-1 | icon-to-label, chip insets |
| 8 | space-2 | tight stacks, dot gaps |
| 12 | space-3 | label groups, list rows |
| 16 | space-4 | default gap, card padding |
| 24 | space-6 | between cards, card padding |
| 32 | space-8 | group separation |
| 48 | space-12 | section breaks |

### Radius

| Value | Use |
|---|---|
| 8px | inputs, chips |
| 14px | cards, sheets |
| 18px | phone frames |
| full (999px) | pills, buttons, status |

### Iconography

Icons are outline, not filled — thin, rounded strokes (~1.8px at 24px, rounded caps and joins) that echo the linework of the grill mark. The flame is the one exception: it's the single filled, ember-colored shape in the whole system. That contrast is the rule — line-work everywhere, one warm fill.

- **Style:** Outline only. No filled or duotone icons.
- **The flame:** The one filled shape, always ember. Never outline the flame; never fill any other icon.
- **Grid:** 24px artboard, 2px padding. Match optical weight to the grill mark's linework.
- **Color:** Bone or ash by default; ember or indigo only when the icon marks a live or planned action, per the accent rules.

---

## 07 · Product UI

The brand's truest expression is the app itself. The real screens are the reference for how charcoal, ember, indigo, the signals, and the pitmaster voice come together. When designing anything new, match them.

Reference screens: home dashboard, plan a cook, meat-cut picker, live temperature graph, pitmaster coaching, cook health grade, session schedule, and multi-cook sequence.

### Known drift — to reconcile

The app currently uses green (the on-time/all-good signal color) for the "Cook Now" button, which blurs status vs. action — green should mean status, not be a control. A few blue tints (the "pit" temperature chips) also sit outside the palette. Neither is part of the ember/indigo logic; both are noise to reconcile in the next design pass. Also outstanding: the simplified fallback icon that the minimum-size spec calls for does not yet exist as an asset.

---

## 08 · Messaging

One brand line, one descriptor, and a short list of proof points. Lead with the promise, back it with the specific capability. This is the language for the App Store, the site, and any ad.

- **The line:** knowyourpit. own your cook. *(Names the app, then the promise — knowing your cook is how you own it. Use it as a sign-off, not mid-sentence.)*
- **The descriptor:** AI BBQ coach. *(The coach in your corner, not a passive readout. Never "grilling app," never just "planner.")*

### Proof points — the five things it does

1. **Plan, start to serve** — Tell it the cut, the weight, and the serve time. It builds every window — light, on, wrap, pull — and alerts you.
2. **Sequence a spread** — Multi-Cook works backwards from serve time so brisket, ribs, and chicken all finish together.
3. **Scan a temp reading** — Upload a photo of a probe display or another app's graph, and knowyourpit reads the temperature off the image and logs it.
4. **Frozen-to-table** — Factors your thaw method into the timeline so you still hit serve time, safely.
5. **Live probes** — Connect MEATER, ThermoWorks, and various Bluetooth thermometers, and set target alerts.

---

## Reference

| | |
|---|---|
| App name | knowyourpit (always lowercase, no spaces) |
| Category | Food & Drink |
| Platform | iOS · iPhone & iPad (iOS 16.1+) |
| Price | Free · Pro $4.99/mo or $29.99/yr |
| Developer | Aaron Taylor |
| Website | knowyourpit.com |
| Copyright | © 2026 Aaron Taylor |

*This markdown mirrors the visual style guide (HTML/PDF). For the rendered version with color swatches, type specimens, and live logo/screen references, see the HTML or PDF edition.*
