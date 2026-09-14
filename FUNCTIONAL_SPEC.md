# Halo — summary functional spec

Private **life + money on this phone**. Write a page, snap a photo, log a spend, or get a nudge for a bill. Not a bank, not a cloud account.

**Look:** clay neumorphism (Paper / Midnight dual-shadow) plus **iOS grouped navigation** — large titles on the five hubs, inset grouped Settings, compact Back on pushed screens. Shared on Android (iOS-first chrome, not Material-3). **System UI** fonts. Design tokens, chrome, motion, and anti-patterns live in [`UI_DESIGN.md`](./UI_DESIGN.md). Principle: **One Glance. One Action. One Outcome.**

**Data:** AsyncStorage on device (journal, settings, reminders, finance, **goals**, **FX quotes + fetchedAt**, Recently deleted). PIN in the phone secure store (web: AsyncStorage). No account. Spend amounts, notes, and identity are never uploaded. The only network call is a public latest-rate GET (currency codes only).

---

## 1. Purpose & audience

Halo is for **one person** who wants everyday life and simple money in one app:

- Keep a private journal (write, voice, photos, mood).
- Remember bills, health, and life dates; hold one Goal in Focus.
- Log spends by hand and see this month’s total (foreign spends use **HKD locked at save**, including the card fee % that was on at that save).
- Optionally track budgets, holdings, loans, and a savings target vs cash + bank.

Primary user: **one person on this phone** — open → one glance → one action → leave. Developer audience: this spec is the product contract; engines live in `src/model`.

**Polished Halo:** open → write, remind, or log a spend → done, plus lock and backup that person trusts.

---

## 2. Personas / first-run

| Who | What they do |
| --- | --- |
| **Everyday** | Today — Life Score, Next Up, Mission if a Goal is active, Summary if Model has lines, FAB Thought / Expense / Habit. Wallet opens on Upcoming. |
| **Planner** | Focus Due / Streaks / Focus. Journal Calendar for the month grid. |
| **Reflector** | Journal timeline + Memories + prompt library. Insights This week / This month (one-line takeaway, then charts). |

**First run (three screens):**

1. “What should we call you?” (name for the hello; changeable later).
2. “This stays on your phone.” No account. Nothing is uploaded. **No cloud.**
3. **15-second hub map** — Today / Journal / Focus / Wallet / Insights, then an optional lock mention (PIN is Settings later, not a setup here). **Let’s go** → tabs.

Gate: `onboardingComplete`. Returning users skip this.

---

## 3. Information architecture

Five tabs (iOS-like bar, Halo clay): **Today · Journal · Focus · Wallet · Insights**.

Route folders stay as shipped for Expo Router stability. **Labels ≠ folder names.**

| Tab (label) | Route | What they see |
| --- | --- | --- |
| **Today** | `/(tabs)` | Date, greeting, compact **Life Score** (Season 0–100, rank, week trend if cheap, next-rank nudge e.g. “12 pts to Temper”, hidden at Steel, present-only Good / Needs attention / Critical ticks, Share Season icon), **Next Up** (1-tap complete when it is a reminder), **Mission** if an active Goal exists, **Summary** (max 3 rule-based lines; omit if empty), Settings cog + search in the header, **FAB**. No capsule, no recurring strip, no mood/week/photos/prediction/on-this-day on Home. |
| **Journal** | `/(tabs)/journal` | **Timeline / Calendar / Memories**. Memories embeds journal photos (same reel as Settings → Photos). Timeline: global search. Calendar: multi-domain dots + day drawer. Prompt library from header + Compose. |
| **Focus** | `/(tabs)/calendar` | **Due / Streaks / Focus**. Header **+** = habit / one-off reminder. Goals CRUD in Focus. Route folder stays `calendar`. |
| **Wallet** | `/(tabs)/money` | **Upcoming / Cashflow / Subscriptions / Worth**. Upcoming is default (card bills + subs due). Cards & rewards stay reachable from Upcoming (and `segment=cards`) so the rebate engine is not hidden. Transfer from Wallet (`/transfer/new`), not the FAB. |
| **Insights** | `/(tabs)/insights` | **This week / This month**: one-line takeaway (pressure), then Season meter + View charts (writing days, habit hit, spend vs last, mood mix Good / Steady / Off / Rough; month also Worth sparkline). Share Season on both segments. Share month card on month. Week prediction echo. No MoodTrendCharts dump. No 2×2 glance-tile grid. |

**Not a tab:**

- **Settings** (`/settings`, tab `href: null`) from Today (and Insights) cog.
- **Photos** `/memories` from Settings → Photos.

**Full-screen (leave with Back):** compose, page detail, reminder create/edit, credit-card form, spend (new or edit), income, transfer, goal edit, asset/loan edit, photo memories (private reel viewer), Privacy, Recently deleted.

**Reminders list** lives under Focus Due (`/(tabs)/calendar`). `/reminders` redirects there. Create/edit/card stay full-screen.

**Copy:** everyday screens wrap long English/Chinese/Japanese labels (max two lines) or shrink on native (floor 0.7). Flex children use `minWidth: 0` on web. Meaning is not cut to “Month…”.

**UI languages (shipped):** English `en`, Traditional Chinese `zh-Hant` (Hong Kong 繁體 — primary Chinese), Japanese `ja`. Follow phone is the default (`expo-localization`). Device `zh-Hans` / `zh-CN` loads a short Simplified catalog; Settings → 中文 always stores `zh-Hant`. Pick language on **Settings → Language** (not Preferences). Docs stay English.

**Independent adds:** Write a page, add a reminder, and log a spend are three separate primary flows. Adding one does not require or auto-create another.

**Capture:** `HubCaptureFab` on all five hubs → **Thought / Expense / Habit**. Expense opens Quick Spend sheet. Transfer stays off the sheet.

---

## 4. Settings tap path (**shipped**)

From the **Settings** cog (Today or Insights), in this order on the screen:

1. **Settings** — privacy kicker, name.
2. **Look** — Paper / Midnight / System.
3. **Language** — Follow phone · English · 中文 · 日本語 (not on Preferences). Default Follow phone (`expo-localization`).
4. **Text size** — System · Small · Default · Large · Extra Large, with a live preview card (sample title / body / date). Persisted as `AppSettings.fontSizePreference`; default **System** (clamped OS Dynamic Type). Fixed presets: Small 0.88×, Default 1.00×, Large 1.16×, Extra Large 1.32×. Scales HIG roles via `TypographyProvider`.
5. **Preferences** (card under Look) — Reminder sound, Haptics, Clock 12-hour / 24-hour, **Week starts on** (Sunday / Monday).
6. Manage — expense categories, reminder types, payment cards.
7. Show extra money tools · App lock (Off / PIN / Face ID; **Lock after** when lock is on) · Money currency · **Card fee when I spend in another currency** (optional **Rates updated …**).
8. **Backup** — password-locked `.halo` plus optional **Export spreadsheet (CSV)**.
9. **More → Photos** — journal photo reel (`/memories`).
10. **More → Privacy** — same “stays on this phone / no cloud” idea as first-run.
11. **More → Recently deleted** — restore released pages and removed spends for 30 days.

---

## 5. Functional modules

Each block: **what** a person can do · **who** it’s for · **rules** the code enforces.

### Today (one glance)

**What:** Command strip. Life Score + Next Up + Mission (if any) + Summary (if any) + FAB.

**Who:** Everyday open.

**Rules:**

- **Life Score** — derived Spark → Ember → Forge → Temper → Steel from 30-day writing days, habit hit rate, and envelope discipline. **Not stored. Not XP.** Compact hero: rank, 0–100 meter, optional week-over-week trend (Season recomputed 7 days ago; omitted when both scores are 0), **next-rank nudge** (`pointsToNextRank`, e.g. “12 pts to Temper”; **hidden at Steel**), present-only pillar ticks labeled Productivity / Habits / Finance with **Good / Needs attention / Critical** (missing habit/budget pillars omitted). Health and Learning are omitted — Halo does not fake Fitbit/HealthKit or a learning tracker. Tap opens Insights This month. Share Season icon uses the same native view-shot path as the month card (web: text / Save on phone).
- **Next Up** — nearest enabled reminder or card bill. Title, due status **Overdue > Today > Tomorrow > Future**, optional amount due. Tap opens the reminder or card form. Reminder rows expose a circular **1-tap complete** checkmark (haptic). Empty: quiet line + Add a reminder.
- **Current Mission** — at most one active Goal (`pickFocusGoal`). Hidden when none. Copy is Mission. Tap opens Focus → Focus. Progress is derived (metric > linked check-ins > calendar).
- **AI Summary** — at most three short rule-based lines from weekly pressure, predictions, and week facts (`buildTodaySummary`). Skip quiet/steady essays. Skip a prediction that restates pressure. **Empty: omit the block. Do not invent.**
- **Not on Today:** Write/Record/Spend capsule, recurring due strip, mood bar, this-week chips, photo highlight, on-this-day, quiet reflection cue, writing-streak line, prediction as its own row. Prediction may appear inside Summary. Photos live in Journal Memories / Settings → Photos. Recurring 1-tap log lives on Wallet Cashflow.
- **InlineHomeQuickAdd** is **gone**. Quick Spend is the FAB Expense tile (and Wallet).

### Journal (hub + compose)

**What:** Keep a day as a written page or a voice page. Optional title, markdown body (bold / italic / list), mood, optional mood note, tags, photos, optional voice clip on a written page, optional place.

**Who:** Everyday writing. Journal Calendar (and leftover compose `?date=`) can open compose for a selected day.

**Rules:**

- **Moods:** ids `happy | neutral | sad | angry` (default Neutral / Steady). **UI contract:** Good / Steady / Off / Rough (`mood.*` in en / zh-Hant / zh-Hans / ja). Compose `MoodPicker`, journal cards, search chips, photo reel, and Insights mix use those labels. Optional **mood note** (≤ 80 chars). Old pages load with an empty note. Mood note is included in page search and global search. Check-in lives on **Compose** (`MoodPicker`), not Today.
- **Save written page** if there is body **or** photos **or** a voice clip. Voice page needs a recording.
- Title ≤ 80 chars; body ≤ 8000; mood note ≤ 80; ≤ 6 photos; ≤ 8 tags. Suggested tags: `#work` `#health` `#family` `#finance` `#travel`; custom slugs allowed.
- **Place:** phone can attach GPS + reverse-geocoded name; web is a typed name only.
- Page day uses a **calendar date picker** (not typed YYYY-MM-DD).
- Open a page to edit; **Release** moves it to Recently deleted (30 days), then media is dropped.
- Compose and page detail are **journal only** — no spend or income fields, and saving a page does not open Wallet.
- **Prompt library** — tagged packs Today / Gratitude / Review / Focus (`src/model/journal/prompts.ts`). Picker from Journal header and Compose. `getDailyPrompt` stays the date rotation. No Gratitude tab.

**Journal Calendar:** month grid with journal / habit / spend dots; selected-day drawer (stories / habits / spends). Independent taps — not one mixed form.

### Global search

**What:** One on-device search over pages, reminders, and spends.

**Where:** Today search icon (opens Journal), or Journal timeline.

**Rules:** Keywords match page title + body + mood note + tags, reminder title + note + category path, spend note + category + amount. Filters: All / Journal / Reminders / Wallet. Hits open the page, reminder, or spend. Page-only mood/tag/date filters still apply on the Journal timeline. Pure filter in Model — no ranking theater.

### Reminders (Focus Due)

**What:** Local nudges. List grouped Today / Tomorrow / This week / Later / No upcoming. Filter by top category **icons**. Toggle On. Circular **complete** checkbox marks a reminder done for today (haptic + strikethrough); completed rows fold into **Completed today**. Add from Ionicons **template cards** (icon + one short word) via Focus header **+** or FAB Habit.

**Who:** Planner. List under Focus Due.

**List:** Category filters are **icon-only 44pt chips** (Ionicons). VoiceOver still says the type. Empty list: “Nothing here yet” + **Add a reminder**. If OS permission is off, a banner: “Allow notifications in system settings so Halo can ping you.”

**Create flow:** pick a card → short form (title, note, **When**, hour + minute wheels, **Remind me** switch). Only extra fields if **More options** is opened.

**Templates:** Something else · Card bill · Loan · Health · Vehicle · Certification · Subscription · Goal · Follow up · Anniversary · Family · Household — shown as **icon + short word** in a two-column grid (not emoji). **Card bill** opens the credit-card form, not a plain reminder. Template **Goal** is still a reminder kind; **real Goals** live on the Focus hub’s Focus segment (separate model).

**Dates:** calendar picker on the inset well — once / monthly / yearly (and card statement/due days). Not typed YYYY-MM-DD or day-number steppers.

**Time:** two equal 3-row neumorph wheels side by side — **HOUR** (0–23) and **MINUTE** (00–59). Flick or tap; not a NumberStepper. Hour labels follow Settings → Preferences Clock (12-hour vs 24-hour); minutes stay 00–59. Stored `hour` + `minute` persist on the reminder. One preview line includes minutes. Next fire is a **footnote under the date**, not inside the wheels.

**Recurrence — on the form:** Once · Daily · Weekly (weekday chips) · Monthly · Yearly. No sixth frequency chip (Every N months stays under More options).

**Monthly:** chips **This date · Start of month · End of month**. This date uses the calendar day (31st clamps to the last day of short months). Start of month is the 1st. End of month is the last calendar day. Yearly/Anniversary stays month+day (no start/end chips).

**Recurrence — More options:** Every N days / weeks / months.

**Kinds — More options:** follow-up · goal · reflection · anniversary as **icon chips** (intent; one scheduler).

**Priority — More options:** low · normal · high · urgent.

**Categories (More options, stepped icon chips):**

- **Financial** → Credit Card · Loan (Mortgage / Personal / Car) · Bills (Electricity / Water / Gas / Internet / Mobile) · Investments (Monthly ETF / MPF review / Portfolio review).
- **Health** → Medication · Exercise · Medical (and their types).
- Also: Household · Family · Vehicle · Work · Personal · Other.

**Credit-card multi-ping:** one **card account** (name, statement day, due day, optional amount due, optional outstanding balance) plus child reminders: statement day, due day, optional extras. Due ping is high priority. Card balance counts as debt in net worth; amount due is a cash-flow figure, not a balance-sheet posting. Each ping has hour + minute wheels and an enable switch — **the switch has no visible “Enabled” caption** (`accessibilityLabel` only).

**Log this as a spend** (existing reminder, optional, default off): opens **Log a spend** prefilled from the reminder (`reminderId` stored if saved). Does **not** write a page or open Compose. Creating a reminder never auto-creates a spend.

### Focus Streaks & Focus (Goals)

**Streaks:** habit hit heat / streak presentation for reminders that behave as habits. Math in Model (`habitStreaks`). Not XP.

**Goals:**

- Model: title, why, target date, optional metric (current / target / unit), linked reminder IDs, status active / paused / done.
- Progress is **derived, never stored**: metric > linked check-in ratio > calendar elapsed to target.
- CRUD on the Focus hub’s Focus segment (`/goals/new`, `/goals/[id]`). Reminder schema unchanged — links live on the Goal.
- Today shows **one** compact Mission row.
- Backup inner JSON includes `goals`. Older v1 files without `goals` restore as `[]`.

### Insights

**What:** Private board pack. This week | This month. Synthesis, not a reprint of Focus or Wallet lists.

**Rules:**

- One-line takeaway (pressure line, tappable into the hub). Wins / risks / action pack is not on the screen.
- Same Season rank as Today (derived). Chart-like circular score well + pillar bars.
- **Primary viz** (`boardFacts` series, View bars — no chart library): writing days (7-cell week / 30-bar month), habit-hit meter, spend vs last as two bars, month Worth sparkline from `netWorthHistory`, mood mix from four MoodIds (Good / Steady / Off / Rough). Numbers sit on the chart caption. Empty frames stay designed.
- Charts / legends deep-link to Journal / Focus / Wallet. No MoodTrendCharts dump. No Rhythm heatmap or Wallet category table as the screen.
- **Predictions** — at most one, Insights **week** echo (and Today Summary when it does not restate pressure). Priority: overdue/card due → sub renewal ≤7d → envelope pace → writing quiet Thu–Sun. **Skipped if it duplicates Next Up.** No new push notifications.
- **Share this month** — native image (`MonthlyReportCard` + view-shot + share); web copies text or “Save on phone.”
- **Share Season** — native image (`SeasonShareCard` + same view-shot helpers); web text or “Save on phone.” Rank, 0–100, present pillars, optional week trend. Entry: Today Life Score icon + Insights This week / This month. Never uploads.
- Close-the-day is not a flow. No Focus Session until a timer exists.

### Wallet

**What:** Personal accounting typed by hand. **Settings → Money currency** is the **home** total (Spent this month) — default **HKD** (also USD, CNY — **no EUR / GBP**). A **new spend’s currency is HKD** unless USD or CNY is picked on that transaction. Changing Settings currency does not change the spend keypad default.

**Who:** Everyday = Upcoming (what is due). Cashflow for this month’s spends. Extra tools if turned on. Worth is always a visible segment (not an advanced-finance lab).

**FX (spend → estimated HKD) — shipped:** Log a spend **real-converts** from the cached latest-rate table plus **card fee %**. **On save**, that conversion is **locked on the expense**. Wallet, Journal Calendar, Spent this month, and Insights **do not convert again**.

- **Feed:** Frankfurter/ECB `https://api.frankfurter.app/latest?from=USD&to=HKD,CNY`. GET is **currency codes only**. No amounts, notes, or identity. Not a bank API.
- **Card fee:** Settings → Wallet, under Money currency — **Card fee when I spend in another currency**: **None · Typical 1.5% · Typical 2% · 3%**. Default **Typical 1.5%**. Stored on `AppSettings.cardFxFeeRate`. Applied at **save** (and one-time backfill). Changing the chip later does not rewrite old spends.
- **Estimate (compose):** `hkdEstimate = convert(amount, from, HKD) * (1 + feeRate)`. Live line e.g. `US$12 ≈ HK$95.90 incl. card 1.5%`. Copy: **Estimated HKD, including card fee.** Never “exact bank charge.” Same-currency **HKD** stays a single amount with no conversion fields.
- **Lock at save:** persist `amount` + `currency` plus `homeAmount` (fee-inclusive HKD), `quoteCurrency: 'HKD'`, `fxRate` (mid HKD per 1 spend unit), `cardFeeRate`, `convertedAt`. That `homeAmount` is “what it cost me.”
- **After save:** list rows show **that row’s** original + locked HKD. Totals sum stored HKD (or same-currency amount). No live `convertAmount` on saved rows.
- **Legacy rows** without a snapshot: convert **once** on read (using cache, fetch if needed), persist, never again.
- **Cache:** AsyncStorage `halo.finance.fx.v1` `{ base, quotes, fetchedAt }`. 6-hour TTL. Refresh on **Log a spend / foreign save** (and one-time backfill), **not** on every Wallet/Today mount. Save uses current quotes when they exist; it does not block forever if the feed is down.
- **Offline:** last cache + the fee % at save. Log a spend shows **Rates from {time}.** when the live feed failed. Missing pair → original only until a snapshot can be written.
- **UI:** Settings currency **HKD** (default): Spent this month / Insights use locked fee-inclusive HKD. Dual line is always ≈ HK$. Net worth in the reporting currency stays unconverted (other currencies listed, not summed).
- **Settings:** optional **Rates updated …** under Money currency (cached clock; not a Wallet-list refetch).
- Web and phone both GET over HTTPS.

**Upcoming (default Wallet segment):** card bills + subscription renewals due within 14 days (`listUpcomingMoney`; reuses card health + `daysUntilRenewal`). Daily coffee rules omitted. Empty stays empty. **Cards & rewards** is a tool row from Upcoming (and `?segment=cards`) so the rebate engine stays reachable without being a fourth equal hub segment.

**Cashflow:** hero **Spent this month** (home-currency total, optional ↑/↓ vs last month when that month has convertible spend, top category) · **Quick spend** / Add a spend · glanceable spend rows (day headers, note-or-category, tabular amount, FX line, card badge) · recurring **today** chips (**1-tap log**; long-press edits) · upcoming bills. Empty spends: a next tap to **Add a spend**.

**Smart Add a spend** (FAB or Wallet, including the chips): amount first — a **calculator**, not a free-text box. Custom keypad (0–9, decimal, backspace, + − × ÷, =, Clear) with a caret-free neumorph well. Quick **+10 / +50 / +100** chips. At most two decimal digits. **Keep this spend** persists the **evaluated number** and **HKD | USD | CNY** (default **HKD**). Suggested category from recent spends, time of day, or last merchant-ish note. **Date** picker (default today). **Recent** chips from local spend history. **More details** opens all categories, receipts, optional asset, and **Repeat this spend** (**Daily / Weekdays / Weekly / Monthly**). Foreign spends show the live estimated HKD line; that estimate is **locked on Keep this spend**. Calculator prefs are not on Preferences.

**Quick Spend sheet** (`QuickSpendSheet`, FAB Spend or Wallet): Smart Suggestion, Recent Spends, one-tap templates, Voice Quick Add (`parseVoiceSpend` on-device — no network), amount-first keypad. Converges on Controller `createQuickExpense` / `createVoiceExpense`. **Inline Home Quick Add is removed.**

**On-device OCR (shipped):** receipt photo → local text (`tesseract.js` when the runtime can load it) → `parseReceiptText` fills merchant / total / items into the spend note. Currency limited to HKD / USD / CNY. Fail closed to empty text (no crash). Not a cloud API.

**Recurring spend (shipped):** More details → **Repeat this spend** → Daily / Weekdays / Weekly / Monthly. Wallet shows due chips; **1-tap logs** today’s copy (`logRecurringSpendInstant`); long-press opens the editor. Not a full auto-posting schedule engine. **Not on Today.**

**Subscriptions / Cards:** subscription cockpit and payment-card / rebate surfaces. Card Health: days-to-due, amount due, statement vs due, green/amber/red **ok · due soon · overdue**. Quiet “No cards yet.” when empty.

**Worth (shipped — not a stub):**

- Always-visible Wallet segment (fourth of Upcoming / Cashflow / Subscriptions / Worth).
- CRUD for Asset and Loan (cash / bank / investment / property; mortgage / personal / car).
- Live net worth = assets − loans − card `currentBalance` in the reporting currency (other currencies listed, not summed; no FX).
- **Savings target** compares a typed goal to **cash + bank only** (investments stay holdings).
- **Monthly net-worth snapshots** persist on the finance document; sparkline from `netWorthHistory` (omit if empty; bars are static). Opening Worth records this month’s snapshot when the balance sheet has facts.
- Empty state invites the first manual asset.

**Extra tools** (`showAdvancedFinance`, Settings → Show extra money tools):

- Default **off** for new users. If never chosen, extras stay **on** only when assets or loans already exist.
- Income, budgets, this month in/out, six-month spend bars, filters.
- **Income:** salary / bonus / other, dated row. Same amount calculator + HKD default as spend. No journal fields on the form.
- **Spends (edit):** tap a row (Wallet list, Journal Calendar day, or search) → `/expense/[id]`. Changing amount or currency re-locks FX. **Remove this spend** with confirm → Recently deleted.
- **Budgets:** one limit per category per month. Over is a quiet hint — it does not open compose or force a reminder.
- Optional leftover `journalEntryId` / `reminderId` on old rows; the form does not prompt to write a page or add a reminder.

Not double-entry. No bank feed. No amortization.

### Photo Memories

**Photos / Reels** (`/memories`, Settings → Photos) **and Journal → Memories**: photos already on journal pages, grouped by month; filters All / This Month / This Year. Tap a photo for a **private full-screen reel** (vertical snap; Reduce Motion uses a crossfade). Caption is the page date and mood (mood note when written). Open page from the reel. Empty: one sentence + **Write today**. Journal photos only — not a vault, not Instagram/TikTok, no share/follow/comments. Stays on this phone. **Not a tab.**

### Preferences (**shipped**)

**What:** Tasteful on-device preferences under **Settings**, not a sixth tab. Card sits under Look.

**Rules:**

- **Look** stays Paper / Midnight / System (separate card above Preferences).
- **Text size** — Settings → Appearance: **System · Small · Default · Large · Extra Large**. Default **System** (uses OS `fontScale`, clamped ~0.85–1.35). Presets are fixed multipliers (0.88 / 1.00 / 1.16 / 1.32). Live neumorphic preview card. `TypographyProvider` + `createTypography` scale HIG roles app-wide.
- **Reminder sound** — On = phone default ping; Off = silent banner. Native scheduling uses expo-notifications `sound: 'default'` or `null`. Changing sound reschedules enabled reminders. Web saves the toggle; OS notifications do not fire.
- **Haptics** — On = light tap on tab switches, save, and PIN keys (`hapticLight` / `hapticSuccess` no-op when off).
- **Clock** — 12-hour vs 24-hour labels on the reminder **hour** wheel only (stored hour stays 0–23; minutes are always 00–59).
- **Week starts on** — Sunday or Monday. Default **Monday** (HK-first). Journal Calendar month grid and Insights This week share `AppSettings.weekStart`.
- No ringtone pickers, equalizers, extra sliders, quiet hours, date format, or extra themes.
- **Card fee** lives under Settings → Wallet (with Money currency), not here.

### Privacy (**shipped**)

**What:** **Settings → More → Privacy** (and first-run): “This stays on this phone. No cloud account.” Camera, mic, notifications, and place are asked **only when those actions are used** — not when the app opens.

### Recently deleted (**shipped**)

**What:** Released pages and removed spends stay on this phone for **30 days**, then media is dropped. **Settings → More → Recently deleted** → Restore.

**Who:** Undo a Release or Remove without a cloud bin.

### Backup (**shipped**)

**What:** Save a password-locked copy of life + money on this phone, or restore from a file. Not a cloud account.

**Who:** Moving phones, or keeping a file in Files / Downloads.

**Rules:**

- **Settings → Backup → Export** — set a backup password (min 6, type it again). Halo writes `halo-backup-YYYY-MM-DD.halo`. That password must be remembered for a new phone; Halo cannot recover it. After a successful save, Backup shows **last backup date/time** plus journal, reminder, and spend counts from that moment (`lastBackupAt` + counts only). Never the password, encryption key, or backup file contents.
- **Settings → Backup → Export spreadsheet (CSV)** — readable page titles + spends (not encrypted). Optional beside the locked `.halo`. **No PDF.**
- File starts with magic `HALO1`, then an opaque wrapper `{ v, kdf, iter, salt, iv, ciphertext }` (base64). Inner JSON is never written in the clear.
- Encryption: password → PBKDF2-SHA256 (210k iterations) → AES-256-GCM. No hardcoded app secret. Without the password the file is useless; Halo does not keep the password.
- Inner document (after decrypt): `{ version: 1, exportedAt, journal, reminders (including credit-card accounts), finance (expenses, income, budgets, assets, loans, recurring spends, **savings target**, **net-worth history**), settings, **goals** }`. **PIN / secure-store secret is never exported.** Photo and voice **files** stay on the phone that made them (URIs only). Older v1 files without `goals` restore goals as `[]`.
- **Import** — pick a file, enter the password, decrypt and validate, then confirm **“This replaces what’s on this phone.”** Wrong password: clear error, nothing is written. Replace-only (no merge).
- After import, reminder notifications are rescheduled on the phone. Web has no OS pings.

### Lock + notifications (**shipped**)

**Lock:** Settings → App lock — Off / PIN / Face ID or fingerprint (phone). PIN is 4–6 digits, never in settings JSON.

- **Phone:** PIN in the secure keystore. Biometrics when hardware is enrolled; they fall back to PIN.
- **Web:** same chips; PIN lives in AsyncStorage and **does verify**. Biometrics unavailable (chip stays off).
- **Lock after** (shown only when lock is PIN or biometrics): **Right away** · **1 minute** · **5 minutes** (0 / 60 / 300 seconds). Default **1 minute**. Hidden when lock is Off.

**Overlay / session:** a full-screen overlay sits on top of the app when lock is on and this session is locked. **Fail-closed:** while lock is on and the PIN probe has not finished, Halo treats the session as locked (splash stays until settings + PIN state are known) so pages/money never flash unlocked. Cold start with a stored PIN stays locked. Correct PIN (or biometrics) **unlocks the session and returns to Today/tabs** — the overlay dismisses. Wrong PIN stays locked with “That PIN does not match.” Turning lock on does **not** immediately re-lock the session already in progress (so PIN setup is not buried). When switching apps, Halo uses the background AppState timer: **Right away** locks as soon as the app goes to background; **1 minute** / **5 minutes** re-lock on return if away that long.

**Backup restore:** importing a backup that had lock on does **not** enable lock unless this device already has a PIN.

**Notifications (phone):** OS local notifications for enabled reminders. Permission (`POST_NOTIFICATIONS` on Android 13+) is requested when the first enabled reminder is scheduled — not at cold start with an empty list. Sound vs silent comes from Settings → Preferences. List banner if permission is off. **When App Lock is on**, scheduled tray copy is privacy-safe (`Halo reminder` / `Tap to open Halo`, localized) so medical or money notes do not sit on the OS lock screen; full titles stay inside the unlocked app. When App Lock is off, the friendly reminder title/note is used.

**Android backups:** `android.allowBackup` is **false** so Google Drive Auto Backup does not copy plaintext AsyncStorage / journal JSON. Photos and voice live in the app document folder (`halo-media/`), not the public gallery. The only intentional off-phone copy is the password-locked `.halo` file.

**Web:** notifications do not fire; reminders can still be created and edited.

---

## 6. Quality bar (**shipped**)

These are product rules, not a later polish pass:

| Bar | What shipped |
| --- | --- |
| **Empty lists** | Quiet sentence + one next tap (Add a spend, Add a reminder, Write, restore). Halo does not invent numbers. |
| **Errors** | Short human copy (`humanError`) — never a stack trace. Wrong backup password writes nothing. |
| **Notifications** | Local pings fire on the phone. Android 13+ permission on first enabled reminder, not at launch. |
| **Lock** | PIN / biometrics overlay; trusted session; Lock after (Right away / 1 minute / 5 minutes) on background. Fail-closed cold start (no content flash before PIN probe). |
| **Backup** | Password-locked `.halo`; remember the password for a new phone. Optional CSV. Android `allowBackup: false`. Inner JSON includes **goals**. |
| **Privacy** | Settings → Privacy + first-run “No cloud”. Permissions on tap, not launch. Lock-on → redacted reminder tray text. |
| **Store polish** | Tap targets ~44pt; Reduce Motion skips decorative wash; everyday labels wrap or shrink so larger system text still fits. |
| **Permissions** | Camera, mic, notifications, and place asked only when those actions are used. |

---

## 7. Cross-module flows

| Flow | What happens |
| --- | --- |
| **Write a page** | FAB Thought, Journal header, Calendar day, or prompt picker → compose (mood, photos, voice, tags). Journal only. |
| **Add a reminder / habit** | FAB Habit or Focus header + → reminder form. Reminder only. Optional later: **Log this as a spend**. |
| **Log a spend** | FAB Expense → Quick Spend sheet, or Wallet Add a spend → spend form. Spend only. Optional **Repeat**. Wallet due chips **1-tap log**. |
| **Edit a spend** | Wallet list, Journal Calendar day spend, or search Spend hit → `/expense/[id]`. Remove with confirm → Recently deleted. |
| **Log this as a spend** | Existing reminder → spend form prefilled (`reminderId` if saved). No compose. |
| **Transfer** | Wallet → `/transfer/new`. Not a FAB tile. |
| **Today → Season** | Life Score hero → Insights This month. Share Season icon on the card. |
| **Today → next reminder** | Next Up: nearest enabled fire (overdue first); tap opens the reminder or card; checkmark completes a reminder for today. |
| **Today → Mission** | Active Goal row → Focus hub, Focus segment. |
| **Settings → Photos (reel)** | Month grid of journal photos; tap opens a private full-screen reel. Also Journal → Memories. Open page from the reel. |
| **Focus (Goals)** | List / create / edit Goals. Header + still creates Habit / One-off. |
| **Wallet Worth** | Assets, loans, savings vs cash+bank, snapshots + sparkline. |
| **Insights share** | This month → native month-card image / web text. Season → native Season card / web text. |
| **Backup file** | Settings → Backup → Export (password) writes an encrypted `.halo` file; last-export metadata (time + counts) is stored on this phone. Import decrypts then replaces this phone. CSV is a readable extra. |
| **Recently deleted** | Release a page or remove a spend → Settings → Recently deleted → Restore (30 days). |

The three primary adds do not require or auto-create each other. Joins are optional leftover IDs on old rows — not a general join of life and money.

---

## 8. Shipped vs later vs do not add

Honest against the current app. **Should-have** items that already exist are marked shipped.

| Priority | Item | Status |
| --- | --- | --- |
| P0 | Empty lists with a next action | **Shipped** |
| P0 | Reminder notifications fire; Android 13+ permission on first enabled reminder | **Shipped** |
| P0 | App lock (PIN / biometrics) and password-locked `.halo` backup (includes **goals**) | **Shipped** (fail-closed PIN probe + splash gate) |
| P0 | Backup password copy (“remember it for a new phone”) | **Shipped** |
| P0 | Settings → Privacy; first-run “No cloud” + 15s hub map | **Shipped** |
| P0 | Permissions on tap, not launch | **Shipped** |
| P0 | Android `allowBackup: false` (no OS cloud leak of plaintext stores) | **Shipped** |
| P0 | Lock-on reminder notifications use privacy-safe tray copy | **Shipped** |
| P0 | Settings → Preferences (sound, haptics, 12h/24h, week start) | **Shipped** |
| P0 | Settings → Appearance → Text size (System / Small / Default / Large / Extra Large + live preview) | **Shipped** |
| P1 | Recently deleted (30 days, pages + spends) | **Shipped** |
| P1 | Recurring spend (Daily / Weekdays / Weekly / Monthly; Wallet 1-tap log) | **Shipped** |
| P1 | CSV spreadsheet export beside `.halo` | **Shipped** |
| P1 | Accessibility: ~44pt taps, Reduce Motion, larger-text wrap/shrink | **Shipped** |
| — | FX latest rates (Frankfurter/ECB, HKD/USD/CNY, cache, estimated HKD + card fee %, **conversion locked at save**) | **Shipped** |
| — | Goals + Focus hub Goals + one Today Mission row | **Shipped** |
| — | Season rank (derived Spark→Steel) | **Shipped** |
| — | Wallet Worth: assets, loans, savings target, net-worth history + sparkline | **Shipped** |
| — | Insights charts (writing / habit / spend / mood / Worth spark) + week prediction echo + month share image | **Shipped** |
| — | Prompt library | **Shipped** |
| — | On-device receipt OCR | **Shipped** |
| P1 | OS home-screen widget | **Later** (not in Expo 57) |
| P1 | PDF export | **Skipped** (CSV only) |
| Later | Photo/voice **files** inside the backup | **Not built** (URIs only) |
| Later | Historical ECB date-series FX, extra currencies (EUR/GBP) | **Not built** |
| Later | Local LLM | **Not built** |

### Do not add

- Cloud accounts, sync, or sharing
- Instagram / TikTok-style social reels (follow, comments, collaboration, public feed)
- Bank / card login, open banking, Plaid, payroll
- Credit score, investment cockpit
- Document vault
- Chatbot / cloud AI recap
- Collaboration / multi-user
- Watch app
- Double-entry, chart of accounts, depreciation/amortization
- XP / loot / sixth tab
- Focus Session until a timer exists
- Widget wall on Today (capsule, recurring strip, mood bar, week chips, photos, prediction)

OCR is **shipped** (on-device receipt text). It is not in this list.

---

## 9. Non-goals (out of scope)

- No bank / card APIs. Public latest FX quotes only (not ECB date-series, not bank FX). Conversion is **locked per spend at save**. Card fee is a **percentage picked in Settings**, not an issuer settlement.
- No cloud, account, or sync. Backup is a password-locked file kept by the owner — not a Halo service.
- No double-entry, chart of accounts, or depreciation/amortization.
- Not a social or shared journal. **Reels** means a private on-device viewer of journal photos — not a social feed.
- Halo does not invent numbers: empty lists stay empty.
- No document vault, AI chat, credit score, portfolio management, bank login, watch, or collaboration.
- Season is not XP. Insights is not a feed.

---

## 10. Platforms

| Platform | Role |
| --- | --- |
| **Android & iOS** | Primary. Camera, mic, GPS, Face ID / fingerprint, OS notifications. Expo 57 / React Native. Shared **iOS grouped** chrome (not Material-only). Sideload APK: `npm run apk` or `scripts/build-apk.ps1` (EAS preview) — see README. |
| **Web** | Preview / develop (`npm start` then `w`). Same IA; native features stubbed. |

Storage keys: journal, settings, reminders, finance, **goals**, **FX rates**, Recently deleted in AsyncStorage; PIN key in secure store (native) or AsyncStorage (web). Encrypted backup files stay wherever they were saved (Downloads / Files / share sheet).

---

## 11. Architecture (MVC)

Keep layers thin and reusable:

- Model — domain rules only (`src/model`): entries, moods, reminders, finance, goals (`goalProgress`), `amountCalculator` (shop keypad → evaluated money), `FxRateTable` / `convertAmount` / `formatSpendLine` (live on compose; **snapshot on saved rows**), `computeSeasonRank` / `pillarStatus` / `computeSeasonTrend` / `pointsToNextRank` / `buildSeasonShareFacts`, `boardFacts` / `predictions` / `todaySummary` / `insightsBrief` / weekly+monthly reports, `listUpcomingMoney`, trash, backup crypto, `AppSettings`, receipt OCR parse. No HTTP, no React. Season / boardFacts / predictions / summary / brief stay Model.
- Data — persistence and I/O (`src/data`): AsyncStorage adapters (including `GoalsLocalStore`), `FxRateClient` + `FxRateStore`, notification scheduling, backup file pick/share, native month-card and Season-card share (`shareMonthCard`).
- **Controller** — orchestration (`src/controller`): `JournalController`, `FinanceController`, `GoalController` / **`GoalProvider`**, `FxRateController.refreshRates()`, providers. Thin; no UI chrome.
- **View** — screens and presentation (`src/view`, `app/`): theme, neumorph surfaces, empty states. No business math.

Cross-cutting: `AppConfig`, logging-free `humanError`, lock session, haptics/Reduce Motion utilities.

---

## 12. Out of scope / known stubs

| Feature | Phone | Web |
| --- | --- | --- |
| Camera | Take photo + library | Library via file input; “Take photo on the phone app” |
| Voice journal / clips | Record + play | Message only — recording not available |
| Location | GPS + reverse geocode | Typed place name |
| App lock | PIN / biometrics + Lock after background overlay | Working PIN (AsyncStorage); no biometrics |
| Reminder notifications | Local OS pings | Persist reminders; do not fire |
| Month share image | View-shot + system share | Text copy / “Save on phone” |
| Season share image | Same view-shot helpers | Text copy / “Save on phone” |
| Receipt OCR | Best-effort on-device; empty parse if engine missing | tesseract in the browser when it loads |

**Hidden / leftover (honest, not product):**

- `onThisDay` / `homePhotoHighlight` models and i18n remain; **Today does not render them**. Photos: Journal → Memories and Settings → Photos.
- `lifeAreas.ts` and “How you’ve been” strings remain; Insights is the board pack, not that You dump.
- `dailyPromptEnabled` still persists; the quiet Today cue is gone. Prompts are the library picker.
- Settings still shows an uppercase privacy kicker; hub kickers are empty on purpose.

**Limits that are intentional:** one reporting currency for net worth (no FX there); card `amountDue` is not net-worth debt; expense `accountId` can tag an asset but does not move a bank balance; savings progress ignores investments.

**Skipped:** OS home-screen widget (not in Expo 57). PDF export. Document vault (high risk; not day-1). Focus Session (no timer).
