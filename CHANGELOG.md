# Changelog

## 2026-09-10
- Date: 2026-09-10
- Description: **One-glance Today** — Home is now one Season score, one Next Up action, and one Focus goal above the fold. Compact date + greeting (writing streak dropped; it lives in Season/Insights). Compact Season hero (rank + meter + present-only pillar ticks) replaces the muted Season line; tap opens Insights This month. Recurring strip, prediction, mood bar, this-week chips, photo highlight, on-this-day, and reflection cue leave Today (prediction stays on Insights week; photos stay in Journal / Settings Photos). FAB Write / Spend / Habit unchanged. Five tabs kept. No cloud AI, no Focus Session, no 5-button action row.
- Affected modules: View (`HomeScreen.tsx`, `TodaySeasonHero.tsx`, `TodayFocusRow.tsx`); i18n (`season.heroA11y` in en / zh-Hant / zh-Hans / ja); CHANGELOG
- Reason: UX — 5-second glance: one composite status + the next tap, not a widget wall
- Impact: High

## 2026-09-10
- Date: 2026-09-10
- Description: **Insights board pack** — Tab 5 Insights is no longer a sparse three-line scoreboard. This week | This month keeps the same math and pressure, but the screen now reads as a private board pack: Season hero (rank + 0–100 meter + writing/habits/envelopes bars; missing pillars omitted), 2-column glance tiles with vs-last deltas (aligned week/month-to-date), a 7-cell writing strip or month pace bar, and one editorial takeaway. Sparse first week/month still draws the board and invites Write / Habit / Spend (Worth on month) via existing hubs. No cloud AI, no sixth tab, no Rhythm/Wallet list reprint.
- Affected modules: Model (`insights/boardFacts.ts`, `life/weekBounds.ts`, `season/seasonRank.ts`, tests); View (`InsightsScreen.tsx`, `InsightsSeasonHero.tsx`, `InsightsGlanceGrid.tsx`, `InsightsWeekStrip.tsx`, `InsightsTakeaway.tsx`, `insightsCopy.ts`); i18n (en / zh-Hant / zh-Hans / ja); CHANGELOG
- Reason: UX — Sunday / 1st Insights should feel like Apple Health + YNAB glance in Halo clay, not three muted lines
- Impact: Medium

## 2026-09-10
- Date: 2026-09-10
- Description: **Future Life OS MVP** — On-device **predictive insights** (at most one Today line under Season, optional Insights This week echo; overdue/card due → sub renewal ≤7d → envelope pace → writing quiet Thu–Sun; skip if it duplicates Next Up). **Prompt library** with tagged Today / Gratitude / Review / Focus ids (`prompts.*` in en / zh-Hant / zh-Hans / ja); picker from Journal header and Compose; `getDailyPrompt` stays the date rotation. **Wallet Worth sparkline** from `netWorthHistory` as View bars (omit if empty; static for reduce-motion). **Shareable monthly-report image** (`MonthlyReportCard` + `react-native-view-shot` + expo-sharing on Insights This month; web text summary or “Save on phone”). No cloud AI, no new push notifications.
- Affected modules: Model (`insights/predictions.ts`, `insights/monthlyShare.ts`, `journal/prompts.ts`, `finance/netWorthSparkline.ts`, `life/reflectionCue.ts`, tests); View (`TodayPredictionLine`, `PromptLibrarySheet`, `NetWorthSparkline`, `MonthlyReportCard`, `MonthlyReportShareButton`, `HomeScreen`, `InsightsScreen`, `JournalScreen`, `ComposeScreen`, `WalletWorthPanel`, `insightsCopy.ts`); Data (`shareMonthCard.native.ts` / `.web.ts`); i18n (en / zh-Hant / zh-Hans / ja); CHANGELOG; `react-native-view-shot` 5.1.0
- Reason: Product — predict the next useful action from data already on the phone; export a month picture without a feed
- Impact: High

## 2026-09-10
- Date: 2026-09-10
- Description: **Halo Life OS Days 22–30 (Season + Insights month + onboarding map)** — Private **Season** rank is derived (not stored) from 30-day writing days, habit hit rate, and budget discipline: Spark → Ember → Forge → Temper → Steel. Compact mark on Today under the greeting (Next Up stays the hero); Insights shows the same rank. Insights is **This week | This month** synthesis + deep links (not a reprint of Rhythm/Wallet lists). Monthly board pack: pages, habit hits, spend vs last month, net-worth snapshot delta, one pressure line (rule-based, no cloud LLM). Onboarding adds a 15s hub map after name + privacy, with an optional lock mention. Close-the-day skipped so Today density holds. New `season.*` / `insights.*` / onboarding map strings in en / zh-Hant / zh-Hans / ja.
- Affected modules: Model (`season/seasonRank.ts`, `insights/pressure.ts`, `insights/weeklyReport.ts`, `insights/monthlyReport.ts`, `journalStats.ts`, `habitStreaks.ts`, tests); View (`TodaySeasonMark.tsx`, `HomeScreen.tsx`, `InsightsScreen.tsx`, `OnboardingScreen.tsx`, `insightsCopy.ts`); i18n (en / zh-Hant / zh-Hans / ja); CHANGELOG
- Reason: Product — private mastery loop and Sunday/month scoreboard without XP, community, or cloud AI
- Impact: High

## 2026-09-10
- Date: 2026-09-10
- Description: **Halo Life OS Days 15–21 (Wallet Worth)** — Wallet hub gains a fourth **Worth** segment (always visible, not an advanced-finance lab). Empty state invites the first manual asset. CRUD for existing Asset and Loan models (cash / bank / investment / property; mortgage / personal / car). Savings target compares a typed goal to cash + bank only (investments stay holdings). Monthly net-worth snapshots persist on the finance document beside assets; live math stays in `computeNetWorth`. Removed Cashflow “coming later” copy. New `worth.*` i18n in en / zh-Hant / zh-Hans / ja.
- Affected modules: Model (`savingsTarget.ts`, `netWorthHistory.ts`, `Account.ts`, `normalizeFinance.ts`, tests); Controller (`FinanceController.ts`, `FinanceProvider.tsx`); View (`MoneyScreen.tsx`, `WalletWorthPanel.tsx`, `AssetEditScreen.tsx`, `LoanEditScreen.tsx`); Routes (`app/asset/*`, `app/loan/*`, `app/_layout.tsx`); Backup (`serializeBackup.ts`); i18n (en / zh-Hant / zh-Hans / ja); CHANGELOG
- Reason: Product — first-time investor and side-hustler need a one-number Worth home without bank login or a brokerage cockpit
- Impact: High

## 2026-09-10
- Date: 2026-09-10
- Description: **Halo Life OS Days 8–14 (Goals / Focus)** — New Goal model (title, why, target date, optional metric, linked reminder IDs, active/paused/done) with pure progress math (metric > linked check-ins > calendar). Thin GoalController + GoalProvider persist on-device JSON; encrypted backup serialize/restore includes Goals (older v1 files without `goals` restore as empty). Rhythm gains a third **Focus** segment (list/create/edit); header + still creates Habit/One-off. Today shows one compact active-goal row under the due strip (not a second hero). Reminder schema unchanged — links live on the Goal.
- Affected modules: Model (`src/model/goals/*`, `BackupDocument.ts`, `serializeBackup.ts`); Controller (`GoalController.ts`, `GoalProvider.tsx`, `BackupController.ts`); Data (`GoalsLocalStore.ts`); View (`RhythmScreen.tsx`, `RhythmFocusPanel.tsx`, `GoalEditScreen.tsx`, `TodayFocusRow.tsx`, `HomeScreen.tsx`, `BackupPanel.tsx`); Routes (`app/_layout.tsx`, `app/goals/*`); Config (`appConfig.ts`); i18n (`goals.*` + `rhythm.tabFocus` in en / zh-Hant / zh-Hans / ja); CHANGELOG
- Reason: Product — real Goals with progress on Rhythm Focus and one compact Today row, not reminder-kind labels
- Impact: High

## 2026-09-10
- Date: 2026-09-10
- Description: **Halo Life OS Days 1–7 (ritual and language)** — Locked tab = title = capture verb across en / zh-Hant / zh-Hans / ja: Journal (not Pages), Wallet (not Money/Overview), Write / Spend / Habit. Today is a 30-second ritual (greeting via `home.hello` + streak + Next Up + due strip; photo memories below the fold) with a Settings gear on the header. One `HubCaptureFab` on all five hubs opens a 3-tile Fast Capture sheet; Transfer stays reachable from Wallet (`/transfer/new`), not the sheet. Removed Today capsule Write/Record/Spend and `InlineHomeQuickAdd`. Mood check-in is Good / Steady / Off / Rough. Insights kicker is This week / Pulse, not PERSONAL PULSE. Settings → Photos opens `/memories`. Tone pass: field notebook, clay neumorphism kept.
- Affected modules: View (`HomeScreen.tsx`, `HubCaptureFab.tsx`, `GlobalFastCaptureSheet.tsx`, `QuickMoodBar.tsx`, `FloatingTabBar.tsx`, `JournalScreen.tsx`, `RhythmScreen.tsx`, `MoneyScreen.tsx`, `InsightsScreen.tsx`, `SettingsScreen.tsx`, `LargeTitle.tsx`); i18n (`en.ts`, `zh-Hant.ts`, `zh-Hans.ts`, `ja.ts`, `greeting.ts`); Routes (`app/(tabs)/_layout.tsx`); CHANGELOG. Removed `InlineHomeQuickAdd.tsx`.
- Reason: Product — daily 30s ritual and naming lock; cut capture duplication and spa copy
- Impact: High

## 2026-09-10
- Date: 2026-09-10
- Description: **Glanceable Money Spends list** — Redesigned Cashflow spend rows so “what / how much / when / how paid” reads in one second: day-group headers (`date.today` / `date.yesterday` / `formatShortDate`), note-or-category primary title, right-aligned tabular amount with a second FX estimate line for foreign spends, and a glanceable card/cash badge. Tactile press (scale + opacity) still opens `/expense/[id]`. New `date.yesterday` key with parity across en / zh-Hant / zh-Hans / ja.
- Affected modules: View (`MoneyScreen.tsx`, `SpendCardBadge.tsx`); i18n (`en.ts`, `zh-Hant.ts`, `zh-Hans.ts`, `ja.ts`); CHANGELOG
- Reason: UX — amount-first ISO rows made scanning “what I spent” hard; duplicate Lunch cards had almost no visual distinction
- Impact: Medium

## 2026-09-10
- Date: 2026-09-10
- Description: **Store-ready polish** — Halo display name stays consistent; splash/adaptive-icon wash matches paper (`#E8E2D6`) and dark (`#2C2B28`) with `resizeMode: contain` and light/dark splash plugin variants (raster files in `assets/` are still Expo starter marks — need a designer Halo PNG). Privacy onboarding + Settings/Privacy lead with “stays on this phone / nothing uploaded.” Notification permission prompts only when she enables a reminder or taps Allow — not on cold start, foreground, sound flip, or restore. Sound vs silent still follows Customize. Lock PIN remains the fail-open path after a biometric cancel; Android back pops via `leaveScreen` and cannot dismiss the lock gate. Backup idle/export/import copy makes the write-down-password + new-phone restore path explicit. Splash hides only after settings + auth (unchanged).
- Affected modules: Config (`app.json`, `appConfig.ts`); Routes (`app/_layout.tsx`); Controller (`ReminderController.ts`, `ReminderProvider.tsx`, `BackupController.ts`); Data (`reminderNotifications.native.ts`, `reminderNotifications.web.ts`); Model (`notificationPermission.ts`, lock-after tests); View (`LockScreen.tsx`, `PrivacyScreen.tsx`, `BackupPanel.tsx`, `NotificationObserver.native.tsx`, `AndroidBackBridge.tsx`, `RhythmTasksPanel.tsx`); Utils (`navigation.ts` tests); i18n (en / zh-Hant / zh-Hans / ja); CHANGELOG
- Reason: Store / sideload trust — icon/splash brand, privacy one-liner, notifications that fire without a launch prompt, lock that always unlocks, backup she can restore, Android back that does not freeze
- Impact: Medium

## 2026-09-09
- Date: 2026-09-09
- Description: **Global Fast Capture Sheet** — Unified Today FAB into a contextual creation hub (`GlobalFastCaptureSheet`) with four neumorphic tiles: Journal Story (`/compose?mode=text`), Log Spend (handoff to `QuickSpendSheet`), New Habit / Task (`/reminders/new`), and Transfer Funds (`/transfer/new`). Sheet uses `SheetChrome`, tactile scale-0.97 press + light haptic, and full `capture.*` i18n parity across en / zh-Hant / zh-Hans / ja.
- Affected modules: View (`GlobalFastCaptureSheet.tsx`, `HomeScreen.tsx`); i18n (`en.ts`, `zh-Hant.ts`, `zh-Hans.ts`, `ja.ts`); CHANGELOG
- Reason: UX — eliminate creation siloing with one Fast Capture ritual from Today
- Impact: High

## 2026-09-09
- Date: 2026-09-09
- Description: **Tabular numerals on finance list surfaces** — Enforced `fontVariant: ['tabular-nums']` on transaction/budget/transfer metas, subscription renewal countdowns & amount pills, payment-card rebate/cap/grace badges, Today recurring strip amounts, billing-cycle steppers & grace badges, spend-simulator rebate yields, and transfer balance/fee fields so digits stay width-stable during live updates.
- Affected modules: View (`MoneyScreen.tsx`, `SubscriptionsCockpitScreen.tsx`, `PaymentCardsScreen.tsx`, `TodayRecurringStrip.tsx`, `CardBillingCycleCard.tsx`, `DayOfMonthStepper.tsx`, `CardSpendSimulator.tsx`, `TransferScreen.tsx`, `Chip.tsx`); CHANGELOG
- Reason: UX — eliminate horizontal digit jitter on financial lists, countdowns, and real-time rebate math
- Impact: Medium

## 2026-09-09
- Date: 2026-09-09
- Description: **Elevate Insights to Tab 5** — Promoted Insights into the floating tab bar (pie-chart icon / `tabs.insights`) and moved Settings off the primary tabs (`href: null`). Insights gains an editorial lockup (`PERSONAL PULSE` + title) with a tactile circular Settings cog that pushes root `/settings`, plus a 3-segment hub (`Reflection` / `Habits` / `Money Pulse`) covering writing + mood climate, habit streak records, and net-worth / spend / budget pulse. New i18n keys with 100% parity across en / zh-Hant / zh-Hans / ja.
- Affected modules: View (`FloatingTabBar.tsx`, `InsightsScreen.tsx`, `SettingsScreen.tsx`); Routes (`app/(tabs)/_layout.tsx`, `app/(tabs)/insights.tsx`, `app/(tabs)/settings.tsx`, `app/settings.tsx`, `app/_layout.tsx`); i18n (`en.ts`, `zh-Hant.ts`, `zh-Hans.ts`, `ja.ts`); CHANGELOG
- Reason: UX/IA — elevate daily personal analytics into a retention hub; keep Settings as a low-frequency stack destination
- Impact: High

## 2026-09-09
- Date: 2026-09-09
- Description: **Multi-domain Calendar Activity Dots & Day Inspection** — Elevated `JournalCalendarView` companion mode with synthesized activity dots (amber journal / emerald habits / accent spends), accent-ring selected day cells with light haptic, and sectioned day drawer cards: journal stories (mood glyph + photo strip), habits with 1-tap complete toggle, spends with tabular-nums amounts, count summary pills, and empty-day Write / Add task / Log spend actions. New i18n keys with parity across en / zh-Hant / zh-Hans / ja.
- Affected modules: View (`journal/JournalCalendarView.tsx`); i18n (`en.ts`, `zh-Hant.ts`, `zh-Hans.ts`, `ja.ts`); CHANGELOG
- Reason: UX — cross-cutting calendar synthesis so month glance shows holistic life activity (Journal + Rhythm + Wallet)
- Impact: High

## 2026-09-09
- Date: 2026-09-09
- Description: **Comprehensive UX/UI Architecture & Navigation Overhaul (Phases 1–4)** — Completed the Halo information-architecture and design-system roadmap from the product UX audit:
  1. **Rhythm Hub (Tab 3)** — Consolidated Reminders + Habit Streaks into `RhythmScreen` with `Tasks & Due` vs `Consistency` segments; legacy `/reminders`, `/habits`, and `calendar/reminders` deep-link into the hub.
  2. **Money Hub (Tab 4)** — Restructured into a 3-segment financial home (`Cashflow` / `Subscriptions` / `Cards & Rewards`) via shared `HubSegmentControl`; Subscriptions Cockpit and Payment Cards embed in-tab so the floating tab bar stays visible.
  3. **Journal + Calendar Companion (Tab 2)** — Integrated month-grid calendar into `JournalScreen` as `Timeline` vs `Calendar` with activity dots, day detail, and empty-day quick actions (`JournalCalendarView`).
  4. **Design-system polish** — Applied `fontVariant: ['tabular-nums']` across calculator wells (`AmountCalculatorField`, `QuickSpendSheet`), Money / Subscriptions hero amounts, and amount row titles; standardized `FormCard` padding to 16×14pt; unified Rhythm segment control onto shared `HubSegmentControl` for tactile parity with Money and Journal. Verification: `npm test` 60/60 pass; `npx tsc --noEmit` clean.
- Affected modules: View (`RhythmScreen.tsx`, `MoneyScreen.tsx`, `JournalScreen.tsx`, `HubSegmentControl.tsx`, `FormCardGroup.tsx`, `AmountCalculatorField.tsx`, `QuickSpendSheet.tsx`, `SubscriptionsCockpitScreen.tsx`, rhythm/journal panels); Routes (tabs layouts, legacy redirects); i18n (en / zh-Hant / zh-Hans / ja); CHANGELOG
- Reason: UX/IA + Design System — eliminate navigation fragmentation, keep tab-bar orientation, and stop monetary digit jitter during edit/FX conversion
- Impact: High

## 2026-09-09
- Date: 2026-09-09
- Description: **Journal + Calendar Companion View** — Integrated the month-grid calendar into `JournalScreen` as a neumorphic 2-segment hub (`Timeline` / `Calendar`) via `HubSegmentControl`. Timeline keeps kind filter chips, `SearchFilters`, chronological groups, and global search hits. Calendar mode adds month navigation, 7×weeks activity dots (mood / reminder / spend), selected-day entries with photo thumbs, due reminders, logged spends, empty-day quick actions, and jump-to-today with light haptic. Extracted `JournalCalendarView` under `screens/journal/`. `CalendarScreen` retained as a compile-safe fallback. New i18n: `journal.viewTimeline`, `journal.viewCalendar`, `journal.dayEvents`, `journal.emptyDay` with 100% parity across en / zh-Hant / zh-Hans / ja.
- Affected modules: View (`JournalScreen.tsx`, `journal/JournalCalendarView.tsx`); Routes (`app/(tabs)/calendar/index.tsx` comment); i18n (`en.ts`, `zh-Hant.ts`, `zh-Hans.ts`, `ja.ts`); CHANGELOG
- Reason: UX/IA — re-anchor Calendar as Journal companion for date-based memory browsing (Apple Journal / Day One pattern)
- Impact: High

## 2026-09-09
- Date: 2026-09-09
- Description: **Money Hub 3-Segment Restructure** — Refactored `MoneyScreen` from an overcrowded vertical scroll into a neumorphic 3-segment financial hub (`Cashflow` / `Subscriptions` / `Cards & Rewards`) via shared `HubSegmentControl`. Cashflow keeps spent hero, Add Spend / Quick Spend, Transfer + Income actions, focus chips (All / Income / Spends / Budgets / Transfers), and transaction/budget/transfer lists. Subscriptions Cockpit and Payment Cards embed in-tab (`embedded` prop) so the floating tab bar stays visible; standalone `/subscriptions` and `/payment-cards` routes remain. Deep-link support via `?segment=subscriptions|cards`. i18n: `money.tabCashflow`, `money.tabSubscriptions`, `money.tabCards` across all 4 locales.
- Affected modules: View (`MoneyScreen.tsx`, `HubSegmentControl.tsx`, `SubscriptionsCockpitScreen.tsx`, `PaymentCardsScreen.tsx`); i18n (`en.ts`, `zh-Hant.ts`, `zh-Hans.ts`, `ja.ts`); CHANGELOG
- Reason: UX/IA — consolidate orphaned finance stack screens into Tab 4 without losing tab-bar orientation
- Impact: High

## 2026-09-09
- Date: 2026-09-09
- Description: **Rhythm & Habits Hub (Tab 3)** — Consolidated Reminders list and 90-day Habit Streaks heatmap into a unified `RhythmScreen` under main Tab 3. Two-segment control: Tasks & Due (category filters, upcoming groups, completed-today undo) vs Consistency (heatmap matrix, rhythm summary, streak cards with 1-tap check-in). Tab bar label/icon updated to `tabs.rhythm` / checkbox. Legacy routes (`/reminders`, `/habits`, `calendar/reminders`) redirect or render the hub. Calendar month view screen preserved for Journal companion work. New `rhythm.*` i18n keys with 100% parity across en / zh-Hant / zh-Hans / ja.
- Affected modules: View (`RhythmScreen.tsx`, `rhythm/RhythmTasksPanel.tsx`, `rhythm/RhythmStreaksPanel.tsx`, `RemindersScreen.tsx`, `HabitStreaksScreen.tsx`, `FloatingTabBar.tsx`); Routes (`app/(tabs)/calendar/*`, `app/habits.tsx`, `app/reminders/index.tsx`, `app/(tabs)/_layout.tsx`); i18n (`en.ts`, `zh-Hant.ts`, `zh-Hans.ts`, `ja.ts`); CHANGELOG
- Reason: UX Information Architecture — eliminate context-switching between reminders management and habit consistency analysis
- Impact: High

## 2026-09-09
- Date: 2026-09-09
- Description: **Root Tab Editorial Headers** — Replaced plain one-word tab titles (`Pages`, `Calendar`, `Money`, `You`/`Settings`) with a cohesive editorial lockup matching Home: accented kicker + hero `LargeTitle` + tactile 44pt circular action/status. Journal gains a write (`create-outline`) shortcut to `/compose?mode=text`; Calendar uses dynamic `month.heading` with jump-to-today (`today-outline` + haptic); Money opens Quick Spend (`flash-outline`); Settings shows an on-device privacy shield badge. New i18n keys with 100% parity across `en`, `zh-Hant`, `zh-Hans`, `ja`.
- Affected modules: View (`JournalScreen.tsx`, `CalendarScreen.tsx`, `MoneyScreen.tsx`, `SettingsScreen.tsx`); i18n (`en.ts`, `zh-Hant.ts`, `zh-Hans.ts`, `ja.ts`); CHANGELOG
- Reason: UX/UI Enhancement — remove generic tab-label headers and align all primary tabs with Home’s editorial date lockup system
- Impact: Medium

## 2026-09-09
- Date: 2026-09-09
- Description: **Home Screen Header Editorial Refinement** — Streamlined and elevated the Home screen header: (1) Replaced the redundant "Today" title and generic "Good evening, Writer" subtitle with an elegant, iOS Calendar-style date lockup featuring an accented weekday kicker (`WEDNESDAY`) paired with a hero `LargeTitle` date heading (`September 9`); (2) Upgraded the global journal search trigger into a tactile neumorphic circular action button (`searchButton`, size 44pt, radius 22, micro-scale `0.94` on press); (3) Added `formatHeaderDate` pure helper in `dateUtils.ts` with full Intl localization; (4) Eliminated visual clutter and vertical dead space before the primary action capsule.
- Affected modules: View (`HomeScreen.tsx`); Utils (`dateUtils.ts`); CHANGELOG
- Reason: UX/UI Enhancement — remove generic placeholder greeting, eliminate redundant header copy, and align with iOS HIG editorial date typography
- Impact: Low

## 2026-09-09
- Date: 2026-09-09
- Description: **Quick Spend Sheet UX/UI Enhancement** — Restructured `QuickSpendSheet` from a single vertically stacked scroll into a two-mode neumorphic segmented control: (1) **1-Tap & Voice** — Smart Suggestion hero, One-Tap Templates grid, deduplicated Recent Spends strip (icon + title + amount), and Voice Quick Add; (2) **Custom Keypad** — right-aligned amount well with currency + category pill + Clear, labeled category chips (`leadingIcon` + text), compact 3×4 tactile keypad (raised→inset, scale 0.96), and sticky bottom `PrimaryButton` Log CTA that stays on-screen (`Log %{amount}` when ready). Added `spend.quickModeInstant`, `spend.quickModeKeypad`, `spend.logAmount` across all 4 locales.
- Affected modules: View (`QuickSpendSheet.tsx`); i18n (`en.ts`, `zh-Hant.ts`, `zh-Hans.ts`, `ja.ts`); CHANGELOG
- Reason: UX/UI Polish — eliminate vertical bloat, keep primary Log CTA visible, improve amount well balance and category discoverability
- Impact: Medium

## 2026-09-09
- Date: 2026-09-09
- Description: **Deprecate `props.pointerEvents` in favor of `style.pointerEvents`** — Migrated all legacy JSX element-level `pointerEvents` props to modern `style.pointerEvents` across Web and Native: (1) `DayOfMonthStepper.tsx` (ordinal text); (2) `DateField.web.tsx` (formatted date display text); (3) `FloatingTabBar.tsx` (floating bar container `styles.wrap`); (4) `PhotoReelViewer.tsx` (`taps`, `top`, and `bottom` overlays); (5) `AmbientBackground.web.tsx` & `AmbientBackground.native.tsx` (background wash layer). Eliminates React Native Web console deprecation warning `props.pointerEvents is deprecated. Use style.pointerEvents` and adheres to modern React Native / CSS pointer-events standards.
- Affected modules: View (`DayOfMonthStepper.tsx`, `DateField.web.tsx`, `FloatingTabBar.tsx`, `PhotoReelViewer.tsx`, `AmbientBackground.web.tsx`, `AmbientBackground.native.tsx`); CHANGELOG
- Reason: Web / React Native Deprecation Cleanup — migrate from legacy `props.pointerEvents` to modern `style.pointerEvents`
- Impact: Low

## 2026-09-09
- Date: 2026-09-09
- Description: **Fix React DOM validateDOMNesting: Nested `<button>` in AmountCalculatorField** — Resolved invalid HTML DOM hierarchy (`<button> cannot contain a nested <button>`) on Web. Refactored `AmountCalculatorField` amount well: replaced the outer `Pressable accessibilityRole="button"` container with a neutral `<View>` container, and separated its child interactions into discrete sibling controls: (1) independent clear action (`Pressable accessibilityRole="button"`), (2) interactive edit pill toggle (`Pressable accessibilityRole="button"`), and (3) interactive amount display area (`Pressable accessibilityRole="button"`). Added tactile active press states (`opacity: 0.6` / `0.75` / `0.85`) across all three controls. Eliminates React DOM nesting warnings and prevents event propagation collisions between clearing and expanding.
- Affected modules: View (`AmountCalculatorField.tsx`); CHANGELOG
- Reason: Web / React DOM Bug Fix — eliminate HTML invalid nesting error when rendering React Native Web buttons
- Impact: Low

## 2026-09-09
- Date: 2026-09-09
- Description: **Button Tactile Design System & UX/UI Polish** — Comprehensive review and polish of buttons across the app: (1) Added native micro-scale depression and opacity feedback on active press across design system controls (`PrimaryButton` scale 0.985/0.92, `SectionActionButton` scale 0.97/0.85, `TextButton` opacity 0.6, `Chip` scale 0.97/0.85); (2) Removed duplicate CTA buttons in `SubscriptionsCockpitScreen` empty state and added tactile press states on 1-tap renewal log buttons; (3) Added active depression feedback on 1-tap habit check-in buttons in `HabitStreaksScreen`; (4) Refactored navigation entry hierarchy by extracting `Transfer` & `Subscriptions` on `MoneyScreen` and `Habit Streaks` on `RemindersScreen` into dedicated `SectionActionButton` quick action rows separate from logging/filtering chips; (5) Resolved duplicate TypeScript import in `SubscriptionsCockpitScreen.tsx`.
- Affected modules: View (`PrimaryButton.tsx`, `SectionActionButton.tsx`, `TextButton.tsx`, `Chip.tsx`, `SubscriptionsCockpitScreen.tsx`, `HabitStreaksScreen.tsx`, `MoneyScreen.tsx`, `RemindersScreen.tsx`); CHANGELOG
- Reason: UX/UI Polish — physical touch feedback, clean visual navigation hierarchy, and eradication of competing empty-state buttons
- Impact: Medium

## 2026-09-09
- Date: 2026-09-09
- Description: **Subscriptions Cockpit & Habit Consistency Heatmap** — Implemented two core privacy life management pillars: (1) **Subscriptions & Recurring Contract Cockpit** (`subscriptionCockpit.ts`, `SubscriptionsCockpitScreen.tsx`, route `app/subscriptions.tsx`) providing monthly burn rate, annual projections, upcoming 14-day renewal countdowns with 1-tap spend logging, paying credit card allocation, and category breakdowns; (2) **Habit Streaks & Consistency Heatmap** (`habitStreaks.ts`, `HabitStreaksScreen.tsx`, route `app/habits.tsx`) providing 90-day tactile rhythm matrix (7×13 grid), filterable All Habits vs single-habit density views, flame streak badges (`🔥 14 days`), best streak records, 30-day consistency analytics, and 1-tap check-in toggles; (3) **Navigation & i18n Integration** with registered routes in `app/_layout.tsx`, navigation entry chips in `MoneyScreen.tsx` and `RemindersScreen.tsx`, and 31 new localized strings with 100% key parity across `en.ts`, `zh-Hant.ts`, `zh-Hans.ts`, and `ja.ts`.
- Affected modules: Model (`subscriptionCockpit.ts`, `subscriptionCockpit.test.ts`, `habitStreaks.ts`, `habitStreaks.test.ts`); View (`SubscriptionsCockpitScreen.tsx`, `HabitStreaksScreen.tsx`, `MoneyScreen.tsx`, `RemindersScreen.tsx`); Routes (`app/subscriptions.tsx`, `app/habits.tsx`, `app/_layout.tsx`); i18n (`en.ts`, `zh-Hant.ts`, `zh-Hans.ts`, `ja.ts`); CHANGELOG
- Reason: Feature Implementation — deliver privacy-first personal subscriptions management and habit consistency tracking with 100% on-device data sovereignty
- Impact: High

## 2026-09-09

## 2026-09-09
- Date: 2026-09-09
- Description: **Credit Card Calculation Engine Comprehensive Upgrade** — Full architectural overhaul of rebate engine: (1) Added configurable billing statement cycles vs calendar month (`billingCycleType`) with `getCardBillingCycleWindow` date clamping; (2) Multi-currency foreign spend normalization via FX table with net yield accounting, foreign transaction fee deduction (`fxFeeRate`, default 1.95%, 0% fee-free preset), and auto-matching of `overseas` rules; (3) Multi-promotion stacking (`isStackable`), combining additive promos with best standalone promos; (4) Miles/points reward unit conversions (`milesConversionRate`); (5) Upgraded `findBestCardForSpend` ranking by net yield and near-threshold unlock alerts (≤ HK$500); (6) Card & Promo editor enhancements with cycle chips, FX fee presets, and stackable toggles; (7) Glanceable cycle and stackable badges across `PaymentCardsScreen` and live net yield breakdown in `ExpenseEditScreen`; (8) 100% key parity across all 4 locales.
- Affected modules: Model (`creditCards.ts`, `normalizeReminder.ts`, `creditCardRebates.ts`, `creditCardRebates.test.ts`); View (`CreditCardEditScreen.tsx`, `PromoEditorModal.tsx`, `ExpenseEditScreen.tsx`, `PaymentCardsScreen.tsx`); i18n (`en.ts`, `zh-Hant.ts`, `zh-Hans.ts`, `ja.ts`); CHANGELOG
- Reason: Feature Enhancement & Domain Architecture — high-precision real-world credit card reward calculations, foreign fee deduction, and billing cycle alignment
- Impact: High

## 2026-09-09
- Date: 2026-09-09
- Description: **Credit Card Promotions: Lower & Upper Limits Configuration** — Enhanced bank promotion management and domain rebate calculations to fully configure and enforce both Lower Limits (minimum spend per transaction `minSpendPerTx`, minimum total accumulated spend `minTotalSpend`) and Upper Limits (maximum rebate cap `maxRebateCap`, maximum eligible spend cap `maxSpendCap`). Upgraded `PromoEditorModal` with category selection chips and dedicated structured sections for spend requirements and reward caps. Surfaced glanceable limit badges across `PaymentCardsScreen` and `CreditCardEditScreen` with full 4-locale i18n support.
- Affected modules: Model (`creditCards.ts`, `normalizeReminder.ts`, `creditCardRebates.ts`, `creditCardRebates.test.ts`); View (`PromoEditorModal.tsx`, `PaymentCardsScreen.tsx`, `CreditCardEditScreen.tsx`); i18n (`en.ts`, `zh-Hant.ts`, `zh-Hans.ts`, `ja.ts`); CHANGELOG
- Reason: Feature Enhancement — support real-world bank promotion spend requirements (lower limits) and reward/spend caps (upper limits)
- Impact: Medium

## 2026-09-09
- Date: 2026-09-09
- Description: **PaymentCardsScreen UI Polish: Eradicate Duplicate Action Buttons** — Eliminated duplicate stacked "Add promotion" clay buttons on the Promotions tab when no promotions are configured. The empty state `GlassSurface` now acts as a clean informative card (icon + description), while the primary action CTA remains unified at the bottom of the screen. Similarly cleaned up `EmptyState` on the "All Cards" tab to prevent duplicate "Add a card" buttons.
- Affected modules: View (`PaymentCardsScreen.tsx`); CHANGELOG
- Reason: UX/UI Bug Fix — remove redundant duplicate action buttons and align empty state layout
- Impact: Low

## 2026-09-09
- Date: 2026-09-09
- Description: **Add & Manage Card Promotions Directly from PaymentCardsScreen** — Promotions tab now supports 1-tap add/edit of bank promotions via shared `PromoEditorModal`, multi-card `CardPickerForPromoModal`, upgraded empty state, and mode-aware primary CTA (Add promotion vs Add a card).
- Affected modules: View (`PaymentCardsScreen.tsx`, `CreditCardEditScreen.tsx`, `PromoEditorModal.tsx`, `CardPickerForPromoModal.tsx`); i18n (`en.ts`, `zh-Hant.ts`, `zh-Hans.ts`, `ja.ts`); CHANGELOG
- Reason: UX/UI — allow 1-tap promotion addition and card selection from Promotions tab
- Impact: Medium

## 2026-09-09
- Date: 2026-09-09
- Description: **Fix Metro Bundler Warning for `@noble/hashes/crypto.js`** — Resolved Metro bundler warnings caused by `@noble/hashes` exporting only `"./crypto"` instead of `"./crypto.js"`. Added `scripts/patch-noble-hashes.js` automated via `npm run postinstall` to add `"./crypto.js"` to `package.json:exports` (matching `@noble/ciphers`), and added standard `metro.config.js` configuration in `privateLifeManagementApp`.
- Affected modules: Tooling & Scripts (`scripts/patch-noble-hashes.js`, `package.json`, `metro.config.js`); CHANGELOG
- Reason: Bug fix — eliminate noisy Metro bundler warnings and ensure smooth module resolution
- Impact: Low

## 2026-09-09
- Date: 2026-09-09
- Description: **MIT License & Open Source Attribution** — Replaced default Expo boilerplate license with formal MIT License attributing 2026 Halo Contributors; updated `package.json` with `"license": "MIT"` and added open-source MIT license badge and section to `README.md`.
- Affected modules: Legal & Metadata (`LICENSE`, `package.json`, `README.md`); CHANGELOG
- Reason: Open Source Preparation — establish clean MIT licensing for public/private GitHub repository
- Impact: Low

## 2026-09-09
- Date: 2026-09-09
- Description: **On-Device Receipt Photo OCR & Description Auto-Population** — Take photo (web camera `capture="environment"` + native ImagePicker) runs on-device OCR, parses receipt text into merchant/items/total, and fills expense note or journal body. Per-thumbnail “Scan to description”, expense “Scan receipt to note” quick action, and Compose/EntryDetail append scanned text into the entry body.
- Affected modules: Model (`receiptOcr.ts`, `receiptOcr.test.ts`, `ocrEngine.ts`, `ocrEngine.web.ts`, `ocrEngine.native.ts`); View (`PhotoAttachments.web.tsx`, `PhotoAttachments.native.tsx`, `ExpenseEditScreen.tsx`, `ComposeScreen.tsx`, `EntryDetailScreen.tsx`); i18n (`en.ts`, `zh-Hant.ts`, `zh-Hans.ts`, `ja.ts`)
- Reason: Feature — instant receipt digitization into expense note without cloud upload
- Impact: High

## 2026-09-09
- Date: 2026-09-09
- Description: **GitHub .gitignore Protection & Cleanup** — Configured comprehensive, multi-layer `.gitignore` rules across both `mobileApp/.gitignore` and repository root `.gitignore`. Protects secrets, credentials (`.jks`, `credentials.json`, `*.pem`, `*.key`, `*password*`), logs (`logs/`, `*.log.gz`), build targets (`dist/`, `target/`, `web-build/`, `ios/`, `android/`), environment configs (`.env*`), and OS/IDE metadata from being staged or committed to GitHub.
- Affected modules: Configuration (`.gitignore`, `mobileApp/.gitignore`); CHANGELOG
- Reason: Security & Cleanliness — prevent credential leaks, giant log blobs, and dependency uploads to GitHub
- Impact: Low

## 2026-09-09
- Date: 2026-09-09
- Description: **GitHub-Ready README & Documentation Overhaul** — Completely revamped `mobileApp/README.md` for GitHub release with architecture diagrams, platform badges, comprehensive feature highlights (credit card rewards engine, receipt OCR, compact spend keypad, split expense flow, biometric lock, encrypted backup), project structure directory tree, Node.js native automated test instructions, and a step-by-step GitHub repository upload guide.
- Affected modules: Documentation (`mobileApp/README.md`); CHANGELOG
- Reason: Documentation — prepare repository for GitHub publication with clear setup and push instructions
- Impact: Low

## 2026-09-09
- Date: 2026-09-09
- Description: **Backup wording & UX** — Replaced developer-centric Export/Import labels with user-facing Back Up Now / Restore from Backup across en, zh-Hant, zh-Hans, and ja; clarified password, verify, and restore copy; updated BackupPanel icons to cloud-upload / cloud-download / checkmark-circle.
- Affected modules: View (`BackupPanel.tsx`); i18n (`en.ts`, `zh-Hant.ts`, `zh-Hans.ts`, `ja.ts`); CHANGELOG
- Reason: UX — reduce confusion between encrypted backup and CSV spreadsheet export
- Impact: Low

## 2026-09-09
- Date: 2026-09-09
- Description: **Credit Card Edit Cashback & Caps UX/UI Polish** — Fixed visual defects on `CreditCardEditScreen` Tab 2:
  1. **Base rebate rate well**: Preset chips plus custom rate input with integrated `%` suffix badge (no detached bare `0.4`).
  2. **Currency-prefixed caps**: Monthly spend/rebate caps and min monthly spend use `[ HK$ ]` prefix badges and informative placeholders (`No limit` / `None`) instead of repeating the label.
  3. **Tappable rebate rules**: Title block opens `RuleEditorModal` (edit pencil); subtitles use `formatFriendlyMoney` (`Spend cap HK$10,000`); crowded `Remove rule` text replaced with circular `trash-outline` icon; modal title switches Add vs Edit.
  4. **Sticky Save clearance**: Opaque `colors.paper` footer with hairline top border; scroll `paddingBottom: insets.bottom + 140` so `CardSpendSimulator` clears the button.
  5. **i18n**: Added `editRebateRule`, `customRate`, `capPlaceholder`, `minSpendPlaceholder` across en / zh-Hant / zh-Hans / ja.
- Affected modules: View (`CreditCardEditScreen.tsx`); i18n (`en.ts`, `zh-Hant.ts`, `zh-Hans.ts`, `ja.ts`); CHANGELOG
- Reason: UX/UI — cashback tab readability, editability, and scroll clipping
- Impact: Medium

## 2026-09-09
- Date: 2026-09-09
- Description: **Automated Domain Unit Test Suite (Workstream A)** — Added Node.js/`tsx` test runner (`npm test`) with zero Jest/Babel config, covering pure Model engines and backup integrity:
  1. **Harness**: `tsx` + `@types/node` as devDependencies; `"test": "tsx --test src/**/*.test.ts"` using built-in `node:test` + `node:assert/strict`.
  2. **Domain engines**: Largest-remainder expense splits, credit-card rebate/cap/promo ranking, FX baseline + snapshot lock with card fee, monthly/weekday next-fire calendar math.
  3. **Backup security**: `settingsForBackup` secret stripping, HALO1 encrypt/decrypt round-trip, wrong-password `BackupError`, finance/reminder normalizer legacy fallbacks.
- Affected modules: `package.json`; Model tests (`ExpenseSplit.test.ts`, `creditCardRebates.test.ts`, `fx.test.ts`, `nextFire.test.ts`, `serializeBackup.test.ts`); CHANGELOG
- Reason: Technical — automated regression safety for money math and backup crypto without React Native mocks
- Impact: Medium

## 2026-09-09
- Date: 2026-09-09
- Description: **UX/UI Tactile & Card Glanceability Polish (Workstream B)** — Visual and haptic refinements for payment cards and money entry controls:
  1. **Payment card mini heroes**: Each card row (All Cards / By Bank) shows a ~56×36 brand-colored mini card with bank icon, tier abbreviation, and chip glyph; monthly cashback is a distinct sparkles highlight badge.
  2. **Warmer empty state**: Payment Cards empty view uses a soft `card-outline` watermark via optional `EmptyState.backdropIcon`.
  3. **Day stepper bounds**: `DayOfMonthStepper` fires `hapticLight` on successful ± and new `hapticBoundary` (warning notification) when already at day 1 or 31.
  4. **Keypad feel**: `AmountCalculatorField` number/math keys keep `hapticLight` and add raised→inset + slight scale depression on press.
- Affected modules: View (`PaymentCardsScreen.tsx`, `EmptyState.tsx`, `DayOfMonthStepper.tsx`, `AmountCalculatorField.tsx`); Utils (`haptics.ts`); `tsconfig.json` (exclude `**/*.test.ts` from app compile); CHANGELOG
- Reason: UX/UI — card health glanceability, empty-state warmth, and consistent tactile feedback
- Impact: Medium

## 2026-09-09
- Date: 2026-09-09
- Description: **Rebate Rule Reordering with Priority Precedence** — Category rebate rules on `CreditCardEditScreen` (Cashback & Caps tab) can be reordered with up/down controls so list order matches evaluation priority:
  1. **Priority explainer**: Subtitle under the rebate rules section title (`cardRewards.rulePriorityNote`) clarifies top-to-bottom matching.
  2. **Rank badge + reorder actions**: Each rule card shows `#N` priority, with `chevron-up` / `chevron-down` hit targets (disabled at list bounds) beside Delete; successful moves call `hapticLight()`.
  3. **Engine alignment**: Reordered `rebateRules` array is persisted and fed to `CardSpendSimulator` / `RuleEditorModal` unchanged; matches first-match precedence in the rebate engine.
  4. **i18n**: Added `moveRuleUp`, `moveRuleDown`, `rulePriorityNote`, and `rulePriority` across English, Traditional Chinese, Simplified Chinese, and Japanese with full key parity.
- Affected modules: View (`CreditCardEditScreen.tsx`); i18n (`en.ts`, `zh-Hant.ts`, `zh-Hans.ts`, `ja.ts`); CHANGELOG
- Reason: UX — let users set category rebate precedence when multiple rules could apply
- Impact: Medium

## 2026-09-09
- Date: 2026-09-09
- Description: **Credit Card Configuration UX/UI Enhancement** — Overhauled `CreditCardEditScreen` into a structured, 3-tab segmented interface (`Card & Billing`, `Cashback & Caps`, and `Promos & Alerts`), eliminating 1000-line scrolling fatigue and introducing interactive visual tools:
  1. **Segmented Tabs Architecture**: Segment chips under `ScreenHeader` with iconography (`card-outline`, `sparkles-outline`, `notifications-outline`) divide card configuration into cohesive, focused domains.
  2. **Paired Billing Cycle Widget (`CardBillingCycleCard`)**: Encapsulates Statement Day and Due Day with pure calendar-aware grace period math (`calculateGracePeriodDays`), visual month-line progress track with wrapped fill segments, and direct, tactile `DayOfMonthStepper` controls (1–31) that avoid web calendar date picker blocking.
  3. **Interactive Spend Rebate Simulator (`CardSpendSimulator`)**: Embedded in the Cashback & Caps tab with quick amount bump pills (`+100`, `+500`, `+1,000`, `+2,000`), custom amount well, category selectors (`Dining`, `Online`, `Groceries`, `Transport`, `Other`), and live real-time simulation output (`+HK$…` cash rebate, effective rate badge, rule breakdown explanation, and remaining monthly cap badge).
  4. **Sticky Bottom Primary Action Bar**: Positioned standard `<PrimaryButton>` sticky at the bottom across all tabs with safe-area insets clearance (`insets.bottom + 90`), allowing saving at any time without scrolling.
  5. **Complete i18n Localization**: Added 13 new keys (`tabCardBilling`, `tabCashbackCaps`, `tabPromosReminders`, `billingCycleTitle`, `gracePeriod`, `statementToDue`, `simulatorTitle`, `simulatorDesc`, `testAmount`, `testCategory`, `simulatedReturn`, `capStatusRemaining`, `capStatusExceeded`) across English, Traditional Chinese, Simplified Chinese, and Japanese with 100% key parity.
- Affected modules: View (`CreditCardEditScreen.tsx`, `CardBillingCycleCard.tsx`, `CardSpendSimulator.tsx`, `DayOfMonthStepper.tsx`, `DateField.web.tsx`); i18n (`en.ts`, `zh-Hant.ts`, `zh-Hans.ts`, `ja.ts`); CHANGELOG
- Reason: UX/UI Enhancement — streamline credit card setup, eliminate scrolling fatigue, pair billing cycle with grace period calculations, and provide real-time rebate simulation
- Impact: High

## 2026-09-09
- Date: 2026-09-09
- Description: **Credit Card Feature with Bank Grouping, Rebates Engine & Smart Spend Recommendations** — Comprehensive on-device credit card reward and bank promotion intelligence system:
  1. **Model Layer**: Extended `CreditCardAccount` with issuing bank id/name, card tier, reward types (`cashback`, `miles`, `points`), base rebate rate, category rebate rules (`CardRebateRule` with category, rate %, single-tx minimum, monthly spend cap, and monthly rebate cap), overall spend/rebate caps, and bank campaigns (`CardBankPromotion` with registration toggles and countdowns). Built pure domain rebate engine in `creditCardRebates.ts` featuring `BUILTIN_BANKS` catalog, real-world `POPULAR_CARD_PRESETS` (HSBC Red, HSBC Visa Signature, SCB Simply Cash, Hang Seng MMPOWER, DBS Eminent, Citi Cash Back, BOC Chill, etc.), `calculateTransactionRebate` with cap splitting (bonus tier vs base tier fallback), `calculateCardMonthlyRebateSummary`, and `findBestCardForSpend`.
  2. **Controller Layer**: Extended `ReminderController` and `ReminderProvider` to persist card reward rules, overall limits, and manage promotions (`toggleCardPromotionRegistration`, `upsertCardPromotion`, `deleteCardPromotion`).
  3. **Payment Cards Screen**: Redesigned with segment view filter (`All Cards`, `By Bank`, `Promotions`). Under `By Bank`, cards are grouped by issuing institution with brand badges, card counts, and aggregate monthly cashback. Card items display bank/tier, base rate badges, top category chips (e.g. `Dining 5%`, `Online 4%`), and a monthly cap consumption progress bar. Under `Promotions`, bank campaigns show countdowns and 1-tap registration toggles.
  4. **Card Editor Screen**: Added 1-tap popular card preset picker (`CardPresetModal`), interactive bank selector chips, card tier and base rate inputs, dynamic category rebate rules builder, and promotion manager. Replaced web-incompatible date picker with tactile `DayOfMonthStepper` (− / + steppers and numeric well) allowing easy, direct editing of recurring monthly statement and due civil days (1–31).
  5. **Spend Flow & Money Screen Integration**: Real-time optimal card recommendation pill (e.g. `✨ Best: HSBC Red (+HK$20.00 · 4%)`) on `ExpenseEditScreen` with 1-tap card assignment, plus live rebate preview pill (showing calculated earnings, category rate, and remaining monthly cap). Added monthly total card cashback summary banner on `MoneyScreen`. Full i18n support across English, Traditional Chinese, Simplified Chinese, and Japanese.
- Affected modules: Model (`creditCards.ts`, `normalizeReminder.ts`, `creditCardRebates.ts`); Controller (`ReminderController.ts`, `ReminderProvider.tsx`); View (`PaymentCardsScreen.tsx`, `CreditCardEditScreen.tsx`, `CardPresetModal.tsx`, `DayOfMonthStepper.tsx`, `DateField.web.tsx`, `ExpenseEditScreen.tsx`, `MoneyScreen.tsx`); i18n (`en.ts`, `zh-Hant.ts`, `zh-Hans.ts`, `ja.ts`); CHANGELOG
- Reason: Business & UX feature addition — on-device credit card reward optimization, bank grouping, and frictionless spend logging recommendations
- Impact: High

## 2026-09-09
- Date: 2026-09-09
- Description: **App-Wide i18n Localization & Hardcoded String Eradication** — Systematically audited and eliminated hardcoded English strings across all screens and components. Expanded i18n catalogs across English, Traditional Chinese, Simplified Chinese, and Japanese with 100% key and structure parity (`TranslationCatalog = DeepString<typeof en>`). Connected `MoneyScreen.tsx` (focus chips, net balance summary, income/spends/budgets/bills section headers, time/category filters, a11y labels, budget form, fee badges), `IncomeEditScreen.tsx` (title, save/saving labels, kind, date, note placeholder), `InsightsScreen.tsx` (lede, net picture, words kept, days this week, life areas, mood climate), `MoodTrendCharts.tsx` (chart titles, time periods, empty history, climate legend labels), `EntryCard.tsx` (localized mood and voice badges), `EntryDetailScreen.tsx` (missing page fallback, delete confirmation modal/alert, recording replacement headers), `ReminderEditScreen.tsx` (kind, importance, priority levels, group label), `LocationField` native & web (permission alerts, place labels, search states, placeholders), `VoiceCapture` & `VoicePlayer` native & web (microphone alerts, recording actions, accessibility tags, web browser notices), `CardHealthList.tsx` (localized status tags and empty card state), `CreditCardEditScreen.tsx` (statement/due/extra ping labels, day field), and `ExpenseSplitScreen.tsx` (localized participant names).
- Affected modules: View (`MoneyScreen.tsx`, `IncomeEditScreen.tsx`, `InsightsScreen.tsx`, `MoodTrendCharts.tsx`, `EntryCard.tsx`, `EntryDetailScreen.tsx`, `ReminderEditScreen.tsx`, `LocationField.native.tsx`, `LocationField.web.tsx`, `VoiceCapture.native.tsx`, `VoiceCapture.web.tsx`, `VoicePlayer.native.tsx`, `VoicePlayer.web.tsx`, `CardHealthList.tsx`, `CreditCardEditScreen.tsx`, `ExpenseSplitScreen.tsx`); i18n (`en.ts`, `zh-Hant.ts`, `zh-Hans.ts`, `ja.ts`); CHANGELOG
- Reason: Technical / UX Polish — complete multi-language localization consistency without hardcoded English leakage
- Impact: high

## 2026-09-09
- Date: 2026-09-09
- Description: **App-wide i18n catalog expansion (Phase 1)** — Added missing localization keys across `money`, `you`, `pages`, `reminder`, `mood`, and `split`, plus new top-level `voice` and `location` sections, with full parity in English, Traditional Chinese, Simplified Chinese, and Japanese so `TranslationCatalog` type-checks cleanly.
- Affected modules: i18n (`en.ts`, `zh-Hant.ts`, `zh-Hans.ts`, `ja.ts`); CHANGELOG
- Reason: Technical — unblock screen/component localization of remaining hardcoded English UI strings
- Impact: medium

## 2026-09-09
- Date: 2026-09-09
- Description: **App-Wide Title, Header & Friendly Button Polish** — Standardized `<ScreenHeader>` navigation headers across `EntryDetailScreen`, `TrashScreen`, `PhotoMemoriesScreen`, `PrivacyScreen`, and `ReminderEditScreen`. Tactile month navigation icon buttons (`chevron-back` / `chevron-forward`) and iconified `ViewsSwitcher` chips in `CalendarScreen`. Filter chip icon enrichment in `JournalScreen` (`all`, `pages`, `reminders`, `money`) and `MoneyScreen` (`all`, `income`, `expenses`, `transfers`, `budgets`, `cards`). Added leading glyph support to `GroupedSection` in `GroupedList.tsx` and applied section icons across `SettingsScreen`, `CustomizePanel`, `LockSettingsPanel`, and `BackupPanel`. Added icons to theme selector chips (`System`, `Midnight`, `Paper`). Replaced raw text links in `ExpenseEditScreen` and `ExpenseSplitScreen` with tactile `SectionActionButton` components for expanding details and deleting records. 100% MVC compliant (View layer only), Dynamic Type scalable with `useTypography`, and accessibility compliant.
- Affected modules: View (`GroupedList.tsx`, `EntryDetailScreen.tsx`, `TrashScreen.tsx`, `PhotoMemoriesScreen.tsx`, `PrivacyScreen.tsx`, `ReminderEditScreen.tsx`, `CalendarScreen.tsx`, `JournalScreen.tsx`, `MoneyScreen.tsx`, `SettingsScreen.tsx`, `CustomizePanel.tsx`, `LockSettingsPanel.tsx`, `BackupPanel.tsx`, `ExpenseEditScreen.tsx`, `ExpenseSplitScreen.tsx`); CHANGELOG
- Reason: UX/UI polish — consistent navigation chrome, tactile icon buttons, and friendly section/filter glyphs app-wide
- Impact: medium

## 2026-09-09
- Date: 2026-09-09
- Description: **Split Expense flow (View + entry points)** — Built `ExpenseSplitScreen` on `FormCardGroup` / `FormCard` (expense hero with equal/custom mode chips, participants & allocation with cent-safe equal math and custom balance alerts, settlement tracker with Paid back / Pending toggles, sticky Save, optional Remove split). Registered modal route `expense/split/[id]`. Linked from Expense edit Card 3 via people chip (`Split this spend` or status chip). Money spend rows show a subtle pending-split badge (`split.splitBadge`) when collections remain. Domain math stays in `ExpenseSplit` helpers; View only orchestrates UI state through FinanceProvider.
- Affected modules: View (`ExpenseSplitScreen.tsx`, `ExpenseEditScreen.tsx`, `MoneyScreen.tsx`, `app/expense/split/[id].tsx`, `app/_layout.tsx`); CHANGELOG
- Reason: Business — on-device split of spends among friends/family with settlement tracking
- Impact: high

## 2026-09-09
- Date: 2026-09-09
- Description: **Split Expense i18n keys** — Added top-level `split` localization block (title, modes, participants, settlement status, remaining/over-allocated, summary, save/delete confirm, badge) across English, Traditional Chinese, Simplified Chinese, and Japanese.
- Affected modules: i18n (`en.ts`, `zh-Hant.ts`, `zh-Hans.ts`, `ja.ts`); CHANGELOG
- Reason: Technical — enable Split Expense UI strings for all supported locales
- Impact: low

## 2026-09-09
- Date: 2026-09-09
- Description: **Account Transfer Flow & FormCardGroup Refactor** — Extracted reusable `FormCardGroup` and `FormCard` components encapsulating modal sheet chrome, safe-area keyboard avoidance, dismiss-on-drag scroll, and sticky bottom primary action button. Refactored `ExpenseEditScreen` and `IncomeEditScreen` to adopt `FormCardGroup` for 100% DRY MVC compliance. Created `Transfer` model (`TransferEntry`, `TransferDraft`, `isTransferDraftValid`), added `normalizeTransfer` in `normalizeFinance.ts`, and implemented atomic balance adjustments in `FinanceController.transferFunds` and `FinanceProvider`. Built `TransferScreen` (`/transfer/new`) with 3-card structure (Route selection between accounts or credit card repayment, Amount Hero with tap-to-open keypad and source balance preview, and Details with Date, optional Fee, and Note). Added 1-tap Transfer quick action chip and dedicated Transfers section under Money extra tools in `MoneyScreen`. Full i18n support across English, Traditional Chinese, Simplified Chinese, and Japanese.
- Affected modules: Model (`Transfer.ts`, `Account.ts`, `normalizeFinance.ts`); Controller (`FinanceController.ts`, `FinanceProvider.tsx`); View (`FormCardGroup.tsx`, `ExpenseEditScreen.tsx`, `IncomeEditScreen.tsx`, `TransferScreen.tsx`, `MoneyScreen.tsx`, `app/transfer/new.tsx`, `app/_layout.tsx`); i18n (`en.ts`, `zh-Hant.ts`, `zh-Hans.ts`, `ja.ts`); CHANGELOG
- Reason: Business & UX feature addition — frictionless inter-account fund transfers and card repayments with reusable standard form layout
- Impact: High

## 2026-09-09
- Date: 2026-09-09
- Description: **Right-side empty space fix & balanced Card 1** — Hidden desktop browser white scrollbar track by defaulting `showsVerticalScrollIndicator={false}` in `KeyboardDismissScrollView` and injecting dark translucent scrollbar styles in `_layout.tsx` for web. Right-aligned amount and math preview digits in `AmountCalculatorField` to establish standard banking balance against top-left currency and top-right edit badges. Expanded quick amount bumps to 4 values (`+10`, `+50`, `+100`, `+500`) formatted as `flex: 1` proportional pills spanning 100% card width.
- Affected modules: View (`KeyboardDismissScrollView.tsx`, `_layout.tsx`, `AmountCalculatorField.tsx`, `ExpenseEditScreen.tsx`); CHANGELOG
- Reason: UX/UI polish — eliminate white scrollbar rail on web and eliminate right-side void in Card 1
- Impact: medium

## 2026-09-09
- Date: 2026-09-09
- Description: **Compact category grid + sticky clearance** — Expense categories use a compact 2-row (4×2) icon+label grid that auto-collapses the keypad on selection; smart hint / “same as last” stay compact; Expense and Income scroll views use `paddingBottom: Math.max(insets.bottom, 16) + 90` so content never sits under the sticky Keep bar.
- Affected modules: View (`ExpenseEditScreen.tsx`, `IncomeEditScreen.tsx`); CHANGELOG
- Reason: UX — stop categories/details from being clipped behind the sticky CTA; keep focus on the form after category pick
- Impact: medium

## 2026-09-09
- Date: 2026-09-09
- Description: **Tap-to-open keypad** — `AmountCalculatorField` now starts with the numeric keypad collapsed by default. The amount well is a full tap target with currency badge, crisp amount, preview, and an edit/Done pill (`spend.tapToEdit` / `spend.done`). Expanded pad uses compact ~34–38pt keys, a toolbar Done bar to dismiss, and a compact `±×÷` chip (no full-width math row). Clear `(x)` stays independent of expand/collapse. Localized `en` / `zh-Hant` / `zh-Hans` / `ja`.
- Affected modules: View (`AmountCalculatorField.tsx`); i18n (`en`, `zh-Hant`, `zh-Hans`, `ja`); CHANGELOG
- Reason: UX — reclaim Card 1 vertical space so categories and details stay glanceable without scrolling past a permanently expanded calculator
- Impact: medium

## 2026-09-09
- Date: 2026-09-09
- Description: Compact spend calculator and page UX/UI redesign. Replaced 5-row calculator pad with a compact 3x4 numeric keypad (~175pt tall), horizontal currency capsule (`HKD | USD | CNY`), 1-tap collapsible math operator strip (`±×÷`), and keypad collapse toggle. Restructured `ExpenseEditScreen` and `IncomeEditScreen` into 3 grouped neumorphic inset cards with a sticky bottom Keep CTA. Aligned `QuickSpendSheet` keypad and spacing.
- Affected modules: View (`AmountCalculatorField.tsx`, `ExpenseEditScreen.tsx`, `IncomeEditScreen.tsx`, `QuickSpendSheet.tsx`, `i18n/en.ts`, `zh-Hant.ts`, `zh-Hans.ts`, `ja.ts`).
- Reason: Technical & UX overhaul to eliminate half-screen calculator bloat and multi-page scrolling, enabling fast, glanceable spend and income logging.
- Impact: High

## 2026-09-09
- Date: 2026-09-09
- Description: **Quick Spend Enhancement** — cutting-edge, ultra-fast expense logging. **Quick Spend Sheet** (`QuickSpendSheet`): bottom-sheet modal opened from the Home FAB or Money, with five 1-tap sections — Smart Suggestion (category + amount + card from `suggestQuickAdd` Smart Defaults), Recent Spends (horizontal history chips), One-Tap Templates (Morning Coffee / Lunch / MTR grid), Voice Quick Add (OS keyboard dictation into a field, parsed live on-device by `parseVoiceSpend` across en / zh-Hant / zh-Hans / ja), and an Amount-First Keypad (minimal digit pad reusing Model `applyCalcKey`). **Inline Home Quick Add** (`InlineHomeQuickAdd`): compact quick-add bar on Today Home — amount input with currency badge, category chips, 1-tap templates, and a voice toggle. **ExpenseEditScreen** gains a Quick Spend mode (`?mode=quick`) that pre-fills Smart Defaults and offers one-tap templates. All logging converges on Controller `createQuickExpense` / `createVoiceExpense` so FX locking and validation stay in one place; every control is fully accessible (ARIA roles/labels) and scales via `useTypography()`. Localized `en` / `zh-Hant` / `zh-Hans` / `ja`.
- Affected modules: Model (`quickAdd`, `voiceSpendParser`); Controller (`FinanceController`, `FinanceProvider`); View (`QuickSpendSheet`, `InlineHomeQuickAdd`, `HomeScreen`, `MoneyScreen`, `ExpenseEditScreen`); i18n (`en`, `zh-Hant`, `zh-Hans`, `ja`); FUNCTIONAL_SPEC; CHANGELOG
- Reason: User accessibility and rapid expense logging
- Impact: High (system-wide UX enhancement)

## 2026-09-09
- Date: 2026-09-09
- Description: **Log a spend UX/UI polish** — Dynamic typography (`useTypography`) on `ExpenseEditScreen` + `AmountCalculatorField` (amount well, keypad, currency chips, section labels, note, save CTA) without clipping calculator keys. Clear key uses compact “C” with full a11y label; armed operators glow accent; currency chip selected state uses accent border/glow + badge in the amount well. Foreign spends show HKD estimate in an inset neumorph well. Category / Paid with / Account section labels; Paid with chips gain cash/card leading icons; KeyboardAvoidingView + keyboard insets keep note + Keep CTA reachable; PrimaryButton `busy` spinner while saving; save stays disabled for zero/incomplete amounts. Localized `en` / `zh-Hant` / `zh-Hans` / `ja`.
- Affected modules: View (`ExpenseEditScreen`, `AmountCalculatorField`, `Chip`, `PrimaryButton`, `SpendCardBadge`); i18n (`en`, `zh-Hant`, `zh-Hans`, `ja`); CHANGELOG
- Reason: product — iOS ergonomics, visual hierarchy, and Appearance text-size support on the primary spend capture flow
- Impact: medium

## 2026-09-09
- Date: 2026-09-09
- Description: **Font Size Adjustment** — User-controlled font size across the entire app with 5 presets (**System**, **Small**, **Default**, **Large**, **Extra Large**) and an interactive live preview card in Settings → Appearance. Preference persists on `AppSettings.fontSizePreference`; `resolveFontScale` + `TypographyProvider` / `createTypography` scale HIG type roles app-wide; foundational chrome (`LargeTitle`, `ScreenHeader`, `GroupedList`, `Chip`) consumes `useTypography`. Localized `en` / `zh-Hant` / `zh-Hans` / `ja`.
- Affected modules: Model (`AppSettings`); Controller (`SettingsController`, `SettingsProvider`); View (`TypographyProvider`, `typography`, `TextSizeSelector`, `LargeTitle`, `ScreenHeader`, `GroupedList`, `Chip`, `SettingsScreen`, `app/_layout`); i18n (`en`, `zh-Hant`, `zh-Hans`, `ja`); FUNCTIONAL_SPEC; CHANGELOG
- Reason: User accessibility and readability preference
- Impact: High (system-wide typography enhancement)

## 2026-09-08
- Date: 2026-09-08
- Description: **UX fast-loop UI & Calendar polish** — WCAG AA faint contrast + glass hairlines + crisp active chip borders; Home compact Write/Record/Spend capsule, `TodayRecurringStrip` (1-tap spend/reminder), `QuickMoodBar` (inline 5-slot mood), Next Up circular complete; Expense amount +10/+50/+100 and Daily/Weekdays/Weekly/Monthly repeat; Reminders completion checkboxes + collapsed Completed; Money due chips 1-tap `logRecurringSpendInstant`; Calendar screen streamlined to clean 2-way Monthly Agenda and Timeline switcher with full day log inspection. Localized en / zh-Hant / zh-Hans / ja.
- Affected modules: View (`tokens`, `Chip`, `GroupedList`, `TodayRecurringStrip`, `QuickMoodBar`, `HomeScreen`, `ExpenseEditScreen`, `RemindersScreen`, `MoneyScreen`, `CalendarScreen`); Model (`ExpenseDraft` frequency fields); i18n; FUNCTIONAL_SPEC; CHANGELOG
- Reason: product — eliminate daily data-entry friction and close habit/spend loops from Today
- Impact: high

## 2026-09-08
- Date: 2026-09-08
- Description: **Recurring loop model & quick-action controllers** — expanded `RecurringSpend` with daily/weekday/weekly/monthly frequency, `buildExpenseDraftFromRecurring`, and due-today helpers; added reminder completion tracking (`lastCompletedAt` / `completedDayKeys`) with `isReminderCompletedToday`, next-fire skip when completed today, and Next Up actionable ids; journal draft savable-content helper for empty-body mood check-ins; wired `logRecurringSpendInstant` / `createRecurringSpend` / `completeReminder` / `uncompleteReminder` through Finance and Reminder providers.
- Affected modules: Model (`recurringSpend`, `Reminder`, `nextFire`, `nextUp`, `JournalEntry`, `normalizeFinance`, `normalizeReminder`); Controller (`FinanceController`, `FinanceProvider`, `ReminderController`, `ReminderProvider`)
- Reason: technical — foundation for Today 1-tap spend log and reminder completion loop
- Impact: medium

## 2026-09-08
- Date: 2026-09-08
- Description: **Credit card input bug fix & UI upgrade** — fixed card name input being un-typeable / blurred on click caused by `KeyboardDismissScrollView` wrapping content in a `Pressable onPress={Keyboard.dismiss}` (in React Native Web, clicking any input bubbled to the parent Pressable which immediately called `Keyboard.dismiss()` and blurred the active element). Disabled web wrapper and used `TouchableWithoutFeedback` on native. Redesigned `CreditCardEditScreen` with standard `ScreenHeader`, neumorphic `insetSurface` input box with `minHeight: 52`, `autoFocus` for new cards, danger trash action on edits, and full multi-language translations (`en`, `zh-Hant`, `zh-Hans`, `ja`).
- Affected modules: View (`CreditCardEditScreen`, `KeyboardDismissScrollView`); i18n (`en`, `zh-Hant`, `zh-Hans`, `ja`)
- Reason: bug fix — user reported "cannot input the card name" in card edit screen
- Impact: high

## 2026-09-08
- Date: 2026-09-08
- Description: **Payment cards screen bug fix & UI alignment** — eliminated duplicate “Add a card” primary button on empty state by rendering bottom CTA conditionally when cards exist (EmptyState already provides the action button). Aligned header navigation with Reminder types and Expense categories by adopting `ScreenHeader` and standard `subhead` lede typography.
- Affected modules: View (`PaymentCardsScreen`)
- Reason: bug fix / UX polish — screenshot reported duplicate "Add a card" button and unaligned header
- Impact: low

## 2026-09-08
- Date: 2026-09-08
- Description: **You → Settings** tab rename and UI overhaul — tab label/icon (`settings-outline`), LargeTitle “Settings”, privacy kicker kept. Removed redundant “This week” text dump (already on Today). iOS inset-grouped layout: profile avatar card, Appearance & language, Preferences, Manage (expense categories / reminder types / payment cards), Money prefs, App lock, Backup, Privacy + version footnote. Localized `en` / `zh-Hant` / `zh-Hans` / `ja`.
- Affected modules: View (`SettingsScreen`, `FloatingTabBar`, tabs `_layout`, Customize/Language/Lock/Backup panels); i18n; CHANGELOG
- Reason: product — Settings page should feel clean and professional, not a second Home summary
- Impact: medium

## 2026-09-08
- Date: 2026-09-08
- Description: **Paid with** card on spends — Log a spend / edit can assign an optional `cardId` to a configured credit card (chips: Cash / Other + card names). Money spend rows show a quiet `card-outline` + name badge when charged to a card. You → Money → **Payment cards** lists/adds/edits the same `CreditCardAccount` rows used by Card Health (`/reminders/card/:id`). Personal tracker only — not double-entry or bank sync. Localized (`en` / `zh-Hant` / `zh-Hans` / `ja`).
- Affected modules: Model (`Expense`, `normalizeFinance`, `recentSpends`); Controller (`FinanceController`); View (`ExpenseEditScreen`, `MoneyScreen`, `SettingsScreen`, `PaymentCardsScreen`, `SpendCardBadge`); i18n; route `payment-cards`
- Reason: product — “the spend is allow to charge by which card. and the card is configable by the setting page”
- Impact: medium

## 2026-09-08
- Date: 2026-09-08
- Description: Reminder types / Expense categories settings UI polish — fixed floating centered Back chevron (`BackButton` `alignSelf: flex-start` + shared `ScreenHeader`); removed noisy “Built-in · showing” row subtitles (customs show “Custom” only); full-width primary Add + centered muted Reset with `refresh-outline`; GroupedRow min height ≥52pt with consistent hairlines. Both config screens share the same chrome.
- Affected modules: View (`ReminderTypesScreen`, `ExpenseCategoriesScreen`, `BackButton`, `GroupedList`); i18n (en / zh-Hant / zh-Hans / ja)
- Reason: product — screenshot UX cleanup (header alignment, row noise, awkward bottom chips)
- Impact: low

## 2026-09-08
- Date: 2026-09-08
- Description: Configurable expense categories — You → Money → **Expense categories** lets her add (name + Ionicons), soft-hide/delete, reorder, and restore defaults. Catalog persists on `AppSettings.expenseCategories` (AsyncStorage). Defaults now include shopping + entertainment alongside dining, groceries, transport, bills, health, other. Log a spend and Money quick-add/filter/budget chips use active categories; custom names show as typed; builtins stay i18n (`en` / `zh-Hant` / `zh-Hans` / `ja`). Soft-hide keeps old spends safe.
- Affected modules: Model (`expenseCategories`, `Expense`, `AppSettings`, `normalizeFinance`, `quickAdd`, `monthInsights`); Controller (`SettingsController`, `SettingsProvider`); View (`ExpenseCategoriesScreen`, `SettingsScreen`, `ExpenseEditScreen`, `MoneyScreen`, `typeIcons`, `TypeIcon`); i18n; route `expense-categories`
- Reason: product — “money expense type is allow to config by setting”
- Impact: medium

## 2026-09-08
- Date: 2026-09-08
- Description: Today Home visual upgrade — **This week** slash scan line replaced by a 2×2 neumorphic metric chip grid (pages / mood / spend / reminders); **Next up** uses a localized due badge (Today / Tomorrow / In N days / date) with contextual icon; warm **photo highlight** card when a journal page has a photo (On this day → this week → last 14 days), tap opens the entry. Quiet week still shows the gentle cue under the chips; no photo keeps the quiet reflection cue only.
- Affected modules: Model (`homePhotoHighlight`, `nextUp.days`); View (`HomeScreen`, `WeekStatChips`, `localizeWeeklyChips`, `localizeNextUpBadge`); i18n (en / zh-Hant / zh-Hans / ja)
- Reason: product — tactile week stats, clearer due status, and a memory impression without cluttering a quiet Home
- Impact: medium

## 2026-09-08
- Date: 2026-09-08
- Description: Configurable **reminder types** — You → More → Reminder types. Built-in tops (Financial / Health / Household / Family / Vehicle / Work / Personal / Other) can be toggled; add custom types with a name + Ionicons palette; delete customs. Stored on `AppSettings.reminderTypes` (AsyncStorage). Reminder list filter chips and compose Group picker use active types only; deleted/hidden ids keep existing reminders readable (fallback label/icon). Localized defaults (`en` / `zh-Hant` / `zh-Hans` / `ja`); custom names display as entered. Included in backup settings allow-list.
- Affected modules: Model (`reminderTypes.ts`, `categories.ts`, `AppSettings`, backup serialize); Controller (`SettingsController` / `SettingsProvider`); View (`ReminderTypesScreen`, Settings / Reminders / ReminderEdit, `typeIcons`, `TypeIcon`); i18n; route `app/reminder-types.tsx`
- Reason: product — user asked to configure reminder types/categories in settings
- Impact: medium

## 2026-09-08
- Date: 2026-09-08
- Description: Money extras — removed **What I have** and **What I owe** focus chips and list/add sections. Focus stays All / Income / Spends / Budgets / Bills & cards. Assets and loans still feed net-worth (`computeNetWorth`) and extra-tools visibility; no asset/loan entry UI on Money. Section header actions remain neumorph `SectionActionButton` chips.
- Affected modules: View (`MoneyScreen`)
- Reason: product — girlfriend-simple Money; user asked to remove What I have and What I owe
- Impact: low

## 2026-09-08
- Date: 2026-09-08
- Description: Money extras — removed the **What I owe** focus chip and loans list/add section. Loan data still feeds net-worth (`computeNetWorth`) and “extra tools” visibility; no new loan entry UI on Money.
- Affected modules: View (`MoneyScreen`)
- Reason: product — user asked to remove What I owe from Money
- Impact: low

## 2026-09-08
- Date: 2026-09-08
- Description: Money / Calendar / reminder section actions — raw peach text links (**Add a card**, **Remind me**, Income/Spends Add, Save budget, All reminders, More money tools, Open all reminders, Add another reminder, Edit card, Log spend, More options) are neumorph chips via shared `SectionActionButton` (icon + label, ≥44pt, `accessibilityRole="button"`). Card Health empty copy is quiet (“No cards yet.”) now that the header owns Add.
- Affected modules: View (`SectionActionButton`, `MoneyScreen`, `CardHealthList`, `CalendarScreen`, `CreditCardEditScreen`, `ReminderEditScreen`)
- Reason: product — tactile clay chrome matching Home / Calendar; plain text links felt flat and hard to tap
- Impact: low

## 2026-09-08
- Date: 2026-09-08
- Description: P0 security hardening (fail-closed lock, allowBackup: false, redacted notifications) + P1 polish (i18n completion, keyboard dismiss, haptic parity)
- Affected modules: Controller (`LockSessionProvider`, `ReminderController` / `ReminderProvider`), View (compose/mood/spend/week i18n, `KeyboardDismissScrollView`, `BackButton`/`Chip` haptics, photo thumbs), Config (`app.json`), i18n (en / zh-Hant / zh-Hans / ja)
- Reason: Store-ready quality, privacy, and UX refinement
- Impact: High

## 2026-09-08
- Date: 2026-09-08
- Description: Header **Back** and **Keep** are icon-only (Ionicons `chevron-back` / `checkmark`, ≥44pt, a11y labels). Bottom Keep/Save CTAs and related primaries get leading icons (`checkmark-circle-outline`, etc.). Markdown list tool, photo/voice actions, Reminders Add, and empty-state CTAs follow the same SF icon language. Cancel / danger text links stay text.
- Affected modules: View (`BackButton`, `HeaderIconButton`, `ScreenHeader`, `PrimaryButton`, `EmptyState`, `MarkdownEditor`, PhotoAttachments, VoiceCapture; compose / spend / income / reminder / card / entry / backup / onboarding / lock screens)
- Reason: product — cleaner iPhone-like chrome; text Back/Keep cluttered headers
- Impact: low

## 2026-09-08
- Date: 2026-09-08
- Description: Bug fix — spend/income keypad **currency chips now convert the amount** even when FX cache/network is empty. Root cause: `convertAmount` returned undefined when `fxTable` was null (common on HKD-default compose before first refresh), so the chip switched currency but left digits unchanged (e.g. 100 HKD → 100 USD). Added baseline USD triangulation (`1 USD ≈ 7.8 HKD / 7.2 CNY`), `resolveFxTable`, Provider seed + mount prefetch, and always `onChange` the converted expression. Foreign save still locks `homeAmount` / `quoteCurrency: HKD` / `fxRate` / `cardFeeRate` / `convertedAt` (baseline if live rates missing).
- Affected modules: Model (`fx.BASELINE_FX_TABLE` / `resolveFxTable` / `convertAmount` / `convertAmountExpression` / `buildExpenseFxSnapshot`); Controller (`FxRateProvider`); View (`AmountCalculatorField`, Log a spend, income)
- Reason: bug fix — “the amount did not converted” when switching HKD|USD|CNY
- Impact: medium

## 2026-09-08
- Date: 2026-09-08
- Description: Calendar empty day — Write / Add a reminder / Add a spend are neumorph icon chips (`create-outline`, `notifications-outline`, `wallet-outline`) instead of raw text links. Day-header add is a 44pt icon button so the date no longer clips beside “Write”.
- Affected modules: View (`CalendarScreen`)
- Reason: product — match Halo SF Ionicons / clay chips; fix clipped header link
- Impact: low

## 2026-09-08
- Date: 2026-09-08
- Description: Log a spend / income amount **auto-converts** when she taps another **HKD | USD | CNY** chip. Active expression evaluates first (e.g. `10+5` → `15`), then mid-market FX converts into the new currency (≤2 dp, no trailing zeros). Empty/`0` stay empty/`0`. Missing rates keep the evaluated digits and still switch the chip (no crash). Live HKD estimate line follows the new amount. Card fee stays on the estimate only — keypad face amount is mid-market.
- Affected modules: Model (`fx.convertAmountExpression`); View (`AmountCalculatorField`, Log a spend, income)
- Reason: product — switching currency without retyping feels more natural
- Impact: low

## 2026-09-08
- Date: 2026-09-08
- Description: Log a spend amount is a **calculator** (custom keypad, caret-free well, no OS keyboard) with **HKD | USD | CNY** on the amount row. New spends default **HKD** (You → Money currency stays home totals only). Save stores the **evaluated number** (e.g. 12+3.5 → 15.5) then live FX / locked homeAmount as before. Two decimals max; trailing operators not savable. Same keypad on income. Not on Customize; no EUR/GBP.
- Affected modules: Model (`amountCalculator`); View (`AmountCalculatorField`, Log a spend, income); i18n (Clear / Backspace / Equals); docs (`FUNCTIONAL_SPEC.md`)
- Reason: product — girlfriend-simple shop math on the spend, transaction currency separate from home totals
- Impact: medium

## 2026-09-08
- Date: 2026-09-08
- Description: UI: types as icons. Reminder templates, category/kind/type chips, expense categories, and Money account kinds (cash/bank/investment/property, mortgage/personal/car, salary/bonus) use SF-like Ionicons instead of text chips. Calendar reminder filters are icon-only 44pt so Vehicle no longer clips; spend rows show a type icon beside the amount (FX copy unchanged). Screen readers still hear Car / 按揭 via `t('types.*')`.
- Affected modules: View (`Chip`, `TypeIcon`, `typeIcons.ts`, Reminders/Calendar/Money/spend/income/Pages, i18n `types`); docs (`FUNCTIONAL_SPEC.md`)
- Reason: product — type chips such as Car and Mortgage were clipping (Vehicle) and read as labels; icons match iPhone chrome
- Impact: medium

## 2026-09-08
- Date: 2026-09-08
- Description: Expense FX conversion is **per transaction at save**. Log a spend still live-converts (`US$12 ≈ HK$95.90 incl. card 1.5%`). On save, the fee-inclusive HKD (`homeAmount`), mid `fxRate`, `cardFeeRate`, and `convertedAt` are stored on that expense. Money, Calendar, Spent this month, and Insights use the locked number — opening Money later does not re-quote. Same-currency HKD has no snapshot. Legacy foreign spends convert once on read, then persist.
- Affected modules: Model (`Expense` snapshot fields, `fx.buildExpenseFxSnapshot` / `spendAmountIn` / `formatExpenseSpendLine`, financeStats, monthInsights, todayGlance, weeklySummary, `normalizeFinance`); Controller (`FinanceController` save + backfill, `FinanceProvider`, `FxRateProvider.refreshRates` returns table); View (Log a spend compose refresh, Money/Calendar/Today drop live convert); docs (`FUNCTIONAL_SPEC.md`, `README.md`)
- Reason: product — “what it cost me” must stay still after save; each row shows its own original + locked HKD
- Impact: medium

## 2026-09-08
- Date: 2026-09-08
- Description: Photos (You → More → Photos) is a private **reel** of her journal photos — full-screen vertical snap, large tap to next/previous, Reduce Motion crossfade, caption = page date + mood. Empty state is one sentence + Write today. Not Instagram/TikTok: no share, follow, comments, or cloud. Photos-only (no new video product).
- Affected modules: Model (`photoMemories` mood/caption fields, `clampPhotoIndex` / `stepPhotoIndex`; `formatMemoryDate`); View (`PhotoMemoriesScreen`, `PhotoReelViewer`, `JournalMediaImage` contain); i18n (en / zh-Hant / ja / zh-Hans photos + mood); docs (`FUNCTIONAL_SPEC.md`)
- Reason: product — iPhone-like Stories/Reels *viewer* for her own pages, girlfriend-simple, on this phone
- Impact: medium

## 2026-09-08
- Date: 2026-09-08
- Description: Web refresh no longer shows a blank page. Metro could not resolve `expo-localization` from generic `I18nProvider.tsx`, so the root bundle failed. Follow-phone now reads the device tag from `deviceLocale.native.ts` (expo-localization) and `deviceLocale.web.ts` (`navigator.language`, default `en`).
- Affected modules: Data (`deviceLocale.native.ts`, `deviceLocale.web.ts`); View (`I18nProvider`)
- Reason: bug fix — native localization module imported from unplatformed View crashed Expo web on load/refresh
- Impact: high

## 2026-09-08
- Date: 2026-09-08
- Description: UI languages — English, Hong Kong Traditional Chinese (`zh-Hant`), Japanese, plus a short Simplified catalog for Follow-phone `zh-Hans`/`zh-CN`. Default Follow phone. You → Language (Follow phone · English · 中文 · 日本語), not Customize. Chrome, reminder compose (HOUR/MINUTE, monthly This date / Start / End, When chips, preview, Next footnote), card-fee HKD copy, lock, backup, empty states, and humanError keys go through `t()`. Dates use Intl for the active locale.
- Affected modules: Model (`AppSettings.language`, `language.ts` mapping, backup allow-list, `humanErrorKey`, `formatSpendLine` inclCard, `formatRatesClock`); Controller (`SettingsController.setLanguage`, `SettingsProvider`); View (`src/view/i18n/` catalogs + `I18nProvider`, You `LanguagePanel`, chrome screens); Config (`expo-localization`, `i18n-js`); docs (`FUNCTIONAL_SPEC.md`)
- Reason: product — HK-first companion in English, 繁體, and Japanese; girlfriend-simple copy, no cloud translation APIs
- Impact: medium

## 2026-09-08
- Date: 2026-09-08
- Description: Reminder compose — hour **and** minute neumorph wheels side by side (00–59 minutes, 12h only on the hour wheel). Preview includes minutes. Monthly chips **This date / Start of month / End of month** (Feb last day 28/29 leap). Next-fire and notifications honor month start/end. Next occurrence stays a footnote under the date — no overlapping NumberStepper / duplicated clock / Next in the wheel well.
- Affected modules: Model (`Reminder.monthAnchor`, `nextFire.civilDayForMonthly`, `describeRecurrence`, `defaults.monthlyForAnchor`, `normalizeReminder`); View (`TimeWheels`, `HourPicker` minute kind, `ReminderEditScreen`, `CreditCardEditScreen`); Controller (`ReminderController` hour/minute clamp); docs (`FUNCTIONAL_SPEC.md`)
- Reason: product — girlfriend-simple bills on the 1st or last day; minutes without the old overlap
- Impact: medium

## 2026-09-08
- Date: 2026-09-08
- Description: Expense FX — foreign spends show **estimated HKD** with an optional Visa/Mastercard-style **card fee** (None / Typical 1.5% / Typical 2% / 3%, default 1.5% for HK retail). `hkdEstimate = mid * (1 + feeRate)`. Log a spend live line e.g. `US$12 ≈ HK$95.90 incl. card 1.5%`. Copy is estimate, not a bank posting. You → Money (not Customize). HKD month totals use the fee-inclusive estimate; USD/CNY You currency keeps mid-market totals.
- Affected modules: Model (`AppSettings.cardFxFeeRate`, `fx.convertAmount` / `formatSpendLine`, financeStats, monthInsights, todayGlance, weeklySummary, backup settings allow-list); Controller (`SettingsController` / `SettingsProvider`); View (You Money chips, Log a spend estimate, Money/Calendar rows); docs (`FUNCTIONAL_SPEC.md`, `README.md`)
- Reason: product — girlfriend-simple “what it costs me in HKD” including typical HK card FX/FCY markup, without issuer APIs
- Impact: medium

## 2026-09-08
- Date: 2026-09-08
- Description: UI bugfix — reminder compose time layout. Removed the overlapping Minute stepper (large “0”), duplicated 11:00 PM preview, and “Next Today” stacked in one well with a Material underline. Hour-only 0–23 wheel; one preview line (Every year · Sep 8 · 11:00 PM) honors Customize 12h/24h; next fire is a footnote under the date; Remind me switch is its own row.
- Affected modules: View (`ReminderEditScreen`, `HourPicker`, `DateField`, `NumberStepper`); Model (`describeReminderSchedule`); utils (`formatTimeOfDay`, `formatNextDay`); docs (`FUNCTIONAL_SPEC.md`)
- Reason: bug fix — Anniversary (and other templates) minute cell collided with time preview and next-occurrence copy
- Impact: medium

## 2026-09-08
- Date: 2026-09-08
- Description: Cursor/VS Code can boot Halo from **Terminal → Run Task** (`Halo: Start emulator` / `Halo: Start Metro (8081)`). Workspace `.vscode/tasks.json` (cwd `mobileApp`); recommends Expo Tools. Run one of those tasks, not both — emu already starts Expo.
- Affected modules: Config (`.vscode/tasks.json`, `.vscode/extensions.json`); docs (`README.md`)
- Reason: technical — start Pixel_9a + Expo from Cursor without a custom marketplace extension
- Impact: low

## 2026-09-08
- Date: 2026-09-08
- Description: UI: iPhone-style chrome. Large titles on root tabs, inset grouped You (Look, Customize, App lock, Backup, More), iOS-like tab bar and Back, system font. Customize still ends with Week starts on; App lock still includes Lock after when on. Neumorph cards kept — not a Material or flat iOS clone.
- Affected modules: View (`FloatingTabBar`, `GroupedList`, You/`CustomizePanel`/`LockSettingsPanel`/`BackupPanel`, Today/Pages/Calendar/Money/Reminders, compose/spend sheets, `ScreenHeader`); theme (`tokens` system font, `typography`); docs (`FUNCTIONAL_SPEC.md`)
- Reason: professional iOS familiarity
- Impact: medium

## 2026-09-08
- Date: 2026-09-08
- Description: You → Customize **Week starts on** (Sunday / Monday, default Monday) so the Calendar month grid and Today/You This week share one `weekStart`. You → App lock **Lock after** (Right away / 1 minute / 5 minutes) replaces the magic ~60s background re-lock; hidden when lock is Off.
- Affected modules: Model (`AppSettings` weekStart + lockAfterSeconds, `weekBounds`, `journalCalendar`, `todayGlance`, `weeklySummary`, `journalStats`, `moodTrends`, backup settings allow-list); Controller (`SettingsController` / `SettingsProvider`, `JournalController` / `JournalProvider`, `LockSessionProvider`); View (`CustomizePanel`, `LockSettingsPanel`, Today, You); docs (`FUNCTIONAL_SPEC.md`)
- Reason: UX consistency — calendar and This week meant the same week; lock timeout is a visible choice instead of a hidden 60s
- Impact: medium

## 2026-09-08
- Date: 2026-09-08
- Description: Emulator start no longer treats Windows `emulator.exe` launcher exit as death. Waits up to 20s for `qemu-system*` / adb `emulator-*` (not a 5s parent PID check), does not redirect launcher stdout, reuses any already-listed emulator, and prints GPU/AVD hints that match the AVD the user actually launched.
- Affected modules: scripts (`scripts/start-emulator.ps1`, `scripts/start-emulator.sh`)
- Reason: bug fix - on Windows emulator.exe is a launcher that often exits within seconds after spawning QEMU; the 5s alive check was a false failure and stdout redirect could block spawn
- Impact: low

## 2026-09-08
- Date: 2026-09-08
- Description: Metro-only start script pins Expo to port 8081 (`npm run metro` / `npm run start:8081`). Server only - no AVD. Default host is LAN so http://localhost:8081 and the LAN IP both work. If 8081 is busy, prints "Metro already on 8081" with the PID and a netstat command; `-Force` stops the listener then starts.
- Affected modules: scripts (`scripts/start-metro.ps1`, `scripts/start-metro.sh`); Config (`package.json`); docs (`README.md`)
- Reason: technical - start the Expo/Metro bundler at http://localhost:8081 without booting an emulator
- Impact: low

## 2026-09-08
- Date: 2026-09-08
- Description: Emulator start wait no longer uses a silent `adb wait-for-device`. Polls `adb devices` every 3s (180s default, 300s with `-Gpu swiftshader_indirect`), requires `sys.boot_completed=1` (not `offline`), prefers AVD `Pixel_9a`, ASCII-only console text, and prints `halo-emulator.log` if QEMU dies or times out.
- Affected modules: scripts (`scripts/start-emulator.ps1`, `scripts/start-emulator.sh`); docs (`README.md`)
- Reason: bug fix - wait-for-device timed out on swiftshader; Windows-1252 mojibake on em-dash/ellipsis; alphabetical list-avds picked Medium_Phone over Pixel_9a
- Impact: low

## 2026-09-08
- Date: 2026-09-08
- Description: Emulator start scripts disable UWB (`-feature -Uwb`), skip snapshot load by default, cap at 4 cores, and send QEMU/netsimd noise to a temp log so boot warnings are not treated as failure. Optional `-Gpu swiftshader_indirect` / `-Snapshot`.
- Affected modules: scripts (`scripts/start-emulator.ps1`, `scripts/start-emulator.sh`)
- Reason: technical — packet-streamer UWB and QEMU hanging-thread lines are emulator watchdog noise, not Halo crashes
- Impact: low

## 2026-09-08
- Date: 2026-09-08
- Description: Fixed PowerShell `ParameterNameConflictsWithAlias` on `start-emulator.ps1` — removed redundant `[Alias('avd')]` on `$Avd` (aliases are case-insensitive). `-Avd` still works.
- Affected modules: scripts (`scripts/start-emulator.ps1`)
- Reason: bug fix — script would not parse `param()`
- Impact: low

## 2026-09-08
- Date: 2026-09-08
- Description: Docs brought current with the shipped Halo — FUNCTIONAL_SPEC marks Customize, Privacy, Recently deleted, weekday spend repeat, CSV, empty/error quality bar, lock/.halo, and FX (Frankfurter/ECB, HKD/USD/CNY) as shipped; widget and PDF skipped; explicit do-not-add list. README is a new-PC guide (`setup-dev.ps1` / `setup-dev.sh` / `npm run setup`, `npm run emu`, web, EAS APK) with privacy one-liner.
- Affected modules: docs (`FUNCTIONAL_SPEC.md`, `README.md`, `CHANGELOG.md`)
- Reason: docs — spec and README must match the current app and scripts (honest shipped vs planned)
- Impact: low

## 2026-09-08
- Date: 2026-09-08
- Description: Developer bootstrap for another PC — verify Node (engines 20.18+), Git, JDK 17, Android SDK; always `npm install`; optional `-InstallTools` / `--install-tools` for Node LTS and OpenJDK 17 via winget/brew. Expo/EAS stay on npx; does not run `eas login` or auto-install Android Studio.
- Affected modules: scripts (`scripts/setup-dev.ps1`, `scripts/setup-dev.sh`); Config (`package.json` engines + `setup` script); docs (`README.md`)
- Reason: technical — clone Halo on a new machine and develop without guessing tool versions
- Impact: low

## 2026-09-08
- Date: 2026-09-08
- Description: Professional Customize + store polish — You → Customize (reminder sound vs silent, haptics, 12h/24h clock; Look unchanged), Privacy screen, empty lists with a next tap, native reminder DATE scheduling honors sound and asks POST_NOTIFICATIONS when the first enabled reminder is scheduled, backup copy that she must remember the password for a new phone, CSV spreadsheet export, 30-day Recently deleted for pages and spends, optional weekday spend repeat. Android home-screen widget skipped (not in Expo 57). FX files left in place.
- Affected modules: Model (`AppSettings` sound/haptics/clock helpers, trash, recurringSpend, readable CSV, humanError); Controller (Settings, Reminder.syncSchedules + sound, Journal/Finance trash restore, Backup CSV, TrashProvider); Data (`reminderNotifications.native` sound/channels, TrashLocalStore); View (You Customize/Privacy/Recently deleted, EmptyState, HourPicker, BackupPanel, Money/Today/Pages/Reminders/Photos); docs (`FUNCTIONAL_SPEC.md`)
- Reason: business — girlfriend-simple on-device Customize and store-ready empty/privacy/notification polish without cloud
- Impact: medium

## 2026-09-08
- Date: 2026-09-08
- Description: Expense FX — spend amounts stay on this phone; Money/Today totals convert into You home currency (default HKD) from cached Frankfurter/ECB latest rates. Spend rows show original + ≈ home when currencies differ. Offline uses last cache (“Rates from {time}”). Adding a spend never waits on FX.
- Affected modules: Model (`fx`, `financeStats`, `monthInsights`, `todayGlance`, `weeklySummary`); Data (`FxRateStore`, `FxRateClient`); Controller (`FxRateController`, `FxRateProvider`); View (Money, Today, Calendar, spend form, You one-line); `appConfig`; docs (`FUNCTIONAL_SPEC.md`, `README.md`)
- Reason: business — log a US$ coffee and see it in HK$ without uploading amounts
- Impact: medium


## 2026-09-08
- Date: 2026-09-08
- Description: Local Android emulator start script — find SDK/AVDs, reuse or boot an emulator, then `expo start --android` (`npm run emu`). Optional `-Avd`, `-Clear`, `-LocalDebug`.
- Affected modules: scripts (`scripts/start-emulator.ps1`, `scripts/start-emulator.sh`); Config (`package.json`); docs (`README.md`)
- Reason: technical — start Halo on a local AVD from one command
- Impact: low

## 2026-09-08
- Date: 2026-09-08
- Description: Fix Windows `scripts/build-apk.ps1` parse errors — user-facing messages with `+`, parentheses, or URLs now use single-quoted strings so PowerShell does not treat `20.18+` as an expression.
- Affected modules: scripts (`scripts/build-apk.ps1`)
- Reason: bug fix — script failed to parse before Node/EAS checks
- Impact: low

## 2026-09-08
- Date: 2026-09-08
- Description: Write a page, add a reminder, and log a spend are independent — compose has no spend/income, saving a spend does not open a page, and a reminder does not auto-create a spend (optional “Log this as a spend” only). Saved spends are editable and removable from Money, Calendar, and search. Budget overspend no longer forces a journal or reminder.
- Affected modules: Model (`Expense` / `Income` comments); Controller (`FinanceController.updateExpense`, `FinanceProvider`); View (compose, page detail, reminder, spend form, Money, Calendar, Pages search, income); `app/expense/[id]`; docs (`FUNCTIONAL_SPEC.md`)
- Reason: business — adding one thing must not require or auto-create another; she can fix a spend after save
- Impact: medium

## 2026-09-08
- Date: 2026-09-08
- Description: Practical Android APK path for sideloading Halo — EAS preview profile (`android.buildType` apk), `npm run apk`, Windows `scripts/build-apk.ps1` plus POSIX `.sh`. Local Gradle debug APK documented as fallback (no committed keystore).
- Affected modules: Config (`eas.json`, `package.json`); scripts (`scripts/build-apk.ps1`, `scripts/build-apk.sh`); docs (`README.md`, `FUNCTIONAL_SPEC.md`)
- Reason: technical — she can install a preview/debug APK without Play signing
- Impact: low

## 2026-09-08
- Date: 2026-09-08
- Description: Add a spend lets her pick the date on the simple form (DateField calendar, default today). Recent chips still prefill amount, category, and note without resetting the date. More details no longer hides the picker.
- Affected modules: View (`ExpenseEditScreen`, `DateField` wrap); docs (`FUNCTIONAL_SPEC.md`)
- Reason: business — she can log yesterday’s coffee without opening More details
- Impact: low

## 2026-09-08
- Date: 2026-09-08
- Description: Halo enhancement — richer Today (Next up, compact This week, On this day, gentler quiet cue), fuller weekly summary on You, spend Recent one-tap prefills, Money vs-last-month + top category, backup last-export status (time + counts only), Photos grouped by month with All / This Month / This Year, optional 80-char mood note (searchable), Life areas from tags on How you’ve been. No cloud, bank APIs, or double-entry.
- Affected modules: Model (`nextUp`, `onThisDay`, `weeklySummary`, `recentSpends`, `monthInsights`, `photoMemories`, `moodNote`, `lifeAreas`, `backupStatus`, `Expense.formatFriendlyMoney`); Controller (`JournalController` mood note, `SettingsController.recordBackupStatus`); View (Today, You, Money, Photos, compose/detail, spend form, Backup, How you’ve been, EntryCard); Data/settings (`AppSettings` lastBackup* metadata); docs (`FUNCTIONAL_SPEC.md`)
- Reason: business — open the app, do one thing, feel done; warm home and quiet life/money without a finance OS dump
- Impact: high

## 2026-09-08
- Date: 2026-09-08
- Description: FUNCTIONAL_SPEC.md brought current with the shipped Halo — IA, journal, reminders (templates, wrap chips, date picker, hour wheel, ping switches), Calendar views, Money simple vs extra, Card Health, quick add, global search, weekly summary, Photo Memories, lock overlay/session, encrypted `.halo` backup, platforms/stubs, non-goals. README bullets aligned. App behavior unchanged.
- Affected modules: docs (`FUNCTIONAL_SPEC.md`, `README.md`)
- Reason: docs — spec lagged lock, backup, reminder UX, and girlfriend day-1 features
- Impact: low

## 2026-09-08
- Date: 2026-09-08
- Description: App lock unlock works again — correct PIN (and biometrics when enrolled) returns her to Today/tabs. Wrong PIN stays locked with a clear message. Web uses a working PIN in AsyncStorage instead of a stub that could never verify. Backup restore no longer turns lock on without a PIN on this device.
- Affected modules: Controller (`LockSessionProvider`, `LockProvider` native/web, `LockController`, `BackupController`); Data (`pinStore.web`); Model (`pinRules.lockModeAfterRestore`); View (`LockScreen`, `LockSettingsPanel`, `PinPad`); docs (`FUNCTIONAL_SPEC.md`)
- Reason: bug fix — lock screen could ignore PIN taps (Modal outside the gesture root), immediately re-lock after a correct PIN / PIN setup, and web PIN save/verify was a no-op so she could not get past the gate
- Impact: high

## 2026-09-08
- Date: 2026-09-08
- Description: You → Backup exports a password-locked `.halo` file of on-device life+money (journal, reminders, cards, spends, income, budgets, assets, loans, settings). Import decrypts then replace-with-confirm. PIN in secure-store is never exported. Wrong password writes nothing. After import, reminder notifications are rescheduled on native.
- Affected modules: Model (`backup` document + PBKDF2/AES-GCM); Controller (`BackupController`); View (`BackupPanel` on You); Data (`backupIO` native/web, `ensureCsprng`); docs (`FUNCTIONAL_SPEC.md`)
- Reason: business — she can move or keep a copy without a cloud; without her password the file is useless
- Impact: medium

## 2026-09-08
- Date: 2026-09-08
- Description: Credit-card ping hours and reminder time-of-day hours are a flickable 0–23 scroll wheel in a neumorph inset well (tap a row or scroll). The ping enable switch stays; the on-screen word “Enabled” is gone (accessibilityLabel only). Minutes stay +/− steppers.
- Affected modules: View (`HourPicker.native` / `HourPicker.web`, `CreditCardEditScreen`, `ReminderEditScreen`)
- Reason: UX — girlfriend-simple hour scroll, not +/−; toggle needs no caption
- Impact: low

## 2026-09-08
- Date: 2026-09-08
- Description: Calendar dates are picked from a native/web date field (tap the inset well → calendar → done). One-time / monthly / yearly reminders, card statement and due days, spend and income dates, journal page day, and budget month no longer use typed YYYY-MM-DD or day-number steppers. Clock time stays hour/minute steppers.
- Affected modules: View (`DateField.native` / `DateField.web`, reminder / spend / income / card / compose / Money budget forms); Controller (`dateFieldValue`); docs (`FUNCTIONAL_SPEC.md`)
- Reason: business — girlfriend-simple calendar dates, not hour-style steppers or typed day numbers
- Impact: medium

## 2026-09-08
- Date: 2026-09-08
- Description: Reminder list category chips wrap onto a second row so Vehicle is fully visible (no one-line clip). Type chips, template titles, and list type/schedule lines shrink (native 0.7) or wrap (web) instead of overflowing the switch.
- Affected modules: View (`Chip` scalable + `scalableLabel`, `RemindersScreen` filters/cards, `ReminderEditScreen` templates, `AmbientBackground.web`)
- Reason: bug fix — list filter pills clipped on the right; type labels still did not scale after the prior Chip wrap
- Impact: low

## 2026-09-08
- Date: 2026-09-08
- Description: Phase 1 girlfriend enhancements — richer Today glance (mood, week spend vs last, bill in 7 days) plus This week; amount-first smart spend add; global search (pages / reminders / spends); Card Health on Money; weekly life summary on Today and You. Labels wrap or shrink on everyday screens so long English/Chinese copy never clips off-card. Photo memories and a quiet reflection cue shipped simple; net-worth trend stubbed; document vault skipped.
- Affected modules: Model (`todayGlance`, `quickAdd`, `cardHealth`, `globalSearch`, `weeklySummary`, `weekBounds`, `reflectionCue`, `photoMemories`); View (Today, Pages, Money, You, spend form, Calendar, Chip, EntryCard, tab bar, PrimaryButton); `app/memories`; docs (`FUNCTIONAL_SPEC.md`)
- Reason: business — she should see a warm, scannable day-1 home and find life + money without a finance OS dump
- Impact: medium

## 2026-09-08
- Date: 2026-09-08
- Description: Added FUNCTIONAL_SPEC.md (summary product contract for current IA) and a README pointer to it. App behavior unchanged.
- Affected modules: docs (`FUNCTIONAL_SPEC.md`, `README.md`)
- Reason: docs — girlfriend-friendly + developer summary of what Halo actually does
- Impact: low

## 2026-09-08
- Date: 2026-09-08
- Description: Reminder type chips and create-flow template cards resize on a narrow screen — labels wrap (up to two lines) instead of overflowing the neumorph row.
- Affected modules: View (`Chip`, `ReminderEditScreen` template grid + type/category wrap, `RemindersScreen` list cards)
- Reason: bug fix — type / template / category labels did not shrink after clay surfaces
- Impact: low

## 2026-09-08
- Date: 2026-09-08
- Description: Halo UI is now neumorphism — tinted canvas, raised dual-shadow cards, inset wells for search/inputs, clay raised buttons, and a raised tab pill. Glass/blur chrome is gone; Fraunces + Outfit stay. Features and routes unchanged.
- Affected modules: View (`tokens`, GlassSurface, AmbientBackground, ScreenScaffold, PrimaryButton, BackButton, FloatingTabBar, chips/inputs, screen chrome)
- Reason: business — girlfriend-friendly soft extruded look
- Impact: medium

## 2026-09-08
- Date: 2026-09-08
- Description: Back and compose dismiss no longer call `router.back()` on an empty stack (`canGoBack`, else replace Today). Corrupt settings JSON is caught so load cannot white-screen. Clay surface tokens no longer type as ViewStyle-only, so TextInput styles typecheck.
- Affected modules: View (`BackButton`, `ComposeScreen`, reminder edit Back, `tokens`); Data (`SettingsLocalStore`); Utils (`leaveScreen`)
- Reason: bug fix — deep-link / first-screen back and bad AsyncStorage
- Impact: low

## 2026-09-08
- Date: 2026-09-08
- Description: Stack and modal screens now leave with a back chevron (←) instead of a text Close. Dismiss still uses `router.back()`; Release / Delete stay as they are.
- Affected modules: View (`BackButton`, Compose, Entry detail, Reminder create/edit, Credit card, Spend, Income)
- Reason: bug fix / UX — Close read as dismiss-the-app; Back matches stack navigation
- Impact: low

## 2026-09-08
- Date: 2026-09-08
- Description: Reminders list hid the floating tab island because `/reminders` was a root stack screen. The list now lives under the Calendar tab (`/(tabs)/calendar/reminders`); create/edit/card screens stay full-screen. `/reminders` redirects to that tab child.
- Affected modules: View (`app/(tabs)/calendar` stack, Calendar/You/Money list links, FloatingTabBar pop-to-root); Model (`reminderOpenPath`); `app/reminders/index` redirect
- Reason: bug fix — she should still reach Today, Pages, Calendar, Money, and You while browsing reminders
- Impact: low

## 2026-09-08
- Date: 2026-09-08
- Description: Simplify Halo for everyday use. Friendlier copy (Today, Pages, Calendar, Money, You). Today is greeting + Write / Record / Add a spend + next reminder + optional streak. Money defaults to this month’s spend, add expense, and upcoming bills; budgets, assets, loans, income, and “what I have minus what I owe” sit behind More money tools or You → Show extra money tools (`showAdvancedFinance` / `simpleMoney`, default off unless she already has assets or loans). Reminder create is emoji cards first, then only needed fields. Calendar stays Monthly with Views folded away. Onboarding is two short screens. Engines unchanged.
- Affected modules: Model (`AppSettings.showAdvancedFinance`, `simpleMoney` / `resolveShowAdvancedFinance`); Controller (Settings setShowAdvancedFinance); View (Today, Money, You, onboarding, reminder create, Calendar, Pages, How you’ve been, tab bar, chips); `app/(tabs)` titles
- Reason: business — she should open the app, write or snap or log a spend, and feel done
- Impact: medium

## 2026-09-07
- Date: 2026-09-07
- Description: Reposition Halo as an on-device Personal Life & Finance OS. Tabs: Today | Life | Cal | Money | You. Personal accounting (not Xero): Income entries, Expenses, monthly Budgets, Assets, Loans, credit-card balances; net worth = assets − loans − card balances. Reminders stay first-class (recurrence, kinds, templates, Financial/Health trees, credit-card multi-pings). Journal location; lock (PIN/biometrics). OS joins: mark paid → expense (+ optional journal), journal → spend/income, calendar mood + dues + spends, budget overspend → reflection or reminder. No bank APIs, no GL, no cloud.
- Affected modules: Model (Income, Expense, Budget, Asset, Loan, netWorth, financeStats, Reminder, CreditCardAccount.currentBalance, JournalLocation); Data (FinanceLocalStore, pin/biometric/notification/location native-web splits); Controller (FinanceController/Provider, Reminder, Lock, Settings currency/lock); View (Money, Income/Expense editors, Calendar, Today, Aura snapshot, Life tab, You lock/currency); `app/` routes; `app.json` (Face ID, location, notifications)
- Reason: business — one app for life, time, and money on this device
- Impact: high

## 2026-09-07
- Date: 2026-09-07
- Description: Halo journal product slice — daily CRUD with markdown, four emoji moods (😊😐😔😡), tags, camera + library photos, voice-first journal and clips; calendar with mood colors and streak; Pages timeline (Today / Yesterday / Last Week / Last Month / Earlier) plus keyword/mood/tag/date search; Aura mood analysis (30-day Happy/Neutral/Stress, daily/weekly/monthly). Native media modules stay in `*.native.tsx`; web uses stubs/file input.
- Affected modules: Model (`Mood`, `JournalEntry`, search/calendar/timeline/moodTrends, markdown, tags); Data (`JournalLocalStore`, `mediaStore.native.ts` / `mediaStore.web.ts`, seeds); Controller (`JournalController`, `JournalProvider`); View (compose, detail, Pages, Calendar tab, Aura charts, photo/voice platform files, FloatingTabBar); `app.json` (camera, photos, microphone)
- Reason: business — deliver journal writing, calendar, search, timeline, mood analysis, and voice journal in one local app
- Impact: high

## 2026-09-07
- Date: 2026-09-07
- Description: Web still resolved AmbientBackground.tsx (and GlassSurface.tsx) over .web.tsx, so expo-mesh-gradient loaded in the browser. Native modules now live only in .native.tsx files; generic unplatformed files removed.
- Affected modules: View (AmbientBackground.native.tsx, AmbientBackground.web.tsx, GlassSurface.native.tsx, GlassSurface.web.tsx); `tsconfig.json` (`moduleSuffixes` so tsc resolves platform files)
- Reason: bug fix
- Impact: medium

## 2026-09-07
- Date: 2026-09-07
- Description: Initial Halo journal app — shared Android and iOS client with 2026 liquid-glass / mesh-gradient language, local journal persistence, onboarding, compose, timeline, mood insights, and appearance settings.
- Affected modules: `mobileApp` (Expo 57), Model (`src/model`), Data (`src/data`), Controller (`src/controller`), View (`src/view`, `app/`)
- Reason: business — deliver a cross-platform 2026-style mobile journal from the empty `mobileApp` workspace
- Impact: high
