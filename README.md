# Halo — Private Life + Money Companion

[![Platform](https://img.shields.io/badge/Platform-iOS%20%7C%20Android%20%7C%20Web-blue.svg)](https://reactnative.dev/)
[![Expo SDK](https://img.shields.io/badge/Expo-SDK%2057-black.svg)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React%20Native-0.86-61DAFB.svg)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Privacy](https://img.shields.io/badge/Privacy-100%25%20On--Device-success.svg)](#privacy-first-guarantee)
[![Tests](https://img.shields.io/badge/Tests-Node%20Test%20Runner-brightgreen.svg)](#automated-testing)

A private on-device life + money companion for one person. Open it, write a page, set a reminder, optimize your credit card rewards, or log an expense — then you’re done. 

Built with soft tactile neumorphism (raised cards, inset wells, clay buttons, floating tab pills); Fraunces + Outfit typography. **No cloud account, no sharing, no bank login, no tracking.** Everything stays on your phone.

Product contract: **[FUNCTIONAL_SPEC.md](./FUNCTIONAL_SPEC.md)**.

---

## Highlights & Features

### 💳 Credit Card Rewards & Rebates Engine
- **Bank Grouping & Card Presets**: Categorize cards by financial institution with built-in presets for popular Hong Kong banks (HSBC, Hang Seng, Standard Chartered, DBS, Citi, Bank of China, etc.).
- **Tiered Category Rebates**: Configure category-specific cashback rules, monthly spend/rebate caps, and minimum monthly spend requirements.
- **Priority-Based Rule Precedence**: Reorder category rebate rules with 1-tap up/down controls so list order directly governs rebate precedence.
- **Paired Billing Cycle Widget**: Track statement day and payment due day with an interactive 1–31 day stepper, visual month-line progress track, and automatic grace period calculation.
- **Spend Simulator & Smart Card Recommendation**: Real-time cashback calculation preview and automated recommendation of the highest-earning card for any spend amount and category.

### ⚡ Rapid Expense Tracking & Quick Spend
- **Compact 3×4 Calculator**: Screen-efficient keypad with tap-to-expand amount hero, arithmetic operators, and currency conversion.
- **Quick Spend Sheet**: 1-tap modal featuring smart suggestions, recent spend history chips, one-tap templates (Coffee, Lunch, Commute), and voice quick add.
- **On-Device Receipt Photo OCR**: Capture receipt photos or attach invoices to automatically recognize text and populate merchant, total, and items into expense descriptions—100% on-device without cloud transmission.
- **Foreign Exchange Locking**: Real-time currency conversion (HKD / USD / CNY / EUR / GBP / JPY) with foreign transaction fee calculation, locking the home currency estimate at transaction time.

### 🤝 Fair Bill Splitting & Account Transfers
- **Split Expense Flow**: Equal mode with **largest-remainder cent distribution** (e.g. $100 split 3 ways is $33.34, $33.33, $33.33) or custom allocation, complete with settlement status tracking.
- **Account Transfers & Credit Card Repayments**: Transfer funds between cash, bank accounts, and loans, or make credit card repayments with live balance updates.

### 📖 Journal & Daily Reflections
- **Rich Daily Entries**: Markdown formatting, 4-tier mood ratings (😊 Neutral, Happy, Low, Stressed), mood notes, hashtags, and voice clips.
- **Photo Memories Reel**: Private full-screen reel of journal photos grouped by month and year.

### ⏰ Reminders & Habit Loops
- **Flexible Recurrence**: Daily, weekday-only, weekly, and calendar-clamped monthly schedules (e.g. month-end or specific days).
- **1-Tap Fast Loops**: Today recurring strip and Next Up action card on Home for single-tap completion.

### 🔒 Security, Trust & Offline Integrity
- **App Lock**: Biometric authentication (Face ID / Touch ID / Fingerprint) and PIN lock with customizable auto-lock timeouts (Immediate, 1 min, 5 min).
- **Encrypted Backup & Restore**: Password-locked `.halo` files encrypted with PBKDF2 key derivation and AES-GCM encryption. Halo never stores your backup password.
- **Readable CSV Export**: Export journal entries and expenses to CSV spreadsheets for personal records.
- **Zero OS Cloud Leaks**: Configured with `android.allowBackup: false` so device cloud syncs never copy unencrypted database files.

### 🌐 Internationalization & Accessibility
- **4 Languages Supported**: English (`en`), Traditional Chinese (`zh-Hant`), Simplified Chinese (`zh-Hans`), and Japanese (`ja`) with 100% key parity.
- **Dynamic Typography Scaling**: 5 typography presets (**System**, **Small**, **Default**, **Large**, **Extra Large**) that cleanly scale UI cards, headers, and inputs.

---

## Architecture & Code Standards

Halo adheres to a strict **Model-View-Controller (MVC)** architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                      View Layer (UI)                        │
│   Screens (app/, src/view/screens) · Components (src/view)  │
│   Neumorphic Design System · Theme Tokens · Typography      │
└──────────────────────────────┬──────────────────────────────┘
                               │ Orchestrates via hooks
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   Controller Layer (State)                  │
│   FinanceProvider · JournalProvider · ReminderProvider      │
│   SettingsProvider · LockProvider · FxRateProvider          │
└──────────────────────────────┬──────────────────────────────┘
                               │ Dispatches pure domain logic
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  Model Layer (Domain Logic)                 │
│   Pure Domain Engines (CreditCardRebates, ExpenseSplit, FX) │
│   Entity Types · Normalizers · Cryptography · OCR Parsers   │
└──────────────────────────────┬──────────────────────────────┘
                               │ Reads/Writes persisted state
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer (I/O)                       │
│   AsyncStorage · Platform Media Store · Backup I/O          │
└─────────────────────────────────────────────────────────────┘
```

- **Model (`src/model`)**: Pure domain logic, zero React Native UI dependencies. Fully testable in plain Node.js.
- **Controller (`src/controller`)**: Thin orchestration facades and React context providers managing lifecycle and persistence.
- **View (`src/view`, `app/`)**: Presentation only. Clay surfaces, inset wells, haptic feedback, and responsive layout.
- **Platform Separation**: Hardware-specific features isolate native modules in `*.native.tsx` and web fallbacks in `*.web.tsx` to prevent cross-platform bundle crashes.

---

## Project Structure

```
privateLifeManagementApp/
├── app/                        # Expo Router file-based routes
│   ├── (tabs)/                 # Main tabs: Today, Pages, Calendar, Money, You
│   ├── compose.tsx             # Journal entry creation
│   ├── spend/                  # Expense logging & edit modal
│   ├── transfer/               # Account transfer & card repayment modal
│   └── _layout.tsx             # Root layout, theme chrome, providers
├── src/
│   ├── config/                 # App configuration & constants
│   ├── controller/             # MVC Controllers & React Context Providers
│   ├── data/                   # Storage adapters (AsyncStorage, mediaStore, backupIO)
│   ├── model/                  # MVC Domain Models & Pure Engines
│   │   ├── backup/             # PBKDF2/AES-GCM encryption & serialization
│   │   ├── finance/            # Expense, rebates, split, FX, transfers
│   │   ├── journal/            # Journal entries, photo memories, search
│   │   ├── ocr/                # Receipt parsing & on-device OCR engines
│   │   ├── reminders/          # Reminders, recurring rules, card accounts
│   │   └── settings/           # App settings & language resolution
│   ├── utils/                  # Haptics, dates, formatting, navigation
│   └── view/                   # MVC Views & UI Components
│       ├── components/         # Reusable clay cards, chips, buttons, steppers
│       ├── i18n/               # Localization catalogs (en, zh-Hant, zh-Hans, ja)
│       ├── icons/              # Type glyphs & icon mappings
│       ├── screens/            # Screen presentations
│       └── theme/              # Typography provider, color tokens, clay surfaces
└── scripts/                    # Automation scripts (setup, emulator, metro, apk)
```

---

## Prerequisites

- **Node.js 20.18+** (`package.json` engines: `>=20.18.0`)
- **npm** (bundled with Node.js)
- **Android Studio** (Android SDK + AVD) *optional — only needed for emulator or local Android debug APK; web preview requires no native tools*
- Optional: JDK 17 for local Gradle builds
- Optional: Free Expo account for cloud EAS builds (`npx eas-cli login`)

---

## Quick Start & Local Setup

### 1. New Machine Setup
Clone the repository, open the `privateLifeManagementApp` directory, and run the automated setup script:

**Windows (PowerShell):**
```powershell
cd privateLifeManagementApp
powershell -ExecutionPolicy Bypass -File .\scripts\setup-dev.ps1
```
*Tip: Pass `-InstallTools` to automatically install missing Node.js or OpenJDK 17 via winget.*

**macOS / Linux:**
```bash
cd privateLifeManagementApp
chmod +x ./scripts/*.sh
./scripts/setup-dev.sh
```

### 2. Start Metro Bundler (port 8081)
Starts the Expo/Metro development server on `http://localhost:8081`:

```bash
npm run metro
# or npm run start:8081
```
Press `w` in the terminal to open the web preview, or scan the QR code with **Expo Go** on your physical phone.

### 3. Run on Android Emulator
Boots an Android Virtual Device (AVD) and starts Expo:

```powershell
npm run emu
```
*Custom AVD:* `powershell -ExecutionPolicy Bypass -File .\scripts\start-emulator.ps1 -Avd Your_AVD_Name`

### 4. Build Android APK (Sideload Preview)
Build a standalone preview APK via EAS Cloud:

```bash
npm run apk
```
*(Local Gradle fallback: `.\scripts\build-apk.ps1 -LocalDebug`)*

---

## Automated Testing

Halo features an automated test runner built with Node.js native `node:test` and `tsx`, requiring zero Jest or Babel overhead. All domain models and crypto routines are covered:

```bash
npm test
```

Test coverage includes:
- **Credit Card Rebates**: Category rates, DBS/Citi/HSBC minimum spend thresholds, monthly spend/rebate cap overflows, bank promotion registrations, and card ranking.
- **Expense Split Math**: Largest-remainder cent allocation across varying party sizes and settlement state tracking.
- **FX Rates & Locking**: Mid-market rate triangulation, conversion evaluation, and foreign transaction fee snapshot locking.
- **Calendar & Recurrence**: Monthly day clamping (Feb 28/29, 30th/31st), weekday rules, and next-fire schedules.
- **Backup & Encryption**: PBKDF2/AES-GCM encryption round-trips, wrong-password rejection, and sensitive data stripping (PINs are never exported).

To verify TypeScript type safety across the entire codebase:
```bash
npx tsc --noEmit
```

---

## Uploading to GitHub

This directory is already configured as a git repository connected to `https://github.com/dereklee0406/privateLifeManagementApp.git`.

### Push Changes to GitHub:

Open your terminal in `privateLifeManagementApp`:

```bash
# 1. Navigate to privateLifeManagementApp directory
cd c:\GitLab\privateLifeManagementApp

# 2. Check git status
git status

# 3. Stage all project files (node_modules, credentials, and caches are already ignored)
git add .

# 4. Commit your changes
git commit -m "feat: complete Halo life + money companion with credit card rebates and receipt OCR"

# 5. Push to GitHub main branch
git push origin main
```

---

## Privacy-First Guarantee

Halo operates under a strict privacy contract:
- **No Remote Servers**: Your entries, financial transactions, reminders, and notes live exclusively in your phone's secure local sandbox.
- **No Account Needed**: No registration, no email address, no phone number.
- **No Third-Party Analytics**: No telemetry, crash reporters, or behavioral tracking SDKs.
- **Encrypted Portability**: Your data can be exported only when you explicitly choose to, protected by an encryption password that only you know.

---

## License

This project is open source and available under the [MIT License](LICENSE).
Copyright (c) 2026 Halo Contributors.
