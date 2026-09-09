<#
.SYNOPSIS
  Build a sideloadable Android APK for Halo (package com.halo.journal).

.DESCRIPTION
  Preferred path (default): EAS cloud preview APK.
    Output: Expo prints a download URL (also on expo.dev). Not a local file.

  Local fallback (-LocalDebug): Gradle debug APK if Android SDK + JDK are installed.
    Output: android\app\build\outputs\apk\debug\app-debug.apk

  Sideload the preview/debug APK (allow unknown sources). No Play signing.

  Does not create or commit a keystore. Does not store Expo credentials.
  Do not run assembleRelease unless YOU supply a keystore (never commit one).

  Local Gradle needs:
    JAVA_HOME  — JDK 17 (Expo SDK 57 / RN 0.81+)
    ANDROID_HOME or ANDROID_SDK_ROOT — Android SDK

.PARAMETER LocalDebug
  Skip EAS; run expo prebuild + gradlew.bat assembleDebug.

.EXAMPLE
  .\scripts\build-apk.ps1
  .\scripts\build-apk.ps1 -LocalDebug
#>
[CmdletBinding()]
param(
  [switch]$LocalDebug
)

$ErrorActionPreference = 'Stop'

# Purpose: resolve mobileApp whether invoked from repo root or this folder.
$AppRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $AppRoot

Write-Host ('Halo APK — {0} (com.halo.journal)' -f $AppRoot)
Write-Host ''

function Test-Cmd {
  param([string]$Name)
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Fail {
  param([string]$Message)
  Write-Host $Message -ForegroundColor Red
  exit 1
}

if (-not (Test-Cmd 'node')) {
  Fail 'Node.js is required (20.18+ for Expo SDK 57). Install from https://nodejs.org then re-run.'
}

$nodeMajor = [int](node -p "process.versions.node.split('.')[0]")
if ($nodeMajor -lt 20) {
  Write-Warning ('Node {0} detected; Expo SDK 57 expects Node 20+. Continuing anyway.' -f $nodeMajor)
}

if (-not (Test-Cmd 'npm')) {
  Fail 'npm is required (ships with Node.js).'
}

if (-not (Test-Path (Join-Path $AppRoot 'node_modules'))) {
  Write-Host "Installing npm dependencies..."
  npm install
}

# npx fetches eas-cli into the npx cache; nothing is committed.
# First-time EAS: create a free Expo account, then:  npx eas-cli login
# This script never writes tokens or keystores into the repo.
Write-Host 'Expo account: first time run  npx eas-cli login  (credentials stay in your user profile, not git).'
Write-Host ''

if ($LocalDebug) {
  # --- Optional local path (Android SDK). Debug-signed; fine for her phone. ---
  $sdk = $env:ANDROID_HOME
  if (-not $sdk) { $sdk = $env:ANDROID_SDK_ROOT }
  if (-not $sdk) {
    Fail 'ANDROID_HOME or ANDROID_SDK_ROOT is not set. Install Android Studio / SDK, or omit -LocalDebug to use EAS cloud.'
  }
  if (-not $env:JAVA_HOME) {
    Write-Warning 'JAVA_HOME is not set. Gradle needs JDK 17. Set JAVA_HOME if the build fails.'
  }

  Write-Host 'Local debug APK: prebuild + assembleDebug (no release keystore).'
  npx --yes expo prebuild --platform android --non-interactive

  $gradlew = Join-Path $AppRoot 'android\gradlew.bat'
  if (-not (Test-Path $gradlew)) {
    Fail 'android\gradlew.bat missing after prebuild.'
  }

  Push-Location (Join-Path $AppRoot 'android')
  try {
    & .\gradlew.bat assembleDebug
  } finally {
    Pop-Location
  }

  $apkDir = Join-Path $AppRoot 'android\app\build\outputs\apk\debug'
  Write-Host ''
  Write-Host ('Local debug APK folder: {0}' -f $apkDir)
  Write-Host 'Typical file: app-debug.apk — copy to her phone and install (unknown sources).'
  exit 0
}

# --- Preferred: EAS cloud preview APK (standalone; she does not need Metro). ---
# Profile "preview" in eas.json: android.buildType apk, internal distribution.
# Profile "development" is a Dev Client (needs the bundler) — not for sideloading to her.
# Profile "production" is an AAB for Play, not an APK.
Write-Host 'Starting EAS preview APK (cloud). This can take 10–20 minutes.'
Write-Host 'If this fails with auth:  npx eas-cli login'
Write-Host ''

npx --yes eas-cli whoami
if ($LASTEXITCODE -ne 0) {
  Fail 'Not logged in to Expo. Run:  npx eas-cli login   then re-run this script. Free Expo account is enough for preview APKs.'
}

npx --yes eas-cli build -p android --profile preview
if ($LASTEXITCODE -ne 0) {
  Fail 'EAS build did not start. First project: npx eas-cli init  (links slug halo-journal). Then retry.'
}

Write-Host ''
Write-Host 'EAS APK: download the URL the CLI printed (expo.dev → your project → Builds).'
Write-Host 'Install on her phone (allow install from this source). Preview APK is not Play-signed.'
