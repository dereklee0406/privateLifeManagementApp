<#
.SYNOPSIS
  Boot a local Android emulator and start Halo (Expo) against it.

.DESCRIPTION
  Purpose: run Halo on a local AVD without cloud, EAS, or a physical phone.

  Inputs:
    -Avd            Optional AVD name (default: Pixel_9a if present, else first AVD)
    -Clear          Metro cache reset (expo start --clear --android)
    -LocalDebug     Native debug install (expo run:android) instead of Expo Go
    -Gpu            host | auto | swiftshader_indirect (default auto)
    -Snapshot       Load a quick-boot snapshot (default: -no-snapshot-load)

  Outputs: Metro bundler in this terminal; emulator window stays open.

  Side effects: may npm install, start an emulator process, set ANDROID_HOME
  for this session, launch Expo Go (default) or assembleDebug + install (-LocalDebug).

  Package: com.halo.journal (app.json). Default path is expo start --android
  (Expo Go). adb am start is only used after a native -LocalDebug install.

.PARAMETER Avd
  AVD to start when none is already running. Default prefers Pixel_9a.
  Example override: -Avd Medium_Phone_API_36.1

.PARAMETER Clear
  Pass --clear to Expo (Metro cache).

.PARAMETER LocalDebug
  Same idea as build-apk.ps1 -LocalDebug: local SDK/JDK path, not Expo Go.

.PARAMETER Gpu
  Emulator GPU mode. Use swiftshader_indirect if the AVD window stays black.
  Software GPU boots slowly; wait timeout becomes 300s instead of 180s.

.PARAMETER Snapshot
  Load a saved snapshot for faster boot. Default is -no-snapshot-load so a
  bad snapshot cannot hang QEMU.

.EXAMPLE
  .\scripts\start-emulator.ps1
  .\scripts\start-emulator.ps1 -Avd Pixel_9a
  .\scripts\start-emulator.ps1 -Avd Medium_Phone_API_36.1
  .\scripts\start-emulator.ps1 -Clear
  .\scripts\start-emulator.ps1 -LocalDebug
  .\scripts\start-emulator.ps1 -Gpu swiftshader_indirect
#>
[CmdletBinding()]
param(
  [string]$Avd,

  [Alias('c')]
  [switch]$Clear,

  [switch]$LocalDebug,

  [ValidateSet('host', 'auto', 'swiftshader_indirect')]
  [string]$Gpu = 'auto',

  [switch]$Snapshot
)

$ErrorActionPreference = 'Stop'

# Purpose: resolve mobileApp whether invoked from repo root or this folder.
$AppRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $AppRoot

Write-Host ('Halo emulator - {0} (com.halo.journal)' -f $AppRoot)
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

function Get-AndroidSdkRoot {
  # Purpose: find the SDK from env vars, then typical Windows install paths.
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

function Get-AdbEmulators {
  # Purpose: parse `adb devices` for emulator-* rows.
  # Inputs: $Adb path (SDK adb only). Outputs: objects with Serial + State.
  param([string]$Adb)
  $lines = & $Adb devices 2>$null
  $found = @()
  foreach ($line in $lines) {
    if ($line -match '^(emulator-\d+)\s+(\S+)') {
      $found += [pscustomobject]@{ Serial = $Matches[1]; State = $Matches[2] }
    }
  }
  return $found
}

function Get-PreferredAvd {
  # Purpose: pick a daily-driver AVD without requiring -Avd.
  # Inputs: names from emulator -list-avds. Outputs: Pixel_9a if present, else first.
  # Design: list-avds is alphabetical, so Medium_Phone would otherwise win over Pixel_9a.
  param([string[]]$AvdNames)
  if ($AvdNames -contains 'Pixel_9a') {
    return 'Pixel_9a'
  }
  return $AvdNames[0]
}

function Get-EmulatorLaunchArgs {
  # Purpose: AVD flags that skip unused radios and reduce false QEMU hang noise.
  # Inputs: AVD name, GPU mode, whether to load a snapshot.
  # Outputs: string[] for emulator.exe (networking stays on for Halo FX).
  # Side effects: none.
  # Design: disable UWB only; default no snapshot load; cap at 4 cores; -no-metrics.
  param(
    [string]$AvdName,
    [string]$GpuMode,
    [switch]$LoadSnapshot
  )
  $launchArgs = @(
    '-avd', $AvdName,
    '-feature', '-Uwb',
    '-gpu', $GpuMode,
    '-cores', '4',
    '-no-metrics'
  )
  if (-not $LoadSnapshot) {
    $launchArgs += '-no-snapshot-load'
  }
  return $launchArgs
}

function Start-AvdProcess {
  # Purpose: start emulator.exe in its own window so this script can poll adb.
  # Inputs: emulator path, launch args.
  # Outputs: none (process is detached).
  # Side effects: opens a Normal-style emulator/QEMU window.
  # Design: do not wrap in cmd or redirect stdout. On Windows emulator.exe is a
  # launcher that often exits in seconds after spawning qemu-system-*. Redirecting
  # the launcher's stdout can block that spawn and leaves no useful log.
  param(
    [string]$EmulatorExe,
    [string[]]$LaunchArgs
  )
  $argString = ($LaunchArgs | ForEach-Object {
    if ($_ -match '\s') { '"{0}"' -f $_ } else { $_ }
  }) -join ' '
  Write-Host 'QEMU/UWB messages may print in a separate emulator console (stdout is not captured).'
  Start-Process -FilePath $EmulatorExe -ArgumentList $argString -WindowStyle Normal | Out-Null
}

function Test-EmulatorVmProcess {
  # Purpose: true if qemu-system-* or emulator.exe is running (not crash helpers).
  # Inputs: none. Outputs: bool. Side effects: none.
  # Design: Windows emulator.exe is a launcher; qemu-system-x86_64.exe is the VM.
  $alive = Get-Process -ErrorAction SilentlyContinue |
    Where-Object { $_.ProcessName -match '^(qemu-system-.+|emulator)$' }
  return [bool]$alive
}

function Test-EmulatorWindow {
  # Purpose: true if qemu/emulator has a visible main window.
  # Inputs: none. Outputs: bool. Side effects: none.
  $win = Get-Process -ErrorAction SilentlyContinue |
    Where-Object {
      $_.ProcessName -match '^(qemu-system-.+|emulator)$' -and
      $_.MainWindowHandle -ne [IntPtr]::Zero
    }
  return [bool]$win
}

function Test-EmulatorLive {
  # Purpose: true if the VM is up: qemu/emulator process, adb emulator-*, or a window.
  # Inputs: SDK adb path. Outputs: bool. Side effects: none.
  # Design: parent emulator.exe exit is not death; qemu or an adb listing is enough.
  param([string]$Adb)
  if (Test-EmulatorVmProcess) { return $true }
  if (Test-EmulatorWindow) { return $true }
  $listed = @(Get-AdbEmulators -Adb $Adb)
  return ($listed.Count -gt 0)
}

function Wait-EmulatorSpawn {
  # Purpose: wait until qemu, an adb emulator-*, or a window appears after launch.
  # Inputs: SDK adb path, timeout seconds. Outputs: bool (spawned or not).
  # Side effects: prints a one-line wait. Design: ~20s window; launcher exit is ignored.
  param(
    [string]$Adb,
    [int]$TimeoutSec = 20
  )
  Write-Host ('Waiting up to {0}s for QEMU or adb emulator-*.' -f $TimeoutSec)
  $started = Get-Date
  while (((Get-Date) - $started).TotalSeconds -lt $TimeoutSec) {
    if (Test-EmulatorLive -Adb $Adb) {
      return $true
    }
    Start-Sleep -Seconds 1
  }
  return (Test-EmulatorLive -Adb $Adb)
}

function Show-EmulatorLogTail {
  # Purpose: print last lines of a log if one exists; otherwise point at the console.
  # Inputs: log path, line count. Outputs: console. Side effects: none.
  param(
    [string]$LogPath,
    [int]$Lines = 30
  )
  if (-not $LogPath -or -not (Test-Path -LiteralPath $LogPath)) {
    Write-Host 'No captured emulator log (QEMU/UWB print in the emulator console, not this terminal).'
    if ($LogPath) {
      Write-Host ('Looked for {0}' -f $LogPath)
    }
    return
  }
  Write-Host ('Last {0} lines of {1}:' -f $Lines, $LogPath)
  Get-Content -LiteralPath $LogPath -Tail $Lines | ForEach-Object { Write-Host $_ }
}

function Write-EmulatorWaitHint {
  # Purpose: next steps after a failed spawn or boot wait. ASCII only.
  # Inputs: optional log path, AVD name, GPU mode used for this launch.
  # Outputs: console. Side effects: none.
  # Design: do not suggest Pixel_9a as a "faster AVD" if that is already the target.
  # Swiftshader can fail to spawn; prefer auto/host first.
  param(
    [string]$LogPath,
    [string]$AvdName,
    [string]$GpuMode
  )
  if ($LogPath) {
    Write-Host ('Log path (often unused on Windows): {0}' -f $LogPath)
  }
  Write-Host 'QEMU/UWB output is in the emulator console window, not this terminal.'

  if ($GpuMode -eq 'swiftshader_indirect') {
    Write-Host 'Swiftshader is slower and can fail to spawn. Try without -Gpu first (default auto):'
    Write-Host ('  .\scripts\start-emulator.ps1 -Avd {0}' -f $AvdName)
  } else {
    Write-Host 'If the emulator window stays black, try software GPU:'
    Write-Host ('  .\scripts\start-emulator.ps1 -Avd {0} -Gpu swiftshader_indirect' -f $AvdName)
  }

  if ($AvdName -eq 'Pixel_9a') {
    Write-Host 'To try another AVD: .\scripts\start-emulator.ps1 -Avd Medium_Phone_API_36.1'
  } else {
    Write-Host 'To try Pixel_9a: .\scripts\start-emulator.ps1 -Avd Pixel_9a'
  }
  Write-Host 'If the emulator window never appeared, open Android Studio Device Manager.'
}

function Wait-EmulatorBoot {
  # Purpose: poll until an emulator serial is `device` and sys.boot_completed=1.
  # Inputs: SDK adb path, timeout seconds, log path, AVD name, GPU mode.
  # Outputs: serial string. Side effects: prints progress every 3s.
  # Design: do not use `adb wait-for-device` - it has no progress and is too short
  # for swiftshader. `offline` is not success. boot_completed can lag 1-2 min after serial.
  # emulator.exe parent exit is not failure while qemu or adb emulator-* is still up.
  param(
    [string]$Adb,
    [int]$TimeoutSec = 180,
    [string]$LogPath,
    [string]$AvdName,
    [string]$GpuMode
  )
  Write-Host ('Waiting for emulator to boot (up to {0}s)...' -f $TimeoutSec)
  $started = Get-Date
  while (((Get-Date) - $started).TotalSeconds -lt $TimeoutSec) {
    $elapsed = [int]((Get-Date) - $started).TotalSeconds
    Write-Host ('  still waiting ({0}s)...' -f $elapsed)

    if (-not (Test-EmulatorLive -Adb $Adb)) {
      Write-Host 'Emulator is gone (no QEMU, no adb emulator-*, no window) before boot completed.' -ForegroundColor Red
      Show-EmulatorLogTail -LogPath $LogPath
      Write-EmulatorWaitHint -LogPath $LogPath -AvdName $AvdName -GpuMode $GpuMode
      exit 1
    }

    $online = @(Get-AdbEmulators -Adb $Adb | Where-Object { $_.State -eq 'device' })
    if ($online.Count -gt 0) {
      $serial = $online[0].Serial
      $boot = (& $Adb -s $serial shell getprop sys.boot_completed 2>$null)
      if ($boot -and ($boot.ToString().Trim() -eq '1')) {
        Start-Sleep -Seconds 2
        return $serial
      }
    }

    Start-Sleep -Seconds 3
  }

  Write-Host ('Emulator did not become ready within {0}s (need device + sys.boot_completed=1).' -f $TimeoutSec) -ForegroundColor Red
  Show-EmulatorLogTail -LogPath $LogPath
  Write-EmulatorWaitHint -LogPath $LogPath -AvdName $AvdName -GpuMode $GpuMode
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

$sdk = Get-AndroidSdkRoot
if (-not $sdk) {
  Fail @'
Android SDK not found.

Install Android Studio, then set ANDROID_HOME (or ANDROID_SDK_ROOT) to the SDK folder.
Typical Windows path: %LOCALAPPDATA%\Android\Sdk
After the SDK is installed, re-run this script.
'@
}

$adb = Join-Path $sdk 'platform-tools\adb.exe'
$emulatorExe = Join-Path $sdk 'emulator\emulator.exe'

if (-not (Test-Path -LiteralPath $adb)) {
  Fail ('adb not found at {0}. Install Android SDK Platform-Tools in SDK Manager.' -f $adb)
}
if (-not (Test-Path -LiteralPath $emulatorExe)) {
  Fail ('emulator not found at {0}. Install Android Emulator in SDK Manager.' -f $emulatorExe)
}

$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
# SDK platform-tools first so a stray adb on PATH cannot win.
$env:PATH = ('{0};{1};{2}' -f (Join-Path $sdk 'platform-tools'), (Join-Path $sdk 'emulator'), $env:PATH)

Write-Host ('Android SDK: {0}' -f $sdk)
Write-Host ('Using SDK adb: {0}' -f $adb)

& $adb start-server | Out-Null

$avdNames = @(& $emulatorExe -list-avds 2>$null | ForEach-Object { $_.ToString().Trim() } | Where-Object { $_ })
if ($avdNames.Count -eq 0) {
  Fail @'
No Android Virtual Devices found.

Create one in Android Studio: Device Manager (AVD Manager) -> Create Device
(e.g. Pixel 9a, system image with Google Play, API 34+).
Then re-run this script.
'@
}

Write-Host 'Available AVDs:'
foreach ($name in $avdNames) {
  Write-Host ('  {0}' -f $name)
}
Write-Host ''

$serial = $null
$logPath = Join-Path $env:TEMP 'halo-emulator.log'
$bootTimeoutSec = 180
if ($Gpu -eq 'swiftshader_indirect') {
  $bootTimeoutSec = 300
}

$listed = @(Get-AdbEmulators -Adb $adb)
$alreadyDevice = @($listed | Where-Object { $_.State -eq 'device' })
$hintAvd = if ($Avd) { $Avd } else { Get-PreferredAvd -AvdNames $avdNames }

if ($alreadyDevice.Count -gt 0) {
  $serial = $alreadyDevice[0].Serial
  Write-Host ('Using already-running emulator: {0}' -f $serial)
} elseif ($listed.Count -gt 0 -or (Test-EmulatorVmProcess)) {
  if ($listed.Count -gt 0) {
    Write-Host ('Emulator already listed ({0}, state {1}); waiting for boot...' -f $listed[0].Serial, $listed[0].State)
  } else {
    Write-Host 'QEMU/emulator already running; waiting for adb...'
  }
  $serial = Wait-EmulatorBoot -Adb $adb -TimeoutSec $bootTimeoutSec -LogPath $logPath -AvdName $hintAvd -GpuMode $Gpu
  Write-Host ('Emulator ready: {0}' -f $serial)
} else {
  $targetAvd = $Avd
  if (-not $targetAvd) {
    $targetAvd = Get-PreferredAvd -AvdNames $avdNames
  } elseif ($avdNames -notcontains $targetAvd) {
    Fail ('AVD "{0}" not found. Create it in Android Studio Device Manager, or pick one of: {1}' -f $targetAvd, ($avdNames -join ', '))
  }

  # Packet streamer / netsimd UWB warnings are expected (Halo does not use UWB).
  $emuArgs = Get-EmulatorLaunchArgs -AvdName $targetAvd -GpuMode $Gpu -LoadSnapshot:$Snapshot
  Write-Host ('Starting emulator {0}... (UWB warnings are harmless)' -f $targetAvd)
  Write-Host 'Default GPU is auto. Swiftshader is slower and can fail to spawn; use -Gpu swiftshader_indirect only if the window stays black.'
  Write-Host 'Windows often prints QEMU hanging thread during boot - wait for the emulator window.'
  if ($targetAvd -ne 'Pixel_9a') {
    Write-Host 'Default AVD is Pixel_9a when present. Override: .\scripts\start-emulator.ps1 -Avd Medium_Phone_API_36.1'
  }
  Start-AvdProcess -EmulatorExe $emulatorExe -LaunchArgs $emuArgs

  if (-not (Wait-EmulatorSpawn -Adb $adb -TimeoutSec 20)) {
    Write-Host 'Emulator did not spawn QEMU, an adb emulator-*, or a window within 20s.' -ForegroundColor Red
    Show-EmulatorLogTail -LogPath $logPath
    Write-EmulatorWaitHint -LogPath $logPath -AvdName $targetAvd -GpuMode $Gpu
    exit 1
  }

  $serial = Wait-EmulatorBoot -Adb $adb -TimeoutSec $bootTimeoutSec -LogPath $logPath -AvdName $targetAvd -GpuMode $Gpu
  Write-Host ('Emulator ready: {0}' -f $serial)
}

$env:ANDROID_SERIAL = $serial

if (-not (Test-Path (Join-Path $AppRoot 'node_modules'))) {
  Write-Host 'Installing npm dependencies...'
  npm install
  if ($LASTEXITCODE -ne 0) {
    Fail 'npm install failed.'
  }
}

if ($LocalDebug) {
  if (-not $env:JAVA_HOME) {
    Write-Warning 'JAVA_HOME is not set. Gradle needs JDK 17. Set JAVA_HOME if the native build fails.'
  }
  Write-Host 'Local debug: expo run:android (native debug APK on this emulator, not Expo Go).'
  Write-Host ''
  if ($Clear) {
    npx --yes expo run:android --device $serial --no-build-cache
  } else {
    npx --yes expo run:android --device $serial
  }
  if ($LASTEXITCODE -ne 0) {
    Fail 'expo run:android failed. Check JDK 17, SDK licenses, and the emulator window.'
  }
  # Native package from app.json; Expo Go is host.exp.exponent and is not used here.
  & $adb -s $serial shell am start -n 'com.halo.journal/.MainActivity' 2>$null | Out-Null
  exit 0
}

Write-Host 'Starting Expo against the emulator (Expo Go). First run may install Expo Go on the AVD.'
Write-Host ''
if ($Clear) {
  npx --yes expo start --clear --android
} else {
  npx --yes expo start --android
}
if ($LASTEXITCODE -ne 0) {
  Fail 'expo start --android failed. If Expo Go is missing, open the Play Store on the emulator or retry.'
}
