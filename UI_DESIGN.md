# Halo — UI design contract

Clay chrome for a private Life OS. Field notebook, not spa. Tokens and components are the source of truth; this file is the product-facing contract so [`FUNCTIONAL_SPEC.md`](./FUNCTIONAL_SPEC.md) can stay behavior.

---

## Principle

**One Glance. One Action. One Outcome.**

Today is a five-second command, not a dashboard:

| Primitive | What it is | Next tap |
| --- | --- | --- |
| **One glance** | Life Score: Season rank + 0–100 + week trend + next-rank nudge + present pillar ticks (Good / Needs attention / Critical) | Insights → This month; share icon stays on the card |
| **One action** | Next Up (nearest enabled reminder or card bill) | Open it, or 1-tap complete |
| **One outcome** | Current Mission (one active Goal) plus optional 3-line Summary | Focus → Focus; Summary line → its hub |

Hubs hold lists. Capture is one FAB. No equal-weight card stack on Home. No widget wall.

---

## Voice

Field notebook. Short sentences. Clay, not marble.

- Mood **UI labels:** Good / Steady / Off / Rough. **Ids stay** `happy | neutral | sad | angry`.
- Hub kickers on Today / Journal / Focus / Wallet / Insights are empty. Do not restore spa lines (`PERSONAL PULSE`, “How you’ve been” as a fifth-tab vibe).
- Gender-neutral. One person on this phone.
- Empty lists stay empty. Halo does not invent numbers.

---

## Clay

Paper and Midnight from [`src/view/theme/tokens.ts`](src/view/theme/tokens.ts). Paper matches surfaces so extrusion reads as soft clay, not a card on white. Midnight paper is charcoal (`#2C2B28`), never `#000`, so highlight + shade can extrude.

| Token | Paper (light) | Midnight (dark) |
| --- | --- | --- |
| Paper / surface | `#E8E2D6` | `#2C2B28` |
| Ink | `#3A342E` | `#E4DDD4` |
| Accent | `#C96A3A` | `#E8B086` |
| Accent ink | `#FFF8F2` | `#2A1E16` |
| Well | `#DFD8CC` | `#252422` |
| Danger | `#B85A52` | `#E8A8A4` |

**Surfaces** (same hue as the canvas, dual shadow):

| Helper | Use |
| --- | --- |
| `raisedSurface` | Cards, tab bar, header actions |
| `insetSurface` | Search, fields, meters, mood orbs at rest, segment track |
| `raisedAccent` | Primary clay control, hub FAB |
| `chipSurface` | Filters — inset idle, raised + 1.5px accent glow selected |

**`GlassSurface` is neumorph, not blur.** Native and web render `raisedSurface`. No `BlurView` / Liquid Glass on chrome — glass fights clay. The name is leftover; the fill is dual-shadow clay.

Grouped iOS corner: `groupedRadius` 16. Cards often 20–28. Form cards 22.

---

## Type

**System UI.** San Francisco on iPhone, Roboto on Android, `system-ui` on web. Named families are omitted on native so Dynamic Type applies.

Fraunces and Outfit are **retired** from chrome. Do not reintroduce webfonts for titles or body.

Roles live in [`src/view/theme/typography.ts`](src/view/theme/typography.ts) (`createTypography`): large title 34 → caption 12, plus `tabLabel` (clamped ≤ 12px) and `navTitle`. Weight carries hierarchy. No locked `lineHeight` so user scale can grow.

Scale via `TypographyProvider` + Settings → Text size (System / Small / Default / Large / Extra Large). Everyday labels wrap (max two lines) or shrink on native (floor ~0.7). Flex children use `minWidth: 0` on web.

**Tabular numerals** (`fontVariant: ['tabular-nums']`) on money, percents, Season score, chart captions, Worth, spend rows.

---

## Chrome

| Piece | File | Contract |
| --- | --- | --- |
| Five-tab bar | [`FloatingTabBar.tsx`](src/view/components/FloatingTabBar.tsx) | Edge-to-edge raised bar. Today · Journal · Focus · Wallet · Insights. Ionicons + labels. **Not** a floating island, **not** Material FAB. Focus’s route folder stays `calendar`. Settings is not a tab. |
| Hub segments | [`HubSegmentControl.tsx`](src/view/components/HubSegmentControl.tsx) | Inset track, raised selected pill, ≥44pt, press scale ~0.97. Journal Timeline/Calendar/Memories · Focus Due/Streaks/Focus · Wallet Upcoming/Cashflow/Subscriptions/Worth · Insights This week/This month. |
| Capture FAB | [`HubCaptureFab.tsx`](src/view/components/HubCaptureFab.tsx) | 56pt clay accent, all five hubs. Opens a **3-tile** sheet: Thought / Expense / Habit. Transfer is Wallet-only (`/transfer/new`), not a fourth tile. |
| Large title | [`LargeTitle.tsx`](src/view/components/LargeTitle.tsx) | Root hubs + Settings. Scaled HIG large title. |
| Header actions | Home, Journal, Focus, Insights | Circular-ish **44pt** raised buttons (search, cog, prompts, compose, +). Press scale ~0.94. |
| Form group | [`FormCardGroup.tsx`](src/view/components/FormCardGroup.tsx) | Raised card padding **16×14**. Sticky keep/save under the sheet. |

iOS-first grouped navigation, shared on Android (not Material-3). Compact Back on pushed screens.

---

## Motion

- Press scale ~**0.94–0.97** + light haptic on tabs, segments, FAB, header actions, tiles.
- Haptics follow Settings → Preferences. Off = no-op.
- **Reduce Motion:** skip decorative wash animation (`AmbientBackground`). Photo reel uses a crossfade instead of snap paging.
- Worth sparkline and Insights week/month bars are **already static** (View heights, no fill animation). Do not add decorative bar animation that would then need a Reduce Motion branch.

---

## Insights

Tab 5 is a **chart board**, not a scoreboard essay and not a Bloomberg terminal.

| Piece | Contract |
| --- | --- |
| **Takeaway** | One pressure line (`InsightsTakeaway`). Tappable. Wins / risks / action lists stay off the screen. |
| **Season** | Circular clay score well (0–100 tabular) + inset meter + present pillar bars. Not XP. |
| **Writing** | Week: 7 View bars. Month: ~30 View bars + pace caption. Future days empty. |
| **Habit** | Circular % well + inset track. Missing domain = empty frame + invite. |
| **Spend** | Two-bar this vs last. Clay accent, not neon candlesticks. |
| **Worth** | Month only. Reuse Worth sparkline helper. Empty = designed well. |
| **Mood** | One stacked segment bar (Good / Steady / Off / Rough). Not `MoodTrendCharts` daily/weekly/monthly dumps. |
| **Empty** | Chart frames still draw. Sparse invites Write / Habit / Spend (Worth on month). |
| **Share** | This month card unchanged. **Share Season** (rank, score, present pillars, optional trend) from Today Life Score and Insights. Week prediction echo unchanged. |

Deep links from a chart go to Journal / Focus / Wallet. Do not reprint Rhythm heatmaps or Wallet category tables here. Do not restuff Today.

---

## Accessibility

- Tap targets ~**44pt** (tabs, segments, header actions, complete check, FAB).
- Dynamic Type through `TypographyProvider` / `useTypography()`.
- Labels wrap or shrink; meaning is not cut to “Month…”.
- Selected chips use accent border + glow so daylight contrast holds.
- VoiceOver: icon-only chips still speak the type. FAB speaks Fast Capture.

---

## Do not

These are design anti-patterns, not backlog items:

- **Sixth tab.** Settings is a cog. Photos is Settings → Photos.
- **XP / loot.** Season is a derived rank (Spark → Steel), not points, streaks-as-currency, or a battle pass.
- **Spa kickers** on hubs. Empty kicker strings stay empty.
- **Finance-bro neon.** Clay accent, not cyan/lime charts.
- **Equal-weight card stacks on Today.** Recurring strip, mood bar, week chips, photos, on-this-day, prediction, and reflection cue do not return to Home.
- **Widget wall.** One glance, one action, one outcome. Lists belong in Journal / Focus / Wallet / Insights.

---

## Where Look is chosen

Settings → Appearance: **Paper / Midnight / System**. This file is the clay; that screen is the switch.
