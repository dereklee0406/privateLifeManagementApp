# Halo — summary functional spec

Private **life + money on this phone**. Write a page, snap a photo, log a spend, or get a nudge for a bill. Not a bank, not a cloud account.

**Look:** soft neumorphism (warm beige / charcoal dual-shadow) plus **iOS grouped navigation** — large titles on root tabs, inset grouped You, compact Back on pushed screens. Shared on Android (iOS-first chrome, not Material-3). System font (San Francisco on iPhone).

**Data:** AsyncStorage on device (journal, settings, reminders, finance, **FX quotes + fetchedAt**, Recently deleted). PIN in the phone secure store (web: AsyncStorage). No account. Spend amounts, notes, and identity are never uploaded. The only network call is a public latest-rate GET (currency codes only).

---

## 1. Purpose & audience

Halo is for **one person** who wants everyday life and simple money in one app:

- Keep a private journal (write, voice, photos, mood).
- Remember bills, health, and life dates.
- Log spends by hand and see this month’s total (foreign spends use **HKD locked at save**, including the card fee % that was on at that save).
- Optionally track budgets, what she has, and what she owes.

Primary user: **her** — open the app, do one thing, feel done. Developer audience: this spec is the product contract; engines live in `src/model`.

**Polished Halo:** open → write, remind, or log a spend → done, plus lock and backup she trusts.

---

## 2. Personas / first-run

| Who | What they do |
| --- | --- |
| **Everyday** | Today → Write / Record / Spend capsule, Due today strip, quick mood. Money stays “this month + bills.” |
| **Planner** | Calendar + Reminders (under Calendar). Extra Money tools if she wants them. |
| **Reflector** | Pages search + **You → How you’ve been** (mood climate, not a fifth tab). |

**First run (two screens):**

1. “What should we call you?” (name for the hello; changeable later).
2. “This stays on your phone.” No account. Nothing is uploaded. **No cloud.** Then **Let’s go** → Today.

Gate: `onboardingComplete`. Returning users skip this.

---

## 3. Information architecture

Five tabs (iOS-like bar, Halo clay): **Today · Pages · Calendar · Money · You**.

| Tab | Route | What she sees |
| --- | --- | --- |
| **Today** | `/(tabs)` | Date, search icon (opens Pages search), greeting, compact **Write / Record / Spend** capsule bar, **Due today** strip (1-tap recurring spends + habits), **How are you?** quick mood bar, **Next up** card with optional 1-tap complete checkmark (nearest enabled reminder or card bill), **This week** (compact), **On this day** (up to 3 prior-year pages; hidden when empty), optional quiet reflection cue, optional streak. No charts. No net worth. |
| **Pages** | `/(tabs)/journal` | Timeline + **global search** (All / Pages / Reminders / Money). |
| **Calendar** | `/(tabs)/calendar` | Monthly grid by default. **Views** folded: Monthly, Reminders, Pages, Timeline, Money. |
| **Money** | `/(tabs)/money` | This month’s spend (home currency), vs last month when that month has data, top category, amount-first Add a spend + dining/transport/groceries/bills **type icons**, weekday-repeat **today** chips when due, **Card Health**, upcoming bills. Extra tools behind **More money tools** or You. |
| **You** | `/(tabs)/settings` | Profile, Look, **Language**, **Text size**, **Customize**, Manage (categories / reminder types / payment cards), Money prefs, lock, **Backup**, Privacy / Recently deleted. |

**Not a tab:** **How you’ve been** (`/(tabs)/insights`) — word count, days this week, **Life areas** (from tags), 30-day Happy / Neutral / Stress, charts. Reach from You → More.

**Full-screen (leave with Back):** compose, page detail, reminder create/edit, credit-card form, spend (new or edit), income, photo memories (private reel viewer), Privacy, Recently deleted.

**Reminders list** lives under Calendar (`/(tabs)/calendar/reminders`) so the five tabs stay visible. `/reminders` redirects there. Create/edit/card stay full-screen.

**Copy:** everyday screens wrap long English/Chinese/Japanese labels (max two lines) or shrink on native (floor 0.7). Flex children use `minWidth: 0` on web. Meaning is not cut to “Month…”.

**UI languages (shipped):** English `en`, Traditional Chinese `zh-Hant` (Hong Kong 繁體 — primary Chinese), Japanese `ja`. Follow phone is the default (`expo-localization`). Device `zh-Hans` / `zh-CN` loads a short Simplified catalog; You → 中文 always stores `zh-Hant`. Pick language on **You → Language** (not Customize). Docs stay English.

**Independent adds:** Write a page, add a reminder, and log a spend are three separate primary flows. Adding one does not require or auto-create another.

---

## 4. You tap path (**shipped**)

From the **You** tab, in this order on the screen:

1. **You** (tab) — this week, name.
2. **Look** — Paper / Midnight / System.
3. **Language** — Follow phone · English · 中文 · 日本語 (not on Customize). Default Follow phone (`expo-localization`).
4. **Text size** — System · Small · Default · Large · Extra Large, with a live preview card (sample title / body / date). Persisted as `AppSettings.fontSizePreference`; default **System** (clamped OS Dynamic Type). Fixed presets: Small 0.88×, Default 1.00×, Large 1.16×, Extra Large 1.32×. Scales HIG roles via `TypographyProvider`.
5. **Customize** (card under Look) — Reminder sound, Haptics, Clock 12-hour / 24-hour, **Week starts on** (Sunday / Monday).
6. Show extra money tools · App lock (Off / PIN / Face ID; **Lock after** when lock is on) · Money currency · **Card fee when I spend in another currency** (optional **Rates updated …**).
7. **Backup** — password-locked `.halo` plus optional **Export spreadsheet (CSV)**.
8. **More → Privacy** (or the footer **This stays on this phone**) — same “stays on this phone / no cloud” idea as first-run.
9. **More → Recently deleted** — restore released pages and removed spends for 30 days.

---

## 5. Functional modules

Each block: **what** she can do · **who** it’s for · **rules** the code enforces.

### Journal (Pages + compose)

**What:** Keep a day as a written page or a voice page. Optional title, markdown body (bold / italic / list), mood, optional mood note, tags, photos, optional voice clip on a written page, optional place.

**Who:** Everyday writing. Calendar can open compose for a selected day (`?date=YYYY-MM-DD`).

**Rules:**

- **Moods:** 😊 Happy · 😐 Neutral · 😔 Sad · 😡 Angry (default Neutral). Optional **mood note** (≤ 80 chars), e.g. 😊 Happy + “Dinner with family”. Old pages load with an empty note. Mood note is included in page search and global search.
- **Save written page** if there is body **or** photos **or** a voice clip. Voice page needs a recording.
- Title ≤ 80 chars; body ≤ 8000; mood note ≤ 80; ≤ 6 photos; ≤ 8 tags. Suggested tags: `#work` `#health` `#family` `#finance` `#travel`; custom slugs allowed.
- **Place:** phone can attach GPS + reverse-geocoded name; web is a typed name only.
- Page day uses a **calendar date picker** (not typed YYYY-MM-DD).
- Open a page to edit; **Release** moves it to Recently deleted (30 days), then media is dropped.
- Compose and page detail are **journal only** — no spend or income fields, and saving a page does not open Money.

### Global search

**What:** One on-device search over pages, reminders, and spends.

**Where:** Today search icon, Pages, or You → Search (all open Pages).

**Rules:** Keywords match page title + body + mood note + tags, reminder title + note + category path, spend note + category + amount. Filters: All / Pages / Reminders / Money. Hits open the page, reminder, or Money. Page-only mood/tag/date filters still apply on the Pages timeline. Pure filter in Model — no ranking theater.

### Reminders

**What:** Local nudges. List grouped Today / Tomorrow / This week / Later / No upcoming. Filter by top category **icons**. Toggle On. Circular **complete** checkbox marks a reminder done for today (haptic + strikethrough); completed rows fold into **Completed today**. Add from Ionicons **template cards** (icon + one short word).

**Who:** Planner. List under Calendar; shortcuts from You and Money (“Remind me”).

**List:** Category filters are **icon-only 44pt chips** (Ionicons) so Vehicle and the rest wrap without clipping. VoiceOver still says the type (Car / 按揭). Empty list: “Nothing here yet” + **Add a reminder**. If OS permission is off, a banner: “Allow notifications in system settings so Halo can ping you.”

**Create flow:** pick a card → short form (title, note, **When**, hour + minute wheels, **Remind me** switch). Only extra fields if she opens **More options**.

**Templates:** Something else · Card bill · Loan · Health · Vehicle · Certification · Subscription · Goal · Follow up · Anniversary · Family · Household — shown as **icon + short word** in a two-column grid (not emoji). **Card bill** opens the credit-card form, not a plain reminder.

**Dates:** calendar picker on the inset well — once / monthly / yearly (and card statement/due days). Not typed YYYY-MM-DD or day-number steppers.

**Time:** two equal 3-row neumorph wheels side by side — **HOUR** (0–23) and **MINUTE** (00–59). Flick or tap; not a NumberStepper. Hour labels follow You → Customize Clock (12-hour vs 24-hour); minutes stay 00–59. Stored `hour` + `minute` persist on the reminder (templates, credit-card pings, next-fire, notifications). One preview line includes minutes (e.g. Every year · Sep 8 · 2:15 AM or 14:15). Next fire is a **footnote under the date**, not inside the wheels. No Material underline; preview and next-occurrence are not stacked in the same cell.

**Recurrence — on the form:** Once · Daily · Weekly (weekday chips) · Monthly · Yearly. No sixth frequency chip (Every N months stays under More options).

**Monthly:** chips **This date · Start of month · End of month**. Helper: *Bills often fall on the first or last day.* This date uses the calendar day (31st clamps to the last day of short months). Start of month is the 1st. End of month is the last calendar day (Feb 28, or 29 in a leap year; 30 or 31 otherwise). Next-fire and notifications use that civil day. Preview: `Every month · last day · 9:00 AM` / `Every month · the 1st · …` / `Every month · the 8th · …`. Yearly/Anniversary stays month+day (no start/end chips).

**Recurrence — More options:** Every N days / weeks / months.

**Kinds — More options:** follow-up · goal · reflection · anniversary as **icon chips** (intent; one scheduler).

**Priority — More options:** low · normal · high · urgent. Calendar month dots use the highest priority due that day.

**Categories (More options, stepped icon chips):**

- **Financial** → Credit Card · Loan (Mortgage / Personal / Car) · Bills (Electricity / Water / Gas / Internet / Mobile) · Investments (Monthly ETF / MPF review / Portfolio review).
- **Health** → Medication · Exercise · Medical (and their types).
- Also: Household · Family · Vehicle · Work · Personal · Other.

**Credit-card multi-ping:** one **card account** (name, statement day, due day, optional amount due, optional outstanding balance) plus child reminders: statement day, due day, optional extras. Due ping is high priority. Card balance counts as debt in net worth; amount due is a cash-flow figure, not a balance-sheet posting. Each ping has hour + minute wheels and an enable switch — **the switch has no visible “Enabled” caption** (`accessibilityLabel` only).

**Log this as a spend** (existing reminder, optional, default off): she taps it when she wants a Money row. Opens **Log a spend** prefilled from the reminder (`reminderId` stored if she saves). Does **not** write a page or open Compose. She can also log the spend later from Money. Creating a reminder never auto-creates a spend.

### Calendar

**What:** One month for **life + money**. Prev/next month. Day cells show mood dot · **reminder type icon** (priority colour) · spend dot.

**Who:** Anyone who thinks in days.

**Rules:** Default view is **Monthly**. First column follows You → Customize **Week starts on** (default Monday; Sunday optional). **Views** is collapsed until tapped (Monthly · Reminders · Pages · Timeline · Money). Selected day lists matching pages, reminders, and spends. Header add follows the view: **Write** (journal), **Add a reminder**, or **Add a spend** — three independent taps, not one mixed form. Empty month day offers the same three links. Tap a spend to edit it. Streak line; Money view also shows this month’s spend total.

### Money

**What:** Personal accounting she types herself. **You → Money currency** is the **home** total (Spent this month) — default **HKD** (also USD, CNY — **no EUR / GBP**). A **new spend’s currency is HKD** unless she picks USD or CNY on that transaction. Changing You currency does not change the spend keypad default.

**Who:** Everyday = simple Money. Extra tools if she turns them on.

**FX (spend → estimated HKD) — shipped:** Log a spend **real-converts** from the cached latest-rate table plus her **card fee %**. **On save**, that conversion is **locked on the expense**. Money, Calendar, Spent this month, and Insights **do not convert again**.

- **Feed:** Frankfurter/ECB `https://api.frankfurter.app/latest?from=USD&to=HKD,CNY`. GET is **currency codes only**. No amounts, notes, or identity. Not a bank API.
- **Card fee:** You → Money, under Money currency — **Card fee when I spend in another currency**: **None · Typical 1.5% · Typical 2% · 3%**. Default **Typical 1.5%**. Stored on `AppSettings.cardFxFeeRate`. Applied at **save** (and one-time backfill). Changing the chip later does not rewrite old spends.
- **Estimate (compose):** `hkdEstimate = convert(amount, from, HKD) * (1 + feeRate)`. Live line e.g. `US$12 ≈ HK$95.90 incl. card 1.5%`. Copy: **Estimated HKD, including card fee.** Never “exact bank charge.” Same-currency **HKD** stays a single amount with no conversion fields.
- **Lock at save:** persist `amount` + `currency` plus `homeAmount` (fee-inclusive HKD), `quoteCurrency: 'HKD'`, `fxRate` (mid HKD per 1 spend unit), `cardFeeRate`, `convertedAt`. That `homeAmount` is “what it cost me.”
- **After save:** list rows show **that row’s** original + locked HKD (e.g. `US$12 ≈ HK$95.90 · dining`). Totals sum stored HKD (or same-currency amount). No live `convertAmount` on saved rows. Opening Money later does not change the number.
- **Legacy rows** without a snapshot: convert **once** on read (using cache, fetch if needed), persist, never again.
- **Cache:** AsyncStorage `halo.finance.fx.v1` `{ base, quotes, fetchedAt }`. 6-hour TTL. Refresh on **Log a spend / foreign save** (and one-time backfill), **not** on every Money/Today mount. Save uses current quotes when they exist; it does not block forever if the feed is down (original amount still stores; snapshot backfills when quotes appear).
- **Offline:** last cache + the fee % at save. Log a spend shows **Rates from {time}.** when the live feed failed. Missing pair → original only until a snapshot can be written.
- **UI:** You currency **HKD** (default): Spent this month / This week / budgets use locked fee-inclusive HKD. Dual line is always ≈ HK$. **What I have minus what I owe** stays unconverted (other currencies listed, not summed).
- **You:** optional **Rates updated …** under Money currency (cached clock; not a Money-list refetch).
- Web and phone both GET over HTTPS.

**Simple (default):** hero **Spent this month** (home-currency total, optional ↑/↓ vs last month when that month has convertible spend, top category + amount — no forecast) · **Add a spend** · one-tap **type icons** (Dining / Transport / Groceries / Bills · currency in a11y) · recurring **today** chips (**1-tap log**; long-press edits) · **Card Health** · recent spends · **Upcoming bills** (enabled Financial reminders, up to 8). **More money tools** unfolds extras for this visit without changing the You setting. Empty spends: a next tap to **Add a spend**.

**Smart Add a spend** (Today or Money, including the chips): amount first — a **calculator**, not a free-text box. Custom keypad (0–9, decimal, backspace, + − × ÷, =, Clear) with a caret-free neumorph well (OS keyboard stays hidden for amount; same pad on web). Quick **+10 / +50 / +100** chips bump the amount. At most two decimal digits; trailing operators are not savable. **Keep this spend** persists the **evaluated number** (e.g. `12+3.5` → `15.5`) and the selected **HKD | USD | CNY** on the amount row (letters; default **HKD** on a new spend). Suggested category from recent spends, time of day, or last merchant-ish note. Optional Same as last time. **Date** picker on the simple form (default today; tap the inset well → calendar). **Recent** chips from local spend history (e.g. “Coffee HK$35”) one-tap prefill amount, category, and note; date stays whatever she picked (or today). **More details** opens all categories, receipts, optional asset, and **Repeat this spend** with frequency chips (**Daily / Weekdays / Weekly / Monthly**). If the spend is not HKD, the live **estimated HKD** line (`US$12 ≈ HK$95.90 incl. card 1.5%`) shows under the keypad. That estimate is **locked on Keep this spend**. HKD spends stay a single amount. Calculator prefs are not on Customize.

**Recurring spend (shipped):** More details → **Repeat this spend** → Daily / Weekdays / Weekly / Monthly. Money and Today show due chips; **1-tap logs** today’s copy (`logRecurringSpendInstant`); long-press opens the editor. Not a full auto-posting schedule engine.

**Card Health** (always, even in simple Money): days-to-due, amount due, statement vs due, green/amber/red **ok · due soon · overdue**. Quiet “No cards yet.” when empty. Tap opens the card form.

**Extra tools** (`showAdvancedFinance`, You → Show extra money tools):

- Default **off** for new users. If she never chose, extras stay **on** only when she already has assets or loans.
- Chips: All · Income · Spends · Budgets · Bills & cards · What I have · What I owe.
- **What I have minus what I owe** = assets − loans − card `currentBalance` in the reporting currency (other currencies listed, not summed; no FX).
- This month in / out. Six-month spend bars.
- **Income:** salary / bonus / other, dated row. Same amount calculator + HKD default as spend. No journal fields on the form.
- **Spends:** amount (calculator → stored number), currency (HKD / USD / CNY), category (Dining / Transport / Groceries / Bills / Health / Other as **icons** on chips and rows), date, note, receipt photos; filters this month / 7d / 30d / all + category. List shows original (e.g. `US$12`) and **locked estimated HKD** `≈ HK$95.90` from that row’s snapshot when the spend is not HKD. Tap a spend (Money list, Calendar day, or search) to **edit the same row** — amount, category, note, date. Changing amount or currency re-locks FX on that save. **Remove this spend** with confirm → Recently deleted. Optional leftover `journalEntryId` / `reminderId` on old rows; the form does not prompt to write a page or add a reminder.
- **Budgets:** one limit per category per month (spent is counted from her spends). Over is a quiet hint — it does not open compose or force a reminder. Today’s quiet cue may still invite a page.
- **What I have:** cash / bank / investment / property as **icon chips**, manual value.
- **What I owe:** mortgage / personal / car as **icon chips**, manual balance; may join a loan reminder.

Not double-entry. No bank feed. No amortization.

### Weekly summary, On this day & Photo Memories

**Next up** (Today): nearest enabled reminder or card bill. Title, due status **Overdue > Today > Tomorrow > Future**, optional amount due. Tap opens the reminder or card form. Reminder rows expose a circular **1-tap complete** checkmark (haptic) without leaving Home.

**Due today strip + quick mood** (Today): horizontal chips for due recurring spends and due habits; 1-tap log/complete with toast. Soft 5-slot mood bar (Radiant / Calm / Neutral / Foggy / Low) maps onto the four MoodIds and saves a mood page with optional one-line note.

**This week** (Today compact and You fuller):

- Range follows You → Customize **Week starts on** (default **Monday** — HK-first). Calendar month grid uses the same setting. Sunday is optional.
- Journal: days written, total entries, word count, most used tag, top mood.
- Reminders: completed, remaining, overdue.
- Money: spend total (home currency), top category, largest expense.
- Compact example: “4 pages written / 😊 Mostly Happy / HK$1,250 spent / 3 reminders completed”. No charts.

**On this day** (Today): up to 3 journal pages from **previous years** on the same month/day. Photos first. No AI. Hidden when empty. “1 year ago” + title + mood. Tap opens the page.

**Photos / Reels** (`/memories`, You → More → Photos): photos already on journal pages, grouped by month; filters All / This Month / This Year. Tap a photo for a **private full-screen reel** (vertical snap; Reduce Motion uses a crossfade). Caption is the page date and mood (mood note when she wrote one). Open page from the reel. Empty: one sentence + **Write today**. Journal photos only — not a vault, not Instagram/TikTok, no share/follow/comments. Stays on this phone.

**Quiet cue on Today:** one gentle line — “Want to add one line about today?” — when a budget is over, or she has not written this week and today is Thu–Sun. Reuses the daily prompt catalog. Opens **compose only** (a journal invitation, not a spend). `dailyPromptEnabled` has no You toggle.

**Life areas** (You → How you’ve been): percent bars derived from tags `#work` `#health` `#family` `#finance` `#travel` (+ other). No setup screen.

### Customize (**shipped**)

**What:** Tasteful on-device preferences under **You**, not a sixth tab. Card sits under Look.

**Rules:**

- **Look** stays Paper / Midnight / System (separate card above Customize).
- **Text size** — Settings → Appearance (with Look and Language): **System · Small · Default · Large · Extra Large**. Default **System** (uses OS `fontScale`, clamped ~0.85–1.35). Presets are fixed multipliers (0.88 / 1.00 / 1.16 / 1.32). Live neumorphic preview card shows sample title, body, and date at the selected scale. Stored on `AppSettings.fontSizePreference`. `TypographyProvider` + `createTypography` scale large titles, nav titles, grouped rows, chips, and HIG roles app-wide without breaking neumorphic layout.
- **Quick Spend Enhancement (shipped)** — ultra-fast expense logging that fully honours the Appearance text-size preference and the accessibility bar. **Quick Spend Sheet** (`QuickSpendSheet`, opened from the Today FAB or the Money **Quick spend** button): bottom-sheet modal with five 1-tap sections — **Smart Suggestion** (category + amount + card from `suggestQuickAdd` Smart Defaults), **Recent Spends** (horizontal history chips), **One-Tap Templates** (Morning Coffee / Lunch / MTR grid), **Voice Quick Add** (OS keyboard dictation into a plain field, parsed live on-device by `parseVoiceSpend` across en / zh-Hant / zh-Hans / ja — no network, no ML model, no new native dependency), and an **Amount-First Keypad** (minimal digit pad reusing Model `applyCalcKey`; digits + decimal + clear/backspace only). **Inline Home Quick Add** (`InlineHomeQuickAdd`): compact bar on Today Home under the greeting — amount input with currency badge, category chips, 1-tap templates, and a voice toggle. **Log a spend** gains a Quick Spend mode (`/expense/new?mode=quick`) that pre-fills Smart Defaults (suggested amount / currency / card) and offers the same one-tap templates. All paths converge on Controller `createQuickExpense` / `createVoiceExpense`, so FX locking and validation stay in one place. Every control carries an ARIA role/label (buttons, radiogroup category chips, `accessibilityViewIsModal` sheet), tap targets stay ≥44pt, and all font sizes scale through `useTypography()` — Large / Extra Large presets never clip the keypad, templates, or chips. Localized `en` / `zh-Hant` / `zh-Hans` / `ja`.
- **Reminder sound** — On = phone default ping; Off = silent banner. Persisted in `AppSettings`. Native scheduling uses expo-notifications `sound: 'default'` or `null` (Android also uses a silent channel). Changing sound reschedules enabled reminders. Web saves the toggle; OS notifications do not fire.
- **Haptics** — On = light tap on tab switches, save, and PIN keys (`hapticLight` / `hapticSuccess` no-op when off).
- **Clock** — 12-hour vs 24-hour labels on the reminder **hour** wheel only (stored hour stays 0–23; minutes are always 00–59).
- **Week starts on** — Sunday or Monday. Default **Monday** (HK-first; Today/You This week was already Mon–Sun). Calendar used to be Sunday-first via `Date.getDay()`; both the month grid and This week now share `AppSettings.weekStart`. Helper: “First day on the calendar, and what This week means.” Not ISO week numbers.
- No ringtone pickers, equalizers, extra sliders, quiet hours, date format, or extra themes.
- **Card fee** lives under You → Money (with Money currency), not here.

### Privacy (**shipped**)

**What:** **You → More → Privacy** (footer **This stays on this phone**, and first-run extra line): “This stays on this phone. No cloud account.” Camera, mic, notifications, and place are asked **only when she taps those actions** — not when the app opens.

### Recently deleted (**shipped**)

**What:** Released pages and removed spends stay on this phone for **30 days**, then media is dropped. **You → More → Recently deleted** → Restore.

**Who:** Undo a Release or Remove without a cloud bin.

### Backup (**shipped**)

**What:** Save a password-locked copy of life + money on this phone, or restore from a file. Not a cloud account.

**Who:** Moving phones, or keeping a file in Files / Downloads.

**Rules:**

- **You → Backup → Export** — she sets a backup password (min 6, type it again). Halo writes `halo-backup-YYYY-MM-DD.halo`. She must remember that password for a new phone; Halo cannot recover it. After a successful save, You → Backup shows **last backup date/time** plus journal, reminder, and spend counts from that moment (`lastBackupAt` + counts only). Never the password, encryption key, or backup file contents.
- **You → Backup → Export spreadsheet (CSV)** — readable page titles + spends (not encrypted). Optional beside the locked `.halo`. **No PDF.**
- File starts with magic `HALO1`, then an opaque wrapper `{ v, kdf, iter, salt, iv, ciphertext }` (base64). Inner JSON is never written in the clear.
- Encryption: her password → PBKDF2-SHA256 (210k iterations) → AES-256-GCM. No hardcoded app secret. Without the password the file is useless; Halo does not keep the password.
- Inner document (after decrypt): `{ version: 1, exportedAt, journal, reminders (including credit-card accounts), finance (expenses, income, budgets, assets, loans, recurring spends), settings }`. **PIN / secure-store secret is never exported.** Settings may carry last-export time + counts (not a password). Photo and voice **files** stay on the phone that made them (URIs only).
- **Import** — pick a file, enter the password, decrypt and validate, then confirm **“This replaces what’s on this phone.”** Wrong password: clear error, nothing is written. Replace-only (no merge).
- After import, reminder notifications are rescheduled on the phone. Web has no OS pings.

### Lock + notifications (**shipped**)

**Lock:** You → App lock — Off / PIN / Face ID or fingerprint (phone). PIN is 4–6 digits, never in settings JSON.

- **Phone:** PIN in the secure keystore. Biometrics when hardware is enrolled; they fall back to PIN.
- **Web:** same You-tab chips; PIN lives in AsyncStorage and **does verify**. Biometrics unavailable (chip stays off).
- **Lock after** (shown only when lock is PIN or biometrics): **Right away** · **1 minute** · **5 minutes** (0 / 60 / 300 seconds). Helper: “How soon Halo covers the screen when you leave.” Default **1 minute** (the previous ~60s re-lock). Hidden when lock is Off.

**Overlay / session:** a full-screen overlay sits on top of the app when lock is on and this session is locked. **Fail-closed:** while lock is on and the PIN probe has not finished, Halo treats the session as locked (splash stays until settings + PIN state are known) so pages/money never flash unlocked. Cold start with a stored PIN stays locked. Correct PIN (or biometrics) **unlocks the session and returns her to Today/tabs** — the overlay dismisses. Wrong PIN stays locked with “That PIN does not match.” Turning lock on does **not** immediately re-lock the session she is already in (so PIN setup is not buried). When she switches apps, Halo uses the existing background AppState timer: **Right away** locks as soon as the app goes to background (lock on blur); **1 minute** / **5 minutes** re-lock when she returns if she was away that long.

**Backup restore:** importing a backup that had lock on does **not** enable lock unless this device already has a PIN.

**Notifications (phone):** OS local notifications for enabled reminders. Permission (`POST_NOTIFICATIONS` on Android 13+) is requested when the first enabled reminder is scheduled — not at cold start with an empty list. Sound vs silent comes from You → Customize. List banner if permission is off. **When App Lock is on**, scheduled tray copy is privacy-safe (`Halo reminder` / `Tap to open Halo`, localized) so medical or money notes do not sit on the OS lock screen; full titles stay inside the unlocked app. When App Lock is off, the friendly reminder title/note is used.

**Android backups:** `android.allowBackup` is **false** so Google Drive Auto Backup does not copy plaintext AsyncStorage / journal JSON. Photos and voice live in the app document folder (`halo-media/`), not the public gallery. Her only intentional off-phone copy is the password-locked `.halo` file.

**Web:** notifications do not fire; she can still create and edit reminders.

---

## 6. Quality bar (**shipped**)

These are product rules, not a later polish pass:

| Bar | What shipped |
| --- | --- |
| **Empty lists** | Quiet sentence + one next tap (Add a spend, Add a reminder, Write, restore). Halo does not invent numbers. |
| **Errors** | Short human copy (`humanError`) — never a stack trace. Wrong backup password writes nothing. |
| **Notifications** | Local pings fire on the phone. Android 13+ permission on first enabled reminder, not at launch. |
| **Lock** | PIN / biometrics overlay; trusted session; Lock after (Right away / 1 minute / 5 minutes) on background. Fail-closed cold start (no content flash before PIN probe). |
| **Backup** | Password-locked `.halo` she keeps; copy that she must remember the password for a new phone. Optional CSV. Android `allowBackup: false`. |
| **Privacy** | You → Privacy + first-run “No cloud”. Permissions on tap, not launch. Lock-on → redacted reminder tray text. |
| **Store polish** | Tap targets ~44pt; Reduce Motion skips decorative gradients; everyday labels wrap or shrink so larger system text still fits. |
| **Permissions** | Camera, mic, notifications, and place asked only when she uses those actions. |

---

## 7. Cross-module flows

| Flow | What happens |
| --- | --- |
| **Write a page** | Today Write / Record, Pages, Calendar Write, or quiet cue → compose (mood, photos, voice, tags). Journal only. |
| **Add a reminder** | Calendar / You / Money “Remind me” → reminder form. Reminder only. Optional later: **Log this as a spend** on that reminder. |
| **Log a spend** | Today / Money Add a spend (or Calendar Add a spend) → spend form (calculator amount default HKD, category, note, date, +10/+50/+100). Spend only. Optional **Repeat** (Daily / Weekdays / Weekly / Monthly). Money / Today due chips **1-tap log**. |
| **Edit a spend** | Money list, Calendar day spend, or search Spend hit → `/expense/[id]` same form. Save updates that id. Remove with confirm → Recently deleted. |
| **Log this as a spend** | Existing reminder → spend form prefilled (`reminderId` if she saves). No compose. |
| **Calendar life + money** | Same month grid: moods, dues, spends. Open page, reminder, or spend independently. |
| **Today → next reminder** | Next up card: nearest enabled fire (overdue first); tap opens the reminder or card; checkmark completes a reminder for today. |
| **Today → on this day** | Prior-year page on the same month/day; tap opens that page. |
| **You → Photos (reel)** | Month grid of journal photos; tap opens a private full-screen reel (her pages only). Open page from the reel. |
| **Money upcoming** | Enabled Financial reminders (up to 8) + credit cards. |
| **Backup file** | You → Backup → Export (password) writes an encrypted `.halo` file; last-export metadata (time + counts) is stored on this phone. Import decrypts then replaces this phone. CSV is a readable extra. |
| **Recently deleted** | Release a page or remove a spend → You → Recently deleted → Restore (30 days). |

The three primary adds do not require or auto-create each other. Joins are optional leftover IDs on old rows — not a general join of life and money.

---

## 8. Shipped vs later vs do not add

Honest against the current app. **Should-have** items that already exist are marked shipped.

| Priority | Item | Status |
| --- | --- | --- |
| P0 | Empty lists with a next action | **Shipped** |
| P0 | Reminder notifications fire; Android 13+ permission on first enabled reminder | **Shipped** |
| P0 | App lock (PIN / biometrics) and password-locked `.halo` backup | **Shipped** (fail-closed PIN probe + splash gate) |
| P0 | Backup password copy (“remember it for a new phone”) | **Shipped** |
| P0 | You → Privacy; first-run “No cloud” | **Shipped** |
| P0 | Permissions on tap, not launch | **Shipped** |
| P0 | Android `allowBackup: false` (no OS cloud leak of plaintext stores) | **Shipped** |
| P0 | Lock-on reminder notifications use privacy-safe tray copy | **Shipped** |
| P0 | You → Customize (sound, haptics, 12h/24h, week start) | **Shipped** |
| P0 | You → Appearance → Text size (System / Small / Default / Large / Extra Large + live preview) | **Shipped** |
| P1 | Recently deleted (30 days, pages + spends) | **Shipped** |
| P1 | Recurring spend (Daily / Weekdays / Weekly / Monthly; Money/Today 1-tap log) | **Shipped** |
| P1 | CSV spreadsheet export beside `.halo` | **Shipped** |
| P1 | Accessibility: ~44pt taps, Reduce Motion, larger-text wrap/shrink | **Shipped** |
| — | FX latest rates (Frankfurter/ECB, HKD/USD/CNY, cache, estimated HKD + card fee %, **conversion locked at save**) | **Shipped** |
| P1 | Android home-screen widget | **Skipped** (not in Expo 57) |
| P1 | PDF export | **Skipped** (CSV only) |
| Later | Net worth over time chart | **Stub** — “coming later.” No history store. |
| Later | Historical ECB date-series FX, extra currencies (EUR/GBP) | **Not built** |
| Later | Photo/voice **files** inside the backup | **Not built** (URIs only) |

### Do not add

- Cloud accounts, sync, or sharing
- Instagram / TikTok-style social reels (follow, comments, collaboration, public feed)
- Bank / card login, open banking, Plaid, payroll
- OCR, credit score, investment cockpit
- Document vault
- Chatbot / AI recap
- Collaboration / multi-user
- Watch app
- Double-entry, chart of accounts, depreciation/amortization

---

## 9. Non-goals (out of scope)

- No bank / card APIs. Public latest FX quotes only (not ECB date-series, not bank FX). Conversion is **locked per spend at save**. Card fee is a **percentage she picks**, not an issuer settlement.
- No cloud, account, or sync. Backup is a password-locked file she keeps — not a Halo service.
- No double-entry, chart of accounts, or depreciation/amortization.
- Not a social or shared journal. **Reels** means a private on-device viewer of her journal photos — not a social feed.
- Halo does not invent numbers: empty lists stay empty.
- No document vault, AI chat, OCR, credit score, portfolio management, bank login, watch, or collaboration.

---

## 10. Platforms

| Platform | Role |
| --- | --- |
| **Android & iOS** | Primary. Camera, mic, GPS, Face ID / fingerprint, OS notifications. Expo 57 / React Native. Shared **iOS grouped** chrome (not Material-only). Sideload APK: `npm run apk` or `scripts/build-apk.ps1` (EAS preview) — see README. |
| **Web** | Preview / develop (`npm start` then `w`). Same IA; native features stubbed. |

Storage keys: journal, settings, reminders, finance, **FX rates**, Recently deleted in AsyncStorage; PIN key in secure store (native) or AsyncStorage (web). Encrypted backup files stay wherever she saved them (Downloads / Files / share sheet).

---

## 11. Architecture (MVC)

Keep layers thin and reusable:

- **Model** — domain rules only (`src/model`): entries, moods, reminders, finance, `amountCalculator` (shop keypad → evaluated money), `FxRateTable` / `convertAmount` / `formatSpendLine` (live on compose; **snapshot on saved rows**), trash, backup crypto, `AppSettings`. No HTTP, no React.
- **Data** — persistence and I/O (`src/data`): AsyncStorage adapters, `FxRateClient` + `FxRateStore`, notification scheduling, backup file pick/share.
- **Controller** — orchestration (`src/controller`): `JournalController`, `FinanceController`, `FxRateController.refreshRates()`, providers. Thin; no UI chrome.
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

**Hidden / leftover:** How you’ve been is not a tab. Daily prompts appear only as a quiet Today line when a budget is over or the week is still empty late in the week. On this day hides when there are no prior-year pages.

**Limits that are intentional:** one reporting currency for net worth (no FX there); card `amountDue` is not net-worth debt; expense `accountId` can tag an asset but does not move a bank balance.

**Stub only (extra money tools on):** “Net worth over time — coming later.” No history store yet.

**Skipped:** Android home-screen widget (not in Expo 57). PDF export. Document vault (high risk; not day-1).
