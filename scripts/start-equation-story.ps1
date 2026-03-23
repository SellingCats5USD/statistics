param(
  [switch]$ForceRestart
)

$ErrorActionPreference = "Stop"

$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backendDir = Join-Path $workspaceRoot "math-explainer\backend"
$stateDir = Join-Path $workspaceRoot "tmp\equation-story-launcher"
$backendStdoutLog = Join-Path $stateDir "backend.stdout.log"
$backendStderrLog = Join-Path $stateDir "backend.stderr.log"
$tunnelStdoutLog = Join-Path $stateDir "cloudflared.stdout.log"
$tunnelStderrLog = Join-Path $stateDir "cloudflared.stderr.log"
$backendPidPath = Join-Path $stateDir "backend.pid"
$tunnelPidPath = Join-Path $stateDir "cloudflared.pid"
$tunnelUrlPath = Join-Path $stateDir "tunnel-url.txt"
$healthUrl = "http://127.0.0.1:8787/health"

New-Item -ItemType Directory -Force -Path $stateDir | Out-Null

function Get-TrackedProcess {
  param(
    [Parameter(Mandatory = $true)]
    [string]$PidFilePath
  )

  if (-not (Test-Path $PidFilePath)) {
    return $null
  }

  $rawPid = (Get-Content -Path $PidFilePath -Raw).Trim()
  if (-not $rawPid) {
    Remove-Item -Path $PidFilePath -Force -ErrorAction SilentlyContinue
    return $null
  }

  try {
    return Get-Process -Id ([int]$rawPid) -ErrorAction Stop
  } catch {
    Remove-Item -Path $PidFilePath -Force -ErrorAction SilentlyContinue
    return $null
  }
}

function Stop-TrackedProcess {
  param(
    [Parameter(Mandatory = $true)]
    [string]$PidFilePath
  )

  $process = Get-TrackedProcess -PidFilePath $PidFilePath
  if ($null -ne $process) {
    Stop-Process -Id $process.Id -Force
  }

  Remove-Item -Path $PidFilePath -Force -ErrorAction SilentlyContinue
}

function Test-BackendHealthy {
  try {
    $response = Invoke-RestMethod -UseBasicParsing -Uri $healthUrl -TimeoutSec 3
    return [bool]$response.ok
  } catch {
    return $false
  }
}

function Wait-ForBackend {
  $attempts = 60
  for ($i = 0; $i -lt $attempts; $i++) {
    if (Test-BackendHealthy) {
      return
    }
    Start-Sleep -Seconds 1
  }

  throw "Backend never became healthy at $healthUrl. Check $backendStdoutLog and $backendStderrLog."
}

function Wait-ForTunnelUrl {
  $pattern = "https://[-a-z0-9]+\.trycloudflare\.com"
  $attempts = 90

  for ($i = 0; $i -lt $attempts; $i++) {
    $logs = @($tunnelStdoutLog, $tunnelStderrLog)
    foreach ($logPath in $logs) {
      if (-not (Test-Path $logPath)) {
        continue
      }

      $content = Get-Content -Path $logPath -Raw -ErrorAction SilentlyContinue
      $match = [regex]::Match($content, $pattern)
      if ($match.Success) {
        return $match.Value
      }
    }

    Start-Sleep -Seconds 1
  }

  throw "Cloudflare Tunnel never printed a trycloudflare URL. Check $tunnelStdoutLog and $tunnelStderrLog."
}

function Start-BackgroundProcess {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Command,
    [Parameter(Mandatory = $true)]
    [string]$WorkingDirectory,
    [Parameter(Mandatory = $true)]
    [string]$StdoutPath,
    [Parameter(Mandatory = $true)]
    [string]$StderrPath
  )

  Remove-Item -Path $StdoutPath -Force -ErrorAction SilentlyContinue
  Remove-Item -Path $StderrPath -Force -ErrorAction SilentlyContinue

  return Start-Process `
    -FilePath "powershell.exe" `
    -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $Command) `
    -WorkingDirectory $WorkingDirectory `
    -WindowStyle Minimized `
    -RedirectStandardOutput $StdoutPath `
    -RedirectStandardError $StderrPath `
    -PassThru
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "npm is not available in PATH. Open a terminal where npm works first."
}

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
  throw "cloudflared is not available in PATH. Install it first or start the tunnel manually."
}

if ($ForceRestart) {
  Stop-TrackedProcess -PidFilePath $tunnelPidPath
  Stop-TrackedProcess -PidFilePath $backendPidPath
  Remove-Item -Path $tunnelUrlPath -Force -ErrorAction SilentlyContinue
}

$backendAlreadyHealthy = Test-BackendHealthy
if (-not $backendAlreadyHealthy) {
  $backendCommand = "Set-Location '$backendDir'; npm run dev"
  $backendProcess = Start-BackgroundProcess `
    -Command $backendCommand `
    -WorkingDirectory $backendDir `
    -StdoutPath $backendStdoutLog `
    -StderrPath $backendStderrLog

  Set-Content -Path $backendPidPath -Value $backendProcess.Id
  Wait-ForBackend
}

$existingTunnelProcess = Get-TrackedProcess -PidFilePath $tunnelPidPath
$existingTunnelUrl = if (Test-Path $tunnelUrlPath) { (Get-Content -Path $tunnelUrlPath -Raw).Trim() } else { "" }

if ($null -eq $existingTunnelProcess) {
  $tunnelCommand = "cloudflared tunnel --url http://127.0.0.1:8787"
  $tunnelProcess = Start-BackgroundProcess `
    -Command $tunnelCommand `
    -WorkingDirectory $workspaceRoot `
    -StdoutPath $tunnelStdoutLog `
    -StderrPath $tunnelStderrLog

  Set-Content -Path $tunnelPidPath -Value $tunnelProcess.Id
  $tunnelUrl = Wait-ForTunnelUrl
  Set-Content -Path $tunnelUrlPath -Value $tunnelUrl
} else {
  $tunnelUrl = $existingTunnelUrl
  if (-not $tunnelUrl) {
    $tunnelUrl = Wait-ForTunnelUrl
    Set-Content -Path $tunnelUrlPath -Value $tunnelUrl
  }
}

if ($tunnelUrl) {
  Set-Clipboard -Value $tunnelUrl
}

Write-Host ""
Write-Host "Equation Story stack is up." -ForegroundColor Green
Write-Host "Backend health:" -ForegroundColor Cyan
Write-Host "  $healthUrl"
Write-Host "Public tunnel URL (copied to clipboard):" -ForegroundColor Cyan
Write-Host "  $tunnelUrl"
Write-Host ""
Write-Host "Logs:" -ForegroundColor Cyan
Write-Host "  Backend stdout: $backendStdoutLog"
Write-Host "  Backend stderr: $backendStderrLog"
Write-Host "  Tunnel stdout:  $tunnelStdoutLog"
Write-Host "  Tunnel stderr:  $tunnelStderrLog"
Write-Host ""
Write-Host "Paste the tunnel URL into the extension backend field if it changed." -ForegroundColor Yellow
