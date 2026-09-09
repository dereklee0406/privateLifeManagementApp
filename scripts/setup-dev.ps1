<#
.SYNOPSIS
  Bootstrap a Windows PC to develop Halo (Expo / React Native) after git clone.

.DESCRIPTION
  Purpose: verify (and optionally install) the tools a new machine needs, then
  npm install so `npm start`, `npm run emu`, and `npm run apk` can run.

  Inputs:
    -InstallTools   Optional. If Node or JDK 17 is missing, try winget
                    (OpenJS.NodeJS.LTS, Microsoft.OpenJDK.17). Falls back to
                    Chocolatey if winget is absent. Never silently downloads
                    random binaries. Never auto-installs Android Studio.

  Outputs: checklist on the console; exit 0 if npm install succeeded.

  Side effects: may run winget/choco (only with -InstallTools), always runs
  npm install in mobileApp, may refresh PATH for this session. Does not run
  eas login. Does not write tokens, keystores, or secrets.

  Design: Expo/EAS stay on npx (no global CLI). Android Studio is checked
  only — it is a large IDE; install it yourself for emulator / local APK.

.PARAMETER InstallTools
  Attempt winget (or choco) for Node LTS and OpenJDK 17 if missing.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\scripts\setup-dev.ps1
  powershell -ExecutionPolicy Bypass -File .\scripts\setup-dev.ps1 -InstallTools
#>
[CmdletBinding()]
param(
  [switch]$InstallTools
)

$ErrorActionPreference = 'Stop'

# Purpose: resolve mobileApp whether invoked from repo root or this folder.
$AppRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $AppRoot

Write-Host ('Halo setup - {0}' -f $AppRoot)
Write-Host ''

$script:WarnCount = 0
$script:HardFail = $false

function Test-Cmd {
  # Purpose: true if a command is on PATH.
  # Inputs: $Name. Outputs: bool. Side effects: none.
  param([string]$Name)
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Write-Ok {
  param([string]$Message)
  Write-Host ('  OK    {0}' -f $Message) -ForegroundColor Green
}

function Write-WarnItem {
  param([string]$Message)
  $script:WarnCount++
  Write-Host ('  WARN  {0}' -f $Message) -ForegroundColor Yellow
}

function Write-FailItem {
  param([string]$Message)
  $script:HardFail = $true
  Write-Host ('  FAIL  {0}' -f $Message) -ForegroundColor Red
}

function Write-Hint {
  param([string]$Message)
  Write-Host ('        {0}' -f $Message) -ForegroundColor DarkGray
}

function Refresh-SessionPath {
  # Purpose: pick up PATH changes after winget/choco in this same session.
  # Inputs: none. Outputs: none. Side effects: overwrites $env:PATH.
  $machine = [System.Environment]::GetEnvironmentVariable('Path', 'Machine')
  $user = [System.Environment]::GetEnvironmentVariable('Path', 'User')
  if ($machine -or $user) {
    $env:PATH = ('{0};{1}' -f $machine, $user)
  }
  $nodeDir = Join-Path $env:ProgramFiles 'nodejs'
  if (Test-Path -LiteralPath (Join-Path $nodeDir 'node.exe')) {
    $env:PATH = ('{0};{1}' -f $nodeDir, $env:PATH)
  }
}

function Get-RequiredNodeVersion {
  # Purpose: read engines.node from package.json (default 20.18.0 for Expo SDK 57).
  # Inputs: package.json in $AppRoot. Outputs: [version]. Side effects: none.
  $pkgPath = Join-Path $AppRoot 'package.json'
  $pkg = Get-Content -LiteralPath $pkgPath -Raw | ConvertFrom-Json
  $raw = '>=20.18.0'
  if ($pkg.PSObject.Properties['engines'] -and $pkg.engines -and $pkg.engines.node) {
    $raw = [string]$pkg.engines.node
  }
  if ($raw -match '(\d+)\.(\d+)(?:\.(\d+))?') {
    $patch = 0
    if ($Matches[3]) { $patch = [int]$Matches[3] }
    return [version]::new([int]$Matches[1], [int]$Matches[2], $patch)
  }
  return [version]::new(20, 18, 0)
}

function Get-InstalledNodeVersion {
  # Purpose: current Node version, or $null if node is missing.
  # Inputs: none. Outputs: [version] or $null. Side effects: none.
  if (-not (Test-Cmd 'node')) { return $null }
  $raw = (node -p "process.versions.node" 2>$null)
  if (-not $raw) { return $null }
  if ($raw -match '(\d+)\.(\d+)\.(\d+)') {
    return [version]::new([int]$Matches[1], [int]$Matches[2], [int]$Matches[3])
  }
  return $null
}

function Invoke-PackageManagerInstall {
  # Purpose: install a named tool via winget, else Chocolatey.
  # Inputs: $WingetId, $ChocoId, $DisplayName.
  # Outputs: $true if the package manager reported success.
  # Side effects: runs winget or choco; may require elevation.
  param(
    [string]$WingetId,
    [string]$ChocoId,
    [string]$DisplayName
  )

  if (Test-Cmd 'winget') {
    Write-Host ('Installing {0} via winget ({1})...' -f $DisplayName, $WingetId)
    & winget install --id $WingetId -e --accept-source-agreements --accept-package-agreements
    if ($LASTEXITCODE -eq 0) { return $true }
    Write-WarnItem ('winget exited {0} for {1}. If already installed, PATH may need a new terminal.' -f $LASTEXITCODE, $DisplayName)
    return $false
  }

  if (Test-Cmd 'choco') {
    Write-Host ('Installing {0} via Chocolatey ({1})...' -f $DisplayName, $ChocoId)
    & choco install $ChocoId -y
    if ($LASTEXITCODE -eq 0) { return $true }
    Write-WarnItem ('choco exited {0} for {1}.' -f $LASTEXITCODE, $DisplayName)
    return $false
  }

  Write-WarnItem ('No winget or Chocolatey on PATH. Install {0} yourself.' -f $DisplayName)
  return $false
}

function Get-AndroidSdkRoot {
  # Purpose: find the Android SDK from env vars, then typical Windows paths.
  # Inputs: env ANDROID_HOME / ANDROID_SDK_ROOT. Outputs: path or $null.
  # Side effects: none.
  $candidates = @(
    $env:ANDROID_HOME,
    $env:ANDROID_SDK_ROOT,
    (Join-Path $env:LOCALAPPDATA 'Android\Sdk'),
    (Join-Path $env:USERPROFILE 'AppData\Local\Android\Sdk'),
    'C:\Android\Sdk'
  )
  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate)) {
      $adbProbe = Join-Path $candidate 'platform-tools\adb.exe'
      $emuProbe = Join-Path $candidate 'emulator\emulator.exe'
      if ((Test-Path -LiteralPath $adbProbe) -or (Test-Path -LiteralPath $emuProbe)) {
        return $candidate
      }
    }
  }
  return $null
}

function Get-JavaMajor {
  # Purpose: parse major version from `java -version` (writes to stderr).
  # Inputs: java on PATH. Outputs: int or $null.
  # Side effects: none. Design: temporarily Continue so stderr is not a
  # terminating error under $ErrorActionPreference Stop.
  if (-not (Test-Cmd 'java')) { return $null }
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $lines = & java -version 2>&1
    $out = ($lines | ForEach-Object { $_.ToString() }) -join "`n"
  } finally {
    $ErrorActionPreference = $prev
  }
  if ($out -match 'version\s+"1\.(\d+)') { return [int]$Matches[1] }
  if ($out -match 'version\s+"(\d+)') { return [int]$Matches[1] }
  return $null
}

function Find-Jdk17Home {
  # Purpose: locate a JDK 17 install (Microsoft OpenJDK or Android Studio JBR).
  # Inputs: JAVA_HOME, typical Program Files paths. Outputs: path or $null.
  # Side effects: none.
  $jdkCandidates = @()
  if ($env:JAVA_HOME) { $jdkCandidates += $env:JAVA_HOME }
  $jdkCandidates += (Join-Path $env:ProgramFiles 'Android\Android Studio\jbr')
  $ms = Get-ChildItem -LiteralPath (Join-Path $env:ProgramFiles 'Microsoft') -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like 'jdk-17*' }
  foreach ($dir in $ms) { $jdkCandidates += $dir.FullName }
  $adopt = Get-ChildItem -LiteralPath (Join-Path $env:ProgramFiles 'Eclipse Adoptium') -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like 'jdk-17*' }
  foreach ($dir in $adopt) { $jdkCandidates += $dir.FullName }

  foreach ($jdkDir in $jdkCandidates) {
    if (-not $jdkDir) { continue }
    $javaExe = Join-Path $jdkDir 'bin\java.exe'
    if (Test-Path -LiteralPath $javaExe) { return $jdkDir }
  }
  return $null
}

function Test-GitPresent {
  # Purpose: warn if git is missing (clone already happened, but later pulls need it).
  if (Test-Cmd 'git') {
    $ver = (git --version 2>$null)
    Write-Ok $ver
    return
  }
  Write-WarnItem 'Git not on PATH.'
  Write-Hint 'Install Git for Windows: https://git-scm.com/download/win'
}

function Ensure-Node {
  # Purpose: require Node >= engines.node; optionally install LTS via winget.
  # Inputs: $InstallTools. Outputs: none. Side effects: may install Node, refresh PATH.
  $required = Get-RequiredNodeVersion
  $requiredLabel = $required.ToString()
  $have = Get-InstalledNodeVersion

  if ($have -and $have -ge $required) {
    Write-Ok ('Node.js {0} (need {1}+)' -f $have, $requiredLabel)
    if (Test-Cmd 'npm') {
      Write-Ok 'npm (ships with Node.js)'
    } else {
      Write-FailItem 'npm missing even though node is present. Repair the Node.js install.'
    }
    return
  }

  if ($have) {
    Write-FailItem ('Node.js {0} is too old (need {1}+ for Expo SDK 57).' -f $have, $requiredLabel)
  } else {
    Write-FailItem ('Node.js not found (need {0}+ for Expo SDK 57).' -f $requiredLabel)
  }
  Write-Hint 'Download LTS: https://nodejs.org'
  Write-Hint "Or:  winget install --id OpenJS.NodeJS.LTS -e"

  if (-not $InstallTools) {
    Write-Hint 'Re-run with -InstallTools to install Node LTS via winget.'
    return
  }

  $script:HardFail = $false
  $ok = Invoke-PackageManagerInstall -WingetId 'OpenJS.NodeJS.LTS' -ChocoId 'nodejs-lts' -DisplayName 'Node.js LTS'
  Refresh-SessionPath
  $have = Get-InstalledNodeVersion
  if ($have -and $have -ge $required -and (Test-Cmd 'npm')) {
    Write-Ok ('Node.js {0} after install' -f $have)
    return
  }
  if ($ok -and $have -and $have -lt $required) {
    Write-FailItem ('Node.js {0} is still below {1}. Open a new terminal, or install LTS from https://nodejs.org' -f $have, $requiredLabel)
    return
  }
  Write-FailItem 'Node.js still missing after install. Open a new PowerShell and re-run, or install from https://nodejs.org'
}

function Ensure-Java {
  # Purpose: JDK 17 is needed for local Gradle / expo run:android, not for Metro web.
  # Inputs: $InstallTools. Outputs: none. Side effects: may install OpenJDK 17.
  $major = Get-JavaMajor
  $jdkHome = Find-Jdk17Home

  if ($major -eq 17) {
    Write-Ok ('Java {0} on PATH (JDK 17 - good for local Android builds)' -f $major)
    if ($env:JAVA_HOME) {
      Write-Hint ('JAVA_HOME={0}' -f $env:JAVA_HOME)
    }
    return
  }

  if ($jdkHome) {
    Write-Ok ('JDK 17 found at {0} (Android Studio JBR or OpenJDK)' -f $jdkHome)
    Write-Hint 'Not on PATH / JAVA_HOME. Local Gradle: set JAVA_HOME to that folder.'
    if ($InstallTools -and -not $env:JAVA_HOME) {
      $env:JAVA_HOME = $jdkHome
      $env:PATH = ('{0};{1}' -f (Join-Path $jdkHome 'bin'), $env:PATH)
      Write-Hint 'Set JAVA_HOME for this session only.'
    }
    return
  }

  if ($major) {
    Write-WarnItem ('Java {0} on PATH; Expo local Android builds expect JDK 17.' -f $major)
  } else {
    Write-WarnItem 'Java / JDK not found. Needed only for local APK / expo run:android (not npm start).'
  }
  Write-Hint 'Android Studio bundled JBR is enough, or install Microsoft OpenJDK 17.'
  Write-Hint "winget install --id Microsoft.OpenJDK.17 -e"

  if (-not $InstallTools) {
    Write-Hint 'Re-run with -InstallTools to install OpenJDK 17 via winget.'
    return
  }

  $null = Invoke-PackageManagerInstall -WingetId 'Microsoft.OpenJDK.17' -ChocoId 'microsoft-openjdk17' -DisplayName 'Microsoft OpenJDK 17'
  Refresh-SessionPath
  $jdkHome = Find-Jdk17Home
  $major = Get-JavaMajor
  if ($major -eq 17 -or $jdkHome) {
    Write-Ok 'JDK 17 available after install'
    if ($jdkHome -and -not $env:JAVA_HOME) {
      $env:JAVA_HOME = $jdkHome
      $env:PATH = ('{0};{1}' -f (Join-Path $jdkHome 'bin'), $env:PATH)
    }
    return
  }
  Write-WarnItem 'JDK 17 still not visible. Open a new terminal, or use Android Studio JBR.'
}

function Test-AndroidToolkit {
  # Purpose: emulator/APK extras — check SDK, adb, emulator; never install Android Studio.
  $sdk = Get-AndroidSdkRoot
  if (-not $sdk) {
    Write-WarnItem 'Android SDK not found (needed for npm run emu / local APK, not for npm start).'
    Write-Hint 'Install Android Studio, then SDK + one AVD in Device Manager.'
    Write-Hint 'Typical SDK: %LOCALAPPDATA%\Android\Sdk  (set ANDROID_HOME to that folder).'
    Write-Hint "This script does not install Android Studio (large IDE)."
    Write-Hint "Optional:  winget install --id Google.AndroidStudio -e"
    return
  }

  Write-Ok ('Android SDK: {0}' -f $sdk)
  $adb = Join-Path $sdk 'platform-tools\adb.exe'
  $emulatorExe = Join-Path $sdk 'emulator\emulator.exe'
  if (Test-Path -LiteralPath $adb) {
    Write-Ok 'adb (platform-tools)'
  } else {
    Write-WarnItem ('adb missing at {0}. Install Android SDK Platform-Tools in SDK Manager.' -f $adb)
  }
  if (Test-Path -LiteralPath $emulatorExe) {
    Write-Ok 'emulator'
    $avds = @(& $emulatorExe -list-avds 2>$null | ForEach-Object { $_.ToString().Trim() } | Where-Object { $_ })
    if ($avds.Count -gt 0) {
      Write-Ok ('AVDs: {0}' -f ($avds -join ', '))
    } else {
      Write-WarnItem 'No AVDs. Create one in Android Studio Device Manager, then npm run emu.'
    }
  } else {
    Write-WarnItem ('emulator missing at {0}. Install Android Emulator in SDK Manager.' -f $emulatorExe)
  }
}

# --- checks ---
Write-Host 'Checking tools...'
Write-Host ''

Test-GitPresent
Ensure-Node
Ensure-Java
Test-AndroidToolkit

Write-Host ''
if ($script:HardFail) {
  Write-Host 'Cannot npm install until Node.js (20.18+) is available.' -ForegroundColor Red
  Write-Host 'Fix Node, then re-run this script. Primary command:'
  Write-Host "  powershell -ExecutionPolicy Bypass -File .\scripts\setup-dev.ps1 -InstallTools"
  exit 1
}

if (-not (Test-Cmd 'npm')) {
  Write-FailItem 'npm is required (ships with Node.js).'
  exit 1
}

# Purpose: always install JS deps — this is the main "packages" step on a new PC.
Write-Host 'Installing npm packages (npm install)...'
npm install
if ($LASTEXITCODE -ne 0) {
  Write-Host 'npm install failed.' -ForegroundColor Red
  exit 1
}
Write-Ok 'npm install'

# Expo and EAS stay on npx; expo is already a dependency after npm install.
Write-Hint 'Expo CLI: npx expo   EAS CLI: npx eas-cli   (no global install needed)'

try {
  Write-Host 'Checking Expo native module versions (npx expo install --check)...'
  npx --yes expo install --check
  if ($LASTEXITCODE -eq 0) {
    Write-Ok 'expo install --check (native modules match SDK 57)'
  } else {
    Write-WarnItem 'expo install --check reported a mismatch. Pinned versions in package.json may still be fine.'
  }
} catch {
  Write-WarnItem 'Could not run expo install --check (skipped).'
}

Write-Host ''
Write-Host 'Next commands (from mobileApp):'
Write-Host '  npm start          Expo (then a / i / w)'
Write-Host '  npm run emu        local Android emulator'
Write-Host '  npm run apk        EAS preview APK (first time: npx eas-cli login - not run by setup)'
Write-Host ''
if ($script:WarnCount -gt 0) {
  Write-Host ('Setup finished with {0} warning(s). Web/Metro can still run; fix WARN items for emulator/APK.' -f $script:WarnCount) -ForegroundColor Yellow
} else {
  Write-Host 'Setup finished. This PC is ready to develop Halo.' -ForegroundColor Green
}
Write-Host ''
Write-Host 'npm run setup needs Node already. On a brand-new PC use this script directly (optionally -InstallTools).'
