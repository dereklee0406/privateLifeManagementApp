<#
.SYNOPSIS
  Start Halo Expo/Metro on http://localhost:8081 (server only, no AVD).

.DESCRIPTION
  Purpose: run the Expo bundler so a browser, Expo Go, or an already-running
  emulator can connect. Does not boot an Android emulator.

  Inputs:
    -Clear           Metro cache reset (expo start --clear)
    -Web             Open the web preview (--web)
    -Tunnel          Expo tunnel instead of LAN (ngrok-style)
    -LocalhostOnly   Bind loopback only (--localhost). Breaks physical devices.
    -Force           If 8081 is in use, stop that listener then start.

  Outputs: Metro bundler in this terminal. URL: http://localhost:8081

  Side effects: may npm install; may Stop-Process on 8081 listeners when -Force.

  Design: default host is LAN so localhost AND the LAN IP work. Use
  -LocalhostOnly only when you do not need a phone. npm run emu boots an AVD
  and runs expo start --android; this script is the bundler only.

.PARAMETER Clear
  Pass --clear to Expo (Metro cache).

.PARAMETER Web
  Pass --web so Expo opens the browser preview.

.PARAMETER Tunnel
  Pass --tunnel. Cannot be combined with -LocalhostOnly.

.PARAMETER LocalhostOnly
  Pass --localhost. Physical devices cannot reach the bundler.

.PARAMETER Force
  Kill whatever is LISTENING on 8081, then start. Default is to fail and print
  the PID plus a netstat command.

.EXAMPLE
  .\scripts\start-metro.ps1
  .\scripts\start-metro.ps1 -Clear
  .\scripts\start-metro.ps1 -Web
  .\scripts\start-metro.ps1 -LocalhostOnly
  .\scripts\start-metro.ps1 -Force
#>
[CmdletBinding()]
param(
  [Alias('c')]
  [switch]$Clear,

  [switch]$Web,

  [switch]$Tunnel,

  [switch]$LocalhostOnly,

  [switch]$Force
)

$ErrorActionPreference = 'Stop'

$MetroPort = 8081
$MetroUrl = 'http://localhost:8081'

# Purpose: resolve mobileApp whether invoked from repo root or this folder.
$AppRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $AppRoot

Write-Host ('Halo Metro - {0} (port {1})' -f $AppRoot, $MetroPort)
Write-Host ''

function Test-Cmd {
  # Purpose: true if a command is on PATH.
  # Inputs: $Name. Outputs: bool. Side effects: none.
  param([string]$Name)
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Fail {
  # Purpose: print an error and exit 1.
  # Inputs: $Message. Outputs: console. Side effects: process exit.
  param([string]$Message)
  Write-Host $Message -ForegroundColor Red
  exit 1
}

function Get-TcpListenPids {
  # Purpose: PIDs LISTENING on a TCP port (from netstat, no admin needed).
  # Inputs: $Port. Outputs: unique int[] of PIDs (empty if none).
  # Side effects: none.
  # Design: parse netstat -ano -p tcp so the same command is what we print
  # for the user. Bound the port (":8081 " not ":80810").
  param([int]$Port)
  $pids = @()
  $lines = & netstat.exe -ano -p tcp 2>$null
  if (-not $lines) { return @() }
  $suffix = (':{0}' -f $Port)
  foreach ($line in $lines) {
    $text = $line.ToString()
    if ($text -notmatch 'LISTENING') { continue }
    if ($text -notmatch '^\s*TCP\s+(\S+)\s+\S+\s+LISTENING\s+(\d+)\s*$') { continue }
    $local = $Matches[1]
    $owningPid = [int]$Matches[2]
    $localPort = $local
    $colon = $local.LastIndexOf(':')
    if ($colon -ge 0) {
      $localPort = $local.Substring($colon)
    }
    if ($localPort -ne $suffix) { continue }
    if ($owningPid -gt 0) {
      $pids += $owningPid
    }
  }
  return @($pids | Select-Object -Unique)
}

function Stop-TcpListenPids {
  # Purpose: stop processes listening on a port so Expo can bind it.
  # Inputs: $Pids. Outputs: none.
  # Side effects: Stop-Process -Force on each PID (skips 0 and 4 / System).
  # Design: -Force on this script is the only path that kills; default never does.
  param([int[]]$Pids)
  foreach ($owningPid in $Pids) {
    if ($owningPid -le 4) {
      Fail ('Refusing to kill system PID {0} on port {1}. Stop it yourself, then re-run.' -f $owningPid, $MetroPort)
    }
    Write-Host ('Stopping PID {0} on port {1}...' -f $owningPid, $MetroPort)
    Stop-Process -Id $owningPid -Force -ErrorAction Stop
  }
}

function Show-PortBusyHelp {
  # Purpose: tell the user Metro (or something else) already owns 8081.
  # Inputs: $Pids. Outputs: console. Side effects: none.
  param([int[]]$Pids)
  $pidList = ($Pids | ForEach-Object { $_.ToString() }) -join ', '
  Write-Host ('Metro already on {0}' -f $MetroPort) -ForegroundColor Yellow
  Write-Host ('Open: {0}' -f $MetroUrl)
  Write-Host 'Expo Go on a physical phone needs the LAN IP shown in that Metro terminal, not localhost.'
  Write-Host ('Listener PID: {0}' -f $pidList)
  Write-Host ('To inspect: netstat -ano | findstr :{0}' -f $MetroPort)
  Write-Host 'Re-run with -Force to stop that process and start a new server.'
}

if ($Tunnel -and $LocalhostOnly) {
  Fail 'Use either -Tunnel or -LocalhostOnly, not both.'
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
  Write-Host 'Installing npm dependencies...'
  npm install
  if ($LASTEXITCODE -ne 0) {
    Fail 'npm install failed.'
  }
}

$busy = @(Get-TcpListenPids -Port $MetroPort)
if ($busy.Count -gt 0) {
  if (-not $Force) {
    Show-PortBusyHelp -Pids $busy
    exit 1
  }
  Stop-TcpListenPids -Pids $busy
  Start-Sleep -Seconds 1
  $still = @(Get-TcpListenPids -Port $MetroPort)
  if ($still.Count -gt 0) {
    Fail ('Port {0} still in use after -Force (PID {1}). Close it, then re-run.' -f $MetroPort, (($still | ForEach-Object { $_.ToString() }) -join ', '))
  }
}

$expoArgs = @('--yes', 'expo', 'start', '--port', "$MetroPort")
if ($LocalhostOnly) {
  $expoArgs += '--localhost'
} elseif ($Tunnel) {
  $expoArgs += '--tunnel'
} else {
  $expoArgs += '--lan'
}
if ($Clear) {
  $expoArgs += '--clear'
}
if ($Web) {
  $expoArgs += '--web'
}

Write-Host ('Starting Expo/Metro on {0}' -f $MetroUrl)
if ($LocalhostOnly) {
  Write-Host 'Host: localhost only (physical devices cannot connect).'
} elseif ($Tunnel) {
  Write-Host 'Host: tunnel (Expo prints a public URL).'
} else {
  Write-Host 'Host: LAN (localhost and your LAN IP both work).'
}
Write-Host 'This script does not start an emulator. For an AVD: npm run emu'
Write-Host 'Then open Expo Go, press a/w in this terminal, or use the URL above.'
Write-Host ''

& npx @expoArgs
if ($LASTEXITCODE -ne 0) {
  Fail 'expo start failed.'
}
