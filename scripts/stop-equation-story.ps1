$ErrorActionPreference = "Stop"

$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$stateDir = Join-Path $workspaceRoot "tmp\equation-story-launcher"
$backendPidPath = Join-Path $stateDir "backend.pid"
$tunnelPidPath = Join-Path $stateDir "cloudflared.pid"

function Stop-TrackedProcess {
  param(
    [Parameter(Mandatory = $true)]
    [string]$PidFilePath
  )

  if (-not (Test-Path $PidFilePath)) {
    return
  }

  $rawPid = (Get-Content -Path $PidFilePath -Raw).Trim()
  if ($rawPid) {
    try {
      $process = Get-Process -Id ([int]$rawPid) -ErrorAction Stop
      Stop-Process -Id $process.Id -Force
      Write-Host "Stopped process $($process.Id)." -ForegroundColor Green
    } catch {
      Write-Host "No running process found for PID $rawPid." -ForegroundColor Yellow
    }
  }

  Remove-Item -Path $PidFilePath -Force -ErrorAction SilentlyContinue
}

Stop-TrackedProcess -PidFilePath $tunnelPidPath
Stop-TrackedProcess -PidFilePath $backendPidPath

Write-Host "Equation Story launcher processes are stopped." -ForegroundColor Cyan
